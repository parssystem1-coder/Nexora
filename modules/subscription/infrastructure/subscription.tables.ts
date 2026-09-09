import type { ColumnType } from "kysely";

/**
 * Phase 2 item 4's tables. Tenant-owned, with `ENABLE`/`FORCE ROW LEVEL
 * SECURITY` and a policy in the creating migration.
 *
 * `term_length` is a PostgreSQL `interval`, which the driver surfaces as an
 * object rather than a string. It is read through an explicit `::text` cast
 * wherever it is needed, so the read type here is `unknown`: item 2 took the
 * same position for `prices.term_length`, and guessing the driver's runtime
 * shape would be a fact asserted rather than known.
 */
export interface SubscriptionsTable {
  id: string;
  tenant_id: string;
  plan_version_id: string;
  price_version_id: string;
  status: ColumnType<string, string, string>;
  term_length: ColumnType<unknown, string, string>;
  auto_renew: ColumnType<boolean, boolean | undefined, boolean>;
  current_period_id: ColumnType<string | null, string | null | undefined, string | null>;
  trial_end: ColumnType<Date | null, string | null | undefined, string | null>;
  canceled_at: ColumnType<Date | null, string | null | undefined, string | null>;
  reactivation_deadline: ColumnType<Date | null, string | null | undefined, string | null>;
  /** ADR-045's token. Writable, because items 5, 14, 15 and 16 will bump it. */
  version: ColumnType<number, number | undefined, number>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, string>;
}

/**
 * Append-only: `REVOKE UPDATE, DELETE ... FROM nexora_app` in
 * `20260910090100_subscription__enforce_append_only.sql`. Every column is
 * therefore typed `never` on update — a compile-time echo of a privilege the
 * database enforces, so the two would have to be wrong together.
 */
export interface SubscriptionPeriodsTable {
  id: string;
  tenant_id: string;
  subscription_id: string;
  plan_version_id: string;
  price_version_id: string;
  period_start: ColumnType<Date, string, never>;
  period_end: ColumnType<Date, string, never>;
  grace_end: ColumnType<Date | null, string | null | undefined, never>;
  invoice_id: ColumnType<string | null, string | null | undefined, never>;
  status: ColumnType<string, string, never>;
  created_at: ColumnType<Date, string | undefined, never>;
}

/**
 * ADR-024 item 3's append-only transition log, and ADR-041's first real
 * partitioning candidate in this codebase. Every column is `never` on update:
 * `REVOKE UPDATE, DELETE ... FROM nexora_app` makes that a privilege, and
 * `occurred_at`'s immutability is what ADR-041 obligation 1 assumes.
 */
export interface SubscriptionStateTransitionsTable {
  id: string;
  tenant_id: string;
  subscription_id: string;
  from_status: ColumnType<string, string, never>;
  to_status: ColumnType<string, string, never>;
  reason_code: ColumnType<string, string, never>;
  actor_type: ColumnType<string, string, never>;
  actor_id: ColumnType<string | null, string | null | undefined, never>;
  occurred_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    subscriptions: SubscriptionsTable;
    subscription_periods: SubscriptionPeriodsTable;
    subscription_state_transitions: SubscriptionStateTransitionsTable;
  }
}
