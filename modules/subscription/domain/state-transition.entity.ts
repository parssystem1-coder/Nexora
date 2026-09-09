import type { SubscriptionStatus } from "./subscription-status.js";
import type { TransitionActorType, TransitionReason } from "./transition-reason.js";

/**
 * ADR-024 item 3's transition record. **This is not an audit event**, and the
 * difference is visible in what it holds.
 *
 * An audit event (ADR-034) records *that a capability was attempted* — by whom,
 * against what resource, with what `outcome`, under which `request_id`. It
 * exists on both paths: ADR-034 item 4 writes one "unconditional on both
 * paths", so a refused cancellation still produces one.
 *
 * A transition records *that a subscription's state changed* — `from_status`,
 * `to_status`, and **why**. It exists only when the change actually happened,
 * and it carries three things no audit event has: the two states, and the
 * reason.
 *
 * **They are not redundant, and the clearest proof is a writer that has no
 * capability at all.** ADR-024 item 8's jobs — `subscription.expire`,
 * `trial.expire`, `subscription.rollover` — will move subscriptions between
 * states with no HTTP request, no session, and therefore no capability attempt
 * to audit. Those transitions must still be recorded, which is exactly why this
 * log is a separate table rather than a query over `audit_events`.
 */
export class SubscriptionStateTransition {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly subscriptionId: string,
    public readonly fromStatus: SubscriptionStatus,
    public readonly toStatus: SubscriptionStatus,
    public readonly reasonCode: TransitionReason,
    public readonly actorType: TransitionActorType,
    /** Null for a `system` actor: a scheduled job has no user id, and a fabricated one would be worse. */
    public readonly actorId: string | null,
    public readonly occurredAt: Date,
  ) {}
}
