import type { EntitlementState, OverrideType } from "./resolve-entitlement.js";
import type { QuotaResource } from "./quota-resource.js";

/** A row of `plan_entitlements`: what a plan version grants. */
export interface PlanEntitlement {
  featureKey: string;
  state: EntitlementState;
  limit: number | null;
}

/** A row of `tenant_entitlement_overrides` (ADR-008 rule 2). */
export interface TenantEntitlementOverride {
  featureKey: string;
  overrideType: OverrideType;
  state: EntitlementState;
  limit: number | null;
}

/** A row of `plan_quota_policies`: how many of a resource a plan version permits. */
export interface PlanQuotaPolicy {
  resource: QuotaResource;
  limit: number;
}

/** A row of `tenant_quota_overrides`. ADR-008 rule 2's model governs quotas too. */
export interface TenantQuotaOverride {
  resource: QuotaResource;
  overrideType: OverrideType;
  limit: number;
}

export interface EntitlementRepository {
  /** Platform-global, readable with no tenant context (§6 criterion 25). */
  listPlanEntitlements(planVersionId: string): Promise<readonly PlanEntitlement[]>;

  /** Tenant-owned; scoped by RLS, never by a predicate here. */
  listTenantOverrides(tenantId: string): Promise<readonly TenantEntitlementOverride[]>;

  /** Item 7. Platform-global, readable with no tenant context. */
  listPlanQuotaPolicies(planVersionId: string): Promise<readonly PlanQuotaPolicy[]>;

  /** Item 7. Tenant-owned; scoped by RLS. */
  listTenantQuotaOverrides(tenantId: string): Promise<readonly TenantQuotaOverride[]>;
}

/**
 * ADR-008's explainability log. Append-only — `REVOKE UPDATE, DELETE` since
 * 2026-09-10 — so the port offers no update and no delete: a method the database
 * refuses would be a signature that lies.
 */
export interface EntitlementSourceRepository {
  record(entry: {
    id: string;
    tenantId: string;
    featureKey: string;
    state: EntitlementState;
    limit: number | null;
    resolvedFrom: readonly string[];
    evaluatedAt: Date;
  }): Promise<void>;
}

/**
 * The stored over-limit state (ADR-026 item 6: "queryable per tenant").
 *
 * **Read-only in Phase 2, and that is the honest shape rather than a stub.**
 * ADR-045 names this table's two writers — "the usage recorder and the
 * over-limit evaluator" — and neither exists: the usage recorder is item 9, and
 * ADR-026's own entry cause is a downgrade, which is item 15's `plan.change`. A
 * `record` method here would be a signature with no caller and no test, which is
 * the "documentation, not architecture" failure ADR-030 names.
 */
export interface OverLimitStateRepository {
  /** `entered_at` per resource for one tenant — the one fact a live evaluation cannot recompute. */
  findEnteredAtByResource(tenantId: string): Promise<ReadonlyMap<string, Date>>;
}
