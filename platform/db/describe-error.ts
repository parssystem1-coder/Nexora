/** node-postgres connection errors (e.g. ECONNREFUSED) often have an empty .message; fall back to .code. */
export function describeDbError(err: unknown): string {
  const e = err as NodeJS.ErrnoException;
  return e?.message || e?.code || String(err);
}
