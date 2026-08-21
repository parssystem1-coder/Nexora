# SaaS Platform Architecture Baseline

**Version:** 3.1
**Status:** Architecture Baseline, Implementation Contract
**Project Type:** Greenfield Multi-Tenant SaaS Platform
**Primary Product:** Commerce and Store Builder
**Architecture Style:** Modular Monolith, Domain-Driven, API-First, Capability-Oriented
**Primary Backend:** NestJS and TypeScript
**Frontend:** Next.js, React, TypeScript
**Database:** PostgreSQL, accessed per ADR-021
**Cache and Jobs:** Redis and BullMQ
**AI Plane:** Isolated AI application boundary, Python extraction when justified
**Storage:** S3-compatible object storage
**Deployment:** Docker, reverse proxy, CI and CD

---

## 1. Purpose

This is the source-of-truth architecture document. The ADR Index is the source-of-truth decision document. Where they conflict, the ADR Index wins.

Version 3.1 keeps all of 3.0 and adds the shape required by the decisions accepted in ADR Index 2.0: data access and RLS session handling, money, payment ports, subscription lifecycle, domains and TLS, storefront read separation, and mechanical conformance.

---

## 2. Mission

This project is not merely an e-commerce application. It is a greenfield multi-tenant SaaS platform whose first commercial domain is Commerce and Store Builder.

Commerce is the first production domain implemented on top of Platform Core. The architecture must allow future domains and strategic modules to be added without redesigning SaaS Core.

Future domains and platform surfaces may include CRM, SEO, Marketing, Analytics, Accounting, Booking, Support, Automation, AI, Agent Platform, Plugin Marketplace, Public API Platform, MCP Platform, Channels and Financial Services.

The architecture therefore prioritizes strong boundaries, tenant isolation, extensibility, contract stability, security, testability, observability, versioning and service extraction readiness.

---

## 3. Non-Negotiable Architectural Principle

```text
PLATFORM CORE -> DOMAINS -> APPLICATION SERVICES -> CAPABILITIES -> INTERFACES
```

Capability is not a business-logic layer. Capability is a stable operation contract that is authorization-aware, entitlement-aware, quota-aware, rate-limit-aware, auditable, idempotency-aware where required, and consumable through multiple interfaces.

Business logic remains inside Application and Domain.

---

## 4. Delivery Principle

1. **V1 Mandatory.** Must be implemented for the first production release.
2. **V1 Contract-Ready.** Must preserve boundary and contract in V1, but may use a reduced implementation.
3. **Deferred Expansion.** Must not distort V1 architecture, and should not be built before product or scale justifies it. Held in `future/`.

This is the rule that keeps all important futures without building fantasy infrastructure up front.

---

## 5. Final System Shape

```text
SAAS PLATFORM
  PLATFORM CORE
    Identity, Organization/Tenant, Membership, Authorization,
    Billing, Subscription, Entitlement, Usage, Audit, Security,
    Files, Notifications, Approval Service, Idempotency Service,
    Money, Domains, Scheduling
  DOMAINS
    Commerce, CRM, SEO, Marketing, Analytics, Channels,
    Financial Services, other future domains
  APPLICATION SERVICES
  CAPABILITY PLATFORM
  INTERFACES
    REST, Admin UI, Storefront UI, AI, MCP, Automation, Plugins
  INFRASTRUCTURE
    PostgreSQL, Redis, Object Storage, Workers, CDN/DNS/TLS providers,
    Payment providers, Notification providers
```

This is the target architecture. It is not the same thing as day-one implementation scope.

---

## 6. V1 Scope Boundary

### 6.1 V1 Mandatory

**Platform Core:** Identity, Organization/Tenant, Membership, Roles and Permissions, Authorization, Authentication and sessions (ADR-029), Subscription with terms and renewal (ADR-024), Plan change (ADR-025), Entitlement baseline, Quota baseline, Over-limit policy (ADR-026), Usage ledger foundation, Billing abstraction, Money (ADR-022), Payment provider port (ADR-023), Audit, Security foundation, Files, Notification abstraction, Approval service foundation, shared Idempotency service, Scheduling for lifecycle jobs.

