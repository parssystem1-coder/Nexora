# Technical Blueprint

**Version:** 2.0
**Status:** Implementation baseline for Phase 0 through Phase 4

---

## 1. Runtime Topology

```text
                      CDN / Edge Cache
                             |
            Reverse Proxy / TLS termination
                             |
        +--------------------+--------------------+
        |                                         |
  Next.js Storefront                      Next.js Admin
  (static + on-demand ISR)                (authenticated SSR/CSR)
        |                                         |
        +--------------------+--------------------+
                             |
                      NestJS API
                   /         |         \
     PostgreSQL primary   Redis     Object Storage
            |               |
     read replica     BullMQ Worker
                            |
                   Provider Adapters
         (payment, dns, cdn, certificate, notification)

Optional later:
  Python AI Plane -> authenticated internal API -> NestJS Capabilities
```

Start as a modular monolith. `api`, `worker` and `web` may be separate deployables, but business modules remain internally separated and communicate through contracts, never repository imports.

---

## 2. Module Layout

```text
modules/
  identity/          users, credentials, sessions, identity providers
  tenant/            organizations, memberships, store ownership
  authorization/     roles, permissions, policy evaluation
  money/             Money value object, currency registry, allocator
  billing/           invoices, payments to platform, provider registry
  subscription/      plans, versions, prices, terms, periods, changes
  entitlement/       resolution, sources, caching, over-limit state
  quota/             quota policies, enforcement at creation
  usage/             usage ledger, ai credit ledger
  idempotency/       the one and only idempotency service
  approval/          approval requests and lifecycle
  audit/             audit events
  notification/      channel abstraction and templates
  files/             object storage metadata
  scheduling/        lifecycle jobs and cron registry
  domains/           store domains, verification, certificates
  commerce/          catalog, product, inventory, cart, order, customer,
                     coupon, shipping, tax, commerce payment
  storefront/        read model, projection, cache invalidation, rendering contract
  capability/        capability registry and policy pipeline
  eventing/          envelope, outbox, dispatcher
  webhook/           endpoints, delivery, retries, dead letters
  plugin/            sdk boundary, manifest, lifecycle
  ai/                gateway, tool registry, policy
  automation/        event-driven rules
  mcp/               gateway, tool exposure, client
```

Each module owns `interfaces/`, `application/`, `domain/`, `infrastructure/`, and `contracts/` where other modules must consume it.

### 2.1 File conventions, mandatory

An automated implementer needs file-level conventions, not only module-level ones.

```text
modules/<module>/
  contracts/
    <module>.contract.ts          public types other modules may import
    index.ts                      the only permitted import surface
  domain/
    <aggregate>.entity.ts
    <aggregate>.invariants.ts
    <value-object>.vo.ts
    <aggregate>.repository.ts     interface only, no implementation
    <aggregate>.errors.ts
  application/
    <use-case>.service.ts         one use case per file
    <use-case>.input.ts           schema + inferred type
    <use-case>.spec.ts
  infrastructure/
    <aggregate>.repository.pg.ts
    <aggregate>.mapper.ts
    <provider>.adapter.ts
  interfaces/
    <resource>.controller.ts      thin, no business logic
    <capability>.capability.ts    capability definition metadata
  migrations/
    <timestamp>_<module>__<description>.sql
```

Rules: one use case per file; a controller may contain no conditional business logic; a repository implementation may not be imported outside its own module; `contracts/index.ts` is the only cross-module import path.

---

## 3. Cross-Cutting Request Pipeline

### 3.1 Admin, API, MCP, AI, automation, and all writes

```text
Authenticate
 -> Resolve Organization/Tenant
 -> Resolve Store when required (explicit input, verified)
 -> Check Serving State (ADR-024)
 -> Build Trusted TenantContext
 -> Open Transaction + set RLS session context (ADR-021)
 -> Validate Input
 -> Authorize Permission
 -> Resolve Entitlement
 -> Check Quota and Rate Limit
 -> Claim Idempotency when required
 -> Execute Application Service
 -> Commit or Roll Back Domain Data + Outbox
 -> Audit, durable, independent connection, either outcome (ADR-034)
 -> Return Stable Result
```

The audit step is **not** part of the domain transaction and is not conditional on it committing. It is written on a connection independent of that transaction, in its own transaction that commits on its own, unconditionally on both the success and the failure path, with `outcome` recording which occurred — and the handler does not resolve until that write completes. An audit event therefore attests to an authorized *attempt*, not to a committed effect. See ADR-034 for the full decision, including the rejected alternatives and the accepted non-atomicity cost.

