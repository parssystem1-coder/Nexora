export type IdempotencyStatus = "CLAIMED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type ActorType = "user" | "service" | "system" | "plugin" | "agent";

export interface IdempotencyRecord {
  id: string;
  capability: string;
  idempotencyKey: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseSnapshot: unknown;
}

export interface ClaimCommand {
  tenantId: string;
  capability: string;
  idempotencyKey: string;
  requestHash: string;
  actorType: ActorType;
  /** ADR-009 requires this per record; resolved from configuration at claim time. */
  expiresAt: Date;
}

/**
 * ADR-009's store, as the wrapper needs it. Deliberately narrow: three methods,
 * no listing, no purge. The purge is a scheduled job owed to item 12 (ADR-009's
 * 2026-09-05 amendment part 3), and giving this port a `deleteExpired` it has no
 * caller for would be a method nothing enforces.
 */
export interface IdempotencyRepository {
  /**
   * Inserts a `CLAIMED` record, or returns the existing one for this
   * `(tenant, capability, key)` when the unique index rejects the insert.
   *
   * Returning the existing row rather than throwing is what lets the caller
   * distinguish a replay from a conflict, which are different answers to the
   * same collision.
   */
  claimOrFind(command: ClaimCommand): Promise<{ claimed: boolean; record: IdempotencyRecord }>;

  /** Moves a claim to `COMPLETED` and stores the response. Same transaction as the write. */
  complete(recordId: string, responseSnapshot: unknown): Promise<void>;

  findByKey(tenantId: string, capability: string, idempotencyKey: string): Promise<IdempotencyRecord | null>;
}
