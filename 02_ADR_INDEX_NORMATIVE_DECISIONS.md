# ADR Index and Normative Decisions

**Version:** 2.0
**Status:** Normative ADR Baseline
**Companion To:** `01_ARCHITECTURE_BASELINE_RFC.md`
**Rule:** The RFC defines architectural shape. This document defines binding decisions. Where the two appear to conflict, **this document wins**.

---

## 0. How to Use This Document

Every ADR below is **normative**. It is not a suggestion, a preference, or a discussion starter.

| Status | Meaning |
|---|---|
| ACCEPTED | Binding now. Implement exactly as written. |
| OPEN | Decision required before the affected system is implemented. Blocks that system only. |
| DEFERRED | Intentionally not decided. The affected system is out of scope until an owner reopens it. Blocks nothing in V1. |
| SUPERSEDED | Replaced by a later ADR. Kept for history. |

No implementer may silently choose an alternative for an ACCEPTED ADR. Changing one requires a new ADR or an explicit documented revision.

For each ADR, completion requires:

- [ ] decision implemented
- [ ] tests implemented
- [ ] security implications reviewed
- [ ] contract updated
- [ ] documentation updated
- [ ] architecture conformance verified

**Change from v1.0:** the `OPEN` status was being used for two different things: decisions that genuinely block current work, and decisions about systems nobody is building yet. That made twelve ADRs look like blockers when only a few were. `DEFERRED` now carries the second meaning.

---

## 1. ADR Register

### 1.1 Binding for V1

| ID | Title | Area | Status | Blocks |
|---|---|---|---|---|
| ADR-001 | MCP Sensitive Write Confirmation | MCP / Security | ACCEPTED | Phase 9 |
| ADR-001b | Mobile UX for HIGH_WRITE Platform Approval | MCP / Approval | ACCEPTED | Phase 9 |
| ADR-002 | OAuth Identity, Tenant and Store Resolution | Identity / Security | ACCEPTED | Phase 1, Phase 9 |
| ADR-003 | MCP Write Idempotency | MCP / Integrity | ACCEPTED | Phase 9 |
| ADR-004 | Python AI Plane to NestJS Capability Boundary | AI / Transport | ACCEPTED | Phase 8 |
| ADR-004b | Service Authentication Between AI Plane and NestJS | AI / Security | ACCEPTED | Phase 8 |
| ADR-005 | In-Process Plugin Security Boundary | Plugin / Security | ACCEPTED | Phase 6 |
| ADR-005b | Malicious/Buggy Plugin Tenant Isolation Testing | Plugin / Testing | ACCEPTED | Phase 6 release |
| ADR-006 | Concurrent Usage and AI Credit Accounting | Billing / Integrity | ACCEPTED | Phase 2 (usage-ledger half) · Phase 6+ (AI-credit half) — split by amendment 2026-08-28, see the ADR body |
| ADR-007 | External MCP Trust Boundary | AI / Security | ACCEPTED | Phase 9 |
| ADR-008 | Entitlement Precedence and Conflict Resolution | Entitlement | ACCEPTED | Phase 2 |
| ADR-009 | Shared Idempotency Store | Platform / Integrity | ACCEPTED | Phase 2, Phase 9 |
| ADR-010 | Non-Functional Requirements and Scale Assumptions | Platform | **ACCEPTED (was OPEN)** | nothing; revisit triggers defined — targets are unverified assumptions until Phase 4 item 9, amendment 2026-08-28 |
| ADR-019 | Storefront Delivery, Caching and Domain Routing | Storefront / Ops | **ACCEPTED (was OPEN)** | Phase 1 exit, Phase 4 |
| ADR-020 | Data Retention, Deletion and Tenant Offboarding | Compliance | **ACCEPTED (was OPEN)** | Phase 2 |
| ADR-021 | Database Access, ORM and RLS Session Handling | Platform / Data | **ACCEPTED (new)** | Phase 1 |
| ADR-022 | Money, Currency and Rounding | Platform / Money | **ACCEPTED (new)** | Phase 2, Phase 3 |
| ADR-023 | Payment Provider Port and Iranian PSP Profile | Billing / Commerce | **ACCEPTED (new)** | Phase 2, Phase 3 |
| ADR-024 | Subscription Term, Renewal, Expiry and Grace | Billing / Lifecycle | **ACCEPTED (new)** | Phase 2 |
| ADR-025 | Plan Change, Upgrade, Downgrade and Proration | Billing / Lifecycle | **ACCEPTED (new)** | Phase 2 |
| ADR-026 | Over-Limit Policy and Data Preservation on Downgrade | Entitlement / Policy | **ACCEPTED (new)** | Phase 2 |
| ADR-027 | Domain Verification, TLS Lifecycle and DNS/CDN Port | Domains / Ops | **ACCEPTED (new)** | Phase 4 |
| ADR-028 | Host Resolution Security and Domain Ownership | Domains / Security | **ACCEPTED (new)** | Phase 4 |
| ADR-029 | Authentication Provider and Session Strategy | Identity | **ACCEPTED (new)** | Phase 1 |
| ADR-030 | Architecture Conformance Enforcement | Platform / CI | **ACCEPTED (new)** | Phase 1 start |
| ADR-031 | Time, Timezone and Calendar | Platform | **ACCEPTED (new)** | Phase 2 |
| ADR-032 | Storefront Read Path Separation | Storefront / Performance | **ACCEPTED (new)** | Phase 4 |
| ADR-033 | API Schema Artifact Generation | Platform / Contracts | **ACCEPTED (new)** | Task 2 (Phase 1) |
| ADR-034 | Audit Event Placement and Durability | Platform / Audit | **ACCEPTED (new)** | Phase 1 (in effect), Task 2 |
| ADR-035 | Platform-Scope Audit Events | Platform / Audit | **ACCEPTED (new)** | Task 2, `auth.login`/`auth.logout`/`auth.logout_all` (NOT `organization.switch` — it has a real tenant; see the ADR body) |
| ADR-036 | Collection Pagination Contract | Platform / Contracts | **ACCEPTED (new)** | Phase 2 item 1, and every later `*.list` capability |
| ADR-037 | Credential Storage and the Encryption Deferral | Billing / Security | **ACCEPTED (new)** | Phase 2 item 10 (storage shape) · Phase 3/4 (the mechanism itself) |
| ADR-038 | Idempotency Composition at the Capability Boundary | Platform / Integrity | **ACCEPTED (new)** | Phase 2 item 3, and every idempotent capability after it |
| ADR-039 | Connection Pool Sizing and Query Timeouts | Platform / Data | **OPEN** | first deployment carrying real traffic, or the first second instance |
| ADR-040 | Observability Boundary | Platform / Ops | **OPEN** | nothing in Phase 2; owed before production |
| ADR-041 | Ledger and Audit Table Growth | Platform / Data | **OPEN** | nothing today; cheapest at Phase 2 ledger-table creation, expensive after |
| ADR-042 | Error Message Audience and Localization | Platform / Contracts | **ACCEPTED (new)** | Phase 2, every capability that raises an error |
| ADR-043 | Guarding `CapabilityDefinition` Against `05` §5 | Platform / CI | **ACCEPTED (new)** | Phase 2 items 6–7 (the first slices that would add a declared field) |
| ADR-044 | Localized Display Text in Phase 2 Tables | Platform / Contracts | **ACCEPTED (was OPEN)** | Phase 2 item 1 (no display column) and item 13 (an invoice line carries its own description) |
| ADR-045 | Optimistic Concurrency for Mutable Phase 2 Rows | Platform / Data | **ACCEPTED (was OPEN)** | Phase 2 items 4, 8, 12, 15 — a `version` column in each creating migration; item 3 excluded by the ruling |
| ADR-046 | Soft-Delete Mechanism for ADR-020's Reversible Window | Compliance / Data | **ACCEPTED (new)** | nothing — the ruling is that no Phase 2 table gains `deleted_at`; reopened by the first capability that deletes |
| ADR-047 | Price Version Binding on Renewal | Billing / Lifecycle | **ACCEPTED (new)** | Phase 2 items 2 and 14 |
| ADR-048 | Invoice Numbering | Billing / Contracts | **ACCEPTED (was OPEN)** | Phase 2 item 13; the counter table is owed to `PHASE_2_BRIEF.md` §4 before that migration |
| ADR-049 | MCP Readiness Posture for Phase 2 | MCP / Architecture | **ACCEPTED (new)** | nothing directly — constrains every Phase 2 capability so Phase 9 stays reachable |
| ADR-050 | Financial Event Packet and External Delivery Path | Platform / Eventing | **ACCEPTED (was OPEN)** | Phase 2 item 14; the delivery table is owed to `PHASE_2_BRIEF.md` §4 before that migration |
| ADR-051 | Error Code for a Membership Revoked Mid-Flight | Identity / Contracts | **ACCEPTED (was OPEN)** | nothing in Phase 2 directly; the guard changes are a later slice, and R-008 closes on the proving test |
| ADR-052 | Self-Serve Trial: Eligibility, Entry Point and Duration | Billing / Lifecycle | **ACCEPTED (new)** | **Phase 2 items 1 and 2 — their creating migrations**, because trial eligibility and duration are plan-version columns and migrations are forward-only; then item 4 |
| ADR-053 | Session Retention and Purge | Identity / Data | **ACCEPTED (new)** | nothing today; `session.purge` is owed to Phase 2 item 12, which does not currently schedule it |
| ADR-054 | Per-Tenant Recovery from Nightly Snapshots | Compliance / Ops | **ACCEPTED (new)** | nothing in Phase 2; Phase 2.5 builds it, and **object storage (R-025) is a hard prerequisite** |

### 1.2 Deferred, blocking nothing in V1

| ID | Title | Area | Status | Reopen before |
|---|---|---|---|---|
| ADR-011 | Co-Pilot Cadence vs AI Credit Cost | AI / Pricing | DEFERRED | Phase 12 |
| ADR-012 | Autonomous AI Execution Opt-In | AI / Policy | DEFERRED | Phase 13 |
| ADR-013 | Voice Input Retention | AI / Privacy | DEFERRED | Phase 14 |
| ADR-014 | Channel Sync Conflict Resolution | Channels | DEFERRED | Phase 15 |
| ADR-015 | Dynamic Pricing Auto-Apply Policy | AI / Commerce | DEFERRED | Phase 16 |
| ADR-016 | Multi-Approver Quorum Rules | Approval | DEFERRED | Phase 17 |
| ADR-017 | Marketplace Plugin Review and Payout | Marketplace | DEFERRED | Phase 18 |
| ADR-018 | Financial Services Compliance and Deployment Isolation | Financial | DEFERRED | Phase 19 |

Deferred ADR statements are held in `future/DEFERRED_ADRS.md`. They are kept for intent, not for implementation.

---

## 2. Dependency Map

```plain
ADR-030 (Conformance Enforcement)
 └─ precondition for trusting every other ADR in a long implementation task

ADR-021 (DB Access + RLS Session)
 ├─ required by ADR-009 (Idempotency Store)
 ├─ required by ADR-006 (Ledger Accounting)
 └─ constrains ADR-032 (Storefront Read Path) via connection pooling

ADR-029 (Auth + Session)
 └─ precondition for ADR-002 (Store Resolution)

ADR-009 (Shared Idempotency Store)
 ├─ required by ADR-003 (MCP Write Idempotency)
 ├─ required by ADR-006 (Ledger Accounting)
 └─ required by ADR-023 (Payment verify/reconcile)

ADR-022 (Money)
 ├─ required by ADR-023 (Payments)
 ├─ required by ADR-024 (Renewal invoicing)
 └─ required by ADR-025 (Proration)

ADR-031 (Time/Calendar)
 ├─ required by ADR-024 (Term boundaries, grace)
 └─ required by ADR-025 (Proration windows)

ADR-024 (Term/Expiry)
 ├─ extended by ADR-025 (Plan change)
 ├─ enforced by ADR-026 (Over-limit)
 └─ triggers ADR-019 + ADR-028 (cache invalidation, domain de-routing on expiry)

ADR-019 (Storefront Delivery)
 ├─ implemented by ADR-032 (Read path separation)
 └─ paired with ADR-027 (TLS + DNS/CDN port)

ADR-027 (Domain/TLS)
 └─ secured by ADR-028 (Host resolution, ownership, IDN)

ADR-001 (Risk Classification)
 ├─ extended by ADR-001b (Approval UX + lifecycle)
 └─ extended by ADR-016 (Quorum, deferred)

ADR-002 (Store Resolution)
 └─ precondition for all store-scoped Capabilities

ADR-004 (Transport)
 └─ secured by ADR-004b (Service Auth)

ADR-005 (Plugin Boundary)
 ├─ verified by ADR-005b (Isolation Tests)
 └─ gating condition for ADR-017 (Marketplace, deferred)

ADR-008 (Entitlement Precedence)
 └─ consumed by Quota, Capability Policy, White Label, Plugin Entitlement, ADR-026

ADR-020 (Retention/Offboarding)
 └─ bounded by ADR-026 (no destructive downgrade)
```

---

# PART A: ACCEPTED DECISIONS CARRIED FROM v1.0

These are unchanged in substance. Cross-references were updated to the new ADR numbers.

---

## ADR-001 - MCP Sensitive Write Confirmation

ACCEPTED

### Decision

MCP write operations must be classified by risk level:

```plain
READ
LOW_WRITE
MEDIUM_WRITE
HIGH_WRITE
```

The system uses a hybrid confirmation model:

- READ may execute directly when authorized
- LOW_WRITE may execute directly according to Capability Policy
- MEDIUM_WRITE should use MCP user interaction/confirmation when supported
- HIGH_WRITE must require platform-controlled approval

The platform must not trust the MCP client or AI agent as the authoritative source of confirmation.

For high-risk operations:

```plain
MCP -> Capability Policy -> Proposal -> Platform Approval -> User Confirmation -> Execution
```

MCP interaction mechanisms may serve as a UX layer. Platform authorization remains authoritative.

### Rationale

Client-side confirmation is a UX mechanism, not a security boundary.

### Consequence

Capabilities must expose risk level and approval requirements as policy metadata.

### Verification

- [ ] every write capability declares a risk classification
- [ ] HIGH_WRITE cannot execute without a persisted platform approval
- [ ] test proves a forged client-side confirmation is rejected

---

## ADR-001b - Mobile UX for HIGH_WRITE Platform Approval

ACCEPTED, extends ADR-001

### Decision

HIGH_WRITE operations must support an in-conversation approval experience for MCP clients that support interactive flows. The platform must expose the approval as a server-controlled Approval Request.

When the client supports interactive multi-step interaction, the platform may use MCP interaction mechanisms such as `input_required` to request confirmation within the same conversation.

> MCP client confirmation is a UX mechanism. Platform-side approval state is the authoritative security decision.

For clients that cannot support the required interaction, the platform must provide a push notification containing a secure deep link to the platform approval UI.

The deep link must:

- identify the pending approval request
- not contain authorization credentials
- not contain secrets
- require authentication if the session is invalid
- verify current authorization before approval
- expire after a defined period
- become invalid after approval, rejection, or cancellation

### Normative Mobile Flow

```plain
User requests HIGH_WRITE operation
 -> MCP Client
 -> SaaS MCP Gateway
 -> Authentication
 -> Tenant / Store Resolution
 -> Authorization
 -> Entitlement / Quota Check
 -> Capability Policy
 -> HIGH_WRITE detected
 -> Create Approval Request
 -> Persist Approval Request
 -> Return approval-required state
     |
     +- Interactive client: input_required -> user confirms in conversation -> approval response
     |
     +- Non-interactive client: push notification -> secure deep link -> platform approval UI
                               -> user authentication -> user confirmation
 -> Platform validates approval
 -> Re-check authorization
 -> Re-check entitlement
 -> Re-check capability policy
 -> Re-check approval expiry/status
 -> Idempotency check (ADR-009)
 -> Execute Capability
 -> Persist result
 -> Return result to conversation
```

### Approval Binding

```plain
approvalRequestId
tenantId
storeId
userId
capability
operation
requestHash
createdAt
expiresAt
status
```

### Lifecycle

```plain
PENDING -> APPROVED -> EXECUTING -> EXECUTED
```

Terminal alternatives: `REJECTED`, `EXPIRED`, `CANCELED`, `FAILED`.

The platform must re-authorize at execution time. A previously valid approval must not remain valid after authorization changes, store membership changes, capability permission changes, invalidating entitlement changes, approval expiration, cancellation, or successful execution.

If re-authorization fails at execution time, the approval must transition to `FAILED` with a machine-readable reason code. **No partial execution may occur.** The user must be notified through the originating channel with a clear explanation and, where applicable, a retry path.

### Consequence

The Approval Service becomes part of Platform Core and must be reusable by MCP, AI Agents, Automation, Admin UI, and API. It must not be implemented as vendor-specific logic for any single AI client.

### Verification

- [ ] approval survives client disconnect
- [ ] expired approval cannot execute
- [ ] permission revocation between approval and execution blocks execution
- [ ] deep link contains no credentials

---

## ADR-002 - OAuth Identity, Tenant and Store Resolution

ACCEPTED

### Decision

OAuth access tokens identify the authenticated principal but must not be treated as the sole source of active store authorization. For store-scoped operations, `storeId` must be an explicit application-level input.

```plain
OAuth Token -> User Identity -> Organization Membership -> Requested storeId
 -> Store Membership / Access Check -> Permission Check -> Entitlement Check -> Capability
```

JWT may contain identity and OAuth scope claims such as `sub`, `iss`, `aud`, `scope`, `client_id`. Membership and store authorization must remain server-side. They may be cached for performance.

### Security Rule

**Never trust `storeId` merely because it appears in a valid OAuth request.** The server must verify that the authenticated user has access to the requested store.

### Verification

- [ ] valid token + unauthorized storeId is denied
- [ ] cached membership invalidates on membership change
- [ ] no capability derives storeId implicitly from token alone

---

## ADR-003 - MCP Write Idempotency

ACCEPTED, depends on ADR-009

### Decision

Write operations exposed through MCP must support application-level idempotency. The client should generate an `idempotencyKey`. The server must enforce it.

```json
{
  "storeId": "store_123",
  "idempotencyKey": "uuid-or-equivalent",
  "payload": {}
}
```

The server must associate the record with sufficient request scope: `tenantId`, `userId`, `capability`, `idempotencyKey`, `requestHash`.

Rules:

- same key + same operation must return the previous result where safe
- same key + different request must produce an idempotency conflict

An MCP tool `idempotentHint` may describe behaviour but must not replace server-side enforcement. This mechanism must use the shared Platform Idempotency Store defined in ADR-009.

### Verification

- [ ] duplicate key with identical payload does not execute twice
- [ ] duplicate key with divergent payload returns `IDEMPOTENCY_CONFLICT`
- [ ] no module-local idempotency table exists for MCP

---

## ADR-004 - Python AI Plane to NestJS Capability Boundary

ACCEPTED

### Decision

V1 must use an internal authenticated HTTP API based on stable OpenAPI contracts between the Python AI plane and NestJS.

```plain
Python AI Plane -> Internal API -> NestJS Capability / Application Layer -> Domain
```

The internal API must not be publicly exposed. Service authentication and authorization are mandatory (ADR-004b). Asynchronous operations must use the existing job/queue infrastructure. gRPC may be introduced later if measurable requirements justify it. Domain and Capability contracts must remain independent of transport.

### Practical Note

Introducing Python is a **cost**, not a milestone. Do it when workload characteristics demand it, not because the AI plane appears on a diagram.

### Verification

- [ ] internal API unreachable from public network
- [ ] no domain contract references transport types
- [ ] async paths route through existing queue infrastructure

---

## ADR-004b - Service Authentication Between AI Plane and NestJS

ACCEPTED, secures ADR-004

### Decision

Communication must use short-lived Service JWTs issued through an internal service-identity mechanism.

The Service JWT must contain at minimum `iss`, `sub`, `aud`, `iat`, `exp`, `jti`, `scope`, where `sub` is the calling service identity, `aud` is the target API, and `scope` lists explicitly permitted service capabilities.

Recommended token lifetime: **5 to 15 minutes**.

The receiving API must validate signature, issuer, audience, expiration, issued-at, service identity, and scope, then enforce endpoint-level authorization based on scope. A service must not receive broad administrative privileges simply because it is internal.

### Credential Bootstrap

The long-lived bootstrap credential must be stored outside source code and container images. Environment or Docker secrets are acceptable for V1. It must be unique per service, rotated periodically, revocable, and excluded from logs, API responses and source control.

### Rotation

```plain
Credential A -> Credential B issued -> A + B temporarily valid -> Services migrate to B -> A revoked
```

Rotation must not require simultaneous downtime.

### Revocation

```plain
Revoke Service Identity -> Reject new Service JWT issuance -> Reject affected service authorization
```

Because tokens are short-lived, compromise exposure is bounded by remaining lifetime. High-severity incidents may additionally use a service-level deny list checked by the receiving API.

### Rationale

| Mechanism | Security | V1 Complexity | Recommendation |
|---|---|---|---|
| Long-lived API key | Medium | Low | Not preferred |
| mTLS | High | High | Future / hardened deployment |
| Short-lived Service JWT | High | Medium | V1 recommended |

### Consequence

The authentication mechanism must remain independent of Domain and Capability contracts, so it can later be replaced or supplemented by mTLS, workload identity, service mesh identity, or SPIFFE/SPIRE without changing those contracts. TLS must still be used whenever internal traffic crosses a network boundary.

### Verification

- [ ] expired service token rejected
- [ ] wrong audience rejected
- [ ] out-of-scope endpoint access rejected
- [ ] rotation performed with zero downtime in staging

---

## ADR-005 - In-Process Plugin Security Boundary

ACCEPTED

### Decision

V1 trusted plugins may execute in-process. However, an in-process plugin **must not be considered a security isolation boundary**.

Technical enforcement must include Plugin SDK, package boundaries, forbidden imports, ESLint dependency rules, TypeScript project boundaries and CI architecture tests, as implemented by ADR-030.

Plugins must not directly import database drivers, ORM, Redis client, infrastructure modules, secret stores or internal repositories. Plugins interact with the platform through the Plugin SDK and approved Capabilities/Application Contracts.

For public marketplace or untrusted third-party plugins, the architecture must support an isolated runtime/sandbox. The sandbox is not mandatory for V1 trusted internal plugins.

### Hard Sequencing Rule

**`Trusted Plugin != Security Sandbox`.** Do not describe V1 plugin isolation as a security guarantee. It is a convention enforced by tooling.

### Verification

- [ ] CI fails on forbidden plugin import
- [ ] plugin cannot resolve an internal repository symbol
- [ ] plugin capability calls pass full policy chain

---

## ADR-005b - Malicious/Buggy Plugin Tenant Isolation Testing

ACCEPTED, release-blocking, verifies ADR-005

### Decision

The tenant isolation test suite must explicitly include malicious and buggy in-process plugin scenarios.

Minimum release-blocking tests, where a plugin attempts: direct repository access, direct database/ORM access, another tenant's data, another store, bypass of capability authorization, unauthorized secret access. Expected result must be denial or failure for every unauthorized operation.

The suite must include both static architecture tests and runtime integration tests.

### Static Tests

CI must detect forbidden plugin dependencies: Plugin to ORM, PostgreSQL driver, Redis client, Infrastructure Repository, Secret Store, internal persistence modules.

### Runtime Tests

A test plugin must attempt unauthorized operations against Tenant A, Tenant B, Store A, and Store B while executing under Tenant A context. It must not access Tenant B or unauthorized Store B data.

### Rationale

Documentation and import conventions alone cannot establish tenant isolation. An in-process plugin runs in the same runtime and therefore has a larger blast radius than an isolated external plugin. Tenant isolation is a continuously verified architectural property, not a documentation-only rule.

### Release Gate

A release must not proceed if a plugin can cross a tenant boundary, access an unauthorized store, bypass capability authorization, obtain unauthorized secrets, or directly access prohibited infrastructure. The suite must run in CI before production deployment.

---

## ADR-006 - Concurrent Usage and AI Credit Accounting

ACCEPTED, depends on ADR-009 and ADR-021

### Decision

Usage and AI Credit ledgers are authoritative and must be protected against concurrent modification. Critical accounting operations must execute inside database transactions using row-level locking such as `SELECT FOR UPDATE`, database constraints, and idempotency.

AI credit consumption must use a reservation lifecycle:

```plain
AVAILABLE -> RESERVED -> CONSUMED
AVAILABLE -> RESERVED -> RELEASED
```

The system must prevent negative effective balances unless explicitly supported by a defined credit policy. Concurrent requests from multiple devices, tabs, workers, MCP calls, or AI agents must produce deterministic accounting results.

All monetary and credit amounts follow ADR-022.

### Amendment, 2026-08-28 — the `Blocks` designation is split, not moved

**Context.** `PHASE_2_BRIEF.md` §4 excludes `ai_credit_ledger_entries` and `ai_credit_reservations` from Phase 2 on the authority of decision D2-6 (`decisions/2026-08.md`, 2026-08-28), and says so explicitly *because* this index still read `Blocks: Phase 2` — so a reader consulting only the index reached the opposite conclusion. That debt is paid here.

**What the amendment found, and it is not what D2-6 assumed.** D2-6 was framed as "ADR-006 is marked *Blocks: Phase 2* and no `06` item delivers AI credit accounting, therefore the designation is stale." Checking `06_IMPLEMENTATION_PLAN.md` item by item rather than inheriting that framing shows the designation is **half right**: this ADR governs two distinct things, and only one of them is AI-specific.

1. **The usage/credit-ledger concurrency half genuinely blocks Phase 2.** "Usage and AI Credit ledgers are authoritative and must be protected against concurrent modification… inside database transactions using row-level locking such as `SELECT FOR UPDATE`, database constraints, and idempotency" applies directly to **`06` Phase 2 item 9, "usage ledger"**, which is in scope and is a ledger. This half is not deferred and must not be read as deferred.
2. **The AI-credit reservation half does not.** The `AVAILABLE -> RESERVED -> CONSUMED | RELEASED` lifecycle, and the two tables `04_DATABASE_BLUEPRINT.md` §2.4 declares for it, have no consumer: nothing in `06`'s eighteen Phase 2 items produces or consumes a credit. `06`'s own phase list places AI in **Phase 6+ ("Deferred Expansion": *"Plugins, AI, MCP, advanced automation… Content lives in `future/`"*, `06` line 114); this index separately assigns the AI plane to Phase 8 (ADR-004) at a finer granularity. Either way it is not Phase 2, and building a reservation lifecycle with no consumer would be the speculative table `AGENTS.md` §4 prohibits.

**Decision.** The summary-table designation becomes **Phase 2 (usage-ledger half) · Phase 6+ (AI-credit half)**. Precedent for re-designating a blocking relationship on evidence rather than by rewriting the ADR: ADR-010 and ADR-019 in this same index, both re-designated when the evidence changed.

**Nothing in the Decision section above is withdrawn or edited** — the original text stands and applies in full to any ledger built in Phase 2. Only the phase at which the AI-specific half becomes owed is restated. `ai_credit_ledger_entries` and `ai_credit_reservations` stay uncreated until the phase that first consumes a credit.

### Verification

