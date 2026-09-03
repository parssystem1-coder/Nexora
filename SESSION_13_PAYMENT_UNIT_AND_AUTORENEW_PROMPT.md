# SESSION 13 — The unit an Iranian gateway speaks, and whether renewal may ever charge without asking

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **Documentation only — no migration, no table, no feature code.**
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session

Three things about payment are unrecorded, and one of them is the single most
common defect in Iranian gateway integrations.

1. **Iranian payment gateways do not agree on whether an amount is in Rials or in
   Tomans.** ADR-022's amendment has just made `IRR` the stored currency. Nothing
   says what unit crosses the wire to a provider, and ADR-023 item 5 turns a wrong
   guess into a security event on every single transaction.
2. **`supportsDirectDebit` is a flag in ADR-023 with no flow behind it**, and
   ADR-024's renewal lifecycle has exactly one branch. Whether the platform ever
   pulls money from a customer's bank account without asking each time is a
   decision, and it is currently made by omission.
3. **ADR-023 is titled "…and Iranian PSP Profile" and profiles no PSP.** Nothing
   says what must be established about a gateway before its adapter is written.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-023 in full** (all ten items, the
   *Adding a new provider* section and the verification list); **ADR-022 in full
   including the new amendment**; **ADR-024** (items 4, 6, 8, 9, 10);
   **ADR-037 in full** — the credential-storage deferral, which decides part B;
   **ADR-055** (the tax ruling recorded two sessions ago); **ADR-009**;
   **ADR-038**; **ADR-045**; **ADR-052**
3. `PHASE_2_BRIEF.md` — §3, §4 with all amendments, §5 "Money", "Credentials",
   "Idempotency"
4. `05_API_CAPABILITY_CONTRACTS.md` §4.2 — `billing.payment.initiate` and
   `billing.payment.verify`
5. `RISK_REGISTER.md` — grep for rows about payment, provider, credential, refund
6. `modules/money/` — the `Money` value object and the currency table's columns,
   in full. **Part A's ruling names a new field; you must know what shape the
   existing ones take before adding to them.**

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — Establish three things before recording

**1.1** Confirm the next free ADR number and risk-row id from the files. This
prompt assumes **ADR-058** and **R-044**; verify.

**1.2** Does any payment code exist yet? Item 12 is unbuilt, so the expected answer
is "the port type, if that". Report what you find. **If an adapter already exists
and hard-codes a unit, stop and report** — part A becomes a correction.

**1.3 Read ADR-037's deferral and state, in one sentence, what it currently
guarantees about a stored credential and what it defers.** Part B's ruling rests on
it, and this prompt must not be trusted about it.

---

## Step 2 — Part A: the unit a provider speaks is declared, never assumed

**Ruled by the maintainer on 2026-09-03.** Record as a **dated amendment to
ADR-023**, following the `### Amendment, <date> — <what>` convention already in the
file.

### A1 — The problem, stated so it cannot be waved away

