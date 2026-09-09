import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { cancelSubscriptionInputSchema, subscriptionOutputSchema } from "../application/cancel-subscription.input.js";

/**
 * `05` §4.2's row for `subscription.cancel` (tenant, HIGH_WRITE, idempotency
 * yes), owned by `06` item 5 per `PHASE_2_BRIEF.md` §3(a) (INFERRED, ratified
 * D2-13).
 *
 * `idempotent: true` and composed through ADR-038's wrapper, as item 4 wired
 * `plan.subscribe`. Cancelling twice with one key replays rather than
 * attempting a second transition — which matters more here than for a create,
 * because the second attempt would hit ADR-024 item 3's machine and be refused
 * as illegal, turning a network retry into a client-visible error.
 *
 * `CONCURRENCY_CONFLICT` is declared and is this codebase's first capability
 * that can actually raise it from ADR-045's compare-and-set: item 4 created
 * `subscriptions` with the `version` column and no writer for it.
 *
 * The route is `POST .../subscription/cancel` rather than `DELETE
 * .../subscription`. Cancellation is not a deletion — ADR-020 rule 1 and
 * `AGENTS.md` §4 both forbid it being one, ADR-046 rules out a `deleted_at`
 * column, and the row it produces is `CANCEL_AT_PERIOD_END` or `CANCELED`, both
 * of which keep every row they had. A `DELETE` verb would misdescribe that to
 * every client that read the contract.
 */
export const subscriptionCancelCapability: CapabilityDefinition = {
  id: "subscription.cancel",
  version: "1",
  requiredPermissions: ["subscription.cancel"],
  risk: "HIGH_WRITE",
  idempotent: true,
  audit: true,
  storeScoped: false,
  route: {
    method: "post",
    path: "/api/v1/organizations/{organizationId}/subscription/cancel",
    pathParams: ["organizationId"],
    successStatus: 200,
  },
  inputSchema: cancelSubscriptionInputSchema,
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
