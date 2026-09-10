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
import { seedUser, seedSession, seedOrganization, seedMembership, grantRole } from "./test-support/seed.js";
import "../../modules/entitlement/infrastructure/entitlement.tables.js";

/**
 * Phase 2 item 6's proof.
 *
 * `PHASE_2_BRIEF.md` §6 criterion 25 is the one this exists to pass: "a
 * `tenant_entitlement_overrides` row is invisible without tenant context and
 * invisible from a different tenant's context; a `plan_entitlements` row is
 * readable with no tenant context." Both halves are asserted below, each with a
 * positive control.
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

function resolve(orgId: string, token: string, featureKey?: string) {
  const url = featureKey
    ? `/api/v1/organizations/${orgId}/entitlements?featureKey=${featureKey}`
    : `/api/v1/organizations/${orgId}/entitlements`;
  return request(app.getHttpServer()).get(url).set("Cookie", `sid=${token}`);
}

/** Writes an override directly: `05` §4.2 has no capability that sets one (ADR-045 records the same). */
async function seedOverride(
  tenantId: string,
  featureKey: string,
  overrideType: "ABSOLUTE" | "DELTA",
  state: "ALLOW" | "DENY" | "LIMIT",
  limit: number | null,
): Promise<void> {
  await withTenantContext(db, { tenantId, userId: null, storeId: null }, async (trx) => {
    const result = await trx
      .insertInto("tenant_entitlement_overrides")
      .values({
        id: randomUUID(),
        tenant_id: tenantId,
        feature_key: featureKey,
        override_type: overrideType,
        state,
        limit_value: limit,
      })
      .executeTakeFirst();
    // `AGENTS.md` §8: a statement that must change rows asserts how many it
    // changed. Under FORCE RLS a missing tenant context matches nothing and
    // fails silently.
    if ((result.numInsertedOrUpdatedRows ?? 0n) !== 1n) {
      throw new Error(`seedOverride inserted ${result.numInsertedOrUpdatedRows} rows`);
    }
  });
}

