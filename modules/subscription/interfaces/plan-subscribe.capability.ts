import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { subscribeToPlanInputSchema, subscriptionOutputSchema } from "../application/subscribe-to-plan.input.js";

/**
 * `05` §4.2's row for `plan.subscribe` (tenant, HIGH_WRITE, idempotency **yes**),
 * owned by `06` item 4 per `PHASE_2_BRIEF.md` §3(a) (INFERRED, ratified D2-13).
 *
 * **`idempotent: true`, and it is the first capability in this codebase where
 * that flag is true and enforced.** §5 records that five Phase 1 capabilities
 * "flip from `idempotent: false` to `true` when item 3 lands" — they have not
 * flipped, because flipping the flag without composing the wrapper would be a
 * declaration nothing enforces, exactly the failure ADR-030 warns about. This
 * one declares it *and* composes `withIdempotentCapability`.
 *
 * `permissions`: `plan.subscribe`, seeded to `owner` and `admin` only —
 * §5's D2-8 rule for every Phase 2 billing permission.
 *
 * `IDEMPOTENCY_CONFLICT` is declared here and is this codebase's first use of
 * it; `05` §7 has documented it since 2.0.
 */
export const planSubscribeCapability: CapabilityDefinition = {
  id: "plan.subscribe",
  version: "1",
  requiredPermissions: ["plan.subscribe"],
  risk: "HIGH_WRITE",
  idempotent: true,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/subscription",
    pathParams: ["organizationId"],
    successStatus: 201,
  },
  inputSchema: subscribeToPlanInputSchema,
  outputSchema: subscriptionOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "SESSION_INVALIDATED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "TENANT_CONTEXT_REQUIRED",
    "RESOURCE_NOT_FOUND",
    "CONFLICT",
    "IDEMPOTENCY_CONFLICT",
    "CONCURRENCY_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
