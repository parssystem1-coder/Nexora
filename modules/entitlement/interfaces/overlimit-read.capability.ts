import type { CapabilityDefinition } from "../../capability/contracts/index.js";
import { readOverLimitInputSchema, readOverLimitOutputSchema } from "../application/read-over-limit.input.js";

/**
 * `05` §4.2's row for `overlimit.read` (tenant, READ, idempotency no), owned by
 * `06` item 8 per `PHASE_2_BRIEF.md` §3(a) — **EXPLICIT** there, one of the few.
 *
 * No idempotency wrapper: a READ has nothing to replay, and ADR-038 item 7
 * covers it — "a non-idempotent capability composes only the outer function".
 *
 * **`ENTITLEMENT_CONFLICT` is declared, and the first draft of this file wrongly
 * argued it should not be.** The reasoning was that this capability "consumes an
 * already-resolved limit rather than walking ADR-008's chain itself" — but it
 * calls the resolver to get that limit, so rule 3's failure is genuinely
 * reachable here. The ADR-030 harness caught the false claim by tracing what the
 * controller can actually reach, which is exactly the drift
 * `ERROR-CODE-UNDECLARED` exists to catch.
 *
 * It is also the right behaviour: if a tenant's grants conflict, this capability
 * cannot compute a limit either, and must fail closed rather than report a
 * resource as within a limit it could not resolve.
 */
export const overlimitReadCapability: CapabilityDefinition = {
  id: "overlimit.read",
  version: "1",
  requiredPermissions: ["overlimit.read"],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: {
    method: "get",
    path: "/api/v1/organizations/{organizationId}/over-limit",
    pathParams: ["organizationId"],
    successStatus: 200,
  },
  inputSchema: readOverLimitInputSchema,
  outputSchema: readOverLimitOutputSchema,
  errorCodes: [
    "AUTHENTICATION_REQUIRED",
    "SESSION_INVALIDATED",
    "VALIDATION_ERROR",
    "FORBIDDEN",
    "TENANT_CONTEXT_REQUIRED",
    "ENTITLEMENT_CONFLICT",
    "INTERNAL_ERROR",
  ],
};
