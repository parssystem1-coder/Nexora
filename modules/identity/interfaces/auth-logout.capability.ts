import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { logoutInputSchema, logoutOutputSchema } from "../application/logout.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `auth.logout`
 * (scope: user, risk: LOW_WRITE, idempotency: no). §5/§6.1 give no worked
 * route, so `POST /api/v1/auth/logout` is chosen fresh, consistent with
 * `POST /api/v1/auth/login` — see DECISION_LOG.md 2026-08-24.
 *
 * `requiredPermissions: []`: there is no membership or organization in play
 * to check a permission against — a user always may end their own session,
 * and there is no target other than themself to authorize.
 *
 * `idempotent: false` matches 05 §4.1 exactly (`no`) — no divergence to
 * record. A second call with the same (now-revoked) cookie fails at
 * `SessionGuard` with `AUTHENTICATION_REQUIRED` before this capability ever
 * runs, which is the deliberate contract (DECISION_LOG.md, decision 4), not
 * an accident of guard ordering.
 *
 * `storeScoped: false`: same reasoning as `auth.login` — no transaction is
 * opened at all (`sessions` is RLS-exempt), so `app.tenant_id`/`app.store_id`
 * are never set.
 */
export const authLogoutCapability: CapabilityDefinition = {
  id: "auth.logout",
  version: "1",
  requiredPermissions: [],
  risk: "LOW_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/auth/logout",
    pathParams: [],
    successStatus: 200,
  },
  inputSchema: logoutInputSchema,
  outputSchema: logoutOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "INTERNAL_ERROR"],
};
