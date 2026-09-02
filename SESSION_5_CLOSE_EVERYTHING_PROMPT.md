# SESSION 5 — Close every open thread: three risk rows, three rulings, one phase amendment

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected. **Documentation-only.**
> No migration, no table, no module, no capability, no guard change.

Everything left half-finished gets an owner in this session. Nothing here is
deferred with a vague trigger — every item either gets a ruling or gets a named
phase.

**This is a long session. Part A and Part B are independent.** If you are running
long, finish Part A completely, report it, and stop — do not start Part B
half-way. Part A is the blocking half.

**Two rulings were taken by the maintainer on 2026-09-03 and are inputs, not
questions:**

1. **The 7-day trial is self-serve.** Anyone who signs up gets it automatically.
   No operator action.
2. **ADR-051 is ruled Option B** — `401 SESSION_INVALIDATED`.

---

## Step 0 — Read

1. `AGENTS.md`
2. `PHASE_2_BRIEF.md` — §3, §4, §5 and **§7's disposition table**
3. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — §1.1, and the bodies of **ADR-020**,
   **ADR-024**, **ADR-025**, **ADR-029**, **ADR-034**, **ADR-042**, **ADR-043**,
   **ADR-044**, **ADR-046**, **ADR-047**, **ADR-050**, **ADR-051**
4. `RISK_REGISTER.md` — preamble and rows **R-036, R-037, R-038, R-039, R-040**
   only
5. `05_API_CAPABILITY_CONTRACTS.md` §4.2 and §7
6. `DECISION_LOG.md` and `decisions/2026-09.md`
7. `D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md`
   §2 and §6 — the commercial model these decisions serve

Do not read `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011…ADR-018.

Verify first:

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -3
grep -c "^| R-0" RISK_REGISTER.md
npm run check:register
git status --short
```

Expected: highest ADR **ADR-051**, **40** register rows, register check green,
clean tree. **If any differs, stop and report.**

---

# PART A — Three rulings and three risk rows

## A1 — Rule ADR-051

Status → **`ACCEPTED (was OPEN)`**, ruled by the maintainer on 2026-09-03.

**Ruling: Option B.** A membership revoked while a request from that session is
already in flight surfaces as **`SESSION_INVALIDATED` / 401**.

Keep the `### Problem`, the options table and the `### Recommendation` exactly as
written. Add `### Ruling` after the recommendation.

The ruling section must state three things precisely:

- **The scope limit.** 401 applies when the caller's **own session** was
  revoked. A caller who is still authenticated but has merely lost membership in
  this organization stays **403**. Ruling B does not make 403 obsolete.
- **What is not decided.** The guard changes B implies — distinguishing *"no such
  session"* from *"a session existed and was revoked"* — are ADR-029's territory
  and production code in a later slice. **This ADR implements nothing.**
- **Option C's disqualification, corrected.** The third code actually thrown is
  **`CONFLICT`**, not `CONCURRENCY_CONFLICT` (`revoke-membership.service.ts:96`).
  `05` §7 rules normatively that `CONCURRENCY_CONFLICT` is RETRYABLE while
  `CONFLICT` is permanent, and that *"a client must not treat the two the same
  way."* Normalizing onto `CONCURRENCY_CONFLICT` would therefore **contradict an
  accepted contract**, not merely be unconventional. If the ADR body still frames
  Option C as `CONCURRENCY_CONFLICT` from the drafting session, correct it and
  say you did.

Then update **R-036** and **R-008**, and **R-037** (ADR-051 gives its orphaned
code a producer).

## A2 — ADR-052, self-serve trial

New ADR. Status **`ACCEPTED (new)`**, ruled by the maintainer on 2026-09-03.

**This is blocking.** The maintainer ruled the trial self-serve, which means
trial eligibility and duration are **plan-version data** — a column in the
migration that Phase 2 item 1 and item 2 create. Under forward-only migrations
(ADR-021 item 8) this must be settled before those migrations merge. **Say so in
the ADR's `Blocks` field.**

What already exists and must not be re-invented — verify each before citing:

- `TRIALING` is a legal state in ADR-024 item 3, and `TRIALING → ACTIVE |
  EXPIRED | CANCELED` are the only legal transitions.
- `TRIALING` is a **SERVING** state (ADR-024 item 2).
- `trial.expire` is already a required scheduled job (ADR-024 item 8).
- An unconverted trial goes to `EXPIRED`, not into grace — `PHASE_2_BRIEF.md`'s
  lifecycle matrix already says grace is entered only from `PAST_DUE`.

**What this ADR must decide, and the ruling for each:**

| Question | Ruling |
|---|---|
| Where trial eligibility and duration live | On the **plan version**, not the subscription — a trial is a property of what is offered, and pinning it to the version keeps a later change from retroactively altering existing trials. The default is **7 days**, matching the commercial model. |
| What starts a trial | **`plan.subscribe`**, with no payment required — not a separate capability. A trial is a subscription in `TRIALING`, and ADR-024's state machine already models it. A second entry capability would be a second mechanism for one thing. |
| One trial per what | **One per organization**, enforced by a database constraint, not by application logic. |
| Whether a payment method is required up front | **No.** Requiring one converts a zero-friction acquisition offer into a paid signup with a delay, which is not what the commercial model offers. |

