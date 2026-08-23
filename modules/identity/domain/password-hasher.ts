/**
 * ADR-029 item 2: "Password hashing uses Argon2id, or bcrypt with a
 * documented cost floor if Argon2id is unavailable." The concrete algorithm
 * is an infrastructure concern (a native/WASM library, never imported by
 * domain code — ADR-030's forbidden-import rule), so domain sees only this
 * port. `modules/identity/infrastructure/password-hasher.argon2.ts` is the
 * one implementation.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(hash: string, plainPassword: string): Promise<boolean>;
}

/**
 * A real Argon2id hash of a fixed, non-secret passphrase, produced by the
 * same algorithm and parameters `Argon2PasswordHasher` uses for real
 * credentials — a precomputed literal, not computed at request time or at
 * process startup, so there is zero variance to account for.
 *
 * Exists solely so `LoginService` can run a verify of comparable cost when
 * no real credential exists to check against (unknown email, or a user with
 * no credential row) — DECISION_LOG.md "auth.login: closing the login
 * timing side channel". Never a value any real password is checked
 * against in a way that could authenticate anything: the login flow only
 * ever *rejects* after consulting this constant, it never accepts.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$mXCxrtSMQ8UqurF+miLHJQ$UAbceZ+WPDDCVK4SIwCVNgPGjRB5+tGBGKPGX+ddUks";
