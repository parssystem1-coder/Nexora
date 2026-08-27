import { describe, it, expect } from "vitest";
import { InviteMemberService } from "./invite-member.service.js";
import { Membership } from "../domain/membership.entity.js";
import { MembershipAlreadyExistsError } from "../domain/membership.repository.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { User, UserRepository } from "../../identity/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-23T11:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const TENANT = "11111111-1111-1111-1111-111111111111";
const MEMBERSHIP = "22222222-2222-2222-2222-222222222222";
const INVITEE = "33333333-3333-3333-3333-333333333333";

const COMMAND = { membershipId: MEMBERSHIP, tenantId: TENANT, email: "Invitee@Example.test" };

const activeUser: User = {
  id: INVITEE,
  email: "invitee@example.test",
  displayName: "Invitee",
  status: "ACTIVE",
  isActive: true,
};
const suspendedUser: User = {
  id: INVITEE,
  email: "invitee@example.test",
  displayName: "Invitee",
  status: "SUSPENDED",
  isActive: false,
};

function fakes(options: { user?: User | null; onCreate?: () => never } = {}) {
  const created: Membership[] = [];
  const lookedUp: string[] = [];

  const users: UserRepository = {
    findById: async () => null,
    findByEmail: async (email) => {
      lookedUp.push(email);
      return options.user === undefined ? activeUser : options.user;
    },
  };
  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => null,
    // Never exercised here: InviteMemberService only writes. Present because
    // membership.role.assign added findById to the port.
    findById: async () => {
      throw new Error("InviteMemberService must not look up memberships by id.");
    },
    create: async (membership) => {
      if (options.onCreate) options.onCreate();
      created.push(membership);
    },
    lockActiveForUpdate: async () => {
      throw new Error("InviteMemberService must not lock active memberships.");
    },
    revoke: async () => {
      throw new Error("InviteMemberService must not revoke memberships.");
    },
  };

  return { created, lookedUp, service: new InviteMemberService(users, memberships, clock) };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 2, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/membership-invite.integration.spec.ts: this isolates the use
 * case's orchestration; the integration test additionally proves the
 * permission check, RLS and the unique index behave as assumed here.
 */
describe("InviteMemberService", () => {
  it("creates an ACTIVE membership for the invited user in the caller's tenant", async () => {
    const { created, service } = fakes();

    const dto = await service.execute(COMMAND);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: MEMBERSHIP,
      tenantId: TENANT,
      userId: INVITEE,
      status: "ACTIVE",
      createdAt: CREATED_AT,
    });
    expect(dto).toEqual({
      id: MEMBERSHIP,
      organizationId: TENANT,
      userId: INVITEE,
      status: "ACTIVE",
      createdAt: "2026-08-23T11:00:00.000Z",
    });
  });

  it("passes the address through untouched, leaving case folding to identity's own lookup rule", async () => {
    const { lookedUp, service } = fakes();

    await service.execute(COMMAND);

    expect(lookedUp).toEqual(["Invitee@Example.test"]);
  });

  it("grants no roles - the new member can do nothing until membership.role.assign", async () => {
    // Structural pin: the constructor takes a user repository, a membership
    // repository and a clock. A RoleGrantRepository appearing here would mean
    // invite had quietly absorbed slice 3's job, contradicting
    // 03_TECHNICAL_BLUEPRINT.md §167's "invite member -> assign role".
    expect(InviteMemberService.length).toBe(3);
  });

  it("raises RESOURCE_NOT_FOUND when no platform user holds that address", async () => {
    const { created, service } = fakes({ user: null });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(created).toEqual([]);
  });

  it("maps an existing membership to the documented CONFLICT code, not a raw repository error", async () => {
    const { service } = fakes({
      onCreate: () => {
        throw new MembershipAlreadyExistsError(TENANT, INVITEE);
      },
    });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets an unexpected repository failure through unchanged rather than reporting it as CONFLICT", async () => {
    const { service } = fakes({
      onCreate: () => {
        throw new Error("connection terminated");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toThrow("connection terminated");
  });

  it("still creates the membership for a SUSPENDED user, because suspension is enforced at authentication", async () => {
    // Deliberate: ValidateSessionService already refuses a suspended user's
    // session, so the row grants nothing. Refusing here would duplicate that
    // rule and need an error code 05 §7 does not define for it.
    const { created, service } = fakes({ user: suspendedUser });

    await service.execute(COMMAND);

    expect(created).toHaveLength(1);
  });
});
