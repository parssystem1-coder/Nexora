import "reflect-metadata";
import { createApp } from "./create-app.js";

async function bootstrap(): Promise<void> {
  const app = await createApp();
  // Required for DatabaseLifecycle's onApplicationShutdown to fire (drains
  // both connection pools) — without this a restart or SIGTERM leaks them.
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap().catch((err) => {
  // Without this, a startup failure (e.g. Postgres unreachable) surfaces
  // only as an unhandled rejection with no clear signal to the process
  // supervisor.
  console.error("Failed to start the API:", err);
  process.exit(1);
});
