# Implementation Plan

**Version:** 2.0
**Goal:** ship a secure, sellable core without violating the architecture.

One vertical slice at a time. A phase is not complete until its exit criterion is proven by a test, not by a demo.

---

## Phase 0: Foundation Audit and Guardrails

**This phase produces no feature code.**

Deliver:

1. `REPOSITORY_AUDIT_REPORT.md` against the actual repository. If the repository is empty, every target area is marked `MISSING`; the audit is still produced. Classification per area: `MATCH | PARTIAL | MISSING | CONFLICT | UNKNOWN`.
2. Toolchain inventory and baseline: TypeScript, NestJS, Next.js, the query builder chosen in ADR-021, test runner, linter, formatter, Docker compose for PostgreSQL and Redis.
3. **Architecture conformance harness per ADR-030**, with a deliberately failing fixture for each rule.
4. Migration runner plus the single transaction and RLS-context helper.
5. Configuration and secret loading.
6. `DECISION_LOG.md`, `PROVIDER_MATRIX.md`, `RISK_REGISTER.md`.
7. Approved target directory structure matching `03_TECHNICAL_BLUEPRINT.md` section 2.

**Exit:** the harness fails a deliberately broken commit and passes a clean one; the audit is reviewed; Phase 1 scope is approved.

---

## Phase 1: Platform Foundation

Order:

1. repository and CI baseline
2. configuration and secret loading
3. PostgreSQL migrations and transaction helper
4. currency registry and `Money` value object with allocator (ADR-022), because Phase 2 cannot be retrofitted with it
5. clock abstraction and timezone helpers (ADR-031)
6. User, Organization, Membership, Store aggregates
7. authentication, credentials and server-side sessions (ADR-029)
8. authorization and data-driven role/permission model
9. trusted `TenantContext` middleware
10. repository tenant scoping
11. PostgreSQL RLS policies, fail-closed
12. audit events and structured observability
13. REST error model
14. **golden path slice `store.read`, hand-reviewed**
15. remaining slice steps: create organization, invite member, assign role, create store
16. vertical-slice integration tests against real PostgreSQL

**Exit:** Tenant A cannot read, write, delete or execute Tenant B data, including through a forged `storeId`, a forged session, or a query issued without tenant context. Proven by the tenant isolation suite in CI.

---

## Phase 2: Commercial Core

Order:

1. plan and plan version
2. price and price version
3. shared idempotency service (ADR-009)
4. subscription with explicit term, `subscription_periods`, and the derived serving-state function (ADR-024)
5. subscription state machine and append-only transition log
6. entitlement resolution with explicit DENY precedence (ADR-008)
7. quota policies, enforced at creation only
8. over-limit state and policy (ADR-026)
9. usage ledger
10. payment provider port with capability flags (ADR-023)
11. first provider adapter, plus a second stub adapter to prove the port
12. payment intent, verify, and the reconciliation sweep job
13. invoices referencing exact plan and price versions
14. renewal lifecycle jobs: notice, reminders, rollover, expire, deprovision, trial expiry
15. plan change: preview, upgrade with proration, scheduled downgrade, cancel scheduled (ADR-025)
16. reactivation after expiry
17. notification flows for every lifecycle event
18. concurrency and reconciliation tests

**Exit:** a subscription deterministically produces effective entitlement and quota; a one-year term expires at its calendar boundary after grace; an upgrade applies only after verified payment and does not move the expiry date; an abandoned payment is resolved by reconciliation; nothing is deleted by any billing event.

---

## Phase 2.5: Launch Readiness

**Renamed 2026-09-03 (was `Commercial Growth`), by amendment.** The phase was created that morning carrying discounts, referrals and tenant export, and widened the same day by ADR-054 to also carry snapshots, restore and drills. The old name described half of it. **Ruled: rename, do not split.** It is one coherent thing — *what must exist before the first paying tenant*: selling needs discounts and referrals, being trustworthy with their data needs export, restore and verified drills. Splitting would produce a Phase 2.6 and a second set of exit criteria for no gain, and would separate two halves that gate the same event. `PHASE_2_BRIEF.md` §9.9 carries the full statement.

