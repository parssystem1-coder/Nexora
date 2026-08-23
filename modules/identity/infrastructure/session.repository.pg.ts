import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Session } from "../domain/session.entity.js";
import type { SessionRepository, CreateSessionCommand } from "../domain/session.repository.js";
import "./identity.tables.js";

/**
 * sessions has no RLS (identity cluster exemption), so a plain
 * Kysely<Database> is enough and no transaction is needed.
 */
export class SessionRepositoryPg implements SessionRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.conn
      .selectFrom("sessions")
      .select(["id", "user_id", "token_hash", "active_organization_id", "status", "created_at", "expires_at"])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    if (!row) return null;
    return new Session(
      row.id,
      row.user_id,
      row.token_hash,
      row.active_organization_id,
      row.status as "ACTIVE" | "REVOKED",
      row.created_at,
      row.expires_at,
    );
  }

  /**
   * Id and created_at supplied by the caller, matching every other insert in
   * this codebase — auth.login mints the id before it does anything else so
   * a failed attempt's audit event still has a stable resource id.
   * `last_seen_at` is left to its DB default (`now()`); nothing reads or
   * updates it yet, so there is no clock-consistency reason to set it
   * explicitly from here.
   */
  async create(command: CreateSessionCommand): Promise<void> {
    await this.conn
      .insertInto("sessions")
      .values({
        id: command.id,
        user_id: command.userId,
        token_hash: command.tokenHash,
        active_organization_id: command.activeOrganizationId,
        status: "ACTIVE",
        created_at: command.createdAt.toISOString(),
        expires_at: command.expiresAt.toISOString(),
      })
      .execute();
  }

  /** Scoped to ACTIVE as defense in depth — SessionGuard already established this session is valid before this ever runs. */
  async setActiveOrganization(sessionId: string, organizationId: string): Promise<void> {
    await this.conn
      .updateTable("sessions")
      .set({ active_organization_id: organizationId })
      .where("id", "=", sessionId)
      .where("status", "=", "ACTIVE")
      .execute();
  }
}
