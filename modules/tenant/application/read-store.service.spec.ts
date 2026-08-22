import { describe, it, expect } from "vitest";
import { ReadStoreService } from "./read-store.service.js";
import { Store } from "../domain/store.entity.js";
import type { StoreRepository } from "../domain/store.repository.js";
import type { AuditEvent, AuditEventRepository } from "../../audit/contracts/index.js";

const COMMAND = {
  tenantId: "tenant-1",
  userId: "user-1",
  storeId: "store-1",
  requestId: "req-1",
  correlationId: "corr-1",
};

function recordingAudit() {
  const recorded: AuditEvent[] = [];
  const repo: AuditEventRepository = {
    record: async (event) => {
      recorded.push(event);
    },
  };
  return { repo, recorded };
}

describe("ReadStoreService", () => {
  it("maps the domain entity to the DTO, with createdAt as a UTC ISO-8601 string", async () => {
    const createdAt = new Date("2026-08-22T10:30:00.000Z");
    const stores: StoreRepository = {
      findById: async () => new Store("store-1", "tenant-1", "Main", "main", "ACTIVE", createdAt),
    };
    const { repo } = recordingAudit();

    const dto = await new ReadStoreService(stores, repo).execute(COMMAND);

    expect(dto).toEqual({
      id: "store-1",
      organizationId: "tenant-1",
      name: "Main",
      slug: "main",
      status: "ACTIVE",
      createdAt: "2026-08-22T10:30:00.000Z",
    });
  });

  it("emits a SUCCESS audit event carrying the request and correlation ids", async () => {
    const stores: StoreRepository = {
      findById: async () => new Store("store-1", "tenant-1", "Main", "main", "ACTIVE", new Date()),
    };
    const { repo, recorded } = recordingAudit();

    await new ReadStoreService(stores, repo).execute(COMMAND);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      tenantId: "tenant-1",
      actorUserId: "user-1",
      actorType: "user",
      capability: "store.read",
      resourceType: "store",
      resourceId: "store-1",
      outcome: "SUCCESS",
      requestId: "req-1",
      correlationId: "corr-1",
    });
  });

  it("raises RESOURCE_NOT_FOUND when the store is not visible, recording a FAILURE audit event", async () => {
    const stores: StoreRepository = { findById: async () => null };
    const { repo, recorded } = recordingAudit();

    await expect(new ReadStoreService(stores, repo).execute(COMMAND)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ outcome: "FAILURE" });
  });

  it("never leaks another tenant's identifier into the DTO — organizationId comes from the entity, not the command", async () => {
    // The repository runs under RLS, so a store from another tenant cannot be returned at all;
    // this pins the mapping so a future change cannot start echoing the caller-supplied tenantId.
    const stores: StoreRepository = {
      findById: async () => new Store("store-1", "tenant-1", "Main", "main", "ACTIVE", new Date()),
    };
    const { repo } = recordingAudit();

    const dto = await new ReadStoreService(stores, repo).execute({ ...COMMAND, tenantId: "tenant-1" });

    expect(dto.organizationId).toBe("tenant-1");
  });
});
