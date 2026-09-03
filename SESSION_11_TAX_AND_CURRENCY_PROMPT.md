# SESSION 11 — Record the maintainer's two money rulings: tax on subscription purchase, and the Rial/Toman split

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **Documentation only — no migration, no table, no feature code, no capability.**
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session

Two rulings by the maintainer, both about money, both binding on the creating
migrations of Phase 2 items 12 and 13, and **neither recorded anywhere**:

1. **Tax is not included in the plan price.** The price we publish is the price we
   publish; VAT is added at checkout, is configurable, and is charged by the
   gateway on top.
2. **Rial is the currency; Toman is a display unit.** Everything stored, contracted
   and machine-readable is `IRR`. Only the interface divides by ten.

Both touch `invoices`, which `PHASE_2_BRIEF.md` §5 puts on the
`REVOKE UPDATE, DELETE` list. **A column can be added to an append-only table
later; the old rows can never be filled in.** That is why these are recorded before
item 13's migration and not after.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-022 in full**, **ADR-023**
   (items 2, 5 and 7), **ADR-024** (item 4), **ADR-025**, **ADR-031**, **ADR-042**,
   **ADR-044**, **ADR-045**, **ADR-046** (its ruling — the reasoning about columns
   that nothing sets), **ADR-047**, **ADR-048** (its `### Ruling`, all five parts),
   **ADR-052**
3. `PHASE_2_BRIEF.md` — **§4 including both dated amendments**, **§5 "Money",
   "Append-only ledgers", "Tenancy and RLS"**
4. `04_DATABASE_BLUEPRINT.md` — §2.5 and §3's tax entry (the commerce one, to
   confirm it is out of scope), §7
5. `05_API_CAPABILITY_CONTRACTS.md` — §4.2, and whatever it says about money in a
   response shape
6. `RISK_REGISTER.md` — search for any row about tax, currency, or Toman. **Report
   what you find, including "nothing".**
7. Any existing money code: the `Money` / `MoneyDto` type, the currency
   configuration, and anything that already divides or multiplies by ten. **Grep
   for `10` near money, for `toman`, `تومان`, `rial`, `ریال`, and `IRR`.**

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — One thing to establish before recording

**Does anything in the codebase today already represent a price, an amount, or a
currency?** Item 2 of Phase 2 (`prices`, `price_versions`) is not built, so the
expected answer is "only the `Money` contract type, if that". Establish it, and
list what you found. **If a Toman value is already stored or emitted anywhere,
stop and report** — the second ruling would then be a correction rather than a
first record, and it must be written as one.

---

## Step 2 — Record ruling one: tax on a subscription purchase

**Ruled by the maintainer on 2026-09-03.** Write it as a new ADR — the next free
number, which you must confirm from the file rather than trusting this prompt.
Title it for what it is: tax on a subscription purchase, platform billing only.

### Part 1 — The published price is net. Tax is added at checkout.

`price_versions` stores the amount the platform publishes, **excluding tax**. No
`tax_inclusive` flag is added: net is universal here, and a flag would be a
configuration point with exactly one value. **Trigger to revisit:** the platform
selling into a jurisdiction that requires tax-inclusive display.

Two obligations this creates on the interface, which must be in the ADR because
otherwise the ruling reads as a licence to surprise the buyer:

- wherever a plan price is shown, it must **state that tax will be added** — a
  price presented bare, that is not the price charged, is misleading
- the checkout step must show the **breakdown — subtotal, rate, tax, total —
  before the redirect**, not after

### Part 2 — The gateway is charged the gross amount, and this is where it breaks if you get it wrong

ADR-023 item 2 requires the `PaymentIntent` to be *"persisted, our id, our amount,
our currency"* **before** the redirect. ADR-023 item 5 then requires verify to
compare *"the provider-reported amount and currency against the persisted
intent"*, and calls a mismatch *"a hard failure and a security event, never an
auto-accept."*

**Therefore: `billing_payment_intents` persists the gross, tax-inclusive amount.**
If it persists the net amount and the buyer is charged gross, every single
verification fails as a security event. Name this consequence explicitly in the
ADR — it is the failure this ruling exists to prevent, and it is not obvious from
either ADR alone.

### Part 3 — The invoice carries the arithmetic, not a reference to it

`invoices` gains four columns, all `NOT NULL`, all created with the table:

