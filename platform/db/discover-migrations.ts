import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MigrationFile } from "./migrate.js";

/**
 * Discovers migrations across modules/<module>/migrations/*.sql
 * (03_TECHNICAL_BLUEPRINT.md §2.1 — migrations live inside each owning module,
 * not in a root-level migrations/ folder; see DECISION_LOG.md).
 *
 * Filenames are `<timestamp>_<module>__<description>.sql`. The leading
 * timestamp orders migrations globally across modules, and the embedded module
 * name makes each filename self-identifying and collision-proof — so the
 * filename alone is both the sort key and the `schema_migrations` tracking id,
 * with no separate composition step. Two migrations authored in the same second
 * in different modules still sort deterministically, because the module name
 * follows the timestamp in the same string.
 */
const FILENAME_PATTERN = /^\d{14}_[a-z0-9-]+__[a-z0-9_-]+\.sql$/;

export function discoverModuleMigrations(modulesRoot: string): MigrationFile[] {
  if (!existsSync(modulesRoot)) return [];

  const entries: Array<{ id: string; path: string }> = [];
  for (const moduleName of readdirSync(modulesRoot)) {
    const migrationsDir = join(modulesRoot, moduleName, "migrations");
    if (!existsSync(migrationsDir)) continue;
    for (const file of readdirSync(migrationsDir)) {
      if (!file.endsWith(".sql")) continue;
      if (!FILENAME_PATTERN.test(file)) {
        throw new Error(
          `Migration '${moduleName}/${file}' does not match the required ` +
            `<timestamp>_<module>__<description>.sql convention ` +
            `(03_TECHNICAL_BLUEPRINT.md §2.1), e.g. 20260822090000_${moduleName}__create_widgets.sql. ` +
            `The filename is the schema_migrations tracking key, so renaming it after it has been ` +
            `applied anywhere re-runs the migration — fix the name before applying it.`,
        );
      }
      entries.push({ id: file, path: join(migrationsDir, file) });
    }
  }

  return entries
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, sql: readFileSync(e.path, "utf8") }));
}
