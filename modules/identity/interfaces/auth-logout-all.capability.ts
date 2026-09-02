import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { logoutAllInputSchema, logoutAllOutputSchema } from "../application/logout-all.input.js";

/**
 * Matches 05_API_CAPABILITY_CONTRACTS.md §4.1's row for `auth.logout_all`
 * (scope: user, risk: MEDIUM_WRITE, idempotency: yes). The capability id
 * uses an underscore; the URL uses a hyphen, `POST /api/v1/auth/logout-all`
 * — consistent with this codebase's kebab-case route segments elsewhere
 * (`membership-role` etc.) — see DECISION_LOG.md 2026-08-24.
 *
 * `requiredPermissions: []`: same reasoning as `auth.logout` — a user always
 * may end all of their own sessions.
 *
 * `idempotent: true` matches 05 §4.1, and — unlike every earlier capability
 * this codebase has recorded an ADR-009 divergence for — genuinely needs
 * none here: there is no idempotency STORE backing this (Phase 2, ADR-009),
 * but the underlying operation ("revoke every ACTIVE session for this user")
 * is naturally idempotent regardless — calling it again after it has already
 * run finds zero ACTIVE sessions left and revokes zero, every time, with no
 * side effect that compounds. The `05 §4.1` "yes" is true of this
 * capability's actual behavior, not merely aspirational the way
 * `organization.create`'s was (DECISION_LOG.md 2026-08-23). See
 * DECISION_LOG.md 2026-08-24, decision 5, for why that is still worth
 * stating explicitly rather than silently inheriting the same boilerplate
 * paragraph `auth.logout` and the four earlier capabilities used.
 *
 * `storeScoped: false`: same reasoning as `auth.login`/`auth.logout` — no
 * transaction is opened.
 */
export const authLogoutAllCapability: CapabilityDefinition = {
  id: "auth.logout_all",
  version: "1",
  requiredPermissions: [],
  risk: "MEDIUM_WRITE",
  idempotent: true,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/auth/logout-all",
    pathParams: [],
    successStatus: 200,
  },
  inputSchema: logoutAllInputSchema,
  outputSchema: logoutAllOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "SESSION_INVALIDATED", "INTERNAL_ERROR"],
};
