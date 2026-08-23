import type { Clock } from "../../../platform/clock.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { CredentialRepository } from "../domain/credential.repository.js";
import type { SessionRepository } from "../domain/session.repository.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import { DUMMY_PASSWORD_HASH } from "../domain/password-hasher.js";
import { generateSessionToken, hashSessionToken } from "../domain/session-token.vo.js";
import type { LoginOutputDto } from "./login.input.js";

export interface LoginCommand {
  /** Minted by the caller before this runs, so a failed attempt's audit event still names a stable resource. */
  sessionId: string;
  email: string;
  password: string;
}

/** A day's worth of milliseconds, spelled out once. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long a browser session created by auth.login stays valid. Fixed here
 * because no document in the pack sets one; there is no sliding-expiration
 * or refresh mechanism for browser sessions in Phase 1 (ADR-029 item 4
 * reserves refresh for programmatic access tokens only), so this is a flat
 * lifetime from creation, not from last use. Revisit alongside a real
 * product session-length policy.
 */
export const SESSION_LIFETIME_MS = 30 * DAY_MS;

/**
 * Discriminated so the controller can never confuse "what the client is
 * told" with "what the audit trail records" (DECISION_LOG.md "auth.login:
 * why LoginService returns a result instead of throwing on bad
 * credentials"). `userId` is populated on `INVALID_CREDENTIALS` whenever a
 * real user was resolved (wrong password, suspended account) and stays
 * `null` for an unknown email — the controller uses it ONLY for the audit
 * event's `actor_user_id`, never for the client-facing response, which is
 * identical regardless.
 */
export type LoginOutcome =
  | { kind: "SUCCESS"; userId: string; dto: LoginOutputDto; rawToken: string }
  | { kind: "INVALID_CREDENTIALS"; userId: string | null };

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5 (first of three), pipeline step 7 for the
 * one capability in this codebase with almost no pipeline before it — see
 * DECISION_LOG.md "auth.login: which pipeline steps survive" for the full
 * accounting. No transaction, no tenant, no permission: every table this
 * touches (`users`, `credentials`, `sessions`) is RLS-exempt, and the single
 * write is one INSERT, atomic on its own.
 *
 * Unknown email, wrong password and a suspended user must be
 * indistinguishable to the caller (same precedent `ValidateSessionService`
 * already sets, same reason: distinguishing them would help an attacker
 * enumerate valid accounts) — the code path is identical, right up to the
 * single `LoginOutcome.INVALID_CREDENTIALS` branch. Timing must be
 * indistinguishable too: every path that does not succeed still performs
 * exactly one Argon2 verify, against the real stored hash if one exists or
 * `DUMMY_PASSWORD_HASH` (same algorithm and parameters) if it does not —
 * an unknown email that skipped hashing entirely would return measurably
 * faster than a wrong password for a real account.
 */
export class LoginService {
  constructor(
    private readonly users: UserRepository,
    private readonly credentials: CredentialRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(command: LoginCommand): Promise<LoginOutcome> {
    const user = await this.users.findByEmail(command.email);
    const credential = user ? await this.credentials.findByUserId(user.id) : null;

    const hashToCheck = credential?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwordHasher.verify(hashToCheck, command.password);

    if (!user || !credential || !passwordMatches || !user.isActive) {
      return { kind: "INVALID_CREDENTIALS", userId: user?.id ?? null };
    }

    const rawToken = generateSessionToken();
    const createdAt = this.clock.now();
    const expiresAt = new Date(createdAt.getTime() + SESSION_LIFETIME_MS);

    await this.sessions.create({
      id: command.sessionId,
      userId: user.id,
      tokenHash: hashSessionToken(rawToken),
      // ADR-002: never inferred from a sole membership - see DECISION_LOG.md.
      activeOrganizationId: null,
      createdAt,
      expiresAt,
    });

    return {
      kind: "SUCCESS",
      userId: user.id,
      rawToken,
      dto: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        activeOrganizationId: null,
        sessionExpiresAt: expiresAt.toISOString(),
      },
    };
  }
}
