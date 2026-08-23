# Phase 1 Brief

**This is the only scope you are authorized to implement right now.**

Load this file plus `AGENTS.md`. Pull sections from `03`, `04`, `05` and specific ADRs on demand. Do not load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018.

---

## 0. Stack, already decided. Do not re-litigate.

| Concern | Decision | Authority |
|---|---|---|
| Backend | NestJS + TypeScript, modular monolith | RFC 7 |
| Frontend | Next.js + React + TypeScript | RFC header |
| Database | PostgreSQL with RLS | RFC 12 |
| Data access | SQL-first typed query builder (Drizzle or Kysely) over `pg`. No heavy ORM. | ADR-021 |
| Cache / queue | Redis + BullMQ | RFC 37, 38 |
| Auth | first-party, Argon2id, server-side revocable sessions | ADR-029 |
| Money | integer minor units + explicit currency | ADR-022 |
| Time | UTC `timestamptz`, injected clock, calendar arithmetic | ADR-031 |
| Migrations | reviewed plain SQL, forward-only | ADR-021 item 8 |

---

## 1. Task 0, before any feature code

1. Produce `REPOSITORY_AUDIT_REPORT.md` at the repository root. Inspect actual code, config, dependencies, database setup, migrations, tests, CI and deployment. Classify each area `MATCH | PARTIAL | MISSING | CONFLICT | UNKNOWN`. An empty repository yields an audit full of `MISSING`. Produce it anyway; do not skip it and do not stall on it.
2. Build the conformance harness (ADR-030) with a deliberately failing fixture per rule.
3. Create `DECISION_LOG.md`, `PROVIDER_MATRIX.md`, `RISK_REGISTER.md`.

Stop and report before Task 1.

---

## 2. Task 1, the golden path

Implement `store.read` completely, as the reference implementation every later slice mirrors:

```text
GET /api/v1/stores/{storeId}
```

It must demonstrate, in this order:

1. authentication against a server-side session
2. resolution of user, organization membership and the explicitly supplied `storeId`
3. store access check, server-side, never derived from the token alone (ADR-002)
4. trusted `TenantContext` construction
5. transaction open plus RLS session context via the single helper (ADR-021)
6. permission authorization through the capability policy pipeline
7. application service execution with domain mapping
8. audit event, written on a connection independent of the domain transaction, in its own transaction that commits on its own — issued once that domain transaction has resolved and before the handler returns or re-throws, unconditionally on both the success and the failure path, so the record survives whether the domain transaction committed or rolled back (ADR-034). Exactly one event per capability attempt, not one per pipeline step. An audit event therefore attests to an authorized attempt, with `outcome` distinguishing success from failure — not to a committed effect.
9. stable error contract for every failure mode
10. structured logging with `requestId`, `correlationId`, `tenantId`
11. tests at every layer, including an RLS test proving a query without context returns zero rows

**Stop after this and request review.** Do not proceed to Task 2 until the golden path is approved. Everything after this is pattern replication, so a wrong pattern here multiplies.

---

## 3. Task 2, the rest of the Phase 1 slice

In order, each mirroring the golden path:

1. `organization.create`
2. `membership.invite`
3. `membership.role.assign`
4. `store.create`
5. `auth.login`, `auth.logout`, `auth.logout_all`
6. `organization.switch`

---

## 4. Tables in scope

Only these. Creating anything else is out of scope.

```text
users, credentials, sessions, identity_providers
organizations, memberships, roles, permissions,
role_permissions, membership_roles
stores, store_memberships
currencies
audit_events
outbox_events
reserved_subdomains
```

About twelve tables. Not sixty. Do not create billing, commerce, domain, plugin, AI or MCP tables.

`currencies` and the `Money` value object are in Phase 1 deliberately, even though nothing charges money yet, because retrofitting money into an existing schema is a data migration plus a rounding-bug hunt.

---

## 5. Non-negotiable rules for this phase

- every table above except `users`, `currencies`, `reserved_subdomains`, `sessions` and `credentials` carries `tenant_id` and an RLS policy in the same migration that creates it. `roles`, `permissions` and `role_permissions` are platform-wide reference data and are likewise exempt. `sessions` is exempt because one user holds memberships in several organizations while having a single live session, so a session row has no single correct `tenant_id`; the role catalog is exempt because capability keys are platform-defined, not per-tenant; `credentials` is exempt for the same reason as `sessions` — a password belongs to the person, not to any one organization they hold membership in — decided 2026-08-23 when `auth.login` (Task 2 slice 5) created the table (see `DECISION_LOG.md`). `identity_providers` is not yet built and its tenancy remains undecided. `membership_roles` is **not** exempt — it is tenant-scoped and carries `tenant_id` + RLS like any other tenant-owned table.
- RLS fails closed: no tenant context means zero rows plus an application error
- the application database role cannot bypass RLS
- `store_memberships` is checked for every store-scoped read; organization membership alone is not sufficient
- `storeId` is always an explicit input, never inferred
- store slug creation rejects anything in `reserved_subdomains`
- one use case per file; controllers contain no business logic
- no `domain` file imports the query builder, the driver, NestJS, React or any provider SDK
- sessions invalidate immediately on password change, membership revocation and role change
- a storefront customer identity is out of scope; do not create one

---

## 6. Exit criteria, all proven by tests in CI

- [ ] Tenant A cannot read, write, delete or execute against Tenant B data
- [ ] a valid session with a `storeId` belonging to another tenant is denied
- [ ] a query issued without tenant context returns zero rows and raises an error
- [ ] revoking a membership invalidates active sessions within one request
- [ ] every capability in scope emits an audit event
- [ ] every error path returns a documented code from `05_API_CAPABILITY_CONTRACTS.md`
- [ ] conformance harness green with an empty or fully justified exceptions report
- [ ] integration tests run against real PostgreSQL, not mocks
- [ ] `Money` allocator test proves parts sum to the whole over randomized inputs

---

## 7. When you get stuck

Write the ambiguity into `DECISION_LOG.md` with options and a recommendation, then stop and report. Do not invent a competing architecture, do not silently pick the convenient option, and do not expand scope to route around a blocker.
