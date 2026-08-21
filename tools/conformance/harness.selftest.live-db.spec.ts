import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConformanceTestDbConfig } from "../../platform/config.js";
import { migrate } from "../../platform/db/migrate.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { readSqlDir } from "./lib/read-sql-dir.js";
import { checkSchemaLive } from "./rules/schema-live.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixtureMigrations = (name: string) => join(HERE, "fixtures", name, "migrations");

// A dedicated schema, reset between fixtures, so this never touches whatever
// else lives on the target Postgres server (see docker-compose.yml / .env.example).
const SCHEMA = "conformance_live_selftest";

let client: Client;

beforeAll(async () => {
  const config = loadConformanceTestDbConfig();
  client = new Client({ connectionString: config.connectionString });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Could not reach Postgres at ${config.connectionString}. ` +
        `Run "docker compose up -d" (or point CONFORMANCE_TEST_DATABASE_URL at a running Postgres) ` +
        `before running the live-DB schema tests. Original error: ${describeDbError(err)}`,
    );
  }
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await client.end();
});

async function applyFixture(name: string) {
  await client.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  const files = readSqlDir(fixtureMigrations(name));
  await migrate(client, SCHEMA, files);
}

/**
 * Proves the schema rules (ADR-030 SCHEMA RULES) against a real, migrated
 * PostgreSQL database via introspection (information_schema/pg_catalog), not
 * static SQL-text parsing — see ./rules/schema-live.ts and DECISION_LOG.md.
 */
describe("schema rules against a real, migrated PostgreSQL database", () => {
  it("flags a tenant-owned table with no tenant_id", async () => {
    await applyFixture("schema-missing-tenant-id");
    const violations = await checkSchemaLive(client, SCHEMA);
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-MISSING-TENANT-ID");
  });

  it("flags a tenant-owned table with no RLS policy", async () => {
    await applyFixture("schema-missing-rls");
    const violations = await checkSchemaLive(client, SCHEMA);
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-MISSING-RLS");
  });

  it("flags a FLOAT column on a monetary field", async () => {
    await applyFixture("schema-float-money");
    const violations = await checkSchemaLive(client, SCHEMA);
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-FLOAT-MONEY-COLUMN");
  });

  it("flags a second, module-local idempotency table", async () => {
    await applyFixture("schema-duplicate-idempotency-table");
    const violations = await checkSchemaLive(client, SCHEMA);
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE");
  });

  it("produces zero violations for a correctly structured, really-migrated schema", async () => {
    await applyFixture("clean");
    const violations = await checkSchemaLive(client, SCHEMA);
    expect(violations).toEqual([]);
  });
});
