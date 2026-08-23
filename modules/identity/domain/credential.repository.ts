import type { Credential } from "./credential.entity.js";

/**
 * One password credential per user (`UNIQUE (user_id)`,
 * `<timestamp>_identity__create_credentials.sql`). There is no
 * multi-credential model in Phase 1 — a future external identity provider
 * (SSO) is a row in `identity_providers`, a separate table for a separate
 * concern, not a second row here.
 */
export interface CredentialRepository {
  findByUserId(userId: string): Promise<Credential | null>;

  /** Test/bootstrap seeding only in Phase 1 — no capability yet sets or changes a password. */
  create(credential: Credential): Promise<void>;
}
