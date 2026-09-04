/**
 * ADR-036's opaque keyset cursor, in one place.
 *
 * `AGENTS.md` §2 guarantees that whatever the first list capability ships is
 * copied by every later `*.list`, so this file — not a capability — is where
 * the encoding lives. `plan.list` is its first user; `invoice.list` and
 * `domain.list` are meant to import it rather than mint a second format.
 * ADR-036 item 1: "no capability invents a second cursor format."
 *
 * What a cursor carries, per ADR-036 item 5: "the sort key of the last item
 * on the page delivered, plus the capability id and sort order it was issued
 * for." All three are checked on decode, which is what makes a cursor issued
 * for one capability unusable on another.
 *
 * **What it is NOT: signed, encrypted, or authenticated — and this is the
 * note to read before building the next paginated capability.** A cursor is
 * base64url of a small JSON object: anyone can decode one and craft another.
 * That is deliberate, and it is safe for a reason that has nothing to do with
 * the cursor: **a cursor names a position in an ordering, and it is RLS that
 * decides which rows exist to be positioned among.**
 *
 * `plan.list` is safe because its data is platform-global — there is nothing
 * to scope. **`invoice.list` will be safe for the harder reason**: its query
 * runs inside `withTenantContext`, so a forged cursor naming another tenant's
 * invoice key seeks past a row the policy never returns, and the caller sees
 * their own next page. The cursor cannot widen a result set it does not
 * filter.
 *
 * **The defect this comment exists to prevent** is a later capability that
 * treats a cursor as proof of anything — scoping a query by a value decoded
 * from it, trusting a tenant or store id it carries, or skipping an
 * authorization check because "the cursor came from us." It did not: it came
 * from whoever sent the request. Base64url is an obfuscation of the encoding,
 * not a boundary, and ADR-036 item 5's "bearer token for position" means a
 * position, never authority. **If a future capability's sort key is itself
 * sensitive** — a row's position leaking the existence of data the caller
 * cannot read — **that capability owes its own decision and may not quietly
 * inherit this one.**
 *
 * ADR-036 item 5 also permits the encoding to change without a contract
 * version bump, precisely because it is opaque. `VERSION` below is what makes
 * that safe: a cursor minted by an older encoding fails to decode and is
 * rejected as a `VALIDATION_ERROR` (item 8), rather than being misread.
 */

/** Bumped whenever the encoded shape changes. Old cursors then fail closed. */
const VERSION = 1;

export interface CursorPayload {
  /** The capability that issued it, e.g. `plan.list`. */
  capabilityId: string;
  /** The declared sort order it was issued for, e.g. `key:asc`. */
  sortOrder: string;
  /**
   * The sort key of the last item on the page delivered. A total order
   * (ADR-036 item 6), so seeking strictly past it can neither skip nor
   * duplicate a row.
   */
  sortKey: string;
}

interface EncodedCursor {
  v: number;
  c: string;
  o: string;
  k: string;
}

/** Raised when a cursor cannot be decoded, or was issued for something else. */
export class InvalidCursorError extends Error {
  constructor(reason: string) {
    super(`Invalid pagination cursor: ${reason}`);
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(payload: CursorPayload): string {
  const encoded: EncodedCursor = {
    v: VERSION,
    c: payload.capabilityId,
    o: payload.sortOrder,
    k: payload.sortKey,
  };
  return Buffer.from(JSON.stringify(encoded), "utf8").toString("base64url");
}

/**
 * Decodes a cursor and proves it belongs here.
 *
 * Throws {@link InvalidCursorError} for a malformed cursor and for one issued
 * for a different capability or sort order — ADR-036 item 8 maps both to
 * `VALIDATION_ERROR`, "the same as any other bad input". A *stale* cursor
 * (well-formed, but the row it names has since been deleted) is deliberately
 * not an error: keyset semantics seek past the encoded key, so the row's
 * absence is invisible. Only offset pagination needs a "page no longer
 * exists" concept.
 */
export function decodeCursor(cursor: string, expected: { capabilityId: string; sortOrder: string }): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return failDecode("it is not decodable");
  }

  if (typeof parsed !== "object" || parsed === null) {
    return failDecode("it does not decode to an object");
  }
  const record = parsed as Record<string, unknown>;
  if (record["v"] !== VERSION) {
    return failDecode("it was issued by a different cursor encoding");
  }
  if (typeof record["c"] !== "string" || typeof record["o"] !== "string" || typeof record["k"] !== "string") {
    return failDecode("it is missing a required field");
  }
  if (record["c"] !== expected.capabilityId) {
    return failDecode("it was issued for a different capability");
  }
  if (record["o"] !== expected.sortOrder) {
    return failDecode("it was issued for a different sort order");
  }

  return { capabilityId: record["c"], sortOrder: record["o"], sortKey: record["k"] };
}

function failDecode(reason: string): never {
  throw new InvalidCursorError(reason);
}
