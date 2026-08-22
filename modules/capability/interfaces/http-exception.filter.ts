import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { CapabilityError } from "../contracts/index.js";

interface StableErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

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
      const body: StableErrorBody = {
        code: "VALIDATION_ERROR",
        message: exception.message,
        requestId,
      };
      response.status(exception.getStatus()).json(body);
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