**Added 2026-09-03 by amendment — the first dated amendment to this file, establishing the pattern here rather than following one.** Created because one of its decisions has a deadline inside Phase 2 (below); the phases above it are unchanged. `PHASE_2_BRIEF.md` §9 carries the full scope statement and this entry is the enumeration of it.

Order:

1. subscription discounts, bulk (all subscribers of a plan) and individual (one named subscriber)
2. referral codes: a subscriber's code, attribution, credit accumulating with successful referrals, applied to the referrer's next period
3. tenant data export as a capability with its own quota (ADR-020 rule 6, R-038)

**Order 1 before 2 is fixed, not a preference:** the referral reward is paid as a discount, so referral cannot be designed before the discount model exists.

**One deadline reaches back into Phase 2:** the discount decision must land **before Phase 2 item 13's migration**, because `invoices` and `invoice_lines` are append-only and migrations are forward-only (ADR-021 item 8) — adding a discount line afterwards is a data migration, not a schema change. Item 13 builds no discounts; it must only avoid foreclosing them.

**Amendment, 2026-09-03 (second this date) — ADR-054 adds per-tenant recovery to this phase.** `PHASE_2_BRIEF.md` §9.6–§9.8 carries the full statement.

4. nightly per-tenant snapshot job (ADR-054)
5. operator-run per-tenant restore, outside the application role, audited (ADR-054, ADR-034)
6. the recovery drill — a periodic automated restore into a sandbox that verifies the result, not merely that it ran
7. **object storage — the prerequisite of 4, 5 and 6**, which this platform does not have and no phase owns (R-025)

Items 4-6 **share a mechanism with item 3's export** — a snapshot and a tenant export are the same extraction on different schedules with different consumers, and ADR-054 rules that one is built, not two. They remain separate deliverables. They have no dependency on 1 or 2 in either direction; their only hard dependency is 7.

**Recovery granularity is the last nightly snapshot: a 24-hour RPO, with arbitrary per-tenant point-in-time recovery explicitly declined on cost.** RTO is deliberately unstated and owed to the first drill. Ledger-shaped tables are never rewound — an invoice issued after the snapshot point stays issued, and undoing it is a compensating entry.

**Not covered by this phase or any other: total cluster or server loss**, which needs physical backup and off-site replication. ADR-054 recommends a risk row for it and does not open one.

