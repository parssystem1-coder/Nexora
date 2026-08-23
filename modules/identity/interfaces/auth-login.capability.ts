import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { loginInputSchema, loginOutputSchema } from "../application/login.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `auth.login`
 * (scope: global, risk: LOW_WRITE). §5/§6.1 give no worked route for this
 * capability, so `POST /api/v1/auth/login` is chosen fresh, not derived
 * from precedent — see DECISION_LOG.md.
 *
 * `requiredPermissions: []`, for the same structural reason
 * `organization.create` declares it empty: there is no membership yet for a
 * permission check to read. `route.pathParams: []` makes the shared
 * `buildValidationInput` helper (commit 02a7a82) a correct no-op here too —
 * every field arrives in the body.
 *
 * `successStatus: 200`, not 201: unlike `organization.create`/`store.create`,
 * the client's request does not name a resource being created — it asks to
 * be authenticated, with session creation as a side effect it does not
 * address by id. Ordinary login-endpoint convention.
 *
 * `idempotent: false` matches 05 §4.1 exactly (`no`) — the first capability
 * in this codebase with no idempotency divergence to record (decision 9,
 * DECISION_LOG.md): correct as declared, nothing to flip when ADR-009 lands.
 *
 * `storeScoped: false`: this capability has no store and no organization —
 * `app.tenant_id`/`app.store_id` are never set for it at all (no
 * transaction is opened; see LoginService's own comment).
 */
export const authLoginCapability: CapabilityDefinition = {
  id: "auth.login",
  version: "1",
  requiredPermissions: [],
  risk: "LOW_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/auth/login",
    pathParams: [],
    successStatus: 200,
  },
  inputSchema: loginInputSchema,
  outputSchema: loginOutputSchema,
  errorCodes: ["VALIDATION_ERROR", "AUTHENTICATION_REQUIRED", "INTERNAL_ERROR"],
};
