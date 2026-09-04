import type { Client } from "pg";
import { qualifiedIdent } from "../../../platform/db/ident.js";
import type { Violation } from "../lib/types.js";

// Must stay in step with ./schema.ts — see the note there for why each table is
// exempt. `schema_migrations` is additionally excluded here as the migration
// runner's own bookkeeping table (platform/db/migrate.ts), not a §4 product
// table, so it is tooling rather than a tenancy exemption.
const TENANT_EXEMPT = new Set([
  "users",
  "currencies",
  "reserved_subdomains",
  "sessions",
  "roles",
  "permissions",
  "role_permissions",
  "credentials",
  "schema_migrations",
  // Phase 2 item 1's three tables. PHASE_2_BRIEF.md §5 states the reason:
  // "platform-authored reference data, identical for every tenant. 05 §4.2
  // scopes plan.list global, not tenant; a tenant-scoped plan catalogue would
  // make plan.list unanswerable before a tenant context exists, the same
  // bootstrap problem R-003 documents for memberships." Listing them here is
  // the checker being told the truth about their design — not an
  // exceptions.json entry, which would be the checker being silenced.
  "plans",
  "plan_versions",
  "plan_features",
]);

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

      const rlsResult = await client.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
        `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`,
        [qualifiedIdent(schema, table)],
      );
      const policyResult = await client.query(`SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2`, [
        schema,
        table,
      ]);
      const relrowsecurity = rlsResult.rows[0]?.relrowsecurity === true;
      const hasPolicy = (policyResult.rowCount ?? 0) > 0;

      if (!relrowsecurity || !hasPolicy) {
        violations.push({
          rule: "SCHEMA-MISSING-RLS",
          file: `db:${schema}.${table}`,
          message: `table '${table}' has no ENABLE ROW LEVEL SECURITY + CREATE POLICY pair`,
          fix: "Add ALTER TABLE ... ENABLE ROW LEVEL SECURITY and a CREATE POLICY in the same migration that creates the table.",
        });
      } else if (rlsResult.rows[0]?.relforcerowsecurity !== true) {
        // Without FORCE, the table's owning role bypasses RLS entirely — verified
        // empirically (see DECISION_LOG.md "RLS: FORCE ROW LEVEL SECURITY or a
        // non-owner app role"). Only checked once ENABLE+POLICY already exist.
        violations.push({
          rule: "SCHEMA-MISSING-FORCE-RLS",
          file: `db:${schema}.${table}`,
          message: `table '${table}' has RLS enabled and a policy, but no FORCE ROW LEVEL SECURITY`,
          fix: "Add ALTER TABLE ... FORCE ROW LEVEL SECURITY in the same migration — without it, the table's owning role bypasses RLS entirely.",
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