/** Writes a quota override directly: `05` §4.2 still has no capability that sets one. */
async function seedQuotaOverride(
  tenantId: string,
  resource: string,
  overrideType: "ABSOLUTE" | "DELTA",
  limit: number,
): Promise<void> {
  await withTenantContext(db, { tenantId, userId: null, storeId: null }, async (trx) => {
    const result = await trx
      .insertInto("tenant_quota_overrides")
      .values({ id: randomUUID(), tenant_id: tenantId, resource, override_type: overrideType, limit_value: limit })
      .executeTakeFirst();
    // `AGENTS.md` §8: a statement that must change rows asserts how many.
    if ((result.numInsertedOrUpdatedRows ?? 0n) !== 1n) {
      throw new Error(`seedQuotaOverride inserted ${result.numInsertedOrUpdatedRows} rows`);
    }
  });
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the entitlement integration test. ${describeDbError(err)}`, {
      cause: err,
    });
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("GET /api/v1/organizations/:organizationId/entitlements", () => {
  it("resolves the plan version's grants for a subscribed organization", async () => {
    const tenant = await tenantFixture("ent-happy");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token);

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(tenant.orgId);
    const keys = (res.body.entitlements as { featureKey: string }[]).map((e) => e.featureKey);
    // Ruling ب-4's closed V1 list, seeded onto the standard plan version.
    expect(keys).toEqual(["domains", "members", "stores"]);
    // Since item 7 they carry limits: a plan entitlement plus a quota policy is
    // one LIMIT grant, not an ALLOW and a competing number.
    expect(res.body.entitlements.every((e: { state: string }) => e.state === "LIMIT")).toBe(true);
  });

  it("explains every resolution, which is what makes a denial actionable (ADR-008)", async () => {
    const tenant = await tenantFixture("ent-explain");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token);

    for (const entry of res.body.entitlements as { resolvedFrom: string[] }[]) {
      expect(entry.resolvedFrom).toEqual(["PLAN_VERSION"]);
    }
  });

  it("denies everything for an organization with no subscription, rather than failing open", async () => {
    const tenant = await tenantFixture("ent-nosub");

    const res = await resolve(tenant.orgId, tenant.token, "members");

    expect(res.status).toBe(200);
    expect(res.body.entitlements).toHaveLength(1);
    expect(res.body.entitlements[0].state).toBe("DENY");
    expect(res.body.entitlements[0].resolvedFrom).toEqual(["PLATFORM_DEFAULT"]);
  });

  it("lets an ABSOLUTE override replace the plan's grant", async () => {
    const tenant = await tenantFixture("ent-absolute");
    await subscribe(tenant.orgId, tenant.token);
    await seedOverride(tenant.orgId, "members", "ABSOLUTE", "LIMIT", 25);

    const res = await resolve(tenant.orgId, tenant.token, "members");

    expect(res.body.entitlements[0].state).toBe("LIMIT");
    expect(res.body.entitlements[0].limit).toBe(25);
    expect(res.body.entitlements[0].resolvedFrom).toEqual(["TENANT_OVERRIDE_ABSOLUTE"]);
  });

  it("lets an explicit DENY override beat the plan's ALLOW (ADR-008 rule 1)", async () => {
    const tenant = await tenantFixture("ent-deny");
    await subscribe(tenant.orgId, tenant.token);
    await seedOverride(tenant.orgId, "stores", "ABSOLUTE", "DENY", null);

    const res = await resolve(tenant.orgId, tenant.token, "stores");

    expect(res.body.entitlements[0].state).toBe("DENY");
  });

  it("filters to one feature when asked", async () => {
    const tenant = await tenantFixture("ent-filter");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token, "domains");

    expect(res.body.entitlements).toHaveLength(1);
    expect(res.body.entitlements[0].featureKey).toBe("domains");
  });

  it("is not a paginated collection — ADR-036 does not apply", async () => {
    const tenant = await tenantFixture("ent-shape");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token);

    expect(res.body).not.toHaveProperty("items");
    expect(res.body).not.toHaveProperty("nextCursor");
    expect(res.body).toHaveProperty("entitlements");
    expect(res.body).toHaveProperty("evaluatedAt");
  });

  it("rejects a malformed feature key", async () => {
    const tenant = await tenantFixture("ent-badkey");

    const res = await resolve(tenant.orgId, tenant.token, "Not%20A%20Key");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a plain member (owner and admin only, D2-8)", async () => {
    const tenant = await tenantFixture("ent-member", "member");

    const res = await resolve(tenant.orgId, tenant.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("requires a session", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/organizations/${randomUUID()}/entitlements`);

    expect(res.status).toBe(401);
  });
});

describe("entitlement_sources — ADR-008's explainability log", () => {
  it("records one row per resolved feature, with the rungs that contributed", async () => {
    const tenant = await tenantFixture("ent-log");
    await subscribe(tenant.orgId, tenant.token);

    await resolve(tenant.orgId, tenant.token, "members");

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("entitlement_sources")
        .selectAll()
        .where("tenant_id", "=", tenant.orgId)
        .where("feature_key", "=", "members")
        .execute(),
    );

    expect(rows).toHaveLength(1);
    // LIMIT rather than ALLOW since item 7: the plan's entitlement and its quota
    // policy compose into one grant carrying the number.
    expect(rows[0]?.state).toBe("LIMIT");
    expect(rows[0]?.limit_value).toBe(5);
    expect(rows[0]?.resolved_from).toEqual(["PLAN_VERSION"]);
    expect(rows[0]?.evaluated_at).toBeInstanceOf(Date);
  });

  it("appends rather than replacing — it is a log, not a snapshot", async () => {
    const tenant = await tenantFixture("ent-log-appends");
    await subscribe(tenant.orgId, tenant.token);

    await resolve(tenant.orgId, tenant.token, "stores");
    await resolve(tenant.orgId, tenant.token, "stores");

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("entitlement_sources")
        .select("id")
        .where("tenant_id", "=", tenant.orgId)
        .where("feature_key", "=", "stores")
        .execute(),
    );

    expect(rows).toHaveLength(2);
  });

  // `AGENTS.md` §8: aimed at a row that does not exist, so the proof is
  // harmless if the protection is ever removed.
  const NO_SUCH_ROW = "00000000-0000-4000-8000-0000000000fc";

  it("denies UPDATE to nexora_app", async () => {
    await expect(
      sql`UPDATE entitlement_sources SET state = 'ALLOW' WHERE id = ${NO_SUCH_ROW}`.execute(db),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies DELETE to nexora_app", async () => {
    await expect(sql`DELETE FROM entitlement_sources WHERE id = ${NO_SUCH_ROW}`.execute(db)).rejects.toThrow(
      /permission denied/i,
    );
  });
});

