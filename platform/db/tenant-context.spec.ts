import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { createDb } from "./kysely.js";
import { withTenantContext } from "./tenant-context.js";
import { assertRoleCannotBypassRls } from "./assert-role-safety.js";
import { loadDbConfig, loadMigrateDbConfig } from "../config.js";
import { describeDbError } from "./describe-error.js";

/**
 * Proves the one transaction/RLS helper (see the singleton-role marker
 * comment atop ./tenant-context.ts) actually works against a real
 * PostgreSQL: scopes reads to the given tenant, fails closed with no tenant
 * context, and — critically — does not leak `app.tenant_id` across
 * pooled-connection reuse between calls, since `set_config(..., true)`
 * (LOCAL) resets at transaction end regardless of commit/rollback.
 *
 * Schema DDL runs as the migrate role (nexora_migrate, the table owner);
 * every query that's supposed to prove isolation runs as the app role
 * (nexora_app) via withTenantContext(), and the app connection asserts it
 * cannot bypass RLS before any assertion relies on that — otherwise these
 * tests could pass for the wrong reason (the connected role simply sees
 * everything) rather than because RLS actually enforced isolation. See
 * DECISION_LOG.md "RLS: FORCE ROW LEVEL SECURITY or a non-owner app role".
 */

const TABLE = "tenant_context_selftest";
const migrateDb = createDb(loadMigrateDbConfig());
const appDb = createDb(loadDbConfig());

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const asTenant = (tenantId: string | null) => ({ tenantId, userId: null, storeId: null });

beforeAll(async () => {
  try {
    await sql`select 1`.execute(migrateDb);
    await sql`select 1`.execute(appDb);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the tenant-context self-test (migrate or app role). ` +
        `Run "docker compose up -d" or point DATABASE_URL/MIGRATE_DATABASE_URL at a running Postgres. ` +
        `Original error: ${describeDbError(err)}`,
      { cause: err },
    );
  }

  await sql`DROP TABLE IF EXISTS ${sql.raw(TABLE)}`.execute(migrateDb);
  await sql`
    CREATE TABLE ${sql.raw(TABLE)} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      label text NOT NULL
    )
  `.execute(migrateDb);
  await sql`ALTER TABLE ${sql.raw(TABLE)} ENABLE ROW LEVEL SECURITY`.execute(migrateDb);
  await sql`ALTER TABLE ${sql.raw(TABLE)} FORCE ROW LEVEL SECURITY`.execute(migrateDb);
  await sql`
    CREATE POLICY tenant_context_selftest_isolation ON ${sql.raw(TABLE)}
    USING (tenant_id::text = current_setting('app.tenant_id', true))
  `.execute(migrateDb);

  // Hard requirement, not a nice-to-have: if this fails, every other test in
  // this file would be proving nothing.
  await assertRoleCannotBypassRls(appDb, TABLE);

  await withTenantContext(appDb, asTenant(TENANT_A), (trx) =>
    sql`INSERT INTO ${sql.raw(TABLE)} (tenant_id, label) VALUES (${TENANT_A}::uuid, 'a-row')`.execute(trx),
  );
  await withTenantContext(appDb, asTenant(TENANT_B), (trx) =>
    sql`INSERT INTO ${sql.raw(TABLE)} (tenant_id, label) VALUES (${TENANT_B}::uuid, 'b-row')`.execute(trx),
  );
});

afterAll(async () => {
  await sql`DROP TABLE IF EXISTS ${sql.raw(TABLE)}`.execute(migrateDb);
  await migrateDb.destroy();
  await appDb.destroy();
});

describe("the app role cannot bypass RLS (precondition for every test below)", () => {
  it("is not a superuser, does not have BYPASSRLS, and does not own the table", async () => {
    await expect(assertRoleCannotBypassRls(appDb, TABLE)).resolves.toBeUndefined();
  });
});

describe("withTenantContext (the one transaction/RLS helper)", () => {
  it("scopes reads to the given tenant", async () => {
    const result = await withTenantContext(appDb, asTenant(TENANT_A), (trx) =>
      sql<{ label: string }>`SELECT label FROM ${sql.raw(TABLE)}`.execute(trx),
    );
    expect(result.rows.map((r) => r.label)).toEqual(["a-row"]);
  });

  it("fails closed: no tenant context returns zero rows, not another tenant's data", async () => {
    const result = await withTenantContext(appDb, asTenant(null), (trx) =>
      sql<{ label: string }>`SELECT label FROM ${sql.raw(TABLE)}`.execute(trx),
    );
    expect(result.rows).toEqual([]);
  });

  it("does not leak tenant context across pooled-connection reuse between calls", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await withTenantContext(appDb, asTenant(TENANT_B), (trx) =>
        sql<{ label: string }>`SELECT label FROM ${sql.raw(TABLE)}`.execute(trx),
      );
      expect(result.rows.map((r) => r.label)).toEqual(["b-row"]);
    }
  });

  it("rolls back the transaction (and therefore the tenant context) if fn throws", async () => {
    await expect(
      withTenantContext(appDb, asTenant(TENANT_A), async (trx) => {
        await sql`INSERT INTO ${sql.raw(TABLE)} (tenant_id, label) VALUES (${TENANT_A}::uuid, 'should-not-persist')`.execute(
          trx,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await withTenantContext(appDb, asTenant(TENANT_A), (trx) =>
      sql<{ label: string }>`SELECT label FROM ${sql.raw(TABLE)}`.execute(trx),
    );
    expect(result.rows.map((r) => r.label)).toEqual(["a-row"]);
  });
});