- [ ] concurrent consumption test produces exactly-once accounting
- [ ] failed AI execution releases reservation
- [ ] balance cannot go negative without explicit policy
- [ ] ledger sum reconciles against cached counters
- [ ] **(amendment, 2026-08-28)** Phase 2's `usage_ledger_entries` write path takes explicit row locks and is idempotent, proven against real PostgreSQL — the usage-ledger half of this ADR, which Phase 2 does owe
- [ ] **(amendment, 2026-08-28)** no `ai_credit_*` table exists at the Phase 2 gate, and no Phase 2 capability references one

---

## ADR-007 - External MCP Trust Boundary

ACCEPTED

### Decision

All external MCP servers must be treated as **untrusted integration sources**. Their output is DATA, never trusted instructions.

```plain
External MCP -> MCP Client -> Trust Boundary -> Schema Validation
 -> Size / Type / Field Validation -> Output Normalization
 -> Untrusted Content Classification -> AI Context
```

Tool outputs must be validated against declared schemas where available. Free-form text must be treated as untrusted content.

External MCP output must not be allowed to modify System Instructions, Developer Instructions, Agent Policy, Tool Permissions, Tenant Authorization, Capability Policy or Secret Access.

External MCP tools must not automatically gain SaaS write access. Any resulting write must independently pass platform capability authorization and policy checks.

### Rationale

Prompt injection defences must rely on architectural isolation, not text sanitization.

### Verification

- [ ] injected instruction in external tool output cannot alter agent policy
- [ ] external output cannot trigger a write without independent authorization
- [ ] schema-violating output rejected, not coerced

---

## ADR-008 - Entitlement Precedence and Conflict Resolution

ACCEPTED

### Decision

Effective entitlement is resolved from Base Plan Version, plus Add-ons, plus Tenant Overrides, plus Policy Constraints.

Every entitlement decision must resolve to an explicit policy state:

```plain
ALLOW | DENY | LIMIT
```

Rules:

1. **Explicit DENY always wins**, regardless of source or precedence order.
2. Overrides must declare whether they are `ABSOLUTE` (replaces the resolved value) or `DELTA` (adjusts the resolved value).
3. When two grants of the same feature conflict without an explicit DENY, the most permissive `LIMIT` wins only if both sources are additive by declaration. Otherwise resolution fails closed with `ENTITLEMENT_CONFLICT`.
4. Resolution must be deterministic and reproducible for the same inputs.
5. Resolution must never be computed in an interface layer, an AI prompt or a plugin.

Precedence order for non-DENY resolution:

```plain
Policy Constraint
 -> Tenant Override (ABSOLUTE before DELTA)
 -> Add-on
 -> Plan Version
 -> Platform Default
```

### Explainability

The entitlement engine must expose the final resolved entitlement and, where required, the resolution source for audit and debugging:

```plain
feature, state, limit, resolvedFrom[], evaluatedAt
```

### Consequence

`entitlement_sources` is a first-class table. Effective entitlement may be cached but must be invalidated on subscription change, plan version migration, add-on change, override change and term boundary crossing (ADR-024).

### Verification

- [ ] explicit DENY beats every grant, including an ABSOLUTE override
- [ ] ABSOLUTE and DELTA overrides produce documented results
- [ ] unresolvable conflict fails closed
- [ ] resolution result is byte-identical for identical inputs
- [ ] cache invalidates on every listed trigger

---

## ADR-009 - Shared Idempotency Store

ACCEPTED

### Decision

The platform provides exactly **one** idempotency service, owned by the `idempotency` module in Platform Core. No module may create its own.

It covers MCP writes, AI writes, usage operations, credit ledger operations, payments, refunds, webhook delivery, webhook and event consumers, subscription changes, renewals and plan changes.

### Identity

```plain
UNIQUE (tenant_id, capability, idempotency_key)
```

The record stores `request_hash`, `status`, `response_snapshot`, `created_at`, `expires_at`, and the originating `actor_type`.

### Lifecycle

```plain
CLAIMED -> IN_PROGRESS -> COMPLETED
CLAIMED -> IN_PROGRESS -> FAILED
```

A claim is made inside the same transaction that performs the write where the write is single-transaction. Where the operation spans an external call, the claim is committed first, then reconciled.

Rules:

- identical key + identical `request_hash` returns the stored result
- identical key + different `request_hash` returns `IDEMPOTENCY_CONFLICT`
- an `IN_PROGRESS` claim returned to a concurrent caller yields `CONFLICT` with retry-after, never a duplicate execution
- retention is bounded and configurable; expiry must not silently permit re-execution of a financially significant operation within its business window

### Storage

**PostgreSQL is authoritative.** Redis may be used only as a read-through performance optimization in front of it. A Redis failure must degrade performance, never correctness.

### Verification

- [ ] exactly one idempotency table exists in the schema
- [ ] concurrent identical requests execute once
- [ ] divergent payload on the same key conflicts
- [ ] flushing Redis does not permit duplicate execution
- [ ] CI conformance rule fails on any new module-local idempotency table

---

# PART B: PREVIOUSLY OPEN DECISIONS, NOW CLOSED

---

## ADR-010 - Non-Functional Requirements and Scale Assumptions

**ACCEPTED** (was OPEN and blocking Phase 0 exit)

### Why this changed

Holding NFRs open blocked Phase 0 exit while providing no engineering value, because at zero traffic every number is a guess. An unproven number that is written down and revisited is more useful than an open question that stalls delivery.

### Decision

These are **design assumptions**, not contractual SLOs. They exist so implementers can size indexes, pools and caches without inventing their own numbers.

| Dimension | V1 assumption |
|---|---|
| Organizations | up to 5,000 |
| Stores | up to 10,000 |
| Products per store | up to 50,000 |
| Orders per store per day | up to 2,000 |
| Peak storefront RPS, all stores | 500 |
| Peak admin/API RPS | 50 |
| Storefront p95, cached page | under 300 ms at the edge |
| Storefront p95, uncached page | under 800 ms |
| Admin API p95 | under 500 ms |
| Background job p95 latency | under 60 s for non-batch jobs |
| Availability target | 99.5 percent monthly, V1 |
| RPO | 15 minutes |
| RTO | 4 hours |

Single-node PostgreSQL with a read replica is assumed sufficient for V1. Horizontal sharding, multi-region and dedicated-tenant infrastructure are out of V1 scope.

### Revisit Triggers

This ADR must be reopened when any of these is observed for seven consecutive days:

- storefront peak exceeds 60 percent of the assumed RPS
- p95 exceeds target on any listed dimension
- database CPU exceeds 60 percent sustained
- the largest store exceeds 50 percent of any per-store assumption
- a single tenant exceeds 20 percent of total platform load

### Amendment, 2026-08-28 — the targets are unverified assumptions, and this ADR says so rather than reading as if they were measured

**Context.** `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` G-9 established that this ADR is, by its own verification text, currently unmeetable: it requires that "metrics exist for every dimension in the table, otherwise the target is unmeasurable and therefore fictional," and its revisit triggers require conditions "observed for seven consecutive days" — while `RISK_REGISTER.md` R-010 records that no metric, alert or dashboard exists anywhere in the platform, and no phase before Phase 4 builds one.

**Decision.** Every number in the table above is an **unverified design assumption, not a measured requirement and not a contractual SLO.** This restates in normative terms what the Decision section already half-says ("These are design assumptions, not contractual SLOs") and closes the gap between that sentence and a verification list written as though the numbers were observable.

They become measurable at **`06_IMPLEMENTATION_PLAN.md` Phase 4 item 9, "load test against the ADR-010 assumptions"** — confirmed against `06` rather than assumed. Until that item runs against real instrumentation, this ADR's targets may be used to size indexes, pools and caches (their stated purpose) and **may not** be cited as evidence that the platform meets any latency, throughput or availability figure.

**No number is changed, added or removed.** The amendment changes the epistemic status of the targets, not the targets. The revisit triggers stand as written and remain unfireable until instrumentation exists — which is a real, recorded consequence, not an oversight: see ADR-040 (`OPEN`), which owns where the observability boundary sits, and R-010.

**On the `entitlement.resolve` p95 budget `PHASE_2_BRIEF.md` §5 records as owed (decision D2-4): it does not belong here, and is deliberately not added.** Two reasons, the second more interesting than the first. (i) This table is a table of numbers; adding a row requires inventing one, and D2-4's entire point was that no number is derivable today — a `TBD` row would manufacture exactly the unmeetable verification item this amendment exists to correct. (ii) Checked rather than assumed: ADR-010 **already bounds `entitlement.resolve` when it is an API request** — it is an Admin API capability, so the existing "Admin API p95 under 500 ms" row covers it. What is genuinely unbounded is *resolution as an inner pipeline step*, invoked inside another capability's request, where its cost is a fraction of some other request's budget rather than a request of its own. That is a different kind of number from anything in this table, and it stays owed to whoever first measures it.

### Verification

- [ ] load test exercises the storefront read path at the assumed peak
- [ ] metrics exist for every dimension in the table, otherwise the target is unmeasurable and therefore fictional
- [ ] restore drill meets the stated RPO and RTO at least once before production
- [ ] **(amendment, 2026-08-28)** no document, review or gate report cites a number from this table as a met or measured figure before Phase 4 item 9 has run

---

## ADR-019 - Storefront Delivery, Caching and Domain Routing

**ACCEPTED** (was OPEN, was scheduled for Phase 4)

### Why this changed

Storefront delivery was treated as a Phase 4 detail. It is not a detail: the storefront is the majority of platform traffic, and the caching strategy constrains the tenant-context and connection-pooling decisions made in Phase 1. Deciding it after Phase 1 would require rewriting Phase 1.

### Decision

1. **Rendering.** Storefront pages are statically generated with on-demand revalidation. Revalidation is triggered by domain events delivered through the transactional outbox, never by a timer as the primary mechanism. A short time-based fallback is permitted as a safety net only.

2. **Cache keys.** Every cache key is scoped by `storeId` and, where content varies, by locale and currency. A cache key must never be derived from a raw `Host` header without first resolving it through the verified domain mapping (ADR-028).

3. **Invalidation contract.** These events must invalidate storefront cache: product created/updated/unpublished, price changed, inventory availability crossing the in-stock boundary, category changed, theme or store settings changed, domain changed, subscription state changed to a non-serving state (ADR-024).

4. **CDN and DNS are a port, not a vendor.** The platform defines `CdnProvider` and `DnsProvider` interfaces. No provider SDK may appear outside `infrastructure`. At least two implementations must be possible without touching application code, because the correct provider differs by market and a single-vendor assumption is not portable.

5. **Static assets.** Product images and theme assets are served from object storage through the CDN. Image transformation must not be performed by the Node application process.

6. **Read path.** The storefront read path is separated per ADR-032.

7. **Serving state.** A store is served only when its subscription is in a serving state. Expiry must remove the store from the serving set and invalidate its cache, otherwise a cached storefront outlives its paid subscription.

### Verification

- [ ] cached product page served without a database round trip
- [ ] publishing a product invalidates only that store's affected keys
- [ ] subscription expiry removes the storefront from serving within a defined bound
- [ ] no CDN or DNS SDK import exists outside infrastructure, enforced in CI
- [ ] load test at the ADR-010 assumed peak meets the p95 targets

---

## ADR-020 - Data Retention, Deletion and Tenant Offboarding

**ACCEPTED** (was OPEN)

### Decision

Four distinct states must never be conflated:

| State | Data | Access | Storefront |
|---|---|---|---|
| ACTIVE | retained | full | served |
| GRACE (ADR-024) | retained | full | served |
| SUSPENDED | retained | read-only admin | not served |
| OFFBOARDED | retained for the retention window, then purged | none | not served |

Rules:

1. Expiry, downgrade and cancellation are **never** destructive. See ADR-026.
2. Deletion is only ever initiated by an explicit, authenticated, logged tenant or operator request.
3. Deletion is a two-phase operation: `DELETION_REQUESTED` with a reversible waiting period, then irreversible purge. The waiting period default is 30 days.
4. Purge scope is tenant-owned data. Append-only records required for financial, tax or legal purposes are retained per the legal retention window and are excluded from purge; they must be reduced to the minimum fields required.
5. Audit events recording the deletion itself are never purged.
6. A tenant may export their data before purge. Export must be a capability with its own quota, not an ad-hoc script.
7. Backups age out naturally. A purge request does not rewrite historical backups; the retention window must be documented to the tenant.

### Verification

- [ ] no code path deletes tenant data as a side effect of a billing state change
- [ ] purge is reversible during the waiting period and irreversible after
- [ ] purge leaves no orphaned rows in any tenant-owned table
- [ ] retained financial records after purge contain no unnecessary personal data

---

# PART C: NEW DECISIONS

---

## ADR-021 - Database Access, ORM and RLS Session Handling

**ACCEPTED**, new

### Problem

v1.0 required that the ORM never leak into Domain, and required PostgreSQL RLS with transaction-local context, but never named a tool. Those two requirements together eliminate most ORM choices, so leaving it open meant the first implementer would pick badly.

### Decision

1. **Data access uses a SQL-first, type-safe query builder over the native PostgreSQL driver.** Drizzle or Kysely are both acceptable. A full active-record or unit-of-work ORM is rejected for V1.

2. **Rationale.** The platform needs explicit control of transaction and session state in order to set RLS context, needs `SELECT FOR UPDATE` on ledgers, and needs persistence models kept separate from domain entities. Heavy ORMs fight all three.

3. **Mapping rule.** Domain entities and persistence rows are distinct types. An explicit mapper lives in `infrastructure`. ORM or driver types must never appear in `domain` or in a `contracts` package.

4. **Repository rule.** Repository interfaces are declared by the owning module's `domain` or `application` layer. Implementations live in that module's `infrastructure`. No module imports another module's repository, ever.

5. **RLS session handling.** Every request obtains a connection, opens a transaction, and sets transaction-local context before any query:

```sql
select set_config('app.tenant_id', $1, true);
select set_config('app.user_id',   $2, true);
select set_config('app.store_id',  $3, true);
```

A single helper owns this. Direct pool access that bypasses the helper is a CI conformance violation.

6. **Connection pooling.** Because context is transaction-local, an external pooler in transaction mode is compatible, but statement mode is **forbidden**. The application maintains its own pool; the pooler configuration must be documented and asserted in the deployment checklist.

7. **Fail closed.** RLS policies must deny when `app.tenant_id` is absent or empty. A missing context must never read as "all tenants".

8. **Migrations** are plain SQL files under version control, forward-only, reviewed with the owning module. Generated migrations may be used as a starting point but the committed artifact is reviewed SQL.

### Verification

- [ ] a query issued without tenant context returns zero rows and raises an application error
- [ ] no `domain` file imports the driver, query builder or any SQL type
- [ ] every write path that touches a ledger uses explicit row locking
- [ ] pooler mode asserted in the deployment check

---

## ADR-022 - Money, Currency and Rounding

**ACCEPTED**, new

### Problem

Across the entire v1.0 pack, money is never modelled. Plans, prices, invoices, orders, refunds, coupons, shipping and tax all handle money, and none of them said how. This is the highest-probability source of silent financial corruption in the platform.

### Decision

1. **A monetary value is never a bare number.** It is always the pair:

```ts
type Money = {
  amountMinor: bigint;   // integer, in the currency's minor unit
  currency: string;      // ISO 4217 alpha-3, uppercase
};
```

2. **Floating point is forbidden** for any monetary or credit value, in code, in JSON contracts, and in the database. Database columns are `numeric` with explicit scale, or `bigint` of minor units. `float`, `double precision` and `real` are prohibited on monetary columns, enforced by a schema conformance test.

3. **Minor units are per currency**, read from a currency table, never hard-coded to 2. Currencies with zero minor units are first-class, not an exception. Storage is always in minor units.

4. **Display is not storage.** A currency may be stored in one unit and presented in another. The presentation unit, its divisor and its symbol live in the currency configuration and are applied only in the interface layer. Domain and Application never see a presentation unit. Any conversion factor between a stored unit and a displayed unit is configuration, never a literal in business code.

5. **Rounding.** Every operation that can produce a fraction of a minor unit must declare its rounding mode. Default is half-up. Allocation of a total across lines must use a remainder-distributing allocator so that the sum of parts equals the whole exactly. Proration (ADR-025) and tax must use the allocator, not independent rounding.

6. **No arithmetic across currencies.** Adding two `Money` values of different currencies is a domain error, not a conversion. Exchange rates, if ever introduced, are an explicit, versioned, audited conversion with the rate persisted on the record.

7. **Contract shape.** Money crosses an API boundary as a string amount plus a currency code, never as a number, to avoid language-specific numeric parsing:

```json
{ "amount": "1250000", "currency": "IRR", "minorUnits": 0 }
```

8. **Ledger integrity.** Every ledger and invoice row stores currency alongside amount. A balance is only ever computed per currency.

### Verification

- [ ] schema test asserts no floating-point column holds money
- [ ] allocator test proves sum of allocated parts equals the original total for adversarial inputs
- [ ] cross-currency addition throws
- [ ] a currency with zero minor units round-trips through API, database and invoice without a rounding change
- [ ] presentation divisor appears in exactly one place in the codebase

---

## ADR-023 - Payment Provider Port and Iranian PSP Profile

**ACCEPTED**, new, depends on ADR-009 and ADR-022

### Problem

v1.0 correctly separated SaaS Billing from Commerce Payment and correctly required a provider adapter. But the implied provider model is the international card-and-webhook model: tokenized cards, stored credentials, recurring charges and reliable webhooks. A large class of real gateways, including every Iranian PSP, does not work that way. An abstraction built on the wrong assumptions leaks on the first integration.

### Decision

1. **Capability flags, not a lowest common denominator.** The port declares what a provider can do. Application code branches on declared capability, never on provider name.

```ts
type PaymentProviderCapabilities = {
  supportsRedirectFlow: boolean;
  supportsServerToServerCharge: boolean;
  supportsWebhook: boolean;
  supportsVerifyByReference: boolean;   // pull-based confirmation
  supportsRefund: boolean;
  supportsPartialRefund: boolean;
  supportsRecurring: boolean;           // true stored-credential recurring
  supportsDirectDebit: boolean;
  supportsMultiCurrency: boolean;
  supportedCurrencies: string[];
  maxAmountMinor?: bigint;
  settlementDelayHours?: number;
};
```

Any code path that assumes an unavailable capability must fail at startup with a configuration error, not at runtime with a customer-facing failure.

2. **The normative flow is redirect-and-verify**, because that is the weakest common shape and everything else is a superset:

```plain
create PaymentIntent (persisted, our id, our amount, our currency)
 -> request provider authority/token
 -> persist authority + PENDING
 -> redirect customer
 -> [callback returns]        OR  [callback never returns]
 -> VERIFY against provider using our reference     <- authoritative
 -> map verified result to PaymentIntent state
 -> emit event through outbox
```

3. **The callback is a hint, never a source of truth.** State transitions to a paid state only after a server-side verify. A callback that claims success without a successful verify is treated as fraud and logged as a security event.

4. **Reconciliation is mandatory, not optional.** A scheduled job must sweep every `PENDING` intent older than a configured threshold and verify it against the provider. This exists because customers close browsers, networks fail and some providers have no webhook at all. Without it, money is taken and orders never complete.

   - the sweep is idempotent through ADR-009
   - it must handle: verified-paid, verified-failed, expired, and provider-unknown
   - `provider-unknown` after a bounded number of attempts escalates to a human queue, it does not silently fail
   - an intent may never be verified twice into two ledger entries

5. **Amount and currency are ours, not the provider's.** Verify must compare the provider-reported amount and currency against the persisted intent. A mismatch is a hard failure and a security event, never an auto-accept.

6. **No recurring where recurring does not exist.** When `supportsRecurring` is false, subscription renewal must use the invoice-and-notify flow in ADR-024. The billing domain must never assume a card can be charged again.

7. **Two separate registries.** SaaS Billing providers and Commerce Payment providers are configured independently, even when the same adapter implementation is reused. A store's gateway credentials are store-scoped secrets; the platform's billing gateway credentials are platform-scoped. They must never be resolvable from the same context.

8. **Store-scoped credentials** are encrypted at rest, never returned by any read API, and never logged. A store operator may rotate them; rotation must not invalidate historical payment records.

9. **Provider adapters are the only place** a provider SDK, URL or field name may appear. Adapters must be independently testable against recorded fixtures without network access.

10. **Refunds** follow the same intent-and-verify shape, and honour `supportsRefund` and `supportsPartialRefund`. Where refund is unsupported, the domain must expose a manual-refund path with audit, rather than pretending an automated refund occurred.

### Adding a new provider

Adding a gateway must require exactly: one adapter implementing the port, one capability declaration, one credential schema, one fixture-based test suite, and one configuration entry. **Zero changes to Application, Domain, or any other adapter.** If a new gateway requires touching application code, the port is wrong and must be corrected by ADR.

### Verification

- [ ] adapter contract test suite runs against fixtures with no network
- [ ] a callback claiming success without provider verification does not mark a payment paid
- [ ] amount or currency mismatch on verify fails hard and raises a security event
- [ ] reconciliation job resolves an abandoned-callback payment to the correct terminal state
- [ ] double verification produces exactly one ledger entry
- [ ] a second provider is added in a test with no changes outside its adapter and configuration
- [ ] billing credentials are unreachable from a store-scoped context and vice versa

---

## ADR-024 - Subscription Term, Renewal, Expiry and Grace

**ACCEPTED**, new, depends on ADR-022, ADR-023, ADR-031

### Problem

v1.0 named the states `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCEL_AT_PERIOD_END`, `EXPIRED`, `CANCELED`, `SUSPENDED`, but never modelled a term, a period boundary, a renewal, or the mechanism that moves a subscription into `EXPIRED`. A fixed-term product, for example a one-year subscription that stops working unless renewed, is therefore not implementable from v1.0.

### Decision

1. **Term is explicit and first-class.** A subscription has a term length and a current period. Periods are historical records, not overwritten fields:

```plain
subscription
  term_length            interval, e.g. 1 month, 1 year
  auto_renew             boolean
  current_period_id      reference
  status

subscription_period
  id, subscription_id, plan_version_id, price_version_id
  period_start (utc), period_end (utc)
  grace_end (utc, nullable)
  invoice_id (nullable)
  status: SCHEDULED | CURRENT | ENDED | UNPAID
```

Renewal appends a period. It never mutates a previous one. This is what makes billing history reconstructible.

2. **Serving state is derived, not stored twice.** Exactly one function answers "is this tenant entitled to be served right now". Interfaces, storefront routing and capability policy all call it.

```plain
SERVING:     TRIALING, ACTIVE, PAST_DUE (within grace), CANCEL_AT_PERIOD_END (before period_end)
NOT SERVING: PAUSED, EXPIRED, CANCELED, SUSPENDED
```

3. **State machine.** Only these transitions are legal:

```plain
TRIALING -> ACTIVE | EXPIRED | CANCELED
ACTIVE -> PAST_DUE | CANCEL_AT_PERIOD_END | PAUSED | SUSPENDED | CANCELED
PAST_DUE -> ACTIVE (payment received) | EXPIRED (grace elapsed) | SUSPENDED
CANCEL_AT_PERIOD_END -> EXPIRED (at period_end) | ACTIVE (reactivated before period_end)
PAUSED -> ACTIVE | CANCELED
EXPIRED -> ACTIVE (renewal paid within reactivation window) | CANCELED
SUSPENDED -> ACTIVE (operator action) | CANCELED
CANCELED -> terminal
```

Any other transition is a domain error. Transitions are recorded in an append-only transition log with actor and reason.

4. **Renewal lifecycle, designed for gateways without recurring charge** (ADR-023 item 6):

```plain
T-30d  renewal notice, invoice issued for the next period (SCHEDULED)
T-14d  reminder
T-3d   reminder
T-0    period_end reached
         paid    -> next period becomes CURRENT, status ACTIVE
         unpaid  -> status PAST_DUE, grace window starts, still SERVING
T+grace unpaid   -> status EXPIRED, NOT SERVING
```

Default grace window: 7 days. Configurable per plan, never per code path.

5. **Early renewal is supported and must not lose time.** A tenant paying before `period_end` extends from the existing `period_end`, not from the payment date. Paying twice extends twice. A renewal payment must never shorten a term.

6. **Reactivation after expiry.** Within a configured reactivation window, default 30 days, paying the outstanding renewal restores the subscription and the same store, domains and data. After that window the subscription is `CANCELED` and offboarding follows ADR-020. Data is still not deleted by expiry itself (ADR-026).

7. **All boundary arithmetic uses ADR-031.** A period boundary is computed in the tenant's billing timezone and stored in UTC. A one-year term is calendar arithmetic, not 365 days.

8. **Scheduled jobs are part of the deliverable, not an afterthought.** Required jobs, all idempotent per ADR-009 and safe to run repeatedly:

```plain
renewal.notice          issue invoice + notify for periods ending within the notice window
renewal.reminder        re-notify on the reminder schedule
subscription.rollover   promote SCHEDULED period to CURRENT when paid
subscription.expire     move past-grace unpaid subscriptions to EXPIRED
subscription.deprovision on expiry: invalidate entitlement cache, de-route domains, invalidate storefront cache
trial.expire            terminate trials that were never converted
```

A job that has not run must never cause a tenant to be over-served indefinitely; serving state is evaluated from data, so a late job delays notification, not correctness.

9. **Expiry propagates.** On transition to a non-serving state the platform must, in this order: invalidate effective entitlement cache, remove the store from the serving set, invalidate storefront and CDN cache (ADR-019), and emit `SubscriptionExpired` through the outbox. A storefront that stays live after expiry is a release-blocking defect.

10. **Notification is mandatory.** Expiry without prior notice is prohibited. Notice must reach the organization owner through at least one channel, and the attempt must be audited.

### Verification

- [ ] a one-year term expires exactly at its calendar boundary in the billing timezone
- [ ] an unpaid renewal is served through grace and not served after it
- [ ] early renewal extends from `period_end`, proven with a test that would fail on payment-date extension
- [ ] reactivation within the window restores store, domains and data intact
- [ ] running every scheduled job twice produces identical state
- [ ] period history is append-only and reconstructs every invoice
- [ ] storefront stops serving within the defined bound after expiry
- [ ] no illegal state transition is reachable through any interface

---

## ADR-025 - Plan Change, Upgrade, Downgrade and Proration

**ACCEPTED**, new, extends ADR-024

### Problem

v1.0 exposed only `plan.subscribe`. There was no capability for changing a plan, no rule for when a change takes effect, and `proration` appeared as a single word in a feature list with no definition. Selling tiered plans where a customer pays to upgrade is therefore not implementable from v1.0.

### Decision

1. **Plan change is a distinct capability**, not a re-subscribe: `plan.change`. Re-subscribing to a different plan is prohibited as an upgrade mechanism because it destroys subscription continuity and billing history.

2. **Direction determines timing.**

| Direction | Effective | Money |
|---|---|---|
| Upgrade (higher price or superset entitlement) | immediately on successful payment | customer pays the prorated difference now |
| Downgrade (lower price or reduced entitlement) | at `period_end` | no refund by default; remaining paid time is honoured |
| Lateral (same price) | immediately | no charge |
| Term change (monthly to annual) | treated as an upgrade of term, immediately, prorated | pays new term less unused credit |

A downgrade taking effect immediately would let a customer pay for a lower tier while consuming a higher one for the remainder of a paid period. Prohibited.

3. **Normative proration rule for upgrades.**

```plain
unusedCredit = priceOfCurrentPlan  * remainingDays / periodDays
newCharge    = priceOfTargetPlan   * remainingDays / periodDays
amountDue    = newCharge - unusedCredit      (floored at zero)
```

