# SESSION 1 (v2) — Lock the schema-shaping decisions

> **سند غیرنرمتیو.** این یک پرامپت اجرایی برای یک سشن Claude Code است، نه یک تصمیم پذیرفته‌شده.
> عمداً در ترتیب خواندنِ `AGENTS.md` §۱ نیست. مرجعِ هر تصمیم، ADR یا ردیف ریسکِ خودش است.


> Model: Opus. `D:\Nexora` connected. Documentation-only.
>
> **This supersedes both** `prompts/SESSION_1_PROMPT.md` in
> `NEXORA_STRATEGIC_PACKAGE_2026-09-02` **and** the earlier revised prompt.
> The package's drafts contain three verified errors (Step 2). Use the package
> as source material, never as a clipboard.
>
> Companion document: `NEXORA_PLAN_3ROUNDS.md` — the three-round plan this
> session is round 1 of.

You are working in the Nexora repository. This session writes **no** migration,
table, module or capability, and modifies **no** ACCEPTED ADR.

---

## Step 0 — Read, in this order, then stop

1. `AGENTS.md` — whole file
2. `PHASE_2_BRIEF.md` §3 (capability↔item mapping), §4 (tables), §5 (RLS,
   append-only ledgers, idempotency, credentials)
3. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` §0, §1.1, and the bodies of
   **ADR-020**, **ADR-022**, **ADR-024**, **ADR-042**, **ADR-043**
   — ADR-043 is the format model; ADR-042 is the precedent for ruling rather
   than deferring; ADR-024 items 4, 5, 9 and 10 are load-bearing for ADR-047
   and ADR-050
4. `DECISION_LOG.md` — the template and which monthly file entries go in
5. `RISK_REGISTER.md` — **preamble and table header only.** Do not read all
   37 rows; the file is ~160 KB and one table.
6. From the strategic package: `01_VERIFIED_CONTEXT_SNAPSHOT.md`,
   `03_DECISIONS_TO_LOCK.md`, `04_RISK_ROWS_TO_ADD.md`

Do **not** read `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011…ADR-018.

---

## Step 1 — Re-verify before writing anything

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -5
grep -o "^| R-0[0-9]*" RISK_REGISTER.md | tail -1
grep -c "^| R-0" RISK_REGISTER.md
git status --short && git log --oneline -5
```

Verified on 2026-09-02: highest ADR **ADR-043**, highest risk **R-037**,
count **37**. **If any differs, stop and report.** Do not renumber on your own
initiative — writing an ADR over an existing number silently corrupts every
document that cites it.

---

## Step 2 — Three errors in the package drafts. Do not carry them forward.

Each was checked directly against the repository and would produce a defective
ADR if pasted in as written.

### (a) `outbox_events` must be removed from ADR-045's mutable-table list

`PHASE_2_BRIEF.md` §5 puts `outbox_events` on the `REVOKE UPDATE, DELETE`
append-only list alongside `subscription_periods`,
`subscription_state_transitions`, `usage_ledger_entries`,
`billing_payment_events`, `invoices`, `invoice_lines`. A `version` column there
would be a field nothing can ever update — which ADR-045's own recommendation
calls a defect. The draft contradicts the brief, the package's own
`02_PROPOSAL_TRIAGE.md`, and itself.

The question this exposes — *where does outbox delivery state live?* — is not
dropped. It moves to **ADR-050** (Step 4), which owns it.

### (b) R-038 and the package's ADR-047 rest on a misreading of ADR-020

ADR-020's state table says OFFBOARDED data is *"retained for the retention
window, then purged"*, and rule 3's reversible window is `DELETION_REQUESTED`
→ 30 days → purge. **Nothing has been deleted during the window**, so
reversibility is satisfied by retention and needs no restore mechanism. The
package's claim that the guarantee "has no mechanism behind it" is too strong.

Two further facts the package missed, both verified in ADR-020's body:

- **Rule 6 already requires a tenant data-export capability** ("must be a
  capability with its own quota, not an ad-hoc script"). The package's
  ADR-047 Option B is therefore not a new option — it is an accepted
  requirement with **no owning phase**.
- **Rule 7 already rules on backups** ("Backups age out naturally… the
  retention window must be documented to the tenant") — and that documentation
  obligation has no owner either.

**Therefore: do not write the package's ADR-047 (tenant-granular restore).**
The number ADR-047 is reassigned to renewal pricing below. The restore gap is
recorded as R-038 with the narrow claim in Step 5.

### (c) Trivial wording

`02_PROPOSAL_TRIAGE.md` says an `idempotency_keys` table "is already a live
conformance violation". The rule and its fixture exist; a violation would arise
only if such a table were created. Inherited from `PHASE_2_BRIEF.md` §5's own
phrasing — **no repository edit needed.**

---

## Step 3 — Business-model reconciliation already done. Use these findings.

`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §2
and §6 were reconciled against Phase 2 on 2026-09-02. Do not re-derive this;
do cite the source document by path.

