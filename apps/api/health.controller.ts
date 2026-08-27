import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import { APP_DB } from "../../platform/db/connections.js";
import type { Database } from "../../platform/db/kysely.js";

/**
 * Liveness plus a real readiness check, for whatever probes this deployment
 * (a load balancer, an orchestrator) before routing traffic to it.
 *
 * Deliberately NOT a capability: no tenant, no permission, no audit event,
 * and no `CapabilityDefinition` — see decisions/2026-08.md for why this
 * coexists with the capability model as a plain route rather than one. It
 * also does not go through `HttpExceptionFilter`'s `CapabilityError`-shaped
 * contract: a probe consumes this response, not an API client working
 * against `05_API_CAPABILITY_CONTRACTS.md`'s error envelope, so this handles
 * its own response entirely (`@Res`) rather than throwing into the shared
 * filter. `05` §7's no-leak posture still applies regardless — the failure
 * branch below never returns a driver error, a connection string, or a
 * version, only a fixed, detail-free shape.
 *
 * Readiness is a single `select 1` against `APP_DB` — the same pool every
 * capability actually queries through, so "ready" reflects what a real
 * request would see, not a separate, weaker probe of its own.
 */
@Controller("health")
export class HealthController {
  constructor(@Inject(APP_DB) private readonly appDb: Kysely<Database>) {}

  @Get()
  async check(@Res() res: Response): Promise<void> {
    try {
      await sql`select 1`.execute(this.appDb);
      res.status(200).json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "error" });
    }
  }
}
