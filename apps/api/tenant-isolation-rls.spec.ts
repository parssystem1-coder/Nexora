import { describe, it, expect, afterAll } from "vitest";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { withTenantContext } from "../../platform/db/tenant-context.js";
import {
  seedUser,
  seedOrganization,
  seedMembership,
  seedStore,
  seedStoreMembership,
  grantRole,
} from "./test-support/seed.js";

/**
 * DECISION_LOG.md 2026-08-24, "tenant-isolation-rls.spec.ts: where the
 * mechanical cross-tenant suite lives" — the phase-gate review's second
 * finding: `modules/tenant/infrastructure/organizations-rls.spec.ts` proves
 * cross-tenant UPDATE denial for `organizations` alone, and nothing in the
 * suite would catch the same regression on the other five tenant-owned
 * tables. Rather than hand-writing five more copies of that file, this ONE
 * file enumerates every RLS-protected table LIVE from `pg_class`/`pg_policy`
 * (never a hand-maintained list) and proves cross-tenant read, write and
 * delete denial, as the real `nexora_app` role, for each one it finds. A
 * Phase 2 migration that adds a tenant-owned table with a missing or broken
 * policy fails this file automatically, without anyone remembering to extend
 * it by hand.
 *
 * Lives under `apps/api/`, not any one module, for the same reason
 * `test-support/seed.ts` does (its own doc comment: "legitimately needs to
 * touch every module's tables directly, which no single module's own code is
 * allowed to do"): the six tables this file touches are owned by three
 * different modules (`modules/tenant`, `modules/authorization`,
 * `modules/audit`), and the enumeration query itself has no natural module
 * owner — it reads `pg_class` across the whole schema, not one module's
 * slice of it. Placing this inside, say, `modules/audit` would need that
 * module to import `modules/tenant`'s and `modules/authorization`'s seed
 * helpers to build fixtures for tables it does not own, which is exactly
 * what `DEP-DIRECTION-CROSS-MODULE` forbids for real source code and what
 * `apps/` exists to do safely for tests.
 *
 * What this does NOT attempt: fully generic row fabrication for an unknown
 * future table. `information_schema` can list a table's NOT NULL columns
 * without a default, but not their CHECK constraints, foreign keys, or
 * business-meaningful values — a truly schema-blind row-builder would either
 * violate a constraint or insert nonsense. `SEED_ROW` below is a small,
 * explicit, per-table registry instead. The mechanical guarantee this file
 * gives up in exchange is narrower but still real and enforced: if
 * `enumerateTenantOwnedTables()` finds a table with no registered factory,
 * the table-specific test FAILS with a clear message naming it, rather than
 * being silently skipped — so forgetting to extend `SEED_ROW` for a new
 * tenant-owned table is caught exactly as loudly as a broken policy would
 * be, just with a different, immediately-actionable cause.
 */

const db = createDb(loadDbConfig());

afterAll(async () => {
  await db.destroy();
});

interface TenantOwnedTable {
  table: string;
  pkColumn: string;
}

/**
 * Live, not hand-maintained: any table with both `relrowsecurity` and
 * `relforcerowsecurity` true. This is exactly what `08_PHASE_1_BRIEF.md` §5
 * requires of every tenant-owned table and what the seven exempt tables
 * (`users`, `currencies`, `reserved_subdomains`, `sessions`, `credentials`,
 * `roles`/`permissions`/`role_permissions`) deliberately do not have.
 */
async function enumerateTenantOwnedTables(): Promise<TenantOwnedTable[]> {
  const tables = await sql<{ relname: string }>`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
    ORDER BY c.relname
  `.execute(db);

  const result: TenantOwnedTable[] = [];
  for (const { relname } of tables.rows) {
    const pk = await sql<{ column_name: string }>`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = ${relname} AND tc.constraint_type = 'PRIMARY KEY'
    `.execute(db);
    if (pk.rows.length !== 1) {
      throw new Error(
        `RLS probe cannot determine a single-column primary key for '${relname}' (found ${pk.rows.length}); this table needs a real PK before it can be probed.`,
      );
    }
    result.push({ table: relname, pkColumn: pk.rows[0]!.column_name });
  }
  return result;
}

interface Fixture {
  orgId: string;
  userId: string;
  membershipId: string;
  storeId: string;
}

