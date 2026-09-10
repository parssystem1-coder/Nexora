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
import { seedUser, seedSession, seedOrganization, seedMembership, seedStore, grantRole } from "./test-support/seed.js";
import "../../modules/entitlement/infrastructure/entitlement.tables.js";

/**
 * Phase 2 item 8's proof.
 *
 * The property that matters most is the one item 7 handed over: **`domains` is
 * reported as not evaluable, never as a count of zero.** Nothing writes
 * `tenant_over_limit_states` in Phase 2, so a read path that trusted the table
 * would report "not over limit" for every tenant and look correct — which is
 * why this suite drives real counts through the HTTP surface.
 */
let app: INestApplication;
const db = createDb(loadDbConfig());

const STANDARD_PLAN_VERSION = "1a2b3c4d-0000-4000-8000-000000000002";

async function tenantFixture(label: string, role = "owner") {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-${suffix}@example.test`);
  const orgId = await seedOrganization(db, `${label} Org`, `${label}-${suffix}`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  await grantRole(db, orgId, membershipId, role);
  const token = await seedSession(db, userId, { activeOrganizationId: orgId });
  return { userId, orgId, membershipId, token };
}

function subscribe(orgId: string, token: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgId}/subscription`)
    .set("Cookie", `sid=${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ planVersionId: STANDARD_PLAN_VERSION, termMonths: 12 });
}

function readOverLimit(orgId: string, token: string) {
  return request(app.getHttpServer()).get(`/api/v1/organizations/${orgId}/over-limit`).set("Cookie", `sid=${token}`);
}

type ResourceReport = {
  resource: string;
  state: string;
  currentCount: number | null;
  limit: number | null;
  reason: string | null;
  blockedOperations: string[];
  resolution: string[];
  enteredAt: string | null;
};

function byResource(body: { resources: ResourceReport[] }): Record<string, ResourceReport> {
  return Object.fromEntries(body.resources.map((r) => [r.resource, r]));
}

/** Lowers a tenant's store limit below their count, which is ADR-026's own entry cause: a downgrade. */
async function lowerStoreLimit(tenantId: string, to: number): Promise<void> {
  await withTenantContext(db, { tenantId, userId: null, storeId: null }, async (trx) => {
    const result = await trx
      .insertInto("tenant_quota_overrides")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        resource: "stores",
        override_type: "ABSOLUTE",
        limit_value: to,
      })
      .executeTakeFirst();
    // `AGENTS.md` §8: a statement that must change rows asserts how many.
    if ((result.numInsertedOrUpdatedRows ?? 0n) !== 1n) {
      throw new Error(`lowerStoreLimit inserted ${result.numInsertedOrUpdatedRows} rows`);
    }
  });
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the over-limit integration test. ${describeDbError(err)}`, {
      cause: err,
    });
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("GET /api/v1/organizations/:organizationId/over-limit", () => {
  it("reports every resource in ruling ب-4's closed list, and nothing else", async () => {
    const tenant = await tenantFixture("ol-shape");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);

    expect(res.status).toBe(200);
    expect((res.body.resources as ResourceReport[]).map((r) => r.resource).sort()).toEqual([
      "domains",
      "members",
      "stores",
    ]);
  });

  it("counts the tenant's real members and stores and finds them within limit", async () => {
    const tenant = await tenantFixture("ol-within");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);
    const r = byResource(res.body);

    // One ACTIVE membership from the fixture, against the seeded limit of 5.
    expect(r.members?.state).toBe("WITHIN_LIMIT");
    expect(r.members?.currentCount).toBe(1);
    expect(r.members?.limit).toBe(5);
    // No stores yet — a real zero, which is a different answer from an absent count.
    expect(r.stores?.state).toBe("WITHIN_LIMIT");
    expect(r.stores?.currentCount).toBe(0);
    expect(res.body.anyOverLimit).toBe(false);
  });

  it("reports domains as NOT_EVALUABLE with a null count, never zero", async () => {
    const tenant = await tenantFixture("ol-domains");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);
    const r = byResource(res.body);

    // The property item 7 handed to item 8. `domains` has no table until Phase 4.
    expect(r.domains?.state).toBe("NOT_EVALUABLE");
    expect(r.domains?.reason).toBe("NO_COUNTABLE_SOURCE");
    expect(r.domains?.currentCount).toBeNull();
    // The limit is still resolved and reported — only the count is unknown.
    expect(r.domains?.limit).toBe(5);
  });

  it("never counts a not-evaluable resource as over limit", async () => {
    const tenant = await tenantFixture("ol-notbreach");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);

    // An unknown is not a breach — the mirror of the zero-count lie.
    expect(res.body.anyOverLimit).toBe(false);
    expect(byResource(res.body).domains?.blockedOperations).toEqual([]);
  });

  describe("a downgrade below the current count — ADR-026's own entry cause", () => {
    it("reports OVER_LIMIT once the limit drops beneath the count", async () => {
      const tenant = await tenantFixture("ol-over");
      await subscribe(tenant.orgId, tenant.token);
      await seedStore(db, tenant.orgId, "One", `one-${randomUUID().slice(0, 8)}`);
      await seedStore(db, tenant.orgId, "Two", `two-${randomUUID().slice(0, 8)}`);
      await lowerStoreLimit(tenant.orgId, 1);

      const res = await readOverLimit(tenant.orgId, tenant.token);
      const r = byResource(res.body);

      expect(r.stores?.state).toBe("OVER_LIMIT");
      expect(r.stores?.currentCount).toBe(2);
      expect(r.stores?.limit).toBe(1);
      expect(res.body.anyOverLimit).toBe(true);
    });

    it("names exactly what is blocked and how to resolve it (ADR-026 items 4 and 5)", async () => {
      const tenant = await tenantFixture("ol-blocked");
      await subscribe(tenant.orgId, tenant.token);
      await seedStore(db, tenant.orgId, "Only", `only-${randomUUID().slice(0, 8)}`);
      await lowerStoreLimit(tenant.orgId, 0);

      const res = await readOverLimit(tenant.orgId, tenant.token);
      const r = byResource(res.body);

      // ADR-026 item 1: creation blocked, everything else retained.
      expect(r.stores?.blockedOperations).toEqual(["stores.create"]);
      // ADR-026 item 5: upgrade, or reduce your own usage.
      expect(r.stores?.resolution).toEqual(["upgrade", "reduce"]);
    });

    it("leaves the tenant's data untouched — ADR-026's whole subject", async () => {
      const tenant = await tenantFixture("ol-preserve");
      await subscribe(tenant.orgId, tenant.token);
      await seedStore(db, tenant.orgId, "Kept", `kept-${randomUUID().slice(0, 8)}`);
      await lowerStoreLimit(tenant.orgId, 0);

      await readOverLimit(tenant.orgId, tenant.token);

      const stores = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, (trx) =>
        trx.selectFrom("stores").select("id").where("tenant_id", "=", tenant.orgId).execute(),
      );
      // "preserve, block writes, never delete" — reading the state changes nothing.
      expect(stores).toHaveLength(1);
    });
  });

  it("excludes a revoked membership from the seat count (ADR-026 item 7)", async () => {
    const tenant = await tenantFixture("ol-revoked");
    await subscribe(tenant.orgId, tenant.token);
    const other = await seedUser(db, `ol-revoked-other-${randomUUID().slice(0, 8)}@example.test`);
    await seedMembership(db, tenant.orgId, other, "REVOKED");

    const res = await readOverLimit(tenant.orgId, tenant.token);

    // A revoked membership holds no seat; counting it would keep a tenant over
    // their limit after they had already resolved it.
    expect(byResource(res.body).members?.currentCount).toBe(1);
  });

  it("reports enteredAt as null while nothing writes the state table", async () => {
    const tenant = await tenantFixture("ol-entered");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);

    // ADR-045 names two writers and neither exists: the usage recorder is item
    // 9, and ADR-026's entry cause is item 15's plan change.
    for (const r of res.body.resources as ResourceReport[]) {
      expect(r.enteredAt).toBeNull();
    }
  });

  it("surfaces a recorded entered_at when a row does exist", async () => {
    const tenant = await tenantFixture("ol-entered-row");
    await subscribe(tenant.orgId, tenant.token);
    await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) => {
      const result = await trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          resource: "members",
          current_count: 9,
          limit_value: 5,
          entered_at: "2026-09-01T00:00:00Z",
        })
        .executeTakeFirst();
      if ((result.numInsertedOrUpdatedRows ?? 0n) !== 1n) {
        throw new Error(`seed inserted ${result.numInsertedOrUpdatedRows} rows`);
      }
    });

    const res = await readOverLimit(tenant.orgId, tenant.token);
    const r = byResource(res.body);

    // The one fact a live evaluation cannot recompute.
    expect(r.members?.enteredAt).toBe(new Date("2026-09-01T00:00:00Z").toISOString());
    // And the live count still wins over the row's snapshot.
    expect(r.members?.currentCount).toBe(1);
    expect(r.members?.state).toBe("WITHIN_LIMIT");
  });

  it("is not a paginated collection — ADR-036 does not apply", async () => {
    const tenant = await tenantFixture("ol-notcollection");
    await subscribe(tenant.orgId, tenant.token);

    const res = await readOverLimit(tenant.orgId, tenant.token);

    expect(res.body).not.toHaveProperty("items");
    expect(res.body).not.toHaveProperty("nextCursor");
    expect(res.body).toHaveProperty("resources");
  });

  it("refuses a plain member (owner and admin only, D2-8)", async () => {
    const tenant = await tenantFixture("ol-member", "member");

    const res = await readOverLimit(tenant.orgId, tenant.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("requires a session", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/organizations/${randomUUID()}/over-limit`);

    expect(res.status).toBe(401);
  });
});

describe("tenant_over_limit_states — constraints and RLS", () => {
  it("refuses a row that is not actually over the limit", async () => {
    const tenant = await tenantFixture("ol-constraint");

    const attempt = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          resource: "members",
          current_count: 2,
          limit_value: 5,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/tenant_over_limit_states_is_actually_over/);
  });

  it("refuses a resource outside ruling ب-4's closed list", async () => {
    const tenant = await tenantFixture("ol-badresource");

    const attempt = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          resource: "storage",
          current_count: 9,
          limit_value: 5,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/tenant_over_limit_states_resource_check/);
  });

  it("hides another tenant's state, with a positive control in the same test", async () => {
    const a = await tenantFixture("ol-rls-a");
    const b = await tenantFixture("ol-rls-b");
    await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: a.orgId,
          resource: "stores",
          current_count: 9,
          limit_value: 3,
        })
        .execute(),
    );

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("tenant_over_limit_states").select("id").where("tenant_id", "=", a.orgId).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("tenant_over_limit_states").select("id").where("tenant_id", "=", a.orgId).execute(),
    );

    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("returns zero rows with no tenant context, rather than everything", async () => {
    const a = await tenantFixture("ol-rls-nocontext");
    await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: a.orgId,
          resource: "members",
          current_count: 9,
          limit_value: 5,
        })
        .execute(),
    );

    const withContext = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("tenant_over_limit_states").select("id").execute(),
    );
    expect(withContext.length).toBeGreaterThan(0);

    const withoutContext = await db.selectFrom("tenant_over_limit_states").select("id").execute();
    expect(withoutContext).toHaveLength(0);
  });

  it("refuses an INSERT attributed to another tenant", async () => {
    const a = await tenantFixture("ol-rls-insert-a");
    const b = await tenantFixture("ol-rls-insert-b");

    const attempt = withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, (trx) =>
      trx
        .insertInto("tenant_over_limit_states")
        .values({
          id: randomUUID(),
          tenant_id: b.orgId,
          resource: "members",
          current_count: 9,
          limit_value: 5,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });
});
