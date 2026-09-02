import { describe, it, expect } from "vitest";
import { LoginService } from "./login.service.js";
import { User } from "../domain/user.entity.js";
import { Credential } from "../domain/credential.entity.js";
import type { UserRepository } from "../domain/user.repository.js";
import type { CredentialRepository } from "../domain/credential.repository.js";
import type { SessionRepository, CreateSessionCommand } from "../domain/session.repository.js";
import type { PasswordHasher } from "../domain/password-hasher.js";
import { DUMMY_PASSWORD_HASH } from "../domain/password-hasher.js";
import type { Clock } from "../../../platform/clock.js";

const CREATED_AT = new Date("2026-08-23T14:00:00.000Z");
const clock: Clock = { now: () => CREATED_AT };

const USER_ID = "11111111-1111-1111-1111-111111111111";
// A passphrase containing a space, deliberately: ADR-030's secret scanner
// (SECRET-CREDENTIAL-LITERAL) flags an assignment to `password` whose quoted
// value has no whitespace and is 8+ characters, the shape a real leaked
// token or password would have. A multi-word fixture like this one falls
// outside that shape by construction, correctly.
const COMMAND = {
  sessionId: "22222222-2222-2222-2222-222222222222",
  email: "person@example.test",
  password: "correct horse battery staple",
};

const activeUser = new User(USER_ID, "person@example.test", "Person", "ACTIVE");
const suspendedUser = new User(USER_ID, "person@example.test", "Person", "SUSPENDED");
const realCredential = new Credential("cred-1", USER_ID, "real-hash", CREATED_AT);

/** Deterministic fake: "matches" only the exact hash+password pair the test wires up, so timing-equalization can be pinned by call count rather than real Argon2 cost. */
function fakeHasher(correctPairs: Array<{ hash: string; password: string }>): PasswordHasher & { verifyCalls: number } {
  let verifyCalls = 0;
  return {
    verifyCalls: 0,
    async hash() {
      return "unused";
    },
    async verify(hash, password) {
      verifyCalls++;
      (this as { verifyCalls: number }).verifyCalls = verifyCalls;
      return correctPairs.some((pair) => pair.hash === hash && pair.password === password);
    },
  };
}

