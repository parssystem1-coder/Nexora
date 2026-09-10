import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type {
  EntitlementRepository,
  EntitlementSourceRepository,
  PlanEntitlement,
  PlanQuotaPolicy,
  TenantEntitlementOverride,
  TenantQuotaOverride,
} from "../domain/entitlement.repository.js";
import type { QuotaResource } from "../domain/quota-resource.js";
import type { OverLimitStateRepository } from "../domain/entitlement.repository.js";
import type { EntitlementState, OverrideType } from "../domain/resolve-entitlement.js";
import "./entitlement.tables.js";

export class EntitlementRepositoryPg implements EntitlementRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async listPlanEntitlements(planVersionId: string): Promise<readonly PlanEntitlement[]> {
    const rows = await this.conn
      .selectFrom("plan_entitlements")
      .select(["feature_key", "state", "limit_value"])
      .where("plan_version_id", "=", planVersionId)
      .orderBy("feature_key", "asc")
      .execute();

    return rows.map((r) => ({
      featureKey: r.feature_key,
      state: r.state as EntitlementState,
      limit: r.limit_value,
    }));
  }

  async listPlanQuotaPolicies(planVersionId: string): Promise<readonly PlanQuotaPolicy[]> {
    const rows = await this.conn
      .selectFrom("plan_quota_policies")
      .select(["resource", "limit_value"])
      .where("plan_version_id", "=", planVersionId)
      .orderBy("resource", "asc")
      .execute();

    return rows.map((r) => ({ resource: r.resource as QuotaResource, limit: r.limit_value }));
  }

  async listTenantQuotaOverrides(tenantId: string): Promise<readonly TenantQuotaOverride[]> {
    const rows = await this.conn
      .selectFrom("tenant_quota_overrides")
      .select(["resource", "override_type", "limit_value"])
      .where("tenant_id", "=", tenantId)
      .orderBy("resource", "asc")
      .execute();

    return rows.map((r) => ({
      resource: r.resource as QuotaResource,
      overrideType: r.override_type as OverrideType,
      limit: r.limit_value,
    }));
  }

  async listTenantOverrides(tenantId: string): Promise<readonly TenantEntitlementOverride[]> {
    const rows = await this.conn
      .selectFrom("tenant_entitlement_overrides")
      .select(["feature_key", "override_type", "state", "limit_value"])
      .where("tenant_id", "=", tenantId)
      .orderBy("feature_key", "asc")
      .execute();

    return rows.map((r) => ({
      featureKey: r.feature_key,
      overrideType: r.override_type as OverrideType,
      state: r.state as EntitlementState,
      limit: r.limit_value,
    }));
  }
}

export class EntitlementSourceRepositoryPg implements EntitlementSourceRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async record(entry: {
    id: string;
    tenantId: string;
    featureKey: string;
    state: EntitlementState;
    limit: number | null;
    resolvedFrom: readonly string[];
    evaluatedAt: Date;
  }): Promise<void> {
    await this.conn
      .insertInto("entitlement_sources")
      .values({
        id: entry.id,
        tenant_id: entry.tenantId,
        feature_key: entry.featureKey,
        state: entry.state,
        limit_value: entry.limit,
        resolved_from: JSON.stringify(entry.resolvedFrom),
        evaluated_at: entry.evaluatedAt.toISOString(),
      })
      .execute();
  }
}

export class OverLimitStateRepositoryPg implements OverLimitStateRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findEnteredAtByResource(tenantId: string): Promise<ReadonlyMap<string, Date>> {
    const rows = await this.conn
      .selectFrom("tenant_over_limit_states")
      .select(["resource", "entered_at"])
      .where("tenant_id", "=", tenantId)
      .execute();

    return new Map(rows.map((r) => [r.resource, r.entered_at]));
  }
}
