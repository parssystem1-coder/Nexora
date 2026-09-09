/**
 * ADR-024 item 3's state machine, as data rather than as branching.
 *
 * The ADR ends the transition list with "**Any other transition is a domain
 * error**", which is a statement about every pair it does *not* list — 64 pairs
 * exist and 17 are legal. Expressing it as a map means the illegal ones are the
 * complement of a list rather than the ones somebody remembered to reject, and
 * it is what makes the exhaustive test in the spec beside this file possible:
 * that test walks all 64 and asserts each is accepted or rejected, so a later
 * edit that widens the map fails loudly.
 *
 * A database CHECK cannot do this job — it sees the new row, not the old one —
 * so the enumeration lives in the column and the transitions live here.
 */
export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "PAUSED",
  "CANCEL_AT_PERIOD_END",
  "EXPIRED",
  "CANCELED",
  "SUSPENDED",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * ADR-024 item 3, transcribed exactly:
 *
 *   TRIALING -> ACTIVE | EXPIRED | CANCELED
 *   ACTIVE -> PAST_DUE | CANCEL_AT_PERIOD_END | PAUSED | SUSPENDED | CANCELED
 *   PAST_DUE -> ACTIVE (payment received) | EXPIRED (grace elapsed) | SUSPENDED
 *   CANCEL_AT_PERIOD_END -> EXPIRED (at period_end) | ACTIVE (reactivated before period_end)
 *   PAUSED -> ACTIVE | CANCELED
 *   EXPIRED -> ACTIVE (renewal paid within reactivation window) | CANCELED
 *   SUSPENDED -> ACTIVE (operator action) | CANCELED
 *   CANCELED -> terminal
 */
const LEGAL_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  TRIALING: ["ACTIVE", "EXPIRED", "CANCELED"],
  ACTIVE: ["PAST_DUE", "CANCEL_AT_PERIOD_END", "PAUSED", "SUSPENDED", "CANCELED"],
  PAST_DUE: ["ACTIVE", "EXPIRED", "SUSPENDED"],
  CANCEL_AT_PERIOD_END: ["EXPIRED", "ACTIVE"],
  PAUSED: ["ACTIVE", "CANCELED"],
  EXPIRED: ["ACTIVE", "CANCELED"],
  SUSPENDED: ["ACTIVE", "CANCELED"],
  CANCELED: [],
};

/**
 * Raised when a transition ADR-024 item 3 does not list is attempted.
 *
 * A domain error, not a `CapabilityError`: the domain layer may not import the
 * capability module (the conformance harness enforces that direction), and the
 * mapping to an HTTP code belongs to whichever capability performs the
 * transition. **No capability performs one yet** — item 4 only ever *creates* a
 * subscription, which is not a transition — so nothing maps this today, and the
 * first mapper is item 5's `subscription.cancel`.
 */
export class IllegalSubscriptionTransitionError extends Error {
  constructor(
    public readonly from: SubscriptionStatus,
    public readonly to: SubscriptionStatus,
  ) {
    super(`A subscription may not move from ${from} to ${to} (ADR-024 item 3).`);
    this.name = "IllegalSubscriptionTransitionError";
  }
}

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Throws {@link IllegalSubscriptionTransitionError} unless ADR-024 item 3 lists the pair. */
export function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalSubscriptionTransitionError(from, to);
  }
}

/**
 * The states a brand-new subscription may begin in.
 *
 * Not a transition — nothing precedes a creation — but it is the same class of
 * rule and belongs beside the machine rather than inside a service. ADR-052
 * item 2 names both: `TRIALING` when the plan version offers a trial and the
 * organization is still eligible, `ACTIVE` when it does not.
 *
 * **`ACTIVE` is not reachable through `plan.subscribe` in item 4**, and the
 * reason is recorded in `decisions/2026-09.md` under this item's date: an
 * `ACTIVE` subscription is a SERVING one (ADR-024 item 2), and creating one
 * without payment would give away the product. Payment is item 12. The entry
 * here stays because the state machine is transcribed from the ADR, not from
 * what this slice happens to reach.
 */
export const INITIAL_STATUSES = ["TRIALING", "ACTIVE"] as const satisfies readonly SubscriptionStatus[];
