/**
 * ADR-024 item 3 requires every transition to be recorded "with actor and
 * **reason**". This is the reason vocabulary, decided here rather than left as
 * free text, because **item 14's jobs and item 16's reactivation will both
 * write transitions and must use the same words** — a log where one writer says
 * `grace_elapsed` and another says `EXPIRED_AFTER_GRACE` cannot be queried, and
 * nothing would catch the divergence.
 *
 * It is a closed union, and the database CHECK below it in the migration is the
 * same list. Adding a reason is therefore a migration plus an edit here, which
 * is the point: a new reason is a new thing that can happen to a subscription,
 * and it should cost a moment's thought.
 *
 * **Who writes each one, so the trigger is checkable rather than rhetorical:**
 *
 * | Reason | Written by | Transition |
 * |---|---|---|
 * | `TRIAL_STARTED` | item 4 `plan.subscribe` | *(creation, not a transition — see below)* |
 * | `CANCELED_BY_TENANT` | **item 5, this slice** | `TRIALING`/`ACTIVE` → `CANCELED` |
 * | `SCHEDULED_CANCELLATION_BY_TENANT` | **item 5, this slice** | `ACTIVE` → `CANCEL_AT_PERIOD_END` |
 * | `PAYMENT_VERIFIED` | item 12 | `PAST_DUE` → `ACTIVE`, and the first paid entry |
 * | `PAYMENT_MISSED` | item 14 | `ACTIVE` → `PAST_DUE` |
 * | `GRACE_ELAPSED` | item 14 `subscription.expire` | `PAST_DUE` → `EXPIRED` |
 * | `TRIAL_EXPIRED` | item 14 `trial.expire` | `TRIALING` → `EXPIRED` |
 * | `TERM_ENDED` | item 14 | `CANCEL_AT_PERIOD_END` → `EXPIRED` |
 * | `REACTIVATED` | item 16 | `EXPIRED` → `ACTIVE` |
 * | `PLAN_CHANGED` | item 15 | within `ACTIVE` |
 * | `PAUSED_BY_OPERATOR` / `RESUMED_BY_OPERATOR` | no item yet | `ACTIVE` ↔ `PAUSED` |
 * | `SUSPENDED_BY_OPERATOR` / `REINSTATED_BY_OPERATOR` | no item yet | `ACTIVE` ↔ `SUSPENDED` |
 *
 * **`TRIAL_STARTED` is in the vocabulary but writes no row today, and that is
 * deliberate.** Item 4 creates a subscription; creation is not a transition
 * from a prior state, and ADR-024 item 3's log is a log of *transitions*. The
 * value exists so that a later decision to record an opening entry has a word
 * for it rather than inventing one — and so this table's `from_status` never
 * has to become nullable to accommodate it.
 *
 * The four operator reasons name no item because `05` §4.2 contains no operator
 * capability at all. They are listed rather than omitted so that the phase which
 * adds one finds the vocabulary already covers it, and so the gap is visible.
 */
export const TRANSITION_REASONS = [
  "TRIAL_STARTED",
  "CANCELED_BY_TENANT",
  "SCHEDULED_CANCELLATION_BY_TENANT",
  "PAYMENT_VERIFIED",
  "PAYMENT_MISSED",
  "GRACE_ELAPSED",
  "TRIAL_EXPIRED",
  "TERM_ENDED",
  "REACTIVATED",
  "PLAN_CHANGED",
  "PAUSED_BY_OPERATOR",
  "RESUMED_BY_OPERATOR",
  "SUSPENDED_BY_OPERATOR",
  "REINSTATED_BY_OPERATOR",
] as const;

export type TransitionReason = (typeof TRANSITION_REASONS)[number];

/**
 * ADR-024 item 3's "actor". The same vocabulary `audit_events.actor_type` and
 * `05` §2's `TenantContext` already use, rather than a second one — a
 * transition written by a scheduled job is `system`, and one written by a
 * tenant's request is `user`.
 *
 * `actorId` is nullable for exactly that reason: a job has no user id, and a
 * `system` transition with a fabricated one would be worse than an honest null.
 */
export type TransitionActorType = "user" | "service" | "system" | "plugin" | "agent";
