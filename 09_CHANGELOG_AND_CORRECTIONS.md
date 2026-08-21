# Changelog and Corrections, 1.0 to 2.0

Every correction, its origin, and where it now lives. Nothing from 1.0 was silently dropped. Clauses were kept, corrected, or explicitly reclassified as deferred.

---

## A. Agent implementability

| # | Finding in 1.0 | Correction |
|---|---|---|
| A1 | The gap report blocked all feature work on `REPOSITORY_AUDIT_REPORT.md` while stating no application repository existed. Circular and unsatisfiable. | `AGENTS.md` section 0 and Phase 0 define the audit against actual state: trivial when empty, never fabricated, never a reason to stall. |
| A2 | ORM never named, while domain purity and transaction-local RLS were both mandatory. | **ADR-021**: SQL-first typed query builder, explicit mapper, single RLS helper, pooler transaction mode only. |
| A3 | Auth provider and session strategy listed as undecided while Phase 1 depended on it. | **ADR-029**: first-party identity, Argon2id, server-side revocable sessions, opaque cookies, separate customer identity. |
| A4 | ADR-010 was OPEN and blocked Phase 0 exit while providing no value at zero traffic. | **ADR-010 ACCEPTED** with explicit design assumptions and measurable revisit triggers. |
| A5 | Twelve ADRs marked OPEN, most for systems nobody is building, indistinguishable from real blockers. | New `DEFERRED` status. ADR-011 to ADR-018 moved to `future/DEFERRED_ADRS.md`. |
| A6 | All architecture rules existed only as prose. 1.0 itself admitted CI import rules were not implemented while two ADRs depended on them. | **ADR-030**: conformance harness ships before the first feature, build-failing, with a failing fixture per rule. |
| A7 | Module layout given, but no file-level conventions. An agent had nothing to imitate. | Technical Blueprint 2.1 file conventions, plus the mandated hand-reviewed golden path `store.read`. |
| A8 | No guidance on context budget. The natural move is to load all ten documents and drown. | `README_START_HERE.md` context budget rule, `08_PHASE_1_BRIEF.md`, explicit exclusion list. |

---

## B. Storefront performance

| # | Finding in 1.0 | Correction |
|---|---|---|
| B1 | Storefront caching and domain delivery were OPEN and scheduled for Phase 4, although they constrain Phase 1 decisions. | **ADR-019 ACCEPTED**, decided in Phase 0, implemented in Phase 4. |
| B2 | One request pipeline applied to anonymous storefront traffic: authentication, full policy chain and per-request RLS context on every page view. | **ADR-032**: separated read path, cached read model, zero database connections on a cache hit. Writes unchanged. |
| B3 | Transaction-local RLS context versus connection pooling never reconciled. Statement-mode pooling would break it silently. | ADR-021 item 6 plus Blueprint 11: transaction mode only, separate pools, replica for uncached reads. |
| B4 | No rendering or invalidation strategy. | ADR-019 items 1 to 3: static generation with on-demand revalidation driven by outbox events, per-store keys, explicit invalidation event list. |
| B5 | CDN and DNS implicitly assumed one global vendor. | ADR-019 item 4 and ADR-027 item 6: `CdnProvider`, `DnsProvider`, `CertificateProvider` ports. Vendor choice is configuration, recorded in `PROVIDER_MATRIX.md`. |
| B6 | Nothing prevented a cached storefront outliving a paid subscription. | ADR-019 item 7 and ADR-024 item 9: expiry removes the store from the serving set and invalidates cache. |
| B7 | Stale-read risk to inventory unaddressed. | ADR-032 item 5: catalog may be stale within a bound, checkout availability is always live from the primary. |

---

## C. Payments and money

