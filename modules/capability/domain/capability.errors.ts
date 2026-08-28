/**
 * 05_API_CAPABILITY_CONTRACTS.md §7's error codes — only the subset Phase 1
 * capabilities can actually raise. The rest are added when the capability
 * that raises them is implemented, not speculatively now.
 */
export type CapabilityErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "SESSION_INVALIDATED"
  | "FORBIDDEN"
  | "TENANT_CONTEXT_REQUIRED"
  | "STORE_ACCESS_DENIED"
  | "RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "CONCURRENCY_CONFLICT"
  | "DOMAIN_RESERVED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<CapabilityErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  SESSION_INVALIDATED: 401,
  FORBIDDEN: 403,
  TENANT_CONTEXT_REQUIRED: 400,
  STORE_ACCESS_DENIED: 403,
  // 429, RISK_REGISTER.md R-005 / decisions/2026-08.md this date: auth.login's
  // per-identifier/per-IP throttle (platform/rate-limit/). First user of this
  // code; documented in 05_API_CAPABILITY_CONTRACTS.md §7 the same way
  // DOMAIN_RESERVED was added for store.create.
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  // 409, same status as CONFLICT, deliberately a DISTINCT code: CONFLICT
  // means the request permanently conflicts with existing state until the
  // client changes something; CONCURRENCY_CONFLICT (RISK_REGISTER.md R-008,
  // platform/db/concurrency-error.ts) means a PostgreSQL deadlock or
  // serialization failure aborted this specific attempt, and the identical
  // request is expected to succeed on retry. Conflating the two would tell
  // a client to give up on a transient failure, or to blindly retry a real
  // conflict — the exact ambiguity this second code exists to remove.
  CONCURRENCY_CONFLICT: 409,
  // 409, the same class as CONFLICT but a distinct code: the slug conflicts
  // with a platform-reserved word, not with another row's unique index.
  // store.create (05_API_CAPABILITY_CONTRACTS.md §7) is its first user.
  DOMAIN_RESERVED: 409,
  INTERNAL_ERROR: 500,
};

/**
 * The HTTP status a given code maps to. Exported so the ADR-033 OpenAPI
 * generator documents each capability's error responses under the same
 * status the HTTP boundary actually returns, instead of restating the
 * mapping in a second place where it could drift.
 */
export function httpStatusForCode(code: CapabilityErrorCode): number {
  return STATUS_BY_CODE[code];
}

/**
 * One error taxonomy for every capability, not a per-module reinvention —
 * mirrors the "exactly one" spirit of the ADR-030 singleton rules even
 * though the error contract itself isn't one of the five named roles.
 * Modules throw this directly with the appropriate stable code; the HTTP
 * boundary (modules/capability/interfaces/http-exception.filter.ts) maps it
 * to the stable {code, message, details, requestId} envelope
 * (05_API_CAPABILITY_CONTRACTS.md §1) and the matching HTTP status.
 */
export class CapabilityError extends Error {
  public readonly httpStatus: number;

  constructor(
    public readonly code: CapabilityErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CapabilityError";
    this.httpStatus = STATUS_BY_CODE[code];
  }
}