| Column | Type | Why it cannot wait |
|---|---|---|
| `subtotal_minor` | `bigint` | the net amount charged |
| `tax_rate_bp` | `integer` — basis points, so 10% is `1000` | an integer, because ADR-022 item 2 forbids floating point on monetary columns and a rate carries the same hazard |
| `tax_amount_minor` | `bigint` | the computed tax |
| `total_minor` | `bigint` | what was actually charged |

Currency accompanies them per ADR-022 item 8.

**A zero rate is `0`, never `NULL`.** A nullable rate cannot be distinguished from
"not computed yet", and on an append-only table that ambiguity is permanent.

**These are snapshots and that is the point.** `PHASE_2_BRIEF.md` §5 revokes
`UPDATE` and `DELETE` on `invoices` from `nexora_app`, so an invoice's arithmetic
can never be recomputed or corrected in place. Every figure needed to reconstruct
the charge must be on the row at insert.

### Part 4 — Tax is a header figure, not an invoice line

Reason it in the ADR rather than asserting it: ADR-044 requires each line to carry
its own denormalized description captured at issuance, and a tax line's
description would be a computed artifact rather than a description of something
sold. And a single subscription has one rate, so the allocator has nothing to
allocate.

**Trigger to revisit:** the first document with more than one tax rate on it —
which is Phase 3 commerce, not Phase 2.

### Part 5 — "Configurable" means a dated table, not a settings value

The maintainer's ruling is that the rate is configurable. Record what that must
mean and why the cheap reading is wrong:

- Iran's VAT rate has **actually changed** within the platform's own planning
  horizon. A single mutable settings value has no history, so the question "what
  rate applied on the day this invoice was issued" becomes unanswerable from the
  configuration.
- A settings value also has no record of **who changed it and when**, which is the
  first thing anyone asks after a wrong rate reaches a customer.

So: **one new platform-global table, append-only**, one row per rate period:
the rate in basis points, `effective_from` (`timestamptz`, per ADR-031), the actor,
and a note. Resolution rule: **the row with the greatest `effective_from` that is
not in the future.** A wrong rate is corrected by appending a superseding row,
never by editing one — the same discipline every other append-only table here
follows.

Being platform-global, it owes `PHASE_2_BRIEF.md` §5 **a stated RLS-exemption
reason**, alongside the existing ones for `billing_provider_configs`,
`scheduled_job_runs` and `invoice_number_counter`.

**Note the redundancy deliberately, because a reviewer will call it one:** the
invoice snapshots the rate *and* the table records it. That is not duplication —
the snapshot makes an issued invoice self-contained, and the table makes the
platform's rate history auditable. Losing either one loses something different.

### Part 6 — Rounding is already ruled; point at it, do not re-rule it

ADR-022 item 5 already says, verbatim, that *"Proration (ADR-025) and tax must use
the allocator, not independent rounding"* and that every operation that can produce
a fraction of a minor unit must declare its rounding mode. **Do not restate it as a
new rule.** Cite it, and note the one thing it leaves to this ADR: with `IRR` at
zero minor units, tax on a net amount is a rounding of Rials, and the mode must be
declared at the one place tax is computed.

### Part 7 — Scope fence

- **Platform billing only.** The tenant's own store charging tax to its shoppers is
  Phase 3 commerce (`04` §3), and this ADR does not touch it. Say so — the two will
  otherwise be conflated by the first person who greps for "tax".
- **Nothing is registered with سامانه مودیان.** ADR-048 part 5 already deferred
  that with a named trigger; this ADR adds no column for it and does not reopen it.
- **Tax on a refund or a credit note is not ruled here.** It belongs with the
  credit-note decision, which is a separate session.
- The buyer's own tax identity — کد ملی، شناسه ملی، کد اقتصادی — is **not** ruled
  here either. Same reason. Name both so the gap is visibly owned rather than
  missed.

---

## Step 3 — Record ruling two: `IRR` is the currency, Toman is a display unit

**Ruled by the maintainer on 2026-09-03.** This one is **a dated amendment to
ADR-022, not a new ADR** — money has one home, and item 4 of that ADR already
states the principle. Follow the amendment convention already used in this file.

### What is new, and what is only being made specific

ADR-022 item 4 already says *"Display is not storage… The presentation unit, its
divisor and its symbol live in the currency configuration and are applied only in
the interface layer."* The amendment does not restate that. It adds:

**Item 9 — the platform's currency is `IRR`.** Every stored `amountMinor` is
Rials; `minorUnits` is `0`, exactly as ADR-022 item 7's own example already shows.

