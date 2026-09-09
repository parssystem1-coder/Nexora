import type { ColumnType } from "kysely";

/**
 * Phase 2 item 6's three tables.
 *
 * `plan_entitlements` is platform-global (no `tenant_id`, no RLS) by §5's
 * existing exemption clause; the other two are tenant-owned with `ENABLE`/
 * `FORCE ROW LEVEL SECURITY` and a policy in the creating migration.
 */
export interface PlanEntitlementsTable {
  id: string;
  /** A plain column: `plan_versions` is `modules/billing`'s, so a foreign key would cross a module. */
  plan_version_id: string;
  feature_key: string;
  state: ColumnType<string, string, never>;
  limit_value: ColumnType<number | null, number | null | undefined, never>;
  created_at: ColumnType<Date, string | undefined, never>;
}

/** Mutable by definition, and with no `version` column: ADR-045's Tier 2 trigger has not fired. */
export interface TenantEntitlementOverridesTable {
  id: string;
  tenant_id: string;
  feature_key: string;
  override_type: ColumnType<string, string, string>;
  state: ColumnType<string, string, string>;
  limit_value: ColumnType<number | null, number | null | undefined, number | null>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

/**
 * Append-only, and an ADR-041 partitioning candidate as of item 6's
 * classification. Every column is `never` on update — `REVOKE UPDATE, DELETE`
 * makes that a privilege, and `evaluated_at`'s immutability is what ADR-041
 * obligation 1 assumes.
 */
export interface EntitlementSourcesTable {
  id: string;
  tenant_id: string;
  feature_key: string;
  state: ColumnType<string, string, never>;
  limit_value: ColumnType<number | null, number | null | undefined, never>;
  resolved_from: ColumnType<unknown, string, never>;
  evaluated_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    plan_entitlements: PlanEntitlementsTable;
    tenant_entitlement_overrides: TenantEntitlementOverridesTable;
    entitlement_sources: EntitlementSourcesTable;
  }
}