**Commerce:** Store, Store settings, Catalog, Product, Variant, Category, Brand baseline, Attribute baseline, Inventory baseline, Customer, Cart, Checkout, Order, Coupon baseline, Shipping baseline, Tax baseline, Storefront baseline with read-path separation, Domain management with verification and TLS lifecycle (ADR-027, ADR-028).

**Technical Platform:** REST API, Admin UI, Storefront UI, background jobs, transaction boundaries, transactional outbox, event foundation, webhooks baseline, PostgreSQL FTS search, object storage, observability, automated backup baseline, storefront read model and cache invalidation, **architecture conformance harness in CI (ADR-030)**.

### 6.2 V1 Contract-Ready

Code-first capability registry, AI gateway abstraction, AI tool registry abstraction, plugin SDK boundary, automation boundary, MCP gateway boundary, AI credit ledger model, plan versioning, pricing versioning, approval workflow model, explainable AI output contract, multi-factor authentication, external identity providers, email sending domains.

### 6.3 Deferred Expansion

Full CRM, full SEO, marketing domain, analytics domain, external marketplace plugins, sandboxed plugin runtime, external MCP ecosystem exposure, RAG pipeline, advanced model router, dedicated Python AI service, OpenSearch, advanced automation builder, multi-warehouse inventory, embedded financial services, wildcard certificates for tenant-owned domains, multi-currency conversion, dedicated-tenant infrastructure, multi-region.

---

## 7. Architectural Style

The initial architecture must be a modular monolith. Do not start with microservices.

All modules may initially deploy as one application, but module boundaries must be real: separate module ownership, explicit contracts, no repository sharing across modules, no duplicate business logic across interfaces, no transport-coupled domain logic. These are enforced mechanically per ADR-030, not by convention.

Future extraction must be possible for AI workloads, search, analytics, heavy workers, plugin runtime, and financial services if compliance requires it.

The Domain and Application contracts must not depend on the deployment model.

---

## 8. Core Layers

```text
Interfaces -> Application -> Domain -> Infrastructure
```

Dependency direction: Presentation -> Interfaces -> Application -> Domain. Infrastructure implements interfaces required by inner layers.

**Interfaces** own HTTP and REST, admin adapters, storefront adapters, AI tool handlers, MCP handlers, webhook entrypoints, and all presentation-level formatting including currency display and calendar rendering.

**Application** owns use cases, transaction boundaries, orchestration, policy checks, idempotency enforcement, event emission, approval handoff.

**Domain** owns entities, value objects including Money, invariants, state transitions, authoritative business rules.

**Infrastructure** owns SQL and query building, cache, queue, provider adapters, file storage, secrets infrastructure, external APIs, DNS/CDN/TLS clients.

---

## 9. Forbidden Dependencies

The Domain layer must not depend on Next.js, React, NestJS, PostgreSQL, Redis, BullMQ, any ORM or query builder, MCP protocol types, any model provider SDK, payment provider SDKs, DNS/CDN/ACME clients, or plugin runtime details.

Domain must not know HTTP, REST, GraphQL, MCP, AI providers, payment providers, persistence, Redis, framework-specific infrastructure, presentation currency units, or calendar systems.

These are enforced by ADR-030. A prose-only prohibition is not acceptable.

---

## 10. User, Organization, Membership, Store

```text
User -> Organization/Tenant -> Membership -> Store
```

- a User may belong to multiple Organizations
- an Organization may own multiple Stores
- Store is an independent entity, not the tenant root
- Membership carries role assignment within the Organization context
- a storefront Customer is store-scoped and is never a platform User

---

## 11. Platform Core Ownership

Platform Core owns Identity, Tenant and Organization, Membership, Authorization, Roles, Permissions, Sessions, Plans, Plan Versions, Pricing, Price Versions, Subscriptions, Subscription Periods, Subscription Changes, Entitlements, Quota policy, Usage, Billing, Invoices, Credits, Currencies, Domains and Certificates, Files, Notifications, Audit, Security, Approval Requests, the Idempotency Service and the lifecycle Scheduler.

