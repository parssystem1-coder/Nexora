# SESSION 12 — Two shapes `invoices` cannot gain later: the correction document, and the buyer's legal identity

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **Documentation only — no migration, no table, no feature code.**
> **`/new-slice` does not apply and must not be invoked.**

---

## The rule that decides both of these, stated once

`PHASE_2_BRIEF.md` §5 revokes `UPDATE` and `DELETE` on `invoices` from
`nexora_app`. A column can still be **added** to that table by a later migration —
what can never happen is filling it in for rows that already exist.

> **A column must exist at table creation if old rows would need a real value in
> it. A column may wait if old rows are legitimately empty.**

Both rulings below are that test applied twice, and the test itself belongs in the
ADRs, because it is what a later reader needs in order to judge the next column
someone proposes.

| Column | Verdict | Why |
|---|---|---|
| `document_type` | **now** | every existing row would need `INVOICE` backfilled |
| the buyer's identity snapshot | **now** | every existing row would need real values |
| `corrects_invoice_id` | **later** | legitimately empty on every invoice that corrects nothing |

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-048 in full including all five
   parts of its `### Ruling` and its `### What this ADR does not do`**;
   **ADR-055** (recorded last session); **ADR-022**'s amendment; **ADR-020**
   (rules 4 and 5 verbatim); **ADR-044**; **ADR-045**; **ADR-046** (its ruling);
   **ADR-042**; **ADR-052**
3. `PHASE_2_BRIEF.md` — **§3 (the capability-to-item mapping, in full — Step 2
   part 6 depends on it)**, **§4 with all dated amendments**, **§5 "Append-only
   ledgers", "Money", "Permissions", "Tenancy and RLS"**
4. `04_DATABASE_BLUEPRINT.md` §2.5
5. `05_API_CAPABILITY_CONTRACTS.md` §4.2 and §7
6. `RISK_REGISTER.md` — **R-043** (opened last session), and grep for any row about
   buyer identity, PII, or personal data
7. `modules/money/` — enough to know what already exists, since last session found
   far more there than expected

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — Establish two things first

**1.1** Confirm from the file which ADR numbers and which risk-register row ids are
free. This prompt assumes **ADR-056**, **ADR-057** and **R-044**; verify rather
than trust it.

**1.2** Read `PHASE_2_BRIEF.md` §3's capability list and answer: **is there any
capability in Phase 2 that could collect a tenant's legal billing identity?**
Step 2's second ruling turns on this, and the answer decides whether the ruling
creates a scope obligation or not. Report the list you checked against.

---

## Step 2 — Record ADR-056: correction documents

ADR-048 ruled invoice numbering and said, in its own words, that
*"It does not rule on credit notes, voiding of issued invoices, or refund
documents."* That gap is now closed, because the part of it that cannot wait is a
column on an append-only table.

### Part 1 — A correction is a row in `invoices`, discriminated by type

`invoices` carries `document_type`, `NOT NULL`, values `INVOICE` and
`CREDIT_NOTE`. **Phase 2 issues only `INVOICE`.**

**Answer the ADR-046 objection inside the ADR, because a reviewer will raise it
and they will be right to.** ADR-046 refused to reserve `deleted_at` on twenty
tables on the ground that a nullable column set by nothing is a permanent
obligation on every reader for a capability no item delivers. `document_type` is
not that: it is `NOT NULL`, every Phase 2 row sets it to a true value, and every
reader that ignores it still reads a correct invoice. It is a **discriminator**,
not a reservation. State that distinction — it is the line between this ruling and
ADR-046's, and without it the two look contradictory.

### Part 2 — One number series, not two. The counter does not change.

ADR-048 part 1 ruled a **global** sequence, and gave a reason that decides this
question too: *"the issuer of these invoices is one legal entity — the platform —
and a seller keeps one invoice book."* A credit note is issued by that same seller,
into that same book. So it takes the next number from the same counter, and
`invoice_number_counter` stays exactly as ADR-048 ruled it: a single row, locked
`SELECT … FOR UPDATE` inside the issuing transaction, gap-free.

**Record the alternative that was rejected and its reopening trigger:** a separate
series per document type is the conventional accounting shape, and if a two-way
accounting integration or a tax filing ever requires one, that is a change to the
numbering scheme — at which point ADR-048's own section *"Why this blocks any
two-way accounting integration"* applies in full.

