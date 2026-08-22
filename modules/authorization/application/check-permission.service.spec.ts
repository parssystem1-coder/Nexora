import { describe, it, expect } from "vitest";
import { CheckPermissionService } from "./check-permission.service.js";
import type { PermissionCheckRepository } from "../domain/permission-check.repository.js";

describe("CheckPermissionService", () => {
  it("resolves when the repository reports the permission is granted", async () => {
    const repo: PermissionCheckRepository = { hasPermission: async () => true };
    const service = new CheckPermissionService(repo);
    await expect(service.assert("tenant-1", "membership-1", "store.read")).resolves.toBeUndefined();
  });

  it("throws a FORBIDDEN CapabilityError when the repository reports no matching permission", async () => {
    const repo: PermissionCheckRepository = { hasPermission: async () => false };
    const service = new CheckPermissionService(repo);
    await expect(service.assert("tenant-1", "membership-1", "store.read")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
