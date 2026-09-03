# SESSION 10 — Rule ADR-041, and build the tripwire that makes the ruling enforceable

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed on this machine**
> — `CLAUDE.md` records this; the previous session's brief was wrong about it and
> this one is not. Use the native PostgreSQL 17.5 the test suite uses, and say so.
> **`/new-slice` does not apply and must not be invoked.**
> This session writes **one conformance rule and its fixture**, and no feature code.

---

## Why this session

Session 9 answered ADR-041's four questions empirically and correctly withheld the
ruling, because the answers disqualified the option that was about to be ruled.
Read its transcripts before anything else — they are the input to this session,
not background.

**The maintainer has now ruled**, on 2026-09-03, and the ruling is not any of
ADR-041's four options. This session records it, and builds the one piece of
enforcement that makes it more than a paragraph.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7, §8
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-041 in full, including the
   2026-09-03 empirical section and its Q0**; then **ADR-020** (rules 4 and 5),
   **ADR-021** (item 8), **ADR-023** (item 4), **ADR-030**, **ADR-034** (item 4),
   **ADR-048**'s `### Ruling` part 2
3. `RISK_REGISTER.md` — **R-025, R-030, R-042** only
4. `tools/conformance/` — `run.ts`, `rules/schema-live.ts` in full, and **how
   `exceptions.json` is applied**: find the code that applies it and establish
   whether a rule can be marked non-exceptable. **This is a question Step 3
   depends on; answer it from the code, not from memory.**
5. `tools/register/check-register.ts` and `tools/build/check-dist-deps.ts` — the
   precedent for a check that lives *outside* the harness
6. `platform/db/init/001_roles.sql`, and the `audit_events` creating migration
7. `PHASE_2_BRIEF.md` §4 and §5

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run typecheck && npm run test
```

**If the tree is not clean or any of those is red, stop and report.**

---

## Step 1 — Two facts to establish before recording anything

**1.1 Does anything reference `audit_events` by foreign key?** Grep every
migration for `REFERENCES audit_events`, and check the schema live. The ruling
below asserts nothing does. If something does, **stop and report** — the ruling's
Part 3 is then wrong.

**1.2 Confirm Session 9's grant finding still holds on a table created today.**
One statement is enough: create a throwaway table as `nexora_migrate` in a
throwaway schema, read its privileges for `nexora_app`, drop the schema. This is
not re-litigating Session 9; it is confirming that the ruling's Part 5 describes
the live database and not a probe artifact. Paste the output.

---

## Step 2 — Record the ruling

**Ruled by the maintainer on 2026-09-03**, after reading Session 9's transcripts.

Write it into ADR-041 as `### Ruling`, after the existing options and the
empirical section, **leaving both as written**. Follow ADR-048's precedent: the
options table stays, its recommendation stays, and the ruling explains why it
departs from it.

### Part 1 — The ruling is a fifth option, and the ADR must say so plainly

ADR-041 listed four options and recommended option 1 (native declarative
partitioning), decided before the Phase 2 ledger tables' creating migrations. The
ruling is **neither option 1 nor option 4**, and inventing a fifth option in a
ruling is unusual enough that it must be justified in the ADR rather than slipped
in:

> **Option 5 — keep the tables partition-*compatible*, and do not partition them.**
> The creating migrations of the Phase 2 append-only tables must not introduce
> anything that would make partitioning impossible later. No partitions are
> created, no `audit_events` conversion is performed, and no partition-maintenance
> machinery is built.

**Why the recommendation moved.** ADR-041's case for option 1 rested on one
claim: *"the four Phase 2 ledger tables do not exist yet, which is the cheapest
moment they will ever have."* Session 9 established three things that were not
known when that was written, and each one raises option 1's price:

1. **Partitioning weakens tenant isolation under this project's actual
   configuration** (R-042), and the fix is a precondition that must hold for every
   partition forever. A security property that depends on a step being repeated
   correctly every month is a worse asset than the disk it saves.
2. **Partitioning permanently surrenders database-enforced uniqueness on `id`**
   (Q0), on every partitioned table, irreversibly.
3. **The partition-creation job in the session brief was impossible.** `nexora_app`
   is `NOSUPERUSER`, owns nothing, and cannot `CREATE TABLE` — which is exactly
   the property ADR-021's role split exists to guarantee. Partitions can therefore
   only be created by migrations, so option 1 also commits the platform to a
   recurring migration obligation nobody had costed.

