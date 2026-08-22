import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../platform/db/connections.js";

/**
 * Drains both pools on shutdown. Without this, main.ts's app.listen() has no
 * corresponding cleanup, so a restart or a graceful shutdown leaks
 * connections until the OS reaps the process. Requires
 * app.enableShutdownHooks() in main.ts for onApplicationShutdown to fire.
 */
@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.appDb.destroy(), this.auditDb.destroy()]);
  }
}
