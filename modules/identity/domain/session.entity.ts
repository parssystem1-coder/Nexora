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

  /**
   * ADR-051: deliberately narrower than `!isValid()`, and the difference is
   * the whole point. This is true ONLY for a session that was explicitly
   * revoked — never for one that merely expired, and never for one that does
   * not exist. ADR-051 rules that a revoked session surfaces as
   * `SESSION_INVALIDATED`/401 while everything else stays
   * `AUTHENTICATION_REQUIRED`/401, and that separation is what keeps
   * `ValidateSessionService`'s token-enumeration property intact: reaching
   * this predicate at all requires already holding a token that matched a
   * real row.
   *
   * Takes no clock, on purpose. Revocation is a stored fact, not a function
   * of the current time, so a revoked session that has also since expired is
   * still revoked — and telling its holder so is more useful than telling
   * them it expired.
   */
  isRevoked(): boolean {
    return this.status === "REVOKED";
  }
}
