import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { ReservedSubdomainRepository } from "../domain/reserved-subdomain.repository.js";
import "./tenant.tables.js";

/** reserved_subdomains has no RLS (platform-wide reference data, 08_PHASE_1_BRIEF.md §5), so this is visible regardless of the caller's tenant context. */
export class ReservedSubdomainRepositoryPg implements ReservedSubdomainRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async isReserved(slug: string): Promise<boolean> {
    const row = await this.conn.selectFrom("reserved_subdomains").select("name").where("name", "=", slug).executeTakeFirst();
    return row !== undefined;
  }
}