**Item 10 — the presentation unit is Toman, divisor 10.** In the currency
configuration, in one place, per item 4's existing verification bullet.

**Item 11 — machine-readable output carries the stored currency, never the display
unit.** This is the part item 4 does not cover, and it is the reason the maintainer
ruled it. Structured data for search engines (`schema.org` `Offer.price` and
`priceCurrency`), Open Graph product tags, product feeds, and every API response
emit **`IRR` and the Rial amount**.

Record the reasoning, because it is what makes this non-negotiable rather than a
preference: **"Toman" is not an ISO 4217 currency code.** A consumer receiving a
Toman amount either rejects it or — much worse — reads it as Rials and is wrong by
a factor of ten, silently, in a price a search engine then shows to a shopper.
This is Phase 4 territory, and it is recorded now so that the first thing to emit
structured data does not have to guess.

**Item 12 — the divisor never crosses a boundary.** No API response, event payload,
outbox record, database column or log line carries a Toman amount. Where a
human-readable string is needed inside a message — a notification body, for
instance — it is rendered at the point of presentation from the Rial value.

**Item 13 — one deliberate exception, and it is the invoice document.** The UI
shows Toman because that is what an Iranian customer reads. **A rendered invoice is
denominated in Rials**, because it is a financial document and its unit is the
stored one. Record this as an exception with its reason, rather than letting
someone discover the inconsistency and "fix" it in the wrong direction.

### Verification bullets to add to ADR-022

- a test asserts that every structured-data block emits the stored currency code,
  and fails if a display unit reaches it
- the presentation divisor still appears in exactly one place (item 4's existing
  bullet, now with a concrete value to check)
- a rendered invoice and the UI showing the same subscription differ by exactly the
  divisor, and the test says which one is which

---

## Step 4 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`**
   - the new tax ADR, at the next free number **confirmed from the file**
   - the dated amendment to **ADR-022**
   - §1.1 summary table: a row for the new ADR, with an honest `Blocks` cell —
     items 12 and 13, and their creating migrations specifically
   - if ADR-023, ADR-024 or ADR-048 now reads as incomplete because of either
     ruling, add a **one-line dated cross-reference** to it. Do not restate the
     ruling inside them.

2. **`PHASE_2_BRIEF.md`** — a dated amendment, following the pattern §4's first
   amendment established:
   - §4: **the rate table added, 29 → 30**, with its item (13) and its tenancy
     (platform-global). Table names are indicative; membership is binding.
   - §5: the rate table's **RLS-exemption reason**, and its place on the
     append-only `REVOKE` list
   - §5 "Money": the four invoice columns and the net-price rule, as constraints on
     items 12 and 13

3. **`04_DATABASE_BLUEPRINT.md`** — a dated note only if something there is now
   stale. If nothing is, write nothing and **say so in your report**.

4. **`05_API_CAPABILITY_CONTRACTS.md`** — if §4.2 or §7 needs the money contract
   restated for `IRR`, add it. If not, say so.

5. **`RISK_REGISTER.md`** — open a row only if something here is a risk that no
   existing row covers. **Two candidates; judge each on its merits and do not open
   both reflexively:**
   - the platform issues invoices as a legal entity and registers none with
     سامانه مودیان (check first whether ADR-048 part 5's deferral plus an existing
     row already covers this)
   - a display-unit value reaching a machine-readable output — a real
     ten-times-wrong failure with no test today
   `npm run check:register` must pass; escape every `|` inside a cell.

6. **`decisions/2026-09.md`** — one entry: both rulings, the net-price consequence
   for `billing_payment_intents`, the choice of a dated table over a settings value
   and why, and the invoice-in-Rials exception.

7. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is
   factually stale.

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

One commit, repository style, referencing the new ADR and ADR-022.

---

## What to report back

1. Step 1's answer — what, if anything, already represents money in the codebase.
2. The new ADR's number, and how you confirmed it was free.
3. Whether ADR-022's amendment convention already existed in that file or whether
   you established it, and which precedent you followed.
4. Which risk rows you opened and which you judged already covered, with the row id
   that covers them.
5. Anything you concluded is **not** stale that this prompt assumed would be.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.**

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a
file against that file. Where it is wrong, **stop and report rather than working
around it.** Sessions 9 and 10 both found premises here that were false — one of
them by refusing to record a ruling it had been told to record — and both catches
were worth more than the work they interrupted.
