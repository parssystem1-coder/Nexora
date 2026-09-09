import { z } from "zod";

/**
 * `plan.subscribe` (`05` §4.2: tenant, HIGH_WRITE, idempotent).
 *
 * **`termMonths` rather than a price version id, and the reason is a real gap
 * worth naming.** ADR-025 item 6 pins a `price_version_id`, so the obvious input
 * would be that id — except **no capability exposes one.** `plan.list` (item 1)
 * deliberately carries no money, and item 2 surfaced no capability at all, so a
 * client today cannot discover a price version to name. Asking for the term in
 * months keeps the input to something a client actually has, and the service
 * resolves the price through `billing`'s contract.
 *
 * Twelve and twenty-four are what item 2 seeded, as `1 year` and `2 years`;
 * PostgreSQL treats those as equal to 12 and 24 months, so no translation table
 * exists to drift. Months rather than days because ADR-031 item 3 prohibits day
 * counting for a term.
 *
 * The gap itself — that a price is not readable through any capability — is
 * recorded in `decisions/2026-09.md` under this item, owed to whichever slice
 * first needs to show a customer what they will pay.
 */
export const subscribeToPlanInputSchema = z.object({
  organizationId: z.string().uuid(),
  planVersionId: z.string().uuid(),
  termMonths: z.number().int().min(1).max(120),
});

export type SubscribeToPlanInput = z.infer<typeof subscribeToPlanInputSchema>;

/**
 * No money crosses this boundary, and that is not an oversight in a capability
 * that subscribes to a priced plan: the amount is item 13's invoice and item
 * 12's payment. What a caller gets back is the subscription it created — its
 * state, its term, and the versions it pinned.
 *
 * `servingNow` is ADR-024 item 2's derived answer, computed rather than stored.
 * It is returned because a client that has just subscribed needs to know whether
 * the storefront is live, and re-deriving it client-side would be a second
 * implementation of the one function that rule permits.
 */
export const subscriptionOutputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  status: z.enum([
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "PAUSED",
    "CANCEL_AT_PERIOD_END",
    "EXPIRED",
    "CANCELED",
    "SUSPENDED",
  ]),
  planVersionId: z.string().uuid(),
  priceVersionId: z.string().uuid(),
  /** As PostgreSQL renders the interval, e.g. `1 year`. */
  termLength: z.string(),
  autoRenew: z.boolean(),
  /** UTC ISO-8601, `05` §1. Null when this subscription did not begin as a trial. */
  trialEndsAt: z.string().datetime().nullable(),
  currentPeriod: z
    .object({
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      status: z.enum(["SCHEDULED", "CURRENT", "ENDED", "UNPAID"]),
    })
    .nullable(),
  servingNow: z.boolean(),
});

export type SubscriptionDto = z.infer<typeof subscriptionOutputSchema>;
