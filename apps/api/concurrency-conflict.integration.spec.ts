import { describe, it, expect, afterAll } from "vitest";
import { sql } from "kysely";
import { HttpExceptionFilter } from "../../modules/capability/interfaces/http-exception.filter.js";
import { isConcurrencyFailure } from "../../platform/db/concurrency-error.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * RISK_REGISTER.md R-008's candidate mitigation (2) / decisions/2026-08.md
 * this date: proves the mapping fires against a REAL PostgreSQL deadlock,
 * not a mocked stand-in. `RISK_REGISTER.md` R-008's own investigation
 * already spent 165 attempts trying to reproduce a deadlock through this
 * codebase's actual `membership.revoke` concurrency path and got zero — so
 * this test does not try that path again. Instead it constructs the
 * simplest possible REAL deadlock directly against the same PostgreSQL this
 * whole suite already runs against: two manually-controlled Kysely
 * transactions (`db.startTransaction()`, not the callback form, for
 * precise interleaving) each lock a different row, then each tries to lock
 * the OTHER's row — the textbook cross-wait PostgreSQL's own deadlock
 * detector exists to catch. One of the two promises is guaranteed to
 * reject with a genuine `40P01` once `deadlock_timeout` elapses (Postgres's
 * default, 1s); the other resolves once the aborted side's locks release.
 *
 * `currencies` (money module) is used for the two rows: platform-global
 * reference data, RLS-exempt (`08_PHASE_1_BRIEF.md` §5), so no tenant
 * context needs setting up for two bare manual transactions, and nothing
 * else in this suite ever writes to it, so this cannot interfere with (or
 * be interfered with by) any other concurrently-running test file. Both
 * transactions are always rolled back, never committed — zero lasting
 * change to the seeded data.
 */

const db = createDb(loadDbConfig());

afterAll(async () => {
  await db.destroy();
});

describe("A real PostgreSQL deadlock is mapped to CONCURRENCY_CONFLICT/409, not INTERNAL_ERROR/500", () => {
  it("HttpExceptionFilter maps a genuinely-induced 40P01 to the documented, retryable code", async () => {
    try {
      await sql`select 1`.execute(db);
    } catch (err) {
      throw new Error(
        `Could not reach Postgres for the concurrency-conflict test. Run "docker compose up -d". ${describeDbError(err)}`,
        { cause: err },
      );
    }

    const trxA = await db.startTransaction().execute();
    const trxB = await db.startTransaction().execute();

    let deadlockError: unknown;
    try {
      // Step 1: each transaction locks a different row first.
      await trxA
        .updateTable("currencies")
        .set({ updated_at: new Date().toISOString() })
        .where("code", "=", "USD")
        .execute();
      await trxB
        .updateTable("currencies")
        .set({ updated_at: new Date().toISOString() })
        .where("code", "=", "EUR")
        .execute();

      // Step 2: each now tries to lock the OTHER's row, concurrently - the
      // classic cross-wait. Exactly one of these rejects with a real 40P01.
      const results = await Promise.allSettled([
        trxA
          .updateTable("currencies")
          .set({ updated_at: new Date().toISOString() })
          .where("code", "=", "EUR")
          .execute(),
        trxB
          .updateTable("currencies")
          .set({ updated_at: new Date().toISOString() })
          .where("code", "=", "USD")
          .execute(),
      ]);

      const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rejected, "expected exactly one of the two transactions to be aborted by a real deadlock").toBeDefined();
      deadlockError = rejected!.reason;
    } finally {
      await trxA
        .rollback()
        .execute()
        .catch(() => undefined);
      await trxB
        .rollback()
        .execute()
        .catch(() => undefined);
    }

    // Prove this is genuinely PostgreSQL's own deadlock_detected, not a
    // synthesized stand-in, before trusting anything downstream of it.
    expect((deadlockError as { code?: string }).code).toBe("40P01");
    expect(isConcurrencyFailure(deadlockError)).toBe(true);

    // Now prove the actual HTTP-boundary mapping this task adds, using
    // that SAME real error object - not a mock of what a deadlock might
    // look like.
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

    const filter = new HttpExceptionFilter();
    filter.catch(deadlockError, fakeHost as never);

    expect(statusCode).toBe(409);
    expect(jsonCalls[0]).toMatchObject({
      code: "CONCURRENCY_CONFLICT",
      requestId: "11111111-1111-1111-1111-111111111111",
    });
    // 05 §7's no-leak posture still applies to this new code: no driver
    // detail, no query text, no constraint/table name in the response.
    expect(JSON.stringify(jsonCalls[0])).not.toMatch(/currencies|deadlock_detected|40P01/i);
  });
});
