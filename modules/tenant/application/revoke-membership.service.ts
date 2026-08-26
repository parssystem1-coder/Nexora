import type { Clock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { RoleGrantRepository } from "../../authorization/contracts/index.js";
import type { SessionRevocationRepository } from "../../identity/contracts/index.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { MembershipDto } from "../contracts/tenant.contract.js";

export interface RevokeMembershipCommand {
  tenantId: string;
  targetMembershipId: string;
}

/**
 * The seventh capability, not one of 08_PHASE_1_BRIEF.md §3's six-slice
 * list — see DECISION_LOG.md 2026-08-24 for why it is in scope anyway.
 * Pipeline step 7.
 *
 * The target membership is resolved by id alone
 * (`MembershipRepository.findById`), which is NOT tenant-filtered by
 * construction — the same R-003 self-access clause `AssignMembershipRoleService`
 * already guards against. The explicit `target.tenantId !== command.tenantId`
 * check below is load-bearing for the identical reason, made MORE important
 * here than for role assignment: this capability writes a status change that
 * is destructive in effect (it ends the target's access and every one of
 * their sessions), not merely additive.
 *
 * Three ways this refuses, each a distinct decision (DECISION_LOG.md
 * 2026-08-24):
 *
 *   RESOURCE_NOT_FOUND — no such membership, or a real one in a DIFFERENT
 *   tenant (R-003). Collapsed into one code, following slice 2/3's
 *   enumeration-avoidance precedent: a caller must not learn which of the
 *   two occurred.
 *
 *   CONFLICT (already revoked) — DELIBERATELY a different code from
 *   RESOURCE_NOT_FOUND, unlike `membership.role.assign`'s choice to collapse
 *   a revoked target into the same not-found bucket. The reasoning does not
 *   carry over: this capability's caller is an owner already managing their
 *   own organization's memberships (guard- and permission-verified before
 *   this code ever runs), not a party enumeration-avoidance needs to protect
 *   against for "does this org's own membership still exist" — that is
 *   ordinary, transparent information at this point in the pipeline.
 *
 *   CONFLICT (last owner / last member) — revoking would leave the
 *   organization with zero ACTIVE owners or zero ACTIVE members, either of
 *   which is a dead end no capability could ever reverse: `membership.invite`
 *   needs an ACTIVE member holding its permission to call it at all, and
 *   `membership.role.assign` needs an ACTIVE owner. An organization no
 *   capability can ever act on again is a data-loss outcome by another name,
 *   even though the row we would have refused to touch is technically
 *   unharmed either way.
 *
 * Self-revocation is allowed, no special case — the same "accepted
 * consequence, not suppressed" precedent `membership.role.assign` already
 * set for self-assignment. A caller who is their organization's sole owner
 * or sole member is already refused by the checks above regardless of who
 * they are targeting, so this never actually bricks anything by accident.
 *
 * Does NOT remove the target's `membership_roles` rows — see
 * `MembershipRepository.revoke`'s own doc comment for why, and the "R-006"
 * finding in RISK_REGISTER.md for the one gap this choice depends on staying
 * true.
 *
 * On success, revokes every ACTIVE session belonging to the target's user
 * (08_PHASE_1_BRIEF.md §5: "sessions invalidate immediately on ... membership
 * revocation" — the second of that rule's three triggers now implemented,
 * `membership.role.assign`'s role-change trigger being the first) in the
 * SAME transaction as the status change, so the two writes are atomic —
 * exactly `AssignMembershipRoleService`'s own pattern.
 */
export class RevokeMembershipService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly roleGrants: RoleGrantRepository,
    private readonly sessions: SessionRevocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeMembershipCommand): Promise<MembershipDto> {
    const target = await this.memberships.findById(command.targetMembershipId);
    if (!target || target.tenantId !== command.tenantId) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "No membership with that id in this organization.");
    }

    // Locks every ACTIVE membership row in this tenant before deciding
    // anything from a count — see MembershipRepository.lockActiveForUpdate.
    // A concurrent revoke in the SAME organization blocks here until this
    // transaction resolves, so two racing revokes can never both read a
    // pre-write count. The "already revoked" check below reads this locked,
    // fresh set rather than `target`'s own (possibly stale) snapshot from
    // the read above, for the same reason.
    const lockedActive = await this.memberships.lockActiveForUpdate(command.tenantId);
    const targetIsStillActive = lockedActive.some((m) => m.id === target.id);

    if (!targetIsStillActive) {
      throw new CapabilityError("CONFLICT", "This membership is already revoked.");
    }
    if (lockedActive.length <= 1) {
      throw new CapabilityError("CONFLICT", "Cannot revoke the organization's only remaining member.");
    }

    const targetIsOwner = await this.roleGrants.hasRole(target.id, "owner");
    if (targetIsOwner) {
      const activeOwnerCount = await this.roleGrants.countActiveMembersWithRole(command.tenantId, "owner");
      if (activeOwnerCount <= 1) {
        throw new CapabilityError("CONFLICT", "Cannot revoke the organization's only remaining owner.");
      }
    }

    const revokedAt = this.clock.now();
    await this.memberships.revoke(target.id, revokedAt);
    await this.sessions.revokeAllForUser(target.userId, revokedAt);

    return {
      id: target.id,
      organizationId: target.tenantId,
      userId: target.userId,
      status: "REVOKED",
      createdAt: target.createdAt.toISOString(),
    };
  }
}
