export type ActorType = "user" | "service" | "system" | "plugin" | "agent";
export type AuditOutcome = "SUCCESS" | "FAILURE";

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
