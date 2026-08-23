import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { SessionRevocationRepository, SessionTerminationRepository } from "../domain/session-revocation.repository.js";
import "./identity.tables.js";

/**
 * `sessions` has no RLS (identity cluster exemption), so a plain
 * `Kysely<Database>` would suffice — but this accepts a `Transaction` too so
 * `membership.role.assign` can run the revocation on the SAME connection as
 * its role grant, making the two writes atomic (see
 * assign-membership-role.service.ts): a grant that lands without its
 * required session invalidation, or the reverse, would each be a correctness
 * bug the phase-brief rule exists to prevent.
 *
 * Implements `SessionTerminationRepository` too (added for `auth.logout` /
 * `auth.logout_all` — see session-revocation.repository.ts's doc comment for
 * why that is a second interface rather than a widening of
 * `SessionRevocationRepository`). One class, one place that ever writes a
 * revocation to `sessions`, regardless of which port a caller asks through.
 */
export class SessionRevocationRepositoryPg implements SessionRevocationRepository, SessionTerminationRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.conn
      .updateTable("sessions")
      .set({ status: "REVOKED", revoked_at: revokedAt.toISOString() })
      .where("user_id", "=", userId)
      .where("status", "=", "ACTIVE")
      .execute();
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

  async revokeAll(userId: string, revokedAt: Date): Promise<number> {
    const result = await this.conn
      .updateTable("sessions")
      .set({ status: "REVOKED", revoked_at: revokedAt.toISOString() })
      .where("user_id", "=", userId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }
}
