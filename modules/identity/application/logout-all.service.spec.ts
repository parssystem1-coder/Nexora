import { describe, it, expect } from "vitest";
import { LogoutAllService } from "./logout-all.service.js";
import type { SessionTerminationRepository } from "../domain/session-revocation.repository.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-24T09:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const USER_ID = "22222222-2222-2222-2222-222222222222";

function fakes(revokedCount: number) {
  const calls: Array<{ userId: string; revokedAt: Date }> = [];
  const sessions: SessionTerminationRepository = {
    revokeOne: async () => {
      throw new Error("LogoutAllService must not call revokeOne - that is LogoutService's job.");
    },
    revokeAll: async (userId, revokedAt) => {
      calls.push({ userId, revokedAt });
      return revokedCount;
    },
  };
  return { calls, service: new LogoutAllService(sessions, clock) };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/auth-logout.integration.spec.ts: this isolates the use case's one
 * piece of orchestration (revoke every session for the named user, at the
 * clock's current time, and report how many); the integration test
 * additionally proves the real cookie, guard, self-inclusion and audit event
 * behave as assumed here.
 */
describe("LogoutAllService", () => {
  it("revokes every session for the named user, at the clock's current time, and reports the count", async () => {
    const { calls, service } = fakes(3);

    const result = await service.execute({ userId: USER_ID });

    expect(calls).toEqual([{ userId: USER_ID, revokedAt: CREATED_AT }]);
    expect(result).toEqual({ sessionsRevoked: 3 });
  });

  it("reports zero without error when no ACTIVE session remains - the idempotent case (05 §4.1)", async () => {
    const { service } = fakes(0);
    const result = await service.execute({ userId: USER_ID });
    expect(result).toEqual({ sessionsRevoked: 0 });
  });

  it("never calls revokeOne - logout_all ends every session for the user, not one", async () => {
    const { service } = fakes(1);
    await expect(service.execute({ userId: USER_ID })).resolves.toEqual({ sessionsRevoked: 1 });
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6, ADR-035)", () => {
    expect(LogoutAllService.length).toBe(2);
  });
});
