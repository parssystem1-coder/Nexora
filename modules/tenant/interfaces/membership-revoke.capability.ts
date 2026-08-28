import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { revokeMembershipInputSchema } from "../application/revoke-membership.input.js";
import { membershipOutputSchema } from "../application/invite-member.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `membership.revoke`
 * (scope: tenant, risk: HIGH_WRITE). The seventh capability in this
 * codebase, not one of 08_PHASE_1_BRIEF.md §3's six-slice list — see
 * DECISION_LOG.md 2026-08-24 for why it is in scope: exit criterion 4
 * (`08_PHASE_1_BRIEF.md` §6) requires revoking a membership to invalidate
 * active sessions, and no capability existed that could revoke one at all.
 *
 * `requiredPermissions: ["membership.revoke"]`, granted to `owner` ONLY —
 * the same tier and reasoning `membership.role.assign` already established:
 * an admin holding this could revoke an owner's membership, removing every
 * check on their own standing with no approval step to catch it.
 *
 * `idempotent: false`, the same divergence `organization.create`,
 * `membership.invite`, `membership.role.assign` and `store.create` all
 * record: 05 §4.1 says `yes`, ADR-009's shared idempotency store is Phase 2,
 * and `AGENTS.md` §4 forbids a module-local substitute.
 *
 * §5/§6.1 give no worked route. `POST /api/v1/organizations/{organizationId}
 * /memberships/{membershipId}/revoke` nests exactly like
 * `membership.role.assign`'s `/roles` sub-resource, with `/revoke` an
 * explicit action route rather than `DELETE` on the membership resource —
 * `memberships.status` is CHECK-constrained to ('ACTIVE','REVOKED') and 08
 * §5 forbids deleting tenant data, so the row survives; a `DELETE` verb
 * returning success would imply the opposite (DECISION_LOG.md, decision 1).
 * `successStatus: 200`, and the response body echoes the membership with its
 * new `status`, for the same reason — nothing here should read like the
 * resource was destroyed.
 */
export const membershipRevokeCapability: CapabilityDefinition = {
  id: "membership.revoke",
  version: "1",
  requiredPermissions: ["membership.revoke"],
  risk: "HIGH_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/memberships/{membershipId}/revoke",
    pathParams: ["organizationId", "membershipId"],
    successStatus: 200,
  },
  inputSchema: revokeMembershipInputSchema,
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
