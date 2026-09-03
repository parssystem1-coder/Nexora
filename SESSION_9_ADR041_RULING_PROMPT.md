# SESSION 9 — Rule ADR-041: bound the ledger and audit tables, and prove the RLS × partitioning question empirically

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را تصمیم نمی‌گیرد؛ تصمیم‌ها فقط در جایی که این
> پرامپت می‌گوید ثبت می‌شوند.

> Model: Opus. `D:\Nexora` connected. Docker available.
> **This session writes no feature code and creates no table.**
> It runs SQL against a scratch database, records what PostgreSQL 17 actually
> does, and then records a ruling in the documents.
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session, and why first

ADR-041 is `OPEN`. Its own text states the timing problem in terms that decide
the ordering of everything else:

> "Partitioning an empty or small table is a schema change. Partitioning a large
> populated table is a data migration — and migrations here are forward-only
> (ADR-021 item 8). `audit_events` is small today. The four Phase 2 ledger tables
> **do not exist yet, which is the cheapest moment they will ever have.**"

Phase 2 item 4 creates `subscription_periods`. That is the first append-only
table this decision binds. Once its creating migration merges, the option this
ADR is choosing between costs a data migration instead of a table definition.

ADR-041 also carries something no other open ADR carries: **a verification
checklist whose first line forbids the ruling until four PostgreSQL questions are
answered empirically.** They were never attempted, because the pass that wrote
ADR-041 was documentation-only. This session answers them with a running
PostgreSQL 17, and only then records the ruling.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — **§1 (read order and authority), §3 (pre-change checklist), §4,
   §5 (uncertainty → decision log), §7 (definition of done)**
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-041 in full**, then **ADR-020**
   (rules 4 and 5, verbatim, not from ADR-041's quotation of them), **ADR-021**
   (item 8), **ADR-030**, **ADR-034** (item 4), **ADR-048** (its `### Ruling`
   part 2, for the invoice-volume statement this session relies on), and
   §1.1's summary-table row for ADR-041
3. `PHASE_2_BRIEF.md` — **§4 in full including the 2026-09-03 amendment**, and
   **§5 "Tenancy and RLS" and "Append-only ledgers"**
4. `04_DATABASE_BLUEPRINT.md` — **§7 and §8**
5. `RISK_REGISTER.md` — rows **R-025, R-030, R-039, R-041** only
6. `tools/conformance/rules/schema-live.ts` — **in full**, including its
   `TENANT_EXEMPT` list and the exact `information_schema` query it issues
7. The `audit_events` creating migration
   (`20260822090800_audit__create_audit_events.sql`) and
   `platform/db/init/*.sql`
8. `docker-compose.yml`

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run typecheck
```

Tree must be clean and all three green. **If not, stop and report.**

---

## Step 1 — Answer ADR-041's four questions empirically. Do not reason about them.

ADR-041 names four things as **"NOT established, and explicitly owed
verification"**. It also sets the standard for how they must be answered:

> "the same standard `RISK_REGISTER.md` R-002 met when it confirmed **by direct
> test** that a table's owning role bypasses RLS by default, rather than
> reasoning about it from documentation."

So: no answer in your report may be sourced from PostgreSQL documentation, from
your own knowledge, or from inference. Every answer must be a transcript.

### 1.1 Scratch database, not a migration

Bring up the project's own PostgreSQL 17:

```bash
docker compose up -d postgres
```

Work in a **scratch schema** (`CREATE SCHEMA adr041_probe;`) using the same role
split the project uses — `nexora_migrate` owns, `nexora_app` reads and writes.
**Write no migration file. Add nothing to `platform/db/migrations/`.** Drop the
schema at the end and prove it is gone.

### 1.2 The fixture

Build, by hand in SQL:

- a partitioned parent `adr041_probe.probe_events` with `tenant_id uuid not null`,
  `occurred_at timestamptz not null`, `PARTITION BY RANGE (occurred_at)`
- `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` and a tenant policy
  using `current_setting('app.tenant_id', true)` — **on the parent only**,
  matching exactly what the existing `audit_events` migration does for a
  non-partitioned table
- two range partitions covering two adjacent months
- rows for two different tenants in each partition, inserted as `nexora_migrate`

### 1.3 The four questions, each with its own transcript

| # | Question, as ADR-041 states it | What the transcript must show |
|---|---|---|
| 1 | Whether `FORCE ROW LEVEL SECURITY` on a partitioned parent applies to reads **and** writes routed **through the parent**, to partitions accessed **directly**, or both | four separate statements as `nexora_app`: `SELECT` via parent, `SELECT` direct on a partition, `INSERT` via parent, `INSERT`/`UPDATE` direct on a partition — each with a wrong-tenant `app.tenant_id` set, and each with no tenant context set at all |
| 2 | Whether a policy created on the parent is enforced for **direct access to a partition** | the direct-partition `SELECT` from Q1, with row counts, next to the same query via the parent |
| 3 | Whether `relrowsecurity` / `relforcerowsecurity` on a **partition's own `pg_class` row** reflect the parent's setting or are independent | `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN (...)` for parent and both partitions, verbatim output |
| 4 | How `information_schema.tables` reports a **partitioned parent versus its partitions** | the exact query `schema-live.ts` issues, run against the probe schema, verbatim output including the `table_type` column |

Then answer the question ADR-041 derives from question 4 and calls the one that
could fail silently:

> **Given the transcript, what would `tools/conformance/rules/schema-live.ts`
> enumerate if these were real tables — the parent, the partitions, or both?**

State it as a conclusion drawn from the output you just pasted, and name the line
of `schema-live.ts` that decides it.

### 1.4 The failure mode you are checking for

ADR-041 states both branches:

> "The harness will then either flag every partition (a false alarm that invites
> someone to add an `exceptions.json` entry — which `CLAUDE.md`'s standing rule
> forbids as a way to reach green), or pass them without ever having checked the
> property it believes it checked. **Both failure modes are worse than the status
> quo, and the second is silent.**"

Say which branch the transcript puts the project in. If it is the silent one,
say so plainly — that is the finding, not a problem to smooth over.

---

## Step 2 — Record the ruling

**Ruled by the maintainer on 2026-09-03.** ADR-041 offered four options and
recommended option 1 as "a recommendation, not a ruling". The ruling below adopts
option 1 and settles the four things the ADR left unsettled: which tables, at
what granularity, what happens when a partition is missing, and for how long rows
are kept.

**Before you write any of it: if Step 1's transcripts contradict any premise
below, stop and report instead of recording it.** Part 1 in particular assumes
partitioning does not weaken tenant isolation; if Step 1 shows otherwise, the
ruling is wrong and must not be written.

### Part 1 — Option 1, native declarative partitioning by time. No extension.

`PARTITION BY RANGE` on the row's own event timestamp. `pg_partman` (option 2) is
rejected at ADR-010's stated V1 scale for the reason ADR-041 already gives — it
automates something native partitioning covers — and adding an extension
dependency for it is not justified. Option 4 is rejected because it forfeits the
cheap moment for nothing.

### Part 2 — Which tables. This narrows ADR-041's own list, deliberately.

ADR-041 names four Phase 2 tables: `usage_ledger_entries`,
`billing_payment_events`, `subscription_state_transitions`, and `invoice_lines`.
**The ruling partitions the first three and not the fourth**, and states the rule
that separates them rather than the list, so a later table can be classified
without reopening this ADR:

> **A table is partitioned if its row count grows with platform *activity* —
> one row per attempt, per event, per interaction. A table is not partitioned if
> its row count is bounded by *business volume* — one row per invoice, per
> period, per subscription.**

| Table | Partitioned | Why |
|---|---|---|
| `audit_events` | **yes** | one row per capability attempt, success and failure (ADR-034 item 4). The fastest-growing table in the platform. |
| `usage_ledger_entries` | **yes** | append-only usage records; growth is metering frequency, not customer count |
| `billing_payment_events` | **yes** | one row per provider interaction, and ADR-023 item 4's reconciliation sweep re-verifies `PENDING` intents repeatedly, so a single payment can produce many rows |
| `subscription_state_transitions` | **yes** | one row per transition; jobs in ADR-024 item 8 run on a schedule and transitions are not rare |
| `invoices`, `invoice_lines` | **no** | ADR-048's ruling states the volume on the record: *"the platform issues on the order of thousands of invoices per year — not thousands per minute"*. Ten years at that rate is tens of thousands of rows. |
| `subscription_periods` | **no** | one row per subscription per period. Bounded by ADR-010's ≤5,000 organizations. |
| `outbox_events`, `outbox_event_deliveries` | **no**, and this needs its own decision later | delivery state is short-lived by nature, but nothing yet says when a delivered event may be removed, and `outbox_events` is on §5's `REVOKE` list. **Open a risk row for it (Part 7), do not partition it now.** |

**Deviating from ADR-041's own four-table list is a choice this ruling makes and
must therefore be stated in the ADR itself, not silently.** Write the reason
down: `invoice_lines` was grouped with the ledger tables by shape (append-only)
rather than by growth rate, and ADR-048's volume statement — written after
ADR-041 — is the fact that separates them.

### Part 3 — Monthly range partitions, created ahead by a job.

- **Granularity: one partition per calendar month**, boundaries computed per
  ADR-031 (stored UTC, tenant billing timezone is irrelevant to a platform-level
  partition boundary — say so explicitly, because it is the kind of thing a
  later reader will wonder about).
- **Lookahead: 3 months.** A new scheduled job — name it, and add it to the job
  list — creates missing partitions for the next three months. It is idempotent
  per ADR-009 like every other job in ADR-024 item 8, and it is recorded in
  `scheduled_job_runs` like every other job.
- The creating migration itself creates the current month plus the next three, so
  a deployment that never runs the job still functions for a quarter.

### Part 4 — A `DEFAULT` partition exists, and a non-empty one is an alarm.

This is the part that trades two bad outcomes against each other, so record both
sides, not just the choice.

**Without a `DEFAULT` partition**, an insert whose timestamp falls outside every
existing partition **fails**. For `audit_events` that is not a degraded mode: ADR-034
writes one audit row per capability attempt, so a missing partition takes down
every capability at once. A scheduled job that silently stopped running three
months ago would produce a total outage with no warning beforehand.

**With a `DEFAULT` partition**, those rows land safely — and create a different
trap: PostgreSQL refuses to `ATTACH` a new partition whose range overlaps rows
already sitting in the default partition, so the recovery is detach, move rows,
re-attach. That is a data migration, which is exactly what this ADR exists to
avoid.

**Ruling: the `DEFAULT` partition exists, and a non-empty `DEFAULT` partition is
a loud failure.**

- a check — placed with `check:register` and `check:graph`, i.e. **outside** the
  ADR-030 harness, for the same reason those were: no `exceptions.json` entry may
  ever silence it — fails if any partitioned table's `DEFAULT` partition contains
  a row
- the recovery procedure (detach, move, re-attach) is written down **now**, in the
  ADR, while nobody is under pressure

The reasoning to record: a catastrophic silent outage is converted into a noisy,
recoverable anomaly. That is the trade, stated as a trade.

### Part 5 — Retention windows, with their source and their epistemic status.

ADR-020 rule 4 commits the platform to retaining financial records "per the legal
retention window" and **never says what that window is**. That gap is what makes
an archival job unimplementable. Close it:

| Class | Tables | Window | Source |
|---|---|---|---|
| Financial and tax | `invoices`, `invoice_lines`, `billing_payment_events`, `usage_ledger_entries`, `subscription_periods`, `subscription_state_transitions` | **10 years** from the end of the fiscal year the record belongs to | ماده ۱۳ قانون تجارت ایران — commercial books and their supporting documents must be kept for at least ten years |
| Security and audit | `audit_events` | **2 years**, then archived, never dropped | operational, not legal; the number is a choice and is recorded as one |
| Never removed | audit events that record a deletion | **indefinite** | ADR-020 rule 5, verbatim: *"Audit events recording the deletion itself are never purged."* |

**Epistemic status, in the house style ADR-041 and ADR-048 both established:**
the ten-year figure is the commonly cited reading of ماده ۱۳ قانون تجارت and was
**not verified against the primary published text in this pass.** Record it that
way. Verify it if you can do so from a primary source; if you cannot, say so and
leave the marker. Nothing in Parts 1–4 depends on the number — it is the archive
job's target, and the job is not built here.

### Part 6 — What this ruling does not do, and what it hands to whom.

- **No partitioning migration is written in this session.** The ruling binds the
  creating migrations of Phase 2 items 4, 5, 9 and 12. Each of those slices
  implements it.
- **`audit_events` already exists and is not yet partitioned.** Converting it is
  a forward migration (allowed) and is cheap only while the table is small.
  Ruling: **it is converted in its own dedicated migration before Phase 2 exit**,
  and the session that does it re-runs Step 1's cross-tenant proof against the
  real table. Record it as an owed obligation with that deadline; do not do it
  here.
- **Disposal is Phase 2.5, not Phase 2.** Detaching a partition and archiving it
  requires somewhere to put it, and **R-025 records that no object storage port
  exists and no phase item owns one** — the same prerequisite ADR-054 already
  declared for per-tenant recovery. Until that exists, partitions are created and
  retained; nothing is detached and nothing is dropped. Say this plainly so that
  a later reader does not assume partitioning by itself bounds anything. **It
  bounds scan size, not disk.**
- It does not touch ADR-020's rules, and it does not authorise deleting anything
  ADR-020 excludes from purge.

### Part 7 — The conformance harness obligation, on ADR-030's own terms.

Whatever Step 1 found, `tools/conformance/rules/schema-live.ts` must end up
checking what it believes it checks. In this session:

- state precisely what change it needs (which may be "none" — if so, prove it
  from the transcript, do not assert it)
- **if it needs a change, do not make it here.** Record it as an owed obligation
  with a named trigger: *before the first partitioned table's creating migration
  merges.*
- either way, record ADR-030's own standard for that future change: **a
  deliberately failing fixture proving the rule still detects a partition missing
  `tenant_id`, RLS, `FORCE`, or a policy** — and **no `exceptions.json` entry**,
  which `CLAUDE.md`'s standing rule forbids as a route to green.

---

## Step 3 — Where each thing is recorded

Follow the conventions already in these files. **Nothing existing is reworded or
deleted; corrections are dated addenda.**

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`**
   - ADR-041 body: add `### Ruling` after the existing `### Options` /
     recommendation, leaving those as written (the ADR-048 precedent — its
     refusal to guess was correct at the time and stays visible)
   - add the Step 1 transcripts under a heading such as
     `### The four questions, answered empirically 2026-09-03` — **paste the
     output, do not summarise it.** This is the part a future reader cannot
     reconstruct.
   - tick ADR-041's existing verification checkboxes that are now genuinely met,
     and leave the ones that are not — the live cross-tenant proof against a real
     table is **not** met by a probe-schema fixture, so be careful which you tick
   - §1.1 summary table: ADR-041 → `**ACCEPTED (was OPEN)**`, and rewrite its
     `Blocks` cell, which currently reads "nothing today"

2. **`PHASE_2_BRIEF.md`** — a dated amendment to **§5 "Append-only ledgers"**
   stating which tables are partitioned, the monthly granularity, the `DEFAULT`
   partition rule, and the ahead-creation job. §4's table list gains **no new
   table**; add a one-line note under the existing 2026-09-03 amendment saying so
   explicitly, because a reader who sees partitions in a migration will otherwise
   wonder whether §4's wall was breached. Add the new job to wherever §5 or §4
   lists scheduled jobs; if neither does, say where it is owed.

3. **`04_DATABASE_BLUEPRINT.md` §8** — a dated note that indexes on a partitioned
   table are declared on the parent and propagate, so §8's index list is unchanged
   in content but changes in meaning for those four tables.

4. **`RISK_REGISTER.md`**
   - **R-030**: a dated addendum — it now has an owner and a ruling. Move its
     status out of `UNMEASURED` to whatever the register's vocabulary makes
     correct; do not invent a status word.
   - **one new row, R-042**: `outbox_events` / `outbox_event_deliveries` have no
     removal policy — Part 2 deliberately left them unpartitioned and unbounded.
     Trigger to reopen: Phase 2 item 14.
   - if Step 1 found the silent-pass branch in §1.4, that is a **second new row,
     R-043**, not a footnote.
   - `npm run check:register` must pass. Escape every `|` inside a cell.

5. **`decisions/2026-09.md`** — one entry, dated 2026-09-03, recording: the
   ruling, the deviation from ADR-041's four-table list and why, the ten-year
   figure's unverified status, and the two owed obligations (the `audit_events`
   conversion, and the `schema-live.ts` change if one is needed).

6. **`PROJECT_STATUS.md` / `PROJECT_GRAPH.md` / `CLAUDE.md`** — update only what
   is factually stale as a result. Do not pad.

---

## Step 4 — Verify

```bash
npm run typecheck
npm run test
npm run conformance
npm run check:register
npm run graph && npm run openapi   # must produce no diff
git status --short
```

Prove the probe schema is gone:

```sql
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'adr041_probe';
```

Then one commit, message in the repository's existing style, referencing ADR-041.

---

## What to report back

1. **The four transcripts**, verbatim, and the conclusion each supports.
2. **Which branch of §1.4 the project is in** — false alarm, silent pass, or
   neither — and the line of `schema-live.ts` that decides it.
3. **Any premise in Step 2 that Step 1 contradicted**, and what you did instead.
4. Which of ADR-041's verification checkboxes you ticked and which you left, with
   the reason for each one you left.
5. The exact list of files changed, and the commit hash.
6. Anything you found that this prompt did not anticipate — including anything
   in it that was simply wrong.

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Where it states a fact about a file, verify
the file. Where it is wrong, **stop and report rather than working around it** —
seven premises in earlier prompts in this programme were wrong and were caught
exactly this way, and each catch was worth more than the work it interrupted.
