import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { AuditEvent } from "../domain/audit-event.entity.js";
import type { AuditEventRepository } from "../domain/audit-event.repository.js";
import { AuditEventRepositoryPg } from "../infrastructure/audit-event.repository.pg.js";

export { AuditEvent };
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