### Part 3 — Amounts are always positive. The document type carries the sign.

A credit note stores positive amounts and means the opposite by being a credit
note. The reason to record: ADR-022 item 5 requires a remainder-distributing
allocator whose *"sum of parts equals the whole exactly"*, and negative amounts
make every aggregate in the system ambiguous about whether it has already applied
a sign. One rule in one place beats a sign convention every report must remember.

### Part 4 — Tax on a correction follows the invoice it corrects

ADR-055 deferred this here explicitly. Rule it:

> A credit note carries the same four tax columns ADR-055 put on `invoices`, and
> snapshots **the rate of the invoice it corrects** — not the rate in effect on
> the day the correction is issued.

The reason, which is not obvious and is exactly the kind of thing that gets got
wrong: a correction must reverse **the arithmetic that actually happened**. A
credit note issued after a rate change, carrying the new rate, would reverse an
amount that was never charged.

### Part 5 — Voiding an issued invoice is not a thing this platform can do

`PHASE_2_BRIEF.md` §5 revokes `UPDATE` and `DELETE` on `invoices` from
`nexora_app`, so an issued invoice cannot be voided in place by the application at
all. **The correction path is therefore a new document, necessarily** — and that
is a consequence of an existing rule, not a new choice. Say it that way.

### Part 6 — What this does not do

- **no credit note is issuable in Phase 2.** No capability, no service, no
  endpoint. Only the shape is settled. Name the trigger: the slice that gives
  `billing_refunds` a capability.
- `corrects_invoice_id` is **not** added now — the test at the top of this prompt
  puts it in the "later" column, and it arrives with the slice that issues the
  first credit note, together with whatever else that slice needs.
- it does not touch ADR-048's ruling. Add **one dated cross-reference line** to
  ADR-048 pointing here, and no more.
- nothing is registered with سامانه مودیان (R-043).

---

## Step 3 — Record ADR-057: the buyer's legal identity on the invoice

### Part 1 — Why this cannot be a later column

Two independent reasons, and the ADR should carry both:

1. **ADR-044's principle, which ADR-048 already applied to invoices:** an
   append-only financial record must be readable on its own years later and must
   not change when something it points at is renamed. Who the invoice was issued
   *to* is part of what the invoice *is*. A foreign key to a mutable profile is
   not a substitute — the profile changes, the invoice must not.
2. **R-043, opened last session.** An invoice registered with سامانه مودیان
   carries the buyer's legal identity. Every invoice this platform issues without
   one is **permanently unregisterable**, because the row cannot be updated. This
   does not close R-043 — it removes one of its blockers, and the ADR should say
   exactly that much and no more.

### Part 2 — A mutable profile, and an immutable snapshot

**One new tenant-owned table** holding the tenant's legal billing identity,
mutable, with a `version` column per ADR-045 (it is a mutable Phase 2 row, so
ADR-045 applies by its own terms — confirm that from ADR-045 rather than taking it
from here). It carries at least:

- legal type: natural person or legal entity (حقیقی / حقوقی)
- legal name
- the national identifier — **کد ملی** for a natural person, **شناسه ملی** for a
  legal entity. One column, with the type discriminating. **Note in the ADR that
  these are different identifiers with different check-digit algorithms**, so that
  nobody validates one with the other's rule. The algorithms themselves are domain
  validation and belong to the implementing slice, not to this ADR.
- economic code (کد اقتصادی) — genuinely nullable: it applies to legal entities and
  not to every one of them
- registration number — nullable, legal entities only
- postal code, address, phone

`invoices` gains **explicit snapshot columns**, not a single JSON blob. The reason
to record: an append-only financial record wants a fixed, inspectable shape that a
schema check and a human reader can both see. A JSON column's advantage is that it
can change without a migration, which is precisely the wrong property here.

### Part 3 — No invoice without a profile

An invoice is a legal document addressed to somebody. **Issuing one to an
unidentified buyer is not a degraded mode, it is an invalid document**, so:

> A subscription purchase cannot reach the gateway without a billing profile.

Which means the buyer supplies it **before** the redirect ADR-023 item 2
describes — alongside ADR-055's requirement that the tax breakdown be shown before
the redirect. Two things now happen at that step; the ADR should say so in one
place rather than leaving item 12's implementer to discover them separately.

