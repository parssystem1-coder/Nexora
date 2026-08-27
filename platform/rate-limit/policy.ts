/**
 * A rate-limit policy: at most `maxAttempts` counted attempts per
 * `windowMs`, tracked per key by a `RateLimitStore`. What counts as an
 * "attempt" — every request, only failures, per-identifier, per-IP — is
 * entirely the caller's decision (RISK_REGISTER.md R-005, decisions/2026-08.md
 * this date); this module only enforces a count once told what to count and
 * under which policy.
 */
export interface RateLimitPolicy {
  windowMs: number;
  maxAttempts: number;
}
