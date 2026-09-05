import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import "./idempotency.tables.js";

/**
 * **Phase 2 item 3's proof.** Item 2 established the infrastructure-item
 * pattern — migrations, table types, and the whole proof in one spec, with
 * nothing in `domain/`, `application/` or `interfaces/` until a consumer
 * exists. That pattern holds here, with one addition it did not need:
 *
 * **this is the first tenant-owned table Phase 2 creates**, so the proof gains
 * a section items 1 and 2 had no use for. Their tables were platform-global and
 * rode the conformance `TENANT_EXEMPT` list; this one carries `tenant_id`,
 * `ENABLE`/`FORCE ROW LEVEL SECURITY` and a policy, and none of that is worth
 * anything asserted. It is proved live, **as `nexora_app`** — `loadDbConfig()`
 * is that role. Session 9's finding is why that matters: a check run as the
 * schema owner passes for the wrong reason, because the owner bypasses plain
 * `ENABLE` and `FORCE` is what closes that.
 *
 * **Re-runnability**, per item 2's discipline. This table is mutable and
 * `nexora_app` holds `DELETE` on it — it is not a ledger and is deliberately
 * off §5's `REVOKE` list — so cleanup is possible and every fixture below
 * removes what it wrote. What is *also* required is that nothing collide on
 * `UNIQUE (tenant_id, capability, idempotency_key)` between runs: each test
 * mints a fresh tenant uuid and a fresh key, so two runs never contend even if
 * a previous one died before its cleanup.
 */
const db = createDb(loadDbConfig());

/** A tenant id that no `organizations` row has — legal here precisely because `tenant_id` is not a foreign key. */
function tenant(): string {
  return randomUUID();
}

function claim(tenantId: string, key = randomUUID()) {
  return {
    tenant_id: tenantId,
    capability: "plan.subscribe",
    idempotency_key: key,
    request_hash: "sha256:" + "0".repeat(64),
    status: "CLAIMED",
    actor_type: "user",
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the idempotency schema test. ${describeDbError(err)}`, {
      cause: err,
    });
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("idempotency_records — RLS, proved live as nexora_app", () => {
  it("returns zero rows with no tenant context, even though the row exists", async () => {
    const t = tenant();
    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(t)).execute();
    });

    // No context at all: `current_setting('app.tenant_id', true)` is '', which
    // matches no tenant_id, so the policy fails closed rather than erroring.
    const invisible = await db.selectFrom("idempotency_records").select("id").where("tenant_id", "=", t).execute();
    expect(invisible).toEqual([]);

    // And the row genuinely exists — otherwise the assertion above would pass
    // for the wrong reason, which is the failure mode this pair exists to close.
    const visible = await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("idempotency_records").select("id").where("tenant_id", "=", t).execute(),
    );
    expect(visible).toHaveLength(1);

    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.deleteFrom("idempotency_records").where("tenant_id", "=", t).execute();
    });
  });

  it("returns zero rows under a different tenant's context", async () => {
    const owner = tenant();
    const stranger = tenant();

    await withTenantContext(db, { tenantId: owner, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(owner)).execute();
    });

    const seen = await withTenantContext(db, { tenantId: stranger, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("idempotency_records").selectAll().where("tenant_id", "=", owner).execute(),
    );
    expect(seen).toEqual([]);

    await withTenantContext(db, { tenantId: owner, userId: null, storeId: null }, async (trx) => {
      await trx.deleteFrom("idempotency_records").where("tenant_id", "=", owner).execute();
    });
  });

  it("refuses an INSERT that writes another tenant's id", async () => {
    const caller = tenant();
    const victim = tenant();

    const attempt = withTenantContext(db, { tenantId: caller, userId: null, storeId: null }, async (trx) =>
      trx.insertInto("idempotency_records").values(claim(victim)).execute(),
    );

    // FORCE ROW LEVEL SECURITY is what makes this fail for the schema owner
    // too; without it the policy is advisory for the table's owner.
    await expect(attempt).rejects.toThrow(/row-level security/i);
  });

  it("cannot update another tenant's row into visibility", async () => {
    const owner = tenant();
    const stranger = tenant();
    await withTenantContext(db, { tenantId: owner, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(owner)).execute();
    });

    const affected = await withTenantContext(db, { tenantId: stranger, userId: null, storeId: null }, async (trx) =>
      trx
        .updateTable("idempotency_records")
        .set({ status: "COMPLETED" })
        .where("tenant_id", "=", owner)
        .executeTakeFirst(),
    );
    // The row is invisible to this context, so the UPDATE matches nothing —
    // silently, which is the correct RLS behaviour and worth pinning.
    expect(Number(affected.numUpdatedRows)).toBe(0);

    await withTenantContext(db, { tenantId: owner, userId: null, storeId: null }, async (trx) => {
      const still = await trx
        .selectFrom("idempotency_records")
        .select("status")
        .where("tenant_id", "=", owner)
        .executeTakeFirstOrThrow();
      expect(still.status).toBe("CLAIMED");
      await trx.deleteFrom("idempotency_records").where("tenant_id", "=", owner).execute();
    });
  });

  it("has ENABLE, FORCE and exactly one policy, asserted against the live catalog", async () => {
    const rls = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'idempotency_records'::regclass
    `.execute(db);
    expect(rls.rows[0]?.relrowsecurity).toBe(true);
    expect(rls.rows[0]?.relforcerowsecurity).toBe(true);

    const policies = await sql<{ policyname: string }>`
      SELECT policyname FROM pg_policies WHERE tablename = 'idempotency_records'
    `.execute(db);
    expect(policies.rows.map((r) => r.policyname)).toEqual(["idempotency_records_tenant_isolation"]);
  });
});

