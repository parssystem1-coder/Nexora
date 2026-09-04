# SESSION 17 — Phase 2 item 1: the reference slice, `plan.list`

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **This session writes production code and the first Phase 2 migration.**
> **Invoke the `/new-slice` skill. It owns the procedure; this prompt owns only
> what the skill cannot know.**
> **Precondition satisfied on 2026-09-04: session 18 has run**, so this may now
> proceed. Its prompt file is deleted; the rulings it recorded are in
> `COMPETITIVE_RULINGS_2026-09-04.md` and in the normative documents that cite it.
> **Ruling ب-3 is the one that mattered here: item 1's migration is unchanged.**
> Three others bind Phase 2 migrations and are now on the record (ب-4, ب-5, ب-8).

---

## What this session is

The first Phase 2 code, after fourteen sessions of documentation. `PHASE_2_BRIEF.md`
§2 names item 1 the **reference slice** and §3(b) puts it first with a **hand-review
stop** at the end: *"Stop after item 1, request review, do not begin item 2 until
approved."* Honour that literally — this session ends at the stop.

`/new-slice` encodes the pipeline order, module layout, migration and RLS rules and
test layering. **Follow it.** Everything below is slice-specific: the decisions
already ruled that bind this migration, and the one question that must be answered
before the migration is written.

---

## Step 0 — Confirm session 18 has already run

The competitive rulings of 2026-09-04 bind three things in Phase 2 — the quota
resource list, price versions per term length, and the "powered by" flag in item
1's seed. They must be on the record before this slice.

```bash
git log --oneline -12
```

`AUDIT_PROGRAMME_STATE.md` marks session 18 done, and the repository root no
longer holds `COMPETITIVE_RULINGS_2026-09-04.md`. **If session 18 has not run,
stop and report** — two of its rulings change what this slice seeds.

Session 18 also removed the spent working files. **This prompt is the last one
left; delete it in your final commit.**

---

## Step 1 — Four things to establish before writing the migration

**1.1 — The one that is a real decision, and is not yours to take.**

`plan_versions` is described everywhere as **immutable**, and ADR-025 item 6's
version pinning depends on that. But `PHASE_2_BRIEF.md` §5's append-only list —
the tables that get `REVOKE UPDATE, DELETE ON … FROM nexora_app` in their creating
migration — **does not contain it.** Check that; if it does, this item is moot and
say so.

If it does not, then "immutable" is currently enforced by discipline alone, and a
pinned plan version can be altered underneath a live subscription by any code path
that forgets. That is an integrity property the platform's whole billing history
rests on.

**Do not decide it in the slice.** §5's list is `PHASE_2_BRIEF.md`'s to amend —
authority #2 — exactly as ADR-048 could not add a table to §4 and ADR-057 could not
add a capability to §3. **Report the question with your recommendation and stop
before the migration if you believe the answer changes it.** If you judge the
migration is correct either way, say why, and proceed.

**1.2** Read **ADR-052** and confirm what it puts on item 1's creating migration.
Its `Blocks` cell reads *"Phase 2 items 1 and 2 — their creating migrations, because
trial eligibility and duration are plan-version columns and migrations are
forward-only."* **Those columns must be in this migration.** They cannot be added
with values later — `plan_versions` is immutable, which is exactly the backfill test
this programme has applied all week.

**1.3** Read **ADR-044**'s ruling and confirm the rule it puts on this slice: its
`Blocks` cell says *"Phase 2 item 1 (no display column)."* Whatever a plan is called
in the interface does not live in this table.

**1.4** Confirm from **ADR-045**'s ruling that item 1's tables are **not** in its
named four, and therefore get **no `version` column.** Session 12 established that
ADR-045 is a list, not a general rule about mutable tables, and adding a column it
does not require would be a deviation dressed as compliance.

---

## Step 2 — What makes this slice different, and why it is the reference slice

`PHASE_2_BRIEF.md` §2 names three things this proves that `store.read` does not.
Read them there. Two of them create obligations the skill will not raise:

### 2.1 — Pagination becomes the platform contract here, by construction

