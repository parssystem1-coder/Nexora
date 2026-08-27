import type { Client } from "pg";
import { quoteIdent } from "./ident.js";

export interface MigrationFile {
  /** Tracking key in schema_migrations. Must be unique across all modules. */
  id: string;
  sql: string;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Forward-only migration runner (ADR-021 item 8: "reviewed plain SQL, forward-only").
 * Applies `files` — already sorted by the caller — inside `schema`, tracking what has
 * already run in `<schema>.schema_migrations` so re-running is a no-op.
 */
export async function migrate(client: Client, schema: string, files: MigrationFile[]): Promise<MigrationResult> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
  await client.query(`SET search_path TO ${quoteIdent(schema)}, public`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
  const already = new Set(rows.map((r) => r.id));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (already.has(file.id)) {
      skipped.push(file.id);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(file.sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file.id]);
      await client.query("COMMIT");
      applied.push(file.id);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration '${file.id}' failed: ${(err as Error).message}`, { cause: err });
    }
  }

  return { applied, skipped };
}
