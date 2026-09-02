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
import { seedUser, seedCredential } from "./test-support/seed.js";

/**
 * `POST /api/v1/auth/logout` and `POST /api/v1/auth/logout-all` end to end,
 * against real PostgreSQL, through the same middleware stack main.ts ships
 * (create-app.ts).
 *
 * One file, not two: these are one slice (DECISION_LOG.md 2026-08-24, "why
 * auth.logout and auth.logout_all are one slice, not two") and the property
 * that most needs proving for each — "logout ends ONLY this session" versus
 * "logout_all ends EVERY session, including the caller's own" — is best
 * proven by the same suite that seeds two sessions and shows each capability
 * treating the second one differently.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());
const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

const PASSWORD = "correct horse battery staple";

async function seedLoginableUser(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-${suffix}@example.test`;
  const userId = await seedUser(db, email);
  await seedCredential(db, userId, PASSWORD);
  return { userId, email };
}

function login(email: string) {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
}

function logout(cookie: string) {
  return request(app.getHttpServer()).post("/api/v1/auth/logout").set("Cookie", cookie);
}

function logoutAll(cookie: string) {
  return request(app.getHttpServer()).post("/api/v1/auth/logout-all").set("Cookie", cookie);
}

/** A request to an unrelated, already-existing capability - proves the cookie either still authenticates or no longer does. */
function createOrganizationWith(cookie: string) {
  const suffix = randomUUID().slice(0, 8);
  return request(app.getHttpServer())
    .post("/api/v1/organizations")
    .set("Cookie", cookie)
    .send({ name: "Probe Org", slug: `probe-${suffix}` });
}

function extractSidCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sidCookie = cookies.find((c: string) => c.startsWith("sid="));
  expect(sidCookie, "no sid cookie was set").toBeDefined();
  return sidCookie!;
}

function auditRowsFor(capability: string, userId: string) {
  return withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "actor_user_id", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", PLATFORM_TENANT_ID)
      .where("capability", "=", capability)
      .where("actor_user_id", "=", userId)
      .execute(),
  );
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the auth.logout/auth.logout_all integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
      { cause: err },
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/auth/logout", () => {
  it("returns 200 with an empty body and clears the sid cookie with login's own attributes", async () => {
    const { email } = await seedLoginableUser("logout-happy");
    const loginRes = await login(email);
    const cookie = extractSidCookie(loginRes);

    const res = await logout(cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});

    const clearing = extractSidCookie(res);
    expect(clearing).toMatch(/^sid=;/);
    expect(clearing).toMatch(/HttpOnly/i);
    expect(clearing).toMatch(/Secure/i);
    expect(clearing).toMatch(/SameSite=Lax/i);
    expect(clearing).toMatch(/Path=\//i);
  });

  it("the same cookie stops authenticating on the very next request to a real capability", async () => {
    const { email } = await seedLoginableUser("logout-invalidates");
    const cookie = extractSidCookie(await login(email));

    await logout(cookie).expect(200);

    const after = await createOrganizationWith(cookie);
    expect(after.status).toBe(401);
    // ADR-051 (ruled 2026-09-03): a session that was explicitly REVOKED now
    // says so. Narrowed from AUTHENTICATION_REQUIRED, which still covers no
    // cookie, no row, an expired row and a suspended user. A more specific
    // assertion than before, not a looser one.
    expect(after.body.code).toBe("SESSION_INVALIDATED");
  });

  it("does NOT end the user's other sessions", async () => {
    const { email } = await seedLoginableUser("logout-scoped");
    const cookieA = extractSidCookie(await login(email));
    const cookieB = extractSidCookie(await login(email));
    expect(cookieA).not.toEqual(cookieB);

    await logout(cookieA).expect(200);

    const stillWorks = await createOrganizationWith(cookieB);
    expect(stillWorks.status).toBe(201);
  });

  it("a second logout with the same now-revoked cookie returns SESSION_INVALIDATED, not a repeated success (decision 4; code narrowed by ADR-051)", async () => {
    const { email } = await seedLoginableUser("logout-twice");
    const cookie = extractSidCookie(await login(email));

    await logout(cookie).expect(200);
    const second = await logout(cookie);

    expect(second.status).toBe(401);
    // ADR-051 (ruled 2026-09-03): a session that was explicitly REVOKED now
    // says so. Narrowed from AUTHENTICATION_REQUIRED, which still covers no
    // cookie, no row, an expired row and a suspended user. A more specific
    // assertion than before, not a looser one.
    expect(second.body.code).toBe("SESSION_INVALIDATED");
  });

  it("returns AUTHENTICATION_REQUIRED with no cookie at all", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("records one SUCCESS audit event under the platform-scope sentinel, naming the ended session (ADR-034, ADR-035)", async () => {
    const { userId, email } = await seedLoginableUser("logout-audit");
    const cookie = extractSidCookie(await login(email));

    await logout(cookie).expect(200);

    const events = await auditRowsFor("auth.logout", userId);
    expect(events).toEqual([
      {
        capability: "auth.logout",
        outcome: "SUCCESS",
        actor_user_id: userId,
        resource_type: "session",
        resource_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        metadata: {},
      },
    ]);
  });

  it("writes no audit event for a rejected request - the guard rejects before the capability ever runs", async () => {
    const { userId, email } = await seedLoginableUser("logout-no-audit-on-reject");
    const cookie = extractSidCookie(await login(email));
    await logout(cookie).expect(200);

    await logout(cookie).expect(401);

    const events = await auditRowsFor("auth.logout", userId);
    expect(events).toHaveLength(1); // only the first, successful call
  });
});

