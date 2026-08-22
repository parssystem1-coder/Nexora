import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export type RequestWithContext = Request & { requestId: string; correlationId: string };

/** Runs before any guard, so every log line and error response has a requestId even for AUTHENTICATION_REQUIRED. */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const withContext = req as RequestWithContext;
  withContext.requestId = randomUUID();
  const incoming = req.headers["x-correlation-id"];
  withContext.correlationId = typeof incoming === "string" && incoming.length > 0 ? incoming : withContext.requestId;
  next();
}
