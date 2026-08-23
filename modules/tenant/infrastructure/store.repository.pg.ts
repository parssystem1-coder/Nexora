import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { isUniqueViolation } from "../../../platform/db/constraint-violation.js";
import { Store } from "../domain/store.entity.js";
import { StoreSlugTakenError } from "../domain/store.repository.js";
import type { StoreRepository } from "../domain/store.repository.js";
import "./tenant.tables.js";

/** The UNIQUE (tenant_id, slug) constraint from 20260822090400_tenant__create_stores.sql. */
const TENANT_SLUG_UNIQUE = "stores_tenant_id_slug_key";

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

  /** See StoreRepository.create: id and created_at supplied by the caller, no RETURNING. */
  async create(store: Store): Promise<void> {
    try {
      await this.conn
        .insertInto("stores")
        .values({
          id: store.id,
          tenant_id: store.tenantId,
          name: store.name,
          slug: store.slug,
          status: store.status,
          created_at: store.createdAt.toISOString(),
          updated_at: store.createdAt.toISOString(),
        })
        .execute();
    } catch (err) {
      if (isUniqueViolation(err, TENANT_SLUG_UNIQUE)) {
        throw new StoreSlugTakenError(store.slug);
      }
      throw err;
    }
  }
}
