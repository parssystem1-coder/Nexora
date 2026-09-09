import type { Subscription, SubscriptionPeriod } from "./subscription.entity.js";
import type { SubscriptionStatus } from "./subscription-status.js";

/**
 * Raised when the organization already has a subscription that began as a
 * trial. ADR-052 item 3 rules that "one trial per organization" is enforced by
 * a database constraint rather than application logic, so this is surfaced by
 * the partial unique index colliding — not by a `SELECT` pre-check, which two
 * concurrent claims could both pass.
 *
 * Named on the port for the same reason `StoreSlugTakenError` is: the
 * application layer maps it to a documented code, and the domain never learns
 * what HTTP means.
 */
export class TrialAlreadyUsedError extends Error {
  constructor(public readonly tenantId: string) {
    super(`This organization has already used its trial.`);
    this.name = "TrialAlreadyUsedError";
  }
}

export interface CreateSubscriptionCommand {
  subscription: Subscription;
  /** The first period, written in the same transaction as the subscription it belongs to. */
  firstPeriod: SubscriptionPeriod;
}

export interface SubscriptionRepository {
  /**
   * Writes the subscription, its first period, and the link between them.
   *
   * One method rather than three calls from a service, because the three writes
   * are one fact: a subscription with no period has no term, and
   * `current_period_id` pointing at nothing is a broken row. The ordering it
   * hides is a real constraint — the period references the subscription and the
   * subscription then references the period back — and a caller that got it
   * wrong would see a foreign-key error rather than a domain one.
   *
   * Throws {@link TrialAlreadyUsedError} when the one-trial-per-organization
   * index rejects the insert.
   */
  create(command: CreateSubscriptionCommand): Promise<void>;

  /** The organization's subscription, or null. Scoped by RLS, never by a predicate here. */
  findByTenant(tenantId: string): Promise<Subscription | null>;

  /** Any subscription for this organization, used to refuse a second one. */
  existsForTenant(tenantId: string): Promise<boolean>;

  findPeriodById(periodId: string): Promise<SubscriptionPeriod | null>;

  /**
   * Moves the subscription to `toStatus`, guarded by ADR-045's optimistic
   * token: the UPDATE carries `WHERE ... AND version = $n` and bumps it.
   *
   * Returns `false` when zero rows matched, which means another writer moved
   * first. That is deliberately not an exception — the caller maps it to
   * `CONCURRENCY_CONFLICT` (retryable, `05` §7), and a repository throwing an
   * HTTP-shaped meaning would put the contract in the wrong layer.
   *
   * ADR-045 names this table because "the renewal job, `subscription.cancel`,
   * `plan.change` and `subscription.reactivate` all write it". This is the
   * first of those four to exist.
   */
  transitionStatus(command: TransitionStatusCommand): Promise<boolean>;
}

export interface TransitionStatusCommand {
  subscriptionId: string;
  expectedVersion: number;
  toStatus: SubscriptionStatus;
  /** Set only when moving to `CANCELED`; the table's CHECK ties the two together. */
  canceledAt: Date | null;
}
