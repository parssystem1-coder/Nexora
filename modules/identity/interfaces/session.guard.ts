import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { UserRepositoryPg } from "../infrastructure/user.repository.pg.js";
import { SessionRepositoryPg } from "../infrastructure/session.repository.pg.js";
import { ValidateSessionService } from "../application/validate-session.service.js";
import type { AuthenticatedIdentity } from "../contracts/index.js";

export type RequestWithIdentity = Request & { authenticatedIdentity?: AuthenticatedIdentity };

const appDb = createDb(loadDbConfig());

/**
 * 08_PHASE_1_BRIEF.md §2 step 1: authentication against a server-side
 * session (ADR-029 item 3: opaque httpOnly cookie, never a stateless token
 * for browser surfaces). No RLS transaction here — users/sessions are
 * exempt (DECISION_LOG.md) — so this queries the plain pool, not
 * withTenantContext().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const rawToken: unknown = request.cookies?.["sid"];

    if (typeof rawToken !== "string" || rawToken.length === 0) {
      throw new CapabilityError("AUTHENTICATION_REQUIRED", "No session cookie present.");
    }

    const validateSession = new ValidateSessionService(
      new SessionRepositoryPg(appDb),
      new UserRepositoryPg(appDb),
      systemClock,
    );
    const identity = await validateSession.execute(rawToken);
    if (!identity) {
      throw new CapabilityError("AUTHENTICATION_REQUIRED", "Session is missing, expired or revoked.");
    }

    request.authenticatedIdentity = identity;
    return true;
  }
}
