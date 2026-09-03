import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { checkPartitionIsolation, appRoleFrom } from "./check-partition-isolation.js";
import { loadMigrateDbConfig, loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * ADR-030's standard, applied to a check that deliberately lives outside the
 * harness: *"each listed check has a deliberately failing fixture proving the
 * check works."* A check that has never been seen to fail is not evidence of
 * anything — and this one matches nothing in the repository today, so without a
 * fixture it would be indistinguishable from a check that is simply broken.
 *
 * The fixture reproduces Session 9's probe exactly: a partitioned parent
 * carrying the identical three lines the `audit_events` migration uses
 * (`ENABLE`, `FORCE`, one `USING` policy) on the **parent only**, plus one
 * partition. It then proves the check goes red, applies ADR-041's Shape B + A
 * remedy, and proves it goes green — in that order, because the red result is
 * the evidence.
 */
const SCHEMA = "adr041_fixture";
const APP_ROLE = appRoleFrom(loadDbConfig().connectionString);

let client: Client;
let reachable = false;

beforeAll(async () => {
  client = new Client({ connectionString: loadMigrateDbConfig().connectionString });
  try {
    await client.connect();
    reachable = true;
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the partition-isolation fixture. Original error: ${describeDbError(err)}`,
      { cause: err },
    );
  }

  await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await client.query(`CREATE SCHEMA ${SCHEMA}`);
  // Reproduce 001_roles.sql's grant mechanism inside the throwaway schema, so
  // the fixture models production rather than a weakness invented for the test.
  await client.query(
    `ALTER DEFAULT PRIVILEGES FOR ROLE ${APP_ROLE === "nexora_app" ? "nexora_migrate" : APP_ROLE} IN SCHEMA ${SCHEMA}
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
  );
  // The audit_events shape, with PARTITION BY added and the policy on the PARENT only.
  await client.query(
    `CREATE TABLE ${SCHEMA}.probe (
       id uuid NOT NULL DEFAULT gen_random_uuid(),
       tenant_id uuid NOT NULL,
       occurred_at timestamptz NOT NULL,
       PRIMARY KEY (id, occurred_at)
     ) PARTITION BY RANGE (occurred_at)`,
  );
  await client.query(`ALTER TABLE ${SCHEMA}.probe ENABLE ROW LEVEL SECURITY`);
  await client.query(`ALTER TABLE ${SCHEMA}.probe FORCE ROW LEVEL SECURITY`);
  await client.query(
    `CREATE POLICY probe_tenant_isolation ON ${SCHEMA}.probe
       USING (tenant_id::text = current_setting('app.tenant_id', true))`,
  );
  await client.query(
    `CREATE TABLE ${SCHEMA}.probe_2026_09 PARTITION OF ${SCHEMA}.probe
       FOR VALUES FROM ('2026-09-01+00') TO ('2026-10-01+00')`,
  );
}, 60_000);

afterAll(async () => {
  if (reachable) {
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrate IN SCHEMA ${SCHEMA}
         REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${APP_ROLE}`,
    );
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.schemata WHERE schema_name = $1`,
      [SCHEMA],
    );
    // The fixture must not survive itself — a leftover partitioned table would
    // turn every later run of this check permanently red.
    expect(rows[0]?.n).toBe("0");
    await client.end();
  }
});

describe("partition isolation check (ADR-041 ruling, R-042)", () => {
  const violationsFor = async (relation: string) =>
    (await checkPartitionIsolation(client, APP_ROLE)).filter((v) => v.relation === relation);

  it("FAILS on a partition whose parent alone carries RLS, a policy and no revoke — the exact shape Session 9 proved is exploitable", async () => {
    const found = await violationsFor(`${SCHEMA}.probe_2026_09`);
    const rules = found.map((v) => v.rule).sort();

    expect(rules).toEqual(["PARTITION-APP-PRIVILEGE", "PARTITION-MISSING-POLICY", "PARTITION-MISSING-RLS"]);

    // The messages must explain the trap, not merely name a flag — a future
    // reader hitting this in CI needs to know why the parent's policy is not enough.
    expect(found.find((v) => v.rule === "PARTITION-MISSING-RLS")?.message).toContain("do not inherit");
    expect(found.find((v) => v.rule === "PARTITION-APP-PRIVILEGE")?.message).toContain("bypass the parent's policy");
  });

  it("does not flag the partitioned PARENT — it is not a partition, and its own protection is correct", async () => {
    expect(await violationsFor(`${SCHEMA}.probe`)).toEqual([]);
  });

  it("PASSES once ADR-041's Shape B + A remedy is applied, and each half is necessary on its own", async () => {
    // Shape B alone: the partition gets its own RLS, FORCE and policy.
    await client.query(`ALTER TABLE ${SCHEMA}.probe_2026_09 ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE ${SCHEMA}.probe_2026_09 FORCE ROW LEVEL SECURITY`);
    await client.query(
      `CREATE POLICY probe_part_tenant_isolation ON ${SCHEMA}.probe_2026_09
         USING (tenant_id::text = current_setting('app.tenant_id', true))`,
    );

    // Shape B closes two of the three. The direct-privilege hole is still open,
    // which is exactly why the ruling adopts A alongside B rather than instead of it.
    expect((await violationsFor(`${SCHEMA}.probe_2026_09`)).map((v) => v.rule)).toEqual(["PARTITION-APP-PRIVILEGE"]);

    // Shape A: revoke the direct grant.
    await client.query(`REVOKE ALL ON ${SCHEMA}.probe_2026_09 FROM ${APP_ROLE}`);

    expect(await violationsFor(`${SCHEMA}.probe_2026_09`)).toEqual([]);
  });

  it("the real database has no partitions today, so the check is green and free", async () => {
    const all = await checkPartitionIsolation(client, APP_ROLE);
    expect(all.filter((v) => !v.relation.startsWith(`${SCHEMA}.`))).toEqual([]);
  });
});
