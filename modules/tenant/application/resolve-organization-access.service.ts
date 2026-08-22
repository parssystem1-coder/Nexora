import { CapabilityError } from "../../capability/contracts/index.js";
import type { MembershipRepository } from "../domain/membership.repository.js";

export interface OrganizationAccess {
  tenantId: string;
  /** Carried forward so pipeline step 6 does not re-resolve the membership across a module boundary. */
  membershipId: string;
}

/**
 * 08_PHASE_1_BRIEF.md §2 steps 2-3 for an organization-scoped capability:
 * the caller must hold an ACTIVE membership in the organization they named.
 *
 * The organization-level counterpart of ResolveStoreAccessService, and
 * deliberately not a relaxation of it: this grants access to the
 * organization, never to a store inside it. §5's "store_memberships is
 * checked for every store-scoped read; organization membership alone is not
 * sufficient" is unaffected, because no store-scoped capability routes
 * through here.
 *
 * A revoked membership is denied with the same code and message as no
 * membership at all, so a former member cannot use the difference to confirm
 * that an organization exists.
 */
export class ResolveOrganizationAccessService {
  constructor(private readonly memberships: MembershipRepository) {}

  async execute(userId: string, organizationId: string): Promise<OrganizationAccess> {
    const membership = await this.memberships.findByUserAndTenant(userId, organizationId);
    if (!membership || !membership.isActive) {
      throw new CapabilityError("FORBIDDEN", "No active membership in this organization.");
    }

    return { tenantId: organizationId, membershipId: membership.id };
  }
}
