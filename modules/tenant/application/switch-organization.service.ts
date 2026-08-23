import type { SessionRepository } from "../../identity/contracts/index.js";

export interface SwitchOrganizationCommand {
  sessionId: string;
  organizationId: string;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 6, pipeline step 7. ADR-029 item 5: "active
 * organization is session state, not token state." Updates a display
 * preference on the caller's own session — nothing else. By the time this
 * runs, `OrganizationAccessGuard` has already validated `organizationId` as a
 * UUID and verified the caller holds an ACTIVE membership in it (steps 2-4);
 * this service has no further opinion on either.
 *
 * Deliberately does not special-case switching to the organization already
 * active: the `UPDATE` sets the column to the value it may already hold,
 * which is a correct no-op, not a bug to guard against (DECISION_LOG.md
 * 2026-08-24, decision 6).
 *
 * Never authorizes anything — see `apps/api/organization-switch.integration
 * .spec.ts`'s ADR-002 proof: a request naming a DIFFERENT, still-valid
 * organization succeeds identically before and after a switch, and a request
 * naming an organization the caller does not belong to is denied identically
 * either way. If this service ever became load-bearing for authorization,
 * that test is what would catch it.
 */
export class SwitchOrganizationService {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(command: SwitchOrganizationCommand): Promise<void> {
    await this.sessions.setActiveOrganization(command.sessionId, command.organizationId);
  }
}
