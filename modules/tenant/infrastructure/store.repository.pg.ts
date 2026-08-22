import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Store } from "../domain/store.entity.js";
import type { StoreRepository } from "../domain/store.repository.js";
import "./tenant.tables.js";

export class StoreRepositoryPg implements StoreRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findById(id: string): Promise<Store | null> {
    const row = await this.conn
      .selectFrom("stores")
      .select(["id", "tenant_id", "name", "slug", "status", "created_at"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return new Store(row.id, row.tenant_id, row.name, row.slug, row.status as "ACTIVE" | "SUSPENDED", row.created_at);
  }
}
