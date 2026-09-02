/** The public shape other modules see after a session has been authenticated. */
export interface AuthenticatedIdentity {
  userId: string;
  sessionId: string;
  activeOrganizationId: string | null;
}

/**
 * Read-only access to the user directory, for modules that must resolve a
 * person who is not the caller — membership.invite looks the invitee up by
 * email. Exposed as port + adapter through contracts/, the same way
 * modules/authorization exposes RoleGrantRepositoryPg, so no module reaches
 * into modules/identity's internals (ADR-030 dependency direction).
 */
export { UserRepositoryPg } from "../infrastructure/user.repository.pg.js";
export { normalizeEmail } from "../domain/email.vo.js";
export type { User } from "../domain/user.entity.js";
export type { UserRepository } from "../domain/user.repository.js";

/**
 * Write access limited to "revoke everything for this user" — see
 * session-revocation.repository.ts. modules/tenant calls this from
 * membership.role.assign; no module may write modules/identity's tables
 * directly (ADR-030 dependency direction).
 */
export { SessionRevocationRepositoryPg } from "../infrastructure/session-revocation.repository.pg.js";
export type { SessionRevocationRepository } from "../domain/session-revocation.repository.js";

/**
 * `organization.switch` (modules/tenant) writes `sessions.active_organization_id`
 * through this — the same ADR-030 dependency-direction rule as above: no
 * module reaches into modules/identity's tables directly. `SessionRepository`
 * is the same port `auth.login`/`SessionGuard` already use internally; this
 * exposes it rather than adding a third, narrower one for the same table.
 */
export { SessionRepositoryPg } from "../infrastructure/session.repository.pg.js";
export type { SessionRepository } from "../domain/session.repository.js";

/**
 * ADR-051. `modules/tenant`'s `OrganizationAccessGuard` must distinguish "your
 * session was revoked mid-request" from "you are not a member of this
 * organization" — 401 `SESSION_INVALIDATED` versus 403 `FORBIDDEN`. It cannot
 * read `sessions` itself (`04` §1, `AGENTS.md` §4), so the one question it
 * needs answered is exposed here, the same way the two ports above are. Not a
 * second authentication path: it returns a boolean about an already-identified
 * session and cannot admit anyone.
 */
export { CheckSessionRevokedService } from "../application/check-session-revoked.service.js";
