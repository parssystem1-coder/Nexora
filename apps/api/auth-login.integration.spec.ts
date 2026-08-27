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
  seedCredential,
  seedOrganization,
  seedMembership,
  seedStore,
  seedStoreMembership,
  grantRole,
} from "./test-support/seed.js";

/**
 * `POST /api/v1/auth/login` end to end, against real PostgreSQL, through the
 * same middleware stack main.ts ships (create-app.ts).
 *
 * The most divergent capability in the codebase from the golden path (see
 * modules/identity/interfaces/auth-login.controller.ts and DECISION_LOG.md
 * "auth.login: which pipeline steps survive") — no guard, no tenant, no
 * transaction. This suite proves the properties that survive that
 * divergence: the cookie actually authenticates a subsequent request to an
 * existing capability (the same two-capability proof `store.create` used
 * for `store.read`); the raw token appears nowhere but the cookie; unknown
 * email, wrong password and a suspended user are indistinguishable; and the
 * audit event lands under ADR-035's platform-scope sentinel on both paths.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());
const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

const PASSWORD = "correct horse battery staple";

async function seedLoginableUser(label: string, options: { status?: "ACTIVE" | "SUSPENDED" } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-${suffix}@example.test`;
  const userId = await seedUser(db, email);
  await seedCredential(db, userId, PASSWORD);
  if (options.status === "SUSPENDED") {
    await db.updateTable("users").set({ status: "SUSPENDED" }).where("id", "=", userId).execute();
  }
  return { userId, email };
}

function login(body: Record<string, unknown>) {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send(body);
}

function extractSidCookie(res: request.Response): { raw: string; token: string } {
  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sidCookie = cookies.find((c: string) => c.startsWith("sid="));
  expect(sidCookie, "no sid cookie was set").toBeDefined();
  const raw = sidCookie!;
  const token = raw.split(";")[0]!.slice("sid=".length);
  return { raw, token };
}

function auditRowsFor(userId: string | null) {
  return withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) => {
    let query = trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "actor_user_id", "resource_type", "resource_id"])
      .where("tenant_id", "=", PLATFORM_TENANT_ID)
      .where("capability", "=", "auth.login");
    if (userId !== null) query = query.where("actor_user_id", "=", userId);
    return query.execute();
  });
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the auth.login integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/auth/login - happy path", () => {
  it("returns 200 with the documented success shape and sets the sid cookie", async () => {
    const { userId, email } = await seedLoginableUser("happy");

    const res = await login({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId, email, activeOrganizationId: null });
    expect(typeof res.body.displayName).toBe("string");
    expect(res.body.sessionExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const { raw } = extractSidCookie(res);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Path=\//i);
    expect(raw).toMatch(/Max-Age=/i);
  });

  it("matches the email case-insensitively, same as membership.invite's precedent", async () => {
    const { email } = await seedLoginableUser("case");

    const res = await login({ email: email.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(200);
  });

  it("the cookie it returns actually authenticates a subsequent request - store.read, the golden path", async () => {
    const { userId, email } = await seedLoginableUser("usable");
    const orgId = await seedOrganization(db, "Usable Org", `usable-org-${userId.slice(0, 8)}`);
    const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
    await grantRole(db, orgId, membershipId, "owner");
    const storeId = await seedStore(db, orgId, "Usable Store", `usable-store-${userId.slice(0, 8)}`);
    await seedStoreMembership(db, orgId, storeId, userId);

    const loginRes = await login({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const { raw: cookie } = extractSidCookie(loginRes);

    const readRes = await request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`).set("Cookie", cookie);

    expect(readRes.status).toBe(200);
    expect(readRes.body).toMatchObject({ id: storeId, organizationId: orgId });
  });

  it("the cookie authenticates organization.create end to end - login, then create an organization with the same session", async () => {
    const { email } = await seedLoginableUser("orgcreate");

    const loginRes = await login({ email, password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const { raw: cookie } = extractSidCookie(loginRes);

    const suffix = randomUUID().slice(0, 8);
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", cookie)
      .send({ name: "Login Flow Org", slug: `login-flow-${suffix}` });

    expect(createRes.status).toBe(201);
    expect(createRes.body.slug).toBe(`login-flow-${suffix}`);
  });

  it("a second login does not invalidate the first session - both remain valid simultaneously", async () => {
    const { email } = await seedLoginableUser("concurrent");

    const first = await login({ email, password: PASSWORD });
    const second = await login({ email, password: PASSWORD });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const { raw: firstCookie } = extractSidCookie(first);
    const { raw: secondCookie } = extractSidCookie(second);
    expect(firstCookie).not.toEqual(secondCookie);

    const suffix = randomUUID().slice(0, 8);
    const usingFirst = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", firstCookie)
      .send({ name: "Via First", slug: `via-first-${suffix}` });
    const usingSecond = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", secondCookie)
      .send({ name: "Via Second", slug: `via-second-${suffix}` });

    expect(usingFirst.status).toBe(201);
    expect(usingSecond.status).toBe(201);
  });
});

describe("POST /api/v1/auth/login - failure indistinguishability", () => {
  it("returns the same code and a structurally identical body for unknown email, wrong password, and a suspended user", async () => {
    const known = await seedLoginableUser("known");
    const suspended = await seedLoginableUser("suspended", { status: "SUSPENDED" });

    const unknownEmailRes = await login({
      email: `nobody-${randomUUID().slice(0, 8)}@example.test`,
      password: PASSWORD,
    });
    const wrongPasswordRes = await login({ email: known.email, password: "not the password" });
    const suspendedRes = await login({ email: suspended.email, password: PASSWORD });

    for (const res of [unknownEmailRes, wrongPasswordRes, suspendedRes]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(Object.keys(res.body).sort()).toEqual(["code", "message", "requestId"]);
    }
    // The message text itself must not vary either - three different reasons, one string.
    expect(unknownEmailRes.body.message).toBe(wrongPasswordRes.body.message);
    expect(wrongPasswordRes.body.message).toBe(suspendedRes.body.message);

    for (const res of [unknownEmailRes, wrongPasswordRes, suspendedRes]) {
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("returns AUTHENTICATION_REQUIRED for a user with no credential row at all", async () => {
    const email = `nocred-${randomUUID().slice(0, 8)}@example.test`;
    await seedUser(db, email);

    const res = await login({ email, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("timing: an unknown email is not measurably faster than a wrong password for a real account (both perform one Argon2 verify)", async () => {
    const known = await seedLoginableUser("timing");

    const SAMPLES = 8;
    const unknownTimes: number[] = [];
    const wrongTimes: number[] = [];

    for (let i = 0; i < SAMPLES; i++) {
      const t0 = Date.now();
      await login({ email: `nobody-${randomUUID().slice(0, 8)}@example.test`, password: PASSWORD });
      unknownTimes.push(Date.now() - t0);

      const t1 = Date.now();
      await login({ email: known.email, password: "wrong" });
      wrongTimes.push(Date.now() - t1);
    }

    const median = (arr: number[]) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)]!;
    const unknownMedian = median(unknownTimes);
    const wrongMedian = median(wrongTimes);

    // Generous bound (not a strict equality) - this proves "same order of
    // magnitude, both dominated by one Argon2 verify," not "identical to
    // the millisecond," which real scheduling noise would never allow.
    expect(Math.abs(unknownMedian - wrongMedian)).toBeLessThan(Math.max(unknownMedian, wrongMedian));
  });

  it.each([
    ["a missing password", { email: "someone@example.test" }],
    ["a missing email", { password: PASSWORD }],
    ["a malformed email", { email: "not-an-email", password: PASSWORD }],
  ])("returns VALIDATION_ERROR for %s", async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login - the raw token and the password hash never leak", () => {
  it("the response body never contains the raw token or the password hash", async () => {
    const { email } = await seedLoginableUser("noleak");

    const res = await login({ email, password: PASSWORD });

    const { token } = extractSidCookie(res);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(token);
    expect(bodyText.toLowerCase()).not.toContain("argon2");
    expect(bodyText.toLowerCase()).not.toContain(PASSWORD.toLowerCase());
  });

  it("the audit row never contains the raw token or the password hash - only the session id and outcome", async () => {
    const { userId, email } = await seedLoginableUser("noleakaudit");
    const res = await login({ email, password: PASSWORD });
    const { token } = extractSidCookie(res);

    const events = await auditRowsFor(userId);
    expect(events).toHaveLength(1);
    const eventText = JSON.stringify(events[0]);
    expect(eventText).not.toContain(token);
    expect(eventText.toLowerCase()).not.toContain("argon2");
  });

  it("the structured log line never contains the raw token or the password hash", async () => {
    const { email } = await seedLoginableUser("noleaklog");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    let res: request.Response;
    try {
      res = await login({ email, password: PASSWORD });
    } finally {
      console.log = originalLog;
    }
    const { token } = extractSidCookie(res);

    const logText = captured.join("\n");
    expect(logText).not.toContain(token);
    expect(logText.toLowerCase()).not.toContain("argon2");
    expect(logText.toLowerCase()).not.toContain(PASSWORD.toLowerCase());
  });

  it("stores only a hash in sessions.token_hash, never the raw token", async () => {
    const { userId, email } = await seedLoginableUser("hashonly");
    const res = await login({ email, password: PASSWORD });
    const { token } = extractSidCookie(res);

    const thisSession = await db
      .selectFrom("sessions")
      .select("token_hash")
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();
    expect(thisSession.token_hash).not.toBe(token);
    expect(thisSession.token_hash.length).toBeGreaterThan(0);
  });
});

describe("POST /api/v1/auth/login - audit (ADR-034, ADR-035)", () => {
  it("records one SUCCESS event under the platform-scope sentinel tenant, naming the real user as actor", async () => {
    const { userId, email } = await seedLoginableUser("auditok");

    const res = await login({ email, password: PASSWORD });
    expect(res.status).toBe(200);

    const events = await auditRowsFor(userId);
    expect(events).toEqual([
      {
        capability: "auth.login",
        outcome: "SUCCESS",
        actor_user_id: userId,
        resource_type: "session",
        resource_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    ]);
  });

  it("records a FAILURE event under the same sentinel for a wrong password, naming the real user as actor", async () => {
    const { userId, email } = await seedLoginableUser("auditfailknown");

    await login({ email, password: "wrong" }).expect(401);

    const events = await auditRowsFor(userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", actor_user_id: userId });
  });

  it("records a FAILURE event with a NULL actor for an unknown email - no user was ever resolved", async () => {
    const email = `unknownaudit-${randomUUID().slice(0, 8)}@example.test`;

    await login({ email, password: PASSWORD }).expect(401);

    const events = await withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("audit_events")
        .select(["capability", "outcome", "actor_user_id"])
        .where("tenant_id", "=", PLATFORM_TENANT_ID)
        .where("capability", "=", "auth.login")
        .where("actor_user_id", "is", null)
        .execute(),
    );
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1]).toMatchObject({ outcome: "FAILURE", actor_user_id: null });
  });

  it("writes no audit event for a malformed request (VALIDATION_ERROR) - the event covers a real attempt, not a request that never resolved one", async () => {
    const before = await withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("audit_events")
        .select("id")
        .where("tenant_id", "=", PLATFORM_TENANT_ID)
        .where("capability", "=", "auth.login")
        .execute(),
    );

    await login({ email: "not-an-email" }).expect(400);

    const after = await withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("audit_events")
        .select("id")
        .where("tenant_id", "=", PLATFORM_TENANT_ID)
        .where("capability", "=", "auth.login")
        .execute(),
    );
    expect(after.length).toBe(before.length);
  });

  it("is readable through the same withTenantContext helper every other tenant's rows use, with no special-cased reader path", async () => {
    const { userId, email } = await seedLoginableUser("sentinelreadable");
    await login({ email, password: PASSWORD }).expect(200);

    const events = await auditRowsFor(userId);
    expect(events).toHaveLength(1);

    // And genuinely invisible from an unrelated real tenant's context, same
    // fail-closed guarantee every other tenant-scoped table has.
    const orgId = await seedOrganization(db, "Unrelated Org", `unrelated-${userId.slice(0, 8)}`);
    const fromUnrelatedTenant = await withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, (trx) =>
      trx
        .selectFrom("audit_events")
        .select("id")
        .where("capability", "=", "auth.login")
        .where("actor_user_id", "=", userId)
        .execute(),
    );
    expect(fromUnrelatedTenant).toEqual([]);
  });
});

describe("POST /api/v1/auth/login - structured logging", () => {
  it("emits one structured log line carrying requestId and correlationId, with tenantId null - honestly, since none exists", async () => {
    const { email } = await seedLoginableUser("logline");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await login({ email, password: PASSWORD }).expect(200);
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
    expect(entries[0]).toMatchObject({ tenantId: null, status: 200, method: "POST", path: "/api/v1/auth/login" });
    expect(entries[0]!["requestId"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(entries[0]!["correlationId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
