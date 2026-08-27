import { Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { SessionGuard } from "./session.guard.js";
import type { RequestWithIdentity } from "./session.guard.js";
import { runCapabilityAttempt } from "../../capability/contracts/index.js";
import { AuditEvent, PLATFORM_TENANT_ID } from "../../audit/contracts/index.js";
import { authLogoutCapability } from "./auth-logout.capability.js";
import type { LogoutOutputDto } from "../application/logout.input.js";
import { LogoutService } from "../application/logout.service.js";
import { SessionRevocationRepositoryPg } from "../infrastructure/session-revocation.repository.pg.js";

type LogoutRequest = RequestWithIdentity & { requestId?: string; correlationId?: string };

/**
 * `POST /api/v1/auth/logout` — 08_PHASE_1_BRIEF.md §3 slice 5 (second of
 * three). See DECISION_LOG.md 2026-08-24 "why auth.logout and
 * auth.logout_all are one slice, not two" for why this and
 * AuthLogoutAllController were built together. ADR-029 item 6's "explicit
 * logout" invalidation trigger.
 *
 * Pipeline accounting (DECISION_LOG.md 2026-08-24, decision 8): step 1 is
 * `SessionGuard`, unchanged from every other guarded capability — and here
 * it is also the whole of what steps 2-4 would otherwise do, since there is
 * no organization or store to resolve; `request.authenticatedIdentity`
 * already names the exact session this request is acting on, with no
 * further resource id to accept or validate. No transaction (step 5): every
 * table this touches (`sessions`) is RLS-exempt and the single UPDATE is
 * atomic on its own, the same reasoning `auth.login` established. No
 * permission to assert (step 6): a user always may end their own session,
 * and there is no target other than themself to authorize against. Step 7
 * is `LogoutService`. Steps 8-10 survive unchanged: one durable audit event
 * under ADR-035's sentinel (this is its second user, not a one-off for
 * `auth.login`), the stable error envelope, structured logging.
 *
 * A second call carrying the same, now-revoked cookie fails at
 * `SessionGuard` with `AUTHENTICATION_REQUIRED` before this handler ever
 * runs, and so writes no audit event — a deliberate contract, not an
 * accident of guard ordering (decision 4): `auth.logout` is declared NOT
 * idempotent (05 §4.1), and a second call genuinely is a different
 * situation (no session left to end), not a repeat of the same successful
 * one. Many APIs make logout unconditionally return success; doing that here
 * would mean either running this route without `SessionGuard` (which
 * contradicts the guard-resolves-identity-first shape every other capability
 * in this codebase follows) or fabricating a resource id to audit against
 * when none was ever resolved — neither is worth a one-route carve-out.
 */
@Controller("api/v1/auth")
export class AuthLogoutController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post("logout")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(
    @Req() request: LogoutRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutOutputDto> {
    const identity = request.authenticatedIdentity!;
    const requestId = request.requestId ?? "";
    const correlationId = request.correlationId ?? "";
    const rlsContext = { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null };

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034), under the platform-scope
    // sentinel tenant (ADR-035) since auth.logout is 05 §4.1's user scope,
    // not a tenant.
    await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        new LogoutService(new SessionRevocationRepositoryPg(this.appDb), systemClock).execute({
          sessionId: identity.sessionId,
          userId: identity.userId,
        }),
      (outcome) =>
        new AuditEvent(
          PLATFORM_TENANT_ID,
          identity.userId,
          "user",
          authLogoutCapability.id,
          "session",
          identity.sessionId,
          outcome,
          requestId,
          correlationId,
        ),
    );

    // The clearing response must repeat login's cookie attributes, or the
    // browser treats it as a different cookie and never actually clears the
    // one it holds — proven in apps/api/auth-logout.integration.spec.ts
    // rather than asserted here in a comment.
    response.clearCookie("sid", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

    return {};
  }
}
