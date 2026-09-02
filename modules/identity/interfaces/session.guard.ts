import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { UserRepositoryPg } from "../infrastructure/user.repository.pg.js";
import { SessionRepositoryPg } from "../infrastructure/session.repository.pg.js";
import { ValidateSessionService } from "../application/validate-session.service.js";
import type { AuthenticatedIdentity } from "../contracts/index.js";
import { APP_DB } from "../../../platform/db/connections.js";

export type RequestWithIdentity = Request & { authenticatedIdentity?: AuthenticatedIdentity };

/**
 * 08_PHASE_1_BRIEF.md §2 step 1: authentication against a server-side
 * session (ADR-029 item 3: opaque httpOnly cookie, never a stateless token
 * for browser surfaces). No RLS transaction here — users/sessions are
 * exempt (DECISION_LOG.md) — so this queries the plain pool, not
 * withTenantContext(). `db` is injected via the explicit APP_DB token, not
 * an implicitly-typed constructor parameter — see platform/db/connections.ts.
 *
 * ADR-051 splits this guard's single failure code in two: a session row that
 * exists and was REVOKED raises `SESSION_INVALIDATED` (401); no cookie, no
 * row, an expired row, or a suspended user all still raise
 * `AUTHENTICATION_REQUIRED` (401). Same status, different code, and the
 * difference is what lets a client tell "sign in again" from "something is
 * wrong with your request."
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(APP_DB) private readonly db: Kysely<Database>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const rawToken: unknown = request.cookies?.["sid"];

    if (typeof rawToken !== "string" || rawToken.length === 0) {
      throw new CapabilityError("AUTHENTICATION_REQUIRED", "No session cookie present.");
    }

    const validateSession = new ValidateSessionService(
      new SessionRepositoryPg(this.db),
      new UserRepositoryPg(this.db),
      systemClock,
    );
    const validation = await validateSession.execute(rawToken);

    // ADR-051 (ACCEPTED 2026-09-03, Option B). A session that was explicitly
    // revoked is reported as such; everything else stays indistinguishable.
    // The split is exactly two codes wide on purpose - see
    // ValidateSessionService for why separating REVOKED does not weaken the
    // token-enumeration property that keeps the other four cases collapsed.
    if (validation.outcome === "REVOKED") {
      throw new CapabilityError("SESSION_INVALIDATED", "This session has been revoked. Sign in again.");
    }
    if (validation.outcome === "INVALID") {
      throw new CapabilityError("AUTHENTICATION_REQUIRED", "Session is missing or expired.");
    }

    request.authenticatedIdentity = validation.identity;
    return true;
  }
}
