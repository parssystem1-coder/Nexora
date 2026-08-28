import { Body, Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { RATE_LIMIT_STORE } from "../../../platform/rate-limit/store.js";
import type { RateLimitStore } from "../../../platform/rate-limit/store.js";
import type { RateLimitPolicy } from "../../../platform/rate-limit/policy.js";
import { clientIp } from "../../../platform/http/client-ip.js";
import { CapabilityError, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { AuditEvent, PLATFORM_TENANT_ID } from "../../audit/contracts/index.js";
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
 * RISK_REGISTER.md R-005 / ADR-029 item 2: "failed attempts are rate-limited
 * per identifier and per IP." Two independent policies, not one shared
 * threshold — see decisions/2026-08.md (this date) for the full numbers
 * justification. Per-identifier is deliberately the tighter of the two: one
 * account being hammered is a stronger signal than one IP being active,
 * since a single IP can legitimately represent many real users behind NAT/a
 * shared network.
 */
const LOGIN_IDENTIFIER_POLICY: RateLimitPolicy = { windowMs: 15 * 60 * 1000, maxAttempts: 5 };
const LOGIN_IP_POLICY: RateLimitPolicy = { windowMs: 15 * 60 * 1000, maxAttempts: 30 };

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
 *
 * **Rate limiting (RISK_REGISTER.md R-005, decisions/2026-08.md this date):**
 * checked first, inside this same audited attempt, before `LoginService` is
 * even constructed — before the Argon2 verify and before the one write this
 * capability can make. Keyed on the RAW client-supplied email (lowercased,
 * never the resolved user id) and on the client IP resolved through
 * `platform/http/client-ip.ts` (never inlined here directly — see
 * RISK_REGISTER.md R-012 for why that derivation has its own single, named
 * home rather than being read off the request per call site), exactly the
 * two things `LoginService` itself already has before it does anything expensive. This
 * is deliberate, not incidental: checking by raw identifier means an unknown
 * email and a real one are throttled by an IDENTICAL rule after an IDENTICAL
 * number of attempts, with an IDENTICAL (fast, pre-Argon2) response — a
 * limiter keyed on "does this account exist" or "how many real failed
 * verifies has this real user had" would reintroduce exactly the enumeration
 * oracle `LoginService`'s own equal-timing, equal-code design exists to
 * close. A blocked attempt never reaches `LoginService`, so `actorUserId`
 * stays `null` for it — the same honest "we do not know who this is" the
 * unknown-email case already returns for the audit trail.
 */
@Controller("api/v1/auth")
export class AuthLoginController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
    @Inject(RATE_LIMIT_STORE) private readonly rateLimitStore: RateLimitStore,
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
    const rlsContext = { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null };

    let actorUserId: string | null = null;
    const identifierKey = `login:identifier:${parsed.data.email.trim().toLowerCase()}`;
    const ipKey = `login:ip:${clientIp(request)}`;

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034), under the platform-scope
    // sentinel tenant (ADR-035) since auth.login is 05 §4.1's global scope.
    const { dto, rawToken } = await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      async () => {
        // Checked before LoginService is even constructed - before the
        // Argon2 verify, before any DB read this capability would otherwise
        // do. A blocked request never resolves a user, so this cannot
        // distinguish a real account from an unknown one (see this
        // controller's own doc comment).
        if (
          this.rateLimitStore.isBlocked(identifierKey, LOGIN_IDENTIFIER_POLICY) ||
          this.rateLimitStore.isBlocked(ipKey, LOGIN_IP_POLICY)
        ) {
          throw new CapabilityError("RATE_LIMITED", "Too many login attempts. Try again later.");
        }

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
          // Recorded only now - after the real outcome is known - and for
          // every failure alike, whether the email was unknown, the
          // password was wrong, or the account is suspended: the same
          // uniformity LoginService's own equal-timing design already
          // relies on, so the counter itself cannot become a second
          // enumeration channel.
          this.rateLimitStore.recordAttempt(identifierKey, LOGIN_IDENTIFIER_POLICY);
          this.rateLimitStore.recordAttempt(ipKey, LOGIN_IP_POLICY);
          throw new CapabilityError("AUTHENTICATION_REQUIRED", "Invalid email or password.");
        }
        return { dto: result.dto, rawToken: result.rawToken };
      },
      (outcome) =>
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

    // ADR-029 item 3: opaque, httpOnly, Secure, SameSite=Lax. `secure: true`
    // unconditionally — every existing test authenticates by copying the
    // cookie value into a `Cookie` header by hand (supertest has no
    // browser-style cookie jar enforcing Secure), so this does not break a
    // single test; a real browser only ever sends it back over HTTPS, which
    // production termination provides. `maxAge` tracks the session's real
    // server-side lifetime so the cookie cannot silently outlive it.
    response.cookie("sid", rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_LIFETIME_MS,
    });

    return dto;
  }
}
