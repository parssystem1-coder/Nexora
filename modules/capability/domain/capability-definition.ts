/**
 * Minimal Phase 1 subset of 05_API_CAPABILITY_CONTRACTS.md §5's
 * CapabilityDefinition. Fields whose supporting machinery does not exist yet
 * (entitlements, quota, approval, requiresServingSubscription, emitsEvents)
 * are deliberately omitted rather than declared-and-ignored — declaring a
 * field nothing enforces is the "documentation, not architecture" failure
 * ADR-030 warns about. They are added by the phase that implements them.
 */
export interface CapabilityDefinition {
  id: string;
  version: string;
  requiredPermissions: string[];
  risk: "READ" | "LOW_WRITE" | "MEDIUM_WRITE" | "HIGH_WRITE";
  idempotent: boolean;
  audit: boolean;
  storeScoped: boolean;
}
