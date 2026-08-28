/**
 * Duck-typed inspection of a PostgreSQL concurrency failure.
 *
 * Deliberately does not import `pg` — same reasoning as
 * `platform/db/constraint-violation.ts`'s own doc comment (ADR-030's
 * DB-ACCESS rule confines the driver to `platform/db/pool.ts`,
 * `migrate.ts` and `migrate-cli.ts`; Kysely surfaces the driver's
 * `DatabaseError` unwrapped, so the one field this needs (`code`) is
 * readable structurally).
 *
 * 40001 is `serialization_failure` (raised only under `SERIALIZABLE`
 * isolation — this codebase has never used anything above the PostgreSQL
 * default, `READ COMMITTED`, kept here anyway in case a future capability
 * ever does). 40P01 is `deadlock_detected` — PostgreSQL's own deadlock
 * detector aborts one side of two transactions each waiting on a lock the
 * other holds, and reports this code on the aborted side; this is the one
 * of the two that this codebase's own `lockActiveForUpdate`
 * (`modules/tenant/infrastructure/membership.repository.pg.ts`) could, in
 * principle, produce.
 *
 * Both are RETRYABLE, which is the entire reason this exists as its own
 * check rather than folding into `isUniqueViolation`'s shape: unlike a
 * unique-violation or a genuine domain conflict, the identical request,
 * resubmitted, is expected to succeed once the contending transaction has
 * released its locks. RISK_REGISTER.md R-008 names mapping this pair as a
 * candidate defense-in-depth mitigation, independent of R-008's own
 * UNDETERMINED root cause — Phase 2 (`06_IMPLEMENTATION_PLAN.md`'s payment
 * callbacks, subscription state transitions, reconciliation sweeps) adds
 * materially more concurrent writers than Phase 1 ever had, making an
 * undifferentiated 500 for this class of failure worth fixing regardless
 * of whether it explains R-008 itself.
 */
const SERIALIZATION_FAILURE = "40001";
const DEADLOCK_DETECTED = "40P01";

export function isConcurrencyFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: unknown };
  return candidate.code === SERIALIZATION_FAILURE || candidate.code === DEADLOCK_DETECTED;
}
