import type { Session } from "./session.entity.js";

export interface CreateSessionCommand {
  id: string;
  userId: string;
  tokenHash: string;
  /**
   * ADR-029 item 5: "active organization is session state." auth.login sets
   * this to `null` unconditionally (DECISION_LOG.md "auth.login: what
   * active_organization_id starts as") — never inferred from a sole
   * membership, so identity never has to read modules/tenant's data to log
   * a user in.
   */
  activeOrganizationId: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;

  /** Added for auth.login. Always creates an ACTIVE session — there is no other status a login can produce. */
  create(command: CreateSessionCommand): Promise<void>;
}