**And the benefit does not arrive yet.** Partitioning bounds scan size and makes
detaching a period cheap. **Detaching requires somewhere to put it, and R-025
records that no object storage port exists and no phase item owns one** — the same
prerequisite ADR-054 already declared. Until Phase 2.5 buys that, partitioning
frees no disk at all.

**State the honest limit of option 5 in the ADR, in these terms — do not oversell
it.** A table cannot be `ALTER`ed into a partitioned table; converting always
means creating a new partitioned table, copying rows and swapping. **Option 5
therefore does not make the future row copy cheaper.** What it preserves is
narrower and more valuable: **that the conversion, when it happens, will not also
have to break a contract that other code depends on.** The expensive part of a
late conversion is not moving rows; it is discovering that a foreign key, or a
uniqueness guarantee something relies on, cannot survive the partition key.

### Part 2 — Which tables this binds

The same four ADR-041 named, with `invoice_lines` removed and the rule that
separates them stated instead of the list:

> A table is a partitioning candidate if its row count grows with platform
> **activity** — one row per attempt, per event, per interaction. It is not if its
> row count is bounded by **business volume** — one row per invoice, per period,
> per subscription.

| Table | Candidate | Why |
|---|---|---|
| `audit_events` | yes | one row per capability attempt, success and failure (ADR-034 item 4) |
| `usage_ledger_entries` | yes | growth is metering frequency, not customer count |
| `billing_payment_events` | yes | one row per provider interaction, and ADR-023 item 4's reconciliation sweep re-verifies repeatedly |
| `subscription_state_transitions` | yes | one row per transition, and ADR-024 item 8's jobs run on a schedule |
| `invoices`, `invoice_lines` | **no** | ADR-048's ruling states the volume on the record: *"thousands of invoices per year — not thousands per minute"* |
| `subscription_periods` | **no** | one row per subscription per period, bounded by ADR-010's ≤5,000 organizations |
| `outbox_events`, `outbox_event_deliveries` | **no**, and unowned | short-lived by nature, but nothing says when a delivered event may be removed. Not partitioned, and not bounded either — record it as owed to Phase 2 item 14 |

Record that this narrows ADR-041's own four-table list and why: `invoice_lines`
was grouped with the ledgers by *shape* (append-only), and ADR-048's volume
statement — written after ADR-041 — is the fact that separates them by *growth*.

### Part 3 — What "partition-compatible" obliges, concretely

Three rules, binding on the creating migrations of Phase 2 items 4, 5, 9 and 12.
They are cheap because each is a thing **not** done:

1. **Every candidate table carries an immutable `timestamptz NOT NULL` event
   column** — the column a future partition key would use. Append-only tables have
   one anyway; this makes it a requirement rather than a coincidence, and names it
   in the ADR.
2. **No table may declare a foreign key referencing a candidate table.** PostgreSQL
   requires an FK's referenced columns to be covered by a unique constraint, and on
   a partitioned table every unique constraint must include the partition key — so
   an FK on `id` alone is exactly what a later conversion cannot keep. Step 1.1
   establishes that none exists today; this rule keeps it that way.
3. **No uniqueness requirement on a candidate table may depend on a constraint
   that excludes the event column.** This one has a named, foreseeable collision
   and the ADR must name it rather than leave it to be discovered: **ADR-023 item 4
   requires that *"an intent may never be verified twice into two ledger
   entries."*** If item 12 enforces that with a unique index on
   `billing_payment_events` that does not include the event column, then that table
   is **permanently excluded from partitioning**, and item 12's slice must record
   the exclusion in this ADR rather than silently create the conflict. Either
   outcome is acceptable; discovering it during a conversion is not.

`id uuid PRIMARY KEY` **stays as it is** on `audit_events` and on the new tables.
Uniqueness is kept while it is free. Q0's finding — that partitioning surrenders
it — is recorded as a known price of the future conversion, not paid today.

### Part 4 — The revisit trigger, taken from option 4 and made specific

Option 4's weakness was "a trigger on a metric nobody will measure". Give it two
that are observable without new tooling:

- **Any candidate table passing 50 million rows**, observed at any time by
  `SELECT count(*)`, or a total relation size passing 50 GB
- **Object storage landing** (R-025 closing), which is when detach-and-archive
  becomes possible and therefore when partitioning first pays for itself

