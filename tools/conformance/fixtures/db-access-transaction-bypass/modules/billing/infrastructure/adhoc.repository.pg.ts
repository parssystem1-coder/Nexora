// VIOLATION FIXTURE (DB-ACCESS-TRANSACTION-BYPASSES-HELPER): opens a Kysely
// transaction directly instead of going through withTenantContext(), so
// app.tenant_id is never set for this transaction.
import type { Kysely } from "kysely";

export async function runWithoutTenantContext(db: Kysely<unknown>) {
  return db.transaction().execute(async (trx) => {
    return trx;
  });
}
