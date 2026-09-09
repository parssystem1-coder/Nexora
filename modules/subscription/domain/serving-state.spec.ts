import { describe, it, expect } from "vitest";
import { isServing, servingReason } from "./serving-state.js";
import { SUBSCRIPTION_STATUSES } from "./subscription-status.js";
import type { SubscriptionStatus } from "./subscription-status.js";

/**
 * ADR-024 item 2's two lists, tested as lists rather than as examples.
 *
 *   SERVING:     TRIALING, ACTIVE, PAST_DUE (within grace), CANCEL_AT_PERIOD_END (before period_end)
 *   NOT SERVING: PAUSED, EXPIRED, CANCELED, SUSPENDED
 *
 * The domain invariant lives in a pure function, so it is tested at the domain
 * layer (`AGENTS.md` §8) — no database, no clock of its own.
 */
const NOW = new Date("2026-09-10T12:00:00.000Z");
const LATER = new Date("2026-09-20T12:00:00.000Z");
const EARLIER = new Date("2026-09-01T12:00:00.000Z");

const UNCONDITIONALLY_SERVING: SubscriptionStatus[] = ["TRIALING", "ACTIVE"];
const UNCONDITIONALLY_NOT_SERVING: SubscriptionStatus[] = ["PAUSED", "EXPIRED", "CANCELED", "SUSPENDED"];
const CONDITIONAL: SubscriptionStatus[] = ["PAST_DUE", "CANCEL_AT_PERIOD_END"];

describe("ADR-024 item 2's derived serving state", () => {
  it("accounts for all eight states, split three ways with nothing left over", () => {
    const covered = [...UNCONDITIONALLY_SERVING, ...UNCONDITIONALLY_NOT_SERVING, ...CONDITIONAL].sort();
    expect(covered).toEqual([...SUBSCRIPTION_STATUSES].sort());
  });

  it.each(UNCONDITIONALLY_SERVING)("%s serves regardless of any period or grace boundary", (status) => {
    expect(isServing({ status, periodEnd: EARLIER, graceEnd: EARLIER, now: NOW })).toBe(true);
    expect(isServing({ status, periodEnd: null, graceEnd: null, now: NOW })).toBe(true);
  });

  it.each(UNCONDITIONALLY_NOT_SERVING)("%s never serves, whatever the boundaries say", (status) => {
    expect(isServing({ status, periodEnd: LATER, graceEnd: LATER, now: NOW })).toBe(false);
    expect(isServing({ status, periodEnd: null, graceEnd: null, now: NOW })).toBe(false);
  });

  describe("PAST_DUE serves within grace, and the boundary is half-open (ADR-031 item 4)", () => {
    it("serves before grace_end", () => {
      expect(isServing({ status: "PAST_DUE", periodEnd: EARLIER, graceEnd: LATER, now: NOW })).toBe(true);
    });

    it("stops serving AT grace_end, not after it", () => {
      expect(isServing({ status: "PAST_DUE", periodEnd: EARLIER, graceEnd: NOW, now: NOW })).toBe(false);
    });

    it("stops serving once grace_end has passed", () => {
      expect(isServing({ status: "PAST_DUE", periodEnd: EARLIER, graceEnd: EARLIER, now: NOW })).toBe(false);
    });

    it("does NOT serve with no grace window at all — the conservative reading", () => {
      // A missing grace_end is not an open-ended one. The failure this avoids is
      // serving a non-paying tenant forever because a job never set the column.
      expect(isServing({ status: "PAST_DUE", periodEnd: LATER, graceEnd: null, now: NOW })).toBe(false);
    });
  });

  describe("CANCEL_AT_PERIOD_END serves before period_end, half-open likewise", () => {
    it("serves before period_end", () => {
      expect(isServing({ status: "CANCEL_AT_PERIOD_END", periodEnd: LATER, graceEnd: null, now: NOW })).toBe(true);
    });

    it("stops serving AT period_end", () => {
      expect(isServing({ status: "CANCEL_AT_PERIOD_END", periodEnd: NOW, graceEnd: null, now: NOW })).toBe(false);
    });

    it("does not serve with no period at all", () => {
      expect(isServing({ status: "CANCEL_AT_PERIOD_END", periodEnd: null, graceEnd: null, now: NOW })).toBe(false);
    });
  });

  describe("servingReason never disagrees with isServing", () => {
    it.each(SUBSCRIPTION_STATUSES)("%s reports SERVING exactly when isServing is true", (status) => {
      for (const periodEnd of [null, EARLIER, LATER]) {
        for (const graceEnd of [null, EARLIER, LATER]) {
          const input = { status, periodEnd, graceEnd, now: NOW };
          expect(servingReason(input) === "SERVING").toBe(isServing(input));
        }
      }
    });

    it("distinguishes a revivable stop from a terminal one, which ADR-059 needs", () => {
      // 503 while it can still be revived, 410 once it cannot.
      expect(servingReason({ status: "EXPIRED", periodEnd: null, graceEnd: null, now: NOW })).toBe(
        "NOT_SERVING_REVIVABLE",
      );
      expect(servingReason({ status: "CANCELED", periodEnd: null, graceEnd: null, now: NOW })).toBe(
        "NOT_SERVING_TERMINAL",
      );
    });
  });
});
