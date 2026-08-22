import { CapabilityError } from "../../capability/contracts/index.js";
import type { PermissionCheckRepository } from "../domain/permission-check.repository.js";

/** 08_PHASE_1_BRIEF.md §2 step 6: permission authorization through the capability policy pipeline. */
export class CheckPermissionService {
  constructor(private readonly repo: PermissionCheckRepository) {}

  async assert(tenantId: string, membershipId: string, permissionKey: string): Promise<void> {
    const allowed = await this.repo.hasPermission(tenantId, membershipId, permissionKey);
    if (!allowed) {
      throw new CapabilityError("FORBIDDEN", `Missing permission '${permissionKey}'.`);
    }
  }
}
