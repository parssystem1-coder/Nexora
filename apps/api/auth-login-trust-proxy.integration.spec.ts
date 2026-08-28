import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { createTestApp } from "./test-support/create-test-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * RISK_REGISTER.md R-012's "opposite mistake" (B), made concrete rather than
 * left theoretical. `auth-login-rate-limit.integration.spec.ts`'s own live
 * demonstration already proved the SAFE default (`TRUST_PROXY` unset): a
 * forged `X-Forwarded-For` is correctly ignored, because nothing trusts it.
 * This file proves the other side, the one someone will actually flip in
 * production once a real proxy exists: with `TRUST_PROXY` enabled,
 * `X-Forwarded-For` becomes the trusted source for `request.ip`
 * (`platform/http/client-ip.ts`), and therefore becomes exactly as
 * attacker-controlled as R-012 warns — two requests presenting different
 * forged values are throttled as two independent clients, not one.
 *
 * `process.env.TRUST_PROXY` is set for the lifetime of this file's own app
 * instance only (restored in `afterAll`) — `create-app.ts`'s
 * `applyMiddleware` reads it once, at `createApp()`/`createTestApp()` time,
 * via `loadTrustProxyConfig()`, so a fresh app instance is required to pick
 * up a different value; this file's own `beforeAll` builds exactly one such
 * instance, kept separate from every other spec file's own app so no other
 * suite's `TRUST_PROXY` expectations are affected.
 */

const IP_MAX_ATTEMPTS = 30;

let app: INestApplication;
const db = createDb(loadDbConfig());
const previousTrustProxyEnv = process.env.TRUST_PROXY;

function login(body: Record<string, unknown>, forwardedFor: string) {
  return request(app.getHttpServer()).post("/api/v1/auth/login").set("X-Forwarded-For", forwardedFor).send(body);
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the trust-proxy test. Run "docker compose up -d". ${describeDbError(err)}`,
      { cause: err },
    );
  }
  // A single, deliberate hop trusted (Express's `trust proxy: 1`) - enough
  // to make X-Forwarded-For the resolved request.ip, without needing to
  // guess a real topology's exact trusted-proxy list (RISK_REGISTER.md
  // R-012 explicitly says not to).
  process.env.TRUST_PROXY = "1";
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  if (previousTrustProxyEnv === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previousTrustProxyEnv;
});

describe("TRUST_PROXY=1 (opted in): X-Forwarded-For becomes the trusted client IP, and therefore attacker-controlled", () => {
  afterEach(() => {
    // Guard against a future test in this file accidentally depending on
    // env state another test mutated - there is only one right now, but
    // this keeps the file honest as it grows.
    process.env.TRUST_PROXY = "1";
  });

  it("two requests with different forged X-Forwarded-For values are throttled as two independent clients, not one", async () => {
    const forgedIpA = "203.0.113.10";
    const forgedIpB = "203.0.113.20";

    // Exhaust forgedIpA's own per-IP budget - a fresh, unique identifier per
    // attempt, so the per-identifier limit never fires first and confuses
    // which counter actually blocked the request.
    for (let i = 0; i < IP_MAX_ATTEMPTS; i++) {
      const res = await login(
        { email: `trustproxy-a-${randomUUID().slice(0, 8)}@example.test`, password: "wrong" },
        forgedIpA,
      );
      expect(res.status).toBe(401);
    }
    const blockedA = await login(
      { email: `trustproxy-a-${randomUUID().slice(0, 8)}@example.test`, password: "wrong" },
      forgedIpA,
    );
    expect(blockedA.status).toBe(429);
    expect(blockedA.body.code).toBe("RATE_LIMITED");

    // A DIFFERENT forged IP, same real underlying client, must NOT be
    // affected. If X-Forwarded-For were NOT being honored, every request
    // above shares the same real loopback socket address, so this one would
    // ALSO have accumulated against that same counter (31 real failures by
    // now, exceeding IP_MAX_ATTEMPTS) and would come back 429 too. It does
    // not - that is the actual proof, not merely a plausible-sounding claim.
    const resB = await login(
      { email: `trustproxy-b-${randomUUID().slice(0, 8)}@example.test`, password: "wrong" },
      forgedIpB,
    );
    expect(resB.status).toBe(401);
    expect(resB.body.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