Platform Core must not own Products, Orders, Inventory, CRM leads, SEO data or Marketing data.

---

## 12. Tenant Isolation

Initial tenancy model: shared database, shared schema, `tenant_id` column, PostgreSQL RLS.

```text
Authentication
 -> Tenant Resolution
 -> Authorization
 -> Entitlement
 -> Application Validation
 -> Repository Tenant Scope
 -> PostgreSQL RLS
```

RLS is the final defence layer. It must not be the only defence layer. RLS must fail closed when tenant context is absent (ADR-021).

### 12.1 Tenant Context

Every request must carry `tenantId`, `userId`, `requestId`, `correlationId`, and `storeId` when store-scoped. Workers must preserve `tenantId`, `jobId`, `correlationId` and actor context.

Tenant context must never be inferred from arbitrary payloads when it can be derived securely from authenticated context. For anonymous storefront traffic, store scope is derived exclusively from verified host resolution (ADR-028).

---

## 13. Authorization, Entitlement, Quota

- Permission: what the actor may do
- Entitlement: what the tenant purchased or was granted
- Quota: how much of a resource the tenant may consume

```text
Authentication AND Permission AND Entitlement AND Quota AND Policy
```

This applies uniformly to REST, Admin UI, Storefront actions, AI, MCP, Plugins, Automation and Channels. A serving-state check (ADR-024) precedes all of them for tenant-facing surfaces.

---

## 14. Role System

Initial roles may include Owner, Admin, Manager, Editor, Support and Viewer. Roles must not be hard-coded into business logic. Use a data-driven model such as Role, Permission, RolePermission and MembershipRole.

---

## 15. SaaS Commercial Core

### 15.1 Plan System

Plans must be data-driven. Plan names must never be hard-coded into business rules. Admin must eventually be able to configure plans, features, limits, pricing, trial, add-ons and plan versions without a code deployment.

### 15.2 Plan Versioning

Plan semantics must be versioned. Existing subscriptions retain the version they purchased until an explicit migration occurs.

### 15.3 Pricing Versioning

Pricing is versioned. Invoices must reference the exact price version used.

### 15.4 Subscription Ownership

Subscription lifecycle belongs to SaaS Billing, not the payment provider. Lifecycle states: `TRIALING`, `ACTIVE`, `PAST_DUE`, `PAUSED`, `CANCEL_AT_PERIOD_END`, `EXPIRED`, `CANCELED`, `SUSPENDED`.

### 15.5 Terms, Periods and Renewal

A subscription has an explicit term length, an append-only history of periods, an optional auto-renew flag, and a derived serving state. Renewal, expiry, grace and reactivation are normatively defined in ADR-024. Plan change and proration are normatively defined in ADR-025.

The billing domain must not assume a payment provider can charge a stored credential. Renewal must work through invoice-and-notify where recurring charge is unavailable (ADR-023).

### 15.6 Billing versus Commerce Payment

These remain separate systems. SaaS Billing is Tenant to Platform. Commerce Payment is Customer to Store. Never merge these domains. Provider registries and credentials are separate even where an adapter implementation is shared.

### 15.7 Money

All monetary values are `Money` value objects with integer minor units and an explicit currency (ADR-022). Floating point is prohibited. Presentation units are an interface concern.

---

## 16. Entitlement Engine

Effective entitlement is calculated from Base Plan Version, plus Add-ons, plus Tenant Overrides, plus Policy Constraints.

Every entitlement decision must resolve to an explicit policy state: `ALLOW`, `DENY` or `LIMIT`. Explicit DENY always wins. Overrides must declare whether they are `ABSOLUTE` or `DELTA`. The engine must expose the final resolved entitlement and its resolution source for audit. See ADR-008.

Effective entitlement is cached and must be invalidated on subscription change, plan change, add-on change, override change, and every term or serving-state transition.

---

## 17. Quota Engine

Quota applies to resources such as Products, Users, Stores, **Domains**, Storage, Orders, API Requests, AI, SMS and Channels.

