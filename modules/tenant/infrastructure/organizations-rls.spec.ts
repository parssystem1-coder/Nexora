import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import "./tenant.tables.js";

/**
 * Item 5 repair: organizations' RLS policy used a single WITH CHECK (true)
 * that applied to both INSERT and UPDATE. INSERT needs that — a brand-new
 * organization has no pre-existing tenant_id to check against — but it made
 * UPDATE's WITH CHECK a no-op: any row visible via USING could be updated
 * with zero additional validation. modules/tenant/migrations/
 * 20260822100000_tenant__split_organizations_rls_policies.sql splits this
 * into per-command policies; this proves the split behaves correctly, not
 * just that it parses.
 */

const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the organizations RLS test. Run "docker compose up -d". ${describeDbError(err)}`,
    );
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("organizations RLS: split INSERT/SELECT/UPDATE/DELETE policies", () => {
  it("has a real WITH CHECK for UPDATE, not the unconditional true INSERT relies on", async () => {
    const rows = await sql<{ polcmd: string; check_expr: string | null }>`
      SELECT polcmd, pg_get_expr(polwithcheck, polrelid) AS check_expr
      FROM pg_policy
      WHERE polrelid = 'organizations'::regclass
    `.execute(db);

    const byCmd = new Map(rows.rows.map((r) => [r.polcmd, r.check_expr]));
    expect(byCmd.get("a")).toBe("true"); // INSERT
    expect(byCmd.get("w")).not.toBe("true"); // UPDATE — must be a real predicate now
    expect(byCmd.get("w")).toContain("tenant_id");
  });

  it("still allows creating a new organization with no pre-existing tenant context (regression check)", async () => {
    const id = randomUUID();
    await db
      .insertInto("organizations")
      .values({ id, name: "RLS Regression Org", slug: `rls-regress-${id}`, status: "ACTIVE" })
      .execute();

    const row = await db.selectFrom("organizations").select("id").where("id", "=", id).executeTakeFirst();
    // Reading it back with no context set is expected to return nothing (RLS on SELECT) —
    // this only confirms the INSERT itself did not error.
    expect(row).toBeUndefined();
  });

  it("does not let a cross-tenant UPDATE affect another organization's row", async () => {
    const orgAId = randomUUID();
    const orgBId = randomUUID();
    await db
      .insertInto("organizations")
      .values({ id: orgAId, name: "Org A", slug: `org-a-${orgAId}`, status: "ACTIVE" })
      .execute();
    await db
      .insertInto("organizations")
      .values({ id: orgBId, name: "Org B", slug: `org-b-${orgBId}`, status: "ACTIVE" })
      .execute();

    // Attempt to rename org A while scoped to org B's tenant context.
    await withTenantContext(db, { tenantId: orgBId, userId: null, storeId: null }, (trx) =>
      trx.updateTable("organizations").set({ name: "Hijacked" }).where("id", "=", orgAId).execute(),
    );

    const nameFromOwnTenant = await withTenantContext(db, { tenantId: orgAId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("organizations").select("name").where("id", "=", orgAId).executeTakeFirst(),
    );
    expect(nameFromOwnTenant?.name).toBe("Org A");
  });

  it("allows a same-tenant UPDATE to persist", async () => {
    const orgId = randomUUID();
    await db
      .insertInto("organizations")
      .values({ id: orgId, name: "Before", slug: `same-tenant-${orgId}`, status: "ACTIVE" })
      .execute();

    await withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, (trx) =>
      trx.updateTable("organizations").set({ name: "After" }).where("id", "=", orgId).execute(),
    );

    const row = await withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("organizations").select("name").where("id", "=", orgId).executeTakeFirst(),
    );
    expect(row?.name).toBe("After");
  });
});
