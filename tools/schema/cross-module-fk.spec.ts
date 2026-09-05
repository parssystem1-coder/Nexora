import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { join } from "node:path";
import { buildModuleMap, checkCrossModuleForeignKeys } from "./check-cross-module-fk.js";
import { loadMigrateDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * ADR-030's standard, applied to the second check that deliberately lives
 * outside the harness: *"each listed check has a deliberately failing fixture
 * proving the check works."*
 *
 * It matters more here than usual. This check matches **nothing** in the
 * repository — verified 2026-09-05, all thirteen foreign keys are within one
 * module — so a broken check and a passing repository produce the identical
 * output. Only a fixture that has been seen to go red distinguishes them.
 *
 * The fixture builds a real crossing in a throwaway schema: `sessions`, which
 * the module map attributes to `identity`, referencing `plan_versions`, which
 * it attributes to `billing`. It proves red, drops the constraint, proves
 * green, and then proves the schema is gone.
 */
const SCHEMA = "xmodfk_fixture";

let client: Client;

beforeAll(async () => {
  client = new Client({ connectionString: loadMigrateDbConfig().connectionString });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`Could not reach Postgres for the cross-module FK fixture. ${describeDbError(err)}`, {
      cause: err,
    });
  }

  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.query(`CREATE SCHEMA ${SCHEMA}`);
  // Shells named after two real tables the module map attributes to different
  // modules. The columns are irrelevant to the check, which reads pg_constraint.
  await client.query(`CREATE TABLE ${SCHEMA}.plan_versions (id uuid PRIMARY KEY)`);
  await client.query(`CREATE TABLE ${SCHEMA}.sessions (id uuid PRIMARY KEY, plan_version_id uuid NOT NULL)`);
});

afterAll(async () => {
  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.end();
});

describe("cross-module foreign key check (ADR-030 fixture)", () => {
  const moduleMap = buildModuleMap(join(process.cwd(), "modules"));

  it("attributes each table to the module whose migration creates it", () => {
    expect(moduleMap.get("sessions")).toBe("identity");
    expect(moduleMap.get("plan_versions")).toBe("billing");
    expect(moduleMap.get("idempotency_records")).toBe("idempotency");
    // A table no module migration creates is deliberately not attributed.
    expect(moduleMap.get("schema_migrations")).toBeUndefined();
  });

  it("passes before the crossing exists", async () => {
    const violations = await checkCrossModuleForeignKeys(client, moduleMap, SCHEMA);

    expect(violations).toEqual([]);
  });

  it("FAILS on a foreign key that crosses a module boundary", async () => {
    await client.query(
      `ALTER TABLE ${SCHEMA}.sessions
         ADD CONSTRAINT sessions_plan_version_id_fkey
         FOREIGN KEY (plan_version_id) REFERENCES ${SCHEMA}.plan_versions (id)`,
    );

    const violations = await checkCrossModuleForeignKeys(client, moduleMap, SCHEMA);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      constraint: "sessions_plan_version_id_fkey",
      childTable: "sessions",
      childModule: "identity",
      parentTable: "plan_versions",
      parentModule: "billing",
    });
  });

  it("passes again once the constraint is dropped, the column surviving", async () => {
    await client.query(`ALTER TABLE ${SCHEMA}.sessions DROP CONSTRAINT sessions_plan_version_id_fkey`);

    const violations = await checkCrossModuleForeignKeys(client, moduleMap, SCHEMA);

    expect(violations).toEqual([]);
    // The remedy is "drop the constraint, keep the column" — proven, not just
    // recommended in the failure message.
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'sessions'`,
      [SCHEMA],
    );
    expect(rows.map((r) => r.column_name)).toContain("plan_version_id");
  });

  it("does not flag a foreign key within one module", async () => {
    await client.query(`CREATE TABLE ${SCHEMA}.plans (id uuid PRIMARY KEY)`);
    await client.query(
      `ALTER TABLE ${SCHEMA}.plan_versions
         ADD COLUMN plan_id uuid,
         ADD CONSTRAINT plan_versions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES ${SCHEMA}.plans (id)`,
    );

    const violations = await checkCrossModuleForeignKeys(client, moduleMap, SCHEMA);

    // Both tables are `billing`; the check must not fire on the ordinary case.
    expect(violations).toEqual([]);
  });

  it("finds no crossing in the real schema", async () => {
    const violations = await checkCrossModuleForeignKeys(client, moduleMap, "public");

    expect(violations).toEqual([]);
  });
});
