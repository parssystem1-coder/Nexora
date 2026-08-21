import type { Kysely } from "kysely";
export function withTenantContext(db: Kysely<unknown>) {
  return db.transaction().execute(async (trx) => trx);
}
