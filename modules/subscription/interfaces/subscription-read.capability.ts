import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { readSubscriptionInputSchema, subscriptionOutputSchema } from "../application/read-subscription.input.js";

/**
 * `05` §4.2's row for `subscription.read` (tenant, READ, idempotency no), owned
 * by `06` item 4 per `PHASE_2_BRIEF.md` §3(a) (INFERRED, ratified D2-13).
 *
 * Granted to `owner` and `admin` only, which is narrower than `store.read`'s
 * all-three-roles precedent — §5 names that difference explicitly for Phase 2
 * billing permissions, and a subscription record carries the organization's
 * commercial standing rather than a store's name.
 */
export const subscriptionReadCapability: CapabilityDefinition = {
  id: "subscription.read",
  version: "1",
  requiredPermissions: ["subscription.read"],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "get",
    path: "/api/v1/organizations/{organizationId}/subscription",
    pathParams: ["organizationId"],
    successStatus: 200,
  },
  inputSchema: readSubscriptionInputSchema,
  outputSchema: subscriptionOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "SESSION_INVALIDATED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "TENANT_CONTEXT_REQUIRED",
    "RESOURCE_NOT_FOUND",
    "INTERNAL_ERROR",
  ],
};
