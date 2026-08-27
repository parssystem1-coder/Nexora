import type { RateLimitPolicy } from "./policy.js";

/**
 * Shared platform infrastructure, not a per-capability invention
 * (RISK_REGISTER.md R-005: "a rate limiter is a shared, cross-capability
 * concern... not something one capability should invent its own version
 * of"). A capability picks its own key namespace (e.g.
 * `login:identifier:<email>`, `login:ip:<ip>`) and decides which outcomes
 * are worth counting — this module has no opinion on either; it only tracks
 * counts against a policy for whatever key it is given.
 */
export interface RateLimitStore {
  /**
   * True if `key` has already reached `policy.maxAttempts` counted attempts
   * within its current window. A pure read — never records anything — so it
   * is safe, and required, to call before doing any expensive work the
   * caller wants this to gate.
   */
  isBlocked(key: string, policy: RateLimitPolicy): boolean;

  /**
   * Records one more counted attempt against `key`. The caller decides which
   * outcomes are worth recording (auth.login only ever calls this for a
   * failed attempt, never a successful one) — this module has no opinion.
   */
  recordAttempt(key: string, policy: RateLimitPolicy): void;
}

/** DI token, matching platform/db/connections.ts's APP_DB/AUDIT_DB convention — a Symbol, not type-based injection. */
export const RATE_LIMIT_STORE = Symbol("RATE_LIMIT_STORE");