**Excluded, deliberately:** fraud scoring (ADR-052 accepts the trial abuse surface and names detection as the mitigation, owned by no current phase), marketplace and split payments, commerce coupons (a merchant's own coupons for their shoppers — `04` §3, Phase 3, a different subject), AI credit economy (D2-6).

**Exit:** a discount applies to a subscription and appears as its own line on an invoice without rewriting an issued one; a referral is attributed to exactly one referrer and its credit reaches that referrer's next period; a tenant can export their own data through a quota'd capability rather than an operator script.

---

## Phase 3: Commerce

Product, Variant, Category, Attribute, Brand, Pricing, Inventory with reservation, Customer with store-scoped identity, Cart, Checkout, Order with controlled lifecycle, Coupon, Shipping and Tax baseline, Commerce payment through the same port with store-scoped credentials.

**Exit:** a test customer creates a valid order without bypassing inventory or payment boundaries; concurrent checkout cannot oversell; an order reaches `PAID` only after server-side verification.

---

## Phase 4: Storefront and Domains

Order:

1. theme and store config contract
2. storefront read model and outbox projection (ADR-032)
3. host resolution with normalization, uniqueness and reserved names (ADR-028)
4. pages: home, listing, detail, category, search, cart, checkout, account, orders
5. domain add, DNS TXT verification, set primary, remove
6. certificate issuance, renewal job, failure alerting (ADR-027)
7. cache strategy and event-driven invalidation (ADR-019)
8. serving-state coupling: expiry de-routes domains and invalidates cache
9. load test against the ADR-010 assumptions

**Exit:** a cached product page serves with zero database queries; a `.ir` and a `.com` custom domain both serve over TLS through an identical code path; publishing a product invalidates only that store's keys; expiry stops the storefront within the defined bound.

---

## Phase 5: Capability and Event Platform

Code-first capability definitions, policy pipeline, transactional outbox hardening, workers, webhook delivery with signatures, retries and dead letters, generated OpenAPI artifacts.

---

## Phase 6+: Deferred Expansion

Plugins, AI, MCP, advanced automation, CRM, SEO, analytics, channels, marketplace and strategic modules, only when prerequisites and their ADRs are complete. Content lives in `future/`.

---

## Amendment, 2026-09-04 — competitive gaps, each placed in a phase

**Ruled by the maintainer on 2026-09-04** (`COMPETITIVE_RULINGS_2026-09-04.md`, ث-1 … ث-12), from a read-only review of a live competitor's admin panel, pricing page and public documentation.

**Evidence limit, carried from the ruling file because it bounds the comparison: one competitor was examined. This is a generalisation from a single observed instance plus general knowledge, not a comparative study.**

**Placed here rather than in an ADR, and that is deliberate.** Phasing belongs to this file. The precedent is consistent: **ADR-048 could not add a table to `PHASE_2_BRIEF.md` §4 and ADR-057 could not add a capability to §3** — both stated the obligation and left the owning document to discharge it. **An ADR may not place an item in a phase either.** The table spans seven phases, so it sits at the end of the phase list rather than inside any one of them; each phase's own section is unchanged.

**Nothing here is left as "we will see."** Every item has a phase or is explicitly excluded with a trigger.

| Id | Item | Phase | Why |
|---|---|---|---|
| ث-1 | Torob and Emalls integration | **Phase 4 — and a phase exit criterion** | A large share of Iranian storefront traffic arrives through these two. A store builder without them is not competitive, so this is a gate rather than a nice-to-have. |
| ث-2 | Mailboxes on the tenant's domain | **Phase 4 — delegated zones only** | An `MX` record is impossible without zone control (ADR-027's 2026-09-04 amendment, الف-9). |
| ث-3 | Multilingual sites | **Out of V1, with a trigger** | It multiplies every content table and every SEO decision. **The one place this platform deliberately stays behind.** Trigger: the first tenant with real export sales. |
| ث-4 | Support ticketing | **Phase 2.5 — bought, not built** | Needed from the first paying customer; building one takes weeks. An external tool at launch; build in-house only if volume justifies it. |
| ث-5 | Shipping carriers | **Phase 3 — as a port** | The same discipline as ADR-023: capability flags, an adapter, fixtures. **Never an `if` on a carrier's name.** |
| ث-6 | PWA application | **Phase 4** | Cheap, visible, and expected by the market. |
| ث-7 | Tenant-facing webhooks | **Phase 2.5** | `outbox_events` is already the substrate (ADR-050); exposing it is small and hands integration work to others. |
| ث-8 | Organization ownership transfer | **Phase 2.5** | With the constraint that **the buyer-identity snapshot on issued invoices is never rewritten** (ADR-057) — the invoice records who bought, not who owns now. |
| ث-9 | Template and designer marketplace | **Phase 4** | **A template is data, not code**, so it needs no new security boundary (پ-6, ADR-005). |
| ث-10 | Accounting-software bridge | **Phase 5** | Its prerequisite is gap-free invoice numbering, which **ADR-048 already ruled**. A sellable product, not a feature. |
| ث-11 | Installment / BNPL payment | **Flag now, adapter in Phase 3** | Installment is a payment *mode* and ADR-023's flags said nothing about it. `supportsInstallment` is added by that ADR's 2026-09-04 amendment and stays false in V1. |
| ث-12 | A published SLA | **Only after the first restore drill** | **A published number with no monitoring behind it is a commitment, not a feature.** Prerequisites: **R-041** (the first restore drill, which ADR-061 rules is what closes it) and **ADR-040**'s deferred metrics. After both, publish 99.9%. |

