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
   * remaining member" protection (DECISION_LOG.md 2026-08-24, decision 3).
   * Counts ACTIVE memberships only — a REVOKED one does not keep the
   * organization administrable, so it must not count toward "still has
   * someone left."
   */
  countActive(tenantId: string): Promise<number>;

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
