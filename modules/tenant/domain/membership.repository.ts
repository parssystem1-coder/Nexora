import type { Membership } from "./membership.entity.js";

export interface MembershipRepository {
  /** Self-access bootstrap query (DECISION_LOG.md "RLS bootstrap..."): scoped by user, not yet by tenant. */
  findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;
}
