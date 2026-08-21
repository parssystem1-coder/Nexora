// VIOLATION FIXTURE (DB-ACCESS-RAW-PG-IMPORT): module code must never import
// 'pg' directly; it must go through platform/db/kysely.ts's createDb().
import { Pool } from "pg";

export class DirectPoolRepository {
  constructor(private readonly pool: Pool) {}
}
