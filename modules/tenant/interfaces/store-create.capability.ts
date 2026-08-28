import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { createStoreInputSchema } from "../application/create-store.input.js";
import { storeOutputSchema } from "../application/read-store.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `store.create`
 * (scope: tenant, risk: MEDIUM_WRITE) and §6.1's worked example
 * (`POST /api/v1/stores`, `{ organizationId, name, slug }` in the body).
 *
 * `route.pathParams` is deliberately empty: unlike `membership.invite` and
 * `membership.role.assign`, this capability's organization scope arrives in
 * the body, not the path. See DECISION_LOG.md "store.create: the route, and
 * why it breaks the organizationId-in-the-path pattern" for why 05 §6.1's
 * explicit worked contract was followed here over the path-based convention
 * the two prior slices established without one.
 *
 * `outputSchema` reuses `storeOutputSchema` (defined for `store.read`)
 * rather than declaring a second, identical shape — both capabilities
 * return the same `StoreDto`.
 *
 * `storeScoped: false`: this capability creates a store, it does not act
 * inside one — no `app.store_id` is ever set for this operation (the
 * controller's `rlsContext.storeId` stays `null` throughout, the same
 * pattern `organization.create` uses for a capability with no pre-existing
 * resource to scope to).
 *
 * `idempotent: false`, the same divergence organization.create,
 * membership.invite and membership.role.assign all record: §4.1 says yes,
 * ADR-009's shared idempotency store is Phase 2, and AGENTS.md §4 forbids a
 * module-local substitute. `UNIQUE (tenant_id, slug)` means a naive retry
 * returns CONFLICT rather than creating a second store. Flip belongs to the
 * ADR-009 slice, on all four capabilities together.
 */
export const storeCreateCapability: CapabilityDefinition = {
  id: "store.create",
  version: "1",
  requiredPermissions: ["store.create"],
  risk: "MEDIUM_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/stores",
    pathParams: [],
    successStatus: 201,
  },
  inputSchema: createStoreInputSchema,
  outputSchema: storeOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "CONFLICT",
    "DOMAIN_RESERVED",
    "CONCURRENCY_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
