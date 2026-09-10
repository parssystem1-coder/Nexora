import { describe, it, expect } from "vitest";
import { evaluateResource } from "./over-limit.js";
import { QUOTA_RESOURCES, RESOURCE_OWNING_MODULE } from "./quota-resource.js";

/**
 * ADR-026's over-limit evaluation, tested at the layer the rule lives in.
 *
 * The rule this file exists to pin is the third state: a resource nobody can
 * count is **not evaluable**, never a count of zero.
 */
describe("ADR-026's over-limit evaluation", () => {
  it("reports a tenant under their limit as within it", () => {
    const r = evaluateResource({ resource: "members", currentCount: 3, limit: 5 });

    expect(r.state).toBe("WITHIN_LIMIT");
    expect(r.currentCount).toBe(3);
    expect(r.limit).toBe(5);
    expect(r.reason).toBeNull();
  });

  it("treats a tenant exactly at their limit as within it, not over", () => {
    // ADR-026 item 1's table blocks the *create* that would exceed the limit, so
    // equality is the last permitted state rather than the first forbidden one.
    expect(evaluateResource({ resource: "stores", currentCount: 3, limit: 3 }).state).toBe("WITHIN_LIMIT");
  });

  it("reports a tenant past their limit as over it", () => {
    // The shape ADR-026's Problem describes: a count that was legal until the
    // limit moved beneath it.
    const r = evaluateResource({ resource: "stores", currentCount: 7, limit: 3 });

    expect(r.state).toBe("OVER_LIMIT");
    expect(r.currentCount).toBe(7);
  });

  describe("the third state — a resource nobody can count", () => {
    it("reports NOT_EVALUABLE with a null count, never zero", () => {
      const r = evaluateResource({ resource: "domains", currentCount: null, limit: 5 });

      expect(r.state).toBe("NOT_EVALUABLE");
      expect(r.reason).toBe("NO_COUNTABLE_SOURCE");
      // The whole point: "0 of 5 used" would tell a tenant they have room when
      // nothing is counting.
      expect(r.currentCount).toBeNull();
      expect(r.currentCount).not.toBe(0);
    });

    it("keeps a real zero distinct from an absent count", () => {
      const none = evaluateResource({ resource: "stores", currentCount: 0, limit: 3 });

      expect(none.state).toBe("WITHIN_LIMIT");
      expect(none.currentCount).toBe(0);
    });

    it("reports NOT_EVALUABLE when the chain resolved no limit at all", () => {
      // An unlimited resource cannot be over a limit, but it also cannot be
      // reported as within one that does not exist.
      const r = evaluateResource({ resource: "members", currentCount: 9, limit: null });

      expect(r.state).toBe("NOT_EVALUABLE");
      expect(r.reason).toBe("NO_LIMIT_RESOLVED");
      expect(r.currentCount).toBe(9);
    });
  });

  it("covers exactly ruling ب-4's three resources, with domains the only uncountable one", () => {
    expect([...QUOTA_RESOURCES]).toHaveLength(3);
    const uncountable = QUOTA_RESOURCES.filter((r) => RESOURCE_OWNING_MODULE[r] === null);
    // Item 7 handed this over; Phase 4 is what changes it.
    expect(uncountable).toEqual(["domains"]);
  });
});
