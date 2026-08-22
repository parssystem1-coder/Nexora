import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Session } from "../domain/session.entity.js";
import type { SessionRepository } from "../domain/session.repository.js";
import "./identity.tables.js";

export class SessionRepositoryPg implements SessionRepository {
  constructor(private readonly conn: Kysely<Database>) {}

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.conn
      .selectFrom("sessions")
      .select(["id", "user_id", "active_organization_id", "status", "expires_at"])
      .where("token_hash", "=", tokenHash)
      .executeTakeFirst();
    if (!row) return null;
    return new Session(row.id, row.user_id, row.active_organization_id, row.status as "ACTIVE" | "REVOKED", row.expires_at);
  }
}
