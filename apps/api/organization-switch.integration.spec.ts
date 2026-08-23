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
import { hashSessionToken } from "../../modules/identity/domain/session-token.vo.js";
import { seedUser, seedSession, seedOrganization, seedMembership, seedStore, seedStoreMembership, grantRole } from "./test-support/seed.js";

/**
 * `POST /api/v1/organizations/{organizationId}/switch` end to end, against
 * real PostgreSQL, through the same middleware stack main.ts ships.
 *
 * The rule this whole slice exists to prove is ADR-002's: switching updates
 * a display preference on the caller's session and nothing else. The tests
 * below don't just exercise the happy path - they prove the negative, that
 * an unrelated capability's authorization is unaffected by having switched,
 * which is the property that would silently break if `active_organization_id`
 * ever became load-bearing anywhere.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

function switchTo(token: string, organizationId: string) {
  return request(app.getHttpServer()).post(`/api/v1/organizations/${organizationId}/switch`).set("Cookie", `sid=${token}`);
}

function readStore(token: string, storeId: string) {
  return request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", `sid=${token}`);
}

function auditRowsFor(organizationId: string, userId: string) {
  return withTenantContext(db, { tenantId: organizationId, userId: null, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "actor_user_id", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", organizationId)
      .where("capability", "=", "organization.switch")
      .where("actor_user_id", "=", userId)
      .execute(),
  );
}

async function sessionActiveOrg(token: string): Promise<string | null> {
  const row = await db
    .selectFrom("sessions")
    .select("active_organization_id")
    .where("token_hash", "=", hashSessionToken(token))
    .executeTakeFirstOrThrow();
  return row.active_organization_id;
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the organization.switch integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/organizations/{organizationId}/switch", () => {
  it("returns 200 and the new active organization", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-happy-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-b-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const res = await switchTo(token, orgB);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activeOrganizationId: orgB });
  });

  it("actually updates sessions.active_organization_id, not just the response body", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-persists-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-persist-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-persist-b-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    await switchTo(token, orgB).expect(200);

    expect(await sessionActiveOrg(token)).toBe(orgB);
  });

  it("switching to the organization already active is a no-op success, not a special case (decision 6)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-noop-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-noop-a-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const res = await switchTo(token, orgA);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activeOrganizationId: orgA });
    expect(await sessionActiveOrg(token)).toBe(orgA);
  });

  it("denies a caller who is not an active member of the target organization, with FORBIDDEN", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-nonmember-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-nonmember-a-${suffix}`);
    const orgC = await seedOrganization(db, "Org C", `switch-nonmember-c-${suffix}`); // userId has no membership here
    await seedMembership(db, orgA, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const res = await switchTo(token, orgC);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
    expect(await sessionActiveOrg(token)).toBe(orgA); // unchanged
  });

  it("denies a REVOKED membership the same as no membership at all, with the same FORBIDDEN code", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-revoked-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-revoked-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-revoked-b-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "REVOKED");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const res = await switchTo(token, orgB);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns AUTHENTICATION_REQUIRED with no cookie at all", async () => {
    const orgId = await seedOrganization(db, "Org", `switch-noauth-${randomUUID().slice(0, 8)}`);

    const res = await request(app.getHttpServer()).post(`/api/v1/organizations/${orgId}/switch`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns VALIDATION_ERROR for a path segment that is not a UUID", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-badid-${suffix}@example.test`);
    const token = await seedSession(db, userId, {});

    const res = await request(app.getHttpServer()).post("/api/v1/organizations/not-a-uuid/switch").set("Cookie", `sid=${token}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("ADR-002 proof: after switching, a request naming a DIFFERENT organization the caller belongs to still succeeds exactly as before", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-adr002-store-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-adr002-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-adr002-b-${suffix}`);
    const membershipA = await seedMembership(db, orgA, userId, "ACTIVE");
    await grantRole(db, orgA, membershipA, "owner");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const storeInA = await seedStore(db, orgA, "A Store", `switch-adr002-store-${suffix}`);
    await seedStoreMembership(db, orgA, storeInA, userId);
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    // Reading a store in org A works before switching.
    await readStore(token, storeInA).expect(200);

    // Switch the session's display preference to org B.
    await switchTo(token, orgB).expect(200);

    // store.read resolves its own tenant from the explicit storeId, never
    // from sessions.active_organization_id - so the SAME store, in the
    // organization the session no longer "shows" as active, is still fully
    // readable with the exact same cookie.
    const res = await readStore(token, storeInA);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: storeInA });
  });

  it("ADR-002 proof: after switching, a request naming an organization the caller does NOT belong to is still denied identically", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-adr002-deny-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-adr002-deny-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-adr002-deny-b-${suffix}`);
    const orgC = await seedOrganization(db, "Org C", `switch-adr002-deny-c-${suffix}`); // never a member
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const before = await switchTo(token, orgC);
    expect(before.status).toBe(403);

    await switchTo(token, orgB).expect(200);

    // Denied identically after switching away from orgA - the guard
    // re-verifies membership fresh on every request, never consulting
    // whatever the session currently shows as active.
    const after = await switchTo(token, orgC);
    expect(after.status).toBe(403);
    expect(after.body.code).toBe("FORBIDDEN");
  });

  it("records one SUCCESS audit event under the REAL organization's tenant id, not the platform sentinel (decision 4)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-audit-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-audit-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-audit-b-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    await switchTo(token, orgB).expect(200);

    const events = await auditRowsFor(orgB, userId);
    expect(events).toEqual([
      {
        capability: "organization.switch",
        outcome: "SUCCESS",
        actor_user_id: userId,
        resource_type: "session",
        resource_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        metadata: { organizationId: orgB },
      },
    ]);
  });

  it("writes no audit event for a rejected request - the guard denies before this capability's own code ever runs", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-no-audit-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-no-audit-a-${suffix}`);
    const orgC = await seedOrganization(db, "Org C", `switch-no-audit-c-${suffix}`); // never a member
    await seedMembership(db, orgA, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const res = await switchTo(token, orgC);
    expect(res.status).toBe(403);

    const events = await auditRowsFor(orgC, userId);
    expect(events).toEqual([]);
  });

  it("emits one structured log line carrying requestId, correlationId and the target organization's tenantId", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `switch-logline-${suffix}@example.test`);
    const orgA = await seedOrganization(db, "Org A", `switch-logline-a-${suffix}`);
    const orgB = await seedOrganization(db, "Org B", `switch-logline-b-${suffix}`);
    await seedMembership(db, orgA, userId, "ACTIVE");
    await seedMembership(db, orgB, userId, "ACTIVE");
    const token = await seedSession(db, userId, { activeOrganizationId: orgA });

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await switchTo(token, orgB).expect(200);
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
      tenantId: orgB,
      status: 200,
      method: "POST",
      path: `/api/v1/organizations/${orgB}/switch`,
    });
  });
});
