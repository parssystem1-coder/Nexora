import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { listPlansInputSchema, listPlansOutputSchema } from "../application/list-plans.input.js";

/**
 * Matches `05_API_CAPABILITY_CONTRACTS.md` §4.2's row for `plan.list`
 * (scope: global, risk: READ, idempotency: no). `PHASE_2_BRIEF.md` §3(a)
 * ratifies `06` item 1 as its owning item (INFERRED, D2-13).
 *
 * `requiredPermissions: []`, and this is a decision rather than an omission.
 * The scope is **global**: no organization is resolved, so there is no
 * membership for `CheckPermissionService` to check a permission against — the
 * same reason `auth.logout` declares none. `PHASE_2_BRIEF.md` §5's rule that
 * "every Phase 2 billing permission is granted to `owner` and `admin` only"
 * enumerates the capabilities that **write**, and `plan.list` is not among
 * them; it seeds no `role_permissions` row and needs none.
 *
 * It is nonetheless behind `SessionGuard`. Nothing in the accepted documents
 * rules the plan catalogue public, and an authenticated-by-default read is
 * the reversible choice: opening it later is a decision, while an endpoint
 * that shipped anonymous cannot be closed without breaking a client.
 *
 * `storeScoped: false`: no transaction is opened at all (all three tables are
 * RLS-exempt), so `app.tenant_id`/`app.store_id` are never set — the same
 * accounting `auth.logout` records.
 *
 * `queryParams` is new on `CapabilityRoute` and exists for ADR-036: `limit`
 * and `cursor` arrive in the query string of a GET, which is neither a path
 * parameter nor a request body. ADR-036's verification list requires the
 * generated artifact to document them, and a GET carrying a required JSON
 * body — what the generator produced before this field existed — would have
 * been a false contract.
 */
export const planListCapability: CapabilityDefinition = {
  id: "plan.list",
  version: "1",
  requiredPermissions: [],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "get",
    path: "/api/v1/plans",
    pathParams: [],
    queryParams: ["limit", "cursor"],
    successStatus: 200,
  },
  inputSchema: listPlansInputSchema,
  outputSchema: listPlansOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "SESSION_INVALIDATED", "VALIDATION_ERROR", "INTERNAL_ERROR"],
};
