import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Membership } from "../domain/membership.entity.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import "./tenant.tables.js";

export class MembershipRepositoryPg implements MembershipRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null> {
    const row = await this.conn
      .selectFrom("memberships")
      .select(["id", "tenant_id", "user_id", "status"])
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    if (!row) return null;
    return new Membership(row.id, row.tenant_id, row.user_id, row.status as "ACTIVE" | "REVOKED");
  }
}
