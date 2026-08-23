import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { User } from "../domain/user.entity.js";
import { normalizeEmail } from "../domain/email.vo.js";
import type { UserRepository } from "../domain/user.repository.js";
import "./identity.tables.js";

/**
 * users has no RLS (identity cluster exemption), so a plain Kysely<Database>
 * is enough and no transaction is needed. A Transaction is accepted too, so a
 * caller that already has one open (membership.invite, resolving the invitee
 * inside its own transaction) does not have to reach for a second connection.
 */
export class UserRepositoryPg implements UserRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.conn
      .selectFrom("users")
      .select(["id", "email", "display_name", "status"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return new User(row.id, row.email, row.display_name, row.status as "ACTIVE" | "SUSPENDED");
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.conn
      .selectFrom("users")
      .select(["id", "email", "display_name", "status"])
      .where("email_normalized", "=", normalizeEmail(email))
      .executeTakeFirst();
    if (!row) return null;
    return new User(row.id, row.email, row.display_name, row.status as "ACTIVE" | "SUSPENDED");
  }
}
