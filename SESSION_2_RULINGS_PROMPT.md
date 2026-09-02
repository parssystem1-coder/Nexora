# SESSION 2 — Record the maintainer's rulings on ADR-044, 045, 048, 050

> **سند غیرنرمتیو.** این یک پرامپت اجرایی برای یک سشن Claude Code است، نه یک تصمیم پذیرفته‌شده.
> عمداً در ترتیب خواندنِ `AGENTS.md` §۱ نیست. مرجعِ هر تصمیم، ADR یا ردیف ریسکِ خودش است.

> Model: Opus. `D:\Nexora` connected. **Documentation-only.**
> Runs after the session that created ADR-044…ADR-050. Nothing in this session
> writes a migration, table, module or capability.

The four ADRs left `OPEN` by the previous session have been ruled by the
maintainer on 2026-09-02. This session records those rulings, fixes one defect
found in review, and corrects one contradiction in `04_DATABASE_BLUEPRINT.md`.

**How to record a ruling on an `OPEN` ADR.** Do not rewrite the ADR. Keep its
`### Problem`, its options table and its `### Recommendation` exactly as they
stand — they are the record of what was considered. Change the status line, and
add a `### Ruling` section immediately after `### Recommendation`, naming the
maintainer and the date. Where the ruling differs from the recommendation, say
so plainly in that section rather than editing the recommendation to match.

---

## Step 0 — Read

1. `AGENTS.md`
2. `PHASE_2_BRIEF.md` §4 and §5
3. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — §1.1, and the bodies of **ADR-044,
   ADR-045, ADR-046, ADR-047, ADR-048, ADR-049, ADR-050** (all seven, they
   interlock), plus **ADR-009**, **ADR-020**, **ADR-022**, **ADR-024**,
   **ADR-025**
4. `04_DATABASE_BLUEPRINT.md` §8 (the index list)
5. `DECISION_LOG.md` — template and current month file
6. `RISK_REGISTER.md` — preamble only

Do not read `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011…ADR-018.

---

## Step 1 — Re-verify, then fix one defect before anything else

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -8
grep -c "^| R-0" RISK_REGISTER.md
git status --short
```

Expected: highest ADR **ADR-050**, risk rows **40**. If either differs, stop
and report.

**Then fix this, before writing anything else.** `RISK_REGISTER.md` line 5 — the
dated correction added last session — contains a corrupted path:

```
D:\u0637رح پیشنهادی     ← wrong: the letter ط was written as an escape sequence
D:\طرح پیشنهادی         ← correct
```

Two other occurrences in the same file are correct; only this one is wrong.

```bash
grep -c 'u0637' RISK_REGISTER.md          # expect 1 before, 0 after
```

**Fix it in place, silently, without a dated correction.** This is the one case
where the register's no-rewrite convention does not apply: the text was
corrupted in transcription and never expressed a different claim, so there is
nothing superseded to preserve. Say in your report that you did it and why.

---

## Step 2 — ADR-044: ruled Option A

**Status → `ACCEPTED (new)`, ruled by the maintainer on 2026-09-02.**

**Ruling:** *No display text in the Phase 2 plan tables.* `plans`,
`plan_versions` and `plan_features` carry a stable machine `key` only.
`plan.list` returns keys, not names. Display text is a client-side catalogue
concern, introduced by the phase that first renders it. Option C (a JSONB locale
map) remains the named escape hatch if that phase decides the text belongs in
the database.

**Reasoning to record**, because it is what makes this a ruling rather than a
preference: plan names are marketing copy with a shorter half-life than the
schema, and a typo in a plan name should not be a data edit against a
platform-global table. The product currently has one subscription plan and three
add-ons, so the catalogue is small enough that a client-side mapping costs
nothing.

**And one obligation this ruling creates, which must be stated in the ADR
because it is the reason the ruling is safe:**

