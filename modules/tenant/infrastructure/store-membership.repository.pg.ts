import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { StoreMembership } from "../domain/store-membership.entity.js";
import type { StoreMembershipRepository } from "../domain/store-membership.repository.js";
import "./tenant.tables.js";

export class StoreMembershipRepositoryPg implements StoreMembershipRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByUserAndStore(userId: string, storeId: string): Promise<StoreMembership | null> {
    const row = await this.conn
      .selectFrom("store_memberships")
      .select(["id", "tenant_id", "store_id", "user_id"])
      .where("user_id", "=", userId)
      .where("store_id", "=", storeId)
      .executeTakeFirst();
    if (!row) return null;
    return new StoreMembership(row.id, row.tenant_id, row.store_id, row.user_id);
  }

  /** See StoreMembershipRepository.create: id supplied by the caller, no RETURNING. */
  async create(storeMembership: StoreMembership): Promise<void> {
    await this.conn
      .insertInto("store_memberships")
      .values({
        id: storeMembership.id,
        tenant_id: storeMembership.tenantId,
        store_id: storeMembership.storeId,
        user_id: storeMembership.userId,
      })
      .execute();
  }
}