`AGENTS.md` §2 guarantees that `invoice.list` and every later `*.list` copies
whatever ships here. **Read ADR-036 in full before designing the response shape** —
the collection pagination contract is already ruled, and this slice implements it
rather than inventing it. If ADR-036 and `05` §4.2 disagree about anything, **stop
and report**; ADR precedence settles it but the disagreement itself is worth
recording.

### 2.2 — The first tables with no `tenant_id` and no RLS policy

Every Phase 1 table carried `tenant_id`, `ENABLE`/`FORCE ROW LEVEL SECURITY` and a
policy. These three do not, and `tools/conformance/rules/schema-live.ts` will fail
them unless they are on its `TENANT_EXEMPT` list.

Two obligations, and the second is the one that matters:

1. add them to `TENANT_EXEMPT`
2. **`PHASE_2_BRIEF.md` §5 requires a stated exemption reason** for a
   platform-global table, as `billing_provider_configs`, `scheduled_job_runs`,
   `invoice_number_counter` and `tax_rates` all carry. Write one. *"It has no
   tenant"* is a restatement, not a reason — say what it holds and why every tenant
   may see all of it.

**Adding a name to `TENANT_EXEMPT` is not the same as an `exceptions.json` entry**,
and the difference should be visible in your report: the first is the checker being
told the truth about a table's design, the second is the checker being silenced.
`CLAUDE.md`'s standing rule forbids only the second.

### 2.3 — There is no write path, and that is deliberate

D2-11: no capability creates or edits a plan in Phase 2. This slice reads what a
**seed migration** wrote. Do not add an admin capability, and do not treat the
absence as an oversight — `RISK_REGISTER.md` **R-032** already tracks that
`00_PLATFORM_OVERVIEW.md` §4.2's promise of *"multiple plan tiers, configurable
without a code deployment"* is undelivered and unscheduled. Read that row; if the
seed data you write makes it worse or better, add a dated addendum.

---

## Step 3 — What the seed must contain

The plans are the product. `D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md`
§2 describes the commercial tiers, and **ADR-047** rules price-version binding on
renewal. But **prices are item 2, not item 1** — §2 is explicit that money must not
cross this slice.

So: seed the plan identities, their versions, their features, and ADR-052's trial
columns. **No amounts, no currency, no `MoneyDto`.** If you find yourself needing a
price to make the slice coherent, stop — that is the signal that the item boundary
is being crossed.

**Two obligations that arrived with the 2026-09-04 rulings** — read them where
session 18 recorded them rather than from here:

- **ruling ب-8** — a `plan_features` flag for the "powered by Nexora" mark, present
  on the trial plan and absent on every paid plan. It is seeded here.
- **ruling ب-7** — ADR-052's trial length is now **14 days**, not 7. The trial
  columns this migration creates must carry the ruled value. **Confirm it from
  ADR-052 as amended, not from this prompt.**

---

## Step 4 — Verify, then stop

`/new-slice`'s own Step 7 governs. In addition:

```bash
npm run conformance          # the three new tables must pass, via TENANT_EXEMPT, not exceptions.json
npm run check:register
npm run check:partitions
npm run graph && npm run openapi    # openapi WILL change — a new capability is a new contract
npm run db:migrate           # then re-run conformance against the live schema
```

`exceptions.json` must still be `{}`. If reaching green needed an entry, **that is
the finding — report it and do not commit it.**

**Then stop.** §2's review posture is a hand-review stop, not a suggestion. Do not
begin item 2.

---

## What to report back

1. Step 1.1 — is `plan_versions` on §5's append-only list, and if not, what you
   recommend and whether you judged it changes this migration.
2. The exemption reasons you wrote for the three tables.
3. The pagination shape, and whether ADR-036 and `05` §4.2 agreed.
4. ADR-052's trial columns, as they landed.
5. Whether `exceptions.json` is still empty.
6. What the seed contains, and confirmation that no amount or currency is in it.
7. Files changed, both commit hashes (housekeeping, then slice), and the CI run.
8. **Anything in this prompt that was wrong.** Four of the last six sessions found
   this prompt's author re-ruling something an ADR had already settled, or citing
   the wrong row. Assume the same rate here.

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a file
against that file. Where it is wrong, **stop and report rather than working around
it.**
