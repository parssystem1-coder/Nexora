import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import type { RlsContext } from "../../../platform/db/tenant-context.js";
import { AuditEvent, PLATFORM_TENANT_ID } from "../domain/audit-event.entity.js";
import type { AuditEventRepository } from "../domain/audit-event.repository.js";
import { AuditEventRepositoryPg } from "../infrastructure/audit-event.repository.pg.js";

export { AuditEvent, PLATFORM_TENANT_ID };
export type { AuditEventRepository };
export type { ActorType, AuditOutcome } from "../domain/audit-event.entity.js";

/**
 * The one place a module's contracts/ intentionally imports Kysely types —
 * lets a caller hand in the transaction it already has (from its own
 * withTenantContext() call) without ever importing audit's concrete PG
 * class. See DECISION_LOG.md "How repositories participate in a
 * withTenantContext transaction..." (cross-module writes extension).
 */
export function createAuditEventRepository(conn: Kysely<Database> | Transaction<Database>): AuditEventRepository {
  return new AuditEventRepositoryPg(conn);
}

/**
 * 08_PHASE_1_BRIEF.md §2 step 8 (option B, DECISION_LOG.md "Conflict: is the
 * audit event inside the transaction..."): writes one audit event on its own
 * transaction against `db`, which must be a connection independent of
 * whatever domain transaction the caller has open elsewhere (in practice,
 * platform/db/connections.ts's AUDIT_DB, a separate pool from APP_DB). This
 * commits and releases as soon as it resolves, so the record survives
 * whether the caller's own transaction subsequently commits or rolls back —
 * call it *before* that transaction's callback returns, not after.
 */
export async function recordAuditEventDurable(
  db: Kysely<Database>,
  context: RlsContext,
  event: AuditEvent,
): Promise<void> {
  await withTenantContext(db, context, (trx) => createAuditEventRepository(trx).record(event));
}