**Verified fits:** one-year calendar term, 7-day grace, 30-day reactivation
window, T-30d renewal invoice (ADR-024); IRR with zero minor units is ADR-022's
own worked example; `TRIALING` and the `trial.expire` job exist (ADR-024 item 8).

**Four mismatches**, which are why ADR-047 and R-040 exist:

1. The business model prices **renewal higher than the first year**
   (6,000,000 → 8,000,000–10,000,000 per year). `subscriptions` pins plan and
   price version ids; **no rule states whether renewal re-pins to the current
   price version.** → **ADR-047**.
2. **No capability starts a trial.** `05` §4.2's 15 capabilities contain no
   trial-start; the state and its expiry job exist without an entry path.
   → **R-040**.
3. **Add-ons**: D2-7 keeps the add-on rung present and always empty and builds
   no `subscription_items`, while the business model sells three separately
   priced add-ons. Deliberate sequencing, never compared to the revenue model.
   → record in the decision-log entry, **not** as a new row.
4. **30-day money-back**: refunds exist at the port level and `billing_refunds`
   is item 13, but no refund *capability* is in Phase 2 — so the guarantee is
   operable manually with audit (ADR-023 item 10), not as a product feature.
   → record in the decision-log entry.

---

## Step 4 — Write seven ADRs

Into `02_ADR_INDEX_NORMATIVE_DECISIONS.md`: a register row in **§1.1** matching
the existing row format, and a body section placed **after ADR-043**, in
ADR-043's structure — `## ADR-0xx - Title`, status line, `### Problem`,
options with costs and what each forecloses, `### Recommendation`,
`### What this ADR does not do`, `### Verification`.

| ADR | Title | Status |
|---|---|---|
| ADR-044 | Localized Display Text in Phase 2 Tables | **OPEN** |
| ADR-045 | Optimistic Concurrency for Mutable Phase 2 Rows | **OPEN** |
| ADR-046 | Soft-Delete Mechanism for ADR-020's Reversible Window | **ACCEPTED (new)** |
| ADR-047 | Price Version Binding on Renewal | **ACCEPTED (new)** |
| ADR-048 | Invoice Numbering | **OPEN** |
| ADR-049 | MCP Readiness Posture for Phase 2 | **ACCEPTED (new)** |
| ADR-050 | Financial Event Packet and External Delivery Path | **OPEN** |

### ADR-044 — Localized Display Text

Use the package draft. Its premise is verified: `05` defines no response shape
for `plan.list` beyond scope/risk/idempotency, so **no document states whether
`plans`/`plan_features` carry display text.** Keep the explicit statement of its
relationship to ADR-042 (error messages ≠ content text) so a later reader does
not assume ADR-042 covered it. Note that Step 3's reconciliation gives the
maintainer concrete plan names to weigh when ruling.

