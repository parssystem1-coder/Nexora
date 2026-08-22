import type { Clock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { RoleAlreadyGrantedError } from "../../authorization/contracts/index.js";
import type { RoleGrantRepository } from "../../authorization/contracts/index.js";
import type { SessionRevocationRepository } from "../../identity/contracts/index.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { MembershipRoleDto } from "../contracts/tenant.contract.js";

export interface AssignMembershipRoleCommand {
  /** Minted by the caller before the transaction, so the audit event has a stable resource id on both paths. */
  grantId: string;
  tenantId: string;
  targetMembershipId: string;
  roleKey: string;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 3, pipeline step 7.
 *
 * Adds one role to the target membership's set — it does not replace it.
 * `membership_roles` allows several rows per membership and the flow this
 * mirrors (`03_TECHNICAL_BLUEPRINT.md` §167: "invite member -> assign role")
 * describes granting, never resetting, a member's roles. See
 * DECISION_LOG.md.
 *
 * The target membership is resolved by id alone (`MembershipRepository
 * .findById`), which is NOT tenant-filtered by construction — its RLS policy
 * has a self-access OR clause (RISK_REGISTER.md R-003) that can make a
 * caller's own membership row IN ANOTHER ORGANIZATION visible here. The
 * explicit `target.tenantId !== command.tenantId` check below is load
 * bearing, not defensive decoration: without it, an owner of organization A
 * could name their own membership id while acting as organization B's
 * caller-context and this service would silently operate on the wrong row.
 * A revoked or genuinely nonexistent target collapses to the same
 * RESOURCE_NOT_FOUND, following slice 2's enumeration-avoidance precedent
 * (ResolveOrganizationAccessService): a caller cannot learn from the
 * response alone whether a membership id names no row, a row in a different
 * tenant, or a revoked row in this one.
 *
 * On success, revokes every ACTIVE session belonging to the target's user
 * (08_PHASE_1_BRIEF.md §5: "sessions invalidate immediately on ... role
 * change") in the SAME transaction as the grant, so the two writes are
 * atomic — see DECISION_LOG.md "Session invalidation on role change:
 * implemented now, in this slice". This applies even when the caller is
 * assigning a role to themselves: their own session is revoked too, an
 * accepted consequence rather than a special case (see the same entry).
 */
export class AssignMembershipRoleService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly roleGrants: RoleGrantRepository,
    private readonly sessions: SessionRevocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AssignMembershipRoleCommand): Promise<MembershipRoleDto> {
    const target = await this.memberships.findById(command.targetMembershipId);
    if (!target || target.tenantId !== command.tenantId || !target.isActive) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "No active membership with that id in this organization.");
    }

    const createdAt = this.clock.now();
    let grant;
    try {
      grant = await this.roleGrants.grantRoleByKey({
        id: command.grantId,
        tenantId: command.tenantId,
        membershipId: target.id,
        roleKey: command.roleKey,
        createdAt,
      });
    } catch (err) {
      if (err instanceof RoleAlreadyGrantedError) {
        throw new CapabilityError("CONFLICT", "This membership already holds that role.");
      }
      throw err;
    }

    await this.sessions.revokeAllForUser(target.userId, createdAt);

    return {
      id: grant.id,
      organizationId: grant.tenantId,
      membershipId: grant.membershipId,
      roleKey: grant.roleKey,
      createdAt: grant.createdAt.toISOString(),
    };
  }
}