> An invoice line must carry its own denormalized description text, captured at
> issuance. `invoices` and `invoice_lines` are append-only (`PHASE_2_BRIEF.md`
> §5) and are read as financial records years later; a line that resolves only
> to `plan_key` is not a readable record, and an invoice must not change its
> wording when a plan is renamed. **This is a requirement on Phase 2 item 13,
> not a reopening of this ADR.** State it in `### What this ADR does not do`
> or in the ruling, and cross-reference ADR-048.

Note in the ADR that the maintainer's own commercial document
(`D:\طرح پیشنهادی\12_…` §2, §6) was the concrete catalogue weighed when ruling.

---

## Step 3 — ADR-045: ruled Tier 1 with one exclusion

**Status → `ACCEPTED (new)`, ruled by the maintainer on 2026-09-02.**

**Ruling, table by table:**

| Table | `version integer NOT NULL DEFAULT 0` | Why |
|---|---|---|
| `subscriptions` | **yes** | renewal job, cancel, change and reactivate all write it |
| `subscription_changes` | **yes** | ADR-025 item 5's own design: the tenant may revoke a pending change while a scheduled job applies it |
| `billing_payment_intents` | **yes** | the verify callback and the reconciliation sweep both write status |
| `tenant_over_limit_states` | **yes** | the usage recorder and the over-limit evaluator both write it |
| `idempotency_records` | **no** | see below |
| Tier 2 (the six with no second Phase 2 writer) | **no** | see below |

**`idempotency_records` is excluded, and the reason must be in the ADR.**
ADR-009's `UNIQUE (tenant_id, capability, idempotency_key)` plus the
claim-inside-the-transaction rule already serialises every writer of a given
row: a second claimant cannot read-modify-write, it collides on the constraint.
A `version` column there would be a field nothing needs — the same defect the
ADR's own recommendation warns against for append-only tables, in a different
shape. **If a future slice adds a writer that mutates a claimed record outside
the claiming transaction, that slice reopens this line.**

**Tier 2 gets no column now**, on ADR-046's logic applied to columns: a field is
added in the same slice that adds its enforcement, never ahead of it. **Name the
reopening trigger explicitly**: the first slice that gives a Tier 2 table a
second writer. List the six tables by name in the ruling so the trigger is
checkable rather than rhetorical.

**Record the interaction with ADR-048 as resolved, not open.** The tension the
ADR names — gap-free numbering versus optimistic-concurrency retry — does not
bite here, because `invoices` is append-only and never carries a `version`
column at all, and because ADR-048's counter is locked pessimistically inside
the issuing transaction rather than retried optimistically. The two mechanisms
do not meet.

**Do not claim this closes R-008 or R-036.** Keep that statement exactly as the
previous session wrote it.

---

## Step 4 — ADR-048: ruled global, gap-free, allocated at commit

**Status → `ACCEPTED (new)`, ruled by the maintainer on 2026-09-02.**

**Ruling, in four parts:**

1. **Global, not per-tenant.** The issuer of these invoices is one legal
   entity — the platform. One invoice book, not one per subscriber. A per-tenant
   series would produce hundreds of parallel books for a single seller, which is
   wrong for the seller's own accounting and for reconciliation.

2. **Gap-free.** The number is allocated from a dedicated single-row counter
   locked `SELECT … FOR UPDATE` **inside the same transaction that inserts the
   invoice**, so a number is consumed only if that insert commits. A rolled-back
   transaction consumes nothing.

   **Why the usual objection does not apply here, and this belongs in the ADR:**
   gap-free numbering costs serialised issuance. The platform issues on the
   order of thousands of invoices per year, not thousands per minute, so
   contention on that counter row is not a real cost at any volume this platform
   is designed for. **Record the volume assumption explicitly as the reason** —
   if issuance ever becomes high-frequency, that assumption is the thing that
   changed, and a reader should be able to find it.

3. **Store the integer; render the display form.** The stored value is the
   sequence integer. A human-readable form such as `NX-1405-000123` is composed
   in the interface layer. This is ADR-022 item 4's own principle — *display is
   not storage* — applied to identifiers, and it means a later change to the
   rendered format is not a schema change and does not break the continuity of
   the series.

