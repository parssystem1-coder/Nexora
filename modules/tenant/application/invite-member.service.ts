import type { Clock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { UserRepository } from "../../identity/contracts/index.js";
import { Membership } from "../domain/membership.entity.js";
import { MembershipAlreadyExistsError } from "../domain/membership.repository.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { MembershipDto } from "../contracts/tenant.contract.js";

export interface InviteMemberCommand {
  /** Minted by the caller before the transaction, so the audit event has a stable resource id on both paths. */
  membershipId: string;
  tenantId: string;
  email: string;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 2, pipeline step 7.
 *
 * "Invite" in Phase 1 means: add an existing platform user to this
 * organization as an ACTIVE member holding **no roles**. That is the whole of
 * what the Phase 1 schema can express - there is no `invitations` table in
 * `08` §4's scope list, `memberships.status` is constrained to
 * ('ACTIVE','REVOKED') with no pending state, and no notification module
 * exists to deliver an invitation. `03_TECHNICAL_BLUEPRINT.md` §167's flow
 * ("create organization -> invite member -> assign role") confirms the split:
 * this capability creates the membership, `membership.role.assign` grants the
 * roles. See DECISION_LOG.md for the options considered.
 *
 * The invitee's account status is deliberately not checked: a SUSPENDED user
 * cannot authenticate at all (ValidateSessionService rejects them), so a
 * membership row for one grants nothing. Refusing here would duplicate that
 * rule in a second place and need an error code §7 does not define for it.
 */
export class InviteMemberService {
  constructor(
    private readonly users: UserRepository,
    private readonly memberships: MembershipRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: InviteMemberCommand): Promise<MembershipDto> {
    const invitee = await this.users.findByEmail(command.email);
    if (!invitee) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "No platform user exists with that email address.");
    }

    const membership = new Membership(
      command.membershipId,
      command.tenantId,
      invitee.id,
      "ACTIVE",
      this.clock.now(),
    );

    try {
      await this.memberships.create(membership);
    } catch (err) {
      if (err instanceof MembershipAlreadyExistsError) {
        throw new CapabilityError("CONFLICT", "That user already holds a membership in this organization.");
      }
      throw err;
    }

    return {
      id: membership.id,
      organizationId: membership.tenantId,
      userId: membership.userId,
      status: membership.status,
      createdAt: membership.createdAt.toISOString(),
    };
  }
}