describe("PHASE_2_BRIEF §6 criterion 25 — the entitlement/quota tenancy split (D2-14)", () => {
  it("makes a plan_entitlements row readable with NO tenant context, because it is platform-global", async () => {
    const rows = await db
      .selectFrom("plan_entitlements")
      .select("feature_key")
      .where("plan_version_id", "=", STANDARD_PLAN_VERSION)
      .execute();

    expect(rows.length).toBeGreaterThan(0);
  });

  it("hides a tenant_entitlement_overrides row without tenant context, with a positive control", async () => {
    const tenant = await tenantFixture("crit25-nocontext");
    await seedOverride(tenant.orgId, "members", "ABSOLUTE", "LIMIT", 3);

    const withContext = await withTenantContext(
      db,
      { tenantId: tenant.orgId, userId: null, storeId: null },
      async (trx) => trx.selectFrom("tenant_entitlement_overrides").select("id").execute(),
    );
    expect(withContext.length).toBeGreaterThan(0);

    const withoutContext = await db.selectFrom("tenant_entitlement_overrides").select("id").execute();
    expect(withoutContext).toHaveLength(0);
  });

  it("hides another tenant's override, with a positive control in the same test", async () => {
    const a = await tenantFixture("crit25-a");
    const b = await tenantFixture("crit25-b");
    await seedOverride(a.orgId, "domains", "ABSOLUTE", "DENY", null);

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("tenant_entitlement_overrides").select("id").where("tenant_id", "=", a.orgId).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("tenant_entitlement_overrides").select("id").where("tenant_id", "=", a.orgId).execute(),
    );

    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("hides another tenant's entitlement_sources rows, with a positive control", async () => {
    const a = await tenantFixture("crit25-log-a");
    const b = await tenantFixture("crit25-log-b");
    await subscribe(a.orgId, a.token);
    await resolve(a.orgId, a.token, "members");

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("entitlement_sources").select("id").where("tenant_id", "=", a.orgId).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("entitlement_sources").select("id").where("tenant_id", "=", a.orgId).execute(),
    );

    expect(asOwner.length).toBeGreaterThan(0);
    expect(asStranger).toHaveLength(0);
  });

  it("refuses an override INSERT attributed to another tenant", async () => {
    const a = await tenantFixture("crit25-insert-a");
    const b = await tenantFixture("crit25-insert-b");

    const attempt = withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("tenant_entitlement_overrides")
        .values({
          id: randomUUID(),
          tenant_id: b.orgId,
          feature_key: "members",
          override_type: "ABSOLUTE",
          state: "ALLOW",
          limit_value: null,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });
});

describe("item 7 — quota policies composed into ADR-008's chain", () => {
  it("turns the plan's ALLOW plus its quota policy into one LIMIT with a number", async () => {
    const tenant = await tenantFixture("quota-plan");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token, "members");

    expect(res.body.entitlements[0].state).toBe("LIMIT");
    expect(res.body.entitlements[0].limit).toBe(5);
    // One grant, one rung — not two competing PLAN_VERSION grants, which rule 3
    // would refuse as a conflict.
    expect(res.body.entitlements[0].resolvedFrom).toEqual(["PLAN_VERSION"]);
  });

  it("seeds all three of ب-4's resources with a limit, and nothing else", async () => {
    const tenant = await tenantFixture("quota-all");
    await subscribe(tenant.orgId, tenant.token);

    const res = await resolve(tenant.orgId, tenant.token);
    const byKey = Object.fromEntries(
      (res.body.entitlements as { featureKey: string; limit: number | null }[]).map((e) => [e.featureKey, e.limit]),
    );

    expect(byKey).toEqual({ members: 5, stores: 3, domains: 5 });
  });

  it("lets an ABSOLUTE quota override replace the plan's number", async () => {
    const tenant = await tenantFixture("quota-absolute");
    await subscribe(tenant.orgId, tenant.token);
    await seedQuotaOverride(tenant.orgId, "members", "ABSOLUTE", 25);

    const res = await resolve(tenant.orgId, tenant.token, "members");

    expect(res.body.entitlements[0].limit).toBe(25);
    expect(res.body.entitlements[0].resolvedFrom).toEqual(["TENANT_OVERRIDE_ABSOLUTE"]);
  });

  it("lets a DELTA quota override adjust it, as a modifier rather than a base", async () => {
    const tenant = await tenantFixture("quota-delta");
    await subscribe(tenant.orgId, tenant.token);
    await seedQuotaOverride(tenant.orgId, "stores", "DELTA", 4);

    const res = await resolve(tenant.orgId, tenant.token, "stores");

    // 3 from the plan, +4 from the override. Item 6's finding carries over:
    // a DELTA adjusts the resolved value rather than standing alone.
    expect(res.body.entitlements[0].limit).toBe(7);
    expect(res.body.entitlements[0].resolvedFrom).toEqual(["PLAN_VERSION", "TENANT_OVERRIDE_DELTA"]);
  });

  it("lets an entitlement DENY dominate a quota that permits five (ADR-008 rule 1)", async () => {
    const tenant = await tenantFixture("quota-deny");
    await subscribe(tenant.orgId, tenant.token);
    await seedOverride(tenant.orgId, "domains", "ABSOLUTE", "DENY", null);

    const res = await resolve(tenant.orgId, tenant.token, "domains");

    // The entitlement axis wins; the number is never consulted.
    expect(res.body.entitlements[0].state).toBe("DENY");
    expect(res.body.entitlements[0].limit).toBeNull();
  });

  it("rejects a resource outside ب-4's closed list at the database", async () => {
    const tenant = await tenantFixture("quota-badresource");

    const attempt = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("tenant_quota_overrides")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          resource: "storage",
          override_type: "ABSOLUTE",
          limit_value: 10,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/tenant_quota_overrides_resource_check/);
  });

  it("rejects a negative ABSOLUTE override while permitting a negative DELTA", async () => {
    const tenant = await tenantFixture("quota-negative");

    const absolute = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("tenant_quota_overrides")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          resource: "members",
          override_type: "ABSOLUTE",
          limit_value: -1,
        })
        .execute(),
    );
    await expect(absolute).rejects.toThrow(/tenant_quota_overrides_absolute_is_non_negative/);

    // A negative DELTA is legitimate — an operator reducing an allowance.
    await seedQuotaOverride(tenant.orgId, "stores", "DELTA", -1);
  });
});

