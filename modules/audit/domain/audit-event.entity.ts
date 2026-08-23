export type ActorType = "user" | "service" | "system" | "plugin" | "agent";
export type AuditOutcome = "SUCCESS" | "FAILURE";

/**
 * The `tenant_id` a global-scope capability's audit event carries — ADR-035.
 * `audit_events.tenant_id` is `uuid NOT NULL` with one RLS policy
 * (`USING (tenant_id::text = current_setting('app.tenant_id', true))`); a
 * NULL value would never satisfy that comparison under any context, making
 * such a row permanently unreadable through the policy and every helper
 * built on it (`withTenantContext`, `recordAuditEventDurable`). This
 * sentinel keeps the column NOT NULL and the policy completely unchanged —
 * reading these rows back is `withTenantContext(db, { tenantId:
 * PLATFORM_TENANT_ID, ... })`, exactly like any other tenant, with no
 * second policy branch or bypass path to build or audit.
 *
 * `auth.login` is the first writer. Never a value `gen_random_uuid()` can
 * produce for a real organization (probability effectively zero) and never
 * a row `organizations` contains — there is no foreign key from
 * `audit_events.tenant_id` to `organizations.id` for it to violate, and a
 * query that joined against it would correctly find nothing.
 */
export const PLATFORM_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export class AuditEvent {
  constructor(
    public readonly tenantId: string,
    public readonly actorUserId: string | null,
    public readonly actorType: ActorType,
    public readonly capability: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly outcome: AuditOutcome,
    public readonly requestId: string,
    public readonly correlationId: string,
    public readonly metadata: Record<string, unknown> = {},
  ) {}
}
