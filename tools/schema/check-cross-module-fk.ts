import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadMigrateDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";

/**
 * Fails if any foreign key crosses a module boundary.
 *
 * ## Why this exists
 *
 * `PHASE_2_BRIEF.md` §5 and `04_DATABASE_BLUEPRINT.md` §1 both state the rule —
 * "no cross-module foreign keys; cross-module reads go through contracts" — and
 * Phase 1 recorded it again in `DECISION_LOG.md` ("No cross-module foreign-key
 * constraints..."), which is why `store_memberships.user_id` and
 * `audit_events.tenant_id` are plain columns rather than references.
 *
 * **Until 2026-09-05 nothing enforced it.** Phase 2 item 2 reported that it had
 * omitted a foreign key from `price_versions.currency_code` to `currencies`
 * because §5 says so, and that no check would have caught the violation if it
 * had added one. This closes that gap.
 *
 * **It could not wait, because item 4 is the first slice that will want one.**
 * `subscriptions` belongs to a subscription module and holds pinned
 * `plan_version_id` and `price_version_id` values owned by `billing`. Adding
 * `REFERENCES plan_versions (id)` there is what a careful developer does by
 * habit — it is the correct instinct in a single-module schema and the wrong
 * one here — and it would arrive in the very next slice.
 *
 * ## Why the rule is not merely tidiness
 *
 * A foreign key is a hard runtime coupling between two modules' tables: it
 * constrains the order rows may be written and deleted in, it makes one
 * module's migration able to break another's writes, and it silently defeats
 * the contracts boundary `03_TECHNICAL_BLUEPRINT.md` §2 draws — a module that
 * cannot import another's internals can still be welded to its storage. It is
 * also what makes a table impossible to move, split or partition
 * independently later.
 *
 * ## Where the module map comes from
 *
 * Derived from the migration that creates each table: a `CREATE TABLE` inside
 * `modules/<module>/migrations/*.sql` makes `<module>` that table's owner. That
 * is the same primary source `tools/graph/extract.ts` uses, read directly
 * rather than through `project-graph.json` — the graph is a generated artifact,
 * and a check that trusted it would pass whenever the artifact was stale.
 *
 * A table with no owning migration (created outside `modules/`, e.g.
 * `schema_migrations`) is not attributed to any module and is skipped rather
 * than guessed at.
 *
 * ## Why it is NOT a conformance rule
 *
 * The same reason `check-partition-isolation.ts` is not, re-read against
 * `tools/conformance/lib/exceptions.ts` on 2026-09-05 rather than taken on
 * trust. `applyExceptions` suppresses generically, matching a violation on
 * `rule` + `file` alone:
 *
 *     const match = exceptions.find((e) => e.rule === violation.rule && e.file === violation.file);
 *     if (match && ADR_REF_RE.test(match.adr ?? "")) { suppressed.push(...) }
 *
 * There is no per-rule opt-out and no way to mark a rule un-suppressible, and
 * the only validation on the citation is the shape `ADR-\d{3}` — the ADR is
 * never checked for existence or relevance. So a single `exceptions.json` entry
 * citing any plausible-looking id would silence this permanently. It therefore
 * lives outside the harness alongside `check:register` and `check:partitions`,
 * following the convention Session 10 established for exactly this reason.
 */

export interface CrossModuleFkViolation {
  constraint: string;
  childTable: string;
  childModule: string;
  parentTable: string;
  parentModule: string;
}

const CREATE_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][\w]*)"?/gi;

/** table name -> owning module, from the migration that creates it. */
export function buildModuleMap(modulesRoot: string): Map<string, string> {
  const owner = new Map<string, string>();

  for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const migrations = join(modulesRoot, entry.name, "migrations");

    let files: string[];
    try {
      files = readdirSync(migrations).filter((f) => f.endsWith(".sql"));
    } catch {
      continue; // a module with no migrations owns no table
    }

    for (const file of files.sort()) {
      const sql = readFileSync(join(migrations, file), "utf8");
      for (const match of sql.matchAll(CREATE_TABLE_RE)) {
        owner.set(match[1]!.toLowerCase(), entry.name);
      }
    }
  }

  return owner;
}

export async function checkCrossModuleForeignKeys(
  client: Client,
  moduleMap: Map<string, string>,
  schema = "public",
): Promise<CrossModuleFkViolation[]> {
  const { rows } = await client.query<{ conname: string; child: string; parent: string }>(
    `SELECT con.conname, child.relname AS child, parent.relname AS parent
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace ns ON ns.oid = child.relnamespace
      WHERE con.contype = 'f' AND ns.nspname = $1
      ORDER BY child.relname, con.conname`,
    [schema],
  );

  const violations: CrossModuleFkViolation[] = [];

  for (const row of rows) {
    const childModule = moduleMap.get(row.child.toLowerCase());
    const parentModule = moduleMap.get(row.parent.toLowerCase());

    // A table this repository's migrations do not create is not attributed.
    if (childModule === undefined || parentModule === undefined) continue;
    if (childModule === parentModule) continue;

    violations.push({
      constraint: row.conname,
      childTable: row.child,
      childModule,
      parentTable: row.parent,
      parentModule,
    });
  }

  return violations;
}

async function main(): Promise<void> {
  const moduleMap = buildModuleMap(join(process.cwd(), "modules"));
  const client = new Client({ connectionString: loadMigrateDbConfig().connectionString });

  try {
    await client.connect();
  } catch (err) {
    // Same posture as the harness's live-DB check and check:partitions: a
    // developer with no database running is not blocked, and CI always has one,
    // so CI always enforces this. Loud rather than silent — a skipped check that
    // printed nothing would read as a pass.
    console.log(`Cross-module foreign keys: SKIPPED — could not reach the database (${describeDbError(err)}).`);
    console.log("  This check is enforced in CI, where a database is always present.");
    return;
  }

  try {
    const violations = await checkCrossModuleForeignKeys(client, moduleMap);

    if (violations.length === 0) {
      console.log(`Cross-module foreign keys: PASS (${moduleMap.size} tables attributed to a module, 0 crossings)`);
      return;
    }

    console.error(`\nCross-module foreign keys: FAIL (${violations.length} violation(s))\n`);
    for (const v of violations) {
      console.error(`[CROSS-MODULE-FOREIGN-KEY] ${v.constraint}`);
      console.error(
        `  '${v.childTable}' (module '${v.childModule}') references '${v.parentTable}' (module '${v.parentModule}').`,
      );
      console.error(
        `  fix: drop the constraint and keep the column. A cross-module reference is a plain column validated through the owning module's contracts — PHASE_2_BRIEF.md §5, 04 §1. See store_memberships.user_id and audit_events.tenant_id for the shape.\n`,
      );
    }
    console.error("No exceptions.json entry can silence this check — see this file's doc comment for why.\n");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("check-cross-module-fk.ts")) await main();