describe("§6 criterion 25, the quota half", () => {
  it("makes a plan_quota_policies row readable with NO tenant context", async () => {
    const rows = await db
      .selectFrom("plan_quota_policies")
      .select("resource")
      .where("plan_version_id", "=", STANDARD_PLAN_VERSION)
      .execute();

    expect(rows).toHaveLength(3);
  });

  it("hides a tenant_quota_overrides row without tenant context, with a positive control", async () => {
    const tenant = await tenantFixture("crit25q-nocontext");
    await seedQuotaOverride(tenant.orgId, "members", "ABSOLUTE", 9);

    const withContext = await withTenantContext(
      db,
      { tenantId: tenant.orgId, userId: null, storeId: null },
      async (trx) => trx.selectFrom("tenant_quota_overrides").select("id").execute(),
    );
    expect(withContext.length).toBeGreaterThan(0);

    const withoutContext = await db.selectFrom("tenant_quota_overrides").select("id").execute();
    expect(withoutContext).toHaveLength(0);
  });

  it("hides another tenant's quota override, with a positive control in the same test", async () => {
    const a = await tenantFixture("crit25q-a");
    const b = await tenantFixture("crit25q-b");
    await seedQuotaOverride(a.orgId, "domains", "ABSOLUTE", 2);

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("tenant_quota_overrides").select("id").where("tenant_id", "=", a.orgId).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("tenant_quota_overrides").select("id").where("tenant_id", "=", a.orgId).execute(),
    );

    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("refuses a quota override INSERT attributed to another tenant", async () => {
    const a = await tenantFixture("crit25q-insert-a");
    const b = await tenantFixture("crit25q-insert-b");

    const attempt = withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("tenant_quota_overrides")
        .values({
          id: randomUUID(),
          tenant_id: b.orgId,
          resource: "members",
          override_type: "ABSOLUTE",
          limit_value: 1,
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });
});