Whichever comes first reopens this ADR. Record both numbers as choices rather than
derivations, and say what they are for: they are large enough that reaching one is
a real event and small enough that a conversion is still a weekend rather than an
incident.

### Part 5 — The precondition, recorded now so a later session inherits it

If ADR-041 is ever reopened and partitioning adopted, **R-042 becomes live on the
first partitioning migration.** Record what Session 9 proved and what it costs, so
that whoever reopens it starts from the answer:

- a parent-only `ENABLE`/`FORCE`/`USING` policy **does not protect a partition**;
  direct access to the partition bypasses it entirely
- `001_roles.sql`'s `ALTER DEFAULT PRIVILEGES` grants `nexora_app` full DML on
  **every** partition automatically, at creation, with no explicit `GRANT`
- the proven mitigation is `REVOKE ALL ON <partition> FROM nexora_app`, which
  leaves access through the parent untouched

Record the three candidate shapes and the maintainer's preference among them,
**as guidance for the future decision and explicitly not as a ruling** (nothing is
partitioned, so there is nothing to rule on):

| Shape | Failure direction |
|---|---|
| **A. Revoke on each partition** | forgetting is silent — a month-wide cross-tenant hole with nothing red |
| **B. Give each partition its own RLS + FORCE + policy** | forgetting is **loud**: `schema-live.ts` already checks every partition (Session 9's Q4 established it enumerates them at line 41), so a partition without RLS fails `npm run conformance` with no new rule needed |
| **C. Stop `ALTER DEFAULT PRIVILEGES` granting on new tables, grant explicitly per table** | loud, but changes the grant model for every table in the platform to solve a partition-specific problem |

**Preference: B as the primary guarantee, A alongside it as depth. C is rejected**
for blast radius, and because B already supplies the loud-failure property C was
wanted for. Note the one thing B still owes verification on, rather than assuming
it: **whether a policy on a partition and a policy on the parent are both applied
when a row is reached through the parent, and whether that changes any result.**
Session 9 did not test it. Do not test it here either — record it as owed to
whoever reopens this ADR.

### Part 6 — Retention windows, because ADR-020 owes them and they are independent of all of the above

ADR-020 rule 4 commits to retaining financial records "per the legal retention
window" and never says what it is, which makes any archival job unimplementable.
This ruling closes that gap whether or not anything is ever partitioned:

| Class | Tables | Window | Source |
|---|---|---|---|
| Financial and tax | `invoices`, `invoice_lines`, `billing_payment_events`, `usage_ledger_entries`, `subscription_periods`, `subscription_state_transitions` | **10 years** from the end of the fiscal year the record belongs to | ماده ۱۳ قانون تجارت ایران — commercial books and their supporting documents kept at least ten years |
| Security and audit | `audit_events` | **2 years**, then archived, never dropped | operational, not legal — recorded as a choice |
| Never removed | audit events recording a deletion | indefinite | ADR-020 rule 5, verbatim |

**Epistemic status, in the house style ADR-041 and ADR-048 both established:** the
ten-year figure is the commonly cited reading of ماده ۱۳ قانون تجارت and was **not
verified against the primary published text.** Record it with that marker. If you
can verify it from a primary source, do, and say which. Nothing in Parts 1–5
depends on the number.

**And record that no job implements any of this**, and none can until R-025 closes.
These windows are a target for a future archival job, not a behaviour of the
system today. A reader must not be able to mistake a recorded window for an
enforced one.

### Part 7 — What this ruling does not do

- it does not create, alter or partition any table, and writes no migration
- it does not change `001_roles.sql`
- it does not authorise deleting anything ADR-020 excludes from purge
- it does not close R-042, which describes a real property of PostgreSQL and this
  project's grants that remains true whether or not anything is partitioned

---

## Step 3 — Build the tripwire

This is the only code this session writes, and it is what converts Part 3 and
Part 5 from prose into something that cannot be quietly violated.

**A schema check that fails if a partition exists without the precondition.**
Today it matches nothing, so it is free. The day someone writes a partitioning
migration, it fires before the merge.

It must assert, for every relation with `relispartition = true`:

- the relation has `relrowsecurity` **and** `relforcerowsecurity` set on its own
  `pg_class` row (Session 9's Q3 proved these do not inherit)
- a matching row exists in `pg_policies` for it
- `nexora_app` holds **no** direct privilege on it
  (`has_table_privilege` for `SELECT`, `INSERT`, `UPDATE`, `DELETE` all false)

**Where it lives — decide from the code, and state the reason in your report.**
Step 0 asked you to establish whether the harness can mark a rule non-exceptable.

- **If it can**, put it in `tools/conformance/rules/schema-live.ts` — its natural
  home, sharing the connection — marked non-exceptable, and say how the marking
  works.
- **If it cannot**, put it outside the harness as its own script and `npm` script,
  following the `check:register` / `check:graph` / `check:dist-deps` precedent,
  **for the reason those were placed there**: `exceptions.json` is applied
  generically, and an entry silencing this rule would silence a real cross-tenant
  hole rather than a cosmetic violation. `CLAUDE.md`'s standing rule already
  forbids reaching green that way; this places the rule where the rule cannot be
  reached.

**A deliberately failing fixture is mandatory** — this is ADR-030's own standard,
and it is the checkbox Session 9 left half-met. The fixture creates a partitioned
parent and a partition in a throwaway schema, exactly as Session 9's probe did,
proves the check **fails** on it, then applies the Shape B + A remedy and proves
the check **passes**. Drop the schema and prove it is gone. A check that has never
been seen to fail is not evidence of anything.

Wire it into CI wherever the sibling checks are wired.

---

## Step 4 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`**
   - ADR-041: the `### Ruling` above
   - **rewrite the `### Verification` list**, which Session 9 showed is defective.
     Item 3 — *"a cross-tenant read against a partitioned tenant-owned table"* — is
     satisfied by testing the parent alone, which is precisely the test that would
     have missed R-042. It needs a companion item naming **the partition** as the
     target, and a further item requiring that `nexora_app` hold no direct
     privilege on any partition. Keep the old wording visible with a dated note
     saying why it was insufficient; do not silently replace it.
   - tick what is now genuinely met — including the `schema-live.ts` /
     failing-fixture item, **but only if Step 3's fixture actually ran and failed
     first**
   - §1.1 summary table: ADR-041 → `**ACCEPTED (was OPEN)**`, and rewrite its
     `Blocks` cell

2. **`PHASE_2_BRIEF.md`** — a dated amendment to **§5 "Append-only ledgers"**
   carrying Part 3's three rules, since they bind items 4, 5, 9 and 12. §4's table
   list gains no table; say so explicitly.

3. **`04_DATABASE_BLUEPRINT.md` §8** — a dated note only if something in §8 is now
   stale. If nothing is, write nothing and say so.

4. **`RISK_REGISTER.md`**
   - **R-030** — this is the row ADR-041 owns. It now has a ruling; move its status
     to whatever the register's vocabulary makes correct, and state in the addendum
     what was and was not resolved: growth is now **owned and bounded by a stated
     trigger**, and is **not reduced** — nothing is archived and nothing is deleted.
   - **R-042** — a dated addendum: nothing is partitioned, so nothing is exposed;
     its trigger is the first partitioning migration; and it is now **guarded** by
     Step 3's check. It stays open.
   - one new row if Step 3's placement decision, or anything in Step 1, surfaced
     something neither row covers. Do not open a row to be thorough.
   - `npm run check:register` must pass. Escape every `|` inside a cell.

5. **`decisions/2026-09.md`** — one entry: the ruling, that it is a fifth option
   and why, the narrowing of the four-table list, the ten-year figure's unverified
   status, the ADR-023 item 4 collision recorded in Part 3, and where the tripwire
   was placed and why.

6. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is
   factually stale. Do not pad.

---

## Step 5 — Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run conformance
npm run check:register
npm run graph && npm run openapi     # must produce no diff
git status --short
```

Plus: the new check green on the real database, and the fixture transcript showing
it red before the remedy and green after.

One commit, repository style, referencing ADR-041 and R-042.

---

## What to report back

1. Step 1.1's answer — does anything FK to `audit_events`, and how you established it.
2. Where the tripwire went, and **the code that decided it** — the exceptions
   mechanism you read, quoted.
3. The fixture transcript: red, then green.
4. Which of ADR-041's verification boxes you ticked, which you left, and why for
   each one left.
5. Whether Part 3 rule 3's collision with ADR-023 item 4 is real as stated, or
   whether reading item 12's scope changes it.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.**

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a
file against that file. Where it is wrong, **stop and report rather than working
around it.** Session 9 is the precedent: it was told to record a ruling, found the
ruling's premise false, and refused. That was the correct outcome and it is the
standard here.
