import type { Clock } from "../../../platform/clock.js";
import type { SessionRevocationRepository } from "../domain/session-revocation.repository.js";

export interface LogoutCommand {
  sessionId: string;
  userId: string;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5 (second of three), pipeline step 7.
 * ADR-029 item 6's "explicit logout" trigger.
 *
 * Ends exactly the one session `SessionGuard` already resolved for this
 * request — never any other session belonging to the same user. That
 * broader action is `auth.logout_all` (`LogoutAllService`), a deliberately
 * separate capability with its own risk tier, its own idempotency answer,
 * and its own decision about whether it may end the caller's own session
 * (see DECISION_LOG.md 2026-08-24).
 */
export class LogoutService {
  constructor(
    private readonly sessions: SessionRevocationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.sessions.revokeOne(command.sessionId, command.userId, this.clock.now());
  }
}
