# Architecture Gap Report

**Version:** 2.0
**Baseline:** documentation pack 2.0, reviewed 2026-08-22
**Verdict:** architecturally strong, and now implementable. Implementation readiness of the application repository remains UNKNOWN until the Phase 0 audit is produced.

---

## 1. What version 1.0 got right

Recorded so it is not accidentally undone: layered ownership, interface convergence, tenant isolation depth, ledger-based money, plan and price versioning, separation of billing from commerce payment, MCP treated as hostile, plugin honesty about in-process isolation, and explicit DENY precedence. These are kept unchanged.

---

## 2. Gaps closed in 2.0

| # | 1.0 gap | Closed by |
|---|---|---|
| 1 | Self-blocking audit requirement: feature work blocked on an audit of a repository that does not exist | `AGENTS.md` section 0, Phase 0 |
| 2 | Database access and ORM never chosen, while RLS and domain purity were both required | ADR-021 |
| 3 | Authentication provider and session strategy undecided while Phase 1 depended on it | ADR-029 |
| 4 | NFRs open and blocking Phase 0 exit | ADR-010, accepted with revisit triggers |
| 5 | Twelve ADRs marked OPEN, most for unbuilt systems, creating false blockers | `DEFERRED` status, `future/` folder |
| 6 | Architecture rules existed only as prose, unenforceable over a long task | ADR-030 |
| 7 | No file-level conventions for an automated implementer | Technical Blueprint 2.1 |
| 8 | Storefront performance deferred to Phase 4 despite constraining Phase 1 | ADR-019, ADR-032 |
| 9 | RLS transaction-local context versus connection pooling never reconciled | ADR-021 item 6, Blueprint 11 |
| 10 | Money and currency never modelled anywhere | ADR-022 |
| 11 | Payment abstraction assumed webhooks and stored-credential recurring | ADR-023 |
| 12 | No reconciliation path for abandoned payment callbacks | ADR-023 item 4 |
| 13 | Subscription term, period, expiry mechanism never modelled | ADR-024 |
| 14 | No plan change or upgrade capability; proration undefined | ADR-025 |
| 15 | Over-limit behaviour after downgrade undefined | ADR-026 |
| 16 | Renewal, notice and grace mechanism absent | ADR-024 items 4 and 8 |
| 17 | No coupling between subscription expiry and storefront/domain serving | ADR-024 item 9 |
| 18 | Time, timezone and calendar model absent | ADR-031 |
| 19 | No domain table anywhere despite promised domain features | Database Blueprint 2.7 |
| 20 | Verification method, apex routing and certificate lifecycle undefined | ADR-027 |
| 21 | No platform-global uniqueness for verified hostnames | ADR-028 item 1, Constraints |
| 22 | Host header treated as trusted input | ADR-028 items 3 and 4 |
| 23 | IDN and punycode handling absent | ADR-028 item 5 |
| 24 | No reserved subdomain blocklist | ADR-028 item 7 |
| 25 | Email domains conflated with web domains | ADR-027 item 8 |
| 26 | Domains absent from quota and entitlement | ADR-027 item 9 |
| 27 | Retention, deletion and offboarding open | ADR-020 |
| 28 | Scheduled jobs treated as operational detail rather than deliverable | RFC 38, Phase 2 |

---

## 3. Gaps that remain open, by design

These are honest unknowns. None blocks Phase 1.

1. **Repository and toolchain audit** is not included and cannot be. It is Phase 0 output, produced against real code.
2. **Exact database columns** per module are finalized during that module's slice. The blueprint fixes ownership, constraints and rules, not every column.
3. **Concrete provider selection** for payment, DNS, CDN, certificates and notifications. The ports are decided; the vendors are an integration-time decision recorded in `PROVIDER_MATRIX.md`.
4. **Market-specific operational constraints** for registries, nameserver delegation and certificate availability must be verified against the chosen providers at integration time. They change over time and must not be baked into the domain model or assumed from documentation.
5. **Generated OpenAPI and JSON Schema artifacts** do not exist until handlers exist. Required before any external integration.
6. **Backup restore drill and tenant-level recovery** are goals until executed once. Required before production.
7. **Load characteristics** are assumptions in ADR-010 until measured. Revisit triggers are defined.
8. **Deferred ADR-011 through ADR-018** remain undecided intentionally.

---

## 4. Agent Readiness

The pack is agent-ready when, and only when:

- [ ] `AGENTS.md` 2.0 is the agent's first-loaded document
- [ ] `08_PHASE_1_BRIEF.md` is the only scope given for the first task
- [ ] the conformance harness (ADR-030) exists and runs locally
- [ ] the golden path slice exists and is hand-reviewed
- [ ] `future/` and the source master spec are excluded from the working context
- [ ] deferred ADRs are excluded from the working context

Handing all ten documents to an agent at once is a known failure mode: it produces rule amnesia and premature abstraction. Do not do it.

---

## 5. First Three Agent Tasks

1. Produce `REPOSITORY_AUDIT_REPORT.md` and the conformance harness. **No feature code.**
2. Implement the Phase 1 golden path `store.read` end to end, hand-review it, then complete the remaining Phase 1 slice steps.
3. Run architecture conformance and the tenant isolation suite, update contracts and generated artifacts, then request approval for Phase 2.

---

## 6. Release Blockers

A release must not proceed while any of these is true:

- any tenant isolation failure, including plugin and forged-host scenarios
- missing RLS coverage on a tenant-owned table
- RLS that reads as permissive when tenant context is absent
- direct repository access from another module, AI, MCP, plugin, automation or storefront
- secret in source control, in an image, in a log or in an API response
- duplicate idempotency mechanism
- floating-point monetary column
- a payment marked paid without server-side verification
- a pending payment older than the reconciliation threshold with no sweep
- a storefront still serving after subscription expiry
- a billing state change that deletes tenant data
- certificate renewal failure without alerting
- two tenants able to hold the same verified hostname
- an unknown host resolving to a default store
- failed migration or failed restore drill
- accepted ADR violation
- conformance harness disabled, skipped, or carrying an unjustified suppression

---

## 7. Audit Placement

`REPOSITORY_AUDIT_REPORT.md` belongs at the root of the actual application repository. It must not be fabricated from this documentation pack. It must inspect source code, configuration, dependencies, database setup, migrations, tests, CI/CD and deployment files.

Feature development is blocked until the audit is reviewed and Phase 1 scope is approved. The first implementation slice is limited to: User, Organization, Membership, Role/Permission, Store, `Money`, clock, trusted `TenantContext`, authentication and sessions, authorization, PostgreSQL RLS, audit events, REST API and integration tests.
