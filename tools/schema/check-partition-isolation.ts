import { Client } from "pg";
import { loadMigrateDbConfig, loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * Fails if any table partition exists without the tenant-isolation precondition
 * ADR-041's ruling records.
 *
 * ## Why this exists
 *
 * Session 9 (2026-09-03) proved, against PostgreSQL 17.5 with this project's
 * real role split, that a partitioned table protected the way `audit_events` is
 * protected — `ENABLE`/`FORCE`/`CREATE POLICY` on the **parent** — does not
 * protect its partitions. Running as `nexora_app` with a deliberately WRONG
 * tenant context and addressing a partition directly rather than the parent,
 * `SELECT` returned rows, and `INSERT`, `UPDATE` and `DELETE` all succeeded
 * against another tenant's data. The transcripts are in ADR-041.
 *
 * Two facts make it silent rather than obvious:
 *
 *   - `relrowsecurity` / `relforcerowsecurity` are **per relation and are not
 *     inherited**. The parent reads `t`/`t`; each partition's own `pg_class`
 *     row reads `f`/`f`, and `pg_policies` holds no row for it. A partition is
 *     an ordinary table with RLS switched off.
 *   - `platform/db/init/001_roles.sql` grants through `ALTER DEFAULT PRIVILEGES
 *     ... IN SCHEMA public`, so every table `nexora_migrate` creates in `public`
 *     — a partition included — hands the app role full DML automatically, with
 *     no `GRANT` in any migration. Confirmed again on the live database
 *     2026-09-03: a table created in `public` with no explicit grant anywhere
 *     shows `DELETE, INSERT, SELECT, UPDATE` for `nexora_app`.
 *
 * So a partitioning migration that looks exactly like the correct
 * `audit_events` migration it was copied from opens a cross-tenant hole, and
 * nothing in review or in the existing harness would say so.
 *
 * ## What it checks, for every relation with `relispartition = true`
 *
 *   PARTITION-MISSING-RLS       own `relrowsecurity` AND `relforcerowsecurity`
 *   PARTITION-MISSING-POLICY    a `pg_policies` row of its own
 *   PARTITION-APP-PRIVILEGE     the app role holds NO direct SELECT/INSERT/
 *                               UPDATE/DELETE on it
 *
 * The third is the one that closes the hole; the first two are ADR-041's
 * preferred Shape B, which makes a forgotten partition fail loudly instead of
 * silently. Together they are Shape B plus Shape A, which the ruling adopts as
 * primary-plus-depth.
 *
 * **Today this matches nothing** — no table in this repository is partitioned —
 * so it is free. It exists so that the day someone writes a partitioning
 * migration, it fires before the merge rather than after the incident.
 *
 * ## Why it is NOT a conformance rule
 *
 * Deliberate, and recorded so nobody "tidies" it into the harness.
 * `tools/conformance/lib/exceptions.ts` applies `exceptions.json` generically to
 * every violation, matching on `rule` + `file` alone:
 *
 *     const match = exceptions.find((e) => e.rule === violation.rule && e.file === violation.file);
 *     if (match && ADR_REF_RE.test(match.adr ?? "")) { suppressed.push(...) }
 *
 * There is no per-rule opt-out anywhere in `tools/`. So as a conformance rule
 * this could be silenced by a single `exceptions.json` entry — and here that
 * entry would suppress a real cross-tenant hole rather than a cosmetic
 * violation. `CLAUDE.md`'s standing rule already forbids reaching green that
 * way; this puts the rule where that route does not exist, following the
 * `check:register` / `check:dist-deps` precedent for checks that must not be
 * exceptable.
 */

export interface PartitionViolation {
  rule: "PARTITION-MISSING-RLS" | "PARTITION-MISSING-POLICY" | "PARTITION-APP-PRIVILEGE";
  relation: string;
  message: string;
  fix: string;
}

interface PartitionRow {
  schema_name: string;
  relname: string;
  parent: string | null;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  policy_count: string;
  app_select: boolean;
  app_insert: boolean;
  app_update: boolean;
  app_delete: boolean;
}

/** The app role is read from the app connection string rather than hard-coded, so a renamed role cannot silently un-check this. */
export function appRoleFrom(connectionString: string): string {
  const user = new URL(connectionString).username;
  if (!user) throw new Error(`Could not read a role name from the app connection string: ${connectionString}`);
  return decodeURIComponent(user);
}

export async function checkPartitionIsolation(client: Client, appRole: string): Promise<PartitionViolation[]> {
  const { rows } = await client.query<PartitionRow>(
    `SELECT n.nspname                                        AS schema_name,
            c.relname                                        AS relname,
            (SELECT pn.nspname || '.' || p.relname
               FROM pg_inherits i
               JOIN pg_class p ON p.oid = i.inhparent
               JOIN pg_namespace pn ON pn.oid = p.relnamespace
              WHERE i.inhrelid = c.oid)                      AS parent,
            c.relrowsecurity                                 AS relrowsecurity,
            c.relforcerowsecurity                            AS relforcerowsecurity,
            (SELECT count(*) FROM pg_policies pol
              WHERE pol.schemaname = n.nspname AND pol.tablename = c.relname)::text AS policy_count,
            has_table_privilege($1, c.oid, 'SELECT')         AS app_select,
            has_table_privilege($1, c.oid, 'INSERT')         AS app_insert,
            has_table_privilege($1, c.oid, 'UPDATE')         AS app_update,
            has_table_privilege($1, c.oid, 'DELETE')         AS app_delete
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relispartition = true AND c.relkind IN ('r', 'p')
      ORDER BY n.nspname, c.relname`,
    [appRole],
  );

  const violations: PartitionViolation[] = [];

  for (const row of rows) {
    const relation = `${row.schema_name}.${row.relname}`;
    const under = row.parent ? ` (partition of ${row.parent})` : "";

    if (!row.relrowsecurity || !row.relforcerowsecurity) {
      violations.push({
        rule: "PARTITION-MISSING-RLS",
        relation,
        message: `partition '${relation}'${under} has relrowsecurity=${row.relrowsecurity} relforcerowsecurity=${row.relforcerowsecurity} on its OWN pg_class row. These do not inherit from the parent — a policy on the parent does not protect this partition (ADR-041, R-042).`,
        fix: `ALTER TABLE ${relation} ENABLE ROW LEVEL SECURITY; ALTER TABLE ${relation} FORCE ROW LEVEL SECURITY; in the same migration that creates the partition.`,
      });
    }

    if (Number(row.policy_count) === 0) {
      violations.push({
        rule: "PARTITION-MISSING-POLICY",
        relation,
        message: `partition '${relation}'${under} has no row in pg_policies of its own. The parent's policy is not enforced for access addressed directly at a partition — proven, not inferred (ADR-041's 2026-09-03 transcripts).`,
        fix: `CREATE POLICY <name> ON ${relation} USING (tenant_id::text = current_setting('app.tenant_id', true)); in the same migration.`,
      });
    }

    const held = (["select", "insert", "update", "delete"] as const).filter(
      (p) => row[`app_${p}` as keyof PartitionRow] === true,
    );
    if (held.length > 0) {
      violations.push({
        rule: "PARTITION-APP-PRIVILEGE",
        relation,
        message: `role '${appRole}' holds ${held.join(", ").toUpperCase()} directly on partition '${relation}'${under}, so it can address the partition instead of the parent and bypass the parent's policy entirely. 001_roles.sql's ALTER DEFAULT PRIVILEGES grants this automatically in schema public — no migration has to ask for it.`,
        fix: `REVOKE ALL ON ${relation} FROM ${appRole}; in the same migration. Access routed through the parent is unaffected by this — verified 2026-09-03.`,
      });
    }
  }

  return violations;
}

async function main(): Promise<void> {
  const config = loadMigrateDbConfig();
  const appRole = appRoleFrom(loadDbConfig().connectionString);
  const client = new Client({ connectionString: config.connectionString });

  try {
    await client.connect();
  } catch (err) {
    // Same posture as the harness's live-DB check: a developer without Postgres
    // running is not blocked. CI always has a database, so CI always enforces
    // this. Loud rather than silent, because a skipped security check that
    // looked like a pass would be the exact failure this file exists to prevent.
    console.log(`Partition isolation: SKIPPED — could not reach the database (${describeDbError(err)}).`);
    console.log("  This check is enforced in CI, where a database is always present.");
    return;
  }

  try {
    const violations = await checkPartitionIsolation(client, appRole);
    if (violations.length === 0) {
      console.log(`Partition isolation: PASS (no partition is reachable by '${appRole}' or missing its own RLS)`);
      return;
    }
    console.error(`\nPartition isolation: FAIL (${violations.length} violation(s))\n`);
    for (const v of violations) {
      console.error(`[${v.rule}] ${v.relation}`);
      console.error(`  ${v.message}`);
      console.error(`  fix: ${v.fix}\n`);
    }
    console.error("No exceptions.json entry can silence this check — see this file's doc comment for why.\n");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("check-partition-isolation.ts")) await main();
