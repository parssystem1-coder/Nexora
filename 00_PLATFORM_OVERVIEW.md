# Platform Overview

**Version:** 2.0
**Status:** Product and Capability Overview

Companion documents:
- `01_ARCHITECTURE_BASELINE_RFC.md` - the architectural shape
- `02_ADR_INDEX_NORMATIVE_DECISIONS.md` - the binding technical decisions

---

## 1. The One-Sentence Version

A multi-tenant SaaS platform that lets a business create and run an online store without engineering, and that is built so the same platform core can later sell CRM, SEO, marketing, analytics, automation and AI products to the same customers without being rebuilt.

---

## 2. What This Is NOT

This is deliberately not a single e-commerce application. A store builder is the first product. It is not the ceiling.

| Single e-commerce app | This platform |
|---|---|
| One product, one revenue line | One core, many revenue lines |
| New feature = new code path | New feature = new domain on existing core |
| Growth requires rewrite | Growth requires addition |
| Billing is a checkout page | Billing is a plan, entitlement and usage engine |

If you build only a store builder, you compete on store features. If you build a platform, you compete on what the merchant can eventually do without leaving.

---

## 3. Who It Serves

### 3.1 The Merchant, the primary paying customer

A business owner or team that wants to sell online: a store that works without hiring developers, product and inventory and order management that does not break, their own domain and branding, payment collection from their buyers, and visibility into their business.

### 3.2 The Organization, the real tenant

Not every customer is one person with one store. The platform models an Organization that can contain multiple team members with different roles, own multiple stores under one account, and hold one subscription covering the whole organization. This is why the platform can sell to agencies, multi-brand retailers and enterprises, not only solo sellers.

### 3.3 The End Customer

Shops the storefront. Never sees the platform. Pays the store, not the platform. Has a store-scoped customer identity, never a platform user account (ADR-029).

### 3.4 The Developer, future

Builds plugins and integrations against a published SDK and capability API, and eventually sells them in a marketplace.

---

## 4. What The Platform Does Today, V1 Scope

### 4.1 Accounts and Teams

- create an account and an Organization
- invite team members
- assign roles: Owner, Admin, Manager, Editor, Support, Viewer
- one person can belong to several Organizations and switch between them
- every permission is data-driven, never hard-coded
- sessions are server-side and revocable the moment a role or membership changes

### 4.2 Subscriptions, Plans and Terms

- multiple plan tiers, configurable without a code deployment
- trials and add-ons
- plan versioning, so changing limits never silently rewrites what an existing customer already bought
- price versioning, so every invoice references the exact price it was sold at
- **fixed terms with real expiry.** A plan can be sold for a month or a year. When the term ends and the renewal is unpaid, the subscription enters a grace window, then stops serving.
- **renewal that works without stored-card recurring billing.** Invoice, notify at 30/14/3 days, accept payment, extend the term. Early renewal extends from the existing expiry date and never loses paid time.
- **self-service upgrade.** A customer can move to a higher tier immediately by paying the prorated difference, and their expiry date does not move.
- **downgrade at period end**, so nobody pays for a lower tier while using a higher one.
- **nothing is ever deleted by a billing event.** Downgrade, expiry and cancellation preserve all data.

### 4.3 Entitlements, Limits and Usage

Three separate concepts, deliberately never merged:

| Concept | Question it answers |
|---|---|
| Permission | Is this user allowed to do it? |
| Entitlement | Did this organization buy the right to do it? |
| Quota | How much of it can they consume? |

Usage is tracked in an append-only ledger, not a mutable counter, so billing and audit can always be reconstructed.

When a customer goes over a limit after a downgrade, the answer is always the same: keep the data, keep it readable, keep it exportable, block only new creation, and tell them exactly what changed and how to fix it.

### 4.4 Stores

- one Organization can own multiple stores
- each store has its own products, orders, customers, inventory, settings, theme and domains
- stores are isolated from each other even inside the same organization
- a store never goes offline because of a store-count downgrade

