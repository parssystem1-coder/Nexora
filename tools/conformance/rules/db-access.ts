import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

// Migrations legitimately need raw `pg` (they run "reviewed plain SQL," not
// query-builder-constructed queries, ADR-021 item 8). pool.ts is the one
// place a raw Pool is constructed, wrapped by Kysely's PostgresDialect.
const ALLOWED_PG_IMPORT_FILES = new Set([
  "platform/db/pool.ts",
  "platform/db/migrate.ts",
  "platform/db/migrate-cli.ts",
]);

// The one transaction/RLS helper — see DECISION_LOG.md "Query builder: Kysely".
const ALLOWED_TRANSACTION_FILES = new Set(["platform/db/tenant-context.ts"]);

const PG_IMPORT_RE = /from\s+["']pg["']|require\(\s*["']pg["']\s*\)/;
const TRANSACTION_CALL_RE = /\.transaction\s*\(/;

const SCOPED_PREFIXES = ["modules/", "platform/"];

/**
 * Enforces that nothing outside platform/db/ reaches the raw connection pool
 * or opens its own transaction, so every tenant-scoped query is forced
 * through the one helper that sets `app.tenant_id` (ADR-021, ADR-030
 * singleton rule). See DECISION_LOG.md "Conformance rule: no direct
 * pool/transaction access bypassing the tenant-context helper".
 */
export function checkDbAccess(root: string): Violation[] {
  const violations: Violation[] = [];
  const files = listFiles(root, [".ts", ".tsx"]).filter((f) => SCOPED_PREFIXES.some((p) => f.startsWith(p)));

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    if (PG_IMPORT_RE.test(source) && !ALLOWED_PG_IMPORT_FILES.has(file)) {
      violations.push({
        rule: "DB-ACCESS-RAW-PG-IMPORT",
        file,
        message: "imports 'pg' directly instead of going through platform/db/kysely.ts",
        fix: "Only platform/db/pool.ts, migrate.ts and migrate-cli.ts may import 'pg'. Get a Kysely instance from createDb() instead.",
      });
    }

    if (TRANSACTION_CALL_RE.test(source) && !ALLOWED_TRANSACTION_FILES.has(file)) {
      violations.push({
        rule: "DB-ACCESS-TRANSACTION-BYPASSES-HELPER",
        file,
        message: "opens a transaction directly instead of going through platform/db/tenant-context.ts",
        fix: "Call withTenantContext() from platform/db/tenant-context.ts instead of db.transaction() directly, so RLS session context is always set.",
      });
    }
  }

  return violations;
}
