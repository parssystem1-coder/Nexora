import { createHash, randomBytes } from "node:crypto";

/**
 * Sessions store a hash of the token, never the token itself (ADR-029 §2's
 * hashing requirement is stated for passwords; the same principle applies to
 * any bearer secret — a DB read should not hand an attacker a valid session).
 * SHA-256 (not Argon2id) is appropriate here: this hashes a high-entropy
 * random token for fast equality lookup, not a low-entropy user password
 * that needs to resist offline brute force.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
