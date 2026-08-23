import { Body, Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { AuditEvent, recordAuditEventDurable, PLATFORM_TENANT_ID, type AuditOutcome } from "../../audit/contracts/index.js";
import { authLoginCapability } from "./auth-login.capability.js";
import { loginInputSchema } from "../application/login.input.js";
import type { LoginOutputDto } from "../application/login.input.js";
import { LoginService, SESSION_LIFETIME_MS } from "../application/login.service.js";
import { UserRepositoryPg } from "../infrastructure/user.repository.pg.js";
import { CredentialRepositoryPg } from "../infrastructure/credential.repository.pg.js";
import { SessionRepositoryPg } from "../infrastructure/session.repository.pg.js";
import { Argon2PasswordHasher } from "../infrastructure/password-hasher.argon2.js";

type LoginRequest = Request & { requestId?: string; correlationId?: string };

/**
 * `POST /api/v1/auth/login` — 08_PHASE_1_BRIEF.md §3 slice 5 (first of
 * three). The most divergent capability in the codebase from the golden
 * path — see DECISION_LOG.md "auth.login: which pipeline steps survive" for
 * the full accounting rather than a false claim of mirroring it. In
 * summary: no guard runs before this (there is no session yet — this IS
 * step 1, from the other direction); no organization or store is resolved
 * (steps 2-4 do not apply, global scope); no permission is asserted (step 6
 * does not apply, no membership exists yet); and no transaction is opened
 * at all, because every table this touches (`users`, `credentials`,
 * `sessions`) is RLS-exempt and the only write is one INSERT, atomic on its
 * own — `platform/db/tenant-context.ts` stays the only place a transaction
 * is EVER opened in this codebase (ADR-030's singleton rule); this
 * capability simply never needs one.
 *
 * What DOES survive, unchanged: step 8 (one durable audit event on
 * AUDIT_DB, both outcomes, under `PLATFORM_TENANT_ID` — ADR-035), step 9
 * (the stable error envelope, via `CapabilityError`), step 10 (structured
 * logging — `tenantId` in the log line is `null` for this request, honestly,
 * since none exists; the audit sentinel is a storage device for
 * `audit_events` only and is never attached to `request.tenantContext` or
 * exposed to the logger).
 *
 * `LoginService` returns a discriminated `LoginOutcome` rather than
 * throwing on bad credentials specifically so the resolved user id (when
 * one exists) can reach the audit event's `actor_user_id` without ever
 * passing through `CapabilityError.details` — that field IS serialized to
 * the client (`http-exception.filter.ts`), so putting an enumeration-useful
 * value there would leak exactly what §7's generic
 * `AUTHENTICATION_REQUIRED` response is supposed to hide.
 */
@Controller("api/v1/auth")
export class AuthLoginController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Req() request: LoginRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() body: unknown,
  ): Promise<LoginOutputDto> {
    const parsed = loginInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid login payload.", {
        issues: parsed.error.issues,
      });
    }

    const sessionId = randomUUID();
    const requestId = request.requestId ?? "";
    const correlationId = request.correlationId ?? "";

    let outcome: AuditOutcome = "SUCCESS";
    let actorUserId: string | null = null;
    let successDto: LoginOutputDto | undefined;
    let rawToken: string | undefined;
    let thrown: unknown;

    try {
      const service = new LoginService(
        new UserRepositoryPg(this.appDb),
        new CredentialRepositoryPg(this.appDb),
        new SessionRepositoryPg(this.appDb),
        new Argon2PasswordHasher(),
        systemClock,
      );
      const result = await service.execute({ sessionId, email: parsed.data.email, password: parsed.data.password });
      actorUserId = result.userId;

      if (result.kind === "INVALID_CREDENTIALS") {
        outcome = "FAILURE";
        thrown = new CapabilityError("AUTHENTICATION_REQUIRED", "Invalid email or password.");
      } else {
        successDto = result.dto;
        rawToken = result.rawToken;
      }
    } catch (err) {
      outcome = "FAILURE";
      thrown = err;
    }

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034), under the platform-scope
    // sentinel tenant (ADR-035) since auth.login is 05 §4.1's global scope.
    await recordAuditEventDurable(
      this.auditDb,
      { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null },
      new AuditEvent(
        PLATFORM_TENANT_ID,
        actorUserId,
        "user",
        authLoginCapability.id,
        "session",
        sessionId,
        outcome,
        requestId,
        correlationId,
      ),
    );

    if (thrown) throw thrown;

    // ADR-029 item 3: opaque, httpOnly, Secure, SameSite=Lax. `secure: true`
    // unconditionally — every existing test authenticates by copying the
    // cookie value into a `Cookie` header by hand (supertest has no
    // browser-style cookie jar enforcing Secure), so this does not break a
    // single test; a real browser only ever sends it back over HTTPS, which
    // production termination provides. `maxAge` tracks the session's real
    // server-side lifetime so the cookie cannot silently outlive it.
    response.cookie("sid", rawToken!, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_LIFETIME_MS,
    });

    return successDto!;
  }
}
