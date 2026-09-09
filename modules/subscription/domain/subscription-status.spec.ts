import { describe, it, expect } from "vitest";
import {
  SUBSCRIPTION_STATUSES,
  assertTransition,
  canTransition,
  IllegalSubscriptionTransitionError,
} from "./subscription-status.js";
import type { SubscriptionStatus } from "./subscription-status.js";

/**
 * ADR-024 item 3 ends with "**Any other transition is a domain error**", which
 * is a claim about every pair it does not list. A test that checks the listed
 * ones proves half of it; the half that matters is the complement.
 *
 * So this walks **all 64 ordered pairs** of the eight states and asserts each is
 * accepted or rejected. The legal set below is transcribed from the ADR a
 * second time, independently of the implementation's own map, so that a single
 * edit to that map cannot make this file agree with it by construction.
 */
const LEGAL_PAIRS = new Set<string>([
  "TRIALING->ACTIVE",
  "TRIALING->EXPIRED",
  "TRIALING->CANCELED",
  "ACTIVE->PAST_DUE",
  "ACTIVE->CANCEL_AT_PERIOD_END",
  "ACTIVE->PAUSED",
  "ACTIVE->SUSPENDED",
  "ACTIVE->CANCELED",
  "PAST_DUE->ACTIVE",
  "PAST_DUE->EXPIRED",
  "PAST_DUE->SUSPENDED",
  "CANCEL_AT_PERIOD_END->EXPIRED",
  "CANCEL_AT_PERIOD_END->ACTIVE",
  "PAUSED->ACTIVE",
  "PAUSED->CANCELED",
  "EXPIRED->ACTIVE",
  "EXPIRED->CANCELED",
  "SUSPENDED->ACTIVE",
  "SUSPENDED->CANCELED",
]);

const ALL_PAIRS: Array<[SubscriptionStatus, SubscriptionStatus]> = SUBSCRIPTION_STATUSES.flatMap((from) =>
  SUBSCRIPTION_STATUSES.map((to) => [from, to] as [SubscriptionStatus, SubscriptionStatus]),
);

describe("ADR-024 item 3's state machine", () => {
  it("has eight states and therefore sixty-four ordered pairs to account for", () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(8);
    expect(ALL_PAIRS).toHaveLength(64);
    expect(LEGAL_PAIRS.size).toBe(19);
  });

  it.each(ALL_PAIRS)("%s -> %s is accepted or rejected exactly as the ADR lists it", (from, to) => {
    const shouldBeLegal = LEGAL_PAIRS.has(`${from}->${to}`);

    expect(canTransition(from, to)).toBe(shouldBeLegal);

    if (shouldBeLegal) {
      expect(() => assertTransition(from, to)).not.toThrow();
    } else {
      expect(() => assertTransition(from, to)).toThrow(IllegalSubscriptionTransitionError);
    }
  });

  it("rejects every self-transition, none of which the ADR lists", () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("makes CANCELED terminal — no transition leaves it", () => {
    for (const to of SUBSCRIPTION_STATUSES) {
      expect(canTransition("CANCELED", to)).toBe(false);
    }
  });

  it("names both states in the error, so a log line says what was attempted", () => {
    const error = (() => {
      try {
        assertTransition("CANCELED", "ACTIVE");
        return null;
      } catch (err) {
        return err as IllegalSubscriptionTransitionError;
      }
    })();

    expect(error).toBeInstanceOf(IllegalSubscriptionTransitionError);
    expect(error?.from).toBe("CANCELED");
    expect(error?.to).toBe("ACTIVE");
    expect(error?.message).toContain("ADR-024 item 3");
  });
});