async function buildFixture(label: string): Promise<Fixture> {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-${suffix}@example.test`);
  const orgId = await seedOrganization(db, `${label} Org`, `${label}-org-${suffix}`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  const storeId = await seedStore(db, orgId, `${label} Store`, `${label}-store-${suffix}`);
  return { orgId, userId, membershipId, storeId };
}

/** Inserts one valid row owned by `fixture`'s tenant and returns its primary key value. */
type SeedRow = (fixture: Fixture) => Promise<string>;

/**
 * One entry per table `enumerateTenantOwnedTables()` can find today. See the
 * file-level doc comment for why this is not fully generic, and what happens
 * if a future table has no entry here.
 */
const SEED_ROW: Record<string, SeedRow> = {
  organizations: async (f) => f.orgId,
  memberships: async (f) => f.membershipId,
  stores: async (f) => f.storeId,
  store_memberships: async (f) => {
    await seedStoreMembership(db, f.orgId, f.storeId, f.userId);
    const row = await withTenantContext(db, { tenantId: f.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("store_memberships")
        .select("id")
        .where("store_id", "=", f.storeId)
        .where("user_id", "=", f.userId)
        .executeTakeFirstOrThrow(),
    );
    return row.id;
  },
  membership_roles: async (f) => {
    await grantRole(db, f.orgId, f.membershipId, "member");
    const row = await withTenantContext(db, { tenantId: f.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("membership_roles")
        .select("id")
        .where("membership_id", "=", f.membershipId)
        .executeTakeFirstOrThrow(),
    );
    return row.id;
  },
  audit_events: async (f) => {
    const row = await withTenantContext(db, { tenantId: f.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("audit_events")
        .values({
          tenant_id: f.orgId,
          actor_type: "system",
          capability: "test.rls-probe",
          resource_type: "probe",
          resource_id: "probe",
          outcome: "SUCCESS",
          request_id: randomUUID(),
          correlation_id: randomUUID(),
        })
        .returning("id")
        .executeTakeFirstOrThrow(),
    );
    return row.id;
  },
};

/**
 * A column every table above always populates, safe to write back to itself
 * unchanged as a generic cross-tenant WRITE probe — deliberately not always
 * `created_at`: `store_memberships`/`membership_roles` have no `updated_at`,
 * and `audit_events` has neither, using `occurred_at` instead. Picking a
 * per-table column here is the one place this file is not fully
 * table-blind, for the same reason `SEED_ROW` isn't: there is no mechanical
 * way to discover "a column safe to no-op update" from the schema alone.
 */
const TOUCH_COLUMN: Record<string, string> = {
  organizations: "updated_at",
  memberships: "updated_at",
  stores: "updated_at",
  store_memberships: "created_at",
  membership_roles: "created_at",
  audit_events: "occurred_at",
};

interface Probe {
  threw: boolean;
  rowCount: bigint;
}

/** A cross-tenant attempt must not visibly succeed — either it affects zero rows (RLS) or it is refused outright (e.g. audit_events' append-only REVOKE). Which of the two is not asserted; that it never succeeds is. */
function deniedProbe(result: { rowCount: bigint }): boolean {
  return result.rowCount === 0n;
}

async function probeSelect(
  table: string,
  pkColumn: string,
  rowId: string,
  asTenantId: string,
  asUserId: string,
): Promise<Probe> {
  try {
    const result = await withTenantContext(db, { tenantId: asTenantId, userId: asUserId, storeId: null }, (trx) =>
      sql<
        Record<string, unknown>
      >`select ${sql.ref(pkColumn)} from ${sql.table(table)} where ${sql.ref(pkColumn)} = ${rowId}`.execute(trx),
    );
    return { threw: false, rowCount: BigInt(result.rows.length) };
  } catch {
    return { threw: true, rowCount: 0n };
  }
}

async function probeUpdate(
  table: string,
  pkColumn: string,
  rowId: string,
  asTenantId: string,
  asUserId: string,
): Promise<Probe> {
  const touchColumn = TOUCH_COLUMN[table]!;
  try {
    const result = await withTenantContext(db, { tenantId: asTenantId, userId: asUserId, storeId: null }, (trx) =>
      sql`update ${sql.table(table)} set ${sql.ref(touchColumn)} = ${sql.ref(touchColumn)} where ${sql.ref(pkColumn)} = ${rowId}`.execute(
        trx,
      ),
    );
    return { threw: false, rowCount: result.numAffectedRows ?? 0n };
  } catch {
    return { threw: true, rowCount: 0n };
  }
}

async function probeDelete(
  table: string,
  pkColumn: string,
  rowId: string,
  asTenantId: string,
  asUserId: string,
): Promise<Probe> {
  try {
    const result = await withTenantContext(db, { tenantId: asTenantId, userId: asUserId, storeId: null }, (trx) =>
      sql`delete from ${sql.table(table)} where ${sql.ref(pkColumn)} = ${rowId}`.execute(trx),
    );
    return { threw: false, rowCount: result.numAffectedRows ?? 0n };
  } catch {
    return { threw: true, rowCount: 0n };
  }
}

/**
 * A genuine top-level await, not inside any hook: the table list must be
 * known BEFORE `it.each` registers one test per table, and vitest's test
 * collection phase does not await an async `describe` callback. If Postgres
 * is unreachable, this throws while the file itself is loading, which
 * vitest reports as the whole file failing to collect - the same underlying
 * cause every other integration spec's `beforeAll` reports more gently, just
 * surfaced earlier because the table list is needed before any `it()` exists
 * to run a `beforeAll` inside.
 */
let tenantOwnedTables: TenantOwnedTable[];
try {
  tenantOwnedTables = await enumerateTenantOwnedTables();
} catch (err) {
  throw new Error(
    `Could not reach Postgres for the tenant-isolation RLS probe (or the live enumeration query itself failed). Run "docker compose up -d". ${describeDbError(err)}`,
    { cause: err },
  );
}

describe("tenant isolation: every RLS-protected table, enumerated live, denies cross-tenant read/write/delete", () => {
  it("the live enumeration finds exactly today's six tenant-owned tables - not a hand-maintained list, but not silently missing one either", () => {
    expect(tenantOwnedTables.map((t) => t.table)).toEqual([
      "audit_events",
      "membership_roles",
      "memberships",
      "organizations",
      "store_memberships",
      "stores",
    ]);
    expect(tenantOwnedTables.every((t) => t.pkColumn === "id")).toBe(true);
  });

  it("every table the enumeration finds has a registered seed factory - a table with none fails loudly instead of being silently skipped", () => {
    const missing = tenantOwnedTables.map((t) => t.table).filter((t) => !(t in SEED_ROW));
    expect(missing).toEqual([]);
  });

  it.each(tenantOwnedTables)(
    "$table: a caller in a DIFFERENT tenant cannot read, write or delete this table's row",
    async ({ table, pkColumn }) => {
      const seedRow = SEED_ROW[table];
      if (!seedRow) {
        expect.fail(
          `No SEED_ROW factory registered for tenant-owned table '${table}' - add one to apps/api/tenant-isolation-rls.spec.ts.`,
        );
        return;
      }

      const owner = await buildFixture(`iso-${table.slice(0, 8)}`);
      const rowId = await seedRow(owner);

      // A different tenant, and a user id that matches neither the row's
      // owner nor anyone real - the self-access OR clause R-003 introduces on
      // `memberships`/`store_memberships` must not accidentally validate this
      // probe.
      const otherOrgId = await seedOrganization(
        db,
        "RLS Probe Other Org",
        `rls-probe-other-${randomUUID().slice(0, 8)}`,
      );
      const unrelatedUserId = randomUUID();

      const [readResult, writeResult, deleteResult] = await Promise.all([
        probeSelect(table, pkColumn, rowId, otherOrgId, unrelatedUserId),
        probeUpdate(table, pkColumn, rowId, otherOrgId, unrelatedUserId),
        probeDelete(table, pkColumn, rowId, otherOrgId, unrelatedUserId),
      ]);

      expect(readResult.rowCount, `cross-tenant SELECT on '${table}' must return zero rows`).toBe(0n);
      expect(deniedProbe(writeResult), `cross-tenant UPDATE on '${table}' must not affect any row`).toBe(true);
      expect(deniedProbe(deleteResult), `cross-tenant DELETE on '${table}' must not affect any row`).toBe(true);

      // The row must still exist, unharmed, from its own tenant's context -
      // proves the probes above didn't succeed silently in some other way.
      const stillThere = await withTenantContext(
        db,
        { tenantId: owner.orgId, userId: owner.userId, storeId: null },
        (trx) =>
          sql<{
            n: string;
          }>`select count(*) as n from ${sql.table(table)} where ${sql.ref(pkColumn)} = ${rowId}`.execute(trx),
      );
      expect(stillThere.rows[0]?.n).toBe("1");
    },
  );
});
