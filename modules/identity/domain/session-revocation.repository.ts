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
 *
 * Widened for `auth.logout`/`auth.logout_all` (08_PHASE_1_BRIEF.md §3 slice
 * 5, ADR-029 item 6's "explicit logout" and "logout-all-devices" triggers)
 * with `revokeOne` — ending exactly the caller's current session, not every
 * session for the user. This briefly lived as a second interface,
 * `SessionTerminationRepository`, specifically so `membership.role.assign`'s
 * hand-written fake (typed exactly as this interface, in
 * assign-membership-role.service.spec.ts) would not need to change at all.
 * That read "its tests must pass untouched" as "never edit its fake even by
 * one line," which was stricter than intended — the actual requirement was
 * "do not regress what that fake's assertions prove." Collapsed back into
 * one port, 2026-08-24 (DECISION_LOG.md): one table, one concern, one
 * interface. The fake was updated (not left alone) to add `revokeOne` and to
 * return a count from `revokeAllForUser`; every existing assertion in that
 * spec file is unchanged.
 */
export interface SessionRevocationRepository {
  /**
   * Sets every ACTIVE session for `userId` to REVOKED, stamping `revokedAt`
   * (ADR-031: caller-supplied, never a direct system clock call). Idempotent
   * — revoking an already-revoked or nonexistent session set is a no-op.
   * Returns how many sessions were actually revoked — `membership.role
   * .assign` has never needed this and continues to discard it;
   * `auth.logout_all` reports it to the caller (decision 7, DECISION_LOG.md
   * 2026-08-24).
   */
  revokeAllForUser(userId: string, revokedAt: Date): Promise<number>;

  /**
   * Revokes exactly one ACTIVE session. Scoped by `userId` as well as
   * `sessionId` — defense in depth, not a reachable check in practice: the
   * caller always supplies the id `SessionGuard` already resolved from the
   * caller's own token, so a mismatch can never actually occur, but the same
   * "don't trust an id alone" posture `AssignMembershipRoleService` takes
   * with `target.tenantId` is worth keeping here for free. Idempotent —
   * revoking an already-revoked or nonexistent session is a no-op.
   */
  revokeOne(sessionId: string, userId: string, revokedAt: Date): Promise<void>;
}
