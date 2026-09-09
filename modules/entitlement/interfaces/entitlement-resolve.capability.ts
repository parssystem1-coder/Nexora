import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import {
  resolveEntitlementInputSchema,
  resolveEntitlementOutputSchema,
} from "../application/resolve-entitlement.input.js";

/**
 * `05` §4.2's row for `entitlement.resolve` (tenant, READ, idempotency no),
 * owned by `06` item 6 per `PHASE_2_BRIEF.md` §3(a) — EXPLICIT there, unlike
 * most of the phase's mapping.
 *
 * **No idempotency wrapper**: `05` §4.2 declares it not idempotent and ADR-038
 * item 7 covers exactly this — "a non-idempotent capability composes only the
 * outer function". A READ has nothing to replay.
 *
 * `featureKey` is a query parameter, using the field item 1 added to
 * `CapabilityRoute` for ADR-036's `limit`/`cursor`. **This capability is not
 * paginated** — see the input schema for why ADR-036 does not apply to a
 * non-collection — but the query-parameter mechanism is general and this is its
 * second user.
 */
export const entitlementResolveCapability: CapabilityDefinition = {
  id: "entitlement.resolve",
  version: "1",
  requiredPermissions: ["entitlement.resolve"],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "get",
    path: "/api/v1/organizations/{organizationId}/entitlements",
    pathParams: ["organizationId"],
    queryParams: ["featureKey"],
    successStatus: 200,
  },
  inputSchema: resolveEntitlementInputSchema,
  outputSchema: resolveEntitlementOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "SESSION_INVALIDATED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "TENANT_CONTEXT_REQUIRED",
    "ENTITLEMENT_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
