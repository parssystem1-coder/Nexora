import { describe, it, expect } from "vitest";
import { Session } from "./session.entity.js";

const NOW = new Date("2026-08-22T12:00:00Z");

describe("Session.isValid", () => {
  it("is valid when ACTIVE and not yet expired", () => {
    const session = new Session("s1", "u1", null, "ACTIVE", new Date("2026-08-22T13:00:00Z"));
    expect(session.isValid(NOW)).toBe(true);
  });

  it("is invalid once expiresAt has passed", () => {
    const session = new Session("s1", "u1", null, "ACTIVE", new Date("2026-08-22T11:59:59Z"));
    expect(session.isValid(NOW)).toBe(false);
  });

  it("is invalid at the exact expiry instant (half-open: expiresAt is exclusive)", () => {
    const session = new Session("s1", "u1", null, "ACTIVE", NOW);
    expect(session.isValid(NOW)).toBe(false);
  });

  it("is invalid when REVOKED even if not yet expired", () => {
    const session = new Session("s1", "u1", null, "REVOKED", new Date("2026-08-22T13:00:00Z"));
    expect(session.isValid(NOW)).toBe(false);
  });
});
