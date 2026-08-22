import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Currency } from "../domain/currency.entity.js";
import type { CurrencyRepository } from "../domain/currency.repository.js";
import "./money.tables.js";

/**
 * currencies is platform-global reference data with no RLS (08_PHASE_1_BRIEF.md
 * §5), so this repository works on a plain connection as readily as on a
 * transaction — unlike the tenant-owned repositories, which must be handed the
 * `trx` from withTenantContext() for their policies to see the session
 * variables.
 *
 * Only code, name and minor_units are selected. The presentation columns are
 * deliberately not read here: mapping them onto the domain entity is exactly
 * what ADR-022 item 4 forbids.
 */
export class CurrencyRepositoryPg implements CurrencyRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findByCode(code: string): Promise<Currency | null> {
    const row = await this.conn
      .selectFrom("currencies")
      .select(["code", "name", "minor_units"])
      .where("code", "=", code)
      .where("status", "=", "ACTIVE")
      .executeTakeFirst();
    if (!row) return null;
    return new Currency(row.code, row.name, row.minor_units);
  }

  async listActive(): Promise<Currency[]> {
    const rows = await this.conn
      .selectFrom("currencies")
      .select(["code", "name", "minor_units"])
      .where("status", "=", "ACTIVE")
      .orderBy("code")
      .execute();
    return rows.map((row) => new Currency(row.code, row.name, row.minor_units));
  }
}
