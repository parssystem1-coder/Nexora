import { describe, it, expect } from "vitest";
import { ResolveStoreAccessService } from "./resolve-store-access.service.js";
import { StoreMembership } from "../domain/store-membership.entity.js";
import { Membership } from "../domain/membership.entity.js";
import type { StoreMembershipRepository } from "../domain/store-membership.repository.js";
import type { MembershipRepository } from "../domain/membership.repository.js";
import { CapabilityError } from "../../capability/contracts/index.js";

const TENANT = "tenant-1";
const STORE = "store-1";
const USER = "user-1";
const MEMBER_SINCE = new Date("2026-08-22T10:00:00.000Z");

function fakeRepos(options: { storeMembership: StoreMembership | null; membership: Membership | null }) {
  const storeMemberships: StoreMembershipRepository = {
    findByUserAndStore: async () => options.storeMembership,
    // Never exercised here: ResolveStoreAccessService only reads. Present
    // because store.create added create() to the port.
    create: async () => {
      throw new Error("ResolveStoreAccessService must not create store memberships.");
    },
  };
  const memberships: MembershipRepository = {
    findByUserAndTenant: async () => options.membership,
    // Never exercised here: ResolveStoreAccessService only reads by
    // (user, tenant). Present because organization.create added create() and
    // membership.role.assign added findById() to the port.
    create: async () => {
      throw new Error("ResolveStoreAccessService must not create memberships.");
    },
    findById: async () => {
      throw new Error("ResolveStoreAccessService must not look up memberships by id.");
    },
    lockActiveForUpdate: async () => {
      throw new Error("ResolveStoreAccessService must not lock active memberships.");
    },
    revoke: async () => {
      throw new Error("ResolveStoreAccessService must not revoke memberships.");
    },
  };
  return { storeMemberships, memberships };
}

/**
 * 08_PHASE_1_BRIEF.md §5: "store_memberships is checked for every
 * store-scoped read; organization membership alone is not sufficient."
 * Fast, no-DB counterpart to apps/api/store-read.integration.spec.ts's
 * same scenarios — this isolates the exact business rule; the integration
 * test additionally proves RLS actually enforces it.
 */
describe("ResolveStoreAccessService", () => {
  it("grants access and returns the membershipId when both checks pass", async () => {
    const storeMembership = new StoreMembership("sm1", TENANT, STORE, USER);
    const membership = new Membership("m1", TENANT, USER, "ACTIVE", MEMBER_SINCE);
    const { storeMemberships, memberships } = fakeRepos({ storeMembership, membership });
    const service = new ResolveStoreAccessService(storeMemberships, memberships);
    const result = await service.execute(USER, STORE);
    expect(result).toEqual({ tenantId: TENANT, storeId: STORE, membershipId: "m1" });
  });

  it("denies access when there is no store_membership at all, regardless of organization membership", async () => {
    const membership = new Membership("m1", TENANT, USER, "ACTIVE", MEMBER_SINCE);
    const { storeMemberships, memberships } = fakeRepos({ storeMembership: null, membership });
    const service = new ResolveStoreAccessService(storeMemberships, memberships);
    await expect(service.execute(USER, STORE)).rejects.toMatchObject({ code: "STORE_ACCESS_DENIED" });
  });

  it("denies access when store_membership exists but organization membership does not exist", async () => {
    const storeMembership = new StoreMembership("sm1", TENANT, STORE, USER);
    const { storeMemberships, memberships } = fakeRepos({ storeMembership, membership: null });
    const service = new ResolveStoreAccessService(storeMemberships, memberships);
    await expect(service.execute(USER, STORE)).rejects.toBeInstanceOf(CapabilityError);
  });

  it("denies access when store_membership exists but organization membership is REVOKED — checked independently", async () => {
    const storeMembership = new StoreMembership("sm1", TENANT, STORE, USER);
    const membership = new Membership("m1", TENANT, USER, "REVOKED", MEMBER_SINCE);
    const { storeMemberships, memberships } = fakeRepos({ storeMembership, membership });
    const service = new ResolveStoreAccessService(storeMemberships, memberships);
    await expect(service.execute(USER, STORE)).rejects.toMatchObject({ code: "STORE_ACCESS_DENIED" });
  });
});
