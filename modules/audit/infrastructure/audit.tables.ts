import type { ColumnType, Generated } from "kysely";

export interface AuditEventsTable {
  id: Generated<string>;
  tenant_id: string;
  actor_user_id: string | null;
  actor_type: string;
  capability: string;
  resource_type: string;
  resource_id: string;
  outcome: string;
  metadata: unknown;
  request_id: string;
  correlation_id: string;
  occurred_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    audit_events: AuditEventsTable;
  }
}
