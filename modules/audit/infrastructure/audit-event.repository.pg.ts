import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { AuditEvent } from "../domain/audit-event.entity.js";
import type { AuditEventRepository } from "../domain/audit-event.repository.js";
import "./audit.tables.js";

export class AuditEventRepositoryPg implements AuditEventRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async record(event: AuditEvent): Promise<void> {
    await this.conn
      .insertInto("audit_events")
      .values({
        tenant_id: event.tenantId,
        actor_user_id: event.actorUserId,
        actor_type: event.actorType,
        capability: event.capability,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        outcome: event.outcome,
        metadata: JSON.stringify(event.metadata),
        request_id: event.requestId,
        correlation_id: event.correlationId,
      })
      .execute();
  }
}
