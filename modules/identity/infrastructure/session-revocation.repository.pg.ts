import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { SessionRevocationRepository } from "../domain/session-revocation.repository.js";
import "./identity.tables.js";

/**
 * `sessions` has no RLS (identity cluster exemption), so a plain
 * `Kysely<Database>` would suffice — but this accepts a `Transaction` too so
 * `membership.role.assign` can run the revocation on the SAME connection as
 * its role grant, making the two writes atomic (see
 * assign-membership-role.service.ts): a grant that lands without its
 * required session invalidation, or the reverse, would each be a correctness
 * bug the phase-brief rule exists to prevent.
 */
export class SessionRevocationRepositoryPg implements SessionRevocationRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<number> {
    const result = await this.conn
      .updateTable("sessions")
      .set({ status: "REVOKED", revoked_at: revokedAt.toISOString() })
      .where("user_id", "=", userId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async revokeOne(sessionId: string, userId: string, revokedAt: Date): Promise<void> {
    await this.conn
      .updateTable("sessions")
      .set({ status: "REVOKED", revoked_at: revokedAt.toISOString() })
      .where("id", "=", sessionId)
      .where("user_id", "=", userId)
      .where("status", "=", "ACTIVE")
      .execute();
  }
}
