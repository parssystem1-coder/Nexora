/**
 * What another module needs to know before it can pin a plan and a price.
 *
 * `04` §1: "cross-module reads go through contracts". `modules/subscription`
 * must not query `plan_versions` or `prices` itself, and must not hold a
 * foreign key to either — `npm run check:fk` now fails the build on the second
 * of those. This port is the first half of the alternative; the factory in
 * `modules/billing/contracts` is the second.
 *
 * It answers one question — *"what exactly am I subscribing to, and is it on
 * offer right now"* — rather than exposing the catalogue. A subscription slice
 * has no business enumerating prices, and `plan.list` (item 1) is the
 * capability that does.
 */
export interface PlanOffering {
  planVersionId: string;
  priceVersionId: string;
  /** ADR-052: 0 means this version offers no trial. Not a sentinel — an ordinary value. */
  trialPeriodDays: number;
  /** The term as PostgreSQL renders the interval, e.g. `1 year`. ADR-024 item 1's type. */
  termLength: string;
}

export interface FindOfferingQuery {
  planVersionId: string;
  /**
   * The term, in months. Twelve and twenty-four are what item 2 seeded (as
   * `1 year` and `2 years`, which PostgreSQL treats as equal to 12 and 24
   * months). Months rather than days because ADR-031 item 3 prohibits day
   * counting for a term.
   */
  termMonths: number;
  /**
   * "Now", for resolving the in-force version of each — the greatest
   * `effective_from` not in the future, ADR-055 part 5's rule, which items 1 and
   * 2 both reused rather than inventing a second one.
   */
  asOf: Date;
}

export interface PlanOfferingRepository {
  /**
   * The offering, or `null` when the plan version does not exist, is not yet in
   * force, or has no price for that term.
   *
   * **One `null`, not three**, deliberately: a caller outside `billing` learning
   * *which* of the three it was would be learning the catalogue's shape through
   * an error channel, and the honest answer to all three is the same — this is
   * not something you may subscribe to.
   */
  findOffering(query: FindOfferingQuery): Promise<PlanOffering | null>;
}
