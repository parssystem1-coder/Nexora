import type { Plan } from "./plan.entity.js";

/**
 * One page of plans in the capability's declared total order.
 *
 * `hasMore` rather than a cursor: encoding a cursor is ADR-036's concern and
 * lives in `platform/pagination/cursor.ts`, not in a repository port. The port
 * answers a data question — "is there at least one more row past this page?" —
 * and the application service turns that into `nextCursor`.
 */
export interface PlanPage {
  plans: readonly Plan[];
  hasMore: boolean;
}

export interface ListPlansQuery {
  /** Maximum rows to return. The capability declares the default and maximum. */
  limit: number;
  /**
   * Seek strictly past this plan `key`, the sort key ADR-036 item 6 requires
   * be total — `plans.key` is UNIQUE, so it needs no appended tiebreaker.
   * Absent means the first page.
   */
  afterKey?: string;
  /**
   * "Now", for resolving which version of each plan is in force. Supplied by
   * the caller from the injected clock (ADR-031 item 6) rather than read as
   * `now()` inside the query, so a test can place a future-dated version and
   * prove it is not served.
   */
  asOf: Date;
}

export interface PlanRepository {
  /**
   * Plans ordered by `key` ascending, each carrying the version in force at
   * `asOf` — the greatest `effective_from` not in the future, the same
   * resolution rule ADR-055 part 5 gives `tax_rates` rather than a second one.
   *
   * A plan with no version yet in force is absent from the result. It is not
   * an error and not an empty-version row: a plan whose first version starts
   * next month is not on offer today, and the catalogue is what is on offer.
   */
  listByKey(query: ListPlansQuery): Promise<PlanPage>;
}
