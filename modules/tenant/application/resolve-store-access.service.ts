import { CapabilityError } from "../../capability/contracts/index.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { StoreMembershipRepository } from "../domain/store-membership.repository.js";

export interface StoreAccess {
  tenantId: string;
  storeId: string;
  /** Carried forward so a later permission check doesn't re-look-up the membership across a module boundary. */
  membershipId: string;
}

/**
 * 08_PHASE_1_BRIEF.md §2 step 3 and §5: "store_memberships is checked for
 * every store-scoped read; organization membership alone is not sufficient."
 * The reverse also holds and is checked independently here: a stale
 * store_membership left over from a revoked organization membership must
 * not grant access either. Both checks are separate queries against
 * separate tables — never inferred from one another.
 */
export class ResolveStoreAccessService {
  constructor(
    private readonly storeMemberships: StoreMembershipRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async execute(userId: string, storeId: string): Promise<StoreAccess> {
    const storeMembership = await this.storeMemberships.findByUserAndStore(userId, storeId);
    if (!storeMembership) {
      throw new CapabilityError("STORE_ACCESS_DENIED", "No store membership for this user and store.");
    }

    const membership = await this.memberships.findByUserAndTenant(userId, storeMembership.tenantId);
    if (!membership || !membership.isActive) {
      throw new CapabilityError(
        "STORE_ACCESS_DENIED",
        "No active organization membership for this store's organization.",
      );
    }

    return { tenantId: storeMembership.tenantId, storeId, membershipId: membership.id };
  }
}
