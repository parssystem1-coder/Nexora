import type { StoreMembership } from "./store-membership.entity.js";

export interface StoreMembershipRepository {
  /** Self-access bootstrap query (DECISION_LOG.md "RLS bootstrap..."): scoped by user, not yet by tenant. */
  findByUserAndStore(userId: string, storeId: string): Promise<StoreMembership | null>;

  /**
   * Added for store.create, which makes its creator the new store's first
   * store member in the same transaction that creates the store — without
   * this, `store.read`'s access check (`store_memberships` is checked for
   * every store-scoped read; organization membership alone is not
   * sufficient, 08_PHASE_1_BRIEF.md §5) would deny the creator access to the
   * store they just made. Id supplied by the caller, matching every other
   * insert in this codebase.
   *
   * `store_memberships`' RLS policy carries the same self-access OR clause
   * as `memberships` (RISK_REGISTER.md R-003), but this write runs inside an
   * already-established tenant context (the caller's own organization, per
   * OrganizationAccessGuard), so the `tenant_id` branch of the policy
   * satisfies the insert on its own — the same reasoning
   * organization.create's insert into `memberships` already relies on.
   */
  create(storeMembership: StoreMembership): Promise<void>;
}
