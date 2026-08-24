import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { isUniqueViolation } from "../../../platform/db/constraint-violation.js";
import { Membership } from "../domain/membership.entity.js";
import { MembershipAlreadyExistsError } from "../domain/membership.repository.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import "./tenant.tables.js";

/** The UNIQUE (tenant_id, user_id) constraint from 20260822090300_tenant__create_memberships.sql. */
const TENANT_USER_UNIQUE = "memberships_tenant_id_user_id_key";

export class MembershipRepositoryPg implements MembershipRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null> {
    const row = await this.conn
      .selectFrom("memberships")
      .select(["id", "tenant_id", "user_id", "status", "created_at"])
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    if (!row) return null;
    return new Membership(row.id, row.tenant_id, row.user_id, row.status as "ACTIVE" | "REVOKED", row.created_at);
  }

  /** See MembershipRepository.findById's R-003 warning: callers must check tenantId themselves. */
  async findById(id: string): Promise<Membership | null> {
    const row = await this.conn
      .selectFrom("memberships")
      .select(["id", "tenant_id", "user_id", "status", "created_at"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return new Membership(row.id, row.tenant_id, row.user_id, row.status as "ACTIVE" | "REVOKED", row.created_at);
  }

  async countActive(tenantId: string): Promise<number> {
    const result = await this.conn
      .selectFrom("memberships")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("tenant_id", "=", tenantId)
      .where("status", "=", "ACTIVE")
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }

  async revoke(membershipId: string, revokedAt: Date): Promise<void> {
    await this.conn
      .updateTable("memberships")
      .set({ status: "REVOKED", updated_at: revokedAt.toISOString() })
      .where("id", "=", membershipId)
      .execute();
  }

  /** See MembershipRepository.create: id supplied by the caller, no RETURNING. */
  async create(membership: Membership): Promise<void> {
    try {
      await this.conn
        .insertInto("memberships")
        .values({
          id: membership.id,
          tenant_id: membership.tenantId,
          user_id: membership.userId,
          status: membership.status,
          created_at: membership.createdAt.toISOString(),
        })
        .execute();
    } catch (err) {
      if (isUniqueViolation(err, TENANT_USER_UNIQUE)) {
        throw new MembershipAlreadyExistsError(membership.tenantId, membership.userId);
      }
      throw err;
    }
  }
}
