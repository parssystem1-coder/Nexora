import type { SubscriptionStatus } from "./subscription-status.js";

/**
 * ADR-024 item 2, which is the rule most easily broken by convenience:
 *
 * > "Serving state is derived, not stored twice. **Exactly one function answers
 * > 'is this tenant entitled to be served right now'.** Interfaces, storefront
 * > routing and capability policy all call it."
 *
 * This is that function. There is deliberately **no `serving` column** on
 * `subscriptions`: a stored copy of a derived answer is precisely the defect the
 * rule names, and it would go stale the moment a period ends with no job having
 * run — which ADR-024 item 8 explicitly allows for ("a late job delays
 * notification, not correctness", *because* serving state is evaluated from
 * data).
 *
 * **Reachable from other modules without importing this one's internals:** it
 * is re-exported from `modules/subscription/contracts/index.ts`, the only
 * surface `03_TECHNICAL_BLUEPRINT.md` §2 permits another module to import. It
 * takes plain values rather than a `Subscription` entity for exactly that
 * reason — Phase 4's storefront router needs the answer, not the aggregate, and
 * a signature taking the entity would drag the domain type across the boundary
 * with it.
 *
 * It is pure: no clock of its own, no database, no I/O. `now` is passed in so
 * that a caller inside a request uses that request's clock (ADR-031 item 6) and
 * a test can place a boundary exactly.
 */
export interface ServingStateInput {
  status: SubscriptionStatus;
  /** The current period's end. Null when no period exists yet. */
  periodEnd: Date | null;
  /** The current period's grace end, when one has been set. Null otherwise. */
  graceEnd: Date | null;
  now: Date;
}

/**
 * ADR-024 item 2's two lists, implemented rather than interpreted:
 *
 *   SERVING:     TRIALING, ACTIVE, PAST_DUE (within grace), CANCEL_AT_PERIOD_END (before period_end)
 *   NOT SERVING: PAUSED, EXPIRED, CANCELED, SUSPENDED
 *
 * Four of the eight states answer unconditionally; two of the remaining four
 * carry a time condition the ADR states in parentheses, and those conditions are
 * the only judgement in this file:
 *
 *   * **`PAST_DUE` "within grace".** Grace is half-open like every other
 *     boundary in this codebase (ADR-031 item 4), so serving stops *at*
 *     `grace_end`, not after it. **A `PAST_DUE` row with no `grace_end` is not
 *     serving** — the window is what makes it serving, and its absence is not an
 *     open-ended one. That reading is deliberate and is the conservative
 *     direction: the failure mode it avoids is serving a non-paying tenant
 *     forever because a job never set the column.
 *   * **`CANCEL_AT_PERIOD_END` "before period_end".** Half-open again: serving
 *     stops at `period_end`. With no period at all the answer is not serving,
 *     for the same reason.
 */
export function isServing(input: ServingStateInput): boolean {
  switch (input.status) {
    case "TRIALING":
    case "ACTIVE":
      return true;

    case "PAST_DUE":
      return input.graceEnd !== null && input.now < input.graceEnd;

    case "CANCEL_AT_PERIOD_END":
      return input.periodEnd !== null && input.now < input.periodEnd;

    case "PAUSED":
    case "EXPIRED":
    case "CANCELED":
    case "SUSPENDED":
      return false;
  }
}

/**
 * The same answer as a reason code, for the callers ADR-024 item 2 names that
 * need to *say* why rather than only branch — ADR-059's 503-versus-410 decision
 * and `05` §7's `SUBSCRIPTION_*` codes both need the distinction between "not
 * serving, still revivable" and "not serving, gone".
 *
 * Kept in this file rather than a second one so there is still **exactly one**
 * function computing the answer: this one calls `isServing` rather than
 * re-deriving it, so the two can never disagree.
 */
export type ServingReason = "SERVING" | "NOT_SERVING_REVIVABLE" | "NOT_SERVING_TERMINAL";

export function servingReason(input: ServingStateInput): ServingReason {
  if (isServing(input)) return "SERVING";
  // ADR-024 item 3 makes CANCELED terminal; item 6 gives EXPIRED a reactivation
  // window, so an expired subscription is revivable until that window closes —
  // which is `reactivation_deadline`'s job and item 16's capability, not this
  // function's. Everything short of CANCELED can still return to ACTIVE.
  return input.status === "CANCELED" ? "NOT_SERVING_TERMINAL" : "NOT_SERVING_REVIVABLE";
}