| # | Finding in 1.0 | Correction |
|---|---|---|
| C1 | Money and currency were never modelled anywhere, while plans, prices, invoices, orders, refunds, coupons, shipping and tax all handle money. | **ADR-022**: `Money` value object, integer minor units, per-currency scale from a `currencies` table, float prohibited and CI-checked, one remainder-distributing allocator, no cross-currency arithmetic, string amounts on the wire. |
| C2 | The payment abstraction implicitly assumed webhooks, stored credentials and recurring charges. | **ADR-023**: capability flags on the port, redirect-and-verify as the normative flow, startup failure when code assumes an unavailable capability. |
| C3 | Nothing handled a gateway without webhooks, or a customer who closes the browser after paying. | ADR-023 item 4: mandatory scheduled reconciliation sweep, idempotent, escalating to a human queue after bounded attempts. |
| C4 | The callback was implicitly trusted as proof of payment. | ADR-023 item 3: callback is a hint. Only a server-side verify moves state, and a success claim without verify is logged as a security event. |
| C5 | No amount or currency verification against the provider response. | ADR-023 item 5: mismatch is a hard failure and a security event. |
| C6 | Subscription renewal assumed a chargeable stored credential. | ADR-023 item 6 plus ADR-024 item 4: invoice-and-notify renewal where recurring is unsupported. |
| C7 | Billing and commerce provider credentials were not separated in practice. | ADR-023 items 7 and 8: two registries, platform-scoped versus store-scoped secrets, mutually unreachable. |
| C8 | Adding a gateway had no defined cost. | ADR-023 closing rule: one adapter, one capability declaration, one credential schema, one fixture suite, one config entry, zero changes elsewhere. |

---

## D. Subscription lifecycle

| # | Finding in 1.0 | Correction |
|---|---|---|
| D1 | `subscriptions` had no period start, period end or term length. `EXPIRED` was a name with no mechanism. Fixed-term selling was unimplementable. | **ADR-024** plus `subscription_periods`, append-only. |
| D2 | Only `plan.subscribe` existed. No upgrade, downgrade, renew or change capability. | **ADR-025** plus `plan.change`, `plan.change.preview`, `plan.change.cancel_scheduled`, `subscription.renew`, `subscription.reactivate`. |
| D3 | `proration` appeared once as a word and was never defined. | ADR-025 item 3: explicit formula, expiry date preserved on upgrade, allocator-based rounding, floored at zero. |
| D4 | No renewal notices, grace window or expiry mechanism. | ADR-024 items 4 and 8: notice at 30/14/3 days, 7-day default grace, six named idempotent lifecycle jobs. |
| D5 | Nothing connected expiry to storefront cache or domain routing. | ADR-024 item 9: ordered deprovisioning. A storefront outliving expiry is release-blocking. |
| D6 | Over-limit behaviour after downgrade was undefined, inviting a destructive implementation. | **ADR-026**: preserve data, keep reads and export, block creation only, never hide a live storefront, special cases for seats and stores. |
| D7 | Time and calendar model absent, so annual boundaries would drift by a day. | **ADR-031**: UTC storage, declared billing timezone, calendar arithmetic not day counting, half-open periods, injected clock, presentation-only calendar rendering. |
| D8 | No state machine, so illegal transitions were reachable. | ADR-024 item 3 plus `subscription_state_transitions`. |
| D9 | Early renewal semantics unspecified. A naive implementation loses paid time. | ADR-024 item 5: extend from `period_end`, never from the payment date. |
| D10 | No reactivation path after expiry. | ADR-024 item 6: bounded reactivation window restoring store, domains and data. |

---

## E. Domains and TLS

