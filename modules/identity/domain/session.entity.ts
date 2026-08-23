export type SessionStatus = "ACTIVE" | "REVOKED";

export class Session {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly tokenHash: string,
    public readonly activeOrganizationId: string | null,
    public readonly status: SessionStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
  ) {}

  /** `now` is caller-supplied (platform/clock.ts) — see ADR-031 item 6, never Date.now() here. */
  isValid(now: Date): boolean {
    return this.status === "ACTIVE" && this.expiresAt.getTime() > now.getTime();
  }
}