### 4.5 Catalog and Products

- products with variants, categories, brands and attributes
- pricing
- support for simple, variable, physical, digital and service product types

### 4.6 Inventory

- stock, reserved and available quantities as distinct values
- reorder points
- availability at checkout is always read live, never from a cache, so the platform does not oversell
- designed so multi-warehouse and supplier management can be added later without redesigning Product

### 4.7 Selling

- cart and checkout
- orders with a controlled lifecycle: draft, pending, confirmed, paid, processing, shipped, delivered, canceled, refunded
- customers, coupons, shipping and tax baseline
- payment collection from the end customer, kept completely separate from the merchant subscription billing
- **money is modelled properly**: integer minor units with an explicit currency, never a float, with a single rounding allocator so totals always reconcile
- **payments that survive reality**: the gateway callback is treated as a hint, the server verifies every payment against the provider, and a reconciliation sweep resolves every payment where the customer closed the browser

### 4.8 Storefront

- home, product listing, product detail, categories, search, cart, checkout, account, order history
- **built for speed from day one**: pages are statically generated and served from cache, invalidated by real domain events, so a product page does not touch the database on a cache hit
- custom domain support including apex, www and subdomains, with any TLD treated identically
- domain ownership proven by DNS verification, re-checked on a schedule
- certificate issuance and renewal is a monitored lifecycle with alerts, not a status field
- white-label branding gated by plan

### 4.9 Platform Plumbing Customers Never See But Always Feel

- background job processing so heavy work never blocks a page load
- reliable event delivery so nothing silently disappears
- outbound webhooks with signatures, retries, delivery logs and dead-letter handling
- an audit trail on every sensitive action
- full request tracing
- automated backups with a tested restore path
- one shared idempotency service, so a double-clicked payment does not charge twice
- a machine-enforced architecture: forbidden imports, tenant-column and RLS coverage, and money-column types are checked by CI, not by memory

---

## 5. What The Platform Grows Into

Each of these is architecturally reserved, not invented later. Detail lives in `future/`, deliberately out of the implementation context.

### 5.1 Additional Business Domains

| Domain | What it adds for the merchant |
|---|---|
| CRM | Leads, contacts, deals and pipeline on top of real order data |
| SEO | Metadata, audits, keyword data, recommendations, scoring |
| Marketing | Campaigns and customer messaging |
| Analytics | Business reporting across all domains |
| Accounting | Financial reporting and reconciliation |
| Booking | Appointment and service-based selling |
| Support | Customer service tied to order history |

Because identity, billing, permissions and usage already exist in the core, each new domain is a product launch, not a platform rebuild.

### 5.2 Automation

Event-driven rules the merchant configures. Automation never touches the database directly. It calls the same operations the UI calls.

### 5.3 Plugin Platform and Marketplace

Third-party developers extend the platform through a published SDK, with manifest-declared permissions, capabilities, events and UI extension points, and a controlled lifecycle.

Hard rule: the public marketplace does not open until untrusted plugin code runs in real isolation. Trusted internal plugins are a convention, not a security sandbox, and these documents never pretend otherwise.

### 5.4 AI Layer

AI is a plane of the platform, not a feature bolted onto a page: a proactive store co-pilot, a conversational store builder, predictive inventory and pricing suggestions, and explainability by contract, so three months later a merchant can still see why the AI suggested that price.

Governing rule: AI is suggestion-first. Autonomous execution requires an explicit opt-in and still passes the same approval and permission checks as a human action.

### 5.5 AI Credits

AI is metered as its own currency with an append-only ledger and a reserve-then-consume lifecycle, so a failed AI call releases its reservation instead of silently burning credit.

### 5.6 Public API and MCP

A versioned public REST API, and an MCP interface so external AI assistants can operate the platform on the merchant's behalf. MCP is treated as hostile by default: high-risk writes require platform-side approval the AI client cannot fake, and external MCP servers are untrusted data sources, never instructions.

### 5.7 Multi-Channel Commerce

