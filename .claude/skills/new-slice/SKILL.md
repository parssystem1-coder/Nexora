---
name: new-slice
description: Implement one vertical capability slice mirroring the frozen golden path (store.read). Use when adding any new capability — organization.create, membership.invite, membership.role.assign, store.create, auth.login/logout/logout_all, organization.switch, or any Phase 2+ capability. Encodes the pipeline order, module layout, migration/RLS rules, and test layering that AGENTS.md requires.
---

# Implement one vertical slice

`AGENTS.md` §2: exactly one slice in this codebase is the golden path — `store.read`. It is hand-reviewed and frozen. Mirror its structure exactly. If the slice cannot be expressed in that structure, **stop and document the mismatch in `DECISION_LOG.md`**. Do not invent a second structure.

One slice per invocation. Never two.

---

## Step 0 — Load the right context, and nothing else

`README_START_HERE.md` forbids loading the whole documentation pack into one window; it causes rule amnesia and over-engineering.

**Always load:**
- `AGENTS.md`
- `08_PHASE_1_BRIEF.md` (for a Phase 1 slice) or the phase brief in force

**Load on demand, only the sections this slice touches:**
- `03_TECHNICAL_BLUEPRINT.md` §2 (module layout), §3.1 (pipeline)
- `04_DATABASE_BLUEPRINT.md` (only the tables this slice owns)
- `05_API_CAPABILITY_CONTRACTS.md` (this capability's contract + §7 error codes)
- `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — only the ADRs this slice touches

**Never load during Phase 1 or 2:** `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, ADR-011 through ADR-018.

When documents disagree, precedence is: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Step 0.5 — Get the current map for free

```bash
npm run graph && cat PROJECT_GRAPH.md
```

One screen tells you which modules, tables, capabilities, routes, singletons and tests already exist, and each table's RLS posture. Read it before grepping the tree — it saves rediscovering facts that are already extracted, and it tells you immediately whether the table your slice needs already exists.

It reports structure only. It cannot tell you whether anything is *correct* — that is still the reading and judging you do in the steps below.

## Step 1 — Read the golden path before writing anything

Open these in order. They are the template, not just an example.

| Pipeline step | File |
|---|---|
| 1 · authenticate against a server-side session | `modules/identity/interfaces/session.guard.ts` |
| 2–4 · resolve membership, explicit resource id, access check, build `TenantContext` | `modules/tenant/interfaces/store-access.guard.ts` |
| 5–8 · transaction + RLS, authorize, execute, audit | `modules/tenant/interfaces/store.controller.ts` |
| capability definition | `modules/tenant/interfaces/store-read.capability.ts` |
| 7 · application service | `modules/tenant/application/read-store.service.ts` |
| input validation (Zod) | `modules/tenant/application/read-store.input.ts` |
| domain entity + repository port | `modules/tenant/domain/store.entity.ts`, `store.repository.ts` |
| infrastructure adapter + table types | `modules/tenant/infrastructure/store.repository.pg.ts`, `store.tables.ts` |
| module's public surface | `modules/tenant/contracts/index.ts` |
| 9 · stable error contract | `modules/capability/interfaces/http-exception.filter.ts`, `modules/capability/domain/capability.errors.ts` |
| 10 · structured logging | `apps/api/request-context.middleware.ts`, `apps/api/logging.middleware.ts` |
| 11 · tests at every layer | `apps/api/store-read.integration.spec.ts` |
| the only transaction opener | `platform/db/tenant-context.ts` |

**Read the current code, not this table's assumptions.** Where the golden path has been repaired since it was first written — audit placement, error mapping, where the connection pool comes from — the code is the truth. Copy what is there.

## Step 2 — State the pre-change checklist

`AGENTS.md` §3 requires this before code. Write it out:

- [ ] owning module and aggregate
- [ ] tenant scope and store scope
- [ ] required permission, entitlement, quota, rate limit
- [ ] audit requirement
- [ ] Application Service and Capability id
- [ ] transaction boundary
- [ ] idempotency behaviour (or explicit "not applicable" with reason)
- [ ] emitted events and external side effects
- [ ] money/currency handling, if any value is monetary
- [ ] time and timezone handling, if any date boundary matters
- [ ] affected ADRs
- [ ] whether a new ADR is required

If any line is uncertain, that is a documentation defect. Write it into `DECISION_LOG.md` with options and a recommendation, then stop and report — per `AGENTS.md` §5.

## Step 3 — Module layout

Every module has exactly these six directories. Put each file in the one that matches its layer:

```
modules/<module>/
  contracts/        public surface other modules may import — nothing else is importable
  domain/           entities, value objects, repository *ports*, invariants
  application/      one use case per file, input schemas
  infrastructure/   Kysely repository implementations, table type declarations
  interfaces/       controllers, guards, capability definitions
  migrations/       plain SQL, forward-only
```

Rules the conformance harness enforces mechanically — do not fight them:

- `domain/` imports nothing from `application/`, `infrastructure/`, or `interfaces/`
- `application/` imports nothing from `interfaces/` or `infrastructure/`
- no module reaches another module's internals — only its `contracts/`
- no `domain/` file imports Kysely, `pg`, Redis, NestJS, Next, React, or a provider SDK
- only `platform/db/pool.ts`, `migrate.ts`, `migrate-cli.ts` may import `pg`
- only `platform/db/tenant-context.ts` may open a transaction
- **one use case per file; controllers contain no business logic**

## Step 4 — Migrations

**Forward-only** (ADR-021 item 8). Never edit an applied migration; add a new one.

Filename: `<timestamp>_<module>__<description>.sql` — the runner rejects anything else.

Every tenant-owned table, **in the same migration that creates it**:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;

CREATE POLICY <t>_tenant_isolation ON <t>
  USING (tenant_id::text = current_setting('app.tenant_id', true));
```

Compare as **text**, not uuid: `current_setting(..., true)` returns `''` for an unset context, and `''::uuid` raises instead of failing closed.

`FORCE` is not optional — a table's owner bypasses plain `ENABLE` (confirmed empirically; see `DECISION_LOG.md`).

**Exempt from `tenant_id` + RLS, and only these:** `users`, `sessions`, `credentials`, `currencies`, `reserved_subdomains`, `roles`, `permissions`, `role_permissions`. `membership_roles` is **not** exempt. `identity_providers` is not yet built and its tenancy is undecided — do not assume it joins this list without its own decision. Adding to this list requires a recorded decision, not implementer authority.

**Do not create a table outside the phase brief's scope list.** For the remaining Phase 1 slices that means only: `identity_providers`, `outbox_events`. (`currencies` and `credentials` were in this list too, but both are already built — `modules/money` Phase 1 step 4, "money: Money value object, currencies registry and allocator (Phase 1 step 4)" (`20085bc`), and `modules/identity`'s `auth.login` slice respectively.) No billing, commerce, domain, plugin, AI or MCP tables.

Two more traps the golden path already hit:

- `INSERT … RETURNING` re-checks the policy's `USING` clause, so a row creating its *own* tenant must have its id generated client-side rather than relying on the column default.
- If a slice must read a table before `TenantContext` exists (the bootstrap phase), do not widen the policy to solve it. That pattern exists on `memberships` and `store_memberships` as a recorded decision (risk R-003) and must not be copied to a third table without its own decision.

## Step 5 — Wire the pipeline in the same order

Guards do steps 1–4, before any transaction — they establish *which* tenant may be trusted, so they cannot already run inside that tenant's context. Steps 5–8 run inside **one** transaction opened by `withTenantContext`.

The resource id is **always an explicit input** — a path parameter or request body field, validated with Zod. Never derive it from the session token, and never trust a `Host` header (ADR-002).

Errors: throw `CapabilityError` with a code that already exists in `capability.errors.ts` and is documented in `05_API_CAPABILITY_CONTRACTS.md` §7. If the slice genuinely needs a new code, add it to the union *and* confirm it is in §7 — do not invent one.

## Step 6 — Test at the layer where the rule lives

`AGENTS.md` §8. A feature that works but has no test at the layer where its rule lives **is not done**.

| Rule lives in | Test lives in |
|---|---|
| Domain invariant | domain unit test |
| Use case orchestration, transaction, idempotency | application test |
| Permission, entitlement, quota, approval | capability policy test |
| Tenant isolation, RLS | integration test against real PostgreSQL |
| HTTP contract, error codes | interface contract test |
| Architecture boundary | conformance harness |

Mocked PostgreSQL never satisfies a tenant isolation requirement. Use `apps/api/test-support/seed.ts` and build the app through `apps/api/create-app.ts`, never a hand-assembled middleware stack — a test against a different stack than the one that ships is how pipeline step 10 went untested the first time.

For every slice, at minimum prove: the happy path; each denial direction independently; the documented error code for each failure mode; and that the audit event lands with the right `outcome`.

## Step 7 — Verify

```bash
npm run typecheck     # strict, noUncheckedIndexedAccess
npm test              # all green, and more tests than before this slice
npm run conformance   # 0 violations
npm run db:migrate    # applies cleanly from an empty database
npm run graph         # regenerate the project map; commit it with the slice
```

Run `npm run graph -- --since HEAD` before committing and read the diff: it names every table, route, capability, dependency edge and RLS change your slice introduced. A new cross-module dependency you did not intend shows up here as a line you did not expect.

If the harness flags something, **do not weaken the rule and do not add an exception to get green.** Restructure the code. An `exceptions.json` entry needs a real ADR reference and an explicit callout in your report; a silently growing exceptions list is a failed slice.

## Step 8 — Report and stop

- Append any decision you had to make to `DECISION_LOG.md`.
- One commit naming the owning module and affected ADRs.
- Report: what was built, which test proves each rule, what you deliberately did not do.
- **Stop.** Do not start the next slice in the same run.

---

## Remaining Phase 1 slices, in order

Per `08_PHASE_1_BRIEF.md` §3 — this order is normative, not a suggestion. Items 1–5 are done; item 6 is what is actually left.

1. ✅ `organization.create` — done, "tenant: organization.create slice, plus the ADR-033 OpenAPI artifact" (`e024613`)
2. ✅ `membership.invite` — done, "tenant: membership.invite slice" (`7bdaea7`)
3. ✅ `membership.role.assign` — done, "tenant: membership.role.assign slice" (`88f2a6d`)
4. ✅ `store.create` — done, "tenant: store.create slice" (`82c1f05`)
5. ✅ `auth.login`, `auth.logout`, `auth.logout_all` — all done. `auth.login` needed `credentials`, Argon2id per ADR-029 (DECISION_LOG.md 2026-08-23 for the `credentials` tenancy decision, ADR-035 for auditing with no established tenant). `auth.logout`/`auth.logout_all` were implemented together as one run, deliberately (DECISION_LOG.md 2026-08-24 explains why two capabilities count as one slice here) — they originally added `SessionTerminationRepository` as a sibling port to `SessionRevocationRepository` rather than a widening of it, collapsed back into one port on 2026-08-24 (see `SessionRevocationRepository`'s own doc comment and DECISION_LOG.md) once it was clear "the fake must pass untouched" meant "don't regress it," not "never edit it." `auth.logout_all` ends the caller's own session too (same precedent `membership.role.assign` set for self-assignment).
6. `organization.switch`

One Phase 1 exit criterion is still open: revoking a membership must invalidate active sessions within one request (`08_PHASE_1_BRIEF.md` §6 row 4). It needs `membership.revoke`, which is not itself one of the six slices above — it is not scheduled. The `Money` allocator test criterion is already met (`modules/money/domain/money.vo.spec.ts`, "money: Money value object, currencies registry and allocator (Phase 1 step 4)" (`20085bc`)).

`08` §5's "sessions invalidate immediately on password change, membership revocation and role change" has one of its three triggers implemented: role change, built in slice 3 (`membership.role.assign`). Password change and membership revocation are not — see `DECISION_LOG.md` 2026-08-23 ("`membership.role.assign`", decision 9) before assuming session invalidation is fully covered.