4. **The Iranian tax unique number is a separate field and must never be
   conflated with this one.** Verified 2026-09-02 against public documentation of
   سامانه مودیان: the شماره منحصر به فرد مالیاتی is a fixed 22-character
   identifier — a 6-character tax-memory-device id, a 5-character hexadecimal
   registration date, a **10-character hexadecimal internal serial scoped to that
   memory device**, and a Verhoeff check digit — generated by the taxpayer's own
   terminal at the moment of registration with the tax system, not at invoice
   creation. It is therefore a different value on a different clock with a
   different scope. **Record this as an unverified-against-primary-source claim**
   in the house style: it was read from vendor documentation, not from the Iranian
   Tax Administration's own specification, and the ADR should say so.

   The ADR must state which it does: either reserve a nullable column for it on
   `invoices` now, or defer it with a named trigger (the slice that integrates
   with سامانه مودیان). **Recommend deferral with a named trigger** — nothing in
   Phase 2 registers an invoice with the tax system, and a nullable column
   nothing sets is the defect ADR-046 was ruled to avoid.

**Cross-reference ADR-044's invoice-line requirement** (Step 2): the line
description and the invoice number are both things an append-only financial
record must carry on its own.

---

## Step 5 — ADR-050: ruled a separate delivery table

**Status → `ACCEPTED (new)`, ruled by the maintainer on 2026-09-02.**

**Ruling, in three parts:**

1. **Delivery state lives in a separate table, not in `outbox_events`.** No
   column-level exception to `REVOKE UPDATE, DELETE` is granted. Three reasons,
   all of which belong in the ADR:
   - `outbox_events` stays genuinely immutable, which is the entire point of
     putting it on §5's list.
   - Delivery attempts are naturally append-only in their own right — one row
     per attempt — so the shape that keeps the ledger clean also produces a
     retry audit trail for free, rather than overwriting the previous attempt's
     outcome.
   - It removes the need to verify the interaction the previous session flagged
     as unverified: a column-level `UPDATE` grant on a tenant-owned table under
     `FORCE ROW LEVEL SECURITY`. **The ruling does not resolve that interaction —
     it makes it unnecessary.** Say that precisely; do not claim it was verified.

2. **The event packet carries a version from day one.** The envelope is
   `event_id`, `event_type`, `event_version`, `tenant_id`, `occurred_at`,
   `payload`, `correlation_id`. Any monetary value inside `payload` is a
   `MoneyDto` with its currency, never a bare number (ADR-022 item 7).
   **`event_version` is the part that cannot be retrofitted** — a consumer that
   has already parsed unversioned events cannot be told later which shape it
   was reading. It costs one field now.

3. **Every external integration consumes through this path only** — accounting,
   webhooks, analytics — never by reading domain tables directly. Record that
   `webhook_endpoints` and `webhook_deliveries` have **no owning phase**, and
   that assigning one is a `PHASE_2_BRIEF.md` scope decision, not this ADR's.

**The exact table name and columns of the delivery table are not decided here.**
That is item 14's design work. This ADR decides only that delivery state does
not live in `outbox_events`.

---

## Step 6 — Correct the contradiction in `04_DATABASE_BLUEPRINT.md` §8

The previous session found and documented, but did not fix, a real
contradiction. `04_DATABASE_BLUEPRINT.md` §8 lists:

```
outbox_events (dispatched_at) where dispatched_at is null
```

A partial index on a column that is set on dispatch presumes an in-place
`UPDATE`, while `PHASE_2_BRIEF.md` §5 requires `REVOKE UPDATE, DELETE ON
outbox_events`. Individually reasonable, jointly unimplementable.

**ADR-050's ruling resolves it:** the index belongs on the delivery table, not
on `outbox_events`.

