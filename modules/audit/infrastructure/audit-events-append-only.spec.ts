import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { AuditEvent } from "../contracts/index.js";
import { recordAuditEventDurable } from "../contracts/index.js";
import "./audit.tables.js";

/**
 * Item 6 repair: 04_DATABASE_BLUEPRINT.md §1 requires audit and ledger
 * records to be append-only. Nothing in the database enforced this — the
 * app role (nexora_app) held UPDATE and DELETE on audit_events the same as
 * any other table. modules/audit/migrations/
 * 20260822100100_audit__enforce_append_only.sql revokes both; this proves
 * the app role is actually rejected, not merely that application code
 * happens not to call update/delete.
 */

const db = createDb(loadDbConfig());
const TENANT = "11111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the audit append-only test. Run "docker compose up -d". ${describeDbError(err)}`);
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("audit_events is append-only for the app role", () => {
  it("rejects an UPDATE from nexora_app with a permission-denied error", async () => {
    await recordAuditEventDurable(
      db,
      { tenantId: TENANT, userId: null, storeId: null },
      new AuditEvent(TENANT, null, "system", "test.append-only-update", "probe", "probe-1", "SUCCESS", "req-1", "corr-1"),
    );

    await expect(
      withTenantContext(db, { tenantId: TENANT, userId: null, storeId: null }, (trx) =>
        trx.updateTable("audit_events").set({ outcome: "FAILURE" }).where("resource_id", "=", "probe-1").execute(),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("rejects a DELETE from nexora_app with a permission-denied error", async () => {
    await recordAuditEventDurable(
      db,
      { tenantId: TENANT, userId: null, storeId: null },
      new AuditEvent(TENANT, null, "system", "test.append-only-delete", "probe", "probe-2", "SUCCESS", "req-2", "corr-2"),
    );

    await expect(
      withTenantContext(db, { tenantId: TENANT, userId: null, storeId: null }, (trx) =>
        trx.deleteFrom("audit_events").where("resource_id", "=", "probe-2").execute(),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("still allows INSERT and SELECT (regression check)", async () => {
    await recordAuditEventDurable(
      db,
      { tenantId: TENANT, userId: null, storeId: null },
      new AuditEvent(TENANT, null, "system", "test.append-only-insert", "probe", "probe-3", "SUCCESS", "req-3", "corr-3"),
    );

    const row = await withTenantContext(db, { tenantId: TENANT, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("audit_events").select("outcome").where("resource_id", "=", "probe-3").executeTakeFirst(),
    );
    expect(row?.outcome).toBe("SUCCESS");
  });
});