- `period_end` **does not change** on an upgrade. The customer keeps their existing expiry date.
- `remainingDays` is computed from the period boundary per ADR-031.
- allocation and rounding use the ADR-022 allocator, half-up, remainder distributed.
- if `amountDue` is zero or negative, the upgrade applies with no charge and no refund; a negative delta must never create a payable to the customer without an explicit credit policy.

Rationale for keeping the expiry date: resetting the term on upgrade silently sells the customer time they already owned, and it makes annual renewal dates unpredictable. Merchants understand "same expiry, better plan, pay the difference".

4. **Payment gating.** An upgrade applies only after payment is verified per ADR-023. A pending upgrade holds a `SCHEDULED` change record. It must never apply optimistically. On payment failure the change record expires and the subscription is untouched.

5. **Scheduled downgrades are visible and cancellable.** A pending downgrade is a persisted `subscription_change` row with `effective_at`. The tenant must be able to see it and revoke it before it applies. Applying it is a scheduled job, idempotent.

6. **Plan version pinning survives the change.** A change moves the subscription to a specific target `plan_version_id` and `price_version_id`, captured at change time. A later edit to that plan must not retroactively alter the change.

7. **Entitlement recomputation is transactional with the change.** The change, the new period or change record, the invoice, the ledger entry and the entitlement cache invalidation are one atomic unit. A half-applied plan change is prohibited.

8. **Data is never lost.** Entitlement is separate from data. A plan change adjusts what the tenant may do, never what the tenant has. Over-limit handling after a downgrade is governed by ADR-026.

9. **Upgrade must be self-service.** The capability is exposed to the tenant owner and admin roles through the Admin UI and API, with the same policy chain as any other capability. Requiring operator intervention to upgrade is a product defect.

### Verification

- [ ] upgrade applies only after verified payment, proven by a failed-payment test
- [ ] `period_end` is unchanged by an upgrade
- [ ] proration credit plus charge reconciles to the ledger with zero rounding drift over 1,000 randomized cases
- [ ] downgrade does not take effect before `period_end`
- [ ] a scheduled downgrade can be revoked
- [ ] plan version edits do not retroactively alter a recorded change
- [ ] concurrent upgrade attempts produce exactly one applied change (ADR-009)
- [ ] no data is removed by any plan change path

---

## ADR-026 - Over-Limit Policy and Data Preservation on Downgrade

**ACCEPTED**, new, depends on ADR-008

### Problem

v1.0 prohibited deleting tenant data on downgrade but never said what actually happens when a tenant holding 500 products moves to a plan that permits 50. Without a rule, each implementer invents one, and one of them will choose deletion.

### Decision

1. **The universal rule: preserve, block writes, never delete.**

| Aspect | Behaviour when over limit |
|---|---|
| Existing records | fully retained |
| Read access | fully retained, admin and API |
| Export | permitted, always |
| Create new of that resource | blocked with `QUOTA_EXCEEDED` |
| Update existing | permitted |
| Delete existing | permitted, by tenant choice only |
| Storefront visibility | governed by an explicit per-resource policy, below |

2. **Storefront visibility on over-limit must be explicit per resource, and the default is to keep serving.** Hiding a merchant's products because they downgraded silently breaks their live business and their SEO. Where a plan genuinely gates public capability, for example white-label branding or custom domains, the gate is an entitlement check at request time, not a data change.

3. **Quota enforcement is at creation time only.** Quota is never enforced retroactively by mutating or hiding existing data.

4. **The tenant must be told, precisely.** On entering an over-limit state, the platform surfaces: which resource, the current count, the new limit, exactly which operations are now blocked, and how to resolve it. A generic "limit reached" message is not sufficient.

5. **Resolution paths.** The tenant may upgrade, or reduce their own usage. The platform must never reduce it for them.

6. **Over-limit is a visible state, not an error condition.** It is queryable per tenant so the Admin UI can display it and so support can answer questions without reading logs.

7. **Seats and members are a special case.** Exceeding a member limit must not lock out existing members, because that can lock the owner out of the very account they need to fix. Existing memberships remain active; new invitations are blocked.

8. **Stores are a special case.** Exceeding a store limit must never take a store offline. Existing stores keep serving; creating a new store is blocked. Taking a paid, live store offline over a quota count is prohibited.

### Verification

- [ ] downgrade with 500 products against a 50 limit deletes nothing and hides nothing
- [ ] creating product 501 returns `QUOTA_EXCEEDED` with the resource, count and limit in `details`
- [ ] updating an existing over-limit record still succeeds
- [ ] existing members retain access when over the seat limit
- [ ] no store goes offline due to a store-count downgrade
- [ ] upgrading immediately clears the over-limit state without data migration

---

## ADR-027 - Domain Verification, TLS Lifecycle and DNS/CDN Port

**ACCEPTED**, new

### Problem

v1.0 listed domain capabilities (Add, Verify, Set Primary, Remove, SSL Status, Redirect) and promised apex, www and subdomain support, but the database blueprint contains **no domain table at all**, and "SSL Status" was treated as a field rather than a lifecycle. Custom domains are therefore unimplementable as written.

### Decision

1. **Domains are modelled.** New platform-core tables:

```plain
store_domains
  id, tenant_id, store_id
  hostname_ascii        -- punycode, canonical, lowercase, no trailing dot
  hostname_unicode      -- display form
  type                  -- APEX | WWW | SUBDOMAIN | PLATFORM
  is_primary
  status                -- PENDING | VERIFYING | VERIFIED | FAILED | DISABLED
  verification_method   -- DNS_TXT | DNS_CNAME | HTTP_FILE
  verification_token
  verified_at, last_checked_at, failure_reason

store_domain_certificates
  id, tenant_id, store_domain_id
  provider, status      -- REQUESTED | ISSUED | RENEWING | RENEW_FAILED | REVOKED | EXPIRED
  issued_at, expires_at, last_renewal_attempt_at, renewal_failure_count
  covers_wildcard
```

Certificate private material is never stored in PostgreSQL. Only metadata and a reference to the secret store.

2. **Verification method.**
   - Primary method is a `DNS_TXT` record on a platform-defined name containing a per-domain token. It works identically for apex, www and subdomains.
   - `HTTP_FILE` is an accepted fallback for operators who cannot edit DNS TXT.
   - `DNS_CNAME` presence alone is **not** accepted as proof of ownership, because a CNAME can be created by anyone who controls a subdomain of a domain they do not own at the apex.

3. **Apex routing is decided explicitly.** Apex hostnames cannot use CNAME. The platform publishes a stable, documented A/AAAA target for apex domains, and a CNAME target for www and subdomains. `ALIAS`/`ANAME` is supported where the tenant's DNS provider offers it but is never assumed, because provider support is inconsistent. The apex A target is treated as a long-lived public contract: changing it requires a migration plan and tenant notification, so it must be an address the platform controls independently of any single hosting vendor.

4. **TLS is a lifecycle, not a status field.** Required behaviour:
   - automatic issuance after successful verification
   - automatic renewal starting at a configured margin before expiry, default 30 days
   - bounded retry with backoff on failure
   - **alerting on renewal failure**, and escalation to an operator queue before the certificate expires
   - a dashboard-visible per-domain certificate state
   - `HTTP-01` for single hostnames; `DNS-01` only where the platform controls the zone, since `DNS-01` on a tenant-owned zone requires tenant DNS API credentials and that is out of V1 scope
   - **wildcard certificates for tenant-owned domains are out of V1 scope** for that reason

   A silent renewal failure presents a browser security warning on a paying merchant's storefront. Alerting is therefore release-blocking, not a nice-to-have.

5. **TLD neutrality.** HTTP and TLS behaviour does not vary by TLD. `.ir`, `.com` and any other suffix are handled by the same code path. There must be no TLD-specific branching in application logic.

6. **What does vary by market is the DNS and CDN provider, not the TLD.** Therefore `DnsProvider`, `CdnProvider` and `CertificateProvider` are ports with swappable implementations (ADR-019 item 4). Provider selection is configuration. Registry-specific operational constraints, nameserver delegation rules and certificate issuance availability for a given market must be **verified against the chosen provider at integration time and recorded in `PROVIDER_MATRIX.md`**, not assumed from documentation and not hard-coded into the domain model.

7. **Redirect policy.** Exactly one domain per store is `is_primary`. All other verified domains 301-redirect to the primary, preserving path and query. `www` and apex must both be claimable and one must redirect to the other according to the store's choice.

8. **Email domains are a separate entity.** Sending domains require SPF, DKIM and DMARC and have their own verification lifecycle. They must not share a table or a state machine with web domains, because a verified web domain proves nothing about mail authorization.

9. **Domain count is a quota; custom domains are an entitlement.** Both are enforced through the standard capability policy chain. Add `domains` to the quota resource list.

10. **Subscription coupling.** On transition to a non-serving state (ADR-024), verified custom domains are removed from the serving set and the certificate is left to expire naturally rather than being revoked, so that reactivation within the window restores service without re-issuance where possible.

### Verification

- [ ] apex, www and a subdomain each verify and serve TLS
- [ ] a `.ir` and a `.com` domain traverse an identical code path, asserted by test
- [ ] renewal failure raises an alert before expiry, proven with a simulated failure
- [ ] removing a domain removes routing and cache entries
- [ ] no DNS, CDN or ACME SDK import exists outside infrastructure
- [ ] `PROVIDER_MATRIX.md` exists and is dated

---

## ADR-028 - Host Resolution Security and Domain Ownership

**ACCEPTED**, new, secures ADR-027

### Problem

Resolving an inbound `Host` header to a `storeId` is a tenant-boundary decision, and v1.0 never treated it as one. Its `Required Constraints` section does not include a uniqueness rule for domains. Without one, two organizations can claim the same hostname and the resolver becomes non-deterministic.

### Decision

1. **Hostname uniqueness is platform-global for verified domains.**

```plain
UNIQUE (hostname_ascii) WHERE status = 'VERIFIED'
```

Not per organization, not per store. A hostname resolves to exactly one store platform-wide, or it does not resolve.

2. **Unverified claims must not squat.** A `PENDING` claim is permitted concurrently by more than one tenant, and expires after a bounded window, default 7 days. The first tenant to **verify** wins and all competing pending claims are invalidated with notification. A pending claim must never block the true owner from proving ownership.

3. **Host resolution is an explicit trusted lookup, never inference.**

```plain
Host header
 -> normalize: lowercase, strip port, strip trailing dot, IDNA/punycode encode
 -> exact match against VERIFIED store_domains
 -> resolve tenantId + storeId
 -> check serving state (ADR-024)
 -> build TenantContext
```

No wildcard match. No suffix match. No fallback to "first store of the tenant". An unmatched host returns a platform-level 404, never a default store, because serving a default store on an unknown host is a cross-tenant content leak.

4. **The `Host` header is attacker-controlled input.** It must be validated for length and character set before use, must never be interpolated into SQL or a cache key without normalization, and must never be trusted for authorization. Storefront resolution grants read access to public storefront data only; it never grants admin capability.

5. **IDN normalization is mandatory.** Hostnames are stored in canonical punycode. The Unicode display form is stored separately for presentation. Normalization happens at the single entry point, before uniqueness checking, otherwise the unique index is defeated by two encodings of the same name. Mixed-script hostnames must be flagged for review to limit homograph abuse.

6. **Periodic re-verification.** Verified domains are re-checked on a schedule, default every 7 days. Repeated failure over a bounded window moves the domain to `FAILED` and out of the serving set, with notification. DNS ownership changes after initial verification, so one-time verification is insufficient.

7. **Reserved subdomains.** Platform subdomains generated from a store slug must reject a reserved blocklist, checked at slug creation and at domain creation:

```plain
www  api  admin  app  auth  login  account  dashboard  cdn  assets  static
static-assets  img  images  media  files  mail  smtp  imap  pop  ftp  ns
ns1  ns2  mx  webmail  status  health  metrics  docs  help  support  blog
shop  store  pay  payment  checkout  billing  invoice  mcp  ai  agent
graphql  ws  socket  test  staging  dev  demo  internal  private  secure
vpn  git  ci  build  registry  root  system  clickup  plus every reserved
name the platform later introduces
```

The list is data, versioned in the repository, and extending it must not require a code change.

8. **Removal is complete.** Removing or failing a domain must remove it from routing, invalidate its cache entries and free the hostname for a legitimate re-claim. A dangling mapping is a cross-tenant risk.

9. **Audit.** Domain add, verify, fail, set-primary, remove and contested-claim resolution are all audited with actor and tenant.

### Verification

- [ ] two tenants cannot both hold the same verified hostname
- [ ] an unknown host returns 404 and never a default store
- [ ] a forged `Host` header cannot reach another tenant's storefront or any admin capability
- [ ] `xn--` and Unicode forms of one hostname collide on the unique index
- [ ] a reserved subdomain is rejected at both slug and domain creation
- [ ] re-verification failure de-routes the domain and notifies the tenant

---

## ADR-029 - Authentication Provider and Session Strategy

**ACCEPTED**, new

### Problem

The v1.0 gap report listed "authentication provider and session strategy need a concrete implementation decision" and then left Phase 1 depending on it. Phase 1 cannot start without this.

### Decision

1. **Self-hosted, first-party authentication in Platform Core.** Identity is a platform-owned aggregate, not delegated to an external identity vendor for V1. Reason: the tenancy model is `User -> Organization -> Membership -> Store` with organization switching, and outsourcing identity while owning membership creates two sources of truth.

2. **Credentials.** Password hashing uses Argon2id, or bcrypt with a documented cost floor if Argon2id is unavailable. No other scheme is permitted. Password policy, lockout and throttling are required, and failed attempts are rate-limited per identifier and per IP.

3. **Sessions are server-side and revocable.** A session record exists in PostgreSQL. The client holds an opaque, `httpOnly`, `Secure`, `SameSite=Lax` cookie for browser surfaces. **Long-lived stateless access tokens are prohibited for browser sessions**, because revocation must be immediate when membership or role changes.

4. **Access tokens** are used for programmatic API and MCP access only, are short-lived, and are exchanged through a refresh mechanism bound to a server-side session. See ADR-002 for what a token may and may not authorize.

5. **Active organization is session state, not token state.** Switching organization updates the session; it does not mint a claim that outlives an authorization change.

6. **Mandatory session invalidation triggers.** Password change, membership revocation, role change, tenant suspension, explicit logout, logout-all-devices, and offboarding.

7. **Extension points, not V1 scope.** External identity providers and SSO are represented by the existing `identity_providers` table and must remain addable without changing the session model. Multi-factor authentication is contract-ready in V1 and implemented when a plan requires it.

8. **Storefront customer identity is separate from platform user identity.** A shopper is a `customer` of a store, not a platform `user`. These must never share a session, a table or a permission model.

### Verification

- [ ] revoking a membership invalidates active sessions within one request
- [ ] a stolen cookie is invalidated by logout-all-devices
- [ ] a customer session cannot reach any admin capability
- [ ] password hashes are never returned by any API or written to any log
- [ ] organization switch is not achievable by editing a client-side value

---

## ADR-030 - Architecture Conformance Enforcement

**ACCEPTED**, new, precondition for Phase 1

### Problem

Every architectural rule in this pack is prose. Prose is not enforceable across a long implementation task, human or AI. v1.0 already noted that CI rules for forbidden imports were "not yet implemented", while simultaneously depending on them in ADR-005 and ADR-005b. This ADR makes the enforcement layer a prerequisite rather than a to-do.

### Decision

1. **The conformance harness ships before the first feature.** It runs in CI on every pull request and fails the build on violation. A rule without a check is documentation, not architecture.

2. **Required mechanical checks.**

```plain
DEPENDENCY DIRECTION
  domain must not import application, interfaces, infrastructure
  application must not import interfaces or infrastructure implementations
  no module may import another module's internals; only its contracts

FORBIDDEN IMPORTS
  domain      -> orm, query builder, pg driver, redis, nestjs, next, react, sdk of any provider
  plugin      -> orm, pg driver, redis, repositories, secret store, infrastructure
  ai / mcp    -> repositories
  automation  -> repositories
  storefront  -> repositories

SINGLETON RULES
  exactly one idempotency implementation
  exactly one tenant-context helper
  exactly one serving-state function
  exactly one money allocator
  exactly one host-resolution entry point

SCHEMA RULES
  every tenant-owned table has tenant_id
  every tenant-owned table has an RLS policy
  no floating-point column on a monetary field
  no module-local idempotency table

SECRET RULES
  no credential-shaped literal in source
  no secret in a snapshot, fixture or log assertion
```

3. **Tooling.** `dependency-cruiser` or ESLint boundary rules for imports, TypeScript project references for compile-time separation, a schema conformance test executed against a real migrated database, and a secret scanner. Choice of tool is free; the checks are not.

4. **Violations are build failures, not warnings.** A warning is ignored by the tenth pull request.

5. **Exceptions are explicit and reviewed.** Any suppression requires an inline justification referencing an ADR and appears in a generated exceptions report. A suppression without a referenced ADR fails CI.

6. **The harness is the contract for automated implementers.** An AI agent must be able to run it locally and receive actionable output. Rules must therefore produce messages that name the rule, the offending file and the correct alternative.

### Verification

- [ ] each listed check has a deliberately failing fixture proving the check works
- [ ] the harness runs in under two minutes so it is actually used
- [ ] a new module scaffolded incorrectly fails CI
- [ ] the exceptions report is empty or fully justified at every release

---

## ADR-031 - Time, Timezone and Calendar

**ACCEPTED**, new

### Problem

The pack computes trials, periods, expiry, grace windows, proration and usage periods, and never states a time model. Off-by-one-day billing errors are the predictable result.

### Decision

1. **Storage is always UTC**, in `timestamptz`. No local time is ever persisted as a naive timestamp.

2. **Business boundaries are computed in a declared timezone, not in server local time.** A billing timezone is stored on the organization and defaults to a platform configuration value. Server local time must never influence a boundary.

3. **Calendar arithmetic, not day counting.** A one-month term is the same day-of-month in the next month with documented end-of-month clamping. A one-year term is the same date next year. `+30 days` and `+365 days` are prohibited for terms.

4. **Boundary convention.** Periods are half-open: `[period_start, period_end)`. Usage periods, quota windows and proration all use the same convention. Mixing conventions across modules is prohibited.

5. **Calendar display is a presentation concern.** The interface layer may render dates in any calendar system the tenant's locale requires, including non-Gregorian calendars. Domain and Application operate exclusively on instants. No business rule may depend on a rendered calendar string.

6. **Clock injection.** Application code obtains time from an injected clock, never from a direct system call, so that term, grace and expiry logic is testable at boundaries.

7. **DST and offset changes.** Boundary computation must remain correct across an offset change in the declared timezone. Tests must cover an offset transition if the configured timezone has one.

### Verification

- [ ] a term created on the 31st clamps correctly in a 30-day month
- [ ] a one-year term lands on the same calendar date, proven against a leap year
- [ ] changing the server timezone does not change any computed boundary
- [ ] no business rule reads the system clock directly
- [ ] half-open convention asserted for usage, quota and proration

---

## ADR-032 - Storefront Read Path Separation

**ACCEPTED**, new, implements ADR-019

### Problem

The v1.0 request pipeline is a single chain: authenticate, resolve tenant, resolve store, build context, authorize, entitlement, quota, idempotency, execute. That is correct for admin and API traffic. Applied to anonymous storefront traffic it is both unnecessary and expensive: there is no user to authenticate, and every page view pays for transaction-local RLS context and a full policy chain. Since the storefront is the majority of traffic, this is the platform's main performance risk.

### Decision

1. **Two declared read paths, one write path.**

```plain
ADMIN / API PATH        authenticate -> tenant -> store -> policy chain -> application service
STOREFRONT READ PATH    host resolution -> serving check -> cached read model
WRITE PATH              always the admin/API path, including storefront writes
```

2. **Storefront writes are not on the fast path.** Cart, checkout, order creation, account actions and reviews traverse the full pipeline with the full policy chain. The fast path is read-only. There is no exception to this.

3. **A dedicated read model.** Public catalog reads are served from a denormalized, per-store read model containing exactly the fields the storefront renders. It is projected from domain events through the outbox. It is a cache, never a source of truth, and must be fully rebuildable from domain data by a documented command.

4. **The read model is still tenant-scoped and still under RLS.** Separation is about avoiding redundant work, never about relaxing isolation. Every read-model row carries `tenant_id` and `store_id`, and the store scope comes from verified host resolution (ADR-028), never from a request parameter.

5. **Staleness is bounded and declared.** Product, price and category reads may be stale within a declared bound. **Inventory availability at checkout must be read live**, never from the read model, because reserving stock against a stale projection oversells. This boundary is not negotiable for performance.

6. **Cache invalidation is event-driven** per ADR-019 item 3, with a time-based fallback as a safety net only.

7. **Connection strategy.** Because the fast path avoids per-request RLS context negotiation on cached hits, the storefront must be able to serve a cached page with zero database connections. Uncached reads use a separate, smaller pool from the admin path so a storefront traffic spike cannot exhaust connections needed by the admin API and workers.

8. **Read replicas.** Uncached storefront reads may target a read replica. Writes and any read inside a write transaction must target the primary. Read-after-write within a session must not be served from a replica.

9. **No duplicate business logic.** Projection code contains no business rules. Pricing, availability and visibility rules live in Domain and are evaluated when the projection is built, not reimplemented in the storefront. This preserves the one-operation-many-doorways rule.

### Verification

- [ ] a cached product page serves with zero database queries, asserted by test
- [ ] the read model rebuilds from domain data to a byte-identical state
- [ ] checkout reads inventory live, proven by an oversell test under concurrency
- [ ] a storefront load spike does not exhaust the admin connection pool
- [ ] a forged host cannot read another store's read model
- [ ] no pricing or visibility rule exists in projection code, enforced by review checklist and conformance test

---

## ADR-033 - API Schema Artifact Generation

**ACCEPTED**, new, applies from Task 2 (Phase 1)

### Problem

`05_API_CAPABILITY_CONTRACTS.md` §1 requires that "OpenAPI and JSON Schema artifacts are **generated from code** and committed. A hand-written schema that drifts from the handler is a defect," and §8 requires that "a CI check fails when generated output differs from the committed artifact." Neither exists. With one capability the gap is trivial; Task 2 adds seven more, so the cost of deciding late rises with every slice.

### Constraint that eliminates the obvious choice

The conventional answer for NestJS is `@nestjs/swagger` with its CLI plugin, inferring schemas from TypeScript types. **That inference cannot work here.** This repository runs through `tsx`/Vitest, both esbuild-based, and esbuild does not implement `emitDecoratorMetadata` — the metadata `@nestjs/swagger` reads. It fails *silently*, producing an empty or wrong schema rather than an error, which is the worst possible failure mode for an artifact whose purpose is to detect drift. (The same limitation already forced explicit construction over type-based DI in the golden path.)

Driving `@nestjs/swagger` manually with `@ApiProperty()` decorators is possible but puts a hand-maintained description of a shape next to the Zod schema that actually validates it: two sources of truth for one contract, free to diverge. §1 forbids exactly this.

### Decision

1. **Zod is the single source of truth** for every capability's input and output shape, in `application/<use-case>.input.ts`. Nothing describes a shape twice.
2. **OpenAPI is generated from those Zod schemas**, via `@asteasolutions/zod-to-openapi` or an equivalent that reads Zod directly. The `@nestjs/swagger` CLI plugin is not enabled and no decorator-based schema description is added.
3. **Capability metadata comes from `CapabilityDefinition`** (`interfaces/<capability>.capability.ts`) — `id`, `version`, `requiredPermissions`, `risk`, `idempotent`, `storeScoped` — supplying operation ids and security requirements.
4. **The artifact is generated by a script and committed**, like a lockfile.
5. **CI fails on drift**: regenerate, diff against the committed artifact, fail on difference. Runs in the existing conformance workflow.
6. **Every documented error code a capability can raise appears in its responses**, sourced from the shared taxonomy, so the published and enforced contracts cannot disagree.

Generation keys off the capability definition and its Zod schemas, never the controller module — capabilities are reachable from MCP, AI and automation as well as REST (`05` §1), and the generator must run in CI with no database reachable.

### Verification

