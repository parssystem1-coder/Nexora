import type { AuditEvent } from "./audit-event.entity.js";

export interface AuditEventRepository {
  record(event: AuditEvent): Promise<void>;
}