**ث-12 is the one to read twice.** ADR-010 already carries an availability *assumption* of 99.5% flagged by its own 2026-08-28 amendment as unverified, with a standing rule that no document may cite a number from that table as met before Phase 4 item 9 has run. **Publishing 99.9% is a different act from assuming 99.5%** — it is a commitment to an outside party — and this ruling gates it on the two things that would make it observable.

---

## Amendment, 2026-09-04 (second) — who bears the freight, what a rate is made of, and who may publish a price

**Ruled by the maintainer on 2026-09-04** (`COMPETITIVE_RULINGS_2026-09-04.md`, sections **ح** and **خ**), from the same read-only competitor review as the amendment above and taken after it. **Eleven rulings: two in ح, nine in خ.** The rulings file's own running total is 46 after ح and 55 after خ.

**The same evidence limit applies and is repeated rather than assumed inherited: one competitor was examined.** Where a ruling below refers to the market, that is a generalisation from a single observed instance plus general knowledge, **not a comparative study**.

**No ADR is written for any of these, deliberately.** Shipping has no port, no adapter and no ADR yet. **Ruling the design of a port nobody has drafted is precisely the failure a premature ADR causes** — it would fix answers to questions the first slice has not asked. These eleven are the *constraints that port's ADR inherits* when it is written, and recording them here keeps them binding without pretending the design is done. ح-2 likewise places a deliverable and does not write the capability's contract; that belongs to `05_API_CAPABILITY_CONTRACTS.md` when the capability is scoped.

**Carrier, courier and aggregator names in section خ are market context only.** They are recorded there as names in use on 2026-09-04 and are verified as nothing more. **No item below depends on any named company existing** — which is خ-1's entire point, and the reason none of them appears in this table.

### Phase 2.5 — plan and price administration

| Id | Item | Phase | Why |
|---|---|---|---|
| ح-2 | An operator-facing capability to **publish** a new plan version and a new price version | **Phase 2.5** | `00_PLATFORM_OVERVIEW.md` §4.2 promises tiers *"configurable without a code deployment"* and **R-032** records that nothing delivers it and no phase owns it. Until this exists a price change is a migration and a deploy — **acceptable before launch, unacceptable after it**, which is why the deadline is this phase rather than "later". |

**The word is *publish*, never *edit*, and that is a schema fact rather than a style preference.** `plan_versions` is described as immutable in `PHASE_2_BRIEF.md` §4's own scope table — *"immutable versioned plan definition"* — and §2 item 3 calls the aggregate *"a versioned, immutable aggregate"* whose immutability boundary *"propagates into `prices`, `subscriptions`, `invoices` and `subscription_changes`."* **Administration therefore means appending a version, and the capability's contract must not contain the word "edit."**

**Three constraints it inherits, each verified against its source rather than taken from the ruling file:**

- **ADR-047 holds.** Its ruling item 2 binds the price at *"the issuance of the renewal invoice — T-30d per ADR-024 item 4 — not `period_end`"*, and item 4 states the rule in one line: *"the price is the invoice's; the invoice's price is the version current when the invoice was issued."* **So publishing a price version does not touch a live subscription**; each is re-priced at its own next renewal invoice. A version published between T-30d and `period_end` does not move an already-issued invoice, and ADR-047's verification list already requires a test proving it.
- **`plan_versions` immutability holds**, as quoted above.
- **ب-5 holds** as this file's previous amendment and ADR-047's own 2026-09-04 amendment recorded it: each term length is its own price version, with the discount **stored rather than computed**. **The administration surface therefore publishes a price per term, not a price plus a percentage** — the same reason ADR-022 item 2 forbids floating-point money, reached from the other end.

**R-032 carries a dated addendum naming this as its owner and deadline.** That row's original trigger was *"the first paying customer needing a tier or price change, or the scoping of Phase 3"*; this ruling replaces a trigger with a phase, which is a tightening.

