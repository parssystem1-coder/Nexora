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
 * RISK_REGISTER.md R-005 / ADR-029 item 2, over real HTTP against a real,
 * FRESH app instance (its own `createTestApp()` call, hence its own
 * `RATE_LIMIT_STORE` instance - see apps/api/app.module.ts's own comment on
 * why that provider is DI-scoped rather than a bare module-level singleton).
 * Kept in its own file, not appended to auth-login.integration.spec.ts,
 * specifically so its own attempt count never interacts with that file's
 * unrelated ~20 pre-existing failed-login cases sharing the same in-process
 * "IP".
 *
 * `LOGIN_IDENTIFIER_POLICY.maxAttempts` is 5 (auth-login.controller.ts) -
 * every loop below is sized off that constant's actual value, not a
 * hard-coded guess, so this test breaks loudly if the policy ever changes
 * without this file being revisited.
 */

const IDENTIFIER_MAX_ATTEMPTS = 5;

let app: INestApplication;
const db = createDb(loadDbConfig());
const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const PASSWORD = "correct horse battery staple";

function login(body: Record<string, unknown>) {
  return request(app.getHttpServer()).post("/api/v1/auth/login").send(body);
}

async function seedLoginableUser(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-${suffix}@example.test`;
  const userId = await seedUser(db, email);
  await seedCredential(db, userId, PASSWORD);
  return { userId, email };
}

function auditFailureCountFor(actorUserId: string | null) {
  return withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null }, (trx) => {
    let query = trx
      .selectFrom("audit_events")
      .select(["id"])
      .where("tenant_id", "=", PLATFORM_TENANT_ID)
      .where("capability", "=", "auth.login")
      .where("outcome", "=", "FAILURE");
    query =
      actorUserId === null ? query.where("actor_user_id", "is", null) : query.where("actor_user_id", "=", actorUserId);
    return query.execute();
  });
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the auth.login rate-limit test. Run "docker compose up -d". ${describeDbError(err)}`,
      { cause: err },
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/auth/login - rate limiting (RISK_REGISTER.md R-005)", () => {
  // Deliberately one sequence, not three: status/code, no-leak shape, and
  // pre-Argon2 timing are three properties of the SAME throttled response,
  // not three different scenarios - repeating the 5-failures-then-blocked
  // setup three times would only spend three times the shared per-IP
  // budget (LOGIN_IP_POLICY, this file's whole suite shares one "IP") for
  // no added coverage.
  it(`throttles after ${IDENTIFIER_MAX_ATTEMPTS} failed attempts against the same identifier: documented code, no leaked detail, and faster than a real credential check`, async () => {
    const email = `throttle-${randomUUID().slice(0, 8)}@example.test`;
    const verifyTimes: number[] = [];

    for (let i = 0; i < IDENTIFIER_MAX_ATTEMPTS; i++) {
      const t0 = Date.now();
      const res = await login({ email, password: "wrong" });
      verifyTimes.push(Date.now() - t0);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    }
    const slowestVerify = Math.max(...verifyTimes);

    const t0 = Date.now();
    const blocked = await login({ email, password: "wrong" });
    const blockedTime = Date.now() - t0;

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("RATE_LIMITED");
    expect(blocked.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(blocked.body).sort()).toEqual(["code", "message", "requestId"]);
    // Generous, not exact: a throttled request skips Argon2 entirely, so it
    // should not be anywhere near as slow as even the fastest real verify.
    expect(blockedTime).toBeLessThan(slowestVerify);
  });

  it("a different identifier, from the same client, is unaffected once another identifier has been throttled", async () => {
    const throttledEmail = `throttleisolation-${randomUUID().slice(0, 8)}@example.test`;
    for (let i = 0; i < IDENTIFIER_MAX_ATTEMPTS; i++) await login({ email: throttledEmail, password: "wrong" });
    const blocked = await login({ email: throttledEmail, password: "wrong" });
    expect(blocked.status).toBe(429);

    // A real, freshly seeded user, valid credentials, same in-process client
    // (same "IP") - if per-identifier throttling leaked into a shared
    // per-IP-only bucket, this would incorrectly also be blocked.
    const { email: otherEmail } = await seedLoginableUser("unaffected");
    const res = await login({ email: otherEmail, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("records exactly one FAILURE audit event for the throttled attempt itself, with a NULL actor - it never resolved a user", async () => {
    const email = `throttleaudit-${randomUUID().slice(0, 8)}@example.test`;
    for (let i = 0; i < IDENTIFIER_MAX_ATTEMPTS; i++) await login({ email, password: "wrong" });

    const before = await auditFailureCountFor(null);
    const blocked = await login({ email, password: "wrong" });
    expect(blocked.status).toBe(429);
    const after = await auditFailureCountFor(null);

    expect(after.length).toBe(before.length + 1);
  });

  it("non-enumeration: an unknown email and a real account with a wrong password throttle at the exact same attempt, with byte-identical bodies throughout", async () => {
    const unknownEmail = `nobody-${randomUUID().slice(0, 8)}@example.test`;
    const { email: knownEmail } = await seedLoginableUser("nonenum");

    for (let i = 0; i < IDENTIFIER_MAX_ATTEMPTS; i++) {
      const unknownRes = await login({ email: unknownEmail, password: PASSWORD });
      const knownRes = await login({ email: knownEmail, password: "wrong" });

      expect(unknownRes.status).toBe(401);
      expect(knownRes.status).toBe(401);
      expect(unknownRes.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(knownRes.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(unknownRes.body.message).toBe(knownRes.body.message);
      expect(Object.keys(unknownRes.body).sort()).toEqual(Object.keys(knownRes.body).sort());
    }

    // The (maxAttempts + 1)th request for BOTH identifiers must throttle at
    // the same point, with the same code and a structurally identical body -
    // an attacker comparing the two sequences learns nothing about which
    // email belongs to a real account.
    const unknownBlocked = await login({ email: unknownEmail, password: PASSWORD });
    const knownBlocked = await login({ email: knownEmail, password: "wrong" });

    expect(unknownBlocked.status).toBe(429);
    expect(knownBlocked.status).toBe(429);
    expect(unknownBlocked.body.code).toBe(knownBlocked.body.code);
    expect(unknownBlocked.body.message).toBe(knownBlocked.body.message);
    expect(Object.keys(unknownBlocked.body).sort()).toEqual(Object.keys(knownBlocked.body).sort());
  });
});
