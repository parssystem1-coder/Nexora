import { describe, it, expect } from "vitest";
import { EntitlementConflictError, PRECEDENCE_ORDER, resolveEntitlement } from "./resolve-entitlement.js";
import type { EntitlementGrant } from "./resolve-entitlement.js";

/**
 * ADR-008's rules, tested at the layer they live in.
 *
 * **The precedence order is transcribed from the ADR a second time**, below,
 * independently of `PRECEDENCE_ORDER` — the same discipline item 4 used for
 * ADR-024's transition set, so that one edit to the implementation cannot make
 * this file agree with it by construction.
 *
 * ADR-008's order, verbatim:
 *
 *     Policy Constraint
 *      -> Tenant Override (ABSOLUTE before DELTA)
 *      -> Add-on
 *      -> Plan Version
 *      -> Platform Default
 */
const ADR_008_ORDER = [
  "POLICY_CONSTRAINT",
  "TENANT_OVERRIDE_ABSOLUTE",
  "TENANT_OVERRIDE_DELTA",
  "ADD_ON",
  "PLAN_VERSION",
  "PLATFORM_DEFAULT",
];

const grant = (
  source: EntitlementGrant["source"],
  state: EntitlementGrant["state"],
  limit: number | null = null,
  additive?: boolean,
): EntitlementGrant => (additive === undefined ? { source, state, limit } : { source, state, limit, additive });

