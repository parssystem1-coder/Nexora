import type { Clock } from "../../../platform/clock.js";
import type { SessionRevocationRepository } from "../domain/session-revocation.repository.js";

export interface LogoutAllCommand {
  userId: string;
}

export interface LogoutAllResult {
  sessionsRevoked: number;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5 (third of three), pipeline step 7.
 * ADR-029 item 6's "logout-all-devices" trigger.
 *
 * Ends every ACTIVE session for the caller's user id — INCLUDING the one
 * making this very request (DECISION_LOG.md 2026-08-24, decision 3: the same
 * accepted consequence `membership.role.assign` already established for
 * self-assignment — a capability that can affect the caller's own session
 * does not get a special case carved out for that). Reports how many
 * sessions were actually revoked, since the caller has no other way to know
 * how many devices that was.
 */
export class LogoutAllService {
  constructor(
    private readonly sessions: SessionRevocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: LogoutAllCommand): Promise<LogoutAllResult> {
    const sessionsRevoked = await this.sessions.revokeAllForUser(command.userId, this.clock.now());
    return { sessionsRevoked };
  }
}
