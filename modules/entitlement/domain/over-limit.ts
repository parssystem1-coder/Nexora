import type { QuotaResource } from "./quota-resource.js";

/**
 * ADR-026's over-limit evaluation, as a pure function.
 *
 * **Three states, not two, and the third is the substance of this item.** Item 7
 * reported that `RESOURCE_OWNING_MODULE` is not uniform — `domains` has no table
 * until Phase 4 — and said what must follow: *"a quota on a resource with no
 * table is unenforceable, and item 8 must say so rather than counting zero and
 * reporting success."*
 *
 * **Zero is a lie that reads as good news.** "0 of 5 domains used" tells a tenant
 * they have room when the truth is that nothing is counting. It is the same
 * failure shape this project has now caught three times — a `FORCE` RLS sweep
 * with no tenant context, an `UPDATE` outside `withTenantContext`, and a purge
 * that would report success having deleted nothing — and `AGENTS.md` §8's second
 * rule exists because of it.
 *
 * It is also **ruling ب-4's own principle one step further**: ب-4 says do not
 * *sell* a limit the platform cannot count. This says do not *report* a count it
 * cannot take.
 *
 * **`domains` stays in the vocabulary.** ADR-027 item 9 puts it there and Phase
 * 4 will make it countable; what changes then is the answer, not the list, and
 * nothing here needs editing when `store_domains` exists — the resource becomes
 * evaluable the moment its module exposes a counter.
 */
export type OverLimitState = "WITHIN_LIMIT" | "OVER_LIMIT" | "NOT_EVALUABLE";

/** Why a resource could not be evaluated. Null unless the state is `NOT_EVALUABLE`. */
export type NotEvaluableReason = "NO_COUNTABLE_SOURCE" | "NO_LIMIT_RESOLVED";

export interface ResourceEvaluation {
  resource: QuotaResource;
  state: OverLimitState;
  /** Null when not evaluable — never zero, which would read as "none used". */
  currentCount: number | null;
  /** Null when the entitlement chain resolved no limit for this resource. */
  limit: number | null;
  reason: NotEvaluableReason | null;
}

export interface EvaluateResourceInput {
  resource: QuotaResource;
  /**
   * The count, or `null` when no module can take one. **`null` and `0` mean
   * opposite things here** and the type keeps them apart: `0` is "none in use",
   * `null` is "nobody counted".
   */
  currentCount: number | null;
  /** The resolved limit from ADR-008's chain, or `null` when it resolved none. */
  limit: number | null;
}

/**
 * ADR-026 defines what being over a limit *means* and what the platform must do
 * about it; the comparison itself is this one line, and it is deliberately
 * strict: a tenant **at** their limit is within it. ADR-026 item 1's table
 * blocks the *create* that would exceed it, so equality is the last permitted
 * state rather than the first forbidden one.
 */
export function evaluateResource(input: EvaluateResourceInput): ResourceEvaluation {
  if (input.currentCount === null) {
    return {
      resource: input.resource,
      state: "NOT_EVALUABLE",
      currentCount: null,
      limit: input.limit,
      reason: "NO_COUNTABLE_SOURCE",
    };
  }

  if (input.limit === null) {
    // A resource the chain grants without a number is unlimited, which cannot
    // be over a limit — but it also cannot be reported as "within" one that does
    // not exist. Both halves of that are honest only if the answer says so.
    return {
      resource: input.resource,
      state: "NOT_EVALUABLE",
      currentCount: input.currentCount,
      limit: null,
      reason: "NO_LIMIT_RESOLVED",
    };
  }

  return {
    resource: input.resource,
    state: input.currentCount > input.limit ? "OVER_LIMIT" : "WITHIN_LIMIT",
    currentCount: input.currentCount,
    limit: input.limit,
    reason: null,
  };
}
