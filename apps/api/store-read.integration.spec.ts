import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { createTestApp } from "./create-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { withTenantContext } from "../../platform/db/tenant-context.js";
import {
  seedUser,
  seedSession,
  seedOrganization,
  seedMembership,
  seedStore,
  seedStoreMembership,
  grantRole,
} from "./test-support/seed.js";

/**
 * The golden-path proof: exercises every step of 08_PHASE_1_BRIEF.md §2's
 * pipeline through the real HTTP surface, against real PostgreSQL, with
 * real RLS. Deliberately covers the two gotchas the golden path exists to
 * get right: storeId is never trusted from the token (it's always the
 * explicit path param, checked server-side against store_memberships), and
 * store_memberships is checked independently of organization membership —
 * neither one substitutes for the other in either direction.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

async function createTenantFixture(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-${suffix}@example.test`);
  const orgId = await seedOrganization(db, `${label} Org`, `${label}-org-${suffix}`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  await grantRole(db, orgId, membershipId, "owner");
  const storeId = await seedStore(db, orgId, `${label} Store`, `${label}-store-${suffix}`);
  await seedStoreMembership(db, orgId, storeId, userId);
  const token = await seedSession(db, userId, { activeOrganizationId: orgId });
  return { userId, orgId, membershipId, storeId, token };
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the store.read integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }

  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("GET /api/v1/stores/:storeId — golden path", () => {
  it("returns the store for a user with a valid session, active org membership, store membership, and store.read permission", async () => {
    const tenant = await createTenantFixture("happy");

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${tenant.storeId}`).set("Cookie", `sid=${tenant.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: tenant.storeId,
      organizationId: tenant.orgId,
      status: "ACTIVE",
    });
  });

  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const tenant = await createTenantFixture("noauth");

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${tenant.storeId}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns AUTHENTICATION_REQUIRED for an expired session", async () => {
    const tenant = await createTenantFixture("expired");
    const expiredToken = await seedSession(db, tenant.userId, { activeOrganizationId: tenant.orgId, expired: true });

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${tenant.storeId}`).set("Cookie", `sid=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("denies a valid session reading a store belonging to another tenant — storeId is never trusted from the token (ADR-002)", async () => {
    const tenantA = await createTenantFixture("crossA");
    const tenantB = await createTenantFixture("crossB");

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${tenantB.storeId}`).set("Cookie", `sid=${tenantA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STORE_ACCESS_DENIED");
  });

  it("denies access when store_membership exists but the organization membership is revoked — checked independently, not inferred", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `revoked-${suffix}@example.test`);
    const orgId = await seedOrganization(db, "Revoked Org", `revoked-org-${suffix}`);
    const membershipId = await seedMembership(db, orgId, userId, "REVOKED");
    await grantRole(db, orgId, membershipId, "owner");
    const storeId = await seedStore(db, orgId, "Revoked Store", `revoked-store-${suffix}`);
    await seedStoreMembership(db, orgId, storeId, userId);
    const token = await seedSession(db, userId, { activeOrganizationId: orgId });

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", `sid=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STORE_ACCESS_DENIED");
  });

  it("denies access when organization membership is active but there is no store_membership — org membership alone is insufficient (08_PHASE_1_BRIEF.md §5)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `noaccess-${suffix}@example.test`);
    const orgId = await seedOrganization(db, "NoAccess Org", `noaccess-org-${suffix}`);
    const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
    await grantRole(db, orgId, membershipId, "owner");
    const storeId = await seedStore(db, orgId, "NoAccess Store", `noaccess-store-${suffix}`);
    const token = await seedSession(db, userId, { activeOrganizationId: orgId });

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", `sid=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STORE_ACCESS_DENIED");
  });

  it("denies access when the membership has no role granting store.read", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `noperm-${suffix}@example.test`);
    const orgId = await seedOrganization(db, "NoPerm Org", `noperm-org-${suffix}`);
    await seedMembership(db, orgId, userId, "ACTIVE");
    const storeId = await seedStore(db, orgId, "NoPerm Store", `noperm-store-${suffix}`);
    await seedStoreMembership(db, orgId, storeId, userId);
    const token = await seedSession(db, userId, { activeOrganizationId: orgId });

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", `sid=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR for a malformed storeId", async () => {
    const tenant = await createTenantFixture("badid");

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/not-a-uuid`).set("Cookie", `sid=${tenant.token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("durably records a SUCCESS audit event for a successful read (08_PHASE_1_BRIEF.md §2 step 8, option B)", async () => {
    const tenant = await createTenantFixture("audit");

    await request(app.getHttpServer()).get(`/api/v1/stores/${tenant.storeId}`).set("Cookie", `sid=${tenant.token}`);

    const events = await withTenantContext(
      db,
      { tenantId: tenant.orgId, userId: tenant.userId, storeId: tenant.storeId },
      (trx) =>
        trx
          .selectFrom("audit_events")
          .select(["capability", "outcome"])
          .where("resource_id", "=", tenant.storeId)
          .execute(),
    );
    expect(events).toContainEqual({ capability: "store.read", outcome: "SUCCESS" });
  });

  it("durably records a FAILURE audit event when authorization fails — the record survives even though the request fails, because it is written on a connection independent of the domain transaction (option B, DECISION_LOG.md)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `noperm-audit-${suffix}@example.test`);
    const orgId = await seedOrganization(db, "NoPermAudit Org", `noperm-audit-org-${suffix}`);
    await seedMembership(db, orgId, userId, "ACTIVE");
    const storeId = await seedStore(db, orgId, "NoPermAudit Store", `noperm-audit-store-${suffix}`);
    await seedStoreMembership(db, orgId, storeId, userId);
    const token = await seedSession(db, userId, { activeOrganizationId: orgId });

    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", `sid=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");

    const events = await withTenantContext(db, { tenantId: orgId, userId, storeId }, (trx) =>
      trx.selectFrom("audit_events").select(["capability", "outcome"]).where("resource_id", "=", storeId).execute(),
    );
    expect(events).toContainEqual({ capability: "store.read", outcome: "FAILURE" });
  });

  // A RESOURCE_NOT_FOUND case is not exercised here: store_memberships.store_id
  // is a foreign key to stores(id) (modules/tenant/migrations), so no fixture
  // can seed access to a store that does not exist — the FK makes the
  // not-found branch genuinely unreachable, not just unlikely (confirmed by
  // attempting exactly this seed, which fails on the constraint rather than
  // on any assertion). modules/tenant/application/read-store.service.spec.ts
  // covers that ReadStoreService itself throws RESOURCE_NOT_FOUND when its
  // repository returns null; the controller's audit-wrapping around that
  // throw is structurally identical to the FORBIDDEN case proven above (same
  // try/catch, same recordAuditEventDurable call), so it is not a distinct
  // code path this suite needs to separately exercise against real Postgres.
});

/** 08_PHASE_1_BRIEF.md §2 steps 9-10 — the stable error envelope and structured logging. */
describe("stable error contract and observability", () => {
  it("returns the documented envelope shape with a requestId on every failure path", async () => {
    const tenantA = await createTenantFixture("envA");
    const tenantB = await createTenantFixture("envB");

    const cases = [
      { path: `/api/v1/stores/${tenantA.storeId}`, cookie: undefined, code: "AUTHENTICATION_REQUIRED" },
      { path: `/api/v1/stores/not-a-uuid`, cookie: tenantA.token, code: "VALIDATION_ERROR" },
      { path: `/api/v1/stores/${tenantB.storeId}`, cookie: tenantA.token, code: "STORE_ACCESS_DENIED" },
    ];

    for (const testCase of cases) {
      const req = request(app.getHttpServer()).get(testCase.path);
      if (testCase.cookie) req.set("Cookie", `sid=${testCase.cookie}`);
      const res = await req;

      expect(res.body.code).toBe(testCase.code);
      expect(typeof res.body.message).toBe("string");
      expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("propagates a real requestId and correlationId into the audit event, not an empty string", async () => {
    const tenant = await createTenantFixture("reqid");
    const correlationId = randomUUID();

    await request(app.getHttpServer())
      .get(`/api/v1/stores/${tenant.storeId}`)
      .set("Cookie", `sid=${tenant.token}`)
      .set("x-correlation-id", correlationId);

    const events = await withTenantContext(
      db,
      { tenantId: tenant.orgId, userId: tenant.userId, storeId: tenant.storeId },
      (trx) =>
        trx
          .selectFrom("audit_events")
          .select(["request_id", "correlation_id"])
          .where("resource_id", "=", tenant.storeId)
          .execute(),
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(events[0]!.correlation_id).toBe(correlationId);
  });

  it("emits one structured log line per request carrying requestId, correlationId and tenantId", async () => {
    const tenant = await createTenantFixture("logline");
    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };

    try {
      await request(app.getHttpServer()).get(`/api/v1/stores/${tenant.storeId}`).set("Cookie", `sid=${tenant.token}`);
    } finally {
      console.log = originalLog;
    }

    const entries = captured
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null && "requestId" in entry);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      tenantId: tenant.orgId,
      status: 200,
      method: "GET",
      path: `/api/v1/stores/${tenant.storeId}`,
    });
    expect(entries[0]!["requestId"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(entries[0]!["correlationId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("RLS fails closed on the stores table (08_PHASE_1_BRIEF.md §6 exit criteria)", () => {
  it("a query issued without tenant context returns zero rows, at the database level", async () => {
    const tenant = await createTenantFixture("rls-db");

    const rows = await withTenantContext(db, { tenantId: null, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("stores").select("id").where("id", "=", tenant.storeId).execute(),
    );

    expect(rows).toEqual([]);
  });

  // This is NOT the application-layer half of the criterion above — that
  // scenario (an authenticated request whose query somehow runs with no
  // tenant context established) has no reachable code path to test at all.
  // See DECISION_LOG.md 2026-08-24 ("exit criterion 3's application half is
  // met by construction") for the full argument: SessionGuard rejects an
  // unauthenticated request before any transaction opens, and every
  // controller's own withTenantContext() call is built from
  // TenantContext.tenantId, typed `string`, never `null` — a guard either
  // populates it with a real, verified tenant id or throws first. This test
  // instead proves an adjacent, real requirement — no cookie at all is
  // rejected cleanly, never as a raw DB error — which is worth having on its
  // own merits.
  it("with no session cookie at all, the application layer raises a stable AUTHENTICATION_REQUIRED, never a raw DB error", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${randomUUID()}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.message).not.toMatch(/relation|syntax|SQL|pg_/i);
  });
});
