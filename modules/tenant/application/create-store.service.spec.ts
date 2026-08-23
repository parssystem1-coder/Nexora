import { describe, it, expect } from "vitest";
import { CreateStoreService } from "./create-store.service.js";
import { Store } from "../domain/store.entity.js";
import { StoreSlugTakenError } from "../domain/store.repository.js";
import type { StoreRepository } from "../domain/store.repository.js";
import { StoreMembership } from "../domain/store-membership.entity.js";
import type { StoreMembershipRepository } from "../domain/store-membership.repository.js";
import type { ReservedSubdomainRepository } from "../domain/reserved-subdomain.repository.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-23T13:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const COMMAND = {
  storeId: "11111111-1111-1111-1111-111111111111",
  tenantId: "22222222-2222-2222-2222-222222222222",
  creatorUserId: "user-1",
  name: "Main Store",
  slug: "main-store",
};

function fakes(options: { reserved?: boolean; onStoreCreate?: () => never } = {}) {
  const stores: Store[] = [];
  const storeMemberships: StoreMembership[] = [];
  const reservedChecks: string[] = [];

  const storeRepo: StoreRepository = {
    findById: async () => null,
    create: async (store) => {
      if (options.onStoreCreate) options.onStoreCreate();
      stores.push(store);
    },
  };
  const storeMembershipRepo: StoreMembershipRepository = {
    findByUserAndStore: async () => null,
    create: async (storeMembership) => {
      storeMemberships.push(storeMembership);
    },
  };
  const reservedSubdomains: ReservedSubdomainRepository = {
    isReserved: async (slug) => {
      reservedChecks.push(slug);
      return options.reserved ?? false;
    },
  };

  return {
    stores,
    storeMemberships,
    reservedChecks,
    service: new CreateStoreService(storeRepo, storeMembershipRepo, reservedSubdomains, clock),
  };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 4, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/store-create.integration.spec.ts: this isolates the use case's
 * orchestration; the integration test additionally proves the permission
 * check, RLS, the unique index and the reserved-subdomains seed behave as
 * assumed here.
 */
describe("CreateStoreService", () => {
  it("creates the store and returns the documented DTO", async () => {
    const { stores, service } = fakes();

    const dto = await service.execute(COMMAND);

    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({
      id: COMMAND.storeId,
      tenantId: COMMAND.tenantId,
      name: "Main Store",
      slug: "main-store",
      status: "ACTIVE",
      createdAt: CREATED_AT,
    });
    expect(dto).toEqual({
      id: COMMAND.storeId,
      organizationId: COMMAND.tenantId,
      name: "Main Store",
      slug: "main-store",
      status: "ACTIVE",
      createdAt: "2026-08-23T13:00:00.000Z",
    });
  });

  it("makes the creator a store member of the new store, in the same tenant", async () => {
    const { storeMemberships, service } = fakes();

    await service.execute(COMMAND);

    expect(storeMemberships).toHaveLength(1);
    expect(storeMemberships[0]).toMatchObject({
      tenantId: COMMAND.tenantId,
      storeId: COMMAND.storeId,
      userId: COMMAND.creatorUserId,
    });
  });

  it("checks reserved_subdomains before attempting the insert, with the exact (already-normalized) slug", async () => {
    const { reservedChecks, service } = fakes();

    await service.execute(COMMAND);

    expect(reservedChecks).toEqual(["main-store"]);
  });

  it("raises DOMAIN_RESERVED for a reserved slug, and never attempts to create the store", async () => {
    const { stores, storeMemberships, service } = fakes({ reserved: true });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({
      code: "DOMAIN_RESERVED",
      details: { slug: "main-store" },
    });
    expect(stores).toEqual([]);
    expect(storeMemberships).toEqual([]);
  });

  it("maps a taken slug to the documented CONFLICT code, not a raw repository error", async () => {
    const { service } = fakes({
      onStoreCreate: () => {
        throw new StoreSlugTakenError("main-store");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toMatchObject({
      code: "CONFLICT",
      details: { slug: "main-store" },
    });
  });

  it("creates no store membership when the store itself could not be created", async () => {
    const { storeMemberships, service } = fakes({
      onStoreCreate: () => {
        throw new StoreSlugTakenError("main-store");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toThrow();

    expect(storeMemberships).toEqual([]);
  });

  it("lets an unexpected repository failure through unchanged rather than reporting it as CONFLICT", async () => {
    const { service } = fakes({
      onStoreCreate: () => {
        throw new Error("connection terminated");
      },
    });

    await expect(service.execute(COMMAND)).rejects.toThrow("connection terminated");
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6)", () => {
    // Structural pin, same as the other application services': the
    // constructor takes a repository trio and a clock, no audit dependency.
    expect(CreateStoreService.length).toBe(4);
  });
});
