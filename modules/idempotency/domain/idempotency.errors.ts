/**
 * ADR-009's two refusal cases, as domain errors.
 *
 * They are not `CapabilityError`s: `modules/idempotency/domain` may not import
 * the capability module (the conformance harness enforces the direction), and
 * the mapping to a documented code belongs to the wrapper's caller. The
 * application layer maps them — `IDEMPOTENCY_CONFLICT` and `CONFLICT`, both
 * already in `05` §7.
 */

/**
 * ADR-009: "identical key + different `request_hash` returns
 * `IDEMPOTENCY_CONFLICT`."
 *
 * The client reused a key for a different request. That is a client defect, and
 * it is permanent until the client changes something — never a retry.
 */
export class IdempotencyConflictError extends Error {
  constructor(
    public readonly capability: string,
    public readonly idempotencyKey: string,
  ) {
    super(`This idempotency key was already used for a different request.`);
    this.name = "IdempotencyConflictError";
  }
}

/**
 * ADR-009: "an `IN_PROGRESS` claim returned to a concurrent caller yields
 * `CONFLICT` with retry-after, never a duplicate execution."
 *
 * Rare on the single-transaction path this wrapper implements, and that is
 * worth saying rather than leaving to be discovered: two concurrent claims for
 * one key serialise on the unique index, so the loser waits for the winner and
 * then sees a *completed* record rather than an in-flight one. A live claim is
 * observable mainly on ADR-009's other path — an operation spanning an external
 * call, where "the claim is committed first, then reconciled" — which is item
 * 12's payment flow, not this one.
 */
export class ClaimInProgressError extends Error {
  constructor(
    public readonly capability: string,
    public readonly idempotencyKey: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(`An identical request is already in progress.`);
    this.name = "ClaimInProgressError";
  }
}
