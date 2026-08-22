import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { createOrganizationInputSchema, organizationOutputSchema } from "../application/create-organization.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `organization.create`
 * (scope: user, risk: MEDIUM_WRITE) with one deliberate divergence.
 *
 * `requiredPermissions` is empty, and that is structural rather than an
 * omission: the capability's scope is *user*, and the caller holds no
 * membership in the organization until this capability creates one, so there
 * is no `membership_roles` row for a permission check to read. The controller
 * asserts this list is empty rather than silently skipping step 6.
 *
 * `idempotent` is false while §4.1 says yes. ADR-009's shared idempotency
 * store is Phase 2 and AGENTS.md §4 forbids a module-local substitute, so
 * declaring `true` would advertise an `Idempotency-Key` guarantee in the
 * generated OpenAPI that nothing provides. The globally-unique slug index
 * means a naive retry returns CONFLICT rather than creating a second
 * organization. Flip this to `true` with the ADR-009 slice. See
 * DECISION_LOG.md.
 */
export const organizationCreateCapability: CapabilityDefinition = {
  id: "organization.create",
  version: "1",
  requiredPermissions: [],
  risk: "MEDIUM_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: { method: "post", path: "/api/v1/organizations", inputIn: "body", successStatus: 201 },
  inputSchema: createOrganizationInputSchema,
  outputSchema: organizationOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "VALIDATION_ERROR", "CONFLICT", "INTERNAL_ERROR"],
};