**Record the abuse surface honestly rather than pretending it is closed.**
One-trial-per-organization does not stop a determined abuser from creating a
second organization. That is true of essentially every self-serve trial and the
mitigation is detection, not prevention. **Accept it explicitly, name the
trigger that would reopen it** (evidence of real repeat-signup abuse), and do
**not** invent a fraud-scoring mechanism here — that is Pillar 4 territory and
belongs to no current phase.

`### What this ADR does not do`: it does not build the capability, does not
write the migration, does not design abuse detection, and does not touch
ADR-024's state machine — which already models everything it needs.

Then close out **R-040**.

## A3 — ADR-053, session retention

New ADR. Status **`ACCEPTED (new)`**, ruled 2026-09-03.

R-039 records four sub-questions. Answer all four:

| Question | Ruling |
|---|---|
| How long a session row is kept after it stops being usable | **30 days** past the moment it becomes unusable. Long enough for an incident to be investigated, short enough to bound growth. |
| Whether revoked and expired sessions purge on the same clock | **Yes, one clock.** Two clocks would be two policies to keep correct, for no stated benefit. |
| Whether the purge is audited | **The job's run is recorded, not each deleted row.** `audit_events` is append-only and never purged (ADR-020 rule 5) — writing one audit row per deleted session would make the audit table grow faster than the table being purged, which is the opposite of the point. |
| What runs it | The scheduled-job mechanism created by **Phase 2 item 12** (`scheduled_job_runs`). **No Phase 2 item currently schedules this job** — state that plainly and name it as owed to item 12. |

Two facts the ADR must carry, both verified before writing:

- `sessions` has **no `tenant_id` and no RLS** — structural, not an oversight: a
  session is resolved before tenant context exists. **A purge job therefore runs
  outside tenant context and cannot rely on RLS to scope it.** That shapes how
  the job must be written.
- `sessions` is **not** in ADR-041's scope. ADR-041 owns ledger and audit growth
  and explicitly excludes those rows from purge. This is a distinct question and
  must not be folded into it.

Then close out **R-039**.

## A4 — R-038, and two accepted obligations that have no owner

R-038 records that ADR-020 rule 6's tenant-export capability and rule 7's
tenant-facing retention documentation are **accepted requirements with no owning
phase.** Give them owners.

**Ruling:** both go to **Phase 2.5** (created in Part B). Record in R-038:

- **Restore posture:** per-tenant logical export taken **before** the destructive
  phase of a deletion, retained for the reversible window. This is the mechanism
  ADR-020 rule 6 already requires as a capability; it is being given a phase, not
  invented.
- **The constraint that shapes it, already recorded and to be kept:** ledger-shaped
  tables carry `REVOKE UPDATE, DELETE FROM nexora_app`, so the application role
  cannot delete a ledger row. Restoring one tenant is therefore **a restore for
  mutable state and a compensating entry for ledgers**, and it runs outside the
  application under a different role — which changes who may run it and how it is
  audited.
- **Rule 7's documentation** is owed to whichever tenant-facing document Phase 2.5
  produces; name it as owed rather than inventing a location.

**Do not write an ADR for this.** ADR-020 already decided it; what was missing
was a phase, and phases live in the brief.

## A5 — Status words, chosen deliberately

R-036, R-038, R-039 and R-040 all change. **The register's status vocabulary is
load-bearing** — its preamble defines each word, and R-003's own
`RESOLVED → ACCEPTED` correction exists because the wrong word misled a gate
review.

For each row, choose between `OPEN`, `PARTIALLY CLOSED`, `RESOLVED`, `ACCEPTED`
and `CLOSED` **and justify the choice in one sentence in the row itself.**

Think hard before writing `RESOLVED`: a contract that is now *decided* but not
yet *implemented* has not eliminated the underlying risk. The register's own
definition says `RESOLVED` means eliminated, "not merely deferred or accepted."
`PARTIALLY CLOSED` exists precisely for "a mitigation shipped and works for a
stated set of conditions" — read the definitions before choosing, and do not
default to the most satisfying word.

**Re-run `npm run check:register` after every register edit.**

---

# PART B — The phase-scope amendment

Everything here is a change to `PHASE_2_BRIEF.md`, which is `AGENTS.md` §1
authority #2. **Make it as a dated amendment**, in the file's own style, never as
a silent edit. If the brief has no precedent for a dated amendment, say so and
establish one visibly, the way `04_DATABASE_BLUEPRINT.md` did on 2026-09-02.

## B1 — Two tables owed to Phase 2's own scope list

ADR-048's and ADR-050's rulings each require a table that §4's 27-table list —
*"the wall, not a suggestion"* — does not contain. Both were left owed
deliberately, because amending the brief is a scope decision an ADR may not make.

Add them:

| Table | For | Item | Tenancy |
|---|---|---|---|
| the invoice-number counter | ADR-048's gap-free allocation | 13 | **platform-global** |
| the outbox delivery table | ADR-050's delivery state | 14 | tenant-owned |

