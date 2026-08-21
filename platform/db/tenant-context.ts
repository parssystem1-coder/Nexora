import type { Pool, PoolClient } from "pg";

/**
 * @singleton-role: tenant-context
 *
 * The one and only place a transaction is opened with RLS session context set
 * (ADR-021; ADR-030's "exactly one tenant-context helper" singleton rule).
 * Every module's repository/application code must go through this, never open
 * its own transaction and set `app.tenant_id` independently.
 *
 * Passing tenantId = null deliberately clears the session variable, so RLS
 * fails closed: a query issued this way against a tenant-owned table must
 * return zero rows (08_PHASE_1_BRIEF.md §5, "RLS fails closed").
 */
export async function withTenantContext<T>(
  pool: Pool,
  tenantId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
