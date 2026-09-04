import type { ColumnType } from "kysely";

/**
 * Platform-global reference data — no `tenant_id`, no RLS policy, exempt by
 * `PHASE_2_BRIEF.md` §5's stated reason. See the creating migration
 * (`20260905090000_billing__create_plans.sql`) for that reason in full.
 *
 * Every write column is typed `never` on update: nothing in this codebase
 * updates a plan row, and `plan_versions` is described as immutable
 * throughout `PHASE_2_BRIEF.md`. Typing it that way is a compile-time echo of
 * a property the database does not yet enforce — see the migration's comment
 * on why the `REVOKE` is §5's decision to make and not this slice's.
 */
export interface PlansTable {
  id: string;
  key: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PlanVersionsTable {
  id: string;
  plan_id: string;
  /** The plan version's own ordinal — NOT an ADR-045 concurrency token. */
  version: number;
  trial_period_days: number;
  effective_from: ColumnType<Date, string, never>;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface PlanFeaturesTable {
  plan_version_id: string;
  feature_key: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    plans: PlansTable;
    plan_versions: PlanVersionsTable;
    plan_features: PlanFeaturesTable;
  }
}
