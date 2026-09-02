import type { SessionRepository } from "../domain/session.repository.js";

/**
 * ADR-051: answers exactly one question — "was this session, which was valid
 * when `SessionGuard` ran, revoked since?"
 *
 * **Why a service in `modules/identity` rather than a read inside the guard
 * that needs it.** The guard that needs it is `OrganizationAccessGuard`, in
 * `modules/tenant`. `04_DATABASE_BLUEPRINT.md` §1 and `AGENTS.md` §4 forbid a
 * module reading another module's tables directly, so this is exposed through
 * `modules/identity/contracts` the same way `SessionRevocationRepositoryPg`
 * and `SessionRepositoryPg` already are. It is one question with one answer
 * rather than a general session port, so a caller cannot drift into using it
 * to authenticate — `SessionGuard` remains the only authentication path.
 *
 * **A missing session is reported as not-revoked, deliberately.** The only
 * caller is on a failure path that has already decided to refuse the request;
 * the choice is between `FORBIDDEN` and `SESSION_INVALIDATED`, never between
 * refusing and allowing. If the row has vanished entirely, `FORBIDDEN` is the
 * honest answer, because nothing observed a revocation. Returning `true` here
 * would let a deleted row masquerade as a revoked one.
 */
export class CheckSessionRevokedService {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(sessionId: string): Promise<boolean> {
    const session = await this.sessions.findById(sessionId);
    return session?.isRevoked() ?? false;
  }
}