### 3.2 Storefront read path (ADR-032)

```text
Normalize Host
 -> Resolve verified domain -> tenantId + storeId
 -> Check Serving State
 -> Serve from cache / read model
 -> (cache miss) read replica query, scoped, RLS applied
```

No authentication, no policy chain, read-only. **Zero database connections on a cache hit.**

### 3.3 Storefront write path

Identical to 3.1. Cart, checkout, order creation, account actions and reviews all use it. Inventory availability at checkout is read live from the primary.

---

## 4. Phase 0 Deliverables, before any feature

1. `REPOSITORY_AUDIT_REPORT.md` against the real repository state.
2. Toolchain baseline: TypeScript, NestJS, Next.js, query builder per ADR-021, test runner, linter, formatter.
3. **Conformance harness per ADR-030**, with a deliberately failing fixture for every rule.
4. Migration runner and transaction/RLS-context helper.
5. Configuration and secret loading.
6. `DECISION_LOG.md` and `PROVIDER_MATRIX.md` skeletons.

Exit: the harness fails a deliberately broken commit, and passes a clean one.

---

## 5. Phase 1 Golden Path

Implement one complete slice before any broad scaffolding:

```text
create organization -> invite member -> assign role -> create store -> read store
```

`store.read` is designated the **golden path**. It is hand-reviewed and becomes the canonical example every later slice mirrors.

The slice must prove authentication and sessions, tenant context, membership authorization, RLS fail-closed behaviour, audit, stable API errors, observability, and integration tests against real PostgreSQL.

---

## 6. Phase 2 Slice

```text
create plan version -> create price version -> subscribe organization with a 1-year term
 -> resolve entitlement -> enforce quota -> record usage ledger entry
 -> renew early -> upgrade with proration -> schedule downgrade
 -> expire after grace -> reactivate
```

This slice must prove Money, terms and periods, the serving-state function, proration reconciliation, idempotent lifecycle jobs, and the over-limit policy.

---

## 7. Phase 3 Slice

```text
create product -> set price -> reserve inventory -> create cart -> checkout
 -> create payment intent -> verify payment -> confirm order
 -> abandoned callback resolved by reconciliation sweep
```

---

## 8. Phase 4 Slice

```text
add domain -> verify by DNS TXT -> issue certificate -> set primary
 -> serve cached storefront -> publish product -> observe cache invalidation
 -> expire subscription -> observe de-routing
```

---

## 9. Extraction Seams

Keep behind contracts from day one: payment providers, notification providers, object storage, queue transport, AI providers, search, DNS, CDN, certificate issuance, external channels.

Do not add network calls between internal modules until extraction is justified.

---

## 10. Caching Strategy

| Layer | Holds | Invalidated by | Authoritative |
|---|---|---|---|
| CDN / edge | rendered storefront pages, assets | outbox events, time fallback | no |
| Storefront read model (PostgreSQL) | denormalized catalog per store | outbox projection | no, rebuildable |
| Redis | sessions index, rate limits, entitlement resolution, idempotency read-through, domain-to-store map | explicit invalidation on change | no |
| PostgreSQL | everything else | n/a | yes |

Rules: every cache entry is namespaced by `tenantId` and `storeId`. Nothing financial, quota-sensitive or authorization-sensitive is served from cache without a bounded, documented staleness window. Inventory availability at checkout is never cached.

---

## 11. Connection and Pool Strategy

- separate pools for admin/API, storefront uncached reads, and workers
- storefront uncached reads may target a read replica; writes and read-after-write use the primary
- external pooler in transaction mode only; statement mode is forbidden by ADR-021
- pool sizes derive from the ADR-010 assumptions and are asserted in the deployment checklist

---

## 12. Operational Baseline

Required before production:

- migrations forward-only and reversible where practical
- health and readiness checks
- structured logs with `requestId`, `correlationId`, `tenantId`
- metrics for API, workers, database, cache and every provider adapter
- backups plus a completed restore drill meeting the ADR-010 RPO and RTO
- queue retries and dead-letter handling
- alerting per RFC section 40, including certificate renewal failure and reconciliation backlog
- secrets outside source control and images
- `PROVIDER_MATRIX.md` completed and dated