Quota must be tenant-scoped and enforced through the same capability path as other policy checks. Quota is enforced at creation time only. It is never enforced retroactively against existing data (ADR-026).

---

## 18. Usage Ledger

Usage must not be represented only by a mutable counter.

```text
UsageLedgerEntry
  tenantId, feature, quantity, period, source, referenceId, timestamp
```

Aggregated counters may be cached. The ledger remains authoritative for billing and audit. Usage periods use the half-open convention in ADR-031.

---

## 19. AI Credit Ledger

AI credits use a ledger, never a single mutable balance field.

```text
AVAILABLE -> RESERVED -> CONSUMED
AVAILABLE -> RESERVED -> RELEASED
```

The system must prevent negative effective balances unless an explicit credit policy allows it.

---

## 20. Concurrency, Ledger Integrity and Idempotency

Critical accounting operations must execute inside database transactions using explicit row-level locking, database constraints, and idempotency.

The platform must provide exactly one shared idempotency service covering MCP writes, AI writes, usage operations, credit ledger operations, payments, refunds, renewals, plan changes, webhooks and event consumers. The platform must not create separate idempotency mechanisms per module. PostgreSQL is authoritative; Redis is an optimization only. See ADR-006, ADR-009, ADR-021.

---

## 21. Commerce Domain

Commerce owns Catalog, Product, Variant, Category, Brand, Attribute, Pricing, Inventory, Cart, Checkout, Order, Customer, Coupon, Shipping and Tax.

### 21.1 Product

Must support Simple, Variable, Physical, Digital and Service types. Product must not depend on AI, SEO, Plugins, MCP or Next.js.

### 21.2 Inventory

```text
Product -> Inventory Item -> Stock, Reserved, Available, Reorder Point
```

Future Warehouse, Location, Stock Transfer, Purchase Order and Supplier must be addable without redesigning Product. Availability at checkout must be read from the primary, live, never from a projection (ADR-032).

### 21.3 Order

