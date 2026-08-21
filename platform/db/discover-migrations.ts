import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MigrationFile } from "./migrate.js";

/**
 * Discovers migrations across modules/<module>/migrations/*.sql
 * (03_TECHNICAL_BLUEPRINT.md §2.1 — migrations live inside each owning module,
 * not in a root-level migrations/ folder; see DECISION_LOG.md).
 *
 * Filenames are `<timestamp>__<description>.sql`. Sorting by filename alone is
 * not safe across modules sharing a timestamp prefix, so the sort key folds in
 * the module name, and the module name is folded into the tracking id to
 * guarantee global uniqueness in schema_migrations.
 */
export function discoverModuleMigrations(modulesRoot: string): MigrationFile[] {
  if (!existsSync(modulesRoot)) return [];

  const entries: Array<{ sortKey: string; id: string; path: string }> = [];
  for (const moduleName of readdirSync(modulesRoot)) {
    const migrationsDir = join(modulesRoot, moduleName, "migrations");
    if (!existsSync(migrationsDir)) continue;
    for (const file of readdirSync(migrationsDir)) {
      if (!file.endsWith(".sql")) continue;
      entries.push({
        sortKey: `${file}__${moduleName}`,
        id: `${moduleName}/${file}`,
        path: join(migrationsDir, file),
      });
    }
  }

  return entries
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((e) => ({ id: e.id, sql: readFileSync(e.path, "utf8") }));
}
