import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Credential } from "../domain/credential.entity.js";
import type { CredentialRepository } from "../domain/credential.repository.js";
import "./identity.tables.js";

/** credentials has no RLS (identity cluster exemption), so a plain Kysely<Database> is enough and no transaction is needed. */
export class CredentialRepositoryPg implements CredentialRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByUserId(userId: string): Promise<Credential | null> {
    const row = await this.conn
      .selectFrom("credentials")
      .select(["id", "user_id", "password_hash", "created_at"])
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!row) return null;
    return new Credential(row.id, row.user_id, row.password_hash, row.created_at);
  }

  async create(credential: Credential): Promise<void> {
    await this.conn
      .insertInto("credentials")
      .values({
        id: credential.id,
        user_id: credential.userId,
        password_hash: credential.passwordHash,
        created_at: credential.createdAt.toISOString(),
        updated_at: credential.createdAt.toISOString(),
      })
      .execute();
  }
}
