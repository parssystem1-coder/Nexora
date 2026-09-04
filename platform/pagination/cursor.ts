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
 * What it is NOT: signed, encrypted, or authenticated. A cursor names a
 * position in a public ordering — it carries no identity and grants no
 * access, and every row it could seek to is one the caller's own query would
 * have reached anyway. Base64url is an obfuscation of the encoding, not a
 * security boundary, and ADR-036 item 5's "bearer token for position" is
 * exactly that: a position, not a bearer token for authority. If a future
 * paginated capability's sort key is itself sensitive, that capability owes
 * its own decision — it does not get to quietly reuse this one.
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
