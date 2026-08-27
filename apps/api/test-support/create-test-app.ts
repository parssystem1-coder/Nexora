import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../app.module.js";
import { applyMiddleware } from "../create-app.js";

/**
 * Same stack as createApp() (../create-app.js), assembled through the testing
 * module. Lives under test-support/, not create-app.ts, because
 * @nestjs/testing is a devDependency: create-app.ts is imported (transitively,
 * via main.ts) by the production build, and a devDependency import there
 * fails under `npm ci --omit=dev` — see decisions/2026-08.md for the
 * production-install proof that found this. Moving this function does not
 * weaken create-app.ts's own guarantee ("a test can never pass against a
 * different middleware stack than the one that ships") — this still calls
 * the one `applyMiddleware` create-app.ts exports, so both paths still share
 * exactly the same middleware wiring; only the test-only NestJS testing
 * module construction moved.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  applyMiddleware(app);
  await app.init();
  return app;
}
