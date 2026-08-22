/**
 * Duck-typed inspection of a PostgreSQL integrity error.
 *
 * Deliberately does not import `pg`: ADR-030's DB-ACCESS rule allows the
 * driver only in platform/db/pool.ts, migrate.ts and migrate-cli.ts, and
 * Kysely surfaces the driver's DatabaseError unwrapped anyway, so the two
 * fields this needs (`code`, `constraint`) can be read structurally.
 *
 * 23505 is unique_violation. A repository uses this to turn "the unique
 * index rejected the row" into a domain-level error, rather than
 * pre-checking uniqueness with a SELECT — under RLS a pre-check is both
 * racy and, for a row in a tenant the caller cannot see, silently wrong.
 */
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: unknown; constraint?: unknown };
  if (candidate.code !== UNIQUE_VIOLATION) return false;
  if (constraint === undefined) return true;
  return candidate.constraint === constraint;
}