describe("ADR-008's precedence chain", () => {
  it("implements the order the ADR states, transcribed independently", () => {
    expect([...PRECEDENCE_ORDER]).toEqual(ADR_008_ORDER);
  });

  it("keeps the ADD_ON rung present and empty (D2-7), so adding add-ons is an insertion", () => {
    // The rung exists in the order even though nothing ever populates it. If a
    // later session removes it, re-ordering rather than inserting becomes
    // necessary, which is what D2-7 exists to prevent.
    expect(PRECEDENCE_ORDER).toContain("ADD_ON");
    expect(ADR_008_ORDER.indexOf("ADD_ON")).toBe(3);
  });

  describe("rule 1 — explicit DENY always wins, regardless of source or precedence order", () => {
    it("beats a plan grant from the lowest rung", () => {
      const result = resolveEntitlement("f", [grant("PLAN_VERSION", "DENY"), grant("POLICY_CONSTRAINT", "ALLOW")]);

      expect(result.state).toBe("DENY");
    });

    it("beats an ABSOLUTE override, which is ADR-008's own worked example", () => {
      // "explicit DENY beats every grant, including an ABSOLUTE override".
      const result = resolveEntitlement("f", [
        grant("TENANT_OVERRIDE_ABSOLUTE", "ALLOW"),
        grant("PLAN_VERSION", "DENY"),
      ]);

      expect(result.state).toBe("DENY");
      expect(result.resolvedFrom).toEqual(["PLAN_VERSION"]);
    });

    it("beats a LIMIT anywhere in the chain", () => {
      const result = resolveEntitlement("f", [grant("POLICY_CONSTRAINT", "LIMIT", 10), grant("ADD_ON", "DENY")]);

      expect(result.state).toBe("DENY");
      expect(result.limit).toBeNull();
    });
  });

  describe("rule 2 — ABSOLUTE replaces, DELTA adjusts", () => {
    it("lets an ABSOLUTE override replace the plan's limit", () => {
      const result = resolveEntitlement("seats", [
        grant("PLAN_VERSION", "LIMIT", 5),
        grant("TENANT_OVERRIDE_ABSOLUTE", "LIMIT", 50),
      ]);

      expect(result.state).toBe("LIMIT");
      expect(result.limit).toBe(50);
      expect(result.resolvedFrom[0]).toBe("TENANT_OVERRIDE_ABSOLUTE");
    });

    it("lets a DELTA adjust what the rungs below resolved to", () => {
      const result = resolveEntitlement("seats", [
        grant("PLAN_VERSION", "LIMIT", 5),
        grant("TENANT_OVERRIDE_DELTA", "LIMIT", 3),
      ]);

      expect(result.limit).toBe(8);
      expect(result.resolvedFrom).toContain("TENANT_OVERRIDE_DELTA");
    });

    it("applies a negative DELTA, and never below zero", () => {
      const result = resolveEntitlement("seats", [
        grant("PLAN_VERSION", "LIMIT", 5),
        grant("TENANT_OVERRIDE_DELTA", "LIMIT", -20),
      ]);

      expect(result.limit).toBe(0);
    });

    it("fails closed when a DELTA has nothing to adjust", () => {
      // A relative value with no base is not an absolute one, and silently
      // treating it as one would grant whatever number the delta happened to be.
      expect(() => resolveEntitlement("seats", [grant("TENANT_OVERRIDE_DELTA", "LIMIT", 3)])).toThrow(
        EntitlementConflictError,
      );
    });
  });

  describe("rule 3 — conflicting LIMITs resolve only if both are additive by declaration", () => {
    it("takes the most permissive when both declare themselves additive", () => {
      const result = resolveEntitlement("seats", [
        grant("PLAN_VERSION", "LIMIT", 5, true),
        grant("PLAN_VERSION", "LIMIT", 9, true),
      ]);

      expect(result.limit).toBe(9);
    });

    it("fails closed when neither declares itself additive", () => {
      expect(() =>
        resolveEntitlement("seats", [grant("PLAN_VERSION", "LIMIT", 5), grant("PLAN_VERSION", "LIMIT", 9)]),
      ).toThrow(EntitlementConflictError);
    });

    it("fails closed when only one declares itself additive — 'both' means both", () => {
      expect(() =>
        resolveEntitlement("seats", [grant("PLAN_VERSION", "LIMIT", 5, true), grant("PLAN_VERSION", "LIMIT", 9)]),
      ).toThrow(EntitlementConflictError);
    });

    it("treats an undeclared grant as not additive, which is the conservative reading", () => {
      // ADR-008 says "additive by declaration". Undeclared is therefore not
      // additive, which is what makes rule 3's failure reachable at all.
      expect(() => resolveEntitlement("seats", [grant("ADD_ON", "LIMIT", 1), grant("ADD_ON", "LIMIT", 2)])).toThrow(
        EntitlementConflictError,
      );
    });
  });

  describe("rule 4 — deterministic and reproducible for identical inputs", () => {
    it("returns a byte-identical result for the same grants in a different order", () => {
      const a = [grant("PLAN_VERSION", "LIMIT", 5), grant("TENANT_OVERRIDE_ABSOLUTE", "LIMIT", 50)];
      const b = [grant("TENANT_OVERRIDE_ABSOLUTE", "LIMIT", 50), grant("PLAN_VERSION", "LIMIT", 5)];

      expect(JSON.stringify(resolveEntitlement("seats", a))).toBe(JSON.stringify(resolveEntitlement("seats", b)));
    });

    it("returns a byte-identical result when called twice", () => {
      const grants = [grant("PLAN_VERSION", "ALLOW")];

      expect(JSON.stringify(resolveEntitlement("f", grants))).toBe(JSON.stringify(resolveEntitlement("f", grants)));
    });
  });

  describe("a feature nothing grants", () => {
    it("denies rather than allowing, and attributes the denial to PLATFORM_DEFAULT", () => {
      // Failing open would make every unlisted feature free, which is the one
      // failure mode a resolver must not have.
      const result = resolveEntitlement("never_granted", []);

      expect(result.state).toBe("DENY");
      expect(result.resolvedFrom).toEqual(["PLATFORM_DEFAULT"]);
    });
  });

  describe("explainability (ADR-008)", () => {
    it("names every rung that contributed, so a denial can be explained", () => {
      const result = resolveEntitlement("seats", [
        grant("PLAN_VERSION", "LIMIT", 5),
        grant("TENANT_OVERRIDE_DELTA", "LIMIT", 3),
      ]);

      // The base first, then each modifier applied to it.
      expect(result.resolvedFrom).toEqual(["PLAN_VERSION", "TENANT_OVERRIDE_DELTA"]);
    });

    it("carries the feature key on the result", () => {
      expect(resolveEntitlement("domains", [grant("PLAN_VERSION", "ALLOW")]).featureKey).toBe("domains");
    });
  });
});
