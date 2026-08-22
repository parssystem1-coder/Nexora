import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "./kysely.js";

/**
 * The three session variables 04_DATABASE_BLUEPRINT.md §6 sets before any
 * query. All independently nullable: a bootstrap-phase query (resolving
 * which tenant to trust, 08_PHASE_1_BRIEF.md §2 steps 2-3) has userId set
 * but tenantId/storeId still null — see DECISION_LOG.md "RLS bootstrap: how
 * a query resolves tenant context before tenant context exists".
 */
export interface RlsContext {
  tenantId: string | null;
  userId: string | null;
  storeId: string | null;
}

/**
 * @singleton-role: tenant-context
 *
 * The one and only place a transaction is opened with RLS session context set
 * (ADR-021; ADR-030's "exactly one tenant-context helper" singleton rule).
 * Every module's repository/application code must go through this, never
 * open its own Kysely transaction and set session variables independently —
 * enforced mechanically by tools/conformance/rules/db-access.ts
 * (DB-ACCESS-TRANSACTION-BYPASSES-HELPER), not just by convention.
 *
 * Leaving a field null deliberately clears that session variable, so RLS
 * fails closed: a query issued this way against a table whose policy
 * requires it must return zero rows (08_PHASE_1_BRIEF.md §5, "RLS fails closed").
 */
export async function withTenantContext<T>(
  db: Kysely<Database>,
  context: RlsContext,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.tenant_id', ${context.tenantId ?? ""}, true)`.execute(trx);
    await sql`select set_config('app.user_id', ${context.userId ?? ""}, true)`.execute(trx);
    await sql`select set_config('app.store_id', ${context.storeId ?? ""}, true)`.execute(trx);
    return fn(trx);
  });
}
