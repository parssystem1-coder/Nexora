import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { sql } from "kysely";
import { createTestApp } from "./create-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * Item 3 repair: modules/capability/interfaces/http-exception.filter.ts
 * previously mapped every NestJS-thrown HttpException to VALIDATION_ERROR
 * while keeping its original status, so e.g. a 404 for an unknown route came
 * back as {code: "VALIDATION_ERROR", ...} with status 404 — a contradiction
 * between the envelope's code and its own HTTP status, and RESOURCE_NOT_FOUND
 * (05_API_CAPABILITY_CONTRACTS.md §7) could never be produced on this path.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the error-contract test. Run "docker compose up -d". ${describeDbError(err)}`,
      { cause: err },
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("stable error contract for framework-level failures", () => {
  it("maps an unknown route's 404 to the documented RESOURCE_NOT_FOUND code, not VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/stores");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
    expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns a status/code pair that agree with each other for a wrong-method request", async () => {
    // NestJS/Express have no built-in 405 behavior for an unmatched
    // method on a route that exists for a different method — this
    // documents whichever status actually comes back, and pins that the
    // code always matches it (the defect this item fixes: a filter that
    // hardcodes one code regardless of the real status).
    const res = await request(app.getHttpServer()).post("/api/v1/stores/00000000-0000-0000-0000-000000000000");

    const expectedCode = res.status === 404 ? "RESOURCE_NOT_FOUND" : res.status === 405 ? "INTERNAL_ERROR" : undefined;
    expect(expectedCode).toBeDefined();
    expect(res.body.code).toBe(expectedCode);
    expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("never leaks a framework message on an unmapped status (500)", async () => {
    // No route in this app currently produces an unmapped HttpException status
    // through normal traffic; this asserts the filter's own contract directly
    // by construction rather than needing to force one through routing.
    const { HttpExceptionFilter } = await import("../../modules/capability/interfaces/http-exception.filter.js");
    const { HttpException } = await import("@nestjs/common");

    const filter = new HttpExceptionFilter();
    const jsonCalls: unknown[] = [];
    let statusCode: number | undefined;
    const fakeResponse = {
      status: (code: number) => {
        statusCode = code;
        return { json: (body: unknown) => jsonCalls.push(body) };
      },
    };
    const fakeHost = {
      switchToHttp: () => ({
        getResponse: () => fakeResponse,
        getRequest: () => ({ requestId: "11111111-1111-1111-1111-111111111111" }),
      }),
    };

    filter.catch(new HttpException("Something with implementation detail leaked", 418), fakeHost as never);

    expect(statusCode).toBe(500);
    expect(jsonCalls[0]).toMatchObject({ code: "INTERNAL_ERROR", message: "An unexpected error occurred." });
    expect(JSON.stringify(jsonCalls[0])).not.toMatch(/implementation detail/);
  });
});