| # | Finding in 1.0 | Correction |
|---|---|---|
| E1 | Domain features were promised across three documents and **no domain table existed** in the database blueprint. | Database Blueprint 2.7: `store_domains`, `store_domain_certificates`, `email_sending_domains`, `reserved_subdomains`. |
| E2 | Verification method never chosen. | ADR-027 item 2: DNS TXT primary, HTTP file fallback, CNAME presence explicitly rejected as proof of ownership. |
| E3 | Apex domains cannot use CNAME and no routing decision existed. | ADR-027 item 3: published A/AAAA target for apex, CNAME for www and subdomains, ALIAS used where available and never assumed, apex target treated as a public contract. |
| E4 | SSL status treated as a field, not a lifecycle. | ADR-027 item 4: issuance, renewal margin, bounded retry, alerting and escalation before expiry, wildcard for tenant domains out of V1 scope. |
| E5 | The difference between `.ir` and `.com` was never addressed. | ADR-027 item 5: TLD-neutral code path asserted by test. Item 6: what varies per market is the DNS, CDN and certificate provider, verified at integration time in `PROVIDER_MATRIX.md`. |
| E6 | No hostname uniqueness rule. Two tenants could claim one hostname. | ADR-028 item 1 and Database Constraints: platform-global unique verified hostname. |
| E7 | Unverified claims could squat on a hostname the real owner needed. | ADR-028 item 2: pending claims expire, first to verify wins, competing claims invalidated with notice. |
| E8 | The `Host` header was treated as trusted input, with no rule against a default-store fallback. | ADR-028 items 3 and 4: exact match only, no wildcard or suffix match, unknown host returns 404, read-only storefront context that cannot be upgraded. |
| E9 | IDN and punycode absent, so the unique index would be defeated by two encodings. | ADR-028 item 5: canonical punycode storage, single normalization entry point, mixed-script flagged. |
| E10 | One-time verification only. | ADR-028 item 6: scheduled re-verification, de-routing on repeated failure. |
| E11 | No reserved subdomain list, so a store could be named `admin` or `api`. | ADR-028 item 7: versioned blocklist as data, checked at slug and domain creation. |
| E12 | Removal left routing and cache entries dangling. | ADR-028 item 8. |
| E13 | Email domain conflated with web domain under White Label. | ADR-027 item 8: separate entity with its own SPF, DKIM and DMARC lifecycle. |
| E14 | Domains were missing from the quota list. | ADR-027 item 9 and RFC 17: `domains` added as a quota resource, custom domain remains entitlement-gated. |

---

## F. Cross-cutting additions

| # | Addition | Where |
|---|---|---|
| F1 | ADR-008 written out in full: precedence order, ABSOLUTE and DELTA semantics, fail-closed conflict, explainability. | ADR-008 |
| F2 | ADR-009 written out in full: identity, lifecycle, PostgreSQL authority, Redis as optimization only. | ADR-009 |
| F3 | Retention, deletion and offboarding closed with a four-state model and two-phase deletion. | ADR-020 |
| F4 | Scheduled jobs elevated from operational detail to named V1 deliverables. | RFC 38, Phase 2 |
| F5 | Alerting requirements made explicit, including certificate renewal failure and reconciliation backlog. | RFC 40, Blueprint 12 |
| F6 | Indexing baseline for every hot lifecycle sweep and for host resolution. | Database Blueprint 8 |
| F7 | New error codes for subscription, plan change, over-limit, payment verification and domain failures, with mandatory `details` on limit errors. | Contracts 7 |
| F8 | Test layering table, so a rule is always tested where it lives. | `AGENTS.md` 8 |
| F9 | Generated OpenAPI and JSON Schema artifacts required and drift-checked in CI. | Contracts 1 and 8 |
| F10 | Release blocker list expanded from 7 items to 17. | Gap Report 6 |

---

## G. Deliberately unchanged

Kept exactly as written in 1.0 because they were already correct: interface convergence as the central rule, layered dependency direction, seven-layer tenant isolation with RLS last, ledger authority for usage and credits, plan and price versioning with invoice pinning, strict separation of SaaS billing from commerce payment, MCP hostile by default with platform-side approval, external MCP output as data and never instructions, in-process plugins explicitly not a security sandbox with release-blocking isolation tests, capability as a contract rather than a logic layer, and build only what earns its keep.

---

## H. Known limitation of this package

`99_SOURCE_MASTER_SPEC_v1.2.md` here is a stub. That file is historical and traceability-only. Drop your original copy in at that path if you want the full history preserved. No decision in this pack depends on it, and precedence places it last.
