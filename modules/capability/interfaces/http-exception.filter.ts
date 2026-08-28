import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { CapabilityError } from "../contracts/index.js";
import type { CapabilityErrorCode } from "../contracts/index.js";
import { isConcurrencyFailure } from "../../../platform/db/concurrency-error.js";

interface StableErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

/**
 * 05_API_CAPABILITY_CONTRACTS.md §7's codes, keyed by the HTTP status a
 * framework-level HttpException carries. Only statuses this API can
 * actually produce map to a documented code; anything else (e.g. a 405 from
 * NestJS's own router) falls through to the unmapped branch below as
 * INTERNAL_ERROR/500 rather than inventing a code §7 doesn't list.
 */
const STATUS_TO_CODE: Partial<Record<number, CapabilityErrorCode>> = {
  400: "VALIDATION_ERROR",
  401: "AUTHENTICATION_REQUIRED",
  403: "FORBIDDEN",
  404: "RESOURCE_NOT_FOUND",
  409: "CONFLICT",
};

/**
 * 08_PHASE_1_BRIEF.md §2 step 9: "stable error contract for every failure
 * mode." Every thrown error, known or not, becomes exactly this shape —
 * an unmapped error becomes INTERNAL_ERROR with no leaked detail, never a
 * raw stack trace or driver error message in the response body.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? randomUUID();

    if (exception instanceof CapabilityError) {
      const body: StableErrorBody = {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      };
      response.status(exception.httpStatus).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = STATUS_TO_CODE[status];
      if (code) {
        const body: StableErrorBody = { code, message: exception.message, requestId };
        response.status(status).json(body);
        return;
      }
      // A framework exception whose status has no documented code (e.g. 405
      // from an unmatched HTTP method) — fall through to the same
      // no-leaked-detail INTERNAL_ERROR path as a genuinely unexpected error,
      // rather than returning a status/code pair §7 doesn't define.
      this.logger.error(`Unmapped HttpException status ${status}: ${exception.message}`, undefined, requestId);
      const body: StableErrorBody = { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId };
      response.status(500).json(body);
      return;
    }

    // RISK_REGISTER.md R-008's candidate mitigation (2), decisions/2026-08.md
    // this date: a raw PostgreSQL deadlock (40P01) or serialization failure
    // (40001) reaches here unwrapped — Kysely surfaces the driver's
    // DatabaseError as-is, and it is neither a CapabilityError (no repository
    // translates it into one; unlike a unique-violation, a concurrency
    // failure carries no call-site-specific meaning worth extracting — see
    // platform/db/concurrency-error.ts's own doc comment) nor a NestJS
    // HttpException. Checked before the generic 500 specifically so this
    // RETRYABLE failure is never conflated with a genuinely unexpected error.
    if (isConcurrencyFailure(exception)) {
      const body: StableErrorBody = {
        code: "CONCURRENCY_CONFLICT",
        message: "The request could not complete due to a database conflict. Retrying is expected to succeed.",
        requestId,
      };
      response.status(409).json(body);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception), undefined, requestId);
    const body: StableErrorBody = {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId,
    };
    response.status(500).json(body);
  }
}
