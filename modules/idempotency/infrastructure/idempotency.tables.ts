import type { ColumnType, Generated } from "kysely";

/**
 * ADR-009's shared idempotency store. Tenant-owned, with `ENABLE`/`FORCE ROW
 * LEVEL SECURITY` and a policy in its creating migration — the first Phase 2
 * table to take that treatment, since items 1 and 2 were platform-global.
 *
 * Item 3 surfaces no capability, so this module ships no repository port and no
 * service: ADR-038's `withIdempotentCapability` is the consumer, and it arrives
 * with the first idempotent capability rather than being written ahead of one.
 * These types exist so that consumer — and this module's own spec — can query
 * at all.
 */
export interface IdempotencyRecordsTable {
  id: Generated<string>;
  /** A plain column. No foreign key to `organizations`: that would cross a module boundary. */
  tenant_id: string;
  capability: string;
  idempotency_key: string;
  request_hash: string;
  /** ADR-009's lifecycle: CLAIMED -> IN_PROGRESS -> COMPLETED | FAILED. */
  status: ColumnType<string, string, string>;
  /**
   * Null until the operation completes. Typed as `unknown` on read because what
   * a snapshot contains is each capability's own response shape, and asserting
   * a structure here would be a claim this module cannot make.
   */
  response_snapshot: ColumnType<unknown, string | null | undefined, string | null>;
  actor_type: string;
  created_at: ColumnType<Date, string | undefined, never>;
  /**
   * ADR-009 requires this column. Resolved from configuration at claim time and
   * stored per record, so that changing the retention default never alters the
   * lifetime of a row already written. Immutable once set.
   */
  expires_at: ColumnType<Date, string, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    idempotency_records: IdempotencyRecordsTable;
  }
}
