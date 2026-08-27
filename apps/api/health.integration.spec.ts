import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { AppModule } from "./app.module.js";
import { applyMiddleware } from "./create-app.js";
import { createTestApp } from "./test-support/create-test-app.js";
import { createDb } from "../../platform/db/kysely.js";
import type { Database } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { APP_DB } from "../../platform/db/connections.js";

/**
 * GET /health is not a capability (decisions/2026-08.md) — this is an
 * interface-layer test of its HTTP contract (AGENTS.md §8), the same layer
 * error-contract.integration.spec.ts tests the shared exception filter's
 * contract at, not an application or domain test.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the health test. Run "docker compose up -d". ${describeDbError(err)}`,
      {
        cause: err,
      },
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("GET /health", () => {
  it("returns 200 with a minimal body when the database is reachable", async () => {
    const res = await request(app.getHttpServer()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns 503 with no internal detail when the database is unreachable", async () => {
    // A real, unreachable connection (port 1 refuses immediately) rather than
    // a mocked Kysely — this is a live DB failure, not a simulated one, the
    // same standard AGENTS.md §8 holds tenant-isolation/RLS tests to.
    const unreachableDb: Kysely<Database> = createDb({
      connectionString: "postgresql://nexora_app:nexora_app_dev_only@127.0.0.1:1/nexora",
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_DB)
      .useValue(unreachableDb)
      .compile();
    const downApp = moduleRef.createNestApplication();
    applyMiddleware(downApp);
    await downApp.init();

    try {
      const res = await request(downApp.getHttpServer()).get("/health");

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "error" });
      // 05_API_CAPABILITY_CONTRACTS.md §7's no-leak posture, checked directly
      // on the raw response text: no connection string, credential, host,
      // port, driver name, or stack trace anywhere in the body.
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/nexora_app_dev_only|postgres|ECONNREFUSED|127\.0\.0\.1|:1\b|pg\b/i);
    } finally {
      await downApp.close();
      await unreachableDb.destroy();
    }
  });
});
