import { describe, it, expect } from "vitest";
import { ReadStoreService } from "./read-store.service.js";
import { Store } from "../domain/store.entity.js";
import type { StoreRepository } from "../domain/store.repository.js";

const COMMAND = { storeId: "store-1" };

describe("ReadStoreService", () => {
  it("maps the domain entity to the DTO, with createdAt as a UTC ISO-8601 string", async () => {
    const createdAt = new Date("2026-08-22T10:30:00.000Z");
    const stores: StoreRepository = {
      findById: async () => new Store("store-1", "tenant-1", "Main", "main", "ACTIVE", createdAt),
      // Never exercised here: ReadStoreService only reads. Present because
      // store.create added create() to the port.
      create: async () => {
        throw new Error("ReadStoreService must not create stores.");
      },
    };

    const dto = await new ReadStoreService(stores).execute(COMMAND);

    expect(dto).toEqual({
      id: "store-1",
      organizationId: "tenant-1",
      name: "Main",
      slug: "main",
      status: "ACTIVE",
      createdAt: "2026-08-22T10:30:00.000Z",
    });
  });

  it("raises RESOURCE_NOT_FOUND when the store is not visible", async () => {
    const stores: StoreRepository = {
      findById: async () => null,
      create: async () => {
        throw new Error("ReadStoreService must not create stores.");
      },
    };

    await expect(new ReadStoreService(stores).execute(COMMAND)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
  });

  it("never leaks another tenant's identifier into the DTO — organizationId comes from the entity, not the caller", async () => {
    // The repository runs under RLS, so a store from another tenant cannot be returned at all;
    // this pins the mapping so a future change cannot start echoing a caller-supplied tenantId.
    const stores: StoreRepository = {
      findById: async () => new Store("store-1", "tenant-1", "Main", "main", "ACTIVE", new Date()),
      create: async () => {
        throw new Error("ReadStoreService must not create stores.");
      },
    };

    const dto = await new ReadStoreService(stores).execute(COMMAND);

    expect(dto.organizationId).toBe("tenant-1");
  });

  it("does not write an audit event itself — that is step 8, owned by the caller (StoreController)", () => {
    // Structural pin, not a runtime assertion: ReadStoreService's constructor
    // takes only a StoreRepository. If this ever grows an AuditEventRepository
    // parameter again, DECISION_LOG.md's audit-placement design has been
    // reintroduced backwards — audit must stay out of this file.
    expect(ReadStoreService.length).toBe(1);
  });
});
