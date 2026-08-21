import type { Client } from "pg";
import { qualifiedIdent } from "../../../platform/db/ident.js";
import type { Violation } from "../lib/types.js";

// Tables that are legitimately not tenant-owned (Phase 1 scope, 08_PHASE_1_BRIEF.md section 4).
const TENANT_EXEMPT = new Set(["users", "currencies", "reserved_subdomains", "schema_migrations"]);

const MONEY_NAME_RE = /amount|price|cost|total|balance|fee|money|charge/i;
const FLOATING_TYPES = new Set(["real", "double precision"]);

interface ColumnRow {
  column_name: string;
  data_type: string;
}

/**
 * Same rules as ./schema.ts (static SQL parsing) but proven against a real,
 * migrated PostgreSQL database via information_schema/pg_catalog introspection,
 * per ADR-030 §3 ("a schema conformance test executed against a real migrated
 * database"). `client` must already have `schema` on its search_path (the
 * migration runner sets this) or be pointed at it explicitly.
 */
export async function checkSchemaLive(client: Client, schema = "public"): Promise<Violation[]> {
  const violations: Violation[] = [];

  const tablesResult = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [schema],
  );
  const tables = tablesResult.rows.map((r) => r.table_name);

  const idempotencyTables = tables.filter((t) => /idempotency/i.test(t));
  if (idempotencyTables.length > 1) {
    for (const table of idempotencyTables) {
      violations.push({
        rule: "SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE",
        file: `db:${schema}.${table}`,
        message: `table '${table}' is one of ${idempotencyTables.length} idempotency-like tables (${idempotencyTables.join(", ")})`,
        fix: "There is exactly one idempotency table for the whole platform. Remove the module-local duplicate.",
      });
    }
  }

  for (const table of tables) {
    const columnsResult = await client.query<ColumnRow>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, table],
    );
    const columns = columnsResult.rows;

    if (!TENANT_EXEMPT.has(table)) {
      if (!columns.some((c) => c.column_name === "tenant_id")) {
        violations.push({
          rule: "SCHEMA-MISSING-TENANT-ID",
          file: `db:${schema}.${table}`,
          message: `table '${table}' has no tenant_id column`,
          fix: "Add tenant_id uuid not null referencing organizations(id) in the same migration.",
        });
      }

      const rlsResult = await client.query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass`,
        [qualifiedIdent(schema, table)],
      );
      const policyResult = await client.query(
        `SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2`,
        [schema, table],
      );
      const hasRls = rlsResult.rows[0]?.relrowsecurity === true && (policyResult.rowCount ?? 0) > 0;
      if (!hasRls) {
        violations.push({
          rule: "SCHEMA-MISSING-RLS",
          file: `db:${schema}.${table}`,
          message: `table '${table}' has no ENABLE ROW LEVEL SECURITY + CREATE POLICY pair`,
          fix: "Add ALTER TABLE ... ENABLE ROW LEVEL SECURITY and a CREATE POLICY in the same migration that creates the table.",
        });
      }
    }

    for (const col of columns) {
      if (FLOATING_TYPES.has(col.data_type) && MONEY_NAME_RE.test(col.column_name)) {
        violations.push({
          rule: "SCHEMA-FLOAT-MONEY-COLUMN",
          file: `db:${schema}.${table}.${col.column_name}`,
          message: `table '${table}' column '${col.column_name}' is ${col.data_type}`,
          fix: "Monetary columns must be BIGINT (minor units) or NUMERIC, never FLOAT/DOUBLE/REAL. See ADR-022.",
        });
      }
    }
  }

  return violations;
}
