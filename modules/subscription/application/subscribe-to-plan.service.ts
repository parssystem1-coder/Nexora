import { CapabilityError } from "../../capability/contracts/index.js";
import type { PlanOfferingRepository } from "../../billing/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";
import { Subscription, SubscriptionPeriod } from "../domain/subscription.entity.js";
import { TrialAlreadyUsedError } from "../domain/subscription.repository.js";
import type { SubscriptionRepository } from "../domain/subscription.repository.js";
import { isServing } from "../domain/serving-state.js";
import type { SubscriptionDto } from "./subscribe-to-plan.input.js";

export interface SubscribeToPlanCommand {
  subscriptionId: string;
  periodId: string;
  tenantId: string;
  planVersionId: string;
  termMonths: number;
}

/**
 * ADR-052's entry point: "**`plan.subscribe` starts the trial. No new
 * capability, and no payment required.**" A trial *is* a subscription, in
 * `TRIALING`, and ADR-024's state machine already models its whole life.
 *
 * ## The no-trial branch creates nothing, and that is now ruled rather than escalated
 *
 * Item 4 declined to implement ADR-052 item 2's second outcome — an `ACTIVE`
 * subscription when the plan version offers no trial — because `ACTIVE` is a
 * SERVING state (ADR-024 item 2) that ADR-024 reaches only through payment, and
 * the branch is reachable by any organization that has already used its trial.
 *
 * **The maintainer ruled it on 2026-09-09** (ADR-052's amendment of that date):
 *
 * > There is no unpaid subscription. A subscription row exists only once it is
 * > either `TRIALING` — a trial having been granted — or paid.
 * >
 * > `plan.subscribe` against a version that offers no trial does not create a
 * > subscription. **It creates a payment intent.** The subscription, its first
 * > period and its invoice are created inside the transaction that verifies that
 * > payment.
 *
 * **So the permanent behaviour of this branch is to create an intent, and that
 * belongs to Phase 2 item 12**, which owns `billing_payment_intents` and
 * `billing.payment.initiate`. Until item 12 exists there is nothing to create,
 * so the branch refuses — the same refusal item 4 shipped, now with a ruling
 * behind it instead of an open question. The refusal is the interim; the intent
 * is the design.
 *
 * ADR-024's machine is unchanged and gains no status: the pending thing is the
 * intent, not the subscription. A dated cross-reference in ADR-024 item 3
 * records that the machine's only entry states are `TRIALING` and `ACTIVE`.
 */
export class SubscribeToPlanService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly offerings: PlanOfferingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SubscribeToPlanCommand): Promise<SubscriptionDto> {
    const now = this.clock.now();

    // One subscription per organization in Phase 2. A second one is a
    // `plan.change` (item 15) or a `subscription.reactivate` (item 16), never a
    // second subscribe — and neither exists yet.
    if (await this.subscriptions.existsForTenant(command.tenantId)) {
      throw new CapabilityError("CONFLICT", "This organization already has a subscription.");
    }

    const offering = await this.offerings.findOffering({
      planVersionId: command.planVersionId,
      termMonths: command.termMonths,
      asOf: now,
    });
    if (!offering) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "No plan is on offer for that version and term.");
    }

    if (offering.trialPeriodDays <= 0) {
      // See this class's doc comment. Not `RESOURCE_NOT_FOUND`: the plan exists
      // and the caller named it correctly. `CONFLICT` is `05` §7's code for a
      // request that permanently conflicts with current state until something
      // changes — and what must change is that item 12 exists to take a payment.
      throw new CapabilityError(
        "CONFLICT",
        "Subscribing to a plan version that offers no trial requires a verified payment, which Phase 2 item 12 delivers.",
        { planVersionId: command.planVersionId, reason: "PAYMENT_INTENT_REQUIRED" },
      );
    }

    // ADR-031 item 3: calendar arithmetic, never a day count. A trial is
    // expressed in days by ADR-052, so days is the correct unit *here* — the
    // prohibition is on expressing a *term* (a month, a year) as a day count,
    // and `modules/calendar` owns that arithmetic when item 14 needs it.
    const trialEnd = new Date(now.getTime() + offering.trialPeriodDays * 24 * 60 * 60 * 1000);

    const subscription = new Subscription(
      command.subscriptionId,
      command.tenantId,
      offering.planVersionId,
      offering.priceVersionId,
      "TRIALING",
      offering.termLength,
      true,
      null,
      trialEnd,
      null,
      null,
      0,
    );

    // The first period runs for the trial, not for the term: the term begins
    // when the trial converts and the first invoice is issued (item 13). Its
    // status is `CURRENT` — it is the period being served right now — and
    // `invoice_id` is null because no invoice exists for a trial.
    const firstPeriod = new SubscriptionPeriod(
      command.periodId,
      command.tenantId,
      command.subscriptionId,
      offering.planVersionId,
      offering.priceVersionId,
      now,
      trialEnd,
      null,
      null,
      "CURRENT",
    );

    try {
      await this.subscriptions.create({ subscription, firstPeriod });
    } catch (err) {
      if (err instanceof TrialAlreadyUsedError) {
        // ADR-052 item 3's database constraint, surfaced. Reachable only by a
        // race with another request for the same organization, since the
        // `existsForTenant` check above already rejects the sequential case.
        throw new CapabilityError("CONFLICT", "This organization has already used its trial.");
      }
      throw err;
    }

    return {
      id: subscription.id,
      organizationId: subscription.tenantId,
      status: subscription.status,
      planVersionId: subscription.planVersionId,
      priceVersionId: subscription.priceVersionId,
      termLength: subscription.termLength,
      autoRenew: subscription.autoRenew,
      trialEndsAt: trialEnd.toISOString(),
      currentPeriod: {
        startsAt: firstPeriod.periodStart.toISOString(),
        endsAt: firstPeriod.periodEnd.toISOString(),
        status: firstPeriod.status,
      },
      // ADR-024 item 2's one function, called rather than re-derived.
      servingNow: isServing({
        status: subscription.status,
        periodEnd: firstPeriod.periodEnd,
        graceEnd: firstPeriod.graceEnd,
        now,
      }),
    };
  }
}