Lifecycle: `DRAFT`, `PENDING`, `CONFIRMED`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELED`, `REFUNDED`. Transitions are controlled by Domain and Application rules. Interfaces must not directly mutate order state. An order becomes `PAID` only after server-side payment verification (ADR-023).

---

## 22. Storefront

Each Store has a Storefront: Home, Products, Categories, Search, Product Detail, Cart, Checkout, Account, Orders.

Storefront communicates through application or API contracts and must not access repositories directly.

Storefront reads use the separated read path and cached read model defined in ADR-032. Storefront writes use the full request pipeline with no exception. Delivery, caching, invalidation and provider ports are defined in ADR-019.

---

## 23. Domain Management and White Label

Domain management belongs to platform infrastructure; domains are owned by Stores. Capabilities: Add, Verify, Set Primary, Remove, Certificate Status, Redirect.

Apex, www and subdomains are supported, with identical handling for every TLD. Ownership is proven by DNS verification and re-verified on a schedule. Hostname uniqueness for verified domains is platform-global. Certificate issuance and renewal is a monitored lifecycle. See ADR-027 and ADR-028.

Web domains and email sending domains are separate entities with separate verification lifecycles.

White-label capabilities may include Custom Domain, Custom Logo, Custom Colors, Custom Email and Custom Branding, all entitlement-driven and evaluated at request time rather than by mutating data.

---

## 24. Transaction Boundaries and Outbox

Every application use case must explicitly define its transaction boundary. External side effects must not be required to complete the same database transaction.

```text
DB Transaction: domain writes + outbox writes -> Dispatcher -> Queue/Worker -> Consumers
```

Events requiring reliable asynchronous delivery must use a transactional outbox. Storefront cache invalidation and read-model projection are outbox consumers.

---

## 25. Capability Platform

A Capability represents an addressable platform operation. Its definition contains id, version, description, inputSchema, outputSchema, permissions, tenantScope, entitlement, quota, rateLimit, auditPolicy, executionPolicy, riskClassification where write-sensitive, and idempotencyPolicy where required.

Capability is not the location of business logic.

### 25.1 V1 Capability Rule

In V1 the capability platform is code-first metadata, not a heavy dynamic runtime product.

---

## 26. Application Services

```text
inventory.update -> UpdateInventoryService -> Inventory Domain -> Repository
```

All interfaces representing the same operation must converge on the same Application use case.

---

## 27. Interface Convergence

REST, MCP, AI, Plugin, Automation, Admin UI, Storefront UI and Channels must not implement duplicate business logic.

```text
Interface -> Capability -> Application Service -> Domain
```

Business logic is written once. This is the most important rule in the entire system. The storefront read path is an optimized projection of Domain-computed results, not a second implementation of them.

---

## 28. Event Platform

Standard versioned envelope: `eventId`, `eventType`, `tenantId`, `actorId`, `timestamp`, `correlationId`, `payload`, `version`.

Required V1 event families: identity and membership, subscription lifecycle including `SubscriptionRenewed`, `SubscriptionExpired`, `PlanChanged`, catalog and pricing, inventory availability, order lifecycle, payment lifecycle, domain lifecycle.

Only the events required by current consumers need to be implemented in V1. Do not build an event empire before you have event consumers.

---

## 29. Automation

Automation is event-driven and must invoke Capabilities or Application Services. It must not directly manipulate domain persistence. V1 automation stays narrow.

---

## 30. Webhooks

Tenant webhooks must support signature, retry, idempotency, delivery log and dead letter, and must execute asynchronously. Webhook consumers and deliveries participate in the shared idempotency strategy.

---

## 31. Plugin Platform

### 31.1 Plugin Manifest

id, name, version, author, description, platformVersion, dependencies, permissions, capabilities, events, uiExtensions, mcpTools, aiTools, configuration, migration.

### 31.2 Plugin Lifecycle

`DISCOVERED`, `INSTALLING`, `INSTALLED`, `ACTIVATED`, `DEACTIVATED`, `UPDATING`, `UPDATED`, `UNINSTALLING`, `REMOVED`. Transitions are controlled.

### 31.3 Plugin Dependencies

The resolver must verify plugin dependency, platform version, plugin version, capability availability and compatibility.

### 31.4 Plugin Security Boundary

V1 trusted plugins may execute in-process. In-process plugins are **not** a security boundary. Enforcement is mechanical per ADR-005 and ADR-030. Marketplace or untrusted third-party plugins require an isolated runtime. See ADR-005.

### 31.5 Plugin Extension Points

Admin Navigation, Dashboard, Product Page, Order Page, Customer Page, Settings, Checkout, Storefront. Plugins extend through defined contracts and must not modify arbitrary core source code.

### 31.6 Plugin Entitlement

Plugin availability may depend on tenant plan, plugin subscription and plugin entitlement.

### 31.7 Plugin Isolation Testing

The tenant isolation suite must include malicious and buggy in-process plugin scenarios. Release-blocking. See ADR-005b.

---

## 32. AI Plane

Components: AI Gateway, Agent Runtime, Agent Registry, Model Router, Provider Adapters, Prompt Registry, Tool Registry, RAG, Embeddings, Evaluation, Usage, AI Credits, AI Policies.

### 32.1 AI Provider Isolation

```text
Application -> AI Service -> AI Gateway -> Model Router -> Provider Adapter
```

Domain code must never call model providers directly. The selected provider remains an implementation detail.

### 32.2 V1 AI Boundary

V1 uses an isolated application boundary inside the monolith. Python extraction is allowed later when workloads justify it.

### 32.3 Python to NestJS Boundary

If Python is introduced, V1 transport must use an internal authenticated HTTP API with stable OpenAPI contracts, never publicly exposed. Async work must use the existing job and queue infrastructure. Service-to-service auth uses short-lived Service JWTs. See ADR-004 and ADR-004b.

### 32.4 AI Policy and Tools

An AI Agent must not receive unrestricted write capability. Agent -> AI Policy -> Tool -> Capability -> Application. AI tools declare id, version, schemas, permission, entitlement, credit cost, rate limit, audit policy and execution policy, and should map to Capabilities wherever possible. Agents must not contain authoritative business rules.

### 32.5 Explainability

Any AI suggestion surfaced to a merchant must persist its justification, contributing data factors, confidence and originating model, for audit.

---

## 33. MCP

MCP does not replace REST. Both are interface mechanisms converging on Capability.

The platform may expose MCP as a server and consume external MCP as a client. Exposure requires the full policy chain and platform-side approval for high-risk writes (ADR-001, ADR-001b, ADR-002, ADR-003). Consumption treats all external MCP output as untrusted data (ADR-007). MCP must never access PostgreSQL directly.

---

## 34. Notification Platform

A central notification abstraction covering Email, SMS, Push, In-App and Webhook. Domains must not depend on provider SDKs.

Required V1 notification flows: invitation, password reset, renewal notice and reminders, payment failure, over-limit warning, expiry warning and expiry, domain verification result, certificate renewal failure escalation.

---

## 35. Search

Initial search uses PostgreSQL full-text search. AI vector search uses pgvector when introduced. OpenSearch is deferred until scale or requirements justify it.

---

## 36. Storage

S3-compatible object storage. The database stores metadata only: fileId, tenantId, storeId where applicable, path, mimeType, size, metadata. Binary objects do not belong in PostgreSQL. Image transformation is not performed in the application process.

---

## 37. Redis

Redis may be used for cache, queues, rate limits, locks, temporary state and job state. Redis must never become the authoritative source of business data. For idempotency it is a read-through optimization only (ADR-009).

---

## 38. Background Workers and Scheduling

Heavy work must not block HTTP requests. BullMQ on Redis, with retries and dead-letter handling.

Scheduled lifecycle jobs are part of the V1 deliverable, not operational garnish: renewal notice, renewal reminder, subscription rollover, subscription expiry, deprovisioning, trial expiry, payment reconciliation sweep, domain re-verification, certificate renewal, read-model reprojection, idempotency record pruning.

Every scheduled job must be idempotent and safe to run repeatedly or late.

---

## 39. Database

PostgreSQL is authoritative. Access is SQL-first and type-safe per ADR-021. Ownership remains modular: a table has exactly one owning module.

```text
Domain -> Repository Interface -> Infrastructure Repository -> SQL -> PostgreSQL
```

Persistence models and domain entities are distinct types with an explicit mapper.

---

## 40. Observability

Required: structured logs carrying `requestId`, `correlationId`, `tenantId` and actor; metrics for API, workers, database, cache and every provider adapter; health and readiness endpoints; traces across HTTP, worker and provider boundaries.

Required alerts before production: certificate renewal failure, payment reconciliation backlog, scheduled lifecycle job failure or lateness, outbox dispatch lag, dead-letter growth, RLS-denied query spikes, and any tenant-isolation test failure.

A target without a metric is fiction (ADR-010).

---

## 41. Security Baseline

Secrets outside source control and images, rotated and revocable. Store-scoped provider credentials encrypted at rest, never returned by a read API, never logged. Input validation at every interface. Rate limiting per tenant, per user and per IP. Audit on every sensitive action. Fail closed on missing tenant context. Attacker-controlled inputs, including `Host`, treated as untrusted.

---

## 42. Deployment and Environments

Docker images, reverse proxy with TLS termination, CI and CD. `api`, `worker` and `web` may be separate deployables while remaining one codebase.

Required before production: forward-only reviewed migrations, health and readiness checks, backups with a completed restore drill meeting the ADR-010 RPO/RTO, queue retries and dead letters, secrets management, connection pooler mode asserted per ADR-021, and a documented `PROVIDER_MATRIX.md` for payment, DNS, CDN, certificate and notification providers.

---

## 43. Extraction Seams

Keep these behind contracts from day one: payment providers, notification providers, object storage, queue transport, AI providers, search, DNS, CDN, certificate issuance, and external channels.

Do not add network calls between internal modules until extraction is justified.

---

## 44. Architecture Conformance

Every boundary in this document that can be verified mechanically must be verified mechanically in CI as a build failure, per ADR-030. The harness ships before the first feature. A boundary that exists only in prose will be violated.
