import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { createTestApp } from "./test-support/create-test-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { withTenantContext } from "../../platform/db/tenant-context.js";
import { PLATFORM_TENANT_ID } from "../../modules/audit/contracts/index.js";
import { seedUser, seedSession } from "./test-support/seed.js";
import "../../modules/billing/infrastructure/billing.tables.js";

/**
 * Phase 2 item 1's proof, through the real HTTP surface against real
 * PostgreSQL. What this covers that no Phase 1 test could:
 *
 *  - a **collection** response, and therefore ADR-036's pagination contract,
 *    which `AGENTS.md` §2 makes the platform contract by construction;
 *  - the first tables with **no `tenant_id` and no RLS policy**, read by a
 *    capability whose guard chain cannot narrow the result set;
 *  - ADR-052's trial columns reaching a client.
 */
let app: INestApplication;
const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the plan.list integration test. Original error: ${describeDbError(err)}`,
      { cause: err },
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

async function authenticated(): Promise<string> {
  const userId = await seedUser(db, `plan-list-${randomUUID().slice(0, 8)}@example.test`);
  return seedSession(db, userId);
}

describe("GET /api/v1/plans", () => {
  it("returns the seeded catalogue in ADR-036's shape, with nextCursor null at its natural bound", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("nextCursor", null);
    expect(Array.isArray(res.body.items)).toBe(true);
    // ADR-036 item 3: no total count.
    expect(res.body).not.toHaveProperty("total");
  });

  it("carries ADR-044's machine keys and no display text", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    const keys = (res.body.items as { key: string }[]).map((i) => i.key);
    expect(keys).toContain("trial");
    expect(keys).toContain("standard");
    for (const item of res.body.items as Record<string, unknown>[]) {
      // ADR-044 item 1: no name, label, title, description or locale map.
      expect(item).not.toHaveProperty("name");
      expect(item).not.toHaveProperty("label");
      expect(item).not.toHaveProperty("title");
      expect(item).not.toHaveProperty("description");
    }
  });

  it("carries no money: prices are item 2 and must not cross this slice", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    const serialized = JSON.stringify(res.body);
    for (const forbidden of ["amount", "currency", "minorUnits", "price"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("expresses ADR-052's 14-day trial, and 'offers no trial' as 0 rather than a special case", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    const items = res.body.items as { key: string; trialPeriodDays: number }[];
    expect(items.find((i) => i.key === "trial")?.trialPeriodDays).toBe(14);
    expect(items.find((i) => i.key === "standard")?.trialPeriodDays).toBe(0);
  });

  it("seeds ruling ب-8's mark as a grant on the paid plan and not on the trial", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    const items = res.body.items as { key: string; featureKeys: string[] }[];
    const standard = items.find((i) => i.key === "standard");
    const trial = items.find((i) => i.key === "trial");
    expect(standard?.featureKeys).toContain("storefront.attribution_free");
    expect(trial?.featureKeys).not.toContain("storefront.attribution_free");
    // پ-3: every gateway is free on every plan, so both grant this one.
    expect(standard?.featureKeys).toContain("billing.all_payment_gateways");
    expect(trial?.featureKeys).toContain("billing.all_payment_gateways");
  });

  it("embeds no brand name anywhere in the catalogue it serves", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    // The platform's commercial name is not chosen. Nothing in this slice may
    // embed one, so the response carries capability keys only.
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("nexora");
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("powered_by");
  });

  it("pages through the whole collection with no duplicated and no skipped row", async () => {
    const token = await authenticated();

    const seen: string[] = [];
    let cursor: string | null | undefined;
    for (let guard = 0; guard < 10; guard += 1) {
      const url = cursor ? `/api/v1/plans?limit=1&cursor=${encodeURIComponent(cursor)}` : "/api/v1/plans?limit=1";
      const res = await request(app.getHttpServer()).get(url).set("Cookie", `sid=${token}`);
      expect(res.status).toBe(200);
      expect((res.body.items as unknown[]).length).toBeLessThanOrEqual(1);
      seen.push(...(res.body.items as { key: string }[]).map((i) => i.key));
      cursor = res.body.nextCursor as string | null;
      if (!cursor) break;
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain("trial");
    expect(seen).toContain("standard");
    // A total order: the same sequence, ascending, every time.
    expect([...seen].sort()).toEqual(seen);
  });

  it("rejects a malformed cursor with VALIDATION_ERROR (ADR-036 item 8)", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer())
      .get("/api/v1/plans?cursor=%21%21%21not-a-cursor")
      .set("Cookie", `sid=${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a limit above the declared maximum", async () => {
    const token = await authenticated();

    const res = await request(app.getHttpServer()).get("/api/v1/plans?limit=101").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("requires a session", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/plans");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("writes one audit event under ADR-035's platform sentinel, since there is no tenant", async () => {
    const token = await authenticated();

    await request(app.getHttpServer()).get("/api/v1/plans").set("Cookie", `sid=${token}`);

    const rows = await withTenantContext(
      db,
      { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null },
      async (trx) =>
        trx
          .selectFrom("audit_events")
          .select(["capability", "outcome", "resource_type", "tenant_id"])
          .where("capability", "=", "plan.list")
          .orderBy("occurred_at", "desc")
          .limit(1)
          .execute(),
    );

    expect(rows[0]?.outcome).toBe("SUCCESS");
    expect(rows[0]?.resource_type).toBe("plan_catalogue");
    expect(rows[0]?.tenant_id).toBe(PLATFORM_TENANT_ID);
  });

  it("audits a failed attempt too, with outcome FAILURE", async () => {
    const token = await authenticated();

    await request(app.getHttpServer()).get("/api/v1/plans?limit=999").set("Cookie", `sid=${token}`);

    const rows = await withTenantContext(
      db,
      { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null },
      async (trx) =>
        trx
          .selectFrom("audit_events")
          .select(["outcome"])
          .where("capability", "=", "plan.list")
          .orderBy("occurred_at", "desc")
          .limit(1)
          .execute(),
    );

    expect(rows[0]?.outcome).toBe("FAILURE");
  });

  it("serves no plan version whose effective_from is still in the future", async () => {
    const token = await authenticated();
    const planId = randomUUID();
    const versionId = randomUUID();
    const key = `future_${randomUUID().slice(0, 8).replace(/-/g, "")}`;

    await db.insertInto("plans").values({ id: planId, key }).execute();
    await db
      .insertInto("plan_versions")
      .values({
        id: versionId,
        plan_id: planId,
        version: 1,
        trial_period_days: 0,
        effective_from: "2999-01-01T00:00:00Z",
      })
      .execute();

    try {
      const res = await request(app.getHttpServer()).get("/api/v1/plans?limit=100").set("Cookie", `sid=${token}`);
      expect((res.body.items as { key: string }[]).map((i) => i.key)).not.toContain(key);
    } finally {
      await db.deleteFrom("plan_versions").where("id", "=", versionId).execute();
      await db.deleteFrom("plans").where("id", "=", planId).execute();
    }
  });
});
