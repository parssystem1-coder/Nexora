import { describe, it, expect } from "vitest";
import { RevokeMembershipService } from "./revoke-membership.service.js";
import { Membership } from "../domain/membership.entity.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { RoleGrantRepository } from "../../authorization/contracts/index.js";
import type { SessionRevocationRepository } from "../../identity/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-24T12:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "99999999-9999-9999-9999-999999999999";
const TARGET_MEMBERSHIP = "22222222-2222-2222-2222-222222222222";
const TARGET_USER = "33333333-3333-3333-3333-333333333333";

const COMMAND = { tenantId: TENANT, targetMembershipId: TARGET_MEMBERSHIP };

const activeTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "ACTIVE", CREATED_AT);
const revokedTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "REVOKED", CREATED_AT);
const otherTenantTarget = new Membership(TARGET_MEMBERSHIP, OTHER_TENANT, TARGET_USER, "ACTIVE", CREATED_AT);

function fakes(
  options: {
    target?: Membership | null;
    activeMemberCount?: number;
    isOwner?: boolean;
    activeOwnerCount?: number;
  } = {},
) {
  const revocations: Array<{ userId: string; revokedAt: Date }> = [];
  const revoked: Array<{ membershipId: string; revokedAt: Date }> = [];

  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => null,
    create: async () => {
      throw new Error("RevokeMembershipService must not create memberships.");
    },
    findById: async () => (options.target === undefined ? activeTarget : options.target),
    countActive: async () => options.activeMemberCount ?? 2,
    revoke: async (membershipId, revokedAt) => {
      revoked.push({ membershipId, revokedAt });
    },
  };
  const roleGrants: RoleGrantRepository = {
    grantRoleByKey: async () => {
      throw new Error("RevokeMembershipService must not grant roles.");
    },
    hasRole: async () => options.isOwner ?? false,
    countActiveMembersWithRole: async () => options.activeOwnerCount ?? 2,
  };
  const sessions: SessionRevocationRepository = {
    revokeAllForUser: async (userId, revokedAt) => {
      revocations.push({ userId, revokedAt });
      return 1;
    },
    revokeOne: async () => {
      throw new Error("RevokeMembershipService must not revoke a single session.");
    },
  };

  return { revocations, revoked, service: new RevokeMembershipService(memberships, roleGrants, sessions, clock) };
}

/**
 * The seventh capability (DECISION_LOG.md 2026-08-24). Fast, no-DB
 * counterpart to apps/api/membership-revoke.integration.spec.ts: this
 * isolates the use case's orchestration and refusal logic; the integration
 * test additionally proves the permission check, RLS, and real session
 * invalidation behave as assumed here.
 */
describe("RevokeMembershipService", () => {
  it("revokes the target membership and its sessions, at the clock's current time", async () => {
    const { revoked, revocations, service } = fakes();

    const dto = await service.execute(COMMAND);

    expect(revoked).toEqual([{ membershipId: TARGET_MEMBERSHIP, revokedAt: CREATED_AT }]);
    expect(revocations).toEqual([{ userId: TARGET_USER, revokedAt: CREATED_AT }]);
    expect(dto).toEqual({
      id: TARGET_MEMBERSHIP,
      organizationId: TENANT,
      userId: TARGET_USER,
      status: "REVOKED",
      createdAt: "2026-08-24T12:00:00.000Z",
    });
  });

  it("raises RESOURCE_NOT_FOUND when no membership exists with that id", async () => {
    const { revoked, service } = fakes({ target: null });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(revoked).toEqual([]);
  });

  it("raises RESOURCE_NOT_FOUND, not CONFLICT, when the resolved membership belongs to a DIFFERENT tenant (R-003)", async () => {
    const { revoked, service } = fakes({ target: otherTenantTarget });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(revoked).toEqual([]);
  });

  it("raises CONFLICT, not RESOURCE_NOT_FOUND, for an already-revoked target - a deliberately different choice from membership.role.assign's", async () => {
    const { revoked, service } = fakes({ target: revokedTarget });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(revoked).toEqual([]);
  });

  it("raises CONFLICT and revokes nothing when the target is the organization's only remaining ACTIVE member", async () => {
    const { revoked, revocations, service } = fakes({ activeMemberCount: 1 });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(revoked).toEqual([]);
    expect(revocations).toEqual([]);
  });

  it("raises CONFLICT and revokes nothing when the target holds owner and is the organization's only remaining ACTIVE owner", async () => {
    const { revoked, service } = fakes({ isOwner: true, activeOwnerCount: 1 });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(revoked).toEqual([]);
  });

  it("succeeds when the target holds owner but other ACTIVE owners remain", async () => {
    const { revoked, service } = fakes({ isOwner: true, activeOwnerCount: 2 });

    await expect(service.execute(COMMAND)).resolves.toMatchObject({ status: "REVOKED" });
    expect(revoked).toHaveLength(1);
  });

  it("never checks owner count for a target that does not hold owner", async () => {
    // activeOwnerCount is set to 1 here specifically to prove it is never
    // consulted when hasRole says false - if the service checked it
    // unconditionally this would incorrectly refuse.
    const { service } = fakes({ isOwner: false, activeOwnerCount: 1 });

    await expect(service.execute(COMMAND)).resolves.toMatchObject({ status: "REVOKED" });
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6)", () => {
    expect(RevokeMembershipService.length).toBe(4);
  });
});
