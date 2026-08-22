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
}
