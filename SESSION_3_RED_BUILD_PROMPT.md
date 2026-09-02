# SESSION 3 — Commit the decision programme, then attack R-008's unexplained mode

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected.
> **Writes test and tooling code only** — no production code, no migration, no
> capability, no ADR ruling.

Two sessions of documentation work sit uncommitted in the working tree. Commit
it first, then spend the session on the one thing the whole decision programme
stepped around: `main` is red on an intermittent test whose root cause has been
`UNDETERMINED` across four occurrences.

**Read this before planning anything.** D-6's investigation already ran **165
local reproduction attempts — 150 isolated-scenario loops plus 15 full local
suite runs — with zero anomalies**, and directly **refuted** the deadlock
hypothesis (`pg_stat_database.deadlocks` showed no increase; no occurrence shows
a 5xx anywhere). Do not re-run that experiment. Attempting reproduction by
looping the test locally again is the one approach already proven not to work.

---

## Step 0 — Read

1. `AGENTS.md` §5 and §8
2. `RISK_REGISTER.md` — **rows R-008 and R-036 only.** Do not read the file's
   other 38 rows.
3. `PHASE_1_DEBT_CLOSURE.md` — the **D-6** section in full, especially what it
   closed on and what it explicitly did not
4. `decisions/2026-09.md` — the two 2026-09-02 entries about R-008 (the
   four-occurrence entry and the R-037 entry)
5. `apps/api/membership-revoke.integration.spec.ts` — the whole file, and
   the two-concurrent-owners test at `:439-459` line by line
6. `vitest.config.ts`
7. `platform/config.ts` and `platform/db/` — the pool construction and its
   configured size
8. `.github/workflows/` — how the suite runs in CI, and `docker-compose.yml`
9. `modules/tenant/interfaces/organization-access.guard.ts`,
   `modules/identity/interfaces/session.guard.ts`,
   `modules/tenant/application/revoke-membership.service.ts`

Do not read `future/` or `99_SOURCE_MASTER_SPEC_v1.2.md`.

---

## Step 1 — Commit what is already done, before touching anything

```bash
git status --short
git log --oneline -20
```

Match the existing commit-message style — read it, do not assume it.

**Two commits, in this order:**

1. **The decision programme.** `02_ADR_INDEX_NORMATIVE_DECISIONS.md`,
   `RISK_REGISTER.md`, `04_DATABASE_BLUEPRINT.md`, `CLAUDE.md`,
   `decisions/2026-09.md`, `PROJECT_GRAPH.md`, `tools/graph/project-graph.json`.
   Seven ADRs added and four of them ruled, three risk rows, one blueprint
   correction. The message should say what binds now that did not before.

2. **The non-normative working documents**, separately, so commit 1 stays clean:
   `NEXORA_PLAN_3ROUNDS.md`, `SESSION_1_PROMPT_v2.md`,
   `SESSION_2_RULINGS_PROMPT.md`, and this file. Label them in the message as
   non-normative planning documents that decide nothing.

Run `npm run format:check` before committing. If Prettier objects to any of the
four Markdown planning files, `npm run format` them — that is formatting, not a
finding.

**Do not push yet.** Push after Step 6, so a CI run is triggered against a tree
whose state you can describe.

---

## Step 2 — Establish the current state cheaply

Re-run the failed CI job once (`gh run rerun`, or push and let it run). A green
rerun proves intermittency, which is already known — it proves nothing about
cause. **Record the result either way and do not let it change the plan.**

---

## Step 3 — The differential nobody has used yet

This is the core of the session, and it is analysis before experiment.

**The single strongest fact in the whole record is that this failure has never
once occurred locally in 165 attempts, and has occurred four times in CI.** That
is not a statement about the code path — it is a statement about the
environment. Previous investigations searched the server-side code, which is the
part that is identical in both places.

Enumerate every difference between the two environments, from the files, not
from memory. At minimum:

- **PostgreSQL**: native PG 17 on port 5432 locally versus `postgres:17-alpine`
  in `docker-compose.yml` on 5433 in CI. Read the compose file for any
  `command:` overrides. **Get `max_connections` for each** — the alpine image's
  default and whatever the local instance reports.
- **Concurrency**: `vitest.config.ts` sets no `fileParallelism`, so it defaults
  to true and integration spec files run in parallel worker processes. How many
  workers does a GitHub Actions runner spawn (cores available), versus this
  machine?
- **Pool**: the configured pool size per process, from `platform/config.ts`.
- **Latency**: loopback on a developer machine versus a container network in CI.

**Then do the arithmetic and write it down:**

```
workers × pool_size   versus   max_connections
```

If that product approaches or exceeds `max_connections` in CI and does not
locally, **that is a concrete, checkable mechanism for F-3 — the connection-pool
acquisition hypothesis R-008 named and never tested** — and it explains the
local/CI asymmetry that nothing else explains. If the arithmetic is comfortable
in both, F-3 is weakened by evidence rather than left hanging, which is also a
result worth recording.

---

## Step 4 — A hypothesis the record does not contain. Test it, do not assume it.

Every investigation so far has treated the test's own report as ground truth and
searched the server for a reason no request returned 200. State and test the
inverse.

**The hypothesis:** the server did return 200 — the structured access log in
each occurrence says so for that test's own uniquely-identified organization —
and the *client side* failed to record it. A supertest request whose socket is
reset, times out, or whose promise rejects would leave `successes` empty while
the server log shows a clean 200. That is consistent with every piece of
evidence simultaneously: a clean 200 in the log, no 200 in the test's array, no
5xx anywhere, no deadlock, and non-reproducibility on a fast local loopback.

