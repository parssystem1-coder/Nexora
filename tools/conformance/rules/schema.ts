import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

// Exactly the three tables 08_PHASE_1_BRIEF.md §5 exempts, no more.
// Widening this list is a documentation change, not an implementer's call:
// two proposals to widen it (the identity cluster; the role/permission
// catalog) are OPEN in DECISION_LOG.md awaiting a decision, and are
// deliberately NOT applied here — so the harness reports the current schema's
// deviation instead of silently sanctioning it.
const TENANT_EXEMPT = new Set(["users", "currencies", "reserved_subdomains"]);

const CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][\w]*)"?\s*\(([\s\S]*?)\n\)\s*;/gi;
const COLUMN_LINE_RE = /^\s*"?([a-zA-Z_][\w]*)"?\s+([A-Z][A-Z0-9 ]*?)(?:\s|,|$)/i;
const RLS_ENABLE_RE = /ALTER\s+TABLE\s+"?([a-zA-Z_][\w]*)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
const RLS_FORCE_RE = /ALTER\s+TABLE\s+"?([a-zA-Z_][\w]*)"?\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi;
const RLS_POLICY_RE = /CREATE\s+POLICY\s+\S+\s+ON\s+"?([a-zA-Z_][\w]*)"?/gi;

const MONEY_NAME_RE = /amount|price|cost|total|balance|fee|money|charge/i;
const FLOATING_TYPE_RE = /^(FLOAT|DOUBLE PRECISION|DOUBLE|REAL)\b/i;

interface TableDef {
  name: string;
  file: string;
  columns: Array<{ name: string; type: string }>;
}

function parseMigrations(root: string): {
  tables: TableDef[];
  rlsEnabled: Set<string>;
  rlsForced: Set<string>;
  rlsPolicies: Set<string>;
} {
  const files = listFiles(root, [".sql"]).filter((f) => f.includes("migrations/"));
  const tables: TableDef[] = [];
  const rlsEnabled = new Set<string>();
  const rlsForced = new Set<string>();
  const rlsPolicies = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    for (const match of source.matchAll(CREATE_TABLE_RE)) {
      const [, name, body] = match;
      if (!name || body === undefined) continue;
      const columns = body
        .split(",\n")
        .flatMap((l) => l.split("\n"))
        .map((line) => COLUMN_LINE_RE.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ name: m[1]!, type: m[2]!.trim() }));
      tables.push({ name, file, columns });
    }

    for (const match of source.matchAll(RLS_ENABLE_RE)) {
      if (match[1]) rlsEnabled.add(match[1]);
    }
    for (const match of source.matchAll(RLS_FORCE_RE)) {
      if (match[1]) rlsForced.add(match[1]);
    }
    for (const match of source.matchAll(RLS_POLICY_RE)) {
      if (match[1]) rlsPolicies.add(match[1]);
    }
  }

  return { tables, rlsEnabled, rlsForced, rlsPolicies };
}

export function checkSchema(root: string): Violation[] {
  const violations: Violation[] = [];
  const { tables, rlsEnabled, rlsForced, rlsPolicies } = parseMigrations(root);

  const idempotencyTables = tables.filter((t) => /idempotency/i.test(t.name));
  if (idempotencyTables.length > 1) {
    for (const t of idempotencyTables) {
      violations.push({
        rule: "SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE",
        file: t.file,
        message: `table '${t.name}' is one of ${idempotencyTables.length} idempotency-like tables (${idempotencyTables.map((x) => x.name).join(", ")})`,
        fix: "There is exactly one idempotency table for the whole platform. Remove the module-local duplicate.",
      });
    }
  }

  for (const table of tables) {
    const exempt = TENANT_EXEMPT.has(table.name);

    if (!exempt) {
      const hasTenantId = table.columns.some((c) => c.name === "tenant_id");
      if (!hasTenantId) {
        violations.push({
          rule: "SCHEMA-MISSING-TENANT-ID",
          file: table.file,
          message: `table '${table.name}' has no tenant_id column`,
          fix: "Add tenant_id uuid not null referencing organizations(id) in the same migration.",
        });
      }

      const hasRls = rlsEnabled.has(table.name) && rlsPolicies.has(table.name);
      if (!hasRls) {
        violations.push({
          rule: "SCHEMA-MISSING-RLS",
          file: table.file,
          message: `table '${table.name}' has no ENABLE ROW LEVEL SECURITY + CREATE POLICY pair`,
          fix: "Add ALTER TABLE ... ENABLE ROW LEVEL SECURITY and a CREATE POLICY in the same migration that creates the table.",
        });
      } else if (!rlsForced.has(table.name)) {
        // Without FORCE, the table's owning role bypasses RLS entirely — verified
        // empirically (see DECISION_LOG.md "RLS: FORCE ROW LEVEL SECURITY or a
        // non-owner app role"). Only checked once ENABLE+POLICY already exist, so
        // this doesn't pile onto SCHEMA-MISSING-RLS's message when RLS is absent outright.
        violations.push({
          rule: "SCHEMA-MISSING-FORCE-RLS",
          file: table.file,
          message: `table '${table.name}' has RLS enabled and a policy, but no FORCE ROW LEVEL SECURITY`,
          fix: "Add ALTER TABLE ... FORCE ROW LEVEL SECURITY in the same migration — without it, the table's owning role bypasses RLS entirely.",
        });
      }
    }

    for (const col of table.columns) {
      if (FLOATING_TYPE_RE.test(col.type) && MONEY_NAME_RE.test(col.name)) {
        violations.push({
          rule: "SCHEMA-FLOAT-MONEY-COLUMN",
          file: table.file,
          message: `table '${table.name}' column '${col.name}' is ${col.type.trim()}`,
          fix: "Monetary columns must be BIGINT (minor units) or NUMERIC, never FLOAT/DOUBLE/REAL. See ADR-022.",
        });
      }
    }
  }

  return violations;
}
