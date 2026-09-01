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

## 3. Open Items Deliberately Left Open

None block V1. Each is listed with the phase that must reopen it, in section 1.2. Anything not listed there and not ACCEPTED above is not a decision, it is a gap, and it belongs in `07_ARCHITECTURE_GAP_REPORT.md`.
