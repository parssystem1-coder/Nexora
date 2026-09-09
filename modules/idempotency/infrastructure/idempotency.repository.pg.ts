import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type {
  ClaimCommand,
  IdempotencyRecord,
  IdempotencyRepository,
  IdempotencyStatus,
} from "../domain/idempotency.repository.js";
import "./idempotency.tables.js";

export class IdempotencyRepositoryPg implements IdempotencyRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  /**
   * The claim, and the collision that is this table's entire purpose.
   *
   * **`ON CONFLICT DO NOTHING`, not a caught unique violation** — and the
   * difference is not stylistic. The first version of this method inserted,
   * caught `23505`, and then selected the existing row. That cannot work: the
   * claim and the write share one transaction (ADR-009), and in PostgreSQL a
   * statement that raises inside a transaction **aborts it** — every subsequent
   * command fails with *"current transaction is aborted"*. The follow-up select
   * never ran, and every replay returned 500. It was caught by the integration
   * test that replays a key, which is exactly the test ADR-038's verification
   * list asks for.
   *
   * `ON CONFLICT DO NOTHING` raises nothing, so the transaction stays usable and
   * the second statement can read the winner's row. It is still not a
   * read-modify-write: the conflict is resolved by the index, which is the
   * mechanism ADR-045's ruling relies on when it excludes this table from
   * optimistic concurrency.
   */
  async claimOrFind(command: ClaimCommand): Promise<{ claimed: boolean; record: IdempotencyRecord }> {
    const inserted = await this.conn
      .insertInto("idempotency_records")
      .values({
        tenant_id: command.tenantId,
        capability: command.capability,
        idempotency_key: command.idempotencyKey,
        request_hash: command.requestHash,
        status: "CLAIMED",
        actor_type: command.actorType,
        expires_at: command.expiresAt.toISOString(),
      })
      .onConflict((oc) => oc.columns(["tenant_id", "capability", "idempotency_key"]).doNothing())
      .returning(["id", "capability", "idempotency_key", "request_hash", "status", "response_snapshot"])
      .executeTakeFirst();

    if (inserted) return { claimed: true, record: toRecord(inserted) };

    const existing = await this.findByKey(command.tenantId, command.capability, command.idempotencyKey);
    if (!existing) {
      // The index rejected the insert, so a row exists for this key. Not finding
      // it means RLS hid it — impossible in practice, since the unique key
      // begins with `tenant_id` and the policy restricts to that same tenant, so
      // a conflicting row is always this tenant's. Loud rather than silent
      // anyway: returning "no record" here would let the caller execute a second
      // time under a key that is already taken.
      throw new Error(
        `Idempotency key '${command.idempotencyKey}' for '${command.capability}' collided but is not readable in this tenant context.`,
      );
    }
    return { claimed: false, record: existing };
  }

  async complete(recordId: string, responseSnapshot: unknown): Promise<void> {
    await this.conn
      .updateTable("idempotency_records")
      .set({ status: "COMPLETED", response_snapshot: JSON.stringify(responseSnapshot) })
      .where("id", "=", recordId)
      .execute();
  }

  async findByKey(tenantId: string, capability: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const row = await this.conn
      .selectFrom("idempotency_records")
      .select(["id", "capability", "idempotency_key", "request_hash", "status", "response_snapshot"])
      .where("tenant_id", "=", tenantId)
      .where("capability", "=", capability)
      .where("idempotency_key", "=", idempotencyKey)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }
}

function toRecord(row: {
  id: string;
  capability: string;
  idempotency_key: string;
  request_hash: string;
  status: string;
  response_snapshot: unknown;
}): IdempotencyRecord {
  return {
    id: row.id,
    capability: row.capability,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    status: row.status as IdempotencyStatus,
    responseSnapshot: row.response_snapshot,
  };
}