**How the test currently classifies a response matters more than what it
asserts.** Read `:439-459` and answer precisely, in your report:

- Is it `Promise.all` or `Promise.allSettled`? A rejected promise under
  `Promise.all` loses the other result entirely.
- Does `successes` filter on `r.status === 200`? What is `r` when the request
  rejected rather than resolved — and would that produce exactly this symptom?
- D-6 added a diagnostic dump capturing "raw statuses and their `typeof`".
  **Would that dump distinguish a rejected request from a resolved non-200 one?**
  If not, extending it so that it does is the highest-value change available in
  this session, because it converts the next occurrence into evidence instead of
  another unexplained data point.

**Note carefully:** the dump has fired exactly once, on occurrence 4, which was
the *other*, now-explained mode (a `403` from `OrganizationAccessGuard` in a
timing window). **It has never fired on the unexplained mode**, because
occurrences 1–3 predate it. Say this plainly rather than treating the dump's one
firing as coverage.

---

## Step 5 — Run the one experiment that was named and never run

R-008's own recorded next step, still unrun: **`fileParallelism: false` plus
`pg_stat_activity` sampling.**

Run it deliberately, not as a fix:

- With file parallelism disabled, does the CI suite still fail intermittently?
  A change in failure rate under reduced concurrency is evidence about the
  mechanism. **A green run under `fileParallelism: false` does not license
  making that the permanent setting** — it would hide the failure and slow the
  suite, and Phase 2 adds materially more concurrent-writer surface where the
  same mechanism would resurface somewhere less well-guarded.
- Sample `pg_stat_activity` during the run — connection counts, `wait_event`,
  and any connections in `idle in transaction`. That is the direct observation
  F-3 has always needed.

Whatever the result, it is a measurement to record, not a fix to apply.

---

## Step 6 — What each outcome licenses, and what none of them licenses

**If you find the mechanism:** propose the fix, state what measurement would
prove it, and — if the fix is production code — **stop and report instead of
writing it.** This session's boundary is tests and tooling. A pool-size change
is production configuration and is additionally ADR-039's territory, which is
`OPEN`; feed the evidence there rather than deciding it here.

**If you do not find it — the likely outcome, and an honest one:** the
deliverable is that the next occurrence produces enough evidence to close the
question. That means the diagnostic improvement from Step 4, plus the recorded
environmental arithmetic from Step 3, plus whatever Step 5 measured.

**In neither case:**

- Do not apply `ORDER BY id` to `lockActiveForUpdate`. It is a named, unapplied
  candidate — defensible practice in general, and **shown by D-6's own
  measurements not to be this cause.** Applying it now and observing no
  recurrence is the exact trap D-6 was designed to avoid, and it would waste the
  one clean before/after measurement available if a real cause is ever found.
- Do not add a retry, a `retry: n` in vitest config, or any wrapper that makes
  the test pass without explaining it. A regression guard for R-007's
  last-owner race that is allowed to pass on a second attempt is no longer a
  guard.
- Do not widen the test's accepted status codes to absorb the failure. R-036
  records precisely why: doing so would silently decide the error contract for a
  mid-flight revocation, which belongs to `05` §7 and an ADR, not to one line in
  a spec file.
- Do not skip, `.todo` or quarantine the test **unless** you record it as an
  explicit decision with a named reopening trigger, in `decisions/2026-09.md`,
  and say so loudly in your report. If the honest engineering answer is that the
  suite should not be red on an unexplained flake while Phase 2 proceeds, that
  is a legitimate position — but it is a decision to be recorded, not a
  configuration change to be slipped in.

---

## Step 7 — Record

**`RISK_REGISTER.md` R-008** — append a dated addendum. Do not rewrite the row;
its history is the point. Record what was measured, what it ruled out, and what
F-3's standing is now. If F-3 was weakened or strengthened by the arithmetic,
say which and why. **Re-run the register's inline-row integrity check after
editing** — the `awk` scan for non-pipe lines inside the table — per the
2026-09-02 entry's own lesson that this row has broken the table twice.

**`decisions/2026-09.md`** — one entry, newest at top, four-field template.
`Status: RESOLVED` if the investigation is honestly complete for what it could
reach; `OPEN` if a decision is now owed from the maintainer.

**`PHASE_1_DEBT_CLOSURE.md`** — D-6 is already CLOSED and stays closed; this
session is not reopening it. Do not edit that section.

If the diagnostic dump changed, `npm test` case count moves — note the new
number and do not "reconcile" it with `PROJECT_GRAPH.md`'s static count.

---

## Step 8 — Verify and push

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run conformance
```

`npm run db:migrate` is not required — no migration changed.

Then push, and report the resulting CI run's outcome.

---

## Step 9 — Report

- the two commits, by hash and message
- **the environmental arithmetic from Step 3, as numbers** — this is the part
  most likely to be the actual finding
- what Step 4's reading of the test showed: how a rejected request is currently
  classified, and whether the dump would distinguish it
- what Step 5 measured
- what you changed, and what you deliberately did not change and why
- whether R-008's unexplained mode is now explained, partly explained, or
  unchanged — **using those words, not softer ones**

---

## Hard boundaries

- **Tests and tooling only.** No production code, no migration, no capability,
  no config change to the running application.
- No ADR is written or ruled. Evidence about pool sizing goes to ADR-039 as
  evidence, not as a decision.
- No `exceptions.json` entry, no weakened conformance rule.
- No re-running of D-6's local reproduction loops — 165 attempts already
  returned nothing.
- If you become uncertain: **stop and write the ambiguity down with options and
  a recommendation.** An honest "not explained" is the correct output here and
  has been three times already.
