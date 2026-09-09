import { CapabilityError } from "../../capability/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";
import { SubscriptionStateTransition } from "../domain/state-transition.entity.js";
import type { StateTransitionRepository } from "../domain/state-transition.repository.js";
import type { SubscriptionRepository } from "../domain/subscription.repository.js";
import { assertTransition, IllegalSubscriptionTransitionError } from "../domain/subscription-status.js";
import type { SubscriptionStatus } from "../domain/subscription-status.js";
import type { TransitionReason } from "../domain/transition-reason.js";
import { isServing } from "../domain/serving-state.js";
import type { SubscriptionDto } from "./subscribe-to-plan.input.js";

export interface CancelSubscriptionCommand {
  transitionId: string;
  tenantId: string;
  actorUserId: string;
}

/**
 * `subscription.cancel` — Phase 2 item 5, assigned by `PHASE_2_BRIEF.md` §3(a).
 *
 * ## Which status this produces, and the ambiguity behind the answer
 *
 * **The contract does not say, and that is reported rather than resolved
 * quietly.** `05` §4.2 gives `subscription.cancel` a scope, a risk and an
 * idempotency flag and nothing else; no ADR names the capability at all. ADR-024
 * item 3 makes **both** `ACTIVE → CANCELED` and `ACTIVE → CANCEL_AT_PERIOD_END`
 * legal, and ADR-024 item 2 makes them behave oppositely — `CANCEL_AT_PERIOD_END`
 * is SERVING until `period_end`, `CANCELED` is not serving at all.
 *
 * **What the machine does decide, and it decides half of it.** From `TRIALING`
 * the only legal cancellation is `TRIALING → CANCELED`;
 * `TRIALING → CANCEL_AT_PERIOD_END` is **not in ADR-024 item 3's list**. So the
 * trial branch is forced by the machine, not chosen here.
 *
 * **The paid branch is the judgement, and it is `CANCEL_AT_PERIOD_END`:**
 *
 *   * **ADR-020 rule 1 and `AGENTS.md` §4**: "expiry, downgrade and
 *     cancellation are **never** destructive." Ending service instantly on a
 *     term the tenant has paid for confiscates what they bought.
 *   * **`CANCEL_AT_PERIOD_END` exists in the machine for this**, and ADR-024
 *     item 2 explicitly keeps it serving "before `period_end`". A status that
 *     exists, is serving, and is reachable only from `ACTIVE` has one obvious
 *     occupant.
 *   * **It is reversible**: the machine gives `CANCEL_AT_PERIOD_END → ACTIVE`
 *     "(reactivated before `period_end`)", which is the undo a cancel-at-period-
 *     end flow needs and which immediate `CANCELED` — terminal — would not have.
 *
 * **Recorded in `decisions/2026-09.md` with options, per `AGENTS.md` §5**, and
 * flagged for the maintainer: if immediate termination is wanted, it is a
 * one-line change here plus a `reason_code`, and the machine already permits it.
 *
 * ## What this service does not do
 *
 * No refund, no proration, no invoice — those are items 12–15. Cancelling sets
 * a status and appends a transition; **`auto_renew` is left alone** because
 * `CANCEL_AT_PERIOD_END` already answers what happens at `period_end`, and two
 * fields encoding one decision is how they come to disagree.
 */
export class CancelSubscriptionService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly transitions: StateTransitionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<SubscriptionDto> {
    const now = this.clock.now();

    const subscription = await this.subscriptions.findByTenant(command.tenantId);
    if (!subscription) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "This organization has no subscription.");
    }

    const { toStatus, reasonCode } = decideCancellation(subscription.status);

    // ADR-024 item 3's machine, asserted rather than trusted. `TRIALING` and
    // `ACTIVE` reach a cancellation; `PAUSED` and `EXPIRED` reach `CANCELED`
    // too, and every other origin — including `CANCELED` itself — is a domain
    // error the machine rejects here rather than in the database.
    try {
      assertTransition(subscription.status, toStatus);
    } catch (err) {
      if (err instanceof IllegalSubscriptionTransitionError) {
        throw new CapabilityError("CONFLICT", `A ${subscription.status} subscription cannot be cancelled.`, {
          from: err.from,
          to: err.to,
        });
      }
      throw err;
    }

    const period = subscription.currentPeriodId
      ? await this.subscriptions.findPeriodById(subscription.currentPeriodId)
      : null;

    // ADR-045's optimistic-concurrency token, and this is its first real use:
    // that ruling names `subscriptions` because "the renewal job,
    // `subscription.cancel`, `plan.change` and `subscription.reactivate` all
    // write it". Zero rows affected means another writer moved first, which
    // surfaces as `CONCURRENCY_CONFLICT` / 409 — retryable, unlike `CONFLICT`.
    const updated = await this.subscriptions.transitionStatus({
      subscriptionId: subscription.id,
      expectedVersion: subscription.version,
      toStatus,
      canceledAt: toStatus === "CANCELED" ? now : null,
    });
    if (!updated) {
      throw new CapabilityError("CONCURRENCY_CONFLICT", "This subscription was modified concurrently. Retry.");
    }

    // ADR-024 item 3: "transitions are recorded in an append-only transition
    // log with actor and reason." Same transaction as the status change — a
    // history that can disagree with the row it describes is not a history.
    await this.transitions.append(
      new SubscriptionStateTransition(
        command.transitionId,
        subscription.tenantId,
        subscription.id,
        subscription.status,
        toStatus,
        reasonCode,
        "user",
        command.actorUserId,
        now,
      ),
    );

    return {
      id: subscription.id,
      organizationId: subscription.tenantId,
      status: toStatus,
      planVersionId: subscription.planVersionId,
      priceVersionId: subscription.priceVersionId,
      termLength: subscription.termLength,
      autoRenew: subscription.autoRenew,
      trialEndsAt: subscription.trialEnd?.toISOString() ?? null,
      currentPeriod: period
        ? {
            startsAt: period.periodStart.toISOString(),
            endsAt: period.periodEnd.toISOString(),
            status: period.status,
          }
        : null,
      // ADR-024 item 2's one function. A cancelled trial stops serving
      // immediately; a cancelled paid term keeps serving until `period_end`.
      // The difference falls straight out of the status, which is the point of
      // deriving it rather than storing it.
      servingNow: isServing({
        status: toStatus,
        periodEnd: period?.periodEnd ?? null,
        graceEnd: period?.graceEnd ?? null,
        now,
      }),
    };
  }
}

/**
 * The branch, extracted so it is one readable statement of the rule above and
 * so the spec can exercise it directly.
 *
 * A subscription that has never been paid for — `TRIALING` — ends now: nothing
 * was bought, so nothing is owed. One that has been paid for ends at
 * `period_end`, keeping what the tenant paid for. Every other origin falls
 * through to `CANCELED` and is then checked against ADR-024 item 3's machine,
 * which rejects the ones that may not cancel at all.
 */
export function decideCancellation(from: SubscriptionStatus): {
  toStatus: SubscriptionStatus;
  reasonCode: TransitionReason;
} {
  if (from === "ACTIVE") {
    return { toStatus: "CANCEL_AT_PERIOD_END", reasonCode: "SCHEDULED_CANCELLATION_BY_TENANT" };
  }
  return { toStatus: "CANCELED", reasonCode: "CANCELED_BY_TENANT" };
}
