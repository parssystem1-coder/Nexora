import { CapabilityError } from "../../capability/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";
import type { SubscriptionRepository } from "../domain/subscription.repository.js";
import { isServing } from "../domain/serving-state.js";
import type { SubscriptionDto } from "./subscribe-to-plan.input.js";

export interface ReadSubscriptionCommand {
  tenantId: string;
}

/**
 * `subscription.read`. One organization, one subscription in Phase 2.
 *
 * The response is the same shape `plan.subscribe` returns, deliberately: a
 * client that just created one and a client reading one back are looking at the
 * same thing, and two shapes for one resource is how a field ends up meaning
 * something different depending on which call produced it.
 *
 * `servingNow` is computed on every read through ADR-024 item 2's single
 * function. **That is the whole point of the rule** — there is no `serving`
 * column to go stale when a period ends and no job has yet run, which ADR-024
 * item 8 explicitly relies on: "a late job delays notification, not
 * correctness".
 */
export class ReadSubscriptionService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ReadSubscriptionCommand): Promise<SubscriptionDto> {
    const subscription = await this.subscriptions.findByTenant(command.tenantId);
    if (!subscription) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "This organization has no subscription.");
    }

    const period = subscription.currentPeriodId
      ? await this.subscriptions.findPeriodById(subscription.currentPeriodId)
      : null;

    return {
      id: subscription.id,
      organizationId: subscription.tenantId,
      status: subscription.status,
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
      servingNow: isServing({
        status: subscription.status,
        periodEnd: period?.periodEnd ?? null,
        graceEnd: period?.graceEnd ?? null,
        now: this.clock.now(),
      }),
    };
  }
}
