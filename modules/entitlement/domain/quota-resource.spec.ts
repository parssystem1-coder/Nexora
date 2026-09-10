import { describe, it, expect } from "vitest";
import { QUOTA_RESOURCES, RESOURCE_OWNING_MODULE, isQuotaResource } from "./quota-resource.js";
import { applyQuotaToGrant } from "./resolve-entitlement.js";
import type { EntitlementGrant } from "./resolve-entitlement.js";

/**
 * Ruling ب-4's closed list, transcribed from `PHASE_2_BRIEF.md` §9.13
 * independently of the implementation's own constant — the discipline items 4
 * and 6 used for ADR-024's transitions and ADR-008's precedence order.
 */
const B4_RESOURCES = ["members", "stores", "domains"];

describe("ruling ب-4's closed quota resource list", () => {
  it("contains exactly the three resources §9.13 records, transcribed independently", () => {
    expect([...QUOTA_RESOURCES].sort()).toEqual([...B4_RESOURCES].sort());
  });

  it("excludes storage and bandwidth, which are neither enforced nor advertised", () => {
    // ADR-060 is a port with no adapter and nothing meters the edge, so a limit
    // on either would be a promise nobody counts.
    expect(isQuotaResource("storage")).toBe(false);
    expect(isQuotaResource("bandwidth")).toBe(false);
  });

  it("names the owning module for each resource, which item 8 inherits", () => {
    // §5 permits a cross-module read through contracts and forbids the foreign
    // key. The module that owns a resource is the module that can count it.
    expect(RESOURCE_OWNING_MODULE.members).toBe("tenant");
    expect(RESOURCE_OWNING_MODULE.stores).toBe("tenant");
    // Domain verification is Phase 4 (ADR-027, ADR-028): there is no table to
    // count yet, and item 8 must say so rather than counting zero.
    expect(RESOURCE_OWNING_MODULE.domains).toBeNull();
  });
});

describe("how the entitlement axis and the quota axis compose (ADR-027 item 9)", () => {
  const planGrant = (state: EntitlementGrant["state"], limit: number | null = null): EntitlementGrant => ({
    source: "PLAN_VERSION",
    state,
    limit,
  });

  it("turns an ALLOW plus a quota into a single LIMIT grant, not two competing grants", () => {
    const merged = applyQuotaToGrant(planGrant("ALLOW"), 5);

    expect(merged.state).toBe("LIMIT");
    expect(merged.limit).toBe(5);
    expect(merged.source).toBe("PLAN_VERSION");
  });

  it("leaves an ALLOW alone when no quota is set — an unlimited resource", () => {
    const merged = applyQuotaToGrant(planGrant("ALLOW"), null);

    expect(merged.state).toBe("ALLOW");
    expect(merged.limit).toBeNull();
  });

  it("lets the entitlement DENY dominate a quota of three (ADR-008 rule 1)", () => {
    // "Explicit DENY always wins, regardless of source or precedence order."
    // The number is never consulted, because there is nothing to count toward.
    const merged = applyQuotaToGrant(planGrant("DENY"), 3);

    expect(merged.state).toBe("DENY");
    expect(merged.limit).toBeNull();
  });

  it("keeps a quota of zero distinct from a denial", () => {
    // Zero means "none of this resource, under a grant that exists"; DENY means
    // the resource is not permitted at all. A caller can tell them apart.
    const merged = applyQuotaToGrant(planGrant("ALLOW"), 0);

    expect(merged.state).toBe("LIMIT");
    expect(merged.limit).toBe(0);
  });
});
