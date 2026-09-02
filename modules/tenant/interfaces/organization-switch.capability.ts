import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import {
  switchOrganizationInputSchema,
  switchOrganizationOutputSchema,
} from "../application/switch-organization.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `organization.switch`
 * (scope: user, idempotency: no) EXCEPT its risk — 05 declares `READ`, which
 * disagrees with what this capability actually does: `UPDATE sessions SET
 * active_organization_id = ...` is a genuine write, not a read. Declared
 * `LOW_WRITE` here instead, matching `auth.login`/`auth.logout`'s tier for
 * the same reason — a single-row update to a non-tenant-owned column, no
 * broader blast radius. Recorded rather than silently "fixed": DECISION_LOG.md
 * 2026-08-24, decision 3. `idempotent: false` matches 05 exactly — no
 * divergence to record there.
 *
 * `requiredPermissions: []`: every ACTIVE member of an organization may
 * switch to it, regardless of role — there is no finer-grained permission to
 * assert, the same reasoning `auth.logout` applies to ending one's own
 * session. `OrganizationAccessGuard` (steps 2-4) is the actual authorization
 * here: FORBIDDEN for a non-member or a revoked member, before this
 * capability's own code ever runs.
 *
 * `storeScoped: false`: this never resolves or touches a store.
 *
 * §5/§6.1 give no worked route. `POST /api/v1/organizations/{organizationId}
 * /switch` nests under the existing organization, matching
 * `membership.invite`/`membership.role.assign`'s path-parameter convention
 * for a capability naming an EXISTING organization (`organization.create`
 * and `store.create` are flat only because they create their own tenant and
 * have no organizationId to nest under yet).
 */
export const organizationSwitchCapability: CapabilityDefinition = {
  id: "organization.switch",
  version: "1",
  requiredPermissions: [],
  risk: "LOW_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/switch",
    pathParams: ["organizationId"],
    successStatus: 200,
  },
  inputSchema: switchOrganizationInputSchema,
  outputSchema: switchOrganizationOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "SESSION_INVALIDATED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "CONCURRENCY_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
