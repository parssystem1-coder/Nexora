import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { User } from "../domain/user.entity.js";
import type { UserRepository } from "../domain/user.repository.js";
import "./identity.tables.js";

/** users has no RLS (identity cluster exemption), so a plain Kysely<Database> is enough — no transaction needed. */
export class UserRepositoryPg implements UserRepository {
  constructor(private readonly conn: Kysely<Database>) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.conn.selectFrom("users").select(["id", "status"]).where("id", "=", id).executeTakeFirst();
    if (!row) return null;
    return new User(row.id, row.status as "ACTIVE" | "SUSPENDED");
  }
}
