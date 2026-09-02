import os from "node:os";
import { Pool } from "pg";
import { loadDbConfig } from "../../platform/config.js";

/**
 * Prints the environment facts that separate a CI run from a developer
 * machine, so the difference is a recorded number rather than an assumption.
 *
 * Why this exists. `RISK_REGISTER.md` R-008 spent four occurrences and 165
 * local reproduction attempts on a CI-only test failure, and the external
 * review's F-3 proposed connection-pool saturation under CI-specific
 * parallelism as a candidate mechanism. Nobody could evaluate F-3, because
 * the two numbers it turns on — how many test workers run at once, and how
 * many connections the server allows — were recorded nowhere for either
 * environment. `max_connections` appears nowhere else in this repository.
 *
 * The arithmetic F-3 needs is `workers x pools-per-worker x pool-max` against
 * `max_connections`. This step supplies the left side's first term and the
 * right side; the middle two come from the code (`platform/db/pool.ts` sets
 * no `max`, so `pg`'s default of 10 applies, and each `createTestApp()`
 * builds an `AppModule` carrying both `APP_DB` and `AUDIT_DB`).
 *
 * Deliberately not a test and not an assertion: it fails nothing and gates
 * nothing. Vitest's own worker count is `max(availableParallelism - 1, 1)`
 * in non-watch mode (`createForksPool`, vitest 2.1.9), which is why
 * `availableParallelism` is printed rather than inferred later from a core
 * count that may not equal it in a container.
 */
async function main(): Promise<void> {
  const parallelism = os.availableParallelism();

  const facts: Record<string, string | number> = {
    platform: `${os.platform()} ${os.release()}`,
    availableParallelism: parallelism,
    cpusLength: os.cpus().length,
    totalMemMiB: Math.round(os.totalmem() / 1024 / 1024),
    // vitest 2.1.9 createForksPool, non-watch: Math.max(numCpus - 1, 1).
    vitestExpectedWorkers: Math.max(parallelism - 1, 1),
    // platform/db/pool.ts passes no `max`, so pg-pool's default applies.
    pgPoolMaxPerPool: 10,
  };

  const pool = new Pool({ connectionString: loadDbConfig().connectionString });
  try {
    const { rows } = await pool.query<{ name: string; setting: string }>(
      `select name, setting from pg_settings
        where name in ('max_connections', 'superuser_reserved_connections', 'server_version', 'idle_in_transaction_session_timeout', 'statement_timeout', 'deadlock_timeout')`,
    );
    for (const row of rows) facts[`pg.${row.name}`] = row.setting;
  } finally {
    await pool.end();
  }

  console.log("environment-report:", JSON.stringify(facts, null, 2));
}

await main();
