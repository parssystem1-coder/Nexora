import { Kysely, PostgresDialect } from "kysely";
import { createPool } from "./pool.js";
import type { DbConfig } from "../config.js";

/**
 * Placeholder DB schema type. Each module augments this via TypeScript
 * declaration merging as its own migrations land (Kysely's standard pattern
 * for composing a schema type across independently owned modules) — e.g.
 * `declare module "../../platform/db/kysely.js" { interface Database { stores: StoresTable } }`.
 * Empty for now because no module/migration exists yet (Phase 0). Deliberately
 * a plain empty interface (not an index signature) so a later module's
 * declaration merge (adding a real table key) type-checks cleanly against it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate declaration-merging target, see the doc comment above.
export interface Database {}

export function createDb(config: DbConfig): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: createPool(config) }),
  });
}
