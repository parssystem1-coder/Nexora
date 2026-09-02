import { describe, it, expect } from "vitest";
import { CheckSessionRevokedService } from "./check-session-revoked.service.js";
import { Session } from "../domain/session.entity.js";
import type { SessionRepository } from "../domain/session.repository.js";

const CREATED_AT = new Date("2026-08-22T10:00:00Z");
const FAR_FUTURE = new Date("2126-01-01T00:00:00Z");
const PAST = new Date("2026-08-22T11:00:00Z");

function service(session: Session | null): CheckSessionRevokedService {
  const sessions: SessionRepository = {
    findById: async () => session,
    findByTokenHash: async () => {
      throw new Error("CheckSessionRevokedService resolves by id, never by token - it is not an authentication path.");
    },
    create: async () => {
      throw new Error("CheckSessionRevokedService must not create sessions.");
    },
    setActiveOrganization: async () => {
      throw new Error("CheckSessionRevokedService must not write.");
    },
  };
  return new CheckSessionRevokedService(sessions);
}

/**
 * ADR-051. This service exists so `OrganizationAccessGuard` can tell "your
 * session was revoked mid-request" (401 `SESSION_INVALIDATED`) from "you are
 * not a member" (403 `FORBIDDEN`). Every case below is a case where that
 * choice is made differently.
 */
describe("CheckSessionRevokedService", () => {
  it("reports a revoked session as revoked", async () => {
    expect(await service(new Session("s1", "u1", "h", null, "REVOKED", CREATED_AT, FAR_FUTURE)).execute("s1")).toBe(
      true,
    );
  });

  it("reports an active session as not revoked - the caller then keeps its FORBIDDEN", async () => {
    expect(await service(new Session("s1", "u1", "h", null, "ACTIVE", CREATED_AT, FAR_FUTURE)).execute("s1")).toBe(
      false,
    );
  });

  it("reports an expired but never-revoked session as NOT revoked - expiry is not revocation, and conflating them would turn every stale session's 403 into a 401", async () => {
    expect(await service(new Session("s1", "u1", "h", null, "ACTIVE", CREATED_AT, PAST)).execute("s1")).toBe(false);
  });

  it("reports a missing session as not revoked - a vanished row must not masquerade as a revoked one", async () => {
    expect(await service(null).execute("gone")).toBe(false);
  });
});
