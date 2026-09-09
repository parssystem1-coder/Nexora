import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { RlsContext } from "../../../platform/db/tenant-context.js";
import type { IdempotencyRepository } from "../domain/idempotency.repository.js";
import { IdempotencyRepositoryPg } from "../infrastructure/idempotency.repository.pg.js";
import { withIdempotentCapability as run } from "../application/with-idempotent-capability.js";
import type { IdempotentCapabilityOptions, IdempotentOutcome } from "../application/with-idempotent-capability.js";

/**
 * Binds ADR-009's store to a connection, mirroring `modules/money`'s
 * `createCurrencyRepository`. The contracts layer is the one permitted to know
 * the concrete class: `application/` may not import `infrastructure/`
 * (`DEP-DIRECTION-APPLICATION`).
 */
export function createIdempotencyRepository(conn: Kysely<Database> | Transaction<Database>): IdempotencyRepository {
  return new IdempotencyRepositoryPg(conn);
}

/** Every option except the wiring a caller should not have to supply. */
export type IdempotentCapabilityInput = Omit<IdempotentCapabilityOptions, "createRepository">;

/**
 * ADR-038's wrapper, with the store already bound.
 *
 * This is what a controller composes inside `runCapabilityAttempt`. The
 * repository factory is supplied here rather than at every call site so that no
 * capability can accidentally hand it a different store — ADR-009's "the
 * platform provides exactly **one** idempotency service" is a property of this
 * function having one implementation, not of a comment.
 */
export function withIdempotentCapability<T>(
  appDb: Kysely<Database>,
  rlsContext: RlsContext,
  options: IdempotentCapabilityInput,
  work: (trx: Transaction<Database>) => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  return run(appDb, rlsContext, { ...options, createRepository: createIdempotencyRepository }, work);
}
