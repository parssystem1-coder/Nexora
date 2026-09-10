import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import "../infrastructure/tenant.tables.js";

/**
 * **The counter shape item 7 handed to item 8.**
 *
 * `PHASE_2_BRIEF.md` §5 permits exactly one way for another module to learn a
 * count and forbids the other: *"No cross-module foreign keys; **cross-module
 * reads go through contracts** (`04` §1)."* `npm run check:fk` enforces the
 * prohibition; this is the permitted half.
 *
 * **The module that owns a resource is the module that can count it**, which is
 * why this lives here rather than in `modules/entitlement`. Both of ruling ب-4's
 * countable resources are this module's: `memberships` and `stores` are created
 * by `20260822090300_tenant__create_memberships.sql` and
 * `20260822090400_tenant__create_stores.sql`. **`domains` is not** — it has no
 * table until Phase 4, which is why `RESOURCE_OWNING_MODULE` records `null` for
 * it and why item 8 reports it as not evaluable rather than counting zero.
 *
 * It returns numbers, not entities, for the reason item 4 gave when it placed
 * the serving-state function: a caller needs the answer, not the aggregate, and
 * a signature taking or returning a domain type would drag it across the
 * boundary.
 *
 * **Every count runs under the caller's tenant context**, so RLS is what scopes
 * it — the `WHERE tenant_id` below is a second, redundant fence rather than the
 * only one, and both are deliberate.
 */
export interface TenantResourceCounter {
  /**
   * Seats in use.
   *
   * **`ACTIVE` only, and ADR-026 item 7 is why:** *"Exceeding a member limit
   * must not lock out existing members … Existing memberships remain active;
   * new invitations are blocked."* A revoked membership holds no seat, so
   * counting it would keep a tenant over their limit after they had already
   * resolved it — and ADR-026 item 5 says the tenant resolves it by reducing
   * their own usage, which revoking is.
   */
  countActiveMembers(tenantId: string): Promise<number>;

  /**
   * Stores in existence.
   *
   * **Every row, not only the serving ones**, and ADR-026 item 8 is why:
   * *"Exceeding a store limit must never take a store offline. Existing stores
   * keep serving; creating a new store is blocked."* A suspended store still
   * occupies its slot — it has not been given up — so excluding it would let a
   * tenant hold more stores than their plan permits by suspending one.
   */
  countStores(tenantId: string): Promise<number>;
}

export function createTenantResourceCounter(conn: Kysely<Database> | Transaction<Database>): TenantResourceCounter {
  return {
    async countActiveMembers(tenantId: string): Promise<number> {
      const row = await conn
        .selectFrom("memberships")
        .select(sql<string>`count(*)`.as("n"))
        .where("tenant_id", "=", tenantId)
        .where("status", "=", "ACTIVE")
        .executeTakeFirstOrThrow();
      return Number(row.n);
    },

    async countStores(tenantId: string): Promise<number> {
      const row = await conn
        .selectFrom("stores")
        .select(sql<string>`count(*)`.as("n"))
        .where("tenant_id", "=", tenantId)
        .executeTakeFirstOrThrow();
      return Number(row.n);
    },
  };
}
