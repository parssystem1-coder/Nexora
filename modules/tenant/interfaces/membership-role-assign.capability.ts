import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import {
  assignMembershipRoleInputSchema,
  membershipRoleOutputSchema,
} from "../application/assign-membership-role.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for
 * `membership.role.assign` (scope: tenant, risk: HIGH_WRITE).
 *
 * `requiredPermissions: ["membership.role.assign"]`, granted to `owner`
 * ONLY by 20260823100000_authorization__add_membership_role_assign_permission.sql
 * — unlike membership.invite (owner+admin), this deliberately excludes
 * admin: an admin holding this permission could grant `owner` to themselves
 * or anyone, escalating past their own ceiling with no approval mechanism to
 * catch it. See DECISION_LOG.md.
 *
 * `idempotent: false`, the same divergence organization.create and
 * membership.invite record: §4.1 says yes, ADR-009's shared idempotency
 * store is Phase 2, and AGENTS.md §4 forbids a module-local substitute.
 * `UNIQUE (membership_id, role_id)` means a retry returns CONFLICT rather
 * than granting the same role twice. Flip with the ADR-009 slice.
 *
 * HIGH_WRITE currently buys nothing beyond the permission check every other
 * risk tier also gets — `CapabilityDefinition` has no `approval` field
 * (ADR-001's approval flow is Phase 9), so this is enforced purely by
 * restricting the permission to `owner`. See DECISION_LOG.md
 * "membership.role.assign: who may call it, and why HIGH_WRITE buys nothing
 * extra yet".
 */
export const membershipRoleAssignCapability: CapabilityDefinition = {
  id: "membership.role.assign",
  version: "1",
  requiredPermissions: ["membership.role.assign"],
  risk: "HIGH_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/memberships/{membershipId}/roles",
    pathParams: ["organizationId", "membershipId"],
    successStatus: 201,
  },
  inputSchema: assignMembershipRoleInputSchema,
  outputSchema: membershipRoleOutputSchema,
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