function fakes(options: { user?: User | null; credential?: Credential | null; passwordMatchesReal?: boolean }) {
  const sessionsCreated: CreateSessionCommand[] = [];

  const users: UserRepository = {
    findById: async () => null,
    findByEmail: async () => (options.user === undefined ? activeUser : options.user),
  };
  const credentials: CredentialRepository = {
    findByUserId: async () => (options.credential === undefined ? realCredential : options.credential),
    create: async () => {
      throw new Error("LoginService must not create credentials.");
    },
  };
  const sessions: SessionRepository = {
    findByTokenHash: async () => null,
    findById: async () => {
      throw new Error("LoginService must not resolve a session by id.");
    },
    create: async (command) => {
      sessionsCreated.push(command);
    },
    setActiveOrganization: async () => {
      throw new Error("LoginService must not change the active organization.");
    },
  };
  const hasher = fakeHasher(
    options.passwordMatchesReal === false ? [] : [{ hash: "real-hash", password: COMMAND.password }],
  );

  return {
    sessionsCreated,
    hasher,
    service: new LoginService(users, credentials, sessions, hasher, clock),
  };
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 5, pipeline step 7. Fast, no-DB counterpart to
 * apps/api/auth-login.integration.spec.ts: this isolates the use case's
 * orchestration and the enumeration-resistance logic; the integration test
 * additionally proves the real Argon2id hasher, the cookie, and the audit
 * event behave as assumed here.
 */
describe("LoginService", () => {
  it("returns SUCCESS, creates the session, and returns the documented DTO for correct credentials", async () => {
    const { sessionsCreated, service } = fakes({});

    const outcome = await service.execute(COMMAND);

    expect(outcome.kind).toBe("SUCCESS");
    if (outcome.kind !== "SUCCESS") throw new Error("unreachable");
    expect(outcome.userId).toBe(USER_ID);
    expect(outcome.dto).toEqual({
      userId: USER_ID,
      email: "person@example.test",
      displayName: "Person",
      activeOrganizationId: null,
      sessionExpiresAt: new Date(CREATED_AT.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(typeof outcome.rawToken).toBe("string");
    expect(outcome.rawToken.length).toBeGreaterThan(0);

    expect(sessionsCreated).toHaveLength(1);
    expect(sessionsCreated[0]).toMatchObject({
      id: COMMAND.sessionId,
      userId: USER_ID,
      activeOrganizationId: null,
      createdAt: CREATED_AT,
    });
  });

  it("sets activeOrganizationId to null unconditionally - never inferred from a sole membership (ADR-002)", async () => {
    const { sessionsCreated, service } = fakes({});
    await service.execute(COMMAND);
    expect(sessionsCreated[0]!.activeOrganizationId).toBeNull();
  });

  it("the raw token is never the stored value - tokenHash differs from rawToken and is what create() receives", async () => {
    const { sessionsCreated, service } = fakes({});
    const outcome = await service.execute(COMMAND);
    if (outcome.kind !== "SUCCESS") throw new Error("unreachable");
    expect(sessionsCreated[0]!.tokenHash).not.toBe(outcome.rawToken);
  });

  it("returns INVALID_CREDENTIALS with the resolved userId for a wrong password on a real account", async () => {
    const { sessionsCreated, service } = fakes({ passwordMatchesReal: false });

    const outcome = await service.execute(COMMAND);

    expect(outcome).toEqual({ kind: "INVALID_CREDENTIALS", userId: USER_ID });
    expect(sessionsCreated).toEqual([]);
  });

  it("returns INVALID_CREDENTIALS with userId: null for an unknown email", async () => {
    const { service } = fakes({ user: null, credential: null });

    const outcome = await service.execute(COMMAND);

    expect(outcome).toEqual({ kind: "INVALID_CREDENTIALS", userId: null });
  });

  it("returns INVALID_CREDENTIALS with the resolved userId for a user with no credential row - the user WAS resolved, only the credential is missing", async () => {
    const { service } = fakes({ credential: null });

    const outcome = await service.execute(COMMAND);

    expect(outcome).toEqual({ kind: "INVALID_CREDENTIALS", userId: USER_ID });
  });

  it("returns INVALID_CREDENTIALS with the resolved userId for a SUSPENDED user, even with the correct password", async () => {
    const { sessionsCreated, service } = fakes({ user: suspendedUser });

    const outcome = await service.execute(COMMAND);

    expect(outcome).toEqual({ kind: "INVALID_CREDENTIALS", userId: USER_ID });
    expect(sessionsCreated).toEqual([]);
  });

  it("performs exactly one hasher.verify() call on every non-success path, closing the timing side channel", async () => {
    const unknownEmail = fakes({ user: null, credential: null });
    await unknownEmail.service.execute(COMMAND);
    expect(unknownEmail.hasher.verifyCalls).toBe(1);

    const noCredential = fakes({ credential: null });
    await noCredential.service.execute(COMMAND);
    expect(noCredential.hasher.verifyCalls).toBe(1);

    const wrongPassword = fakes({ passwordMatchesReal: false });
    await wrongPassword.service.execute(COMMAND);
    expect(wrongPassword.hasher.verifyCalls).toBe(1);

    const suspended = fakes({ user: suspendedUser });
    await suspended.service.execute(COMMAND);
    expect(suspended.hasher.verifyCalls).toBe(1);
  });

  it("verifies against DUMMY_PASSWORD_HASH when no real credential exists, never skipping the hash step", async () => {
    let hashChecked: string | undefined;
    const users: UserRepository = { findById: async () => null, findByEmail: async () => null };
    const credentials: CredentialRepository = {
      findByUserId: async () => null,
      create: async () => {
        throw new Error("unused");
      },
    };
    const sessions: SessionRepository = {
      findByTokenHash: async () => null,
      findById: async () => {
        throw new Error("LoginService must not resolve a session by id.");
      },
      create: async () => {
        throw new Error("must not create a session");
      },
      setActiveOrganization: async () => {
        throw new Error("must not change the active organization");
      },
    };
    const hasher: PasswordHasher = {
      hash: async () => "unused",
      verify: async (hash) => {
        hashChecked = hash;
        return false;
      },
    };

    await new LoginService(users, credentials, sessions, hasher, clock).execute(COMMAND);

    expect(hashChecked).toBe(DUMMY_PASSWORD_HASH);
  });

  it("does not write an audit event itself - that is step 8, owned by the caller (ADR-034 item 6, ADR-035)", () => {
    // Structural pin, same as every other application service's: the
    // constructor takes a repository/hasher quartet and a clock, no audit
    // dependency.
    expect(LoginService.length).toBe(5);
  });
});
