import { describe, it, expect } from "vitest";
import { CreateOrganizationService } from "./create-organization.service.js";
import { Organization } from "../domain/organization.entity.js";
import { OrganizationSlugTakenError } from "../domain/organization.repository.js";
import type { OrganizationRepository } from "../domain/organization.repository.js";
import type { Membership } from "../domain/membership.entity.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import type { RoleGrantRepository } from "../../authorization/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-23T09:15:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const COMMAND = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  creatorUserId: "user-1",
  name: "Acme",
  slug: "acme",
};

interface Recorder {
  organizations: Organization[];
  memberships: Membership[];
  grants: Array<{ tenantId: string; membershipId: string; roleKey: string }>;
}

function fakes(options: { onCreate?: () => never } = {}) {
  const recorded: Recorder = { organizations: [], memberships: [], grants: [] };

  const organizations: OrganizationRepository = {
    create: async (organization) => {
      if (options.onCreate) options.onCreate();
      recorded.organizations.push(organization);
    },
  };
  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => null,
    create: async (membership) => {
      recorded.memberships.push(membership);
    },
  };
  const roleGrants: RoleGrantRepository = {
    grantRoleByKey: async (tenantId, membershipId, roleKey) => {
      recorded.grants.push({ tenantId, membershipId, roleKey });
    },
  };

  return { recorded, service: new CreateOrganizationService(organizations, memberships, roleGrants, clock) };
}

/**
 * 08_PHASE_1_BRIEF.md §2 step 7 for organization.create. Fast, no-DB
 * counterpart to apps/api/organization-create.integration.spec.ts: this
 * isolates the use case's orchestration; the integration test additionally
 * proves RLS, the unique index and the audit write behave as assumed here.
 */
describe("CreateOrganizationService", () => {
  it("creates the organization with its id mirrored as the tenant id and the clock's timestamp", async () => {
    const { recorded, service } = fakes();

    const dto = await service.execute(COMMAND);

    expect(recorded.organizations).toHaveLength(1);
    expect(recorded.organizations[0]!.tenantId).toBe(COMMAND.organizationId);
    expect(recorded.organizations[0]!.createdAt).toBe(CREATED_AT);
    expect(dto).toEqual({
      id: COMMAND.organizationId,
      name: "Acme",
      slug: "acme",
      status: "ACTIVE",
      createdAt: "2026-08-23T09:15:00.000Z",
    });
  });

  it("makes the creator an ACTIVE member of the new organization and grants them the owner role", async () => {
    const { recorded, service } = fakes();

    await service.execute(COMMAND);

    expect(recorded.memberships).toHaveLength(1);
    expect(recorded.memberships[0]).toMatchObject({
      tenantId: COMMAND.organizationId,
      userId: "user-1",
      status: "ACTIVE",
    });
    expect(recorded.grants).toEqual([
      { tenantId: COMMAND.organizationId, membershipId: recorded.memberships[0]!.id, roleKey: "owner" },
    ]);
  });

  it("maps a taken slug to the documented CONFLICT code, not a raw repository error", async () => {
    const { service } = fakes({
      onCreate: () => {
        throw new OrganizationSlugTakenError("acme");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { slug: "acme" },
    });
  });

  it("creates no membership and grants no role when the organization itself could not be created", async () => {
    const { recorded, service } = fakes({
      onCreate: () => {
        throw new OrganizationSlugTakenError("acme");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toThrow();

    expect(recorded.memberships).toEqual([]);
    expect(recorded.grants).toEqual([]);
  });

  it("lets an unexpected repository failure through unchanged rather than reporting it as CONFLICT", async () => {
    const { service } = fakes({
      onCreate: () => {
        throw new Error("connection terminated");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toThrow("connection terminated");
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6)", () => {
    // Structural pin, same as ReadStoreService's: the constructor takes a
    // repository trio and a clock, and must never grow an audit dependency.
    expect(CreateOrganizationService.length).toBe(4);
  });
});