- [ ] the committed artifact covers every implemented capability
- [ ] the CI drift check fails on an intentionally stale artifact, proven by a deliberately failing fixture (ADR-030's standard)
- [ ] no `@ApiProperty` decorator and no hand-written schema exists in the repository
- [ ] the generator runs with no database reachable
- [ ] every error code a capability can raise appears in its documented responses

---

## ADR-034 - Audit Event Placement and Durability

**ACCEPTED**, new, in effect since Task 1 (Phase 1)

### Problem

Two normative documents described the golden path's step 8 differently, and **both descriptions were wrong about what actually ships.**

`03_TECHNICAL_BLUEPRINT.md` §3.1 ordered the pipeline `... Execute Application Service -> Commit Domain Data + Outbox -> Audit -> Return Stable Result`, which places the audit write strictly after a successful commit and says nothing about a failure path — implying that a request which never commits is never audited.

`08_PHASE_1_BRIEF.md` §2 step 8, amended during the golden-path repair, said the event is "written before commit but on a separate connection." That is not achievable as written: `withTenantContext()` is `db.transaction().execute(...)`, whose promise settles only once the transaction has committed or rolled back, so any audit write issued from outside that callback is necessarily issued *after* the domain transaction has resolved.

The only accurate description of the shipped design lived in `DECISION_LOG.md`'s "Correction to the above during implementation" — a working log the precedence chain in `README_START_HERE.md` explicitly excludes. `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §116 flagged exactly this gap and left it open: "`DECISION_LOG.md` is a working log and is **not** part of the precedence chain in `README_START_HERE.md`. If this rule should be normatively citable it needs its own ADR; flagged rather than assumed."

### Constraint that makes an ADR the only durable fix

Amending one document to match the other would not settle which document governs. The precedence chain (`README_START_HERE.md`, `CLAUDE.md`) ranks `03` third and **does not rank `08` at all**; the read orders in `AGENTS.md` §1 and `README_START_HERE.md` both place `08` *above* `03`; and `DECISION_LOG.md` concluded the two are "peers." Three documents, three incompatible answers to the same precedence question.

`AGENTS.md` §1 states the one unambiguous rule in the pack: **"ADRs override every other document."** Only an ADR moots the precedence question instead of depending on its answer.

This is not documentation hygiene. `AGENTS.md` §2 makes the golden path the literal template every later slice mirrors, and Task 2's first slice reuses this mechanism while — unlike `store.read` — actually exercising the failure path.

### Decision

1. **Exactly one audit event per capability attempt**, not one per pipeline step. If authorization (step 6) fails, execution (step 7) never runs, so there is one outcome to record, not two.
2. **The event is written on a connection independent of the domain transaction** — in practice a pool distinct from the one the domain transaction holds — in its own transaction that commits on its own.
3. **The write is issued after the domain transaction has resolved and before the handler returns or re-throws.** The caller never observes an outcome that has not been audited.
4. **The write is unconditional on both paths**, with `outcome` (`SUCCESS` | `FAILURE`) recording which occurred. A rolled-back domain transaction still leaves its audit row.
5. **An audit event attests to an authorized attempt, not to a committed effect.** `outcome` is what distinguishes them. This semantic shift is accepted deliberately.
6. **Audit writing does not live in an application service.** A single use case cannot observe both step 6 and step 7, so the audit call belongs at the composition root that wraps them.

Rejected: writing the event *inside* the domain transaction, where the failure it records rolls it back, losing every failure audit; and writing it only after a successful commit, which leaves failure paths unaudited entirely.

**Accepted residual cost:** the audit row and the domain effect are not atomic. A crash between the domain transaction resolving and the audit write completing can leave a committed effect with no audit record. Closing that window entirely requires putting the audit row in the domain transaction, which loses every failure audit — a strictly worse trade for an audit trail.

### Verification

- [ ] a capability whose permission check fails writes exactly one audit row with `outcome = FAILURE`, proven against real PostgreSQL
- [ ] a capability whose domain transaction rolls back still has its audit row present after that rollback
- [ ] a successful capability attempt writes exactly one audit row with `outcome = SUCCESS`
- [ ] the audit write executes on a connection distinct from the one holding the domain transaction
- [ ] no application service writes an audit event directly
- [ ] the request handler does not resolve until the audit write has completed

---

## ADR-035 - Platform-Scope Audit Events

**ACCEPTED**, new, applies from Task 2 (`auth.login`, first user; `auth.logout` and `auth.logout_all` its second and third — evidence this generalizes rather than being built for `auth.login` alone). `organization.switch` (Task 2 slice 6) was expected to be a fourth user but is NOT: it resolves a real organization before it ever writes an audit row, so it uses that organization's real `tenant_id` like any other tenant-scoped capability, not this sentinel — see DECISION_LOG.md 2026-08-24, decision 4. This ADR governs a capability with no tenant to attribute to; `organization.switch` has one.

### Problem

`08_PHASE_1_BRIEF.md` §6 exit criterion 5 requires "every capability in scope emits an audit event." `audit_events.tenant_id` is `uuid NOT NULL`, with exactly one RLS policy: `USING (tenant_id::text = current_setting('app.tenant_id', true))`. `05_API_CAPABILITY_CONTRACTS.md` §4.1 scopes `auth.login` **global** — at the moment a login attempt is evaluated there is no tenant, and on a failed attempt there may be no known user either. The schema and the exit criterion are in direct tension for the first time: nothing before Task 2 built a capability with no tenant at all.

### Constraint that eliminates the obvious fixes

Making `tenant_id` nullable does not resolve the tension, it relocates it. `NULL::text = current_setting(...)` is `NULL`, never `TRUE`, under any context — including the unset context RLS is supposed to fail closed on. A nullable `tenant_id` row is therefore not "visible only when explicitly queried," it is **permanently unreadable** through the existing policy and every helper built on it (`withTenantContext`, `recordAuditEventDurable`), for every future consumer, including a hypothetical platform-admin audit viewer that does not exist yet and this ADR does not build. Making the row unreadable to close the tension is not meaningfully different from not auditing at all — it fails the exit criterion in substance while appearing to satisfy it in schema.

Not auditing this capability (dropping the exit criterion for global-scope capabilities specifically) was considered and rejected outright: a failed login is precisely the event a real platform most wants recorded, and a documented exit criterion is not implementer authority to narrow.

### Decision

1. **A reserved sentinel tenant id**, `00000000-0000-0000-0000-000000000000` (`PLATFORM_TENANT_ID`, `modules/audit/domain/audit-event.entity.ts`), used as `audit_events.tenant_id` for a capability with no established tenant. `gen_random_uuid()` cannot produce this value for a real organization (probability effectively zero), and no foreign key from `audit_events.tenant_id` to `organizations.id` exists for it to violate.
2. **No schema change.** `audit_events.tenant_id` stays `uuid NOT NULL`; the existing single RLS policy is untouched. Reading a platform-scope row back is `withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, ... })` — identical to reading any other tenant's rows, through the same helper, with no second policy branch, no bypass path, and nothing new to audit in the RLS surface itself.
3. **The sentinel is an audit-storage device only.** It is never attached to `request.tenantContext`, never surfaced in a structured log line, and never returned to a client. A request with no real tenant logs `tenantId: null` honestly; conflating "the value audit_events needs to stay queryable" with "the tenant this request actually acted under" would misrepresent the second thing to make the first thing easier.
4. **Everything else about ADR-034 is unchanged.** One event per attempt, both outcomes, written on `AUDIT_DB` after the domain work resolves and before the handler returns or re-throws. A global-scope capability differs only in which `tenant_id` value it writes, not in when, how many times, or through which connection.

Rejected: nullable `tenant_id` (permanently unreadable, per above); a second RLS policy branch keyed on an "is this a platform actor" claim (speculative machinery with no consumer yet, and a new trust boundary to audit for a problem the sentinel already solves without one); auditing only on success (ADR-034 already rejected this generally, and a failed login is the more valuable half of this specific record).

5. **Amendment, 2026-08-24 (`auth.logout`/`auth.logout_all`, the sentinel's second user):** decision 1's safety argument for the sentinel — "probability effectively zero" plus "no foreign key exists to violate" — is an argument about likelihood, not a structural guarantee. Nothing before this amendment actually forbade an `organizations` row from holding `PLATFORM_TENANT_ID`; if one ever did, that organization would read every platform-scope audit row ever written. Closed mechanically with a forward-only `CHECK` constraint (`organizations_id_not_platform_tenant_sentinel`, `modules/tenant/migrations/20260824090000_tenant__forbid_platform_tenant_id_sentinel.sql`), not a live-DB conformance rule: a `CHECK` prevents the bad row from ever being written, by any future writer (migration, seed script, or a capability not yet built), where a conformance rule only detects it after the fact, the next time someone happens to run `npm run conformance`. This does not change the sentinel value, the schema, or the RLS policy — it only closes a gap decision 1 left open. See DECISION_LOG.md 2026-08-24, correction (a).

### Verification

- [ ] a capability with no established tenant (`auth.login`) writes exactly one audit row per attempt, on both outcomes
- [ ] that row is readable via `withTenantContext(db, { tenantId: PLATFORM_TENANT_ID, ... })`, with no code path other than the standard helper
- [ ] that row is invisible from every other tenant's context, the same fail-closed guarantee every tenant-scoped table has
- [ ] `PLATFORM_TENANT_ID` never appears in `request.tenantContext`, a structured log line, or a response body
- [ ] no RLS policy on `audit_events` changed
- [ ] `organizations` cannot hold `PLATFORM_TENANT_ID` as a real row's id — enforced by a `CHECK` constraint, not merely an improbability argument

---

## ADR-036 - Collection Pagination Contract

**ACCEPTED (new)**, depends on ADR-021 and ADR-033

### Problem

`05_API_CAPABILITY_CONTRACTS.md` §1 requires that "Pagination, filtering and sorting are explicit per endpoint" and never defines what *explicit* means. No implemented capability paginates — every Phase 1 READ is single-resource — so nothing establishes a shape, while `05` §4.2 and §4.4 contract `plan.list`, `invoice.list` and `domain.list`. `AGENTS.md` §2 guarantees that whatever the first list capability ships is copied by every later one, so the first implementer would be setting a platform-wide contract as a side effect of a slice. This ADR supplies the definition `05` §1 requires, before that happens.

Recorded as `RISK_REGISTER.md` R-024; decided as D2-1 (`decisions/2026-08.md`, 2026-08-28) and previously carried only in `PHASE_2_BRIEF.md` §5, which expires with the phase — the wrong home for a platform-wide contract.

### Decision

1. **Keyset (seek) pagination with an opaque cursor. One style platform-wide.** No capability introduces offset/limit, and no capability invents a second cursor format. Offset is rejected because every paginated Phase 2 collection is append-heavy and time-ordered, where offset silently skips or repeats rows under concurrent inserts, and because deep pages cost the database a scan proportional to the offset.

2. **Request shape.** Two optional parameters: `limit` (integer, capability-declared default and maximum) and `cursor` (opaque string). Absent `cursor` means the first page. A capability declares its default and maximum `limit` in its Zod input schema, so both appear in the generated OpenAPI artifact (ADR-033).

3. **Response shape.** `{ items: T[], nextCursor: string | null }`. `nextCursor` is `null` when no further page exists. No total count is returned: a count requires a second scan of the full result set, which defeats the reason keyset was chosen, and a count that is computed on one page and consumed on the next is stale by construction. A capability that genuinely needs a total declares it as its own field with its own justification.

4. **A collection that fits in one page is this contract at its natural bound, not a second style.** `plan.list` will normally return every row with `nextCursor: null`. That is conforming. It is explicitly **not** licence to reimplement a small collection as an offset endpoint, an unpaginated array, or a bare `T[]` later on the grounds that it is small — the shape is uniform so that a client written against one list capability works against all of them.

5. **The cursor is opaque and its encoding is not contract.** It encodes the sort key of the last item on the page delivered, plus the capability id and sort order it was issued for. Clients must treat it as a bearer token for position: not parsed, not constructed, not modified, not carried between capabilities. Encoding may change without a contract version bump precisely because it is opaque; a client that parses it has taken a dependency the contract does not grant.

6. **Sort order is total, and declared.** The sort key must be unique or be made unique by appending a tiebreaker (conventionally the primary key). A non-total order makes keyset pagination skip or duplicate rows at page boundaries, which is the failure this whole shape exists to avoid.

7. **Interaction with RLS, which is where a naive implementation degrades.** For a tenant-owned table, the index backing the cursor's sort key **must have `tenant_id` as its leading column** — `04_DATABASE_BLUEPRINT.md` §8 already requires this of every tenant-owned table's primary access path, and pagination is one. Without it, the RLS policy filters *after* the index scan, so each page costs a scan of every tenant's rows and the cost grows with total platform size rather than with the tenant's own data. This is a correctness-preserving but performance-destroying failure that will not show up in a single-tenant test.

8. **Invalid cursor handling.** A cursor that is malformed, undecodable, or issued for a different capability or sort order is a client error and returns `VALIDATION_ERROR` (`05` §7), the same as any other bad input. **No new error code is required, and none is requested of `05`** — this was checked rather than assumed: a *stale* cursor (well-formed, but the row it names has since been deleted) is not an error at all under keyset semantics, because the query seeks past the encoded key and the deleted row's absence is invisible. Only offset pagination needs a "page no longer exists" concept.

### Rejected

Offset/limit (silent skip-and-repeat under concurrent inserts, and deep-page cost); per-capability choice (maximum fit, guaranteed inconsistency, and nothing for a later slice to mirror, which is what `AGENTS.md` §2 exists to prevent); returning a total count by default (a second full scan per page, for a number that is stale as soon as it is read).

### Verification

- [ ] a paginated capability returns `{ items, nextCursor }` and rejects an `offset` parameter
- [ ] a collection smaller than one page returns every row with `nextCursor: null`, and does so through the same code path as a multi-page collection
- [ ] iterating every page of a collection under concurrent inserts yields no duplicated and no skipped row, proven against real PostgreSQL
- [ ] a malformed cursor, and a cursor issued for a different capability, each return `VALIDATION_ERROR`
- [ ] a cursor whose referenced row has been deleted still returns the correct next page rather than an error
- [ ] the index backing each paginated tenant-owned query has `tenant_id` as its leading column, asserted against the live schema
- [ ] the generated OpenAPI artifact documents `limit`, `cursor` and `nextCursor` for every paginated capability

---

## ADR-037 - Credential Storage and the Encryption Deferral

**ACCEPTED (new)**, depends on ADR-021 and ADR-023

### Problem

ADR-023 item 8 is accepted and binding:

> **Store-scoped credentials** are encrypted at rest, never returned by any read API, and never logged. A store operator may rotate them; rotation must not invalidate historical payment records.

Nothing in this repository implements any of it. `platform/config.ts` reads every value as a plain environment variable; `tools/conformance/rules/secrets.ts` prevents *committing* a credential-shaped literal and is unrelated to *storing* one safely. `RISK_REGISTER.md` R-029 records this, and `06_IMPLEMENTATION_PLAN.md` Phase 2 items 10–12 introduce the payment provider port and its first adapter — the work that first needs somewhere to put a credential.

**This ADR does not restate ADR-023 item 8; it decides how the platform stays compliant with it while the encryption mechanism is deferred.**

**Why this ADR exists before item 10 rather than after it.** Migrations are forward-only (ADR-021 item 8). The moment item 10's `billing_provider_configs` migration merges, its column shape is a schema commitment, and adding encryption afterwards becomes a data migration over live credentials rather than a configuration change. The deferral of the mechanism is cheap; deferring the *shape* alongside it is not, and the two were being treated as one question.

### Decision

1. **The deferral covers building the encryption/KMS service. It never covers writing a plaintext secret.** These were conflated in the reasoning this ADR replaces (D2-2 as originally recommended); the maintainer separated them, and the separation is the substance of this ADR.

2. **Storage shape: a reference to a secret held outside the database.** `billing_provider_configs` stores a provider identifier, a non-secret configuration payload, and a `secret_ref` — an opaque locator naming where the credential actually lives — never the credential itself. `04_DATABASE_BLUEPRINT.md` §2.5 already describes this column as a "platform-scoped credentials **reference**", and §2.7's `store_domain_certificates` already uses `secret_ref` with the same intent ("reference only, never key material"), so this follows an established shape in the pack rather than inventing one.

   Chosen over an envelope-shaped column (ciphertext + key id + algorithm + nonce) because a reference is **shape-stable under every later choice of mechanism**: whether the secret ends up in a KMS, a vault, a sealed secret, or an encrypted column, the reference either resolves to it or is migrated to a new locator, and neither case rewrites the credential's own storage. An envelope column commits now to encryption-in-database specifically, which is one of the options the deferral exists to keep open.

3. **No plaintext secret is ever written to this table, by any code path — including a stub adapter, a seed, a fixture, or a test.** This is the operative rule and the one most likely to be broken by convenience. A fixture that stores `"test-api-key"` in a config column normalises the shape the production path then copies.

4. **Until a resolver exists, a `secret_ref` resolves from configuration.** Phase 2's adapters are fixture-modelled and hold no live credential, so the resolver may be a thin read from `platform/config.ts` keyed by the reference. That is a legitimate implementation of the seam, not a violation of it — what matters is that the *table* never holds the material.

5. **Trigger at which the mechanism itself is owed:** before the first live provider credential is stored — which under ADR-023's fixture-based verification and the Phase 3/4 provider-selection timing is not in Phase 2. Whoever stores the first real credential owns building the resolver against a real secret store, and this ADR is what tells them the column shape already accommodates it.

6. **ADR-023 items 7 and 8 are unchanged and still bind.** Platform-scoped and store-scoped credentials remain separately configured and mutually unresolvable; nothing here weakens the "never returned by any read API, never logged" half, which applies from the first row written.

### Verification

- [ ] `billing_provider_configs` has no column capable of holding credential material, asserted against the live schema
- [ ] no seed, fixture, test or stub adapter writes a credential-shaped value into that table — a deliberately failing fixture proves the check works (ADR-030's standard)
- [ ] a provider config row round-trips through the read path with no secret in the response body and none in any log line
- [ ] the stored shape can be repointed to a real secret store by configuration, with no change to the table's columns — demonstrated by pointing the resolver at a second source in a test
- [ ] rotating the referenced secret does not alter any historical payment record (ADR-023 item 8)

---

## ADR-038 - Idempotency Composition at the Capability Boundary

**ACCEPTED (new)**, depends on ADR-009 and ADR-034

### Problem

ADR-009 governs the shared idempotency store and requires that "a claim is made inside the same transaction that performs the write where the write is single-transaction." It does not say how a capability *reaches* that store.

`modules/capability/interfaces/capability-attempt.ts`'s `runCapabilityAttempt` is the shared outcome-tracking, audit-write and rethrow tail every one of Phase 1's ten capabilities calls (`PHASE_1_DEBT_CLOSURE.md` D-3). Its own doc comment declares a scope ceiling: it "does not choose a transaction strategy," and names Phase 5's capability registry as deliberately deferred work. ADR-009's requirement and that ceiling are in direct tension, and nothing resolved it — recorded as `RISK_REGISTER.md` R-017 and `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` G-5, decided as D2-10.

`06_IMPLEMENTATION_PLAN.md` Phase 2 item 3 builds the store. Every idempotent capability after it inherits whatever shape item 3 establishes, so the shape is decided here rather than by item 3's implementer.

### Decision

1. **Composition, not a branch.** A separate `withIdempotentCapability` wrapper composes with `runCapabilityAttempt`. No idempotency branch is added inside `runCapabilityAttempt`, and no controller hand-rolls a claim.

2. **Order: `runCapabilityAttempt` is outermost; `withIdempotentCapability` runs inside it.**

```plain
runCapabilityAttempt(            <- audits every attempt, fresh or replayed
  withIdempotentCapability(      <- owns the transaction; claim + write together
    domain work
  )
)
```

3. **Why that order, stated normatively rather than left to the implementer.** ADR-034 item 5 is explicit that "an audit event attests to an authorized **attempt**, not to a committed effect." A replayed request *is* a new authorized attempt — a real caller really did make a second authenticated, authorized request — so it is audited like any other. With the wrapper outermost instead, a replay would short-circuit before the audit tail ran and the retry would leave no trace, which both contradicts ADR-034 item 5 and makes a retry storm invisible in exactly the record built to explain what happened.

4. **A replayed attempt is audited, and is distinguishable.** It writes exactly one audit event (ADR-034 item 1) with the outcome the stored snapshot records, and its `metadata` carries an explicit replay marker. Without the marker the audit trail shows two successful creations of one resource and cannot say that only one happened.

5. **The wrapper owns the transaction.** Because the claim and the write must share one transaction (ADR-009), `withIdempotentCapability` opens it via the existing tenant-context helper. This is what keeps `runCapabilityAttempt` at its declared ceiling: the shared tail still knows nothing about transactions, because the layer beneath it does.

6. **It is platform-level, satisfying `AGENTS.md` §4.** One mechanism, owned by the `idempotency` module, used by every capability. "Do not create module-specific idempotency mechanisms" is satisfied by the wrapper being shared infrastructure, not by each module calling the store its own way.

7. **A non-idempotent capability composes only the outer function**, exactly as all ten Phase 1 capabilities do today. Adding the store changes no existing capability's structure until that capability's `idempotent` flag flips.

### The two failure modes this shape exists to prevent

Recorded because they are what a future session will otherwise rediscover:

- **Branching inside `runCapabilityAttempt`** breaches the scope ceiling its own doc comment declares, and starts turning the shared tail into Phase 5's capability registry under Phase 2 schedule pressure — a phase's worth of design taken by accident.
- **Hand-rolling a claim per controller** re-creates precisely the ten-fold duplication `PHASE_1_DEBT_CLOSURE.md` D-3 spent a slice removing, and guarantees the claim/write transaction boundary is got wrong in at least one of them.

### Verification

- [ ] concurrent identical requests with the same key execute the domain work exactly once, proven against real PostgreSQL
- [ ] the same key with a divergent `request_hash` returns `IDEMPOTENCY_CONFLICT` (`05` §7)
- [ ] a replayed request writes its own audit event, carrying the replay marker, and does not write a second domain effect
- [ ] the claim and the write commit or roll back together — a forced failure after the claim leaves no claim behind
- [ ] `runCapabilityAttempt` contains no idempotency-aware branch, asserted mechanically
- [ ] exactly one idempotency implementation exists (ADR-030's existing singleton rule)

---

## ADR-039 - Connection Pool Sizing and Query Timeouts

**OPEN** — options and a recommendation are recorded; the decision is the maintainer's

### Problem

ADR-021 item 6 states:

> **Connection pooling.** Because context is transaction-local, an external pooler in transaction mode is compatible, but statement mode is **forbidden**. The application maintains its own pool; the pooler configuration must be documented and asserted in the deployment checklist.

It requires the application to maintain its own pool — it does — and requires the *pooler's* configuration to be documented. **It specifies no sizing, no timeout and no ceiling for the application's own pool.** This ADR fills a documented silence rather than contradicting an existing decision.

**What is unconfigured today**, verified against current source rather than copied from `RISK_REGISTER.md` R-020:

- `platform/db/pool.ts` is six lines: `new Pool({ connectionString: config.connectionString })`. No `max`, `connectionTimeoutMillis`, `idleTimeoutMillis` or `allowExitOnIdle`.
- `platform/db/connections.ts` creates **two** pools per process — `APP_DB` (`createAppDb`) and `AUDIT_DB` (`createAuditDb`) — each therefore at `pg`'s default `max: 10`, for 20 connections per instance that nobody chose.
- `platform/db/init/001_roles.sql` sets no `statement_timeout` and no `idle_in_transaction_session_timeout` on either role. A repository-wide grep for all six settings returns nothing.

Every capability opens a transaction through `withTenantContext`, so with no server-side `statement_timeout` a single slow query holds its connection with no ceiling at any layer.

### Options

**Where pool sizing belongs.**
  A. `platform/config.ts`, read from the environment — per-process, tunable per deployment without a release, consistent with how every other connection setting is already loaded.
  B. Hard-coded in `pool.ts` — one obvious place, no environment drift, requires a release to change.

**Where statement and idle-transaction timeouts belong.**
  C. Client-side, in the `pg` pool options — travels with the application, and is silently absent for any other connection path (`psql`, a migration run, a future worker).
  D. Server-side, `ALTER ROLE nexora_app SET statement_timeout = …` in a migration — enforced by PostgreSQL regardless of which client connects, cannot be forgotten by a new consumer, and is naturally per-role: `nexora_app` wants a tight ceiling while `nexora_migrate` must be allowed long migrations.
  E. The deployment checklist ADR-021 item 6 already requires — documented, not enforced.

### Recommendation

**A for sizing, D for timeouts, with E documenting both.** Sizing is genuinely deployment-shaped (instance count, database `max_connections`, and provider limits all vary) and belongs in environment config. Timeouts are a safety property that should not depend on which client opened the connection, which is exactly what D gives and C does not; and the per-role split falls out for free, since a migration legitimately needs the ceiling `nexora_app` must not have.

**Two constraints the decision must respect, whichever options are taken:**

- **`AUDIT_DB` must stay available when `APP_DB` is saturated.** Separate pools already guarantee a domain transaction cannot hold an audit connection. But both pools default to the same connection string (`loadAuditDbConfig` falls back to `DATABASE_URL`), so they contend for one PostgreSQL `max_connections` budget: `instances × 2 pools × max` must leave headroom, or a burst exhausts the server and audit writes fail — the exact condition R-010 records as silent.
- **Sizing must be computed against `max_connections`, not chosen per pool in isolation.** PostgreSQL's default is 100; two pools at `pg`'s default 10 means five instances reach it with nothing left for `psql`, migrations or a reconciliation worker.

**On numbers: this ADR proposes none as measured.** `pg`'s `max: 10` is a library default, not a measurement of this workload, and no load test exists (see ADR-010's 2026-08-28 amendment). Any number written into the eventual decision is a starting point to be revised against the first real measurement, and should be labelled as such rather than acquiring authority by being written down.

**Trigger:** the same deployment moment R-012's `TRUST_PROXY` decision is owed at — before this API is first placed behind a proxy or load balancer, or before a second instance runs, whichever comes first. Both are decisions that can only be made correctly with the real topology in hand, and taking them together is cheaper than twice.

### Verification

*(applies once the decision is taken; an `OPEN` ADR has nothing to verify yet)*

- [ ] every pool's `max`, `connectionTimeoutMillis` and `idleTimeoutMillis` is set explicitly, with no reliance on a library default
- [ ] `statement_timeout` and `idle_in_transaction_session_timeout` are set for `nexora_app` and are proven to fire, by a test that runs a deliberately slow query and observes it aborted
- [ ] `nexora_migrate` is exempt from the statement ceiling, proven by a long migration succeeding
- [ ] the sum of all pools' `max` across the planned instance count is asserted against the database's `max_connections`, with documented headroom
- [ ] an exhausted `APP_DB` pool does not prevent an audit write from completing on `AUDIT_DB`
- [ ] the pooler mode assertion ADR-021 item 6 requires exists in the deployment checklist

---

## ADR-040 - Observability Boundary

**OPEN** — options and a recommendation are recorded; the decision is the maintainer's

### Problem

`06_IMPLEMENTATION_PLAN.md` Phase 1 item 12 reads "audit events **and structured observability**," and never defines the second half. `RISK_REGISTER.md` R-010 records that an `AUDIT_DB` outage is detectable but not alerted; `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` F-5 records two inconsistent logging paths and no field redaction. Every future observability question currently has no home, so each one is re-argued from scratch.

**This ADR is not "the platform has no observability."** Stated first, because the opposite framing has already caused one over-scoped proposal:

- **Structured request logging exists and meets its requirement.** `apps/api/logging.middleware.ts` emits one JSON line per request with `requestId`, `correlationId`, `tenantId`, method, path, status and duration — exactly what `08_PHASE_1_BRIEF.md` §2 step 10 requires, which its own doc comment cites.
- **A machine-detectable audit-failure signal exists.** `runCapabilityAttempt` emits a stable structured `audit_write_failed` event and increments `getAuditWriteFailureCount()`, deliberately built as a seam for a future metrics sink (R-010).
- **Error logging is structured and request-correlated** through `HttpExceptionFilter`.

What is undecided is where the *next* layer's boundary sits.

### Options

**1. The two logging paths.** `apps/api/logging.middleware.ts` uses a bare `console.log(JSON.stringify(...))`; `http-exception.filter.ts` and `capability-attempt.ts` use NestJS's `Logger`. There is no shared level control, and `platform/` has no `observability/`.
  A. Unify onto one logger behind a thin platform seam — cheap, no dependency, gives level control and one place to add redaction.
  B. Leave both — they work, and unifying touches request-path code for no behavioural gain.

**2. Tracing and metrics.**
  C. Adopt OpenTelemetry auto-instrumentation now. It is the obvious candidate for a NestJS + `pg` stack and would cover both pools with near-zero application code. **Assessed rather than assumed, and the assessment is not clean:** this repository runs through `tsx`/Vitest, both esbuild-based, and esbuild does not implement `emitDecoratorMetadata` — the limitation that already forced explicit DI in the golden path and eliminated `@nestjs/swagger` in ADR-033. OTel's Node auto-instrumentation relies on module-load patching rather than decorator metadata, so it is *probably* unaffected, but "probably" is not the standard this repository has applied to the two prior instances of the same class of problem, both of which failed silently. Adopting C requires demonstrating it works under this toolchain first.
  D. Defer tracing/metrics with a hard trigger (first multi-instance deployment, or first production traffic), keeping `getAuditWriteFailureCount()`'s seam as the documented first consumer.
  E. Expose a minimal metrics endpoint now with no tracing.

**3. Redaction.** Nothing redacts any field today; what stays out of a log is a property of what callers happen to pass.
  F. Redact at the logging seam, by declared allow-list.
  G. Redact at each call site — flexible, and reliably forgotten.

**4. A metrics endpoint, if one exists.** `apps/api/health.controller.ts` deliberately carries neither the rate-limit state nor the audit-failure counter, on recorded reasoning: `/health` is public and unauthenticated, and publishing internal failure counts there is real operational information disclosure. Any metrics endpoint inherits that reasoning — it is authenticated, bound to a non-public interface, or both. It is never merged into `/health`.

### Recommendation

**A + D + F, with the metrics endpoint constrained as above when it arrives.** Unifying the logging paths (A) is cheap, adds no dependency, and is the prerequisite that makes redaction (F) implementable in one place rather than fifteen — and redaction is the item with real downside today, since nothing prevents a future log line carrying a token or an email. Tracing and metrics (D) should wait for a trigger: there is no production traffic, one instance, and no alerting destination, so adopting OTel now means carrying a dependency and a collector to observe a system nobody is watching — and it should not be adopted at all until it is demonstrated working under this repository's esbuild-based toolchain, given ADR-033's precedent.

### What this ADR does not decide

Named explicitly so it does not become the venue for every future observability argument: **alerting policy** (thresholds, escalation, who is paged), **dashboards**, and **vendor or backend choice** (collector, storage, APM). Those are operational decisions belonging to whoever runs this platform in production, and none of them is blocked by, or blocks, the boundary question above.

### Verification

*(applies once the decision is taken; an `OPEN` ADR has nothing to verify yet)*

- [ ] every log line in the request path is emitted through one seam, asserted mechanically
- [ ] a declared-sensitive field is redacted in a log line, proven by a deliberately failing fixture
- [ ] the audit-failure counter has at least one consumer, or its absence is a recorded, dated deferral
- [ ] no metrics or internal counter is reachable from an unauthenticated endpoint, `/health` included
- [ ] if tracing is adopted, a trace spans an HTTP request through both connection pools and is demonstrated working under `tsx`/Vitest, not only under `tsc`

---

## ADR-041 - Ledger and Audit Table Growth

**OPEN**, new, depends on ADR-020 and ADR-021

### Why this is OPEN rather than ACCEPTED

`PHASE_2_BRIEF.md` §5 settles how ledger tables are *protected* (`REVOKE UPDATE, DELETE` in each creating migration) and says nothing about how they are *bounded*. `RISK_REGISTER.md` R-030 rates the risk `UNMEASURED` and not urgent. No option below has been chosen, and choosing one silently would be exactly the kind of unrecorded architectural decision `AGENTS.md` §5 forbids. It is `OPEN` for that reason and not because it is unimportant — see the timing problem.

### Problem

`audit_events` grows by exactly one row per capability attempt, on both success and failure (ADR-034 item 4), and carries a single index, `(tenant_id, occurred_at)`. Phase 2 adds four more tables with the same growth shape, all append-only per `PHASE_2_BRIEF.md` §5: `usage_ledger_entries`, `billing_payment_events`, `subscription_state_transitions`, and `invoice_lines`.

**What ADR-020 does and does not commit the platform to, for these rows specifically** — read directly, because it is routinely mis-summarised as a retention policy that permits cleanup:

- Rule 4: *"Purge scope is tenant-owned data. Append-only records required for financial, tax or legal purposes are retained per the legal retention window and are **excluded from purge**; they must be reduced to the minimum fields required."*
- Rule 5: *"Audit events recording the deletion itself are **never purged**."*

So ADR-020 **excludes** these rows from the one deletion mechanism the platform has, and commits to retaining financial records for a legal window it does not numerically specify. It says nothing about partitioning, archival, index strategy, or growth of any kind. **The practical consequence: these tables only ever grow, by design, and no document currently owns that.** Deletion is not among the options below because ADR-020 has already removed it.

### The timing problem, which is the real reason this cannot wait indefinitely

Partitioning an empty or small table is a schema change. Partitioning a large populated table is a data migration — and migrations here are forward-only (ADR-021 item 8). `audit_events` is small today. The four Phase 2 ledger tables **do not exist yet**, which is the cheapest moment they will ever have. A decision deferred past their creating migrations converts a cheap option into an expensive one without anyone choosing to.

### Options

1. **Native declarative partitioning by time** (`PARTITION BY RANGE (occurred_at)` or equivalent per table). No extension dependency. Requires a partition-creation policy — a migration per period, or a job. Bounds per-partition scan size and makes detaching a period for archival cheap.
2. **`pg_partman`.** Automates partition creation and retention. A further extension dependency for automation that, at ADR-010's assumed V1 scale (≤5,000 organizations, 50 admin RPS peak), native declarative partitioning covers without it. *(Extension behaviour understood at 2026-09-01, not verified against upstream in this pass.)*
3. **Archival to cold storage.** Detach or export old rows to object storage. Interacts with **R-025**: no object storage port exists, and no phase item owns one.
4. **Accept unbounded growth with a stated trigger** — for example a row count or table size at which option 1 is revisited. Honest and cheap now, and it forfeits the cheap moment described above.

**Recommendation, not a ruling:** option 1 for `audit_events` and the four Phase 2 ledger tables, decided *before* their creating migrations are written, with option 3 layered later if retention windows demand it. Option 2 is not justified at V1 scale. Option 4 is defensible only if the maintainer accepts that revisiting it later is a data migration.

### The non-obvious constraint: partitioning × `FORCE ROW LEVEL SECURITY`

This is the part that could silently weaken tenant isolation, so it is separated from the options above and its epistemic status is stated per claim.

**Established from this repository, verifiable without a database:**

- Every non-exempt table must carry `tenant_id`, `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` and a policy (`04` §7; `PHASE_2_BRIEF.md` §5).
- `tools/conformance/rules/schema-live.ts` enumerates tables via `information_schema.tables WHERE table_type = 'BASE TABLE'` and applies those four requirements to **every** enumerated table that is not on its `TENANT_EXEMPT` list. It reads `relrowsecurity` and `relforcerowsecurity` from `pg_class`, and checks `pg_policies` for a matching row.
- **Therefore, whatever PostgreSQL's inheritance semantics turn out to be, introducing partitions changes what this checker sees.** If partitions are enumerated as base tables, each one is independently subjected to the tenant_id/RLS/FORCE/policy requirement. The harness will then either flag every partition (a false alarm that invites someone to add an `exceptions.json` entry — which `CLAUDE.md`'s standing rule forbids as a way to reach green), or pass them without ever having checked the property it believes it checked. **Both failure modes are worse than the status quo, and the second is silent.**

**NOT established, and explicitly owed verification** — these require running PostgreSQL 17 and were not attempted in this documentation-only pass:

- Whether `FORCE ROW LEVEL SECURITY` set on a partitioned parent applies to reads and writes routed through the parent, to partitions accessed directly, or both.
- Whether a policy created on the parent is enforced for direct access to a partition.
- Whether `relrowsecurity` / `relforcerowsecurity` on a partition's own `pg_class` row reflect the parent's setting or are independent.
- How `information_schema.tables` reports a partitioned parent versus its partitions, which determines exactly what `schema-live.ts` enumerates.

**No claim about these four is made here.** Whoever takes this decision must establish them empirically first — the same standard `RISK_REGISTER.md` R-002 met when it confirmed by direct test that a table's owning role bypasses RLS by default, rather than reasoning about it from documentation.

### Verification

- [ ] the four PostgreSQL semantics questions above are answered empirically against PostgreSQL 17, and the answers recorded, **before** any partitioning migration is written
- [ ] `tools/conformance/rules/schema-live.ts` is confirmed to enumerate partitions and parents as intended, with a deliberately failing fixture proving it still detects a partition missing RLS, FORCE or a policy (ADR-030's own standard)
- [ ] a cross-tenant read against a partitioned tenant-owned table returns zero rows with no tenant context, and zero rows from a wrong tenant's context — proven live, not inferred
- [ ] no `exceptions.json` entry is added to make the harness green over a partitioning change
- [ ] whichever option is chosen, the decision is recorded before the first Phase 2 ledger table's creating migration merges

---

## ADR-042 - Error Message Audience and Localization

**ACCEPTED (new)**, depends on ADR-033 and `05_API_CAPABILITY_CONTRACTS.md` §§1, 7

### Why this is ACCEPTED rather than OPEN

`RISK_REGISTER.md` R-026 recorded this as genuine ambiguity rather than a simple absence, and it stayed unresolved because the question looked like a preference. It is not: `05` §7 already contains a decisive precedent, below, and the evidence runs one way once that precedent is read. Leaving it `OPEN` has a cost that leaving most things open does not — every Phase 2 slice writes error messages under no rule about what may live in them, and the ruling gets *more* expensive the more strings exist and the sooner a client depends on one.

### Problem

`05` §1 defines the error envelope as `code`, `message`, `details`, `requestId`, and **never says who `message` is for** — a developer reading a log, or an end user reading a screen. `CapabilityError` (`modules/capability/domain/capability.errors.ts`) carries a free-text English `message`; `HttpExceptionFilter` returns it verbatim. `05` §2's `TenantContext` carries no locale, and nothing in `apps/`, `modules/` or `platform/` handles `Accept-Language`. Meanwhile `05` §6.4's own worked example is a Persian IDN hostname (`فروشگاه.example`) and `00_PLATFORM_OVERVIEW.md` describes a merchant-facing product.

The gap is the silence, not a missing translation layer. Until the audience is decided, it is unknowable whether *any* localization work is owed.

### The precedent that decides it

`05` §7, on `QUOTA_EXCEEDED` and `OVER_LIMIT`: *"must include, in `details`: `resource`, `current`, `limit`, and `resolution` (`upgrade` or `reduce`). **A bare limit error is not an acceptable contract.**"*

That requirement only makes sense under one reading. If `message` were the user-facing string, the numbers would live in the prose and `details` would be redundant. Requiring them **separately and structurally** means the contract already assumes a consumer that composes its own user-facing text from `code` plus parameters. The localization-key-plus-parameters pattern is therefore not a new proposal — it is what §7 already specifies, for the two codes that most need it.

### Decision

1. **`message` is developer-facing.** It is diagnostic text for a log, a trace, an error tracker or a developer console. It is English, it is not localized, it is not a stable contract, and **it must never be displayed to an end user.**
2. **`code` is the localization key.** It is stable, documented, enumerated in `05` §7, and already declared per capability in `CapabilityDefinition.errorCodes` (ADR-033 item 6) — so the set of keys a client must translate is machine-readable from the published artifact and cannot silently diverge from what the platform raises.
3. **`details` carries the parameters.** Generalised from §7's existing requirement: **any information an end user needs in order to understand or act on an error must be present in `code` + `details`, and must not exist only in `message`.** This is the operative rule and the one that constrains implementers.
4. **No locale in `TenantContext`, and no `Accept-Language` handling, in Phase 2.** Both are premature: under items 1–3 the platform emits no user-facing text, so it has nothing to localize. The interface layer that eventually renders errors owns locale resolution, consistent with ADR-022 item 4's identical treatment of money presentation ("Display is not storage… applied only in the interface layer") and ADR-031 item 5's of calendars ("Calendar display is a presentation concern").
5. **`message` may be logged and returned; it may not be relied on.** It stays in the envelope — removing it would make production debugging materially harder — but no client behaviour, test assertion or UI string may depend on its wording.

**Rejected:** making `message` user-facing and localizing it server-side, which would require a locale in `TenantContext`, a message catalogue, and translation of ~37 codes before any of them has a real consumer — and would put presentation concerns in the domain and application layers that ADR-022 and ADR-031 both keep out.

### What follows for Phase 2

**No localization work is owed, and that is a ruling rather than a deferral.** One obligation is created, and it is small: every capability raising an error must put user-actionable information in `details`, not only in `message`. Concretely, **12 error codes are implemented today** against the **37** `05` §7 lists — so the audit surface is 12 messages, not 37, and it shrinks the earlier it is done. Phase 2's new codes (`ENTITLEMENT_CONFLICT`, `QUOTA_EXCEEDED`, `OVER_LIMIT`, `IDEMPOTENCY_CONFLICT`, `CURRENCY_MISMATCH` and the payment codes) are written under this rule from the start.

### Verification

- [ ] no test asserts on `message` text; assertions are on `code` and on `details` fields
- [ ] `QUOTA_EXCEEDED` and `OVER_LIMIT` carry `resource`, `current`, `limit` and `resolution` in `details`, per `05` §7 — the existing precedent, now the general pattern
- [ ] each of the 12 implemented codes is audited once for information that exists only in `message`, and anything user-actionable is moved into `details`
- [ ] `TenantContext` carries no locale field, and no `Accept-Language` handling exists, at the Phase 2 gate
- [ ] every code a capability can raise appears in its `CapabilityDefinition.errorCodes` and therefore in `openapi.json` (ADR-033 item 6, already enforced) — so a client can enumerate the keys it must translate

---

## ADR-043 - Guarding `CapabilityDefinition` Against `05` §5

**ACCEPTED (new)**, depends on ADR-030 and ADR-033

### Why this is ACCEPTED rather than OPEN

The *rule* is already settled — `PHASE_2_BRIEF.md` §5: "a field is added in the same slice that adds its enforcement, never ahead of it." What was open is whether that rule is enforced mechanically or by review, and in which direction. The analysis below shows only one assertion shape survives contact with the code that already exists, so the direction is determined rather than chosen. That makes it a decision to record, not a question to hold open.

### Problem

`05` §5 declares 14 fields on `CapabilityDefinition`. The implemented type (`modules/capability/domain/capability-definition.ts`) implements 9, omits 5 (`requiredEntitlements`, `quota`, `emitsEvents`, `approval`, `requiresServingSubscription` — the last two non-optional in §5), and adds 2 that §5 does not list (`route`, `errorCodes`, both introduced by ADR-033, which post-dates §5).

The omissions are deliberate and well-argued in the file's own doc comment: "declaring a field nothing enforces is the 'documentation, not architecture' failure ADR-030 warns about." **That reasoning is correct and this ADR does not disturb it.** The defect is that it is prose — and `AGENTS.md` §2 states the governing thesis: "Rules expressed only as prose are not enforceable on a long task." `RISK_REGISTER.md` R-022 records that no conformance rule ties the type to §5. Phase 2 items 6 (entitlement resolution) and 7 (quota policies) are the first work that would add any of the five.

### The direction, and why the obvious ones are all wrong

| Candidate assertion | Fails because |
|---|---|
| implemented **⊆** §5 | `route` and `errorCodes` are in the implemented type and not in §5. Correct code fails today. |
| implemented **⊇** §5 | The five omissions are deliberate and correct. Correct code fails today. |
| implemented **=** §5 | Fails in both directions simultaneously. |

All three naive directions reject the current, correct state. That is not a reason to abandon the check — it is the shape of the answer.

**Decision: assert the *declared difference*, not the sets.** The difference between §5 and the implemented type is itself version-controlled, and the harness fails on any difference that is not declared:

1. **Every field in the implemented type** must either appear in `05` §5, **or** be listed in an `additions` list with the ADR that introduced it. Today that list is exactly `route` and `errorCodes`, both citing ADR-033.
2. **Every field in `05` §5 absent from the implemented type** must be listed in a `deferred` list naming the phase item that will add it. Today: `requiredEntitlements` and `quota` (Phase 2 items 6–7), `approval` (ADR-001, Phase 9), `requiresServingSubscription` (ADR-024, first needed at Phase 2 item 4), `emitsEvents` (the outbox contract, Phase 2 item 14).
3. **Any undeclared difference in either direction fails the build.**

**What this forbids that a subset or superset rule would not:** adding a field to the implemented type without either §5 listing it or an ADR justifying it (the "documentation, not architecture" failure, now mechanical); and **silently dropping a §5 field from the `deferred` list** — which would erase the evidence that the field is still owed. The second is the one review reliably misses, because a shrinking list looks like progress.

**What it deliberately permits:** the current state, unchanged, and every legitimate future divergence — provided the divergence is written down.

### Where the check belongs

**In the ADR-030 conformance harness**, as a new rule with a deliberately failing fixture per ADR-030's own standard. Rejected alternatives:

- **The type system.** TypeScript cannot read a Markdown table. Any type-level version would be a hand-maintained second copy of §5, which is the two-sources-of-truth problem ADR-033 rejected for schemas.
- **The ADR-033 OpenAPI generator.** It already reads `CapabilityDefinition`, which makes it tempting, but its job is publishing, not policing — and it only touches the fields it consumes, so it would be blind to exactly the unconsumed additions this rule exists to catch. Conflating the two would also mean a contract-publishing failure and a governance failure produce the same error.

### Scope: what this ADR does not do

**This ADR decides *what* is enforced and *where*. It does not implement the rule** — no code, fixture or parser is written here, and the `additions`/`deferred` lists above are the decision's content, not a file that now exists. A later, code-authorized session builds it. Until then the rule remains review-enforced and R-022 stays open, which is the honest status.

One consequence to note for that session: §5 is prose in a Markdown table, so the rule needs a parser for it, and a brittle parser that silently matches nothing would be a check that always passes — the same silent-failure mode ADR-033 rejected `@nestjs/swagger` for. The fixture must therefore prove the rule *fails* on a real undeclared divergence, not merely that it passes today.

### Verification

- [ ] a conformance rule exists that parses `05` §5's field list and compares it to the implemented type
- [ ] the rule fails on an undeclared field added to the implemented type, proven by a deliberately failing fixture
- [ ] the rule fails on a `05` §5 field removed from the `deferred` list while still absent from the type, proven by a second fixture
- [ ] the rule passes against the current state with `route`/`errorCodes` declared as ADR-033 additions and the five omissions declared as deferred
- [ ] the rule is not satisfied by an `exceptions.json` entry
- [ ] adding `requiredEntitlements` or `quota` in Phase 2 item 6 or 7 requires removing it from the `deferred` list in the same commit

---

## ADR-044 - Localized Display Text in Phase 2 Tables

**ACCEPTED (was OPEN)**, ruled by the maintainer on 2026-09-02, depends on ADR-021, ADR-033 and ADR-042

### Why this was OPEN rather than ACCEPTED (recorded before the ruling; left as written)

Unlike ADR-042, which had a decisive precedent in `05` §7, this one has no precedent anywhere in the pack. `05` §4.2 gives `plan.list` a scope, a risk class and an idempotency flag and **defines no response shape for it at all**; `05` §6's example contracts do not include it. So no document states whether `plans`, `plan_versions` or `plan_features` carry display text, and none can be read to imply an answer. That is a genuine choice with a real cost in both directions, which is what `OPEN` is for.

### Problem

Phase 2 item 1 creates `plans`, `plan_versions` and `plan_features`; item 17 creates `notifications` and `notification_deliveries`. Some or all of these may need human-readable text — a plan's display name, a feature's label, a notification's body.

**ADR-042 is the closest accepted decision and it does not answer this.** ADR-042 ruled on *error* messages: `message` is developer-facing, `code` is the localization key, `details` carries the parameters, and no localization work is owed in Phase 2 — a ruling, not a deferral. That settles the error envelope and nothing else. **Content a tenant reads in a UI is a different surface, and this ADR exists partly so that a later reader does not mistake ADR-042 for coverage of it.**

The cost of leaving it undecided is asymmetric. `plans` is created once, in item 1, by a forward-only migration (ADR-021 item 8). If a bare `text` column ships and a locale map is needed later, that is a data migration plus a contract change on a published `plan.list` response. If a locale map ships and nothing ever renders it, that is a column nothing enforces — the "documentation, not architecture" failure ADR-030 warns about and ADR-043 was written to police.

### Options

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. No display text in Phase 2.** Plan and feature rows carry a stable machine `key` only; display text is a client-side or catalogue concern introduced by the phase that first renders it. | A UI must ship its own mapping. `plan.list` returns keys, not names. | Nothing. A text column is additive later, in the slice that needs it. |
| **B. Single `text` column now**, locale added later. | An additive migration plus a backfill later, and a contract change on `plan.list`. | Cheap now; the most expensive of the four if a second locale ever arrives. |
| **C. JSONB locale map now** — `{"fa": "…", "en": "…"}` — on every display-bearing column. | A column nothing currently renders, and no constraint expresses "the default locale must be present" without a `CHECK`. | Nothing structurally; the retrofit cost is paid up front whether or not it is ever needed. |
| **D. Separate `*_translations` tables.** | An extra table per entity and a join on every read. For tenant-owned entities it would also duplicate RLS policies onto the translation table; for the platform-global plan tables that cost does not apply, which makes it less bad here than it looks elsewhere. | Heaviest option. It also adds tables, and `PHASE_2_BRIEF.md` §4's 27-table list is described there as "the wall, not a suggestion" — so D cannot be chosen without amending that list. |

### Recommendation

**Advisory only — the ruling is the maintainer's. Option A, with Option C as the named escape hatch.**

1. `plan.list` is scoped **global** by `05` §4.2 and its slice is Phase 2's reference slice, carrying the phase's first review stop (`PHASE_2_BRIEF.md` §3(b)). Returning stable keys keeps that slice minimal, which is what a reference slice is for.
2. Adding a display column that nothing renders is what `PHASE_2_BRIEF.md` §5's `CapabilityDefinition` rule forbids by analogy: "a field is added in the same slice that adds its enforcement, never ahead of it."
3. If the maintainer judges a display name is needed in item 1, then **Option C rather than Option B** — the only expensive mistake available here is choosing a shape that cannot absorb a second locale without a data migration.

**One concrete input the maintainer now has that the drafters of this question did not.** The business-model reconciliation of 2026-09-02 (`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §§2, 6, recorded in `decisions/2026-09.md`) names real plan and add-on products in Persian, and the platform's own worked example of a hostname in `05` §6.4 is a Persian IDN. Whether those names are platform data or client presentation is exactly what this ADR asks, and it is now answerable against a concrete catalogue rather than in the abstract.

### Ruling

**Option A. Ruled by the maintainer on 2026-09-02, following the recommendation above.**

1. **No display text in the Phase 2 plan tables.** `plans`, `plan_versions` and `plan_features` carry a stable machine `key` only. No `name`, `label`, `title`, `description` or locale-map column is added by item 1.
2. **`plan.list` returns keys, not names.** A client renders them through its own catalogue mapping.
3. **Option C (a JSONB locale map) remains the named escape hatch**, available to the phase that first renders plan text and decides the text belongs in the database rather than in the client. That phase reopens this ADR; nothing else does.

**The reasoning, because it is what makes this a ruling rather than a preference.** Plan names are marketing copy and have a materially shorter half-life than the schema they would live in. Under Option B or C a typo in a plan name becomes a data edit against a **platform-global** table — a change with no tenant scope, no RLS boundary and no natural review path — to fix something that is not data in any meaningful sense. And the catalogue is small: the maintainer's own commercial document (`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §§2, 6, reconciled against Phase 2 on 2026-09-02) describes **one subscription plan and three add-ons**, so a client-side mapping costs approximately nothing. That concrete catalogue is what was weighed; the ruling would be less obvious against a fifty-plan catalogue, and a reader should know that.

**One obligation this ruling creates, and it is the reason the ruling is safe rather than merely cheap.**

> **An invoice line must carry its own denormalized description text, captured at issuance.** `invoices` and `invoice_lines` are append-only (`PHASE_2_BRIEF.md` §5) and are read as financial records years after the fact. A line that resolves only to a `plan_key` is not a readable record — and worse, an invoice that renders through a live catalogue mapping would silently **change its own wording** when a plan is renamed or a client's mapping is updated. An issued financial document must not do that.

**This is a requirement on Phase 2 item 13, not a reopening of this ADR.** It is the counterpart of ADR-048's ruling that an invoice carries its own number: both are things an append-only financial record must hold on its own rather than resolve by reference. Item 13's slice owes the column; this ADR owes only the statement that it is owed.

### What this ADR does not do

- **It does not reopen ADR-042.** Error-message audience, the `code`-as-localization-key rule, and the ruling that no localization work is owed in Phase 2 all stand unchanged. This ADR concerns content text only.
- It does not decide anything about Phase 3 commerce catalogue text (product names, descriptions, category labels) — `04` §3, a different phase, and a far larger surface on which Option D becomes materially more attractive.
- It does not add a locale to `TenantContext` or introduce `Accept-Language` handling; ADR-042 item 4 already rules those out for Phase 2 and this ADR does not disturb that.

### Verification

- [ ] the ruling names, per Phase 2 table, whether it carries display text
- [ ] item 1's migration matches the ruling exactly, with no display column added "for later"
- [ ] if Option C is ruled, a `CHECK` guarantees the default locale is present, and a contract test proves a missing locale is rejected rather than silently returning `NULL`
- [ ] `openapi.json` is regenerated if the `plan.list` response shape changes (ADR-033 items 4-6)
- [ ] a reader of this ADR cannot come away believing ADR-042 already covered content text

---

## ADR-045 - Optimistic Concurrency for Mutable Phase 2 Rows

**ACCEPTED (was OPEN)**, ruled by the maintainer on 2026-09-02, depends on ADR-021 and ADR-036; interacts with R-008, R-036 and ADR-048

### Why this was OPEN rather than ACCEPTED (recorded before the ruling; left as written)

The mechanism is nearly forced — see the recommendation — but **the decision's real content is the list of tables, not the column type**, and that list is a scope judgment about which rows may be concurrently written in Phase 2. Several candidate tables have no second writer until an item that has not been designed yet exists. Choosing silently for them would be exactly the unrecorded architectural decision `AGENTS.md` §5 forbids.

### Problem

Most of Phase 2's 27 tables cannot suffer a lost update: seven are append-only under `PHASE_2_BRIEF.md` §5's `REVOKE UPDATE, DELETE`, and nine are platform-global reference data written by migration or operator action rather than by a tenant-facing capability. A minority are genuinely mutable, and for those a read-modify-write race is undetected today.

**Why the existing mitigation does not cover this.** A PostgreSQL deadlock or serialization failure already reaches the client as `CONCURRENCY_CONFLICT` / 409 rather than `INTERNAL_ERROR` / 500 — that mapping shipped as R-008's candidate mitigation. But it fires only when PostgreSQL itself raises an error. A read-modify-write at `READ COMMITTED` — read the row, compute in application code, write it back — produces no database error at all: PostgreSQL serializes the two writes happily and the first one is simply lost. **The existing mapping cannot catch it, because there is nothing to catch.**

This failure family is not hypothetical in this codebase. **R-008** records an intermittent failure on `membership-revoke`'s two-concurrent-owners test whose root cause is `UNDETERMINED` for one of its two now-distinct threads, and **R-036** records that the error-code contract for a mid-flight membership revocation is undefined. Neither is resolved by this ADR.

The forward-only constraint applies with full force: a `version` column must exist in the **creating** migration, or adding it later means backfilling live rows.

### The table list, derived here rather than inherited

Derived from `PHASE_2_BRIEF.md` §4 and §5 by elimination — 7 append-only + 9 platform-global + 11 remaining = 27 — and the remainder then sorted by whether Phase 2 as scoped actually produces two concurrent writers for the same row.

**Tier 1 — concurrently mutable, with two distinct writers demonstrable from Phase 2's own scope. These are the ones a ruling must cover.**

| Table | Item | Mutated | The second writer, named |
|---|---|---|---|
| `subscriptions` | 4 | status, `auto_renew`, pinned version ids, current period reference | ADR-024 item 8's jobs (`subscription.rollover`, `subscription.expire`, `trial.expire`) run against rows a capability (`plan.change`, `subscription.cancel`, `subscription.renew`) can be mutating at the same moment |
| `billing_payment_intents` | 12 | status, verification attempts | item 12 is "payment intent, **verify, sweep**" — the reconciliation sweep and `billing.payment.verify` are two writers by the item's own name |
| `tenant_over_limit_states` | 8 | current count, limit, `entered_at` | two concurrent `usage.record` calls, which is the ordinary case rather than the edge case |
| `subscription_changes` | 15 | the scheduled change's state | **ADR-025 item 5 designs this race explicitly**: a pending downgrade is a persisted row the tenant "must be able to see and revoke before it applies" (`plan.change.cancel_scheduled`) while "applying it is a scheduled job" |
| `idempotency_records` | 3 | status, `response_snapshot` | concurrent duplicate requests are the table's entire purpose |

**`subscription_changes` is an addition to the list this ADR was drafted from, and it is not a marginal one:** ADR-025 item 5 requires a user-cancellable row that a job also applies, which is a lost-update race specified by an accepted ADR. **`idempotency_records` is on the list but may not need the column:** ADR-009's `UNIQUE (tenant_id, capability, idempotency_key)` plus the claim-inside-the-transaction rule may already serialize every writer, in which case a `version` column there is redundant rather than wrong. The ruling should say which, because "add it everywhere" and "add it where it does work" are different decisions.

**Tier 2 — mutable, but no second Phase 2 writer exists. A ruling must state a position rather than pass over them in silence.**

| Table | Item | Why it is not Tier 1 |
|---|---|---|
| `notifications`, `notification_deliveries` | 17 | delivery attempt state is mutable and a retry worker is the obvious second writer, but item 17's flows are not designed yet |
| `billing_refunds` | 13 | ADR-023 item 10's intent-and-verify shape implies mutable status, but **no refund capability exists in Phase 2** (`05` §4.2 has none; `commerce.refund.create` is Phase 3 and store-scoped), so the manual audited path is the only writer |
| `tenant_entitlement_overrides`, `tenant_quota_overrides` | 6, 7 | no `05` §4.2 capability sets an override; these are written by seed or operator action |
| `entitlement_sources` | 6 | ADR-008's explainability record of a resolution — record-shaped, and arguably it should never be updated at all. **Side finding, recorded because this derivation surfaced it and nothing else owns it: `entitlement_sources` is record-shaped and is *not* on `PHASE_2_BRIEF.md` §5's `REVOKE UPDATE, DELETE` list.** Whether that omission is deliberate is stated nowhere. It is not this ADR's to decide. |

### Options

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. Nothing.** Rely on transaction isolation as-is. | Lost updates are silent and will be found in production, not in tests. | Nothing formally — but the cheapest moment to add a column passes and does not come back. |
| **B. `version integer NOT NULL DEFAULT 0`** on a named list; every update carries `WHERE … AND version = $n` and bumps it; zero rows affected → `CONCURRENCY_CONFLICT`. | One column and one discipline per listed table. Callers must handle 409. | Nothing. Composes with C. |
| **C. `SELECT … FOR UPDATE`** in the use case. | A lock held for the transaction's duration; contention on hot rows; deadlock risk, which is the family R-008 already lives in. ADR-021's own verification list already requires explicit row locking on ledger write paths, so this is partly existing house practice. | Nothing — it composes with B rather than replacing it. |
| **D. `SERIALIZABLE` isolation** for those transactions. | Higher abort rate under load; every caller must retry; a global change to how transactions are opened. | Interacts with **ADR-039 (OPEN)** on pool sizing and timeouts — ruling D here would partly pre-empt an open ADR. |

### Recommendation

**Advisory only — the ruling is the maintainer's. Option B, scoped to Tier 1, with an explicit position recorded for Tier 2 and for `idempotency_records`.**

1. It reuses the **already-mapped** `CONCURRENCY_CONFLICT` / 409 rather than inventing a code, so `05` §7 and the error contract need no change.
2. The column is free at creation time and a data migration afterwards — the same forward-only argument `PHASE_2_BRIEF.md` §5 makes for `billing_provider_configs`.
3. It does not pre-empt ADR-039, which Option D would.

**Adding `version` to an append-only table is a defect, not a harmless extra.** The seven tables on §5's `REVOKE UPDATE, DELETE` list cannot be updated by `nexora_app` at all, so a `version` column there would be a field nothing can ever change — precisely the "documentation, not architecture" failure. **`outbox_events` is on that list**, and is therefore **not** a candidate here despite being obviously stateful; where its delivery state lives is ADR-050's question, not this one's.

### Ruling

**Option B, scoped to Tier 1 minus `idempotency_records`. Ruled by the maintainer on 2026-09-02, following the recommendation above** — including its instruction that the ruling state a position on Tier 2 and on `idempotency_records` rather than leave them implied.

`version integer NOT NULL DEFAULT 0`, added in each table's **creating** migration, with every update carrying `WHERE … AND version = $n` and bumping it; zero rows affected surfaces as `CONCURRENCY_CONFLICT` / 409.

| Table | Column | Why |
|---|---|---|
| `subscriptions` | **yes** | the renewal job, `subscription.cancel`, `plan.change` and `subscription.reactivate` all write it |
| `subscription_changes` | **yes** | ADR-025 item 5's own design — the tenant may revoke a pending change while a scheduled job applies it |
| `billing_payment_intents` | **yes** | the verify callback and the reconciliation sweep both write status |
| `tenant_over_limit_states` | **yes** | the usage recorder and the over-limit evaluator both write it |
| `idempotency_records` | **no** | below |
| the six Tier 2 tables | **no** | below |

**`idempotency_records` is excluded, and the reason matters more than the exclusion.** ADR-009's `UNIQUE (tenant_id, capability, idempotency_key)` plus the claim-inside-the-transaction rule already serialises every writer of a given row: a second claimant does not read-modify-write, it **collides on the constraint** and is rejected by the database before any application-computed value exists to be lost. A `version` column there would be a field nothing needs — the same defect this ADR's own recommendation warns against for append-only tables, arriving in a different shape. **Reopening trigger: the first slice that adds a writer which mutates an already-claimed record outside the claiming transaction.** ADR-009's own reconciliation path for operations spanning an external call is the likeliest candidate, and it is a slice's decision, not this one's.

**Tier 2 gets no column now**, on ADR-046's logic applied to columns — a field is added in the same slice that adds its enforcement, never ahead of it. The six, named so the trigger is checkable rather than rhetorical: **`notifications`, `notification_deliveries`, `billing_refunds`, `tenant_entitlement_overrides`, `tenant_quota_overrides`, `entitlement_sources`.** **Reopening trigger: the first slice that gives any one of them a second writer** — for the first three that is a retry worker, a refund capability, or a delivery-status callback; for the two override tables it is a capability that sets an override, of which `05` §4.2 currently has none. That slice adds the column to that table, in its own migration, and records which of the six it moved.

**The interaction with ADR-048 is resolved rather than left open, and the section immediately below records why it was thought to be open.** The tension it names — gap-free numbering versus optimistic-concurrency retry — does not bite, for two independent reasons: **`invoices` is append-only and never carries a `version` column at all**, so the optimistic mechanism ruled here never touches it; and **ADR-048's counter is locked pessimistically inside the issuing transaction** rather than retried optimistically, so no number is ever allocated by a writer that will later be rejected and retried. The two mechanisms do not meet. Both ADRs were ruled on the same day with the other in view, satisfying that section's own condition.

**This ruling closes neither R-008 nor R-036**, exactly as the scope fence below states. Nothing here establishes that a `version` column is relevant to R-008's undetermined thread, and nothing here defines R-036's missing error-code contract.

### The interaction with ADR-048, which neither ADR may be ruled without

**Gap-free invoice numbering and optimistic-concurrency retry pull in opposite directions.** Optimistic concurrency's whole contract is that a losing writer is rejected and retries; a gap-free number allocated before that rejection is either burned — producing exactly the gap the scheme exists to prevent — or held under a lock for the transaction's duration, serialising issuance and removing the concurrency the retry model assumes. ADR-048 records the same tension from its own side. **Rule one and the other's option set changes.**

### What this ADR does not do

- It does **not** resolve **R-008**. R-008's root cause is undetermined for one of its two threads; a `version` column may or may not be relevant, and asserting that it is would be the unverified claim this project's house style refuses.
- It does **not** define **R-036**'s missing error-code contract for a mid-flight membership revocation.
- It does **not** touch any Phase 1 table. The list above is Phase 2 tables only; whether `memberships` or any other existing mutable table needs the same treatment is a separate question this ADR deliberately leaves alone.
- It does **not** decide where `outbox_events`' delivery state lives (ADR-050), and it does **not** rule on `entitlement_sources`' append-only posture, which it only records as found.
- It does **not** cover Phase 3 inventory or oversell, which is `04` §3 and a different phase.

### Verification

- [ ] the ruling names the exact set of tables that gain the column, and states for each Tier 2 table why it does or does not
- [ ] the ruling states whether `idempotency_records` needs the column given ADR-009's unique constraint, rather than leaving it implied
- [ ] each named table's creating migration includes the column — not a later migration
- [ ] no append-only table on `PHASE_2_BRIEF.md` §5's `REVOKE` list carries a `version` column
- [ ] an application integration test proves a stale-version update is rejected, not silently applied
- [ ] an interface contract test proves that rejection surfaces as `CONCURRENCY_CONFLICT` / 409
- [ ] this ADR and ADR-048 are ruled together, or the second ruling re-reads the first
- [ ] the ADR text states explicitly that it closes neither R-008 nor R-036

---

## ADR-046 - Soft-Delete Mechanism for ADR-020's Reversible Window

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-02, depends on ADR-020 and ADR-026

### Why this is ACCEPTED rather than OPEN

The same shape of argument ADR-042 made: the evidence runs one way, and leaving the question open has an asymmetric cost.

**No Phase 2 capability deletes anything.** `05` §4.2's fifteen commercial-lifecycle capabilities contain no delete; `PHASE_2_BRIEF.md` §5 states that deletion is only ever an explicit tenant or operator request and that no Phase 2 capability performs one. So the "add the column now, it is cheap at creation time" argument — correct for ADR-045's `version` and for `billing_provider_configs`' credential shape — **does not transfer**, because there would be no reader, no writer and no test to exercise the column. Meanwhile the cost of adding it is not one column but roughly twenty, each carrying a permanent query-correctness obligation (`WHERE deleted_at IS NULL`) that **no conformance rule catches** and whose failure mode is a data-visibility bug rather than a loud error.

Held open, every Phase 2 slice would be written by someone who does not know whether their queries owe that filter. That is the asymmetry: the cost of the wrong ruling here is one additive migration later; the cost of no ruling is twenty slices of ambiguity.

### Problem

**What is already settled and is not reopened here:** nothing is deleted by any billing event — expiry, downgrade and cancellation are never destructive (ADR-020 rule 1, ADR-026 item 1, `AGENTS.md` §4). Deletion is only ever an explicit, authenticated, logged tenant or operator request, **two-phase with a reversible window** (ADR-020 rules 2-3), default 30 days.

**What was not settled is whether that reversible window has a per-row schema representation.** Read directly, ADR-020's state table says OFFBOARDED data is *"retained for the retention window, then purged"* — so during the window **nothing has been deleted**, and reversibility is satisfied by retention alone. The question is therefore narrower than it first appears: not "how is the window implemented" but "does any table need a `deleted_at` column to express it".

There is a specific trap in the neighbourhood, which `PHASE_2_BRIEF.md` §5 already documents for the nullable-`tenant_id` case and which applies to any RLS-level `deleted_at` filtering. This codebase's RLS policies compare `tenant_id::text = current_setting('app.tenant_id', true)`. Under three-valued logic a `NULL` comparison evaluates to `NULL` — neither true nor false — so the row becomes invisible to **every** caller including its intended reader, and **the failure is silent rather than loud**. ADR-035 rejected the closely related nullable-`tenant_id` approach for `audit_events` on exactly this ground.

**The interaction of any such policy predicate with `FORCE ROW LEVEL SECURITY` is unverified in this repository and is not asserted here** — the same posture ADR-041 takes toward partitioning × `FORCE`, recorded as *owed empirical verification* rather than claimed. Nothing in this ADR depends on the answer, because the ruling adds no such predicate; the note exists so that whoever later rules Option B or C knows the verification is owed before, not after.

### Options

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. Tenant-state only.** ADR-020's four tenant-data states live on the tenant; no per-row column anywhere. The reversible window is a window on the *tenant*, not on rows. | Cannot express "this one plan was deleted and can be restored" — only "this tenant is in OFFBOARDED and can be brought back". | Per-row restore, which nothing in Phase 2 needs. |
| **B. `deleted_at timestamptz` on every tenant-owned table now.** | ~20 columns nothing sets; a query-correctness obligation on every read that no test and no conformance rule enforces; if pushed into RLS, the three-valued-logic hazard above. | Nothing — but it front-loads the entire cost for a capability no Phase 2 item delivers. |
| **C. `deleted_at` added per-table, in the slice that first needs it.** | An additive migration each time, and a rule that must be remembered. | Nothing. This is A plus a named escape hatch. |
| **D. Out-of-table snapshot** — the row's pre-deletion state written to a retention store for the window's duration. | A new store and a new lifecycle to operate. | Overlaps with the tenant-granular recovery question now recorded as **R-038**; deciding it here would pre-empt that row. |

### Decision

**Option A, with Option C as the named escape hatch. Ruled by the maintainer on 2026-09-02.**

1. **No `deleted_at` column is added to any table in Phase 2.** Not to a table in `PHASE_2_BRIEF.md` §4's list, and not to a Phase 1 table.
2. **No query in Phase 2 owes a soft-delete filter**, and no reviewer should ask for one. This is the operative consequence and the reason the ruling is worth having.
3. **The reopening trigger is named: the first capability that deletes anything.** Not a date, not a phase — a capability. When one is designed, this ADR is reopened and Option C applies to the table that capability deletes from, in that capability's own slice.
4. **If B or C is ever ruled, one thing must be decided with it:** whether `deleted_at` filtering lives in the RLS policy or in application queries. The RLS variant's interaction with `FORCE ROW LEVEL SECURITY` is **unverified** (above) and must be established empirically first, to the standard R-002 met when it confirmed by direct test that a table's owning role bypasses RLS by default.

### What this ADR does not do

- **It does not disturb ADR-020 or ADR-026.** Non-destructiveness of billing events, the two-phase deletion requirement, the 30-day reversible window, ledger exclusion from purge (ADR-020 rules 4-5) and over-limit data preservation all stand exactly as accepted.
- **It does not claim ADR-020's reversible window is unimplemented or unbacked.** During the window nothing has been deleted; retention is the mechanism. The distinct gap — that there is no *tenant-granular recovery path* from an erroneous or premature purge, or from any tenant-scoped data-loss incident — is **R-038**, and is deliberately not folded in here.
- It does not design a backup, archival or restore system, and it commits to no RPO or RTO. ADR-010's numeric targets are already flagged as unverified assumptions until `06` Phase 4 item 9; inventing recovery numbers here would repeat that mistake in a new place.
- It does not rule on retention *duration* for any table. `sessions` growth is **R-039**; ledger and audit growth is **ADR-041**; tenant data retention is ADR-020's own.

### Verification

- [ ] no Phase 2 migration adds a `deleted_at`, `is_deleted` or equivalent column to any table
- [ ] no Phase 2 query carries a soft-delete predicate
- [ ] the reopening trigger is honoured: the first capability that deletes reopens this ADR in its own slice, before its migration
- [ ] if that reopening rules RLS-level filtering, an integration test against real PostgreSQL proves a soft-deleted row is invisible to its own tenant **and** that a non-deleted row is still visible — the three-valued-logic trap fails loudly in a test, not silently in production
- [ ] ADR-020 rules 1-7 and ADR-026 items 1-8 are unchanged by this ADR

---

## ADR-047 - Price Version Binding on Renewal

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-02, extends ADR-024, depends on ADR-022 and ADR-025

> **Number reassignment, recorded so a reader holding the strategic package is not confused.** `NEXORA_STRATEGIC_PACKAGE_2026-09-02`'s `03_DECISIONS_TO_LOCK.md` drafted ADR-047 as "Tenant-Granular Logical Restore". **That ADR was not written**, because its premise — that ADR-020's reversible window "has no mechanism behind it" — does not survive reading ADR-020: during the window nothing has been deleted, so retention *is* the mechanism (see ADR-046). The narrower true finding is recorded as **R-038**, a risk row rather than an ADR. The number ADR-047 carries this subject instead.

### Problem

`subscriptions` pins a `plan_version_id` and a `price_version_id` (`PHASE_2_BRIEF.md` §4; ADR-024 item 1 pins them on each `subscription_period` too), and `prices`/`price_versions` are immutable versioned rows (item 2). ADR-025 item 6 rules what happens to that pinning on a **plan change**: "a change moves the subscription to a specific target `plan_version_id` and `price_version_id`, captured at change time."

**Nothing states what happens on a renewal.** ADR-024 item 4 describes the renewal lifecycle in full — T-30d invoice, T-14d and T-3d reminders, T-0 paid or unpaid — and never says which price version the T-30d invoice is drawn against. Both readings are defensible from the accepted text: the new period inherits the subscription's pinned version, so a subscriber is locked to the price they first bought at forever; or it re-pins to whatever version is current, so a published price change reaches everyone at their next renewal.

This is not a theoretical fork. The business model reconciled against Phase 2 on 2026-09-02 (`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §2) **prices renewal above the first year** — 6,000,000 for year one against a range of 8,000,000-10,000,000 per year thereafter. Under the inherit-forever reading, that product is not sellable on this schema at all, and nobody would discover it until the first renewal cycle, a year after item 4's migration became forward-only history.

### Decision

**Ruled by the maintainer on 2026-09-02.**

1. **Renewal re-pins to the current price version.** A renewed period is bound to the `price_version_id` current at issuance, not to the version the subscription was created with. **No subscriber is locked to the price they first bought at**; a published price change reaches every subscriber at their next renewal.

2. **The binding moment is the issuance of the renewal invoice — T-30d per ADR-024 item 4 — not `period_end`.** The price version current when the invoice is issued is pinned onto that invoice and onto the `SCHEDULED` period, and a price version published in the intervening 30 days does not move it. Binding at `period_end` would change an already-issued invoice underneath the customer, which is the failure this clause exists to prevent.

3. **The T-30d notice carries the new price.** This is not an extra obligation — it is how ADR-024 item 10's mandatory notification is satisfied for a renewal whose amount has changed. A renewal notice that does not state a changed amount is a defect under item 10, not merely poor practice.

4. **Early renewal is priced by the issued invoice, not by the payment date.** ADR-024 item 5 requires that paying before `period_end` extend from the existing `period_end` and never shorten a term. The price follows the same principle: **a tenant paying an issued renewal invoice pays that invoice's amount**, whatever the current price version has become in the meantime. If a tenant renews *before any invoice has been issued* — earlier than T-30d — the price version current at that payment applies, and that payment issues the invoice. **The rule in one line: the price is the invoice's; the invoice's price is the version current when the invoice was issued.**

5. **A renewal re-price and a mid-term plan change must not double-count.** ADR-025 governs mid-term changes: an upgrade is prorated against the *current* period and explicitly **does not change `period_end`** (item 3). A renewal prices the *next* period. They address disjoint intervals, and the interaction rule is that **the re-pin at renewal is computed from whatever `plan_version_id` the subscription holds after any change has applied** — a mid-term change updates the pinning (ADR-025 item 6), and renewal then re-pins that plan's current price version for the next term. A scheduled downgrade with `effective_at` at `period_end` (ADR-025 item 5) applies **before** the next period is priced, so the renewal invoice for that period is drawn against the downgraded plan. **Proration is never applied to a renewal;** a renewal is a full term at the current price.

### What this ADR does not do

- **It does not set, constrain or endorse any price.** The business-model figures above are cited as evidence that the question is live and load-bearing, not as a commitment. Prices are data in `price_versions`, authored outside this document. Note also that those figures are denominated in Toman while ADR-022's worked example is IRR; ADR-022 item 4 ("Display is not storage… applied only in the interface layer") already governs that, and this ADR does not restate or amend it.
- **It does not create a grandfathering mechanism.** If the platform ever needs to hold specific tenants at a legacy price, that is a new construct — a tenant-level price override, or a plan version reserved for them — and it needs its own ADR. This ADR rules the default and states plainly that there is no exception path today.
- **It does not decide notice content or channel.** ADR-024 item 10 requires the owner be reached through at least one channel with the attempt audited; item 3 above adds only that the amount must be in it. Item 17's notification flows own the rest.
- **It does not touch ADR-025's proration arithmetic.** The allocator, the half-up rounding, and the "`period_end` does not change on an upgrade" rule are unchanged.
- **It does not address add-on pricing.** `PHASE_2_BRIEF.md` §4 excludes `subscription_items` and D2-7 keeps the add-on rung present-and-empty, while the business model sells three separately-priced add-ons. That mismatch is recorded in `decisions/2026-09.md`, deliberately not as a decision here.
- It does not decide invoice numbering, which is **ADR-048**.

### Verification

- [ ] a renewal invoice issued after a price version is published is drawn against the new version, proven by a test that would fail under inherit-forever
- [ ] a price version published between T-30d and `period_end` does **not** alter the already-issued invoice, proven by a test
- [ ] an early payment of an issued renewal invoice charges the invoice's amount, not the current version's
- [ ] a renewal following a mid-term plan change prices the next period against the changed plan, with no proration applied to the renewal
- [ ] a scheduled downgrade effective at `period_end` is applied before the next period's invoice is priced
- [ ] the T-30d notice includes the amount and currency as `MoneyDto` (ADR-022 item 7), and the notification attempt is audited (ADR-024 item 10)
- [ ] `subscription_periods` reconstructs, for any past period, exactly which `price_version_id` it was billed at (ADR-024 item 1's append-only period history)

---

## ADR-048 - Invoice Numbering

**ACCEPTED (was OPEN)**, ruled by the maintainer on 2026-09-02, depends on ADR-021 and ADR-022; interacts with ADR-045

### Why this was OPEN rather than ACCEPTED (recorded before the ruling; left as written)

The three sub-questions below trade off against each other and against ADR-045 in a way no existing document resolves, and at least one of them — gap-free versus gap-tolerant — is frequently a **legal or tax** requirement rather than an engineering preference, which makes it the maintainer's to answer and not an implementer's. Recording a recommendation without the ruling is the honest state.

### Problem

**Nothing anywhere in this repository addresses invoice numbering** — verified 2026-09-02 by grep across every Markdown and TypeScript file. `04` §2.5 and `PHASE_2_BRIEF.md` §4 name `invoices` and `invoice_lines`, both created by item 13 and both on §5's `REVOKE UPDATE, DELETE` append-only list; `05` §4.2 gives `invoice.list` a scope and a risk class and no response shape; ADR-024 item 4 requires an invoice be issued at T-30d; ADR-022 item 8 requires currency stored alongside every amount. None of them names an invoice number.

The moment item 13's migration merges, three questions become schema commitments under a forward-only migration rule (ADR-021 item 8):

1. **Per-tenant sequence or platform-global?** A tenant-visible number that jumps from 41 to 8,209 because other tenants were issued invoices in between is a support problem at best and an information leak about platform volume at worst. A per-tenant sequence is the shape tenants expect, and it multiplies the allocation state by the tenant count.
2. **Gap-free or gap-tolerant?** A gap-tolerant number is trivially concurrent-safe. A gap-free number is a hard serialization problem, and it is often a compliance requirement rather than a preference.
3. **What happens under concurrent issuance?** Both the T-30d `renewal.notice` job and a tenant-initiated path (`plan.change` payment, `subscription.renew`) can issue an invoice, and the job sweeps many subscriptions at once. Concurrency here is the normal case, not the edge case.

### The real tension, stated because it is the part that gets discovered late

**Gap-free numbering and optimistic-concurrency retry (ADR-045) pull in opposite directions.** Optimistic concurrency's contract is that a losing writer is rejected and retries. A gap-free number allocated before that rejection has two possible fates and no third: it is **burned** — producing exactly the gap the scheme exists to prevent — or it is **held under a lock for the transaction's duration**, which serialises invoice issuance and removes the concurrency the retry model assumes.

`PHASE_2_BRIEF.md` §5's append-only `REVOKE` on `invoices` matters here too: a mis-numbered invoice cannot be corrected in place by the application role at all, so the correction path is necessarily a new record, not an `UPDATE`.

**Neither this ADR nor ADR-045 may be ruled without the other in view.**

### Options

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. A PostgreSQL sequence**, platform-global. | Cheapest, and concurrent-safe by construction. **Gap-tolerant by design**: `nextval` is non-transactional, so a rolled-back transaction burns its number permanently. Leaks issuance volume across tenants if the number is tenant-visible. | Gap-freeness. Retrofitting it onto already-issued numbers is not possible. |
| **B. A per-tenant counter row locked `FOR UPDATE`.** | Gap-free and per-tenant. **Serialises issuance per tenant** for the transaction's duration; a slow invoice transaction blocks that tenant's next one; deadlock risk in the family R-008 already lives in. Needs a counter table `PHASE_2_BRIEF.md` §4's 27-table list does not contain — so choosing B amends that list. | Nothing structurally, at a throughput cost invisible at ADR-010's assumed V1 scale and not invisible later. |
| **C. A reserved-number table with explicit voiding.** A number is reserved, then either consumed by an issued invoice or recorded as voided with a reason. | Gap-free *in the audit sense* — every number is accounted for as issued or voided, which is typically what a tax authority asks — while allowing the allocating transaction to fail. Costs a second table and a reconciliation obligation. Also needs a table not in §4's list. | Nothing. It is the most operationally honest option and the most machinery. |
| **D. Composite human-readable number** (tenant prefix + period + per-period counter). | Orthogonal to A-C rather than an alternative: it still needs one of them underneath. Adds a formatting contract that becomes tenant-visible and therefore hard to change. | Nothing, provided the underlying allocator is decided first. |

### Recommendation

**Advisory only — the ruling is the maintainer's.** No option is recommended outright, because the deciding input is not in this repository: **whether gap-free numbering is a legal requirement in the platform's operating jurisdiction.** If it is, A is eliminated regardless of its engineering advantages and the real choice is B versus C. If it is not, A is clearly correct and the rest is over-engineering.

What can be said without that input: **decide it before item 13's migration**, and if B or C is chosen, add the required table to `PHASE_2_BRIEF.md` §4's list in the same ruling — that list describes itself as "the wall, not a suggestion", so a table appearing in a migration without appearing there is a scope breach even when an ADR authorises it.

### Ruling

**Ruled by the maintainer on 2026-09-02. This ADR made no recommendation** — it declined one on the stated ground that the deciding input, whether gap-free numbering is a legal requirement in the platform's operating jurisdiction, was not in this repository. That input was researched externally on 2026-09-02 and the ruling follows from it. The recommendation above is left as written, because its refusal to guess was correct at the time.

**1. Global, not per-tenant.** One sequence for the platform, not one series per subscriber.

The reason is not technical. **The issuer of these invoices is one legal entity — the platform** — and a seller keeps one invoice book. A per-tenant series would produce hundreds of parallel books for a single seller, which is wrong for the seller's own accounting and wrong for reconciliation against a bank or a tax filing. The objection recorded in Option A above — that a global number leaks issuance volume to a tenant who watches their own invoices — is accepted as a real cost and judged the smaller one. It is also mitigated by part 3: the number a tenant sees is a rendered form, and what that form exposes is an interface decision.

**2. Gap-free, allocated from a locked counter inside the issuing transaction.** A dedicated single-row counter is read `SELECT … FOR UPDATE` **inside the same transaction that inserts the invoice**, so a number is consumed only if that insert commits and a rolled-back transaction consumes nothing. This is Option B's mechanism with a global rather than a per-tenant counter.

**The volume assumption that makes this affordable, recorded explicitly because it is the thing that would change.** Gap-free numbering costs serialised issuance: while one invoice transaction holds the counter row, every other issuance waits. **The platform issues on the order of thousands of invoices per year — not thousands per minute** — driven by annual subscription renewals across a merchant count that ADR-010 assumes at ≤5,000 organizations. At that rate the counter row is contended approximately never, and the serialisation Option B was penalised for is not a real cost. **If issuance ever becomes high-frequency — per-order commerce invoicing in Phase 3, usage-metered billing, or a merchant count an order of magnitude larger — that assumption is what changed**, and this ruling is what must be revisited. It is not a revisit trigger on a metric nobody will measure; it is a statement of the condition under which the reasoning stops holding.

**3. Store the integer; render the display form.** The stored value is the sequence integer. A human-readable form such as `NX-1405-000123` is composed in the interface layer, never persisted as the identity.

This is ADR-022 item 4's own principle — *display is not storage*, "the presentation unit, its divisor and its symbol live in the currency configuration and are applied only in the interface layer" — applied to an identifier rather than to money. The consequence that earns it: **a later change to the rendered format is not a schema change, does not break the continuity of the underlying series, and does not require reconciling two numbering eras.** A stored composite string would make the format itself part of the append-only record.

**4. The Iranian tax unique number is a separate field and must never be conflated with this one.**

The شماره منحصر به فرد مالیاتی required by سامانه مودیان is a fixed 22-character identifier composed of a 6-character tax-memory-device id, a 5-character hexadecimal registration date, a **10-character hexadecimal serial scoped to that memory device**, and a Verhoeff check digit. It is generated by the taxpayer's own terminal at the moment the invoice is registered with the tax system — not when the invoice is created in this platform. **It is therefore a different value, on a different clock, with a different scope, and neither can substitute for the other.** An implementer who stores one in the other's column produces a record that is wrong for both purposes.

**Epistemic status of the preceding paragraph, stated in the house style ADR-041 established.** These facts were read from **vendor and integrator documentation on 2026-09-02, not from the Iranian Tax Administration's own published specification.** They are consistent across the sources consulted and they are **not verified against a primary source.** Nothing in parts 1-3 depends on them; they matter only to part 5, and part 5's ruling is the one that survives being wrong about the details.

**5. The tax number is deferred, with a named trigger, and no column is reserved for it now.** Nothing in Phase 2 registers an invoice with سامانه مودیان or with any tax authority. **Trigger: the slice that integrates with سامانه مودیان.** That slice adds the column, in its own migration, against a then-current reading of the primary specification rather than against this ADR's secondhand summary.

A nullable column reserved now and set by nothing is precisely the defect **ADR-046** was ruled to avoid — a permanent obligation on every reader of the table, enforced by nothing, for a capability no item delivers. The same argument that kept `deleted_at` out of twenty tables keeps this one out of `invoices`.

**Cross-reference ADR-044's ruling.** An invoice line must carry its own denormalized description text, captured at issuance, for the same reason an invoice carries its own number rather than a reference: an append-only financial record must be readable on its own years later, and must not change its wording when something it points at is renamed.

**One obligation this ruling creates that this ADR cannot discharge.** Part 2's counter is **a table**, and `PHASE_2_BRIEF.md` §4's 27-table list — which describes itself as "the wall, not a suggestion" — does not contain it. This ADR's own recommendation above anticipated exactly this ("if B or C is chosen, add the required table to `PHASE_2_BRIEF.md` §4's list in the same ruling"). **That list is `AGENTS.md` §1 authority #2 and amending it is a scope decision belonging to `PHASE_2_BRIEF.md`, not to an ADR.** The counter is platform-global — one invoice book for one legal entity — so its §5 entry will also owe a stated RLS-exemption reason alongside the existing exemptions for `billing_provider_configs` and `scheduled_job_runs`. **Owed before item 13's migration; recorded in `decisions/2026-09.md` and not discharged here.**

### Why this blocks any two-way accounting integration

An external accounting ledger keys on the invoice number. Once invoices carry numbers under one scheme, an integration built against them encodes that scheme — its uniqueness domain, its gap posture, its format. Changing the scheme afterwards means reconciling two numbering eras across a system this platform does not control. The business model's add-on matrix (`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §6) sells an accounting bridge as a product, which makes this a foreseeable consumer rather than a hypothetical one. **The integration itself is out of scope here and is not designed by this ADR** — only the fact that it cannot be built on an undecided numbering scheme.

### What this ADR does not do

- **It does not design an accounting integration**, choose a partner, or commit to an export format. It records only that invoice numbering is that integration's prerequisite.
- It does not decide the `invoices` response shape for `invoice.list`, beyond the observation that whatever number is chosen becomes part of it and therefore part of `openapi.json` (ADR-033).
- It does not rule on credit notes, voiding of *issued* invoices, or refund documents. `billing_refunds` exists in item 13 with no refund capability in Phase 2, and a voiding scheme under Option C would need to say how the two relate — that is inside the ruling's scope only if C is chosen.
- It does not touch ADR-022. Amount, currency and the `MoneyDto` contract are unchanged; a number is not money.
- It does not resolve ADR-045; it names the tension and requires the two be read together.

### Verification

- [ ] the ruling answers all three questions — scope, gap posture, concurrency behaviour — not only the first
- [ ] the ruling states whether gap-freeness was required for a legal reason or chosen for a product reason, so a later reader knows whether it is negotiable
- [ ] if B or C is ruled, the required table is added to `PHASE_2_BRIEF.md` §4's list in the same change
- [ ] item 13's creating migration implements the ruled scheme; no invoice is ever issued without a number
- [ ] a concurrency test issues invoices from the `renewal.notice` sweep and a tenant-initiated path simultaneously, and proves the ruled uniqueness and gap properties actually hold
- [ ] the interaction with ADR-045 is stated in whichever of the two is ruled second
- [ ] no scheme is chosen that requires `UPDATE` on `invoices`, which `PHASE_2_BRIEF.md` §5 forbids to `nexora_app`

---

## ADR-049 - MCP Readiness Posture for Phase 2

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-02, depends on ADR-001, ADR-001b, ADR-003, ADR-007 and ADR-030

### Why this is ACCEPTED rather than OPEN

There is nothing to choose. ADR-001, ADR-001b, ADR-003 and ADR-007 are already ACCEPTED and already assign MCP to Phase 9; this ADR neither adds a decision nor weakens one. It records a **constraint on Phase 2 that follows from decisions already taken**, and it exists because that constraint is currently implicit — spread across four ADRs about a phase nobody is building, in a form no Phase 2 implementer will encounter. `AGENTS.md` §2 states the governing thesis: "Rules expressed only as prose are not enforceable on a long task." This is an attempt to make one of them findable at the moment it can be violated.

### Problem

Phase 9 exposes this platform's capabilities over MCP. Four accepted ADRs already constrain that: capabilities must carry risk classification and approval requirement as **policy metadata** (ADR-001); HIGH_WRITE requires platform-controlled approval independent of any client (ADR-001, ADR-001b); MCP writes enforce idempotency through the shared platform store, keyed on `tenantId`, `userId`, `capability`, `idempotencyKey`, `requestHash` (ADR-003, ADR-009); and external MCP output is data, never instructions, and can never trigger a write without independently passing platform capability authorization (ADR-007).

**Every one of those presumes that a capability is a thing the platform can invoke without an HTTP request, described completely by its own definition.** Phase 2 adds eleven capability-surfacing items and fifteen capabilities — the largest single increase in the platform's capability surface — and does so seven phases before anything checks that presumption. A capability written so that only an HTTP request can invoke it is not a Phase 9 bug; it is a Phase 2 defect that becomes visible in Phase 9, by which point it has been copied fourteen times.

### Decision

**Phase 2 must not foreclose the MCP path.** Concretely, these three things would foreclose it, and each is prohibited in Phase 2:

1. **Authoritative business logic in a controller rather than an application service.** Already forbidden by `AGENTS.md` §4 and `03_TECHNICAL_BLUEPRINT.md`; **this ADR ties the prohibition to a reason** rather than leaving it as a style rule. An MCP invocation reaches the application service and never touches the controller, so any rule living in the controller is a rule MCP silently does not enforce — and ADR-007's guarantee that an external MCP write "must independently pass platform capability authorization" is only true if that authorization is somewhere MCP goes.

2. **A capability whose invocation cannot be expressed without an HTTP request.** The test is stateable and worth stating: *can this capability's inputs be constructed, and its policy chain run, from its `CapabilityDefinition` and a tenant context alone?* A capability that reads a header directly, depends on a cookie, derives identity from the transport, or returns something only meaningful as an HTTP response fails that test. This is not a hypothetical concern here: `CapabilityRoute`'s own `pathParams` field exists precisely to keep the HTTP shape declarative rather than known only to the controller.

3. **`CapabilityDefinition` ceasing to be the single source of truth for what a capability is, what it may raise, and what it requires.** ADR-033 already builds `openapi.json` from it; ADR-043 already guards its field set against `05` §5. MCP tool descriptors, approval metadata and idempotency hints would be generated from the same definition. A capability whose real requirements live somewhere else — in a controller, in a guard chosen by hand and recorded nowhere, in a comment — cannot be published to MCP correctly, and worse, can be published to MCP *incorrectly and plausibly*.

**None of this is new machinery.** Each of the three is a restatement, tied to its consequence, of something an accepted document already requires.

### What this ADR does not do

**It implements nothing and defers the mechanism to Phase 9** — the same shape ADR-043 used: it decides what is constrained and why, and does not build the check.

- **No MCP code, table, adapter, tool descriptor or handler is written in Phase 2.** `PHASE_2_BRIEF.md` §4's exclusion of MCP tables stands unchanged.
- **No field is added to `CapabilityDefinition` for MCP's benefit.** `PHASE_2_BRIEF.md` §5's rule — "a field is added in the same slice that adds its enforcement, never ahead of it" — and ADR-043's `deferred` list both stand. In particular `approval` stays deferred to Phase 9 exactly as ADR-043 records it, and **this ADR must not be read as a reason to add it early.**
- **No conformance rule is written here.** Whether points 1-3 can be checked mechanically, and how, is a question for a code-authorized session; today they are review-enforced, which is the honest status. ADR-043's own scope note is the precedent.
- It does not reopen ADR-001, ADR-001b, ADR-003 or ADR-007, and it does not move MCP earlier than Phase 9.
- It does not constrain the AI plane (ADR-004, ADR-004b) or plugins (ADR-005) beyond what those ADRs already say, though the same three points would apply to them for the same reason.

### Verification

- [ ] every Phase 2 capability's authoritative rules — permission, entitlement, quota, invariant, transaction boundary — live in its application service or domain, not in its controller, reviewed per slice
- [ ] every Phase 2 capability's inputs are constructible from its `CapabilityDefinition` and a tenant context, with no transport-only dependency
- [ ] no Phase 2 capability reads a header, cookie or request object outside the interface layer
- [ ] `CapabilityDefinition` remains the only source `tools/openapi/generate.ts` reads (ADR-033), and gains no MCP-specific field in Phase 2 (ADR-043's `deferred` list unchanged)
- [ ] no MCP table, module or handler exists at the Phase 2 gate
- [ ] at the Phase 2 gate, at least one capability is checked by hand against points 1-3 as a spot audit, and the result recorded

---

## ADR-050 - Financial Event Packet and External Delivery Path

**ACCEPTED (was OPEN)**, ruled by the maintainer on 2026-09-02, depends on ADR-022, ADR-024 and ADR-034; interacts with ADR-045 and R-025

### Why this was OPEN rather than ACCEPTED (recorded before the ruling; left as written)

Question 2 below is a genuine fork with a real cost either way, and it touches a rule — `PHASE_2_BRIEF.md` §5's blanket `REVOKE UPDATE, DELETE` on `outbox_events` — that an ADR should not quietly carve an exception out of. Questions 1 and 3 have defensible answers that are nonetheless unwritten, and settling them without ruling question 2 would produce a contract that cannot be implemented.

### Problem

**The repository nowhere defines the body shape of an `outbox_events` entry.** `01` §24 says events requiring reliable asynchronous delivery must use a transactional outbox and that domain writes and outbox writes share one transaction. `03` §3 lists `eventing/` as "envelope, outbox, dispatcher" — naming an envelope without defining one. `04` §2.6 lists the table and §8 lists its index. **ADR-024 item 9 already requires that `SubscriptionExpired` be emitted through the outbox**, making this a Phase 2 obligation with no defined payload. `05` §5 lists `emitsEvents?: string[]` on `CapabilityDefinition` as "new, outbox contract" — a field pointing at a contract that does not exist, currently on ADR-043's `deferred` list for exactly that reason.

An event body is a contract **every future consumer depends on and none can renegotiate**: an outbox event is consumed asynchronously, possibly by a system outside this codebase, and by then the emitting transaction is long committed. This is unlike an API response, where a client and a server can be versioned together.

### A contradiction inside the current documents, found while writing this ADR

`04` §8's index list contains:

```text
outbox_events (dispatched_at) where dispatched_at is null
```

A partial index on `dispatched_at IS NULL` describes a column that starts null and is **set** when the event is dispatched — an in-place `UPDATE`. But `PHASE_2_BRIEF.md` §5 places `outbox_events` on the append-only list and requires `REVOKE UPDATE, DELETE ON outbox_events FROM nexora_app` in its creating migration. **Under that revoke, the application role cannot set `dispatched_at` at all.** The two documents are individually reasonable and jointly unimplementable, and item 14's migration is where that becomes a schema commitment.

This is question 2, and it is not a documentation typo — it is the substantive design question of where delivery state lives, surfacing as an inconsistency.

### The three things to settle

**1. Packet shape.** An envelope with, at minimum: event type; a **version for the packet itself**; tenant id; `occurred_at` as UTC `timestamptz` (ADR-031 item 1); a correlation identifier tying the event to the capability attempt that produced it and therefore to its `audit_events` row (ADR-034); and the payload.

**The rule that must be written down explicitly, because it is the one most easily lost in a JSON payload: any monetary value in an event body is a `MoneyDto` — a string amount in minor units plus a currency — never a bare number** (ADR-022 items 1, 2, 7). An event body is JSON, and JSON is where ADR-022's prohibition is easiest to violate accidentally and hardest to catch: the existing `SCHEMA-FLOAT-MONEY-COLUMN` conformance rule inspects **columns**, and a float inside a `jsonb` payload is invisible to it.

**2. Where delivery state lives. Both shapes are presented; this ADR does not choose.**

| Shape | What it costs | What it forecloses |
|---|---|---|
| **A separate delivery-state table.** `outbox_events` stays strictly append-only; attempts, delivered-at, failure reason and next-retry live in a companion row that is freely updatable. | A second table not in `PHASE_2_BRIEF.md` §4's 27-table list — choosing this amends that list. A join, or a second query, on every dispatcher poll. `04` §8's `dispatched_at` index moves to the new table. | Nothing. It preserves the append-only rule intact — the rule Phase 1's `audit_events` repair exists to defend. |
| **A documented per-column exception to the REVOKE.** `outbox_events` keeps `dispatched_at` and an attempt counter; the creating migration revokes `DELETE` and grants `UPDATE` on those columns only (PostgreSQL supports column-level `UPDATE` grants). | The append-only guarantee becomes "append-only except here", stated per column, and every future reader of `PHASE_2_BRIEF.md` §5's list must know this table is different. **Whether a column-level `UPDATE` grant composes correctly with `FORCE ROW LEVEL SECURITY` and the existing RLS policy shape on a tenant-owned table is unverified in this repository** — recorded as owed empirical verification, per ADR-041's precedent, and not asserted either way. | Nothing structurally. It is cheaper, and it spends a rule that was expensive to establish. |

**3. The consumption rule.** Every external integration — accounting, webhooks, analytics — reads through this path only, **never directly from domain tables**. This is the rule that keeps `invoices`, `subscriptions` and the ledgers from acquiring undeclared external consumers who then constrain every future schema change. `01` §24 already names storefront cache invalidation and read-model projection as outbox consumers; this generalises it and states the prohibition explicitly.

### Recommendation

**Advisory only — the ruling is the maintainer's.** On question 1, the envelope as described, with the `MoneyDto` rule written as a normative sentence rather than left to a schema. **On question 2, no recommendation is offered** — the separate table is architecturally cleaner and the column-level grant is cheaper, and the choice turns on how much weight the maintainer puts on `PHASE_2_BRIEF.md` §5's list remaining exceptionless. On question 3, the prohibition as stated; it costs nothing today and is very expensive to introduce after the first integration exists.

### Ruling

**Ruled by the maintainer on 2026-09-02.** Questions 1 and 3 follow the recommendation above. **Question 2, on which this ADR deliberately offered no recommendation, is ruled for the separate delivery table.**

**1. Delivery state lives in a separate table, not in `outbox_events`. No column-level exception to `REVOKE UPDATE, DELETE` is granted.**

Three reasons, and the third is the one most easily misread:

- **`outbox_events` stays genuinely immutable**, which is the entire point of putting it on `PHASE_2_BRIEF.md` §5's list. A list with one exception is a list every future reader must check against, and the exception would be invisible at every call site.
- **Delivery attempts are naturally append-only in their own right** — one row per attempt, not a counter overwritten in place. So the shape that keeps the event ledger clean also produces a **retry audit trail for free**, instead of destroying the previous attempt's outcome each time a delivery fails. The cheaper option was also the one that loses information.
- **It removes the need to answer the interaction the previous session flagged as unverified** — whether a column-level `UPDATE` grant on a tenant-owned table composes correctly with `FORCE ROW LEVEL SECURITY` and the existing policy shape. **The ruling does not resolve that interaction. It makes it unnecessary.** Nothing here establishes what PostgreSQL does in that case, and no later ADR may cite this ruling as evidence that it was checked. If a future decision needs the answer, it is still owed, on ADR-041's standard: established empirically against PostgreSQL 17, not reasoned from documentation.

**2. The event packet carries a version from day one.** The envelope is:

```text
event_id
event_type
event_version
tenant_id
occurred_at        utc timestamptz, ADR-031 item 1
payload
correlation_id     ties the event to the capability attempt and its audit_events row, ADR-034
```

**Any monetary value inside `payload` is a `MoneyDto` — a string amount in minor units plus its currency — never a bare number** (ADR-022 items 1, 2, 7). This is restated as a normative sentence rather than left to a schema because the existing `SCHEMA-FLOAT-MONEY-COLUMN` conformance rule inspects **columns**, and a float inside a `jsonb` payload is invisible to it.

**`event_version` is the field that carries the ruling's weight, because it is the one that cannot be retrofitted.** Every other envelope field can be added later and defaulted for old rows. A version cannot: a consumer that has already parsed a stream of unversioned events cannot afterwards be told which shape it was reading, and neither can the events themselves. It costs one field now and is unrecoverable later. That asymmetry is the whole argument.

**3. Every external integration consumes through this path only** — accounting, webhooks, analytics — **never by reading a domain table directly.** This keeps `invoices`, `subscriptions` and the ledgers free of undeclared external consumers who would otherwise constrain every future schema change without ever being asked. `01` §24 already names storefront cache invalidation and read-model projection as outbox consumers; this generalises the pattern into a prohibition.

`webhook_endpoints` and `webhook_deliveries` remain with **no owning phase** (recorded above). They are the natural first consumer of this path, and **assigning them one is a `PHASE_2_BRIEF.md` scope decision, not this ADR's.**

**What this ruling does not decide.** **The delivery table's name and columns are item 14's design work.** This ADR decides only that delivery state does not live in `outbox_events` — not how many attempts are retained, not the retry schedule, not whether the table is tenant-owned (it will be, by `04` §7's default, but that is item 14's migration to state and to justify).

**One obligation this ruling creates that this ADR cannot discharge.** The delivery table is **a table**, and `PHASE_2_BRIEF.md` §4's 27-table list — "the wall, not a suggestion" — does not contain it. **Amending that list is a scope decision belonging to `PHASE_2_BRIEF.md`, which is `AGENTS.md` §1 authority #2, not to an ADR.** Owed before item 14's migration; recorded in `decisions/2026-09.md` and not discharged here. It is the same obligation ADR-048's ruling creates for its invoice-number counter, and the two should be taken together.

**Consequential correction to `04_DATABASE_BLUEPRINT.md` §8**, made under this ruling on 2026-09-02: the index `outbox_events (dispatched_at) where dispatched_at is null` presumed the in-place update this ruling forbids. It moves to the delivery table. See that section's dated correction.

### Two things recorded here because nothing else owns them

- **`webhook_endpoints` and `webhook_deliveries` exist in the documentation pack with no owning phase.** `04` §2.6 lists both; `PHASE_2_BRIEF.md` §4 excludes them explicitly on the ground that no Phase 2 item creates them. They are the natural first consumer of the path this ADR defines. **Assigning them a phase owner is a scope decision belonging to `PHASE_2_BRIEF.md`, not to this ADR**, and is deliberately left to a later scope review.
- **R-025 records that no object storage port exists and no phase item owns one** — the same class of gap, already tracked. This ADR does not widen into it.

### What this ADR does not do

- **It does not design a queue, a dispatcher, a worker or a retry policy.** `PHASE_1_DEBT_CLOSURE.md` D-2 (Redis/BullMQ) is PARTIALLY CLOSED and owns that; this ADR defines what is dispatched, not what dispatches it.
- **It does not enumerate Phase 2's events.** Only `SubscriptionExpired` is required by an accepted ADR (ADR-024 item 9). Which other events each capability emits is per-slice work, and adding `emitsEvents` to `CapabilityDefinition` remains governed by ADR-043's `deferred` list and `PHASE_2_BRIEF.md` §5's enforcement-first rule.
- **It does not design a webhook system** or assign `webhook_endpoints`/`webhook_deliveries` an owner (above).
- **It does not design an accounting integration.** ADR-048 records that invoice numbering is that integration's other prerequisite; neither ADR designs it.
- It does not add `version` to `outbox_events` for optimistic concurrency — ADR-045 excludes append-only tables, and if question 2 is answered with a separate delivery table, that table is where any such column would belong.
- **It does not alter ADR-034.** Audit events attest to an authorized attempt and are written *outside* the domain transaction; outbox events are written *inside* it. They are different mechanisms with different guarantees, and this ADR does not merge them.

### Verification

- [ ] the packet's envelope fields are named exhaustively, with types, before item 14's migration
- [ ] the ruling answers question 2 explicitly, and if the column-level-grant shape is chosen, its interaction with `FORCE ROW LEVEL SECURITY` is established empirically first — not assumed
- [ ] if the separate-table shape is chosen, that table is added to `PHASE_2_BRIEF.md` §4's list in the same change
- [ ] a test proves a monetary value in an event body is a `MoneyDto`, and that a zero-minor-unit currency round-trips through the packet unchanged (ADR-022's own verification standard, applied to events)
- [ ] `SubscriptionExpired` conforms to the ruled packet shape (ADR-024 item 9)
- [ ] no external integration in any later phase reads a domain table directly; each reads through this path
- [ ] `outbox_events` carries the append-only protection `PHASE_2_BRIEF.md` §5 requires, in whichever form question 2 rules
- [ ] `04` §8's `outbox_events (dispatched_at)` index is reconciled with the ruling rather than left contradicting it

---


---

## ADR-051 - Error Code for a Membership Revoked Mid-Flight

**ACCEPTED (was OPEN)**, ruled by the maintainer on 2026-09-03, depends on ADR-029 and ADR-033; owns **R-036**, and is the last live thread of **R-008** and the named producer for **R-037**

### Why this was OPEN rather than ACCEPTED (recorded before the ruling; left as written)

The evidence points one way, but the three options differ in what production code they oblige a later slice to write, and this session writes none. Ruling it is the maintainer's. What is *not* open is whether the question must be answered: **R-008 cannot close until it is**, and R-008 is the regression guard for R-007, a critical data-integrity race.

### Problem

**No document states which error code is correct when a membership is revoked while another request from that same session is already in flight.** `05` §7 lists thirty-seven codes and defines each one's meaning in isolation; it does not say which applies to this condition, and no ADR does either.

The condition is not hypothetical. It is what `apps/api/membership-revoke.integration.spec.ts`'s two-concurrent-owners test exercises, and it is the reason that test has failed in CI four times (`R-008`, root cause DETERMINED 2026-09-02).

**The guard chain, read from the source rather than inferred.** `membership.revoke` writes the target's membership status **and** revokes every session belonging to the target's user inside **one transaction** — `RevokeMembershipService.execute` lines 111-112, under the controller's single `withTenantContext` (`membership-revoke.controller.ts:93`). The losing request, meanwhile, makes its checks **sequentially and non-atomically**, each in its own database round trip:

| Where the winner's commit lands relative to the loser | What the loser throws | HTTP |
|---|---|---|
| Before `SessionGuard` reads `sessions` | `AUTHENTICATION_REQUIRED` — *"Session is missing, expired or revoked."* (`session.guard.ts:42`) | **401** |
| Between `SessionGuard` and `OrganizationAccessGuard` | `FORBIDDEN` — *"No active membership in this organization."* (`resolve-organization-access.service.ts:31`, reached from `organization-access.guard.ts:84`, which opens its **own** `withTenantContext`) | **403** |
| After both guards, inside the domain transaction | `CONFLICT` — *"This membership is already revoked."* (`revoke-membership.service.ts:96`, from `lockActiveForUpdate`'s post-lock re-read) | **409** |

**So the code a client receives is determined by where in this pipeline the winner's commit lands, while the underlying fact is identical in all three cases and is a single atomic event.** The public contract currently exposes the internal ordering of two guards and a service.

**A correction to how this question has been described, made here because it changes one option's cost.** The third outcome is `CONFLICT`, **not** `CONCURRENCY_CONFLICT`. The two share HTTP 409 and are deliberately distinct codes, and `05` §7 states the difference normatively: *"`CONCURRENCY_CONFLICT` is RETRYABLE — unlike `CONFLICT`, which means the request permanently conflicts with existing state until the client changes something ... resubmitting the identical request is the expected client behavior. A client must not treat the two the same way."* Any option that reaches for `CONCURRENCY_CONFLICT` here is not merely unconventional, it contradicts an accepted contract, because a mid-flight revocation is final and no retry can ever succeed.

### The one place this is currently decided, and it is the wrong place

`membership-revoke.integration.spec.ts:494` classifies the loser with `statuses.filter((s) => s === 409 || s === 401)`. That line accepts 401 and 409 and rejects 403 — which is a contract decision, taken in a spec file, by omission. **It is also why the test fails**: the 403 path is legal behaviour the classification does not admit.

Widening that filter to accept 403 would silently ratify Option A below. **R-036 exists to prevent exactly that**, and the filter must not move before this ADR is ruled.

### Options

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. Accept all three.** Document in `05` §7 that a mid-flight revocation may surface as `AUTHENTICATION_REQUIRED` (401), `FORBIDDEN` (403) or `CONFLICT` (409) depending on where the commit lands, and widen the test's accepted set to match. | The public contract permanently exposes internal pipeline ordering, and every client must handle three codes for one condition — including a 403 that means something different from every other 403 the platform returns. Cheapest by far: nothing changes but prose and one line of test. | Any later normalization becomes a **breaking** contract change, because clients will have been told all three are correct. |
| **B. Normalize to 401 `SESSION_INVALIDATED`.** The revoke invalidates the session atomically, so every later request from it is invalid whichever checkpoint notices first. | Real production code in a later slice: `SessionGuard` must distinguish *"no session presented"* from *"a session existed and was revoked"*, and `OrganizationAccessGuard` must distinguish *"membership revoked mid-flight"* from *"never a member of this organization"* — the second requires reading revoked memberships, which it does not do today. | Nothing. |
| **C. Normalize to a 409.** Treat it as what it structurally is — a request that raced a conflicting write. | The natural code, `CONCURRENCY_CONFLICT`, is **ruled out by `05` §7's own retryability clause** (above): it would tell clients to retry a state that is final. Using `CONFLICT` instead avoids that, but then a request refused *before authentication or authorization ever succeeded* returns a code reserved for domain-state conflicts, and the guards must reach domain knowledge they currently do not have — the same production work Option B costs, for a weaker result. | Nothing, but it spends B's implementation budget without B's clarity. |

### Recommendation

**Option B**, advisory — the ruling is the maintainer's.

1. **It is the only option whose answer does not depend on timing.** A and C both name a *consequence* of where the commit landed. B names the *fact*: the session was revoked. That is true before, between and after every checkpoint, so the code stops being a function of scheduling.
2. **It gives R-037's orphaned code its producer.** `SESSION_INVALIDATED` is declared in `05` §7, present in `CapabilityErrorCode`, mapped to 401 — and **thrown nowhere in the repository** (verified by grep across `modules/`, `apps/` and `platform/`: the only occurrences are the type and the status map). R-037 exists precisely because a code can look entirely valid in the contract and never fire. This is its natural and possibly only producer, so ruling B converts a documented-but-unreachable code into a used one and gives R-037 a path to closure.
3. **`AUTHENTICATION_REQUIRED` currently conflates two conditions a client cannot tell apart** — *no session presented* and *a session existed and was revoked*. The first is a client bug; the second is a legitimate mid-session event a client should surface differently. Separating them is worth doing on its own merits, independently of this race.

**The scope limit of B, stated precisely because it is easy to over-read.** A 401 `SESSION_INVALIDATED` is correct when the caller's **own session** was revoked. It is **not** correct for a caller who is still authenticated and has merely lost membership in one organization — that remains `FORBIDDEN`/403, and nothing here changes it. B applies to the two-concurrent-owners case because the loser's own session genuinely was revoked by the winner's transaction; it does not apply to an unrelated caller who was never a member.

### Ruling

**Option B. Ruled by the maintainer on 2026-09-03, following the recommendation above.** A membership revoked while a request from that same session is already in flight surfaces as **`SESSION_INVALIDATED` / 401**, whichever checkpoint notices it first.

**The scope limit, stated first because it is the part most easily over-read. Ruling B does not make `403` obsolete.** A `401 SESSION_INVALIDATED` is correct when **the caller's own session was revoked**. A caller who is still authenticated and has merely lost membership in this organization — or never had one — still receives **`FORBIDDEN` / 403**, and nothing here changes that. The two-concurrent-owners case falls under B because the winner's transaction revokes the loser's *own* sessions; a bystander who was never a member is untouched by this ruling.

**What this ruling does not decide.** The guard changes B implies are **production code in a later slice, and this ADR implements none of them**: `SessionGuard` must distinguish *"no session presented"* from *"a session existed and was revoked"*, and `OrganizationAccessGuard` must distinguish *"membership revoked mid-flight"* from *"never a member"*. Whether that distinction is even available at guard time — how long a revoked session stays distinguishable from one that never existed — is **ADR-029**'s territory, and the fence in `### What this ADR does not do` below stands unchanged. An implementer confirms it against `sessions` before building B rather than assuming it.

**Option C's disqualification, and a note on how it is framed above.** The third code the pipeline actually throws is **`CONFLICT`** (`revoke-membership.service.ts:96`, *"This membership is already revoked."*), **not `CONCURRENCY_CONFLICT`**. `05` §7 rules on the difference normatively — `CONCURRENCY_CONFLICT` is RETRYABLE, `CONFLICT` is permanent, and *"a client must not treat the two the same way"* — so normalizing this condition onto `CONCURRENCY_CONFLICT` would **contradict an accepted contract** rather than merely be unconventional, because a mid-flight revocation is final and no retry can ever succeed. **No correction to the body above was required:** it was drafted with this already established — the `### Problem` section carries it as an explicit correction, and Option C is stated as *"normalize to a 409"* with `CONCURRENCY_CONFLICT` named as ruled out and `CONFLICT` costed as the weaker fallback. This paragraph records that the check was made, not that a defect was found.

**What this ruling closes and what it does not.** It closes **R-036**'s contract question: a document now states which code is correct. It closes neither **R-008** nor **R-037**. R-008 closes when this ruling's behaviour is proven by a test at the interface-contract layer (`AGENTS.md` §8) — the ruling alone is a decision, not an implementation, and the live code still returns 401, 403 or 409 depending on where the winner's commit lands. R-037 is narrowed, not closed: `SESSION_INVALIDATED` now has a named producer, but nothing yet throws it, and R-037's structural finding — that no check verifies the *documented → declared/thrown* direction — is untouched.

**`membership-revoke.integration.spec.ts`'s status-code filter still must not be widened ahead of the implementation.** Widening it now would make the test pass against behaviour this ruling declares wrong, which is the same defect in the opposite direction from the one R-036 was opened to prevent.

### What this ADR does not do

- **It implements nothing.** The guard changes Option B implies are production code, owed by a later slice, and no session may write them before this is ruled.
- **It does not widen `membership-revoke.integration.spec.ts`'s accepted status codes.** Doing so before the ruling decides the contract in a spec file, which is the trap R-036 was opened to keep open.
- **It does not close R-008.** It names the path: R-008's root cause is determined and its only remaining thread is this contract question. R-008 closes when this is ruled and the resulting behaviour is proven by a test.
- **It does not close R-037.** R-037 is broader — it records that nothing in this repository checks the *documented → declared/thrown* direction, so other codes could sit unreachable the same way. Ruling B fixes this one instance and leaves R-037's structural gap intact.
- **It does not touch ADR-029's session model.** Whether a revoked session is deleted or tombstoned, and for how long a "was revoked" answer remains distinguishable from "never existed", is ADR-029's territory. **Option B depends on that distinction being available at guard time**, and an implementer must confirm it against `sessions` before building B rather than assuming it.

### Verification

- [ ] the ruling is recorded in a `### Ruling` section naming the maintainer and the date, with the options and this recommendation left intact
- [ ] `05` §7 states which code a mid-flight revocation returns, in whichever direction is ruled
- [ ] a test at the interface-contract layer asserts that code for the concurrent case — `AGENTS.md` §8, "HTTP contract, error codes → interface contract test"
- [ ] `membership-revoke.integration.spec.ts`'s classification is updated to match the ruling **and not before it**
- [ ] if B is ruled: `SESSION_INVALIDATED` is thrown somewhere, and `ERROR-CODE-UNDECLARED` proves the capability declaring it
- [ ] R-036 is closed by the ruling; R-008 is closed by the ruling plus its proving test


---

## ADR-052 - Self-Serve Trial: Eligibility, Entry Point and Duration

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-03, depends on ADR-024 and ADR-021; closes the contract half of **R-040**

### Problem

`TRIALING` has been a legal subscription state since ADR-024 and **nothing can enter it.** Verified against the accepted documents rather than assumed:

- **`TRIALING` is a legal state** and `TRIALING → ACTIVE | EXPIRED | CANCELED` are its only legal transitions (ADR-024 item 3).
- **`TRIALING` is a SERVING state** (ADR-024 item 2) — a trialling tenant's storefront is served.
- **`trial.expire` is already a required scheduled job** — *"terminate trials that were never converted"* (ADR-024 item 8).
- **An unconverted trial goes to `EXPIRED`, never into grace.** `PHASE_2_BRIEF.md` §5's lifecycle crosswalk states it directly: grace is entered only from `PAST_DUE`.

So the exit is fully specified and the entrance does not exist. `05` §4.2's fifteen capabilities contain no trial-start, and no document says whether a trial is a capability, an operator action, or a property of `plan.subscribe`. That is **R-040**.

**Why this is blocking rather than merely untidy.** The maintainer ruled the trial **self-serve** — anyone who signs up gets it, with no operator action. Self-serve means eligibility and duration are **data on the plan version**, which means a column in the migration that **Phase 2 item 1 and item 2** create. Migrations are forward-only (ADR-021 item 8), so deciding this after those migrations merge turns a column definition into a data migration. It has to be settled first.

The commercial model this serves is `D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §2, whose acquisition offer is a **7-day free trial**.

### Decision

Ruled by the maintainer on 2026-09-03. Four questions, four answers.

**1. Trial eligibility and duration live on the plan version, not on the subscription.**

A trial is a property of *what is offered*, not of *who took it*. Putting it on the immutable plan version means a later change to the offer cannot retroactively alter a trial already running — the same reasoning ADR-024 item 1 applies to `plan_version_id`/`price_version_id` pinning, and the same reasoning ADR-047 applies to renewal re-pinning. **The default trial length is 7 days**, matching the commercial model. A plan version offering no trial is expressible and is not a special case.

**2. `plan.subscribe` starts the trial. No new capability, and no payment required.**

A trial **is** a subscription, in `TRIALING`, and ADR-024's state machine already models its whole life — entry, serving, expiry, conversion. A separate `trial.start` capability would be **a second mechanism for one thing**: two entry points into one aggregate, two permission rows, two audit shapes, two idempotency claims, and two places for the state machine to be got wrong. `AGENTS.md` §4's prohibition on module-specific mechanisms is the general form of the same objection.

`plan.subscribe` therefore has two outcomes depending on the plan version it is given: a trialling subscription when that version offers a trial and the organization is still eligible, an `ACTIVE` one when it does not. Both are the same capability, the same transaction, the same audit event.

**3. One trial per organization, enforced by a database constraint.**

Not by application logic. A uniqueness rule that lives only in a service is a rule that a second caller, a retry, or a future second code path can violate — the same argument ADR-009 makes for idempotency and `PHASE_2_BRIEF.md` §5 makes for append-only ledgers: *a comment asserting a property is not that property*. The constraint's exact shape is item 4's design work; that it is a constraint and not an `if` is decided here.

**4. No payment method is required up front.**

Requiring one converts a zero-friction acquisition offer into a paid signup with a delay, which is a different product from the one the commercial model sells. This is the whole point of the offer, and it is recorded as a deliberate ruling so that a later session cannot add a card-capture step as an "obvious" anti-abuse measure without reopening this ADR.

### The abuse surface, accepted rather than closed

**One trial per organization does not stop a determined abuser from creating a second organization**, and this ADR does not pretend otherwise. Nothing in Phase 2 prevents an operator from creating organizations freely; that is what makes the platform self-serve at all.

This is true of essentially every self-serve trial in the industry, and **the mitigation for it is detection, not prevention** — prevention costs the acquisition funnel far more than the abuse costs the platform, at any volume this platform is designed for (ADR-010 assumes ≤5,000 organizations).

**It is therefore ACCEPTED, in the register's own sense of that word: retained by an evaluated decision, not deferred and not overlooked. Named reopening trigger: evidence of real repeat-signup abuse** — not a suspicion, not a theoretical model, but observed duplicate-trial signups at a rate someone has measured.

**No fraud-scoring mechanism is designed here, deliberately.** That is Pillar 4 territory, it belongs to no current phase, and inventing it inside a trial ADR would create exactly the speculative abstraction `AGENTS.md` §4's `future/` prohibition exists to prevent.

### What this ADR does not do

- **It does not build the capability.** `plan.subscribe` is Phase 2 item 4's work, and this ADR writes none of it.
- **It does not write the migration**, and does not name the columns. That eligibility and duration live on the plan version is decided; their names, types and nullability are items 1 and 2's design work.
- **It does not design abuse detection**, and explicitly declines to.
- **It does not touch ADR-024's state machine**, which already models everything a trial needs: the state, its three legal exits, its SERVING status, and the job that expires it. Nothing in ADR-024 is amended, extended or reinterpreted here — this ADR supplies the one thing ADR-024 left out, which is the way in.
- **It does not decide what a trial grants.** Whether a trialling tenant gets the full plan version's entitlements or a reduced set is an entitlement question owned by ADR-008's precedence chain and Phase 2 item 6, not by this ADR. **This is a real open edge and is named rather than assumed** — an implementer of item 6 who finds no answer here should read this sentence as confirmation that none was given, not as permission to invent one silently.
- **It does not create a trial for an existing paying subscriber.** Conversion runs one way; `ACTIVE → TRIALING` is not a legal transition in ADR-024 item 3 and this ADR does not add one.

### Verification

- [ ] a plan version can express "offers a 7-day trial" and "offers no trial", and the second is not a special case in any query
- [ ] `plan.subscribe` against a trial-offering plan version produces a subscription in `TRIALING` with no payment
- [ ] a second trial for the same organization is refused **by the database**, proven by a test that bypasses the application service
- [ ] a trial that is never converted reaches `EXPIRED` and not `PAST_DUE`, driven by `trial.expire`
- [ ] a trialling tenant is SERVING, proven through ADR-024 item 2's one serving-state function and not by a second predicate
- [ ] changing a plan's trial length publishes a new plan version and leaves running trials untouched

---

## ADR-053 - Session Retention and Purge

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-03, depends on ADR-020 and ADR-029; distinct from ADR-041; closes the decision half of **R-039**

### Problem

`sessions` has grown since Phase 1 with **no retention policy, no purge job, and nothing that ever deletes a row** — verified, not assumed: a repository-wide search for a delete against `sessions` returns nothing. Every login appends a row; revocation and expiry only flip `status` or let `expires_at` pass. The table is unbounded by construction.

`RISK_REGISTER.md` **R-039** records the gap and four sub-questions nobody had answered. This ADR answers all four.

**Two facts that shape the answer, both verified before writing.**

- **`sessions` has no `tenant_id` and no RLS, and that is structural rather than an oversight.** Its creating migration says so in its own first line: *"sessions is exempt from tenant_id/RLS for the same reason users is: it is owned by the identity module's User aggregate, not by a tenant, and RLS here would be circular — validating a session is the step that establishes which tenant is trusted in the first place."* **The consequence for this ADR: a purge job runs outside tenant context and cannot use RLS to scope itself.** Every other purge-shaped operation this platform will write is scoped by a tenant predicate the database enforces; this one is not, and it must be written knowing that.
- **`sessions` is not in ADR-041's scope, and must not be folded into it.** ADR-041 owns `audit_events` plus the four Phase 2 ledger tables (`usage_ledger_entries`, `billing_payment_events`, `subscription_state_transitions`, `invoice_lines`), and its whole premise is that **ADR-020 rule 4 excludes those rows from purge** — they can only ever grow, so its options are partitioning and archival, never deletion. `sessions` is the opposite case: ordinary operational state that nothing requires be retained. Merging the two questions would import a constraint that does not apply and rule out the only sensible answer.

### Decision

Ruled by the maintainer on 2026-09-03. Four questions, four answers.

**1. A session row is kept for 30 days past the moment it stops being usable.**

"Stops being usable" is whichever comes first of `expires_at` passing and `status` becoming `REVOKED` (`revoked_at`). Thirty days is long enough for an incident to be investigated after the fact — a compromised-account review needs the session history around the event, not just the live rows — and short enough to bound growth at a fixed multiple of login volume rather than letting it accumulate forever.

**2. Revoked and expired sessions purge on one clock, not two.**

Two clocks would be two policies to keep correct, two windows to reason about in an incident, and two ways for a future edit to change one and not the other — for no benefit anyone could state. A revoked session and an expired one are equally unusable and equally interesting to an investigation.

**3. The purge is audited at the level of the job run, not the deleted row.**

One audit row per deleted session would make `audit_events` grow **faster** than the table being purged, which is the exact opposite of the point. It would also do it in the one table that is hardest to undo: `audit_events` is append-only in its creating migration (`REVOKE UPDATE, DELETE ON audit_events FROM nexora_app`), and ADR-020 rule 4 excludes financial and legal append-only records from purge while rule 5 puts deletion-recording audit events permanently beyond it — so a bad decision there is not reversible by a later cleanup.

**What is recorded instead is the job's run** — when it ran, what window it covered, how many rows it removed, and its outcome — which is what `scheduled_job_runs` already exists to hold. That is enough to answer *"was the purge running, and over what period"*, which is the question an incident actually asks. **This is a deliberate trade and the thing it gives up is real:** after the window, there is no per-session record that a specific session ever existed. Anyone who later needs that must change this ADR, not work around it.

**4. It runs on the scheduled-job mechanism Phase 2 item 12 creates — and no Phase 2 item currently schedules it.**

`scheduled_job_runs` is Phase 2 item 12's table (`PHASE_2_BRIEF.md` §4), and the job must be idempotent and safe to run repeatedly, the standard ADR-024 item 8 sets for every scheduled job. **But item 12's own scope is payment intent, verify and reconciliation, and ADR-024 item 8's job list contains no session purge.** Stated plainly rather than left to be discovered: **`session.purge` is owed to Phase 2 item 12 and is not in its current scope.** Adding it there is a scope decision belonging to `PHASE_2_BRIEF.md`, not to this ADR — the same fence ADR-048 and ADR-050 observed for the two tables they each required.

### What this ADR does not do

- **It does not write the job**, does not name its columns, and does not choose its schedule frequency. Idempotent and repeatable is required; hourly versus daily is item 12's call.
- **It does not amend `PHASE_2_BRIEF.md`.** It records that `session.purge` is owed there, and stops.
- **It does not touch ADR-041**, whose scope is ledger and audit growth and which stays `OPEN` and untouched. This ADR deliberately does not set a precedent for those tables: the reason deletion is available here is precisely the reason it is unavailable there.
- **It does not touch ADR-029's session model** — not the token hashing, not the revocation semantics, not `active_organization_id`. It adds a retention window to rows ADR-029 already defines.
- **It does not decide retention for `users`, `credentials`, or `audit_events`.** `sessions` is the table R-039 named and the only one ruled here. `users` and `credentials` share `sessions`' RLS exemption but not its growth shape, and neither has been assessed.
- **It does not claim the 30 days is derived from a legal requirement.** It is an operational judgement about incident investigation, made in the absence of a stated compliance obligation. **If one is ever identified, it governs and this number changes** — recorded as an assumption rather than presented as a finding, per ADR-041's precedent.

### Verification

- [ ] a session unusable for more than the window is removed; one unusable for less is not
- [ ] revoked and expired sessions are removed by the same job on the same window, proven with one test covering both
- [ ] the job is idempotent — running it twice produces identical state (ADR-024 item 8)
- [ ] the job writes one `scheduled_job_runs` row per run and no `audit_events` row per deleted session
- [ ] the job's scoping is proven correct without relying on RLS, because `sessions` has none
- [ ] a purge never removes a session that is still usable, proven by a test that would fail on an off-by-one in the window


---

## ADR-054 - Per-Tenant Recovery from Nightly Snapshots

**ACCEPTED (new)**, ruled by the maintainer on 2026-09-03, depends on ADR-020, ADR-021 and ADR-034; interacts with ADR-041 and ADR-053; owns the **restore** half of **R-038**

### Problem

**The only recovery mechanism this platform has operates on the whole cluster.** PostgreSQL physical point-in-time recovery restores a cluster, not a row set — so recovering one tenant by that route rolls **every other tenant** back to the same instant. For a platform whose entire isolation model is per-tenant, the recovery story is the one place tenancy does not exist.

`RISK_REGISTER.md` **R-038** records this. **ADR-020 rule 6 requires a tenant data *export* capability and says nothing about restoring one** — export is a tenant reading their own data out, which is a different operation with a different consumer from an operator putting a broken tenant back. Phase 2.5 was given the export half on 2026-09-03; the restore half belonged to no phase and had no decision behind it.

The concrete requirement, in the maintainer's terms, is *"store #357 broke, put it back"* — and nothing in this repository could do it.

### The ruling

Ruled by the maintainer on 2026-09-03. **Recovery granularity is the last nightly snapshot: up to 24 hours of a tenant's data may be lost in a recovery, and arbitrary point-in-time recovery for a single tenant is explicitly not what is being built.**

**That granularity ruling is the entire reason this ADR is cheap, and the reason belongs in the record rather than in someone's memory.** Arbitrary per-tenant point-in-time recovery would have required all three of: **continuous WAL archiving** (retained, monitored, and itself a thing that can silently stop working); **a standby restore target** kept warm enough to replay into; and **a full-cluster restore per incident**, from which one tenant's rows are then extracted — meaning recovery time scales with the whole cluster even when one tenant is affected. A nightly per-tenant logical snapshot requires **none of those**. The cost difference is not marginal; it is the difference between a scheduled job and an operational discipline.

**1. Mechanism: a nightly per-tenant logical snapshot.** One snapshot per tenant per day, written by a scheduled job. Recovery restores a **named tenant** from a **named snapshot**.

**2. RPO is 24 hours, and it is a decision rather than an assumption.** Up to a full day of that tenant's data may be lost in a recovery. **Stated plainly because it is the number a tenant has to be told** — and ADR-020 rule 7 already requires that the retention window be documented to the tenant, so this is an existing obligation acquiring a number rather than a new one.

**3. RTO is owed a measurement and is deliberately not stated here.** ADR-010's numeric targets are already flagged, by dated amendment, as unverified assumptions until `06` Phase 4 item 9 — inventing a recovery-time number here would repeat that mistake in a new place, and a recovery target nobody has measured is worse than none because it will be quoted. **What can be stated is the shape: restore time scales with one tenant's data volume, not with the cluster's.** That is the property the nightly-snapshot design buys, and it is why a number is worth measuring at all. **The number is owed to the first drill** (part 6).

**4. The snapshot mechanism and ADR-020 rule 6's export capability are one mechanism, not two.** A nightly snapshot and a tenant's own data export are **the same operation on different schedules with different consumers** — one runs unattended and writes where an operator can reach it, the other runs on a tenant's request under their own quota. **Build one, not two.** Stated explicitly rather than left to be noticed, because two mechanisms for one thing is exactly what `AGENTS.md` §4 forbids, and the idempotency rule already had to prevent this same drift once (`PHASE_2_BRIEF.md` §5: *"No module invents its own"*). Two independently-written extractors would drift in exactly the way that matters most — one of them would quietly stop covering a table the other covered.

**5. Restore is asymmetric across table families. This is a property of the design, not a limitation to apologise for.**

- **Mutable tenant-owned rows are restored** — replaced from the snapshot.
- **Ledger-shaped tables are never rewound.** Verified against `PHASE_2_BRIEF.md` §5's list and Phase 1's own migration rather than recited: `subscription_periods`, `subscription_state_transitions`, `usage_ledger_entries`, `billing_payment_events`, `invoices`, `invoice_lines`, `outbox_events` (§5), plus `audit_events` (`20260822100100_audit__enforce_append_only.sql`). Each carries `REVOKE UPDATE, DELETE … FROM nexora_app`. **An invoice issued after the snapshot point stays issued.** If it must be undone, that is a **compensating entry** — which is what a financial record demands anyway, independently of this ADR. Rewinding a ledger would be the defect, not the feature.
- **Therefore restore runs outside the application, under a role the application does not have.** The application role *cannot* delete a ledger row, by design, so restore is not something the running system can perform on itself. **It is an operator action with its own audit trail (ADR-034), never a tenant-facing capability** — which changes who may run it, how it is authorised, and what must be recorded when it happens.

**6. A snapshot that has never been restored is not a backup.** A **periodic automated drill** restores a tenant into a sandbox and **verifies the result**, not merely that the restore command exited zero. This is the part of every backup design that is quietly dropped first and discovered missing at the worst possible moment, so it carries its own verification checkbox below rather than a sentence of prose here.

### Retention

**Snapshots are kept 30 days, matching ADR-020 rule 3's reversible-deletion waiting period — and the alignment is the reason, not a coincidence.** One retention number for the platform is one number to reason about, to document to a tenant, and to change; two numbers drift apart and nobody notices until a restore is attempted just outside one of them.

**One precision worth keeping:** ADR-020 rule 3 says *"The waiting period **default** is 30 days"* — a default, not a constant. **If that default is ever changed, snapshot retention follows it**, because the alignment is the decision and 30 is only its current value.

### What this ADR does not do

- **It does not provide arbitrary point-in-time recovery.** Ruled out on cost by the maintainer on 2026-09-03. What it would have required is named in the ruling above — WAL archiving, a standby restore target, and full-cluster restore per incident — so that a later reader can price reopening it rather than re-deriving why it was declined.
- **It does not address total cluster or server loss, and no phase owns that.** This is a **different risk with a different mechanism** — physical backup plus off-site replication — and per-tenant logical snapshots do not substitute for it, because snapshots stored on infrastructure that is itself lost are not a recovery path. **A reader must not close this ADR believing disaster recovery is solved.** It is not covered here and it is not covered anywhere. **Recommendation, not an action taken:** record it as its own risk row. This ADR recommends and deliberately does not open one, because the scope of a new row is the maintainer's to set.
- **It does not choose a storage backend, a snapshot format, a scheduler, or a compression scheme.** Those are Phase 2.5's design work.
- **It does not decide what a restore does to a tenant's *sessions*.** ADR-053 gives sessions a 30-day retention and `sessions` has no `tenant_id` at all, so it is not tenant-partitionable the way the snapshot mechanism assumes. Whether a restored tenant's users are logged out is a real question this ADR does not answer and does not assume — named here so an implementer reads this sentence as confirmation that no answer was given.
- **It builds nothing.**

### The prerequisite that has no owner

**Snapshots have to be stored somewhere, and this platform has no object storage.** `PHASE_2_BRIEF.md` §4's exclusion list puts `files` out of Phase 2 with *"object storage, no phase owns it yet."* The gap is already tracked as **R-025**, which confirms it directly: no port exists (`platform/` contains only `clock.ts`, `config.ts`, `db/`, `http/`, `rate-limit/`), and no phase list delivers one. ADR-041 cites the same gap when it considers archival to cold storage, and ADR-050 declines to widen into it.

**Nightly per-tenant snapshots cannot exist without somewhere to put them.** This is therefore recorded as a **named prerequisite of Phase 2.5**, not as an assumption buried inside the mechanism: if it is not resolved, this ADR's mechanism has nowhere to write, and the phase cannot deliver parts 1, 2 or 6 at all.

**A consequence for R-025 that this ADR causes and must not leave unsaid:** R-025 is currently rated *"Low near-term — two full phases away from current work"* and *"Low today, Medium by Phase 3."* **This ADR makes object storage a prerequisite of the very next phase**, so that rating is superseded by this ADR's existence rather than by anything that changed in R-025 itself. R-025 carries a dated addendum recording it.

### Verification

- [ ] a restore of one tenant leaves every other tenant's data **bit-identical**, proven by a test against real PostgreSQL — asserted nowhere, measured here
- [ ] a restore does not delete or alter any row in a ledger-shaped table, proven against all eight named in the ruling
- [ ] the restore operation is audited with the operator identified (ADR-034), and is not reachable through any tenant-facing capability
- [ ] a drill runs on a schedule and **its result is recorded, not merely its execution** — a drill that reports "ran" without reporting "verified" is the failure mode this checkbox exists for
- [ ] the 24-hour RPO is documented in tenant-facing terms (ADR-020 rule 7)
- [ ] a **measured** RTO replaces this ADR's deliberate absence of one, after the first drill
- [ ] snapshot retention tracks ADR-020 rule 3's waiting period rather than a hard-coded 30

## 3. Open Items Deliberately Left Open

None block V1. Each is listed with the phase that must reopen it, in section 1.2. Anything not listed there and not ACCEPTED above is not a decision, it is a gap, and it belongs in `07_ARCHITECTURE_GAP_REPORT.md`.
