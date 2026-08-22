import type { StoreMembership } from "./store-membership.entity.js";

export interface StoreMembershipRepository {
  /** Self-access bootstrap query (DECISION_LOG.md "RLS bootstrap..."): scoped by user, not yet by tenant. */
  findByUserAndStore(userId: string, storeId: string): Promise<StoreMembership | null>;
}
