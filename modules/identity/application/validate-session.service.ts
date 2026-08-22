import type { Clock } from "../../../platform/clock.js";
import { hashSessionToken } from "../domain/session-token.vo.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { AuthenticatedIdentity } from "../contracts/index.js";

/**
 * 08_PHASE_1_BRIEF.md §2 step 1: "authentication against a server-side
 * session." Deliberately does not distinguish "no such session" from
 * "expired" from "user suspended" in its return value — all three mean
 * AUTHENTICATION_REQUIRED to the caller (05_API_CAPABILITY_CONTRACTS.md §7);
 * leaking which one occurred would help an attacker enumerate valid tokens.
 */
export class ValidateSessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string): Promise<AuthenticatedIdentity | null> {
    const tokenHash = hashSessionToken(rawToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session || !session.isValid(this.clock.now())) return null;

    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) return null;

    return {
      userId: user.id,
      sessionId: session.id,
      activeOrganizationId: session.activeOrganizationId,
    };
  }
}
