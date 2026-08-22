/**
 * ADR-031 item 6: "Application code obtains time from an injected clock,
 * never from a direct system call." Session expiry is explicitly "expiry
 * logic" under that rule, so this exists from Task 1 rather than being
 * deferred — corrects the earlier note in DECISION_LOG.md's directory-map
 * entry that assumed store.read needed no clock.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