**The counter is platform-global, so §5 owes it a stated RLS-exemption reason**,
alongside `billing_provider_configs` and `scheduled_job_runs`. The reason is that
the invoice series belongs to the platform as issuer, not to any tenant — one
seller, one book. Write it in §5's own voice.

**Do not invent either table's columns.** The counter's shape is item 13's design
work and the delivery table's is item 14's. The amendment adds them to the scope
list and states what each is for; nothing more.

The 27-table count in §4's own prose becomes **29**. Search the brief for every
place that number is restated and update all of them — `npm run check:register`
does not cover this file, so do it by grep and say how many you found.

## B2 — Create Phase 2.5

A new phase, recorded in `PHASE_2_BRIEF.md` as an amendment and — if
`06_IMPLEMENTATION_PLAN.md` is where phases are enumerated — there too. **Read
both before deciding where it belongs**, and if the two disagree, report the
disagreement rather than picking.

**Scope of Phase 2.5, as ruled:**

1. **Subscription discounts** — both bulk (all subscribers of a plan) and
   individual (one named subscriber).
2. **Referral codes** — a subscriber's code, attribution of who referred whom,
   credit that accumulates with the number of successful referrals, applied to
   the referrer's next period.
3. **Tenant data export** — ADR-020 rule 6's capability, with its own quota, per
   A4.

**Order inside the phase is fixed and not a preference:** discounts first,
referral second. The referral reward is paid *as a discount*, so referral cannot
be designed before the discount model exists.

**What Phase 2.5 explicitly excludes**, stated so the phase has a wall of its
own the way Phase 2 does: no fraud scoring, no marketplace or split payments, no
commerce coupons (those are the merchant's own coupons for their shoppers —
`04` §3, Phase 3, a different subject entirely), no AI credit economy.

**The deadline, and why it exists:** the discount decision must land **before
Phase 2 item 13's migration**, because `invoices` and `invoice_lines` are
append-only and adding a discount line to them afterwards is a data migration.
State this in the amendment as the reason Phase 2.5 is defined now rather than
when it is built.

**Do not design the discount or referral model here.** This amendment defines
scope — which tables and capabilities belong to the phase — and nothing else.
The design is a later session, and it must not be started in this one.

---

## Step 3 — Summaries

**`CLAUDE.md`** — ADRs **54 → 56** (ACCEPTED **42 → 45**, OPEN stays **3**,
DEFERRED **8**). Risk rows stay **40**; their *statuses* change, so update the
roll-call line's count of what is not OPEN. Name the new entries. Keep the dates
inside the sentences. If Part B lands, note Phase 2.5's creation.

**`decisions/2026-09.md`** — one entry, newest at top, four-field template,
recording:

- the two maintainer rulings of 2026-09-03 and that they were rulings, not
  inferences
- **the status word chosen for each of R-036/038/039/040 and why** — this is the
  part a future gate review will most need
- ADR-052's accepted abuse surface and its named reopening trigger
- that ADR-051's Option C was corrected from `CONCURRENCY_CONFLICT` to
  `CONFLICT`, if it needed correcting
- Phase 2.5's creation and its single hard deadline
- how many places the 27→29 table count had to be updated

---

## Step 4 — Verify

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
npm run conformance && npm run check:register && npm run graph
```

```bash
grep -cE "^\| ADR-05[23] " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 2
grep -cE "^## ADR-05[23] " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 2
grep -c "^| R-0" RISK_REGISTER.md                                 # expect 40
```

Confirm the ADR tally against `PROJECT_GRAPH.md`'s generated register, not your
arithmetic: **56 ADRs, 45 accepted, 3 open.**

`npm run db:migrate` is not required — no migration changed.

Commit in **at least three commits** — Part A's rulings, Part A's register
changes, Part B's amendment — so each is revertible alone. Push and report the
CI result.

---

## Step 5 — Report

- what you wrote, file by file
- **the status word chosen for each risk row, with its one-sentence
  justification** — quote them
- any ruling in this prompt that contradicted something in the repository. **If
  one did, stop and report rather than writing it** — a ruling on a wrong premise
  is worse than an open question, and this has already happened twice in this
  programme
- whether `PHASE_2_BRIEF.md` and `06_IMPLEMENTATION_PLAN.md` agreed on where a
  new phase is enumerated
- how many restatements of "27 tables" you found
- what still remains owed after this session

---

## Hard boundaries

- **Documentation only.** No migration, no table, no module, no capability, no
  guard change, no production code.
- **Do not design the discount or referral model.** Part B defines scope only.
- Do not touch ADR-039, ADR-040 or ADR-041 — the three operational ADRs stay
  `OPEN` and block nothing in Phase 2.
- Do not edit `PHASE_1_DEBT_CLOSURE.md`.
- Never weaken a conformance rule, the register check, or add an
  `exceptions.json` entry.
- No reading of `future/`.
- If you become uncertain: stop and write the ambiguity down with options and a
  recommendation. Do not pick silently because a decision was inconvenient.
