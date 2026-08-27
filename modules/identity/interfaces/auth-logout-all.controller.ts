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
import { authLogoutAllCapability } from "./auth-logout-all.capability.js";
import type { LogoutAllOutputDto } from "../application/logout-all.input.js";
import { LogoutAllService } from "../application/logout-all.service.js";
import { SessionRevocationRepositoryPg } from "../infrastructure/session-revocation.repository.pg.js";

type LogoutAllRequest = RequestWithIdentity & { requestId?: string; correlationId?: string };

/**
 * `POST /api/v1/auth/logout-all` — 08_PHASE_1_BRIEF.md §3 slice 5 (third of
 * three; see AuthLogoutController's doc comment and DECISION_LOG.md
 * 2026-08-24 for why this and `auth.logout` are one slice). ADR-029 item 6's
 * "logout-all-devices" invalidation trigger.
 *
 * Pipeline accounting is identical to `AuthLogoutController`'s (decision 8):
 * `SessionGuard` is steps 1-4, no transaction (step 5), no permission (step
 * 6, same reasoning). The one real difference is step 7's scope: this ends
 * every ACTIVE session for `identity.userId`, INCLUDING the one
 * authenticating this very request (decision 3) — a caller who calls
 * `auth.logout_all` is, among other things, logging themself out, the same
 * accepted consequence `membership.role.assign` already established for
 * self-role-assignment. `resource_type`/`resource_id` name the user, not a
 * session (decision 7): there is no single session id this action is "the"
 * target of, since it acts on the caller's whole session set. `metadata:
 * { sessionsRevoked }` is what makes this audit row more useful than
 * `auth.logout`'s — a caller cannot otherwise learn from an
 * ended-everywhere action how many devices that actually was.
 *
 * Same guard-ordering consequence as `auth.logout` (decision 4): a second
 * call with the same cookie fails at `SessionGuard` before this handler
 * runs, since this capability's own first call already revoked the session
 * that would have to authenticate it. 05 §4.1 marks this capability
 * `idempotent: yes` regardless (decision 5) — that is a true statement about
 * what a *fresh, still-valid* session sees calling this repeatedly
 * (`sessionsRevoked` converges to 0, never a growing or side-effecting
 * count), not a claim that the literal same HTTP request can be replayed
 * with the same cookie, which the session-cookie auth model itself rules
 * out here regardless of what this capability declares.
 */
@Controller("api/v1/auth")
export class AuthLogoutAllController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post("logout-all")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logoutAll(@Req() request: LogoutAllRequest, @Res({ passthrough: true }) response: Response): Promise<LogoutAllOutputDto> {
    const identity = request.authenticatedIdentity!;
    const requestId = request.requestId ?? "";
    const correlationId = request.correlationId ?? "";
    const rlsContext = { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null };

    let sessionsRevoked = 0;

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034), under the platform-scope
    // sentinel tenant (ADR-035) - this capability's second, independent user
    // besides auth.logout, the first real evidence the sentinel generalizes
    // rather than being a one-off built for auth.login alone.
    await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      async () => {
        const service = new LogoutAllService(new SessionRevocationRepositoryPg(this.appDb), systemClock);
        const result = await service.execute({ userId: identity.userId });
        sessionsRevoked = result.sessionsRevoked;
        return result;
      },
      (outcome) =>
        new AuditEvent(
          PLATFORM_TENANT_ID,
          identity.userId,
          "user",
          authLogoutAllCapability.id,
          "user",
          identity.userId,
          outcome,
          requestId,
          correlationId,
          { sessionsRevoked },
        ),
    );

    // Same attributes as login set and auth.logout clears with - see
    // AuthLogoutController's comment.
    response.clearCookie("sid", { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

    return { sessionsRevoked };
  }
}
