import type { ZodTypeAny } from "zod";
import type { CapabilityErrorCode } from "./capability.errors.js";

export interface CapabilityRoute {
  method: "get" | "post" | "patch" | "put" | "delete";
  /** OpenAPI path template, e.g. `/api/v1/stores/{storeId}`. */
  path: string;
  /**
   * Which keys of `inputSchema` arrive as path parameters rather than in the
   * request body. Everything else is the body; an empty remainder means the
   * operation has none.
   *
   * The OpenAPI generator (ADR-033) needs this because path parameters and a
   * request body are different places in the document, and it is forbidden
   * from reading the controller to work out which is which. Declaring the
   * split as a list of keys - rather than one location for the whole input -
   * is what lets a capability have both, as membership.invite does
   * (organizationId in the path, email in the body).
   */
  pathParams: readonly string[];
  successStatus: number;
}

/**
 * Minimal Phase 1 subset of 05_API_CAPABILITY_CONTRACTS.md §5's
 * CapabilityDefinition. Fields whose supporting machinery does not exist yet
 * (entitlements, quota, approval, requiresServingSubscription, emitsEvents)
 * are deliberately omitted rather than declared-and-ignored - declaring a
 * field nothing enforces is the "documentation, not architecture" failure
 * ADR-030 warns about. They are added by the phase that implements them.
 *
 * `route`, `inputSchema`, `outputSchema` and `errorCodes` were added for
 * ADR-033, which applies from Task 2: they are what `tools/openapi/generate.ts`
 * reads. It keys off this definition and its Zod schemas, never off the
 * controller module, so the artifact can be generated with no database
 * reachable and covers capabilities reached from MCP/AI/automation too.
 *
 * `idempotent` records what the platform actually enforces, not what
 * 05 §4.1 aspires to - see DECISION_LOG.md, "organization.create is marked
 * idempotent in 05 §4.1 but ADR-009's store is Phase 2".
 */
export interface CapabilityDefinition {
  id: string;
  version: string;
  requiredPermissions: string[];
  risk: "READ" | "LOW_WRITE" | "MEDIUM_WRITE" | "HIGH_WRITE";
  idempotent: boolean;
  audit: boolean;
  storeScoped: boolean;
  route: CapabilityRoute;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  /** ADR-033 item 6: every documented code this capability can raise, so the published contract cannot disagree with the enforced one. */
  errorCodes: CapabilityErrorCode[];
}
