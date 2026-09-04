import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { randomUUID } from "node:crypto";
import type { Database } from "./kysely.js";
import { createDb } from "./kysely.js";
import { withTenantContext } from "./tenant-context.js";
import { loadDbConfig, loadMigrateDbConfig } from "../config.js";
import { describeDbError } from "./describe-error.js";

/**
 * ADR-039's ruling, part A2: **the tenant context is transaction-scoped, and no
 * connection is ever returned to the pool still carrying one.**
 *
 * ## Why this test exists rather than a comment
 *
 * Every RLS policy in this platform reads `current_setting('app.tenant_id',
 * true)`. If that setting outlived its transaction, a pooled connection would
 * return to the pool still carrying it, and the next checkout — possibly for a
 * different tenant, possibly for no tenant at all — would inherit it. That is a
 * cross-tenant read reached through the pool rather than through a policy, and
 * **every other isolation test in this repository is blind to it**, because all
 * of them set a context before they query.
 *
 * `withTenantContext` passes `is_local => true` to `set_config`, which makes the
 * setting transaction-scoped and correct. **This test is the regression guard
 * for that third argument.** Flipping it to `false`, or switching to `SET` from
 * `SET LOCAL`, is a change no type checker and no other test here would catch —
 * verified 2026-09-03 by making exactly that edit and watching this file go red
 * at the leftover-setting assertion, then reverting it.
 *
 * ## How connection reuse is made real rather than hoped for
 *
 * The hazard only exists on a *reused* connection, so the test is worthless
 * unless the second query runs on the first query's backend. **`pg_backend_pid()`
 * is compared across the two checkouts and the test FAILS if they differ**,
 * rather than passing vacuously on a fresh connection. A single-threaded
 * sequence of queries against an idle pool reuses the same client in practice;
 * if that ever stops being true, this fails loudly and is fixed rather than
 * silently ceasing to test anything.
 *
 * It deliberately does not construct its own `pg.Pool` to pin `max: 1`, which
 * would be the more direct way to force reuse: `DB-ACCESS-RAW-PG-IMPORT`
 * confines `pg` to three platform files, and reaching for an exception to make
 * a test convenient is exactly what `CLAUDE.md`'s standing rule forbids.
 */
let db: Kysely<Database>;
let seedDb: Kysely<Database>;
const tenantId = randomUUID();

beforeAll(async () => {
  db = createDb(loadDbConfig());
  seedDb = createDb(loadMigrateDbConfig());

  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the pool-reuse test. Original error: ${describeDbError(err)}`, {
      cause: err,
    });
  }

  // A row that IS visible under the right tenant context, so the zero-row
  // assertion below proves RLS refusing rather than an empty table.
  await sql`insert into organizations (id, name, slug) values (${tenantId}, ${"pool-reuse probe"}, ${`pool-reuse-${tenantId.slice(0, 8)}`})`.execute(
    seedDb,
  );
}, 60_000);

afterAll(async () => {
  await sql`delete from organizations where id = ${tenantId}`.execute(seedDb).catch(() => undefined);
  await db.destroy();
  await seedDb.destroy();
});

async function backendPid(conn: Kysely<Database>): Promise<number> {
  const { rows } = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(conn);
  return Number(rows[0]?.pid);
}

describe("tenant context does not survive a pooled connection's return (ADR-039 A2)", () => {
  it("leaves no app.tenant_id behind, and the reused connection sees zero rows in a tenant-owned table", async () => {
    // 1. A real transaction under a real tenant context.
    const { pid: pidInside, visible } = await withTenantContext(
      db,
      { tenantId, userId: null, storeId: null },
      async (trx) => {
        // Control: the context IS set while the transaction is open. Without
        // this the test could pass against a helper that never set anything.
        const settingInside = await sql<{ v: string }>`select current_setting('app.tenant_id', true) as v`.execute(trx);
        expect(settingInside.rows[0]?.v).toBe(tenantId);

        const rows = await sql<{ n: string }>`select count(*)::text as n from organizations`.execute(trx);
        return { pid: await backendPid(trx), visible: Number(rows.rows[0]?.n) };
      },
    );

    expect(visible).toBeGreaterThan(0);

    // 2. Acquire again, and prove it is the same backend rather than assuming it.
    const pidAfter = await backendPid(db);
    expect(pidAfter).toBe(pidInside);

    // 3. The setting is gone. `set_config(..., is_local => true)` reverts at
    //    COMMIT; a session-scoped `SET` would leave the tenant id sitting here.
    const after = await sql<{ v: string | null }>`select current_setting('app.tenant_id', true) as v`.execute(db);
    const leftBehind = after.rows[0]?.v;
    expect(leftBehind === null || leftBehind === "").toBe(true);

    // 4. The property that actually matters: RLS fails closed on the recycled
    //    connection. The row seeded above is real and was visible in step 1.
    const leaked = await sql<{ n: string }>`select count(*)::text as n from organizations`.execute(db);
    expect(Number(leaked.rows[0]?.n)).toBe(0);
  });

  it("does not leak one tenant's context into the next transaction on the same connection", async () => {
    const other = randomUUID();

    const first = await withTenantContext(db, { tenantId, userId: null, storeId: null }, (trx) => backendPid(trx));

    // A second transaction for a DIFFERENT tenant must see its own context and
    // none of the previous one's.
    await withTenantContext(db, { tenantId: other, userId: null, storeId: null }, async (trx) => {
      expect(await backendPid(trx)).toBe(first);

      const seen = await sql<{ v: string }>`select current_setting('app.tenant_id', true) as v`.execute(trx);
      expect(seen.rows[0]?.v).toBe(other);

      // `other` owns nothing, so the row seeded for `tenantId` must not appear.
      const rows = await sql<{ n: string }>`select count(*)::text as n from organizations`.execute(trx);
      expect(Number(rows.rows[0]?.n)).toBe(0);
    });
  });
});