**This is an edit to an existing blueprint document, so make it visibly.** Use a
dated correction in `04`'s own style — the superseded line kept and struck
through, the replacement and its reason above it, citing ADR-050. Do **not**
silently swap the line. If `04` has no precedent for a dated correction, say so
in your report and record the change in `09_CHANGELOG_AND_CORRECTIONS.md`
instead, whichever the file's own conventions support.

**Do not invent the replacement index's exact shape** — the delivery table does
not exist and its columns are item 14's work. The correction states that the
index moves, and names ADR-050 as where it moved to.

---

## Step 7 — Summaries

**`CLAUDE.md` "Current state"** — ADR statuses change: **ACCEPTED 38 → 42,
OPEN 7 → 3**, total unchanged at **53**. The three that remain OPEN are ADR-039
(pool sizing), ADR-040 (observability) and ADR-041 (ledger growth) — the same
three that were open before this programme began. **Say that plainly**: it is
the clearest statement available that the schema-shaping work is finished and
what remains is operational.

Keep the dates inside the sentences. Demote the superseded count line rather
than deleting it, as the file already does.

**`decisions/2026-09.md`** — one entry, newest at top, four-field template. It
must record:

- the four rulings and, for each, **whether it followed the recommendation or
  departed from it** — ADR-044, ADR-045 and ADR-050 followed; ADR-048 was ruled
  where the previous session declined to recommend, because the deciding input
  (Iranian invoice-numbering practice) was outside the repository and was
  researched externally on 2026-09-02
- the volume assumption behind ADR-048's gap-free ruling, named as an assumption
- that the tax-number facts came from vendor documentation, not a primary
  source, and are labelled as such in the ADR
- the corrupted-path fix and why it was silent rather than a dated correction
- the `04` §8 correction

Honest `Status`: **RESOLVED** — four decisions were ruled, none left open.

---

## Step 8 — Verify

```bash
npm run graph
npm run format:check && npm run lint && npm run conformance
git diff --stat
```

```bash
grep -c 'u0637' RISK_REGISTER.md                                 # expect 0
grep -c "^| ADR-0(4[4-9]|50)" 02_ADR_INDEX_NORMATIVE_DECISIONS.md 2>/dev/null || \
  grep -cE "^\| ADR-0(4[4-9]|50) " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 7
grep -cE "^## ADR-0(4[4-9]|50) " 02_ADR_INDEX_NORMATIVE_DECISIONS.md     # expect 7
grep -c "^| R-0" RISK_REGISTER.md                                        # expect 40
```

Then confirm against `PROJECT_GRAPH.md`'s own status tally, not your arithmetic:
**53 ADRs, 42 accepted.**

`PROJECT_GRAPH.md` is generated — never hand-edit it. `npm run typecheck`,
`npm test` and `npm run db:migrate` are not required: no code or migration
changed.

**Do not chase the red CI** on `membership-revoke` — R-008/R-036, intermittent
and pre-existing.

---

## Step 9 — Report

- what you wrote, file by file
- **any ruling in this prompt that contradicts something in the repository** —
  say so and stop rather than writing it; a ruling built on a wrong premise is
  worse than an open question
- whether `04`'s conventions supported a dated correction, and what you did
- before/after counts, confirmed against `PROJECT_GRAPH.md`
- what remains owed: the three operational ADRs, and round 2's scope decisions
  (discounts and referral, tenant-granular backup, accounting integration)

---

## Hard boundaries

- No migration, no table, no module, no capability. **This session still writes
  no code**, even though it rules on column shapes.
- Do not rewrite an ADR's `Problem`, options or `Recommendation` to match its
  ruling. Add the ruling; leave the record of what was considered intact.
- No `exceptions.json` entry, no weakened conformance rule.
- No reading of `future/`.
- **Do not open discounts, referral codes, backup design, or accounting
  integration.** Those are round 2 — a scope decision belonging to
  `PHASE_2_BRIEF.md`, not to an ADR.
- If a ruling here cannot be recorded without contradicting an accepted
  decision: **stop and write the conflict down with options.** Do not reconcile
  it silently.
