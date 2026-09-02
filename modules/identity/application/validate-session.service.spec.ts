import { describe, it, expect } from "vitest";
import { ValidateSessionService } from "./validate-session.service.js";
import { Session } from "../domain/session.entity.js";
import { User } from "../domain/user.entity.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { Clock } from "../../../platform/clock.js";

const NOW = new Date("2026-08-22T12:00:00Z");
const CREATED_AT = new Date("2026-08-22T10:00:00Z");
const fixedClock: Clock = { now: () => NOW };

/** Never exercised in this spec: ValidateSessionService only reads by token. Present because auth.login added create(), organization.switch added setActiveOrganization(), and ADR-051 added findById() to the port. */
function neverCreateSessions(): Pick<SessionRepository, "create" | "setActiveOrganization" | "findById"> {
  return {
    create: async () => {
      throw new Error("ValidateSessionService must not create sessions.");
    },
    setActiveOrganization: async () => {
      throw new Error("ValidateSessionService must not change the active organization.");
    },
    findById: async () => {
      throw new Error("ValidateSessionService resolves a session by token, never by id.");
    },
  };
}

function service(session: Session | null, user: User | null): ValidateSessionService {
  const sessions: SessionRepository = { findByTokenHash: async () => session, ...neverCreateSessions() };
  const users: UserRepository = {
    findById: async () => user,
    // Never exercised here: ValidateSessionService resolves a user by id.
    // Present because membership.invite added findByEmail to the port.
    findByEmail: async () => null,
  };
  return new ValidateSessionService(sessions, users, fixedClock);
}

describe("ValidateSessionService", () => {
  it("returns the authenticated identity for a valid session and active user", async () => {
    const session = new Session("s1", "u1", "hash", "org-1", "ACTIVE", CREATED_AT, new Date("2026-08-22T13:00:00Z"));
    const user = new User("u1", "u1@example.test", "U1", "ACTIVE");
    const result = await service(session, user).execute("raw-token");
    expect(result).toEqual({
      outcome: "VALID",
      identity: { userId: "u1", sessionId: "s1", activeOrganizationId: "org-1" },
    });
  });

  it("returns INVALID when no session matches the token", async () => {
    const result = await service(null, null).execute("unknown-token");
    expect(result).toEqual({ outcome: "INVALID" });
  });

  it("returns null for an expired session, without querying the user", async () => {
    const session = new Session("s1", "u1", "hash", null, "ACTIVE", CREATED_AT, new Date("2026-08-22T11:00:00Z"));
    let userLookedUp = false;
    const sessions: SessionRepository = { findByTokenHash: async () => session, ...neverCreateSessions() };
    const users: UserRepository = {
      findByEmail: async () => null,
      findById: async () => {
        userLookedUp = true;
        return new User("u1", "u1@example.test", "U1", "ACTIVE");
      },
    };
    const result = await new ValidateSessionService(sessions, users, fixedClock).execute("raw-token");
    expect(result).toEqual({ outcome: "INVALID" });
    expect(userLookedUp).toBe(false);
  });

  it("returns INVALID when the session is valid but the user is suspended", async () => {
    const session = new Session("s1", "u1", "hash", null, "ACTIVE", CREATED_AT, new Date("2026-08-22T13:00:00Z"));
    const user = new User("u1", "u1@example.test", "U1", "SUSPENDED");
    const result = await service(session, user).execute("raw-token");
    expect(result).toEqual({ outcome: "INVALID" });
  });

  /**
   * ADR-051. These three prove the split is exactly one case wide: REVOKED is
   * separated, and the four INVALID cases above stay indistinguishable from
   * each other, which is the token-enumeration property the service's own doc
   * comment protects. A test that only checked "revoked gives REVOKED" would
   * not notice a later change that also started distinguishing "expired".
   */
  it("returns REVOKED for a session that exists and was revoked", async () => {
    const session = new Session("s1", "u1", "hash", null, "REVOKED", CREATED_AT, new Date("2026-08-22T13:00:00Z"));
    const user = new User("u1", "u1@example.test", "U1", "ACTIVE");
    const result = await service(session, user).execute("raw-token");
    expect(result).toEqual({ outcome: "REVOKED" });
  });

  it("reports a revoked session as REVOKED even after it has also expired - revocation is a stored fact, not a function of the clock", async () => {
    const session = new Session("s1", "u1", "hash", null, "REVOKED", CREATED_AT, new Date("2026-08-22T11:00:00Z"));
    const user = new User("u1", "u1@example.test", "U1", "ACTIVE");
    const result = await service(session, user).execute("raw-token");
    expect(result).toEqual({ outcome: "REVOKED" });
  });

  it("does not query the user for a revoked session - the answer is settled before identity matters", async () => {
    const session = new Session("s1", "u1", "hash", null, "REVOKED", CREATED_AT, new Date("2026-08-22T13:00:00Z"));
    let userLookedUp = false;
    const sessions: SessionRepository = { findByTokenHash: async () => session, ...neverCreateSessions() };
    const users: UserRepository = {
      findByEmail: async () => null,
      findById: async () => {
        userLookedUp = true;
        return new User("u1", "u1@example.test", "U1", "ACTIVE");
      },
    };
    const result = await new ValidateSessionService(sessions, users, fixedClock).execute("raw-token");
    expect(result).toEqual({ outcome: "REVOKED" });
    expect(userLookedUp).toBe(false);
  });
});
