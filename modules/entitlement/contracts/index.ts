/**
 * `modules/entitlement`'s public surface.
 *
 * `resolveEntitlement` is exported because ADR-008 rule 5 requires that
 * resolution "never be computed in an interface layer, an AI prompt or a
 * plugin" — so every later consumer that needs an entitlement decision calls
 * this one implementation rather than reimplementing the chain. It is pure and
 * takes plain grants, so no consumer has to import this module's entities.
 */
export { resolveEntitlement, PRECEDENCE_ORDER, EntitlementConflictError } from "../domain/resolve-entitlement.js";
export type {
  EntitlementState,
  EntitlementSource,
  EntitlementGrant,
  ResolvedEntitlement,
  OverrideType,
} from "../domain/resolve-entitlement.js";
export type { ResolveEntitlementOutputDto } from "../application/resolve-entitlement.input.js";
export { entitlementResolveCapability } from "../interfaces/entitlement-resolve.capability.js";
