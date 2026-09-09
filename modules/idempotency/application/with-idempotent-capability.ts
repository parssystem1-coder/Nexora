import { createHash } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import type { RlsContext } from "../../../platform/db/tenant-context.js";
import type { Clock } from "../../../platform/clock.js";
import { ClaimInProgressError, IdempotencyConflictError } from "../domain/idempotency.errors.js";
import type { ActorType, IdempotencyRepository } from "../domain/idempotency.repository.js";

/**
 * **ADR-038's `withIdempotentCapability`.** Item 3 built the store and stopped;
 * this is the consumer it named — "ADR-038's `withIdempotentCapability`, which
 * arrives with the first idempotent capability (item 4)."
 *
 * ADR-038 item 1: **composition, not a branch.** Nothing is added inside
 * `runCapabilityAttempt`, and no controller hand-rolls a claim. Item 2 fixes the
 * nesting:
 *
 *     runCapabilityAttempt(            <- audits every attempt, fresh or replayed
 *       withIdempotentCapability(      <- owns the transaction; claim + write together
 *         domain work
 *       )
 *     )
 *
 * ADR-038 item 3 is why that order and not the reverse: ADR-034 item 5 says an
 * audit event attests to an authorized *attempt*, not a committed effect, and a
 * replay is a real second authenticated request. With the wrapper outermost, a
 * replay would short-circuit before the audit tail ran and a retry storm would
 * be invisible in the one record built to explain what happened.
 *
 * ADR-038 item 5: **the wrapper owns the transaction**, opened through
 * `withTenantContext` — which keeps `runCapabilityAttempt` at the scope ceiling
 * its own doc comment declares ("does not choose a transaction strategy"),
 * because the layer beneath it chose.
 *
 * ADR-009: **the claim and the write share that one transaction.** The
 * consequence is the property ADR-038's verification list asks for — "a forced
 * failure after the claim leaves no claim behind" — and it is also why `FAILED`
 * is never written here: if the work throws, the claim rolls back with it.
 * `FAILED` belongs to ADR-009's other path, where "the operation spans an
 * external call, the claim is committed first, then reconciled", which is item
 * 12's payment flow.
 */
export interface IdempotentCapabilityOptions {
  capabilityId: string;
  idempotencyKey: string;
  /** Hashed, never stored: `request_hash` is what ADR-009 keeps, and a hash carries no personal data. */
  requestPayload: unknown;
  actorType: ActorType;
  /** ADR-009's "bounded and configurable" retention, resolved at claim time. */
  retentionDays: number;
  clock: Clock;
  /**
   * Binds the store to the transaction this wrapper opens.
   *
   * A factory rather than an instance, because the transaction does not exist
   * until `withTenantContext` has opened it — and a factory rather than a
   * direct `new IdempotencyRepositoryPg(trx)` because an application file may
   * not import the infrastructure layer (`DEP-DIRECTION-APPLICATION`, which
   * caught exactly that on the first draft of this file). The concrete class is
   * bound in `contracts/idempotency.contract.ts`, which is the layer allowed to
   * know it, mirroring `modules/money`'s `createCurrencyRepository`.
   */
  createRepository: (trx: Transaction<Database>) => IdempotencyRepository;
}

export interface IdempotentOutcome<T> {
  result: T;
  /**
   * ADR-038 item 4: "a replayed attempt is audited, and is distinguishable ...
   * its `metadata` carries an explicit replay marker. Without the marker the
   * audit trail shows two successful creations of one resource and cannot say
   * that only one happened."
   *
   * The wrapper reports it; the controller puts it on the audit event, because
   * the audit event's own fields are what ADR-038 leaves per capability.
   */
  replayed: boolean;
}

/**
 * ADR-009's identity is `(tenant_id, capability, idempotency_key)`, and the
 * `request_hash` decides whether a repeat is a replay or a conflict.
 *
 * Keys are sorted so that two structurally identical payloads hash the same
 * regardless of property order — otherwise a client that reserialised its own
 * request would get `IDEMPOTENCY_CONFLICT` for a request it did not change,
 * which is the opposite of what idempotency is for.
 */
export function hashRequest(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

export async function withIdempotentCapability<T>(
  appDb: Kysely<Database>,
  rlsContext: RlsContext,
  options: IdempotentCapabilityOptions,
  work: (trx: Transaction<Database>) => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  const tenantId = rlsContext.tenantId;
  if (tenantId === null) {
    // Every idempotent capability in `05` §4.2 is tenant-scoped, and the store
    // is tenant-owned with FORCE ROW LEVEL SECURITY: a claim written with no
    // tenant context would be invisible to every later reader including itself.
    throw new Error("withIdempotentCapability requires a tenant context.");
  }

  const requestHash = hashRequest(options.requestPayload);
  const expiresAt = new Date(options.clock.now().getTime() + options.retentionDays * 24 * 60 * 60 * 1000);

  return withTenantContext(appDb, rlsContext, async (trx) => {
    const records = options.createRepository(trx);

    const { claimed, record } = await records.claimOrFind({
      tenantId,
      capability: options.capabilityId,
      idempotencyKey: options.idempotencyKey,
      requestHash,
      actorType: options.actorType,
      expiresAt,
    });

    if (!claimed) {
      // ADR-009's three collision rules, in the order it states them.
      if (record.requestHash !== requestHash) {
        throw new IdempotencyConflictError(options.capabilityId, options.idempotencyKey);
      }
      if (record.status === "COMPLETED") {
        return { result: record.responseSnapshot as T, replayed: true };
      }
      // CLAIMED, IN_PROGRESS, or FAILED: an identical request that has not
      // produced a result. Never a second execution.
      throw new ClaimInProgressError(options.capabilityId, options.idempotencyKey, 5);
    }

    const result = await work(trx);
    await records.complete(record.id, result);
    return { result, replayed: false };
  });
}
