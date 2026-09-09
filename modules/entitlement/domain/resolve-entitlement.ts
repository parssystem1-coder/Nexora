/**
 * **ADR-008's precedence chain. This file is item 6's deliverable** — the three
 * tables are how its inputs are stored, and the ADR is titled *Entitlement
 * Precedence and Conflict Resolution* for that reason.
 *
 * Pure: no database, no clock, no I/O. Every input is passed in, so the rules
 * below are testable at the layer they live in (`AGENTS.md` §8) and the
 * determinism ADR-008 rule 4 requires — "resolution result is byte-identical for
 * identical inputs" — is a property of the function rather than of a fixture.
 */

/** ADR-008: "Every entitlement decision must resolve to an explicit policy state." */
export type EntitlementState = "ALLOW" | "DENY" | "LIMIT";

/** ADR-008 rule 2: an override "must declare whether they are ABSOLUTE ... or DELTA". */
export type OverrideType = "ABSOLUTE" | "DELTA";

/**
 * ADR-008's precedence order, in order:
 *
 *     Policy Constraint
 *      -> Tenant Override (ABSOLUTE before DELTA)
 *      -> Add-on
 *      -> Plan Version
 *      -> Platform Default
 *
 * **The `ADD_ON` rung is present and always resolves empty**, which is D2-7's
 * ruling rather than an oversight: "the Add-on rung exists in the resolver and
 * always resolves empty. No add-on construct, table, or purchase path is built.
 * The rung is present so the chain is faithful to the accepted ADR and so adding
 * add-ons later is an insertion rather than a re-ordering."
 */
export const PRECEDENCE_ORDER = [
  "POLICY_CONSTRAINT",
  "TENANT_OVERRIDE_ABSOLUTE",
  "TENANT_OVERRIDE_DELTA",
  "ADD_ON",
  "PLAN_VERSION",
  "PLATFORM_DEFAULT",
] as const;

export type EntitlementSource = (typeof PRECEDENCE_ORDER)[number];

export interface EntitlementGrant {
  source: EntitlementSource;
  state: EntitlementState;
  /** Required when `state` is `LIMIT`; a delta may be negative. */
  limit: number | null;
  /**
   * ADR-008 rule 3: a `LIMIT` may only be widened by another source when "both
   * sources are additive **by declaration**". Undeclared means not additive —
   * the conservative reading, and the one that makes rule 3's "otherwise
   * resolution fails closed" reachable rather than theoretical.
   */
  additive?: boolean;
}

export interface ResolvedEntitlement {
  featureKey: string;
  state: EntitlementState;
  limit: number | null;
  /** ADR-008's `resolvedFrom[]`, in the order the chain consumed them. */
  resolvedFrom: EntitlementSource[];
}

/** ADR-008 rule 3's failure: "resolution fails closed with `ENTITLEMENT_CONFLICT`". */
export class EntitlementConflictError extends Error {
  constructor(
    public readonly featureKey: string,
    public readonly reason: string,
  ) {
    super(`Entitlement for '${featureKey}' cannot be resolved: ${reason}`);
    this.name = "EntitlementConflictError";
  }
}

function rank(source: EntitlementSource): number {
  return PRECEDENCE_ORDER.indexOf(source);
}

/**
 * Resolves one feature from every grant that mentions it.
 *
 * The rules, in the order ADR-008 states them:
 *
 *   **1. Explicit DENY always wins**, "regardless of source or precedence
 *   order" — so it is checked before precedence is consulted at all, not as the
 *   highest-precedence entry. That distinction is the whole of rule 1: a DENY on
 *   the *lowest* rung still beats an ABSOLUTE override on the highest.
 *
 *   **2. Otherwise the highest-precedence grant wins.** `ABSOLUTE` replaces the
 *   resolved value; `DELTA` adjusts it, so a delta is applied to whatever the
 *   rungs below it resolved to rather than standing alone.
 *
 *   **3. Two conflicting `LIMIT`s at the same rung** resolve to the most
 *   permissive only if both declare themselves additive; otherwise this fails
 *   closed.
 *
 *   **4. Nothing at all is a DENY**, not an ALLOW. A feature no rung mentions is
 *   one the platform never granted, and failing open would make every unlisted
 *   feature free.
 */
export function resolveEntitlement(featureKey: string, grants: readonly EntitlementGrant[]): ResolvedEntitlement {
  // Rule 1, before precedence. ADR-008: "Explicit DENY always wins, regardless
  // of source or precedence order."
  const deny = grants.find((g) => g.state === "DENY");
  if (deny) {
    return { featureKey, state: "DENY", limit: null, resolvedFrom: [deny.source] };
  }

  // **A DELTA is a modifier, not a base, and separating them is the whole of
  // rule 2.** ADR-008 ranks `TENANT_OVERRIDE_DELTA` *above* `PLAN_VERSION`, so
  // walking the chain in precedence order reaches the delta first — with
  // nothing yet resolved for it to adjust. The ADR's own words settle it:
  // ABSOLUTE "replaces **the resolved value**" and DELTA "adjusts **the
  // resolved value**", so the base is resolved from every non-delta rung first
  // and the deltas are then applied to it. The first version of this function
  // walked one ordered list and threw on every legitimate delta.
  const bases = grants.filter((g) => g.source !== "TENANT_OVERRIDE_DELTA");
  const deltas = grants.filter((g) => g.source === "TENANT_OVERRIDE_DELTA");

  if (bases.length === 0) {
    if (deltas.length > 0) {
      // A relative value with no base is not an absolute one, and silently
      // treating it as one would grant whatever number the delta happened to be.
      throw new EntitlementConflictError(featureKey, "a DELTA override has no underlying grant to adjust");
    }
    // Nothing at all is a denial, not an allowance: a feature no rung mentions
    // is one the platform never granted, and failing open would make every
    // unlisted feature free. `PLATFORM_DEFAULT` is the rung that would have
    // granted it, so the denial is attributed there rather than to nowhere.
    return { featureKey, state: "DENY", limit: null, resolvedFrom: ["PLATFORM_DEFAULT"] };
  }

  const bestRank = Math.min(...bases.map((g) => rank(g.source)));
  const winners = bases.filter((g) => rank(g.source) === bestRank);

  let base = winners[0]!;
  if (winners.length > 1) {
    // Rule 3: "when two grants of the same feature conflict without an explicit
    // DENY, the most permissive LIMIT wins **only if both sources are additive
    // by declaration**. Otherwise resolution fails closed."
    const allLimits = winners.every((g) => g.state === "LIMIT");
    const allAdditive = winners.every((g) => g.additive === true);
    if (!allLimits || !allAdditive) {
      throw new EntitlementConflictError(featureKey, "two LIMIT grants conflict and are not both declared additive");
    }
    base = winners.reduce((a, b) => ((a.limit ?? 0) >= (b.limit ?? 0) ? a : b));
  }

  const resolvedFrom: EntitlementSource[] = [base.source];
  let limit = base.limit;

  for (const delta of deltas) {
    if (base.state === "LIMIT") {
      limit = (limit ?? 0) + (delta.limit ?? 0);
      if (limit < 0) limit = 0;
    }
    // A delta against a non-LIMIT base changes no value; it is still recorded
    // as having been consulted, so the explanation shows it was considered
    // rather than silently ignored.
    resolvedFrom.push(delta.source);
  }

  return { featureKey, state: base.state, limit: base.state === "LIMIT" ? limit : null, resolvedFrom };
}
