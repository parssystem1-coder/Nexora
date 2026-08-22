import { describe, it, expect } from "vitest";
import { ValidateSessionService } from "./validate-session.service.js";
import { Session } from "../domain/session.entity.js";
import { User } from "../domain/user.entity.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { Clock } from "../../../platform/clock.js";

const NOW = new Date("2026-08-22T12:00:00Z");
const fixedClock: Clock = { now: () => NOW };

function service(session: Session | null, user: User | null): ValidateSessionService {
  const sessions: SessionRepository = { findByTokenHash: async () => session };
  const users: UserRepository = { findById: async () => user };
  return new ValidateSessionService(sessions, users, fixedClock);
}

describe("ValidateSessionService", () => {
  it("returns the authenticated identity for a valid session and active user", async () => {
    const session = new Session("s1", "u1", "org-1", "ACTIVE", new Date("2026-08-22T13:00:00Z"));
    const user = new User("u1", "ACTIVE");
    const result = await service(session, user).execute("raw-token");
    expect(result).toEqual({ userId: "u1", sessionId: "s1", activeOrganizationId: "org-1" });
  });

  it("returns null when no session matches the token", async () => {
    const result = await service(null, null).execute("unknown-token");
    expect(result).toBeNull();
  });

  it("returns null for an expired session, without querying the user", async () => {
    const session = new Session("s1", "u1", null, "ACTIVE", new Date("2026-08-22T11:00:00Z"));
    let userLookedUp = false;
    const sessions: SessionRepository = { findByTokenHash: async () => session };
    const users: UserRepository = {
      findById: async () => {
        userLookedUp = true;
        return new User("u1", "ACTIVE");
      },
    };
    const result = await new ValidateSessionService(sessions, users, fixedClock).execute("raw-token");
    expect(result).toBeNull();
    expect(userLookedUp).toBe(false);
  });

  it("returns null when the session is valid but the user is suspended", async () => {
    const session = new Session("s1", "u1", null, "ACTIVE", new Date("2026-08-22T13:00:00Z"));
    const user = new User("u1", "SUSPENDED");
    const result = await service(session, user).execute("raw-token");
    expect(result).toBeNull();
  });
});
