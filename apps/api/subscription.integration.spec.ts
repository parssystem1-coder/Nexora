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
import { seedUser, seedSession, seedOrganization, seedMembership, grantRole } from "./test-support/seed.js";
import "../../modules/subscription/infrastructure/subscription.tables.js";
import "../../modules/billing/infrastructure/billing.tables.js";

/**
 * Phase 2 item 4's proof, through the real HTTP surface against real
 * PostgreSQL. It carries the second review stop, so what it proves is what the
 * review is being asked to accept:
 *
 *   * the first tenant-owned Phase 2 tables written by a capability, and their
 *     RLS **proven live with a positive control on every visibility assertion**
 *     — an assertion that a wrong tenant sees nothing is worthless unless the
 *     right tenant is shown to see something in the same test;
 *   * `subscription_periods` append-only, aimed at a row that does not exist
 *     per `AGENTS.md` §8's rule;
 *   * ADR-038's idempotency composition, replay and conflict, end to end;
 *   * ADR-024 item 2's derived serving state reaching a client.
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

function subscribe(orgId: string, token: string, key: string, body: Record<string, unknown>) {
  return request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgId}/subscription`)
    .set("Cookie", `sid=${token}`)
    .set("Idempotency-Key", key)
    .send(body);
}

const VALID_BODY = { planVersionId: STANDARD_PLAN_VERSION, termMonths: 12 };

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the subscription integration test. ${describeDbError(err)}`, {
      cause: err,
    });
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/organizations/:organizationId/subscription", () => {
  it("creates a TRIALING subscription with a CURRENT first period, and reports it serving", async () => {
    const tenant = await tenantFixture("sub-happy");

    const res = await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("TRIALING");
    expect(res.body.organizationId).toBe(tenant.orgId);
    expect(res.body.planVersionId).toBe(STANDARD_PLAN_VERSION);
    expect(res.body.termLength).toBe("1 year");
    expect(res.body.currentPeriod.status).toBe("CURRENT");
    expect(res.body.servingNow).toBe(true);
    expect(new Date(res.body.trialEndsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("links the subscription to its first period, both rows written in one transaction", async () => {
    const tenant = await tenantFixture("sub-link");

    const res = await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("subscriptions")
        .innerJoin("subscription_periods", "subscription_periods.id", "subscriptions.current_period_id")
        .select(["subscriptions.id as sid", "subscription_periods.id as pid", "subscription_periods.status as pstatus"])
        .where("subscriptions.id", "=", res.body.id)
        .execute(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.pstatus).toBe("CURRENT");
  });

  it("requires an Idempotency-Key, rather than inventing one that could never replay", async () => {
    const tenant = await tenantFixture("sub-nokey");

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${tenant.orgId}/subscription`)
      .set("Cookie", `sid=${tenant.token}`)
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a second subscription for the same organization", async () => {
    const tenant = await tenantFixture("sub-second");
    await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    const res = await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("refuses a member without the permission (owner and admin only, D2-8)", async () => {
    const tenant = await tenantFixture("sub-member", "member");

    const res = await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("requires a session", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${randomUUID()}/subscription`)
      .set("Idempotency-Key", randomUUID())
      .send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it("returns RESOURCE_NOT_FOUND for a term no price covers", async () => {
    const tenant = await tenantFixture("sub-term");

    const res = await subscribe(tenant.orgId, tenant.token, randomUUID(), {
      planVersionId: STANDARD_PLAN_VERSION,
      termMonths: 7,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("ADR-038 idempotency composition — the first capability that composes it", () => {
  it("replays the same key with the same payload, creating exactly one subscription", async () => {
    const tenant = await tenantFixture("sub-replay");
    const key = randomUUID();

    const first = await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);
    const second = await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscriptions").select("id").where("tenant_id", "=", tenant.orgId).execute(),
    );
    expect(rows).toHaveLength(1);
  });

  it("audits the replay separately and marks it, so a retry storm is visible (ADR-038 item 4)", async () => {
    const tenant = await tenantFixture("sub-replay-audit");
    const key = randomUUID();

    await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);
    await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);

    const events = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("audit_events")
        .select(["outcome", "metadata"])
        .where("capability", "=", "plan.subscribe")
        .where("tenant_id", "=", tenant.orgId)
        .orderBy("occurred_at", "asc")
        .execute(),
    );

    // Two attempts, two audit events — a replay is a real authorized attempt.
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.outcome === "SUCCESS")).toBe(true);
    expect(JSON.stringify(events[0]?.metadata ?? {})).not.toContain("replay");
    expect(JSON.stringify(events[1]?.metadata ?? {})).toContain("replay");
  });

  it("returns IDEMPOTENCY_CONFLICT when the same key carries a different payload (ADR-009)", async () => {
    const tenant = await tenantFixture("sub-conflict");
    const key = randomUUID();

    await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);
    const res = await subscribe(tenant.orgId, tenant.token, key, {
      planVersionId: STANDARD_PLAN_VERSION,
      termMonths: 24,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("leaves no claim behind when the work fails (ADR-038's verification list)", async () => {
    const tenant = await tenantFixture("sub-rollback");
    const key = randomUUID();

    // A term no price covers: the claim is written, then the service throws, and
    // the whole transaction rolls back — including the claim.
    const failed = await subscribe(tenant.orgId, tenant.token, key, {
      planVersionId: STANDARD_PLAN_VERSION,
      termMonths: 7,
    });
    expect(failed.status).toBe(404);

    const claims = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("idempotency_records").select("id").where("idempotency_key", "=", key).execute(),
    );
    expect(claims).toHaveLength(0);

    // And the key is therefore reusable: the operation never happened.
    const retried = await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);
    expect(retried.status).toBe(201);
  });

  it("stores the claim with ADR-009's columns, including the expires_at retention resolves at claim time", async () => {
    const tenant = await tenantFixture("sub-claim");
    const key = randomUUID();

    await subscribe(tenant.orgId, tenant.token, key, VALID_BODY);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("idempotency_records")
        .select(["capability", "status", "actor_type", "created_at", "expires_at", "request_hash"])
        .where("idempotency_key", "=", key)
        .execute(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.capability).toBe("plan.subscribe");
    expect(rows[0]?.status).toBe("COMPLETED");
    expect(rows[0]?.actor_type).toBe("user");
    expect(rows[0]?.request_hash).toMatch(/^[0-9a-f]{64}$/);

    // 30 days, ADR-009's 2026-09-05 amendment, resolved at claim time.
    const days = (rows[0]!.expires_at.getTime() - rows[0]!.created_at.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });
});

describe("GET /api/v1/organizations/:organizationId/subscription", () => {
  it("reads back what was created, deriving servingNow on every read", async () => {
    const tenant = await tenantFixture("sub-read");
    const created = await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${tenant.orgId}/subscription`)
      .set("Cookie", `sid=${tenant.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.status).toBe("TRIALING");
    expect(res.body.servingNow).toBe(true);
    expect(res.body.currentPeriod.status).toBe("CURRENT");
  });

  it("returns RESOURCE_NOT_FOUND for an organization with no subscription", async () => {
    const tenant = await tenantFixture("sub-none");

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${tenant.orgId}/subscription`)
      .set("Cookie", `sid=${tenant.token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("never exposes another organization's subscription through the guard chain", async () => {
    const owner = await tenantFixture("sub-owner");
    const stranger = await tenantFixture("sub-stranger");
    await subscribe(owner.orgId, owner.token, randomUUID(), VALID_BODY);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${owner.orgId}/subscription`)
      .set("Cookie", `sid=${stranger.token}`);

    // Refused at the guard, before any query runs.
    expect([403, 404]).toContain(res.status);
    expect(res.body.id).toBeUndefined();
  });
});

describe("RLS, proven live as nexora_app with a positive control on every assertion", () => {
  it("shows a tenant its own rows and hides another tenant's, in the same test", async () => {
    const a = await tenantFixture("rls-a");
    const b = await tenantFixture("rls-b");
    const created = await subscribe(a.orgId, a.token, randomUUID(), VALID_BODY);

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscriptions").select("id").where("id", "=", created.body.id).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscriptions").select("id").where("id", "=", created.body.id).execute(),
    );

    // The positive control is the point: without it, "zero rows" could mean the
    // row does not exist rather than that the policy hid it.
    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("hides periods the same way, with the same positive control", async () => {
    const a = await tenantFixture("rls-period-a");
    const b = await tenantFixture("rls-period-b");
    const created = await subscribe(a.orgId, a.token, randomUUID(), VALID_BODY);

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscription_periods").select("id").where("subscription_id", "=", created.body.id).execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscription_periods").select("id").where("subscription_id", "=", created.body.id).execute(),
    );

    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("returns zero rows with no tenant context at all, rather than everything", async () => {
    const a = await tenantFixture("rls-nocontext");
    await subscribe(a.orgId, a.token, randomUUID(), VALID_BODY);

    // Positive control first, so the empty result below cannot be an empty table.
    const withContext = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscriptions").select("id").execute(),
    );
    expect(withContext.length).toBeGreaterThan(0);

    const withoutContext = await db.selectFrom("subscriptions").select("id").execute();
    expect(withoutContext).toHaveLength(0);
  });

  it("refuses an INSERT for another tenant, which the policy's WITH CHECK covers", async () => {
    const a = await tenantFixture("rls-insert-a");
    const b = await tenantFixture("rls-insert-b");

    const attempt = withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("subscriptions")
        .values({
          id: randomUUID(),
          tenant_id: b.orgId,
          plan_version_id: STANDARD_PLAN_VERSION,
          price_version_id: randomUUID(),
          status: "TRIALING",
          term_length: "1 year",
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });
});

describe("subscription_periods is append-only for the application role", () => {
  // `AGENTS.md` §8: a destructive statement written to prove it is denied must
  // still be harmless if it is ever allowed. Both target an id that matches
  // nothing — PostgreSQL checks table privileges when the statement is planned,
  // before any row is matched, so the assertion is identical and the blast
  // radius is zero.
  const NO_SUCH_ROW = "00000000-0000-4000-8000-0000000000fe";

  it("denies UPDATE to nexora_app", async () => {
    await expect(
      sql`UPDATE subscription_periods SET status = 'ENDED' WHERE id = ${NO_SUCH_ROW}`.execute(db),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies DELETE to nexora_app", async () => {
    await expect(sql`DELETE FROM subscription_periods WHERE id = ${NO_SUCH_ROW}`.execute(db)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("still permits UPDATE on subscriptions, which the state machine needs", async () => {
    // The counterpart assertion: §5's list names `subscription_periods` and not
    // `subscriptions`, and revoking on the latter would make ADR-024's whole
    // state machine unimplementable. Targets nothing, like the two above.
    await expect(
      sql`UPDATE subscriptions SET status = 'ACTIVE' WHERE id = ${NO_SUCH_ROW}`.execute(db),
    ).resolves.toBeDefined();
  });
});

describe("audit", () => {
  it("writes one event per attempt under the real tenant, not ADR-035's sentinel", async () => {
    const tenant = await tenantFixture("sub-audit");

    await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("audit_events")
        .select(["tenant_id", "resource_type", "outcome"])
        .where("capability", "=", "plan.subscribe")
        .where("tenant_id", "=", tenant.orgId)
        .execute(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant_id).toBe(tenant.orgId);
    expect(rows[0]?.tenant_id).not.toBe(PLATFORM_TENANT_ID);
    expect(rows[0]?.resource_type).toBe("subscription");
  });

  it("records a FAILURE event when the attempt is refused", async () => {
    const tenant = await tenantFixture("sub-audit-fail", "member");

    await subscribe(tenant.orgId, tenant.token, randomUUID(), VALID_BODY);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("audit_events")
        .select("outcome")
        .where("capability", "=", "plan.subscribe")
        .where("tenant_id", "=", tenant.orgId)
        .execute(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.outcome).toBe("FAILURE");
  });
});
