import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { createDb } from "./kysely.js";
import { withTenantContext } from "./tenant-context.js";
import { loadConformanceTestDbConfig } from "../config.js";
import { describeDbError } from "./describe-error.js";

/**
 * Proves the one transaction/RLS helper (see the singleton-role marker
 * comment atop ./tenant-context.ts) actually works against a real
 * PostgreSQL: scopes reads to the given
 * tenant, fails closed with no tenant context, and — critically — does not
 * leak `app.tenant_id` across pooled-connection reuse between calls, since
 * `set_config(..., true)` (LOCAL) resets at transaction end regardless of
 * commit/rollback.
 *
 * The scratch table uses FORCE ROW LEVEL SECURITY. Without it, the owning
 * role (which this Phase-0 scaffold uses for both migrations and app
 * queries) bypasses RLS entirely by default — verified empirically this
 * session. See DECISION_LOG.md "RLS: FORCE ROW LEVEL SECURITY or a
 * non-owner app role" for the open question this leaves for Task 1.
 */

const db = createDb(loadConformanceTestDbConfig());

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the tenant-context self-test. ` +
        `Run "docker compose up -d" or point CONFORMANCE_TEST_DATABASE_URL at a running Postgres. ` +
        `Original error: ${describeDbError(err)}`,
    );
  }

  await sql`DROP TABLE IF EXISTS tenant_context_selftest`.execute(db);
  await sql`
    CREATE TABLE tenant_context_selftest (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      label text NOT NULL
    )
  `.execute(db);
  await sql`ALTER TABLE tenant_context_selftest ENABLE ROW LEVEL SECURITY`.execute(db);
  await sql`ALTER TABLE tenant_context_selftest FORCE ROW LEVEL SECURITY`.execute(db);
  await sql`
    CREATE POLICY tenant_context_selftest_isolation ON tenant_context_selftest
    USING (tenant_id::text = current_setting('app.tenant_id', true))
  `.execute(db);

  await withTenantContext(db, TENANT_A, (trx) =>
    sql`INSERT INTO tenant_context_selftest (tenant_id, label) VALUES (${TENANT_A}::uuid, 'a-row')`.execute(trx),
  );
  await withTenantContext(db, TENANT_B, (trx) =>
    sql`INSERT INTO tenant_context_selftest (tenant_id, label) VALUES (${TENANT_B}::uuid, 'b-row')`.execute(trx),
  );
});

afterAll(async () => {
  await sql`DROP TABLE IF EXISTS tenant_context_selftest`.execute(db);
  await db.destroy();
});

describe("withTenantContext (the one transaction/RLS helper)", () => {
  it("scopes reads to the given tenant", async () => {
    const result = await withTenantContext(db, TENANT_A, (trx) =>
      sql<{ label: string }>`SELECT label FROM tenant_context_selftest`.execute(trx),
    );
    expect(result.rows.map((r) => r.label)).toEqual(["a-row"]);
  });

  it("fails closed: no tenant context returns zero rows, not another tenant's data", async () => {
    const result = await withTenantContext(db, null, (trx) =>
      sql<{ label: string }>`SELECT label FROM tenant_context_selftest`.execute(trx),
    );
    expect(result.rows).toEqual([]);
  });

  it("does not leak tenant context across pooled-connection reuse between calls", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await withTenantContext(db, TENANT_B, (trx) =>
        sql<{ label: string }>`SELECT label FROM tenant_context_selftest`.execute(trx),
      );
      expect(result.rows.map((r) => r.label)).toEqual(["b-row"]);
    }
  });

  it("rolls back the transaction (and therefore the tenant context) if fn throws", async () => {
    await expect(
      withTenantContext(db, TENANT_A, async (trx) => {
        await sql`INSERT INTO tenant_context_selftest (tenant_id, label) VALUES (${TENANT_A}::uuid, 'should-not-persist')`.execute(
          trx,
        );
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await withTenantContext(db, TENANT_A, (trx) =>
      sql<{ label: string }>`SELECT label FROM tenant_context_selftest`.execute(trx),
    );
    expect(result.rows.map((r) => r.label)).toEqual(["a-row"]);
  });
});
