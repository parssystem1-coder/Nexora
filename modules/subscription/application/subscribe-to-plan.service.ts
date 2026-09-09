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
 * ## The one place this service does not follow ADR-052 item 2 literally
 *
 * That item says `plan.subscribe` "has two outcomes depending on the plan
 * version it is given: a trialling subscription when that version offers a
 * trial and the organization is still eligible, an **`ACTIVE`** one when it does
 * not."
 *
 * **This service implements the first outcome and refuses the second**, and the
 * refusal is deliberate rather than an omission:
 *
 *   * `ACTIVE` is a **SERVING** state (ADR-024 item 2), and ADR-024 item 4's
 *     lifecycle reaches it only through *paid*. Creating one here would hand out
 *     a serving subscription to a paid plan with **no payment taken**.
 *   * **Payment is item 12.** `PHASE_2_BRIEF.md` §2 puts money outside this
 *     slice, and there is no invoice, no intent and no gateway to take one with.
 *   * The path is **reachable, not theoretical**: an organization that has
 *     already used its trial is "no longer eligible", so a second
 *     `plan.subscribe` would land on exactly that branch and get the product
 *     free.
 *
 * ADR-024 has no state for "created, awaiting first payment" — `PAST_DUE` means
 * unpaid *past* `period_end` and is itself serving within grace — so there is no
 * correct status to put such a subscription in either. **Refusing is the only
 * option that neither invents a state nor gives the product away.** Recorded in
 * `decisions/2026-09.md` under this item, and flagged for the review stop that
 * ends it: if the maintainer rules otherwise, the change is one branch here plus
 * whatever ADR-024 gains to describe the state.
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
      // changes — and what must change is that payment exists.
      throw new CapabilityError(
        "CONFLICT",
        "Subscribing to a plan version that offers no trial requires payment, which is not available yet.",
        { planVersionId: command.planVersionId, reason: "PAYMENT_NOT_AVAILABLE" },
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