First-class sync with external messaging and social commerce channels. An order arriving from a channel enters through exactly the same order creation path as the storefront. A channel is another doorway, not a second implementation.

### 5.8 Approval Center

The approval mechanism built for AI safety becomes a merchant-facing product: one unified log of every sensitive action awaiting or having received approval, whether it came from a team member, an automation or an AI agent.

### 5.9 Embedded Financial Services

Blocked until explicit legal and regulatory sign-off exists, regardless of engineering readiness. That is not caution theatre, that is the difference between a product and a lawsuit.

### 5.10 Enterprise Options

Dedicated database, workers or infrastructure per tenant; regional deployment for data residency; migration in both directions between shared and dedicated.

---

## 6. The Idea That Makes All Of This Possible

> A business operation is defined once and exposed through many interfaces.

```text
REST ------+
Admin UI --+
Storefront-+
AI --------+---> Capability ---> Application Service ---> Domain
MCP -------+
Automation-+
Plugins ---+
Channels --+
```

Why this is the whole ballgame: consistency, security, speed later, and AI safety. An AI agent is not privileged. It is a caller with fewer rights than a human admin, and it inherits every check.

The expensive mistake this avoids: platforms that implement order creation once for the UI, again for the API and a third time for an integration, then spend years reconciling three subtly different sets of business rules.

**One clarification added in 2.0:** the storefront has a separate optimized **read** path (ADR-032). Every storefront **write** still goes through the single canonical operation. Separating reads is a performance decision; it is not permission to duplicate a business rule.

---

## 7. Non-Negotiable Commitments

### 7.1 Tenant Isolation

One customer's data must never be reachable by another. Enforced at seven layers, ending in database-level row security as the last line of defence, never the first. Proven by automated release-blocking tests, including tests where a deliberately malicious plugin tries to cross the boundary, and tests where a forged `Host` header tries to reach another store.

### 7.2 Money Is Auditable

Usage, credits and invoices are ledger-based. Balances are derived, not trusted. Every amount carries a currency and is stored as an integer minor unit. Every invoice references the exact plan and price version it was sold under.

### 7.3 Subscription Billing and Store Payments Never Merge

| System | Money flow |
|---|---|
| SaaS Billing | Merchant pays the platform |
| Commerce Payment | Shopper pays the merchant |
| Financial Services | Platform and external credit partner |

Merging the first two is the single most common architectural mistake in store builders. It is prohibited here.

### 7.4 One Operation, Many Doorways

No interface may implement its own copy of business logic.

### 7.5 AI Is A Constrained Caller

Suggestion by default, explainable always, approval-gated for anything sensitive, metered on every billable call.

### 7.6 Deny Wins

When entitlement rules conflict, an explicit denial always beats any grant. No implicit interpretation.

### 7.7 No Billing Event Destroys Data

Downgrade, expiry, suspension and cancellation change what a tenant may do. Only an explicit, authenticated, logged deletion request changes what a tenant has.

### 7.8 A Rule Without A Check Is Not A Rule

Every architectural boundary in this pack that can be verified mechanically is verified mechanically, in CI, as a build failure. Prose alone does not survive a long implementation.

### 7.9 Build Only What Earns Its Keep

The long-term shape is fully documented. The V1 implementation is deliberately smaller. Boundaries and contracts are preserved on day one; heavy infrastructure waits until product reality demands it.

---

## 8. How Success Is Measured

**Phase 1, the platform core is real.** A person can create an account, form an organization, invite a teammate, and the system provably prevents them from touching another organization's data.

**Phase 2, the business model is real.** An organization can subscribe to a plan, receive the correct effective entitlements and limits, upgrade by paying the difference, and expire when its term ends unpaid.

**Phase 3 and 4, the product is real.** A merchant can build a store, list products, receive a real order from a real shopper on their own domain over their own certificate, and get paid, with every payment reconciled even when the shopper closed the browser.

**Beyond.** Every further phase adds a doorway or a domain. None of them require rebuilding what came before.

That last sentence is the entire point of the architecture.
