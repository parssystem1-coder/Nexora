import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { inviteMemberInputSchema, membershipOutputSchema } from "../application/invite-member.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `membership.invite`
 * (scope: tenant, risk: MEDIUM_WRITE), with the same idempotency divergence
 * `organization.create` records: §4.1 says yes, ADR-009's shared store is
 * Phase 2, and AGENTS.md §4 forbids a module-local substitute, so declaring
 * `true` would publish an `Idempotency-Key` guarantee nothing provides.
 * `UNIQUE (tenant_id, user_id)` means a retry returns CONFLICT rather than
 * adding the same person twice. Flip with the ADR-009 slice.
 *
 * Unlike `organization.create`, this capability has a real permission behind
 * it: the caller must already be a member, and their membership must carry a
 * role granting `membership.invite` (owner or admin, per
 * 20260823090000_authorization__add_membership_invite_permission.sql).
 */
export const membershipInviteCapability: CapabilityDefinition = {
  id: "membership.invite",
  version: "1",
  requiredPermissions: ["membership.invite"],
  risk: "MEDIUM_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/memberships",
    pathParams: ["organizationId"],
    successStatus: 201,
  },
  inputSchema: inviteMemberInputSchema,
  outputSchema: membershipOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "RESOURCE_NOT_FOUND",
    "CONFLICT",
    "CONCURRENCY_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
