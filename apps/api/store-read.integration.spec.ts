import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { AppModule } from "./app.module.js";
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

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.use(cookieParser());
  await app.init();
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

  it("emits an audit event for a successful read", async () => {
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
});

describe("RLS fails closed on the stores table (08_PHASE_1_BRIEF.md §6 exit criteria)", () => {
  it("a query issued without tenant context returns zero rows, at the database level", async () => {
    const tenant = await createTenantFixture("rls-db");

    const rows = await withTenantContext(db, { tenantId: null, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("stores").select("id").where("id", "=", tenant.storeId).execute(),
    );

    expect(rows).toEqual([]);
  });

  it("the application layer raises a stable AUTHENTICATION_REQUIRED error for the same case, never a raw DB error", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/stores/${randomUUID()}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    expect(res.body.message).not.toMatch(/relation|syntax|SQL|pg_/i);
  });
});
