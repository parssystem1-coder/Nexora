import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import { requestContextMiddleware } from "./request-context.middleware.js";
import { loggingMiddleware } from "./logging.middleware.js";

/**
 * The single definition of how the API is assembled. Both the real entry point
 * (main.ts) and the integration test build the app through this, so a test can
 * never pass against a different middleware stack than the one that ships —
 * which is exactly what happened before: the test applied only cookieParser(),
 * so requestId/correlationId were undefined throughout and pipeline step 10
 * (structured logging) was never exercised by any test at all.
 *
 * Middleware order is load-bearing: requestContext must precede logging (which
 * reads the ids it assigns) and both must precede the guards, so that even an
 * AUTHENTICATION_REQUIRED response carries a requestId.
 *
 * The test-side assembly, `createTestApp`, lives in
 * `test-support/create-test-app.ts`, not here — it needs NestJS's testing
 * module, a devDependency, and this file is imported (transitively, via
 * main.ts) by the production build, which must never import a devDependency
 * (decisions/2026-08.md has the production-install proof). `createTestApp`
 * still calls this file's own `applyMiddleware`, so the "never a different
 * middleware stack" guarantee is unchanged — only the NestJS testing-module
 * construction moved.
 */
export function applyMiddleware(app: INestApplication): void {
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.use(loggingMiddleware);
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  applyMiddleware(app);
  return app;
}
