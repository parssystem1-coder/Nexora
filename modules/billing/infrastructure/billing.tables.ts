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

/**
 * Item 2's tables. `term_length` is a PostgreSQL `interval`, which the driver
 * surfaces as a `PostgresInterval` object rather than a string — typed as
 * `unknown` on read because nothing in this codebase interprets one yet, and
 * guessing its runtime shape here would be a fact asserted rather than known.
 * The slice that first reads a term (item 4) types it against what it needs.
 */
export interface PricesTable {
  id: string;
  plan_version_id: string;
  term_length: ColumnType<unknown, string, never>;
  created_at: ColumnType<Date, string | undefined, never>;
}

/**
 * ADR-022: `amount_minor` is a bigint of minor units and `currency_code`
 * travels with it, both non-null. `node-postgres` returns `bigint` columns as
 * strings by default, so the read type is `string` and callers convert with
 * `BigInt(...)` into `Money` — never through `Number`, which is the silent
 * precision loss ADR-022 item 1 names.
 *
 * The minor-unit exponent is deliberately absent: it is `currencies`' fact
 * (ADR-022 item 3), and duplicating it beside the amount would create a
 * second source that can go stale.
 */
export interface PriceVersionsTable {
  id: string;
  price_id: string;
  version: number;
  amount_minor: ColumnType<string, string | bigint, never>;
  currency_code: string;
  effective_from: ColumnType<Date, string, never>;
  created_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    plans: PlansTable;
    plan_versions: PlanVersionsTable;
    plan_features: PlanFeaturesTable;
    prices: PricesTable;
    price_versions: PriceVersionsTable;
  }
}
