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
