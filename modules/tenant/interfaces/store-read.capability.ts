import type { CapabilityDefinition } from "../../capability/contracts/index.js";

/**
 * 03_TECHNICAL_BLUEPRINT.md §2.1's `<capability>.capability.ts` — capability
 * definition metadata. Declared here rather than hardcoded at the call site
 * so the required permission is data the policy step reads, not a string
 * literal duplicated per route. Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's
 * row for `store.read` (scope: store, risk: READ, idempotency: no).
 */
export const storeReadCapability: CapabilityDefinition = {
  id: "store.read",
  version: "1",
  requiredPermissions: ["store.read"],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: true,
};