Note the one case that does not hit this: **ADR-052's trial issues no invoice**, so
a trial can begin without a profile. Confirm that from ADR-052 and say so — it is
the first question anyone will ask.

### Part 4 — The scope obligation this creates, and where it must be discharged

Something has to collect this data, and **Phase 2's capability list is a wall.**
`PHASE_2_BRIEF.md` §4 says of its table list that it is *"the wall, not a
suggestion"*, and §3's capability mapping has the same standing.

Step 1.2 established whether any existing capability can own this.

- **If one can**, say which, and record it in the ADR.
- **If none can**, then this ruling owes Phase 2 a capability, and **an ADR may not
  add one.** Follow the precedent ADR-048 set exactly: ADR-048 required a table
  §4's list did not contain, declined to add it on the ground that *"amending this
  list is a scope decision belonging to this file — `AGENTS.md` §1 authority #2 —
  and not to an ADR"*, and the amendment to `PHASE_2_BRIEF.md` was made as the
  other half of the same change. Do that here: the ADR states the obligation, and
  the brief's amendment discharges it, in this commit.

### Part 5 — The purge interaction, which is a real tension and not a footnote

The profile is tenant-owned data and falls under ADR-020's purge. The invoice
snapshot does not — ADR-020 rule 4 excludes financial records from purge **and**
requires in the same sentence that they be *"reduced to the minimum fields
required."*

So on tenant deletion: the profile goes, the snapshot stays, **reduced**. The ADR
must say which fields survive that reduction and which do not, because "minimum
fields required" is not self-executing and whoever implements the purge will
otherwise decide it alone. Propose the split, and mark it as a proposal if you are
not certain what the legal minimum is — the epistemic-status convention ADR-041 and
ADR-048 established applies.

### Part 6 — What this does not do

- **the seller's own identity** — the platform's registration details, which a
  صورتحساب also carries — is **not** ruled here. Name the trigger (the سامانه
  مودیان slice, where it becomes a submitted field) so the gap is visibly owned
  rather than missed.
- no validation algorithm is specified
- nothing is registered with any tax authority
- R-043 is **not** closed; add a dated addendum to it saying which of its blockers
  this removes and which remain

---

## Step 4 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda,
following the `### Amendment, <date> — <what>` convention already in these files.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`** — ADR-056 and ADR-057; the one-line
   dated cross-reference in ADR-048; §1.1 rows for both, with honest `Blocks`
   cells naming item 13 and its creating migration.
2. **`PHASE_2_BRIEF.md`** — a dated amendment: §4 gains the profile table
   (**30 → 31**) with its item and tenancy; §5 gains the `document_type` rule, the
   snapshot-columns rule and the no-invoice-without-a-profile rule; **and §3 gains
   a capability if Step 1.2 showed none exists.**
3. **`04_DATABASE_BLUEPRINT.md`** — a dated note only if something is now stale.
   Last session found nothing was; check again and **say so either way**.
4. **`RISK_REGISTER.md`** — a dated addendum to **R-043**. Open a new row only if
   the purge/PII tension in Part 5 is a risk no existing row covers — judge it,
   and do not open one to look thorough. `npm run check:register` must pass;
   escape every `|` inside a cell.
5. **`decisions/2026-09.md`** — one entry: both rulings, the one-series choice and
   the alternative rejected, the correction-follows-the-original tax rule, and
   whether a capability had to be added to §3.
6. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is stale.

---

## Step 5 — Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run conformance
npm run check:register
npm run check:partitions
npm run graph && npm run openapi     # must produce no diff
git status --short
```

One commit, repository style, referencing ADR-056, ADR-057 and R-043.

---

## What to report back

1. Step 1.2's answer — could an existing capability collect the billing profile,
   and which list you checked.
2. Whether ADR-045 applies to the profile table **by its own terms**, quoted, or
   only because this prompt said so.
3. Your Part 5 split — which snapshot fields survive ADR-020 rule 4's reduction —
   and how confident you are in it.
4. Whether ADR-052 really exempts trials from needing a profile, quoted.
5. Files changed and the commit hash.
6. **Anything in this prompt that was wrong.**

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a
file against that file. Where it is wrong, **stop and report rather than working
around it.** Every session in this programme so far has found at least one false
premise here, and each catch was worth more than the work it interrupted.
