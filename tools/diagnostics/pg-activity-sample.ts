import { Pool } from "pg";
import { loadDbConfig } from "../../platform/config.js";

/**
 * Samples `pg_stat_activity` on an interval and, on exit, prints the peak
 * connection count and every distinct wait event seen.
 *
 * This is the direct observation `RISK_REGISTER.md` R-008's F-3 addendum
 * named and nobody ran: "one CI run with `fileParallelism: false`, plus one
 * with `pg_stat_activity` sampled during the suite". The `fileParallelism`
 * half is not run — R-008's unexplained mode turned out to be a
 * misattributed stack line rather than a real second mode, so the toggle no
 * longer discriminates anything (see that row's 2026-09-02 addendum). The
 * sampling half is kept, because it is the only measurement this repository
 * has ever taken of how close the suite comes to `max_connections`, and
 * **ADR-039 (pool sizing and query timeouts) is OPEN and has no measurement
 * behind it at all.** This produces evidence for that ADR. It decides
 * nothing.
 *
 * Reads `pg_stat_activity` filtered to this database. That view exposes
 * other sessions' rows only to a superuser or a member of
 * `pg_read_all_stats`; `nexora_app` is neither (`platform/db/init/001_roles.sql`),
 * so a non-privileged run sees its own backend and nulls for the rest —
 * which still yields an accurate *count* of backends, because the row exists
 * either way. The count is what this is for.
 *
 * The sampler holds one connection of its own for its lifetime. That
 * connection is included in every count printed, and the summary says so,
 * rather than being silently subtracted.
 */
const INTERVAL_MS = 250;
/** Emit a rolling summary every this many samples (~5s at 250ms). */
const SUMMARY_EVERY = 20;

interface Sample {
  total: number;
  active: number;
  idleInTransaction: number;
}

let peak: Sample = { total: 0, active: 0, idleInTransaction: 0 };
const waitEvents = new Set<string>();
let samples = 0;

const pool = new Pool({ connectionString: loadDbConfig().connectionString, max: 1 });

async function sample(): Promise<void> {
  const { rows } = await pool.query<{
    total: string;
    active: string;
    idle_in_transaction: string;
    wait_events: string[] | null;
  }>(
    `select count(*)::text as total,
            count(*) filter (where state = 'active')::text as active,
            count(*) filter (where state = 'idle in transaction')::text as idle_in_transaction,
            array_remove(array_agg(distinct wait_event_type || ':' || wait_event), null) as wait_events
       from pg_stat_activity
      where datname = current_database()`,
  );
  const row = rows[0];
  if (!row) return;

  samples += 1;
  const current: Sample = {
    total: Number(row.total),
    active: Number(row.active),
    idleInTransaction: Number(row.idle_in_transaction),
  };
  peak = {
    total: Math.max(peak.total, current.total),
    active: Math.max(peak.active, current.active),
    idleInTransaction: Math.max(peak.idleInTransaction, current.idleInTransaction),
  };
  for (const event of row.wait_events ?? []) waitEvents.add(event);
}

function report(): void {
  console.log(
    "pg-activity-sample:",
    JSON.stringify(
      {
        samples,
        intervalMs: INTERVAL_MS,
        peakConnectionsIncludingThisSampler: peak.total,
        peakActive: peak.active,
        peakIdleInTransaction: peak.idleInTransaction,
        distinctWaitEvents: [...waitEvents].sort(),
      },
      null,
      2,
    ),
  );
}

const timer = setInterval(() => {
  // A sampling failure must never fail the run it is only observing.
  void sample()
    .catch(() => {})
    .then(() => {
      // Emit the rolling summary periodically rather than only on a signal.
      // Signal delivery to a background child is not reliable on every
      // platform this repository is developed on (Windows in particular), and
      // a sampler whose entire output depends on a clean SIGTERM produces
      // nothing at all when that signal does not arrive - which is exactly
      // what happened the first time this was run. Printing as it goes means
      // the peak survives any kill.
      if (samples % SUMMARY_EVERY === 0) report();
    });
}, INTERVAL_MS);

let finishing = false;
async function finish(): Promise<void> {
  if (finishing) return;
  finishing = true;
  clearInterval(timer);
  report();
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void finish());
process.on("SIGINT", () => void finish());