### Phase 3 — the shipping constraints, beside ث-5's carrier port

**ث-5 above places shipping carriers in Phase 3 as a port with capability flags, an adapter and fixtures, and *"never an `if` on a carrier's name."* The ten items below are what that port must be shaped to allow.**

| Id | Item | Phase | Why |
|---|---|---|---|
| ح-1 | A shipping method carries a **cost-bearer** attribute — prepaid (پیش‌کرایه), collect (پس‌کرایه), or cash on delivery — and **only a prepaid method contributes a freight amount to an order total, a payment intent or an invoice** | **Phase 3** | These are three answers to *who pays the carrier*, not three payment methods. For پس‌کرایه the platform never receives the freight, and `invoices` is append-only, so **a figure we never collected could never be corrected out of a document later**. Where freight is collected at delivery, any checkout figure is an **estimate, labelled as one**, outside `Money` arithmetic and outside the payment port. |
| خ-1 | **A merchant-defined carrier is first-class, not a fallback.** Two classes: an *integrated* carrier bound to an adapter, and a *manual* carrier — a name the merchant types and a rate table they fill in — optionally with a tracking-URL template | **Phase 3** | A large share of real Iranian merchants ship through a local باربری with no API. **A model that serves only integrated carriers is unusable for the merchants who most need a store builder.** The tracking template is what makes "track my parcel" work for a carrier the platform has never heard of. |
| خ-2 | **Rate rules are data, not code**: a rate source, a bracket dimension, ordered `(from, to, amount)` rows, and modifiers — composed per method and per zone | **Phase 3** | See below; this is the one with a named analogue. |
| خ-3 | **Zones are merchant-defined, and a destination no zone covers makes the method unavailable — never free** | **Phase 3** | City granularity inside Tehran and province granularity elsewhere is the merchant's choice, not the platform's. **A silent zero is how a merchant ships for free without knowing**, so an uncovered destination hides the method. |
| خ-4 | **The shipping amount is snapshotted on the order and on the invoice** | **Phase 3** | ADR-055's argument, applied to a second figure. |
| خ-5 | **A rate quoted at checkout binds the merchant**; a carrier's variance at handover is the merchant's, never re-charged to the customer without a new document | **Phase 3** | ADR-056's correction path is the only path. |
| خ-6 | **A free-shipping threshold is computed on the goods subtotal, after discount and before tax** | **Phase 3** | Decided explicitly because every reading is defensible and only one can be implemented. |
| خ-7 | **Insurance and packaging are their own order lines**, never folded into the shipping amount | **Phase 3** | ADR-044's ruling requires an invoice line to carry *"its own denormalized description text, captured at issuance"*; a line whose description must cover freight *and* insurance *and* packaging cannot honestly do that. A merchant reconciling against a carrier and a customer asking what they paid both need the parts separable. |
| خ-8 | **One adapter may expose several named services.** The port must not assume one adapter equals one carrier | **Phase 3** | A statement about the **port's shape**, not about any vendor — see below. |
| خ-9 | **Volumetric weight is the adapter's business or the merchant's, never the domain's** | **Phase 3** | Carriers price on the greater of actual and volumetric weight, each with their own divisor, and those divisors change. An integrated adapter applies its carrier's rule; a manual method uses whatever the merchant typed. **The domain never computes one**, for the same reason it never holds a provider's field names (ADR-023 item 9). |

**ح-1's trap, recorded because it is the mistake this ruling exists to prevent.** It is tempting to add a پس‌کرایه flag to ADR-023's `PaymentProviderCapabilities`. **Do not.** In that arrangement the freight never crosses the payment port at all — the buyer hands cash to the carrier — so modelling it as a payment capability **would put money the platform never touches inside the payment domain**. The cost bearer is an attribute of the *shipping method*. The related discipline that does carry over is item 1's: **the shipping port declares which modes each carrier supports, and application code branches on the declared capability rather than on a carrier's name.**

