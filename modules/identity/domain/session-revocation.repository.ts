/**
 * Revokes a user's live sessions, so a subsequent request carrying an
 * already-issued session cookie fails authentication (SessionGuard ->
 * ValidateSessionService, whose `Session.isValid()` already checks
 * `status === "ACTIVE"` — no change needed there).
 *
 * Added for `membership.role.assign`, which is the first capability to
 * satisfy 08_PHASE_1_BRIEF.md §5's "sessions invalidate immediately on
 * password change, membership revocation and role change" for the
 * role-change trigger. See DECISION_LOG.md "Session invalidation on role
 * change: implemented now, in this slice" for why this was built here rather
 * than deferred to `membership.revoke` (not one of the six Task 2 slices).
 *
 * Scoped by `userId` alone, not by organization: `sessions` carries no
 * `tenant_id` (DECISION_LOG.md "sessions tenancy — Platform-global", one
 * live session per user spanning every organization they belong to), so a
 * role change in one organization invalidates that user's session
 * everywhere, exactly as password-change invalidation would. Revoking
 * everywhere, not narrowly, is the correct reading of an
 * organization-independent trigger, not an over-broad one.
 */
export interface SessionRevocationRepository {
  /** Sets every ACTIVE session for `userId` to REVOKED, stamping `revokedAt` (ADR-031: caller-supplied, never a direct system clock call). Idempotent — revoking an already-revoked or nonexistent session set is a no-op. */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}