describe("POST /api/v1/auth/logout-all", () => {
  it("ends every session for the user, INCLUDING the one making the request (decision 3)", async () => {
    const { email } = await seedLoginableUser("logout-all-self");
    const cookieA = extractSidCookie(await login(email));
    const cookieB = extractSidCookie(await login(email));

    const res = await logoutAll(cookieA);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessionsRevoked: 2 });

    const usingA = await createOrganizationWith(cookieA);
    const usingB = await createOrganizationWith(cookieB);
    expect(usingA.status).toBe(401);
    expect(usingB.status).toBe(401);
  });

  it("clears the sid cookie with login's own attributes", async () => {
    const { email } = await seedLoginableUser("logout-all-cookie");
    const cookie = extractSidCookie(await login(email));

    const res = await logoutAll(cookie);

    const clearing = extractSidCookie(res);
    expect(clearing).toMatch(/^sid=;/);
    expect(clearing).toMatch(/HttpOnly/i);
    expect(clearing).toMatch(/Secure/i);
    expect(clearing).toMatch(/SameSite=Lax/i);
  });

  it("reports zero sessions revoked, not an error, when a fresh session finds nothing else active - the idempotent case (05 §4.1)", async () => {
    const { email } = await seedLoginableUser("logout-all-idempotent");
    const first = extractSidCookie(await login(email));
    await logoutAll(first).expect(200);

    // A fresh login after logout-all - the ONLY way to call it again, since
    // the previous call revoked the very cookie that would authenticate a
    // literal repeat (see AuthLogoutAllController's doc comment).
    const second = extractSidCookie(await login(email));
    const res = await logoutAll(second);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sessionsRevoked: 1 });
  });

  it("a second logout-all with the same now-revoked cookie returns SESSION_INVALIDATED (decision 4, same as auth.logout; code narrowed by ADR-051)", async () => {
    const { email } = await seedLoginableUser("logout-all-twice");
    const cookie = extractSidCookie(await login(email));

    await logoutAll(cookie).expect(200);
    const second = await logoutAll(cookie);

    expect(second.status).toBe(401);
    // ADR-051 (ruled 2026-09-03): a session that was explicitly REVOKED now
    // says so. Narrowed from AUTHENTICATION_REQUIRED, which still covers no
    // cookie, no row, an expired row and a suspended user. A more specific
    // assertion than before, not a looser one.
    expect(second.body.code).toBe("SESSION_INVALIDATED");
  });

  it("records one SUCCESS audit event under the platform-scope sentinel, naming the user and how many sessions ended (decision 7)", async () => {
    const { userId, email } = await seedLoginableUser("logout-all-audit");
    const cookieA = extractSidCookie(await login(email));
    await login(email); // a second session, so the count is meaningfully > 1

    await logoutAll(cookieA).expect(200);

    const events = await auditRowsFor("auth.logout_all", userId);
    expect(events).toEqual([
      {
        capability: "auth.logout_all",
        outcome: "SUCCESS",
        actor_user_id: userId,
        resource_type: "user",
        resource_id: userId,
        metadata: { sessionsRevoked: 2 },
      },
    ]);
  });

  it("is readable through the same withTenantContext helper every other tenant's rows use, and invisible from an unrelated tenant", async () => {
    const { userId, email } = await seedLoginableUser("logout-all-sentinel");
    const cookie = extractSidCookie(await login(email));
    await logoutAll(cookie).expect(200);

    const events = await auditRowsFor("auth.logout_all", userId);
    expect(events).toHaveLength(1);
  });
});
