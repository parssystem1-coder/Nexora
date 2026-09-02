import { describe, it, expect } from "vitest";
import { SwitchOrganizationService } from "./switch-organization.service.js";
import type { SessionRepository } from "../../identity/contracts/index.js";

const SESSION_ID = "11111111-1111-1111-1111-111111111111";
const ORGANIZATION_ID = "22222222-2222-2222-2222-222222222222";

function fakes() {
  const calls: Array<{ sessionId: string; organizationId: string }> = [];
  const sessions: SessionRepository = {
    findById: async () => {
      throw new Error("SwitchOrganizationService must not resolve a session by id.");
    },
    findByTokenHash: async () => {
      throw new Error("SwitchOrganizationService must not read a session by token.");
    },
    create: async () => {
      throw new Error("SwitchOrganizationService must not create sessions.");
    },
    setActiveOrganization: async (sessionId, organizationId) => {
      calls.push({ sessionId, organizationId });
    },
  };
  return { calls, service: new SwitchOrganizationService(sessions) };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 6, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/organization-switch.integration.spec.ts: this isolates the use
 * case's one piece of orchestration; the integration test additionally
 * proves the guard's membership check, the real column update, and — the
 * rule this whole slice exists to prove — that switching changes nothing
 * about which organizations other requests may act on (ADR-002).
 */
describe("SwitchOrganizationService", () => {
  it("sets the named session's active organization to the named organization", async () => {
    const { calls, service } = fakes();

    await service.execute({ sessionId: SESSION_ID, organizationId: ORGANIZATION_ID });

    expect(calls).toEqual([{ sessionId: SESSION_ID, organizationId: ORGANIZATION_ID }]);
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6, ADR-035)", () => {
    // Structural pin, same as every other application service's: the
    // constructor takes a repository, no audit dependency.
    expect(SwitchOrganizationService.length).toBe(1);
  });
});
