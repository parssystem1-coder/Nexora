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
const OTHER_MEMBERSHIP = "44444444-4444-4444-4444-444444444444";
const OTHER_USER = "55555555-5555-5555-5555-555555555555";

const COMMAND = { tenantId: TENANT, targetMembershipId: TARGET_MEMBERSHIP };

const activeTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "ACTIVE", CREATED_AT);
const revokedTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "REVOKED", CREATED_AT);
const otherTenantTarget = new Membership(TARGET_MEMBERSHIP, OTHER_TENANT, TARGET_USER, "ACTIVE", CREATED_AT);
const otherActiveMember = new Membership(OTHER_MEMBERSHIP, TENANT, OTHER_USER, "ACTIVE", CREATED_AT);

function fakes(
  options: {
    target?: Membership | null;
    /** What `lockActiveForUpdate` returns — the locked, currently-ACTIVE set for the tenant. Defaults to [target, one other], i.e. "not the last member." */
    lockedActive?: Membership[];
    isOwner?: boolean;
    activeOwnerCount?: number;
  } = {},
) {
  const revocations: Array<{ userId: string; revokedAt: Date }> = [];
  const revoked: Array<{ membershipId: string; revokedAt: Date }> = [];
  const target = options.target === undefined ? activeTarget : options.target;
  const lockedActive = options.lockedActive ?? [activeTarget, otherActiveMember];

  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => null,
    create: async () => {
      throw new Error("RevokeMembershipService must not create memberships.");
    },
    findById: async () => target,
    lockActiveForUpdate: async () => {
      if (target === null || target.tenantId !== COMMAND.tenantId) {
        throw new Error("RevokeMembershipService must not lock anything once findById has already refused (not-found/wrong-tenant).");
      }
      return lockedActive;
    },
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
 * test additionally proves the permission check, RLS, and — since
 * DECISION_LOG.md 2026-08-24 ("membership.revoke: closing the
 * last-owner/last-member race") — genuine concurrent-request behavior, none
 * of which a fake repository can prove. `lockActiveForUpdate` here is a
 * plain in-memory stand-in with no actual locking semantics; it exists to
 * prove this service's orchestration reads the LOCKED set (not `target`'s
 * own possibly-stale snapshot) for its "already revoked"/"last member"
 * decisions, not to prove the lock itself does anything under concurrency.
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

  it("raises RESOURCE_NOT_FOUND when no membership exists with that id, and never locks anything", async () => {
    const { revoked, service } = fakes({ target: null });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(revoked).toEqual([]);
  });

  it("raises RESOURCE_NOT_FOUND, not CONFLICT, when the resolved membership belongs to a DIFFERENT tenant (R-003), and never locks anything", async () => {
    const { revoked, service } = fakes({ target: otherTenantTarget });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(revoked).toEqual([]);
  });

  it("raises CONFLICT, not RESOURCE_NOT_FOUND, for an already-revoked target - a deliberately different choice from membership.role.assign's", async () => {
    // The locked, currently-ACTIVE set does not contain the target's id -
    // the same thing a real REVOKED row would produce, since
    // lockActiveForUpdate filters status='ACTIVE'.
    const { revoked, service } = fakes({ target: revokedTarget, lockedActive: [otherActiveMember] });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(revoked).toEqual([]);
  });

  it("raises CONFLICT and revokes nothing when the target is the organization's only remaining ACTIVE member", async () => {
    const { revoked, revocations, service } = fakes({ lockedActive: [activeTarget] });

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
