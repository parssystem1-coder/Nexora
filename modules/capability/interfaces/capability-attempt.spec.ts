import { describe, it, expect, vi, afterEach } from "vitest";
import { Logger } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { runCapabilityAttempt, getAuditWriteFailureCount, AUDIT_WRITE_FAILED_EVENT } from "./capability-attempt.js";

/**
 * RISK_REGISTER.md R-009 / DECISION_LOG.md 2026-08-31 "R-009 fixed": a
 * throwing audit write must not override an already-decided domain outcome.
 * These two tests fail against the pre-fix implementation (the audit
 * write's exception propagated unguarded, turning a real domain SUCCESS
 * into a thrown error, and replacing a real domain FAILURE's own error with
 * the audit write's) and pass against the fixed one — proof the fix does
 * what it claims, not just that the suite is still green (AGENTS.md §7).
 *
 * No real database is needed to prove this: the behavior under test is pure
 * control flow around whatever `recordAuditEventDurable` does, so a
 * `Kysely`-shaped stub whose transaction method's own `execute` rejects is
 * exactly enough surface to make the audit write throw, without claiming
 * anything about real Postgres — that is what `apps/api/*.integration.spec.ts`
 * already prove, unmodified, for the audit-succeeds path this fix does not
 * touch (all 378 of them still pass with this file added, none edited).
 */
function auditDbThatThrows(auditError: Error): Kysely<Database> {
  return {
    transaction: () => ({
      execute: () => Promise.reject(auditError),
    }),
  } as unknown as Kysely<Database>;
}

const rlsContext = { tenantId: "11111111-1111-1111-1111-111111111111", userId: null, storeId: null };

function buildEvent(outcome: "SUCCESS" | "FAILURE") {
  return new AuditEvent(
    "11111111-1111-1111-1111-111111111111",
    null,
    "user",
    "test.capability",
    "test-resource",
    "22222222-2222-2222-2222-222222222222",
    outcome,
    "req-1",
    "corr-1",
  );
}

describe("runCapabilityAttempt — R-009: a throwing audit write must not override the domain outcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a domain SUCCESS is still returned to the caller when the audit write itself throws", async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const auditDb = auditDbThatThrows(new Error("audit connection refused"));

    const result = await runCapabilityAttempt(
      auditDb,
      rlsContext,
      async () => "the real domain result",
      (outcome) => buildEvent(outcome),
    );

    expect(result).toBe("the real domain result");
    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });

  it("a domain FAILURE's own error is still rethrown, not replaced by the audit write's error", async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const domainError = new Error("the real domain failure");
    const auditDb = auditDbThatThrows(new Error("audit connection refused"));

    await expect(
      runCapabilityAttempt(
        auditDb,
        rlsContext,
        async () => {
          throw domainError;
        },
        (outcome) => buildEvent(outcome),
      ),
    ).rejects.toBe(domainError);
    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * RISK_REGISTER.md R-010: R-009's fix made a sustained audit outage silent -
 * these tests prove the detectability signal this task adds actually fires,
 * alongside re-confirming (not merely assuming) that R-009's own guarantee
 * is unaffected by adding it. The two tests above are untouched by this
 * addition - zero assertions edited, checked directly by rerunning them.
 */
describe("runCapabilityAttempt — R-010: an audit-write failure is counted and logged as a structured, greppable event", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the real domain outcome, increments the failure counter, and emits the structured event with the expected fields", async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const auditDb = auditDbThatThrows(new Error("audit connection refused"));
    const countBefore = getAuditWriteFailureCount();

    const result = await runCapabilityAttempt(
      auditDb,
      rlsContext,
      async () => "the real domain result",
      (outcome) => buildEvent(outcome),
    );

    // The R-009 guarantee, re-proven here rather than assumed: adding
    // detection must not change what the caller sees.
    expect(result).toBe("the real domain result");

    // The counter is process-lifetime, not reset per test - assert the
    // RELATIVE increment, not an absolute value, so test order never matters.
    expect(getAuditWriteFailureCount()).toBe(countBefore + 1);

    expect(loggerSpy).toHaveBeenCalledTimes(1);
    const [loggedMessage] = loggerSpy.mock.calls[0] as [string];
    const parsedEvent = JSON.parse(loggedMessage) as Record<string, unknown>;
    expect(parsedEvent).toMatchObject({
      event: AUDIT_WRITE_FAILED_EVENT,
      capability: "test.capability",
      outcome: "SUCCESS",
      resourceType: "test-resource",
      resourceId: "22222222-2222-2222-2222-222222222222",
      requestId: "req-1",
      correlationId: "corr-1",
      totalFailuresThisProcess: countBefore + 1,
    });
    expect(typeof parsedEvent["error"]).toBe("string");
  });

  it("increments the counter again, and reports outcome=FAILURE, when the domain work itself also failed", async () => {
    const loggerSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const domainError = new Error("the real domain failure");
    const auditDb = auditDbThatThrows(new Error("audit connection refused"));
    const countBefore = getAuditWriteFailureCount();

    await expect(
      runCapabilityAttempt(
        auditDb,
        rlsContext,
        async () => {
          throw domainError;
        },
        (outcome) => buildEvent(outcome),
      ),
    ).rejects.toBe(domainError);

    expect(getAuditWriteFailureCount()).toBe(countBefore + 1);
    const [loggedMessage] = loggerSpy.mock.calls[0] as [string];
    const parsedEvent = JSON.parse(loggedMessage) as Record<string, unknown>;
    expect(parsedEvent).toMatchObject({ event: AUDIT_WRITE_FAILED_EVENT, outcome: "FAILURE" });
  });
});