**And the corollary that makes ح-1 worth recording two phases early:** پس‌کرایه is the *simplest* of the three for this platform — goods still flow through the ordinary redirect-and-verify path and only the freight sits outside — while **COD is the hard one**, because the money arrives through the carrier rather than through any payment provider and **ADR-023's payment-intent model does not describe it at all**. Recording the distinction now prevents building COD's machinery for پس‌کرایه.

**خ-2 is the shipping analogue of ADR-023's *Adding a new provider* section, and is recorded with the same shape of claim so the two read as one discipline.** That section requires a new gateway to cost *"one adapter, one capability declaration, one credential schema, one fixture-based test suite, and one configuration entry"* with *"Zero changes to Application, Domain, or any other adapter."* **Here the equivalent cost is lower still: a merchant composing "50,000 within Tehran, 90,000 elsewhere, free above 2,000,000" costs zero code and no deployment.** The rate source is one of `TABLE`, `CARRIER_QUOTE`, `FREE` or `COLLECT` (ح-1's case, where no amount exists); the bracket dimension for `TABLE` is one of `NONE`, `WEIGHT`, `SUBTOTAL` or `ITEM_COUNT`. **The test of the shape is that adding a new commercial arrangement must not mean adding a new rate type** — flat, conditional-free, weight tiers, per-item, زون‌بندی, cart-value tiers, live quotes and in-store pickup are all compositions of what is already there.

**خ-4, خ-5 and خ-6 each rest on an existing decision, and each was checked against it rather than assumed.**

- **خ-4 — ADR-055 holds, and the argument is verbatim its own.** That ADR states *"Every figure needed to reconstruct the charge must be on the row at insert time"* and, of the snapshot columns, *"an issued financial document is self-contained or it is not trustworthy."* It already names this as one principle behind three decisions — its own tax columns, ADR-044's line description, ADR-048's number. **A shipping amount is a fourth figure with the same property**: a rate table can change after the order, and the record must reproduce what was charged rather than what the table now says.
- **خ-5 — ADR-056 holds, and the reason is a database privilege rather than a policy.** That ADR records that `PHASE_2_BRIEF.md` §5 revokes `UPDATE` and `DELETE` on `invoices`, so *"the application role therefore cannot void an issued invoice in place at all"* and *"the correction path is a new document, necessarily."* **A carrier's variance at handover is therefore the merchant's** unless a correction document is issued, and ADR-056 is explicit that corrections *"exist for corrections, not for absorbing a carrier's variance"* is the reading its own item 4 supports. One scope note: **ADR-056 rules that Phase 2 issues only `INVOICE`**, so the mechanism خ-5 relies on is available by the time shipping exists in Phase 3, not before.
- **خ-6 — ADR-055 holds for the *before tax* half, which is the half that needed an argument.** ADR-055 part 5 rules the rate into a dated append-only table precisely because *"Iran's VAT rate has actually changed within the platform's own planning horizon"*. **A threshold computed on a tax-inclusive figure would therefore move silently when the rate changed** — the same customer, the same basket, a different answer, with nothing in the order to explain it. The *after discount* half rests on no ADR and is a plain commercial judgement: a customer earns free shipping on what they actually pay for goods.

**خ-8 is about the port and must not be readable as a vendor decision.** Some Iranian shipping aggregators front several carriers behind one integration; **where that is true, one adapter exposing several named services is less code, one credential and one fixture suite than several adapters.** The ruling is that **the port's shape must permit it** — an adapter is not assumed to equal a carrier. It selects no aggregator, names none in this table, and commits the platform to nothing about whether such an integration is ever used.

---

## Working Rules

- one vertical slice at a time
- the golden path is mirrored, never re-invented
- every PR names owning module, affected ADRs, and the pre-change checklist from `AGENTS.md`
- no broad refactor while implementing a feature
- migrations and contracts are reviewed before handlers
- tests are written at the same layer as the rule
- a phase exit is a test in CI, never a screenshot
- if a phase reveals a contradiction in these documents, stop and file it in `DECISION_LOG.md` rather than routing around it
