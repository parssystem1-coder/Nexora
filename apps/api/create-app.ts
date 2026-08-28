import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";
import { requestContextMiddleware } from "./request-context.middleware.js";
import { loggingMiddleware } from "./logging.middleware.js";
import { securityHeadersMiddleware } from "./security-headers.middleware.js";
import { loadTrustProxyConfig } from "../../platform/config.js";

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
 * AUTHENTICATION_REQUIRED response carries a requestId. CORS and the security
 * headers run first, ahead of both: a cross-origin preflight or a response to
 * a request a guard will go on to reject should still carry the standard
 * headers, and CORS in particular needs to run before anything else can
 * short-circuit a preflight OPTIONS request.
 *
 * CORS is explicitly disabled (`origin: false`), not merely left unconfigured
 * — verified directly, not assumed, that this is what "deny by default" needs:
 * `cors`'s own README describes `origin: false` as "disable CORS", but its
 * source only honors that when `corsOptions.origin` is truthy for building an
 * `originCallback` at all (`node_modules/cors/lib/index.js`) — `false` skips
 * that entirely and the middleware calls `next()` with zero CORS headers set,
 * for both a preflight and an actual request. No allowlist exists yet because
 * nothing sets one; when one is needed it is real config, not an invented env
 * var (decisions/2026-08.md, this date).
 *
 * The test-side assembly, `createTestApp`, lives in
 * `test-support/create-test-app.ts`, not here — it needs NestJS's testing
 * module, a devDependency, and this file is imported (transitively, via
 * main.ts) by the production build, which must never import a devDependency
 * (decisions/2026-08.md has the production-install proof). `createTestApp`
 * still calls this file's own `applyMiddleware`, so the "never a different
 * middleware stack" guarantee is unchanged — only the NestJS testing-module
 * construction moved.
 *
 * `trust proxy` (RISK_REGISTER.md R-012) is applied here, explicitly, from
 * `loadTrustProxyConfig` — never left as Express's unexamined default and
 * never hand-set to `true`. This is the one place Express's own client-IP
 * resolution (raw socket peer vs. a proxy-forwarded address) is decided for
 * the whole app; `platform/http/client-ip.ts` is the one place that value
 * is later read.
 */
export function applyMiddleware(app: INestApplication): void {
  // Express sets this on every response by default; NestJS does not disable
  // it. Missed by the previous session, which only thought in terms of
  // headers to ADD — confirmed present with `curl -i` before this fix
  // existed (decisions/2026-08.md, this date). Disabling it here, not just
  // adding a header to remove it downstream, is the actual fix: this stops
  // Express from ever setting it in the first place.
  const expressInstance = app.getHttpAdapter().getInstance() as {
    disable(name: string): void;
    set(name: string, value: unknown): void;
  };
  expressInstance.disable("x-powered-by");
  expressInstance.set("trust proxy", loadTrustProxyConfig());
  app.enableCors({ origin: false });
  app.use(securityHeadersMiddleware);
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.use(loggingMiddleware);
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  applyMiddleware(app);
  return app;
}