Iranian gateways are split: some accept the amount in **Rials**, some in **Tomans**,
and some accept a currency parameter that changes the meaning of the same number.
The platform stores `IRR` with zero minor units (ADR-022 item 7's own example).

ADR-023 item 2 persists *"our id, our amount, our currency"* before the redirect,
and item 5 requires verify to compare *"the provider-reported amount and currency
against the persisted intent"*, calling a mismatch *"a hard failure and a security
event, never an auto-accept."*

So an adapter that sends Tomans while the intent holds Rials produces **a security
event on every successful payment.** And an adapter that converts on the way out
but not on the way back produces the opposite: **a tenfold mismatch that compares
equal and passes.** One of those is noisy and one is silent, and the silent one
takes real money.

### A2 — The ruling

1. **`PaymentProviderCapabilities` gains a declared wire unit.** The port carries
   the divisor between the stored minor unit and the unit the provider's protocol
   uses — `1` for a Rial-denominated gateway, `10` for a Toman-denominated one.
   Name it for what it is (a wire/provider unit), **not** with the word *display* —
   ADR-022 item 4's presentation divisor is a different thing with a different
   consumer, and conflating them is how one gets used for the other.
2. **The conversion happens in exactly one place: the adapter.** The port's own
   interface speaks `Money` in stored units only. Application and Domain never see
   a provider unit — the same fence ADR-023 item 9 already draws around provider
   SDKs, URLs and field names.
3. **Verify compares in stored units.** The adapter converts the provider-reported
   amount back before returning it, so item 5's comparison is always Rial to Rial.
4. **The divisor is never a literal in business code**, matching ADR-022 item 4's
   rule for its own factor.

### A3 — The enforcement, because a rule with no test is a comment

ADR-023's verification list already requires *"adapter contract test suite runs
against fixtures with no network."* Extend it, in the amendment:

> The shared adapter contract test must assert the unit round-trip: given a `Money`
> of N Rials, the adapter's outgoing payload carries the value the declared divisor
> implies, and a provider response echoing that same value verifies back to exactly
> N Rials.

This test is written once and every adapter runs it. **A new adapter that gets the
unit wrong fails on the shared suite, not in production.**

### A4 — The consequence nobody has costed: a Toman-denominated gateway cannot charge every Rial amount

A Toman-denominated provider takes whole Tomans, so **only amounts that are a
multiple of 10 Rials are representable.** With ADR-055 now in force, the amount
sent to the gateway is the **gross** amount — subtotal plus a percentage tax — and
a percentage of a round number is routinely not a round number. This is the normal
case, not an edge case.

**Do not resolve it by rounding inside the adapter.** Silently altering an amount
between the invoice and the charge is exactly what ADR-022 exists to prevent, and
it would break ADR-023 item 5's comparison by design.

**The ruling:**

1. **The port declares a charging granularity** — the smallest increment of stored
   minor units the provider can actually charge. `1` for a Rial gateway, `10` for a
   Toman gateway.
2. **The domain rounds the tax, not the total**, so that `subtotal + tax = total`
   stays exactly true on the invoice while the total lands on the declared
   granularity. The rounding mode is declared, per ADR-022 item 5, which already
   requires it for tax specifically.
3. **An amount that is not representable at the moment of charging is a hard
   failure**, not a rounding. If it reaches the adapter, the port was used wrong.

**Where this is recorded is a judgement call and you must make it deliberately:**
the granularity belongs to ADR-023 (it is a provider property), and the tax
rounding belongs to ADR-055 (it is tax arithmetic). **Record each in its own home
and cross-reference them.** Do not put the whole thing in one ADR because it was
discovered at once.

**Epistemic status, in the house style ADR-041 and ADR-048 established.** The claim
that Iranian gateways differ on Rial versus Toman is drawn from general knowledge of
the market and **was not verified against any vendor's primary documentation in the
pass that produced this prompt.** Record it with that marker. It does not weaken the
ruling — a port that declares its unit is correct whether or not any particular
gateway is Toman-denominated, and it is *specifically* the fact that this varies by
vendor that the ruling exists to absorb.

---

## Step 3 — Part B: automatic renewal, and the mandate the platform will not hold yet

**Ruled by the maintainer on 2026-09-03.** Record as a new ADR at the number
Step 1.1 confirmed.

### B1 — What is actually being decided

ADR-023 item 1 declares `supportsDirectDebit` and item 6 says *"No recurring where
recurring does not exist… the billing domain must never assume a card can be
charged again."* ADR-024 item 4 then designs the whole renewal lifecycle around
invoice-and-notify. **Nothing anywhere says whether direct debit is a mode this
platform will use.** It is currently decided by omission, which `AGENTS.md` §5
forbids.

An Iranian direct-debit mandate (پرداخت خودکار / برداشت مستقیم) is not a stored
card. It is an authorization the payer grants **at their own bank**, carrying an
identifier, a per-transaction ceiling, a count-per-period ceiling and an expiry, and
**revocable by the payer at any time without telling the merchant.**

### B2 — The ruling: not in V1, and these are the reasons

1. **The product does not need it.** The plans are annual. Invoice-and-notify at
   T-30d with reminders at T-14d and T-3d — which ADR-024 item 4 already
   specifies — is the correct shape for a once-a-year charge. Direct debit earns
   its complexity on monthly billing, which this platform does not sell.
2. **ADR-037's deferral is the blocking reason, and it is the one to lead with.**
   A mandate is a credential that authorizes **pulling money out of a customer's
   bank account.** Whatever ADR-037 currently defers about encryption at rest
   (Step 1.3 established it), holding an instrument of that class under a deferred
   mechanism is a materially worse trade than holding a gateway API key under it.
   **State it in exactly those terms** — the difference is what the credential can
   do, not how secret it is.
3. **It would change ADR-024's state machine, not just add a job.** A mandate that
   is revoked or expired between periods is a new failure mode that is neither
   `PAST_DUE` (nothing was attempted) nor a payment failure (nothing was charged).
   Adding it later is an ADR; adding it accidentally is a bug.

**So: no adapter declares `supportsDirectDebit` true in V1**, and ADR-023 item 1's
existing rule does the enforcing — *"Any code path that assumes an unavailable
capability must fail at startup with a configuration error."* The flag stays in the
port. It stays false.

### B3 — What must be true before this is reopened, written now while it is cheap

Record these as the reopening conditions, so the next reader inherits an answer
rather than an argument:

- **ADR-037's mechanism exists** — not deferred, built
- **a plan is sold on a period shorter than a year**, or annual invoicing is
  measurably losing renewals
- ADR-024's state machine gains an explicit transition for a mandate that is
  revoked or expired **outside** a payment attempt, and that transition falls back
  to invoice-and-notify rather than toward expiry
- the mandate's own lifecycle — grant, ceilings, expiry, revocation, and the
  bounded idempotent retry policy under ADR-009 — is designed before any table is
  created, not alongside it

### B4 — Apply the backfill test, and say the answer out loud

`PHASE_2_BRIEF.md` §5 revokes `UPDATE`/`DELETE` on `billing_payment_events`, so ask
the question this programme now asks of every deferral: **does anything need a
column today that could not be added later?**

The answer is no, and the ADR should say why: a mandate identifier on a payment
event is **legitimately empty** on every redirect-flow payment, so it is a column
that may wait. That is the same test ADR-056 used to send `corrects_invoice_id` to
a later slice, and applying it consistently is what makes the test trustworthy.

**If you conclude otherwise, stop and report** — that would mean this deferral has a
cost the maintainer was not shown.

---

## Step 4 — Part C: what must be known about a gateway before its adapter is written

ADR-023 is titled *"Payment Provider Port and Iranian PSP Profile"* and contains no
profile. Fix that — but **not by listing vendors.**

The reason belongs in the amendment: ADR-023's own *Adding a new provider* section
requires that a gateway cost *"one adapter, one capability declaration, one
credential schema, one fixture-based test suite, and one configuration entry"* and
**zero changes elsewhere.** A list of vendors in an ADR is a list that goes stale,
invites someone to code against it, and is exactly the coupling the port exists to
prevent.

**What belongs there instead is the checklist** — what must be established, from
**that vendor's own current primary documentation**, before its adapter is written:

| Must be established | Why it is on the list |
|---|---|
| the wire unit — Rials or Tomans, and whether a currency parameter changes it | part A; the tenfold error |
| the charging granularity | part A4; whether every gross amount is representable |
| minimum and maximum amount per transaction | ADR-023's `maxAmountMinor` is already declared and never populated |
| whether verify-by-reference exists, and its idempotency under repeat calls | ADR-023 item 4's reconciliation sweep depends on it entirely |
| whether a webhook exists, and whether it is authenticated | ADR-023 item 3 treats a callback as a hint regardless, but the answer changes the sweep's tuning |
| refund support: full, partial, or none | ADR-023 item 10 requires a manual path where it is absent |
| settlement delay | already a declared field, never populated |
| the credential shape, and whether rotation invalidates history | ADR-023 item 8 forbids rotation from invalidating historical records |
| whether a sandbox exists | ADR-023 requires fixture tests with no network; fixtures have to come from somewhere |
| the mandate model, if and only if direct debit is ever reopened | part B |

Record, as a rule: **each vendor's values are established at the time its adapter is
written, from that vendor's own then-current documentation, and are recorded in the
adapter's configuration and its fixture suite — never in this ADR.** The ADR owns
the questions; the adapter owns the answers.

---

## Step 5 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`** — the dated amendment to **ADR-023**
   (parts A and C), the new ADR (part B), a dated amendment to **ADR-055** for the
   tax-rounding half of A4, a dated cross-reference in **ADR-024** noting that its
   item 4 lifecycle is the only branch and why, and §1.1 rows updated.
2. **`PHASE_2_BRIEF.md`** — a dated amendment only if §5's "Money" or "Credentials"
   rules are now incomplete. **§4 gains no table** — say so explicitly, since a
   reader who sees a mandate discussed will look for one.
3. **`05_API_CAPABILITY_CONTRACTS.md`** — if `billing.payment.initiate`'s contract
   now owes anything about units, add it; if not, say so.
4. **`RISK_REGISTER.md`** — judge whether the wire-unit hazard needs a row. **It
   probably does not** if part A's shared contract test is recorded as its control;
   a risk with an owned, specified control is a design decision, not an open risk.
   Say which way you judged and why. `npm run check:register` must pass; escape
   every `|` inside a cell.
5. **`decisions/2026-09.md`** — one entry: the wire-unit rule, the granularity and
   tax-rounding consequence, the direct-debit deferral with ADR-037 as its leading
   reason, and the decision not to enumerate vendors.
6. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is stale.

---

## Step 6 — Verify

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

One commit, repository style, referencing ADR-023, ADR-055 and the new ADR.

---

## What to report back

1. Step 1.3's sentence — what ADR-037 guarantees and what it defers, quoted.
2. Whether A4's tax-rounding rule actually keeps `subtotal + tax = total` exact for
   a worked example you compute yourself. **Do the arithmetic, do not assert it.**
   Use a realistic annual plan price and a 10% rate against a granularity of 10.
3. Where you put the granularity and where you put the tax rounding, and why.
4. Whether the backfill test in B4 really returns "may wait", in your own reading.
5. Whether you judged the wire-unit hazard to need a risk row, and why.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.**

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a file
against that file. Where it is wrong, **stop and report rather than working around
it.** Every session in this programme has found at least one false premise here —
the last one by checking an ADR this prompt told it to check and finding the ADR
said something else.
