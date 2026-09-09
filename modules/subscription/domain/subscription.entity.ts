import type { SubscriptionStatus } from "./subscription-status.js";

/** ADR-024 item 1's `subscription_period`, with `04` §2.3's `tenant_id`. */
export type PeriodStatus = "SCHEDULED" | "CURRENT" | "ENDED" | "UNPAID";

export class SubscriptionPeriod {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly subscriptionId: string,
    /** Pinned per period, not inherited: ADR-047 re-pins the price at each renewal. */
    public readonly planVersionId: string,
    public readonly priceVersionId: string,
    /** Half-open [start, end), ADR-031 item 4. UTC, ADR-031 item 1. */
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly graceEnd: Date | null,
    public readonly invoiceId: string | null,
    public readonly status: PeriodStatus,
  ) {}
}

/**
 * ADR-024 item 1's `subscription` plus `04` §2.3's columns.
 *
 * `trialEnd` is never cleared on conversion — it is the record that this
 * subscription began as a trial, and ADR-052 item 3's one-trial-per-organization
 * constraint is enforced against it. A cleared column would silently turn that
 * rule into "one *running* trial per organization", which is a weaker rule
 * nobody ruled.
 */
export class Subscription {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly planVersionId: string,
    public readonly priceVersionId: string,
    public readonly status: SubscriptionStatus,
    /** ADR-024 item 1's interval. Calendar arithmetic, never a day count (ADR-031 item 3). */
    public readonly termLength: string,
    public readonly autoRenew: boolean,
    public readonly currentPeriodId: string | null,
    public readonly trialEnd: Date | null,
    public readonly canceledAt: Date | null,
    public readonly reactivationDeadline: Date | null,
    /** ADR-045's optimistic-concurrency token. No writer bumps it yet; items 5, 14, 15 and 16 do. */
    public readonly version: number,
  ) {}

  /** ADR-052: a subscription that began as a trial, whether or not it still is one. */
  get startedAsTrial(): boolean {
    return this.trialEnd !== null;
  }
}
