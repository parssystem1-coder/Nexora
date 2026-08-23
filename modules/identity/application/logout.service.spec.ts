import { describe, it, expect } from "vitest";
import { LogoutService } from "./logout.service.js";
import type { SessionTerminationRepository } from "../domain/session-revocation.repository.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-24T09:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

function fakes() {
  const revocations: Array<{ sessionId: string; userId: string; revokedAt: Date }> = [];
  const sessions: SessionTerminationRepository = {
    revokeOne: async (sessionId, userId, revokedAt) => {
      revocations.push({ sessionId, userId, revokedAt });
    },
    revokeAll: async () => {
      throw new Error("LogoutService must not call revokeAll - that is LogoutAllService's job.");
    },
  };
  return { revocations, service: new LogoutService(sessions, clock) };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/auth-logout.integration.spec.ts: this isolates the use case's one
 * piece of orchestration (revoke exactly the named session); the integration
 * test additionally proves the real cookie, guard and audit event behave as
 * assumed here.
 */
describe("LogoutService", () => {
  it("revokes exactly the named session for the named user, at the clock's current time", async () => {
    const { revocations, service } = fakes();

    await service.execute({ sessionId: SESSION_ID, userId: USER_ID });

    expect(revocations).toEqual([{ sessionId: SESSION_ID, userId: USER_ID, revokedAt: CREATED_AT }]);
  });

  it("never calls revokeAll - logout ends one session, not every session for the user", async () => {
    const { service } = fakes();
    await expect(service.execute({ sessionId: SESSION_ID, userId: USER_ID })).resolves.toBeUndefined();
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6, ADR-035)", () => {
    // Structural pin, same as every other application service's: the
    // constructor takes a repository and a clock, no audit dependency.
    expect(LogoutService.length).toBe(2);
  });
});
