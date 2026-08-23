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

  /**
   * Added for `organization.switch` (08_PHASE_1_BRIEF.md §3 slice 6). Updates
   * `sessions.active_organization_id` — a UI convenience per ADR-029 item 5,
   * never consulted to authorize a request (ADR-002) — so this is the ONE
   * place that column is ever written outside `create()`'s initial `null`.
   * Takes `organizationId` as a plain string, not validated here: the caller
   * (`SwitchOrganizationService`) only reaches this after `organizationId`
   * has already been validated as a UUID AND the caller's ACTIVE membership
   * in it has already been verified, by `OrganizationAccessGuard` — this
   * method has no opinion on whether the organization exists or the caller
   * belongs to it, the same way `create()` has no opinion on whether
   * `userId` names a real user.
   */
  setActiveOrganization(sessionId: string, organizationId: string): Promise<void>;
}