**Blocks item 1.**

### ADR-045 — Optimistic Concurrency

Use the package draft **with `outbox_events` removed**. **Re-derive the
mutable-table list from `PHASE_2_BRIEF.md` §4 and §5 yourself** — do not trust
the draft's list. Expected result: `subscriptions`, `tenant_over_limit_states`,
`billing_payment_intents`, `idempotency_records`. If your derivation differs,
say so and explain.

Keep the draft's explicit statement that it closes neither R-008 nor R-036.
Cross-reference ADR-048: gap-free invoice numbering and optimistic-concurrency
retry pull in opposite directions, and neither ADR may be ruled without the
other in view.

**Blocks items 4, 8, 12.**

### ADR-046 — Soft-Delete Mechanism — **ACCEPTED**

The maintainer ruled on 2026-09-02: **Option A — no `deleted_at` column is
added in Phase 2**, with the first capability that deletes as the named
reopening trigger.

Write it the way ADR-042 was written: state *why this is ACCEPTED rather than
OPEN* — the evidence runs one way (no Phase 2 capability deletes anything;
~20 columns nothing sets would each be a permanent query-correctness obligation
no conformance rule catches), and leaving it open has an asymmetric cost.

Keep the draft's three-valued-logic note about RLS and `FORCE ROW LEVEL
SECURITY`, **labelled unverified** — ADR-041's precedent. State that ADR-020 and
ADR-026 are undisturbed.

### ADR-047 — Price Version Binding on Renewal — **ACCEPTED** — new subject

> The strategic package used this number for tenant-granular restore; that ADR
> is not being written — see Step 2(b). State this reassignment in the body so
> a reader holding the package is not confused.

The maintainer ruled on 2026-09-02:

1. **Renewal re-pins to the current price version.** No subscriber is locked to
   the price they first bought at; a published price change reaches every
   subscriber at their next renewal.
2. **The price is fixed at the moment the renewal invoice is issued** — T-30d
   per ADR-024 item 4 — not at `period_end`. Otherwise an already-issued invoice
   would change underneath the customer.
3. **The T-30d notice carries the new price**, which also satisfies ADR-024
   item 10's notification obligation.

The body must make two interactions explicit:

- **ADR-024 item 5** (early renewal must never shorten a term): if a tenant pays
  early, which price applies — the one on the issued invoice, or the current
  one at payment time? State the rule, do not leave it implied.
- **ADR-025** (proration on plan change): a mid-term plan change and a renewal
  re-price must not double-count.

**Blocks items 2 and 14.**

### ADR-048 — Invoice Numbering — **OPEN** — new subject

Verified: **nothing anywhere in the repository addresses invoice numbering.**
Three questions that become schema commitments the moment item 13's migration
lands:

- per-tenant sequence or platform-global?
- gap-free or gap-tolerant?
- what happens under concurrent issuance?

**Name the real tension:** gap-free numbering and optimistic-concurrency retry
(ADR-045) pull in opposite directions — a failed transaction either burns a
number or holds a lock on the sequence. Options should cover at least: a
PostgreSQL sequence (gap-tolerant, cheap, concurrent-safe); a per-tenant counter
row locked `FOR UPDATE` (gap-free, serialises issuance); and a reserved-number
table with explicit voiding (gap-free with an audit trail).

State that this is the prerequisite for any two-way accounting integration —
an external ledger keys on the invoice number.

**Blocks item 13.**

### ADR-049 — MCP Readiness Posture — **ACCEPTED** — new subject

The smallest ADR here and the most constraining. **It builds nothing.** It
records that Phase 2 must not foreclose the MCP path already accepted for
Phase 9 (ADR-001, ADR-001b, ADR-003, ADR-007), and *names what would foreclose
it*:

- authoritative business logic in a controller rather than an application
  service (already forbidden by `AGENTS.md` §4 — this ADR ties it to a reason)
- a capability reachable only over HTTP, whose invocation cannot be expressed
  without an HTTP request
- `CapabilityDefinition` ceasing to be the single source of truth for what a
  capability is, what it may raise, and what it requires

State plainly that this ADR **implements nothing and defers the mechanism** to
Phase 9, in the same shape ADR-043 used ("decides what is enforced and where; it
does not implement the rule").

### ADR-050 — Financial Event Packet and External Delivery Path — **OPEN** — new subject

Verified: **the repository nowhere defines the body shape of `outbox_events`
entries**, while ADR-024 item 9 already requires `SubscriptionExpired` to be
emitted through the outbox. The event body is a contract every future consumer
depends on and none can renegotiate.

Three things to settle:

1. **Packet shape** — envelope fields (event type, version, tenant, occurred-at,
   correlation), and the rule that **any monetary value is `MoneyDto`, never a
   bare number** (ADR-022 item 7).
2. **Where delivery state lives.** `outbox_events` carries `REVOKE UPDATE,
   DELETE`, so attempts / delivered / failed / next-retry cannot be columns
   updated in place. Two shapes: a separate delivery-attempts table, or a
   documented per-column exception to the REVOKE. **Present both; do not
   decide.**
3. **The consumption rule** — every external integration (accounting, webhooks,
   analytics) reads through this path only, never directly from domain tables.

Record that `webhook_endpoints` and `webhook_deliveries` exist in the doc pack
with **no owning phase**, and that assigning them an owner is round 2's job,
not this ADR's.

**Blocks item 14. Prerequisite for any accounting integration.**

### Non-negotiable while writing

- **Every ADR gets a "What this ADR does not do" section** that fences real
  territory — what accepted decision it leaves untouched, what it declines to
  design.
- **Label unverified things unverified.** ADR-041's *"owed empirical
  verification"* is the house precedent. Do not assert an interaction you have
  not tested.
- **Additions only** to existing ADR text.
- Four are `OPEN` and their ruling is the maintainer's. Three are `ACCEPTED`
  **only because the maintainer ruled them** — say so, with the date.

---

## Step 5 — Three risk rows

Append to `RISK_REGISTER.md`'s table. Columns:
`ID | Risk | Likelihood | Impact | Mitigation | Owner | Status | Opened`.
All **OPEN**, opened **2026-09-02**.

### R-038 — no tenant-granular recovery path

The claim is **not** "ADR-020's reversible window has no mechanism" — that is
false, see Step 2(b). The claim is: **there is no tenant-granular recovery path
from an erroneous or premature purge, or from any tenant-scoped data-loss
incident.** The only restore mechanism is cluster-wide physical PITR, which
would roll back every other tenant.

Record in the same row:

- **Two unowned obligations found in ADR-020's own body**: rule 6's export
  capability has no owning phase; rule 7's "retention window must be documented
  to the tenant" has no owner.
- **An architectural constraint that shapes any future restore.** Ledger-shaped
  tables carry `REVOKE UPDATE, DELETE ON … FROM nexora_app`. The application
  role therefore *cannot* delete a ledger row, so restoring one tenant can never
  be a simple rollback: it is a restore for mutable state and a compensating
  entry for ledgers, and it must run outside the application under a different
  role — which changes who may run it and how it is audited.

Mitigation column: the minimum owed now is assigning a phase owner to rule 6,
**not** designing a new mechanism.

### R-039 — `sessions` grows without bound

Use the package draft as written; its facts were verified — no retention policy,
no purge job, no `tenant_id`/RLS, no Phase 2 item touches it, not in ADR-041's
scope, and no existing row covers it.

### R-040 — no trial-start path

`TRIALING` is a legal state in ADR-024 item 3 and `trial.expire` is a required
job in item 8, but `05` §4.2's fifteen capabilities contain **no capability that
starts a trial** — while the business model's acquisition offer is a 7-day free
trial. Record it as a contract gap, not a task: what is undecided is whether a
trial is a capability, an operator action, or a property of `plan.subscribe`.

### Preamble correction

The preamble still says *"31 rows (R-001 … R-031)"* while the table holds 37
(40 after these rows). Use a **dated correction above the superseded text**, per
the register's own no-rewrite convention — not a silent edit.

---

## Step 6 — Summaries

**`CLAUDE.md` "Current state"** — ADRs **46 → 53** (ACCEPTED **35 → 38**,
OPEN **3 → 7**, DEFERRED unchanged at 8), risk rows **37 → 40**
(OPEN **30 → 33**). Name the new entries. **Keep the dates in the sentences** —
an undated count reads as current forever, which that file says about itself.

**`decisions/2026-09.md`** — one entry, **newest at top**, using
`DECISION_LOG.md`'s four-field template exactly (`Context` / `Options
considered` / `Decision` / `Status`). It must record, because nothing else will:

- the three package errors found and what was done about each (Step 2)
- that **ADR-046, ADR-047 and ADR-049 were ruled**, by whom, on what date, and
  why ACCEPTED was correct for each
- that **ADR-047's number was reassigned** from the package's tenant-restore
  subject, and why that ADR was not written
- the business-model reconciliation and its four mismatches (Step 3),
  **including the two recorded here rather than as rows**: the add-on rung being
  deliberately empty while the revenue model sells three add-ons, and the
  money-back guarantee being manual in Phase 2
- that `webhook_endpoints` / `webhook_deliveries` have no owning phase, deferred
  to round 2

Honest `Status`: **OPEN** — four ADRs drafted and unruled.

---

## Step 7 — Verify

```bash
npm run graph
npm run format:check && npm run lint && npm run conformance
git diff --stat
```

Counting checks that catch a botched register edit:

```bash
grep -c "^| R-0" RISK_REGISTER.md                              # expect 40
grep -o "^| R-0[0-9]*" RISK_REGISTER.md | tail -1              # expect R-040
grep -c "^| ADR-0[45][0-9]" 02_ADR_INDEX_NORMATIVE_DECISIONS.md
grep -c "^## ADR-04[4-9] \|^## ADR-050 " 02_ADR_INDEX_NORMATIVE_DECISIONS.md
```

**Every new ADR needs both a register row and a body section.** A row without a
body, or a body without a row, passes every linter and quietly breaks the
register — this is the check most likely to catch a real mistake.

`PROJECT_GRAPH.md` is generated — never hand-edit it.

**Do not chase the red CI** on `membership-revoke.integration.spec.ts`'s
two-concurrent-owners test. It is R-008/R-036, intermittent and pre-existing,
and a documentation session cannot have caused it.

---

## Step 8 — Report

State plainly:

- what you wrote, file by file
- **any claim in this prompt or in the package drafts that turned out to be
  wrong** about the repository, and what you did about it — in particular
  whether your own derivation of ADR-045's mutable-table list matched
- before/after counts
- the four questions now awaiting the maintainer (ADR-044, ADR-045, ADR-048,
  ADR-050)
- anything you could not settle — as a documentation defect per `AGENTS.md` §5,
  not as a workaround

---

## Hard boundaries

- No migration, no table, no module, no capability.
- No edit to an ACCEPTED ADR's text. (ADR-046, ADR-047 and ADR-049 are *new*
  ADRs written as ACCEPTED, which is different.)
- No `exceptions.json` entry, no weakened conformance rule.
- No reading of `future/`.
- **Do not open discounts, referral codes, backup design, or accounting
  integration.** Those are round 2 — assigning them a phase owner is a scope
  decision belonging to `PHASE_2_BRIEF.md`, not to an ADR.
- If you become uncertain: **stop and write the ambiguity down with options and
  a recommendation.** Do not pick silently because a decision was inconvenient.
