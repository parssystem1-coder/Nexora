# Architecture Gap Report

**Version:** 2.0
**Baseline:** documentation pack 2.0, reviewed 2026-08-22
**Verdict:** architecturally strong, and now implementable. Implementation readiness of the application repository remains UNKNOWN until the Phase 0 audit is produced.

> **⚠️ Read §8 before acting on §3, §4, §5 or §7.** This document was written against a Phase 1 that had not started and has since closed. §1, §2 and §6 remain accurate as written. **§8 (added 2026-09-01) carries the currency amendment** — which of the open gaps are now closed, which remain, and which are superseded by a register row or an ADR that now owns them. Nothing above §8 has been edited or deleted; per this repository's convention for historical records, superseded claims stay visible and are corrected by a dated addition.

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

---

## 8. Currency amendment, 2026-09-01

**Why an amendment and not a rewrite.** §1, §2 and §6 — the largest sections and the ones carrying the most durable content — are still accurate as written and need no change. §2's 28-row record of what the 2.0 pack fixed relative to 1.0 is historical provenance that is not reproducible and must not be discarded. What went stale is narrower: §3's item-level status, §4's readiness checklist (now all met, and one item superseded), §5 (complete), and §7 (complete). Those are corrected here, in place, with the originals left standing. A wholesale rewrite of a numbered pack document would be a maintainer decision rather than an implementer's, and it is not warranted — the stale fraction does not justify discarding the rest.

### 8.1 §3 "Gaps that remain open, by design" — current status

| §3 item | Status at 2026-09-01 | Evidence / owner |
|---|---|---|
| 1. Repository and toolchain audit not included | **CLOSED** | `REPOSITORY_AUDIT_REPORT.md` exists at the repository root, produced against real code, as `AGENTS.md` §0 requires. |
| 2. Exact database columns finalized per slice | **OPEN, by design — unchanged** | Restated deliberately in `PHASE_2_BRIEF.md` §8, which names tables, owners and tenancy but not columns. |
| 3. Concrete provider selection | **OPEN, and now scoped** | Superseded in part by decision **D2-3**: Phase 2 builds the port and a fixture-modelled adapter; commercial selection and live credentials stay Phase 3/4. `PROVIDER_MATRIX.md` was corrected 2026-09-01 (its Phase 3/4 citation did not hold up — **R-015**). |
| 4. Market-specific operational constraints | **OPEN, by design — unchanged** | Still an integration-time verification, still must not be baked into the domain model. |
| 5. Generated OpenAPI and JSON Schema artifacts do not exist until handlers exist | **CLOSED** | `openapi.json` exists, is generated from Zod + `CapabilityDefinition` (ADR-033), is committed, and CI fails on drift (`npm run openapi -- --check`). |
| 6. Backup restore drill and tenant-level recovery | **OPEN — unchanged** | Still a goal until executed once. Still required before production. |
| 7. Load characteristics are assumptions until measured | **OPEN, and now normatively stated** | Superseded by **ADR-010's 2026-08-28 amendment**, which rules its numbers are unverified assumptions that may not be cited as met figures, measurable at `06` Phase 4 item 9. See also **R-010** and **ADR-040 (`OPEN`)**. |
| 8. Deferred ADR-011 … ADR-018 remain undecided | **OPEN, by design — unchanged** | Still excluded from every working context by `AGENTS.md` §1. |

**Two of eight closed; five unchanged; one (item 7) now owned by an ADR amendment rather than by this report.**

### 8.2 §4 "Agent Readiness" — all six met, one superseded

Every checkbox in §4 is now satisfied. One is superseded rather than simply ticked:

- *"`08_PHASE_1_BRIEF.md` is the only scope given for the first task"* — **superseded 2026-08-28.** Phase 1 closed; `AGENTS.md` §1 item 2 now names **`PHASE_2_BRIEF.md`** as authority #2, with `08_PHASE_1_BRIEF.md` retained as the closed phase's record because its §5 RLS exemption list still explains the existing schema's tenancy. The *rule* §4 states — exactly one brief is the scope for the current task — is unchanged and still holds.
- The other five (`AGENTS.md` loaded first; harness exists and runs; golden path exists and was hand-reviewed; `future/` and the source master spec excluded; deferred ADRs excluded) are met and were verified across three Phase 1 gate reviews and `PHASE_2_ENTRY_REVIEW_2026-08-28.md`.

§4's closing warning — that handing an agent all ten documents at once produces rule amnesia and premature abstraction — remains in force and is echoed by `CLAUDE.md`'s read-order section.

### 8.3 §5 "First Three Agent Tasks" — complete

All three are done, and are recorded rather than removed:

1. `REPOSITORY_AUDIT_REPORT.md` and the conformance harness — **done** (7 rules, 23 fixture directories).
2. The golden path `store.read`, hand-reviewed, then the remaining Phase 1 slices — **done**; ten capabilities across eleven routes (one is `/health`, not a capability).
3. Conformance, the tenant isolation suite, generated artifacts, and approval for Phase 2 — **done**; the Phase 1 gate opened 2026-08-27 (`PHASE_1_GATE_OPEN_2026-08-27.md`) and Phase 2 opened 2026-08-28.

**This section is now historical.** The current equivalent is `PHASE_2_BRIEF.md` §2's reference slice (`06` item 1, `plan.list`) and its two review stops.

### 8.4 §6 "Release Blockers" — unchanged and still binding

Every item in §6 remains a release blocker as written; none is met and none is withdrawn. Two now have an explicit owner worth naming, because a blocker with no owner is how one gets missed:

- *"certificate renewal failure without alerting"* — no alerting of any kind exists (**R-010**); **ADR-040 (`OPEN`)** owns where the observability boundary sits.
- *"a duplicate idempotency mechanism"* — enforced mechanically today (`SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE`), and **ADR-038** now governs how a capability composes with the single shared store without creating one.

### 8.5 §7 "Audit Placement" — complete

The audit exists at the repository root and was produced against real code. Its stated precondition — "feature development is blocked until the audit is reviewed and Phase 1 scope is approved" — was satisfied before Phase 1 began. The first-slice scope it enumerates matches what Phase 1 actually built.

### 8.6 What this amendment did not check

- It did not re-verify §2's 28 closed-gap rows against their ADRs individually; they were accepted as written, having been the pack's own review output.
- It did not assess whether §6's release-blocker list is *complete* against what has been learned since — only that every existing item still holds. A blocker that should have been added since 2026-08-22 would not have been found by this pass.
- `07`'s own **Version** and **Baseline** headers are left at 2.0 / 2026-08-22 deliberately: they describe the baseline this document was written against, and changing them would misrepresent when its §1–§7 claims were made.
