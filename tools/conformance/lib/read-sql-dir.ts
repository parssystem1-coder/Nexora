import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MigrationFile } from "../../../platform/db/migrate.js";

/** Reads a flat directory of `*.sql` files as MigrationFiles, sorted by filename. */
export function readSqlDir(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ id: f, sql: readFileSync(join(dir, f), "utf8") }));
}
