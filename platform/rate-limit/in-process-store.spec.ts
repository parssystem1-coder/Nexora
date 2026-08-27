import { describe, it, expect } from "vitest";
import type { Clock } from "../clock.js";
import { InProcessRateLimitStore } from "./in-process-store.js";
import type { RateLimitPolicy } from "./policy.js";

function fakeClock(startMs: number): Clock & { advance(ms: number): void; set(ms: number): void } {
  let current = startMs;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
    set: (ms: number) => {
      current = ms;
    },
  };
}

const POLICY: RateLimitPolicy = { windowMs: 1000, maxAttempts: 3 };

describe("InProcessRateLimitStore", () => {
  it("is not blocked before any attempt is recorded", () => {
    const store = new InProcessRateLimitStore(fakeClock(0));
    expect(store.isBlocked("k", POLICY)).toBe(false);
  });

  it("stays unblocked for every attempt strictly below the threshold", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(false);
    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(false);
  });

  it("becomes blocked at exactly the threshold, not only well past it", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(false);

    store.recordAttempt("k", POLICY); // the 3rd attempt - policy.maxAttempts is 3
    expect(store.isBlocked("k", POLICY)).toBe(true);
  });

  it("stays blocked for attempts recorded after the threshold, within the same window", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    for (let i = 0; i < 5; i++) store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(true);
  });

  it("tracks different keys independently - one key's attempts never affect another's", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("identifier:a@example.com", POLICY);
    store.recordAttempt("identifier:a@example.com", POLICY);
    store.recordAttempt("identifier:a@example.com", POLICY);
    expect(store.isBlocked("identifier:a@example.com", POLICY)).toBe(true);

    // A different identifier, and a differently-namespaced IP key, both
    // start fresh - this is the same independence auth.login relies on for
    // per-identifier vs per-IP throttling.
    expect(store.isBlocked("identifier:b@example.com", POLICY)).toBe(false);
    expect(store.isBlocked("ip:127.0.0.1", POLICY)).toBe(false);
  });

  it("does not block right up to the last millisecond of the window", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(true);

    clock.advance(POLICY.windowMs - 1);
    expect(store.isBlocked("k", POLICY)).toBe(true);
  });

  it("resets exactly at the window boundary - blocked at windowMs - 1, clear at windowMs", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(true);

    clock.advance(POLICY.windowMs);
    expect(store.isBlocked("k", POLICY)).toBe(false);
  });

  it("a recordAttempt call after the window has elapsed starts a fresh window rather than accumulating", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);

    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(true);

    clock.advance(POLICY.windowMs); // window elapses with no further reads
    store.recordAttempt("k", POLICY); // this should start a new window at count 1, not count 4
    expect(store.isBlocked("k", POLICY)).toBe(false);

    store.recordAttempt("k", POLICY);
    expect(store.isBlocked("k", POLICY)).toBe(false);
    store.recordAttempt("k", POLICY); // 3rd attempt of the NEW window
    expect(store.isBlocked("k", POLICY)).toBe(true);
  });

  it("different policies (different windowMs/maxAttempts) can be applied to the same key independently in sequence", () => {
    const clock = fakeClock(0);
    const store = new InProcessRateLimitStore(clock);
    const strict: RateLimitPolicy = { windowMs: 1000, maxAttempts: 1 };

    store.recordAttempt("k", strict);
    expect(store.isBlocked("k", strict)).toBe(true);
    // The looser POLICY (maxAttempts: 3) reads the same underlying window
    // state for "k" - this documents that a key's window state is not
    // itself policy-scoped, so a caller must not reuse one key across two
    // different policies unless it truly intends to share the counter.
    expect(store.isBlocked("k", POLICY)).toBe(false);
  });
});
