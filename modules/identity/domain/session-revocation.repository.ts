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

/**
 * Added for `auth.logout` / `auth.logout_all` (08_PHASE_1_BRIEF.md §3 slice
 * 5, second and third capability — ADR-029 item 6's "explicit logout" and
 * "logout-all-devices" triggers). Deliberately a SEPARATE interface from
 * `SessionRevocationRepository` above, not a widening of it, even though the
 * instruction driving this slice was to "extend `SessionRevocationRepository`
 * rather than reaching into `sessions` from a second place": adding a new
 * required method to that interface would force
 * `assign-membership-role.service.spec.ts`'s hand-written fake (typed exactly
 * as `SessionRevocationRepository`) to implement it too, which is the one
 * thing this slice was told not to disturb ("its tests must pass
 * untouched"). This interface lives in the same file and is implemented by
 * the same `SessionRevocationRepositoryPg` class below (see
 * session-revocation.repository.pg.ts) — one adapter, one place that ever
 * writes a revocation to `sessions`, just declared through two narrow ports
 * instead of one growing one. See DECISION_LOG.md 2026-08-24.
 */
export interface SessionTerminationRepository {
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

  /**
   * Revokes every ACTIVE session for `userId`, INCLUDING the one the caller
   * is using right now (DECISION_LOG.md 2026-08-24, decision 3: `auth.logout_all`
   * ends the caller's own session too, the same accepted consequence
   * `membership.role.assign` already established for self-assignment).
   * Returns how many sessions were actually revoked, so the capability can
   * report it — `revokeAllForUser` above returns nothing because nothing
   * before this slice ever needed the count; this is a distinct method
   * rather than a changed return type on that one precisely so its signature
   * (and its one caller's fake) never has to change.
   */
  revokeAll(userId: string, revokedAt: Date): Promise<number>;
}
