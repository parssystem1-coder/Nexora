import type { Membership } from "./membership.entity.js";

export interface MembershipRepository {
  /** Self-access bootstrap query (DECISION_LOG.md "RLS bootstrap..."): scoped by user, not yet by tenant. */
  findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;

  /**
   * Added for organization.create, which makes its creator the organization's
   * first member in the same transaction that creates the organization.
   * Takes a fully-formed entity (id included) rather than returning a
   * generated one: the caller already runs inside the new tenant's RLS
   * context, and generating ids client-side keeps every write in this slice
   * free of `INSERT ... RETURNING`, whose returned rows Postgres re-checks
   * against the table's USING policy.
   */
  create(membership: Membership): Promise<void>;
}