describe("idempotency_records — ADR-009's identity and lifecycle", () => {
  it("rejects a duplicate (tenant, capability, key) — the mechanism ADR-009 relies on", async () => {
    const t = tenant();
    const key = randomUUID();

    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(t, key)).execute();
    });

    const attempt = withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) =>
      trx.insertInto("idempotency_records").values(claim(t, key)).execute(),
    );
    await expect(attempt).rejects.toThrow(/idempotency_records_tenant_capability_key_key/);

    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.deleteFrom("idempotency_records").where("tenant_id", "=", t).execute();
    });
  });

  it("allows the same key under a different tenant and under a different capability", async () => {
    const a = tenant();
    const b = tenant();
    const key = randomUUID();

    await withTenantContext(db, { tenantId: a, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(a, key)).execute();
      await trx
        .insertInto("idempotency_records")
        .values({ ...claim(a, key), capability: "plan.change" })
        .execute();
    });
    await withTenantContext(db, { tenantId: b, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(b, key)).execute();
    });

    for (const t of [a, b]) {
      await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
        await trx.deleteFrom("idempotency_records").where("tenant_id", "=", t).execute();
      });
    }
  });

  it("rejects a status outside ADR-009's lifecycle", async () => {
    const t = tenant();
    const attempt = withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("idempotency_records")
        .values({ ...claim(t), status: "PENDING" })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/idempotency_records_status_check/);
  });

  it("rejects an actor_type outside the TenantContext vocabulary", async () => {
    const t = tenant();
    const attempt = withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("idempotency_records")
        .values({ ...claim(t), actor_type: "robot" })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/idempotency_records_actor_type_check/);
  });

  it("rejects an expiry that is not after creation", async () => {
    const t = tenant();
    const attempt = withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("idempotency_records")
        .values({ ...claim(t), expires_at: "2000-01-01T00:00:00Z" })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/idempotency_records_expires_after_creation/);
  });

  it("stores a response snapshot as jsonb and reads it back unchanged", async () => {
    const t = tenant();
    const snapshot = { subscriptionId: randomUUID(), status: "TRIALING" };

    const read = await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx
        .insertInto("idempotency_records")
        .values({ ...claim(t), status: "COMPLETED", response_snapshot: JSON.stringify(snapshot) })
        .execute();
      return trx
        .selectFrom("idempotency_records")
        .select("response_snapshot")
        .where("tenant_id", "=", t)
        .executeTakeFirstOrThrow();
    });

    expect(read.response_snapshot).toEqual(snapshot);

    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.deleteFrom("idempotency_records").where("tenant_id", "=", t).execute();
    });
  });

  it("holds no version column — ADR-045 rules it out for this table by name", async () => {
    const { rows } = await sql<{ column_name: string }>`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'idempotency_records' AND table_schema = 'public'
    `.execute(db);
    const columns = rows.map((r) => r.column_name);

    expect(columns).not.toContain("version");
    // ADR-046: no soft-delete column in Phase 2 either.
    expect(columns).not.toContain("deleted_at");
    // ADR-009 names these six explicitly as the record's shape.
    for (const required of ["request_hash", "status", "response_snapshot", "created_at", "expires_at", "actor_type"]) {
      expect(columns).toContain(required);
    }
  });

  it("is deletable by nexora_app, which is what keeps it off ADR-041's partitioning list", async () => {
    const t = tenant();
    await withTenantContext(db, { tenantId: t, userId: null, storeId: null }, async (trx) => {
      await trx.insertInto("idempotency_records").values(claim(t)).execute();
      const deleted = await trx.deleteFrom("idempotency_records").where("tenant_id", "=", t).executeTakeFirst();
      expect(Number(deleted.numDeletedRows)).toBe(1);
    });
  });
});
