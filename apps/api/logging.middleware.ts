import type { NextFunction, Request, Response } from "express";

/** 08_PHASE_1_BRIEF.md §2 step 10: structured logging with requestId, correlationId, tenantId. */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on("finish", () => {
    const withContext = req as Request & {
      requestId?: string;
      correlationId?: string;
      tenantContext?: { tenantId: string };
    };
    const entry = {
      requestId: withContext.requestId ?? null,
      correlationId: withContext.correlationId ?? null,
      tenantId: withContext.tenantContext?.tenantId ?? null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    };
    console.log(JSON.stringify(entry));
  });
  next();
}
