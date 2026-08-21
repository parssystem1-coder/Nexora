import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "./kysely.js";

/**
 * @singleton-role: tenant-context
 *
 * The one and only place a transaction is opened with RLS session context set
 * (ADR-021; ADR-030's "exactly one tenant-context helper" singleton rule).
 * Every module's repository/application code must go through this, never
 * open its own Kysely transaction and set `app.tenant_id` independently —
 * enforced mechanically by tools/conformance/rules/db-access.ts
 * (DB-ACCESS-TRANSACTION-BYPASSES-HELPER), not just by convention.
 *
 * Passing tenantId = null deliberately clears the session variable, so RLS
 * fails closed: a query issued this way against a tenant-owned table must
 * return zero rows (08_PHASE_1_BRIEF.md §5, "RLS fails closed").
 */
export async function withTenantContext<T>(
  db: Kysely<Database>,
  tenantId: string | null,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.tenant_id', ${tenantId ?? ""}, true)`.execute(trx);
    return fn(trx);
  });
}
