import type { Membership } from "./membership.entity.js";

/**
 * Raised when the invitee already holds a membership in this organization.
 *
 * Surfaced by the port rather than by a `SELECT` pre-check, for the same
 * race-freedom reason as OrganizationSlugTakenError: `UNIQUE (tenant_id,
 * user_id)` is the only authority that two concurrent invites cannot both
 * pass. Unlike the organization case, a pre-check here *would* be visible
 * under RLS (the caller's tenant context is already the right one) - it
 * would just be wrong under concurrency, which is worse than useless.
 *
 * Application code maps this to the documented `CONFLICT` code
 * (05_API_CAPABILITY_CONTRACTS.md §7).
 */
export class MembershipAlreadyExistsError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
  ) {
    super("That user already holds a membership in this organization.");
    this.name = "MembershipAlreadyExistsError";
  }
}

export interface MembershipRepository {
  /** Self-access bootstrap query (DECISION_LOG.md "RLS bootstrap..."): scoped by user, not yet by tenant. */
  findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;

  /**
   * Added for organization.create, which makes its creator the organization's
   * first member in the same transaction that creates the organization, and
   * reused by membership.invite. Takes a fully-formed entity (id included)
   * rather than returning a generated one: the caller already runs inside the
   * tenant's RLS context, and generating ids client-side keeps every write in
   * these slices free of `INSERT ... RETURNING`, whose returned rows Postgres
   * re-checks against the table's USING policy.
   *
   * Throws {@link MembershipAlreadyExistsError} on a duplicate (tenant, user).
   */
  create(membership: Membership): Promise<void>;

  /**
   * Added for membership.role.assign, to resolve the TARGET membership (not
   * the caller's own — that is findByUserAndTenant's job). Scoped by id only,
   * relying on RLS to hide rows outside the caller's reach.
   *
   * **Not safe to trust alone**: `memberships`' RLS policy has a self-access
   * OR clause (RISK_REGISTER.md R-003) so a row is visible if EITHER its
   * tenant_id matches the current context OR its user_id matches the
   * caller's own id — the second branch means a caller's own membership row
   * IN A DIFFERENT ORGANIZATION can come back from this method even though
   * the current tenant context is a third organization entirely. Every
   * caller of this method MUST explicitly compare the returned row's
   * `tenantId` against the tenant it actually intended, rather than assuming
   * "this returned a row" already proves it belongs to the current tenant.
   */
  findById(id: string): Promise<Membership | null>;

  /**
   * Added for `membership.revoke`'s "cannot revoke the organization's only
   * remaining member/owner" protection, and rewritten from a plain count to a
   * row lock (DECISION_LOG.md 2026-08-24, "membership.revoke: closing the
   * last-owner/last-member race") after the phase-gate review found the
   * original `countActive` read-then-write had no lock and no constraint
   * behind it: two concurrent revokes of an organization's only two owners
   * could each read a count of 2 before either committed, and both proceed.
   *
   * `SELECT ... FOR UPDATE` locks every currently-ACTIVE membership row in
   * the tenant before the caller decides anything from the result, so a
   * second, concurrent call against the SAME tenant blocks until the first
   * transaction commits or rolls back, then re-reads a state that already
   * reflects it — the same "lock what you're about to count" fix `AGENTS.md`
   * §4's constraint-over-precheck principle already applies elsewhere via a
   * UNIQUE index, used here instead of one because "at least one active
   * owner" is not a uniqueness property a plain constraint can express.
   *
   * Deliberately not narrowed to just the target's own row: the caller needs
   * the tenant-wide ACTIVE count (and, by construction, whether the target
   * itself is still among them) in one locked read. Also sufficient to
   * protect the *owner* count `RevokeMembershipService` derives afterward
   * via `RoleGrantRepository.countActiveMembersWithRole`, without a second
   * lock on `membership_roles` — no capability in this codebase ever removes
   * a role grant (`membership.revoke` itself deliberately does not, and
   * `membership.role.assign` only adds), so `memberships.status` is the only
   * column either count can ever change through, and this lock covers it.
   */
  lockActiveForUpdate(tenantId: string): Promise<Membership[]>;

  /**
   * Sets a membership's status to REVOKED and stamps `updated_at` — the only
   * place this ever moves in that direction. Never deletes the row: 08 §5
   * forbids deleting tenant data without an explicit policy, and `status`
   * already exists precisely so a membership's history survives (matching
   * `sessions.status`'s own REVOKED-not-deleted shape). Idempotent at the
   * storage layer (setting REVOKED on an already-REVOKED row is a no-op
   * update) — `RevokeMembershipService` rejects this case earlier with
   * CONFLICT before ever reaching here, so this method itself is never
   * actually exercised against an already-revoked row in practice.
   */
  revoke(membershipId: string, revokedAt: Date): Promise<void>;
}
