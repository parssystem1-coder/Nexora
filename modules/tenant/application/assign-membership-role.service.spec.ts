import { describe, it, expect } from "vitest";
import { AssignMembershipRoleService } from "./assign-membership-role.service.js";
import { Membership } from "../domain/membership.entity.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import { RoleAlreadyGrantedError, RoleNotInCatalogError } from "../../authorization/contracts/index.js";
import type { RoleGrant, RoleGrantRepository } from "../../authorization/contracts/index.js";
import type { SessionRevocationRepository } from "../../identity/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-23T12:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER_TENANT = "99999999-9999-9999-9999-999999999999";
const TARGET_MEMBERSHIP = "22222222-2222-2222-2222-222222222222";
const TARGET_USER = "33333333-3333-3333-3333-333333333333";
const GRANT_ID = "44444444-4444-4444-4444-444444444444";

const COMMAND = { grantId: GRANT_ID, tenantId: TENANT, targetMembershipId: TARGET_MEMBERSHIP, roleKey: "admin" };

const activeTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "ACTIVE", CREATED_AT);
const revokedTarget = new Membership(TARGET_MEMBERSHIP, TENANT, TARGET_USER, "REVOKED", CREATED_AT);
const otherTenantTarget = new Membership(TARGET_MEMBERSHIP, OTHER_TENANT, TARGET_USER, "ACTIVE", CREATED_AT);

function fakes(options: { target?: Membership | null; onGrant?: () => never } = {}) {
  const grants: RoleGrant[] = [];
  const revocations: Array<{ userId: string; revokedAt: Date }> = [];

  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => null,
    create: async () => {
      throw new Error("AssignMembershipRoleService must not create memberships.");
    },
    findById: async () => (options.target === undefined ? activeTarget : options.target),
    lockActiveForUpdate: async () => {
      throw new Error("AssignMembershipRoleService must not lock active memberships.");
    },
    revoke: async () => {
      throw new Error("AssignMembershipRoleService must not revoke memberships.");
    },
  };
  const roleGrants: RoleGrantRepository = {
    grantRoleByKey: async (grant) => {
      if (options.onGrant) options.onGrant();
      const result: RoleGrant = { id: grant.id, tenantId: grant.tenantId, membershipId: grant.membershipId, roleKey: grant.roleKey, createdAt: grant.createdAt };
      grants.push(result);
      return result;
    },
    hasRole: async () => {
      throw new Error("AssignMembershipRoleService must not check role membership.");
    },
    countActiveMembersWithRole: async () => {
      throw new Error("AssignMembershipRoleService must not count members by role.");
    },
  };
  const sessions: SessionRevocationRepository = {
    revokeAllForUser: async (userId, revokedAt) => {
      revocations.push({ userId, revokedAt });
      return 1;
    },
    revokeOne: async () => {
      throw new Error("AssignMembershipRoleService must not call revokeOne - it revokes every session, not one.");
    },
  };

  return { grants, revocations, service: new AssignMembershipRoleService(memberships, roleGrants, sessions, clock) };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 3, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/membership-role-assign.integration.spec.ts: this isolates the use
 * case's orchestration; the integration test additionally proves the
 * permission check, RLS, the unique index and real session revocation
 * behave as assumed here.
 */
describe("AssignMembershipRoleService", () => {
  it("grants the role to the target membership and returns the documented DTO", async () => {
    const { grants, service } = fakes();

    const dto = await service.execute(COMMAND);

    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ id: GRANT_ID, tenantId: TENANT, membershipId: TARGET_MEMBERSHIP, roleKey: "admin" });
    expect(dto).toEqual({
      id: GRANT_ID,
      organizationId: TENANT,
      membershipId: TARGET_MEMBERSHIP,
      roleKey: "admin",
      createdAt: "2026-08-23T12:00:00.000Z",
    });
  });

  it("revokes every active session belonging to the target user, in the same clock tick as the grant", async () => {
    const { revocations, service } = fakes();

    await service.execute(COMMAND);

    expect(revocations).toEqual([{ userId: TARGET_USER, revokedAt: CREATED_AT }]);
  });

  it("still revokes the caller's own sessions when they assign a role to themselves - an accepted consequence, not a special case", async () => {
    // Nothing here distinguishes "target is the caller" from any other
    // target - AssignMembershipRoleService only ever sees a tenantId and a
    // targetMembershipId. Self-assignment is exercised at the integration
    // layer; this pins that the service itself has no such branch.
    const { revocations, service } = fakes();

    await service.execute(COMMAND);

    expect(revocations).toHaveLength(1);
  });

  it("raises RESOURCE_NOT_FOUND when no membership exists with that id", async () => {
    const { grants, revocations, service } = fakes({ target: null });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(grants).toEqual([]);
    expect(revocations).toEqual([]);
  });

  it("raises RESOURCE_NOT_FOUND for a REVOKED target - same code as nonexistent, following slice 2's enumeration-avoidance precedent", async () => {
    const { grants, service } = fakes({ target: revokedTarget });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(grants).toEqual([]);
  });

  it("raises RESOURCE_NOT_FOUND, not CONFLICT or FORBIDDEN, when the resolved membership belongs to a DIFFERENT tenant (R-003: memberships' self-access RLS clause can surface the caller's own row from another organization)", async () => {
    const { grants, service } = fakes({ target: otherTenantTarget });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(grants).toEqual([]);
  });

  it("maps an existing grant to the documented CONFLICT code, not a raw repository error", async () => {
    const { revocations, service } = fakes({
      onGrant: () => {
        throw new RoleAlreadyGrantedError(TARGET_MEMBERSHIP, "admin");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(revocations).toEqual([]);
  });

  it("lets an unknown-role-catalog failure through unchanged rather than reporting it as CONFLICT (unreachable via the API once the input schema restricts roleKey, but a real typed error if the catalog is ever corrupted)", async () => {
    const { service } = fakes({
      onGrant: () => {
        throw new RoleNotInCatalogError("admin");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toBeInstanceOf(RoleNotInCatalogError);
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6)", () => {
    // Structural pin, same as the other application services': the
    // constructor takes a repository trio and a clock, no audit dependency.
    expect(AssignMembershipRoleService.length).toBe(4);
  });
});
