import type { Clock } from "../../../platform/clock.js";
import { hashSessionToken } from "../domain/session-token.vo.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { AuthenticatedIdentity } from "../contracts/index.js";

/**
 * The three outcomes `SessionGuard` must be able to tell apart, and no more
 * (ADR-051).
 *
 * `INVALID` deliberately collapses "no such session", "expired", "no such
 * user" and "user suspended" into one indistinguishable answer — see the
 * service's own doc comment for why that collapse is a security property and
 * not an omission. `REVOKED` is the single case ADR-051 separates out.
 */
export type SessionValidation =
  { outcome: "VALID"; identity: AuthenticatedIdentity } | { outcome: "REVOKED" } | { outcome: "INVALID" };

/**
 * 08_PHASE_1_BRIEF.md §2 step 1: "authentication against a server-side
 * session."
 *
 * **What this does not distinguish, and why — the original property, still
 * intact.** "No such session", "expired", "no such user" and "user suspended"
 * all return `INVALID`, and all reach the caller as
 * `AUTHENTICATION_REQUIRED` (`05_API_CAPABILITY_CONTRACTS.md` §7). Leaking
 * which one occurred would help an attacker enumerate valid tokens.
 *
 * **What ADR-051 changed, and why it does not weaken that.** A session row
 * that exists and was explicitly REVOKED now returns `REVOKED`, which the
 * guard surfaces as `SESSION_INVALIDATED`/401. This is not an enumeration
 * oracle: reaching it requires presenting a token whose hash already matches
 * a real row, so the only party who can observe the difference is one who
 * already held a genuine token — precisely the party ADR-051 exists to
 * inform, and one who learns nothing they did not already have. An attacker
 * guessing tokens still cannot tell any of the four `INVALID` cases apart,
 * which is the property the collapse above was protecting.
 *
 * **Expiry is checked before revocation is reported.** A session that is
 * revoked is reported as revoked even if it has also since expired, because
 * revocation is a stored fact rather than a function of the clock — see
 * `Session.isRevoked()`.
 */
export class ValidateSessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(rawToken: string): Promise<SessionValidation> {
    const tokenHash = hashSessionToken(rawToken);
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session) return { outcome: "INVALID" };
    if (session.isRevoked()) return { outcome: "REVOKED" };
    if (!session.isValid(this.clock.now())) return { outcome: "INVALID" };

    const user = await this.users.findById(session.userId);
    if (!user || !user.isActive) return { outcome: "INVALID" };

    return {
      outcome: "VALID",
      identity: {
        userId: user.id,
        sessionId: session.id,
        activeOrganizationId: session.activeOrganizationId,
      },
    };
  }
}
