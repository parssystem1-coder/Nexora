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

## Phase 2.5: Commercial Growth

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

## Working Rules

- one vertical slice at a time
- the golden path is mirrored, never re-invented
- every PR names owning module, affected ADRs, and the pre-change checklist from `AGENTS.md`
- no broad refactor while implementing a feature
- migrations and contracts are reviewed before handlers
- tests are written at the same layer as the rule
- a phase exit is a test in CI, never a screenshot
- if a phase reveals a contradiction in these documents, stop and file it in `DECISION_LOG.md` rather than routing around it
