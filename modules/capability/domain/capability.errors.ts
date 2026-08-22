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
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<CapabilityErrorCode, number> = {
  AUTHENTICATION_REQUIRED: 401,
  SESSION_INVALIDATED: 401,
  FORBIDDEN: 403,
  TENANT_CONTEXT_REQUIRED: 400,
  STORE_ACCESS_DENIED: 403,
  VALIDATION_ERROR: 400,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
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
