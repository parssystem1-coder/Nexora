# Phase 0 and Phase 1 — Completion Summary

**Date:** 2026-08-22
**Last commit:** `9c53166` — 2026-08-22 06:04 (8 commits total)
**State:** Phase 0 complete. Phase 1 **Task 1 (golden path) complete and approved**; Task 2 not started.

> **Scope note on the title.** Phase 1 is not finished — Task 1 is. `08_PHASE_1_BRIEF.md` §3 lists seven further slices in Task 2, and two of Phase 1's nine exit criteria are not yet met (§4 below). This document summarises what is done and is explicit about what is not.

---

## 1. Phase 0 — Foundation Audit and Guardrails

**Audit result:** new repository → conformant toolchain plus a self-proving conformance harness.

Before this work the repository held only the twelve-document pack, `AGENTS.md`, `README_START_HERE.md` and `future/`. No `package.json`, no source, no database, no migrations, no tests, no CI, and no git repository. `REPOSITORY_AUDIT_REPORT.md` records the classification (`MATCH | PARTIAL | MISSING | CONFLICT | UNKNOWN`) per area, as `AGENTS.md` §0 requires even when the answer is trivially "everything is MISSING".

### Conformance harness (ADR-030)

Five rule families, all mechanically enforced and failing the build on violation:

| Family | Rules |
|---|---|
| Dependency direction | domain ↛ application/infrastructure/interfaces; application ↛ interfaces/infrastructure; no module reaches another module's internals, only its `contracts/` |
| Forbidden imports | domain ↛ query builder/driver/Redis/NestJS/Next/React/provider SDK; plugin boundary ↛ ORM/driver/Redis; ai, mcp, automation, storefront ↛ repositories |
| Singleton roles | exactly one each of idempotency, tenant-context, serving-state, money-allocator, host-resolution |
| Schema | every tenant-owned table has `tenant_id`, an RLS policy **and** `FORCE ROW LEVEL SECURITY`; no float on a monetary column; no duplicate idempotency table |
| Secrets | no credential-shaped literal, PEM block or AWS key; no secret embedded in a log line or `.snap` snapshot |

Plus a sixth family added during Task 1: **DB access** — only `platform/db/pool.ts`/`migrate.ts`/`migrate-cli.ts` may import `pg`, and only `platform/db/tenant-context.ts` may open a transaction, so the single-tenant-context rule is an enforced boundary rather than a convention.

**20 fixtures** — 18 deliberately-violating (one or more per rule) and 2 control fixtures that must stay silent — verified by **26 conformance tests** (20 static, 6 against a real migrated PostgreSQL).

> *Correction:* the brief for this summary said 21 fixtures. The repository has 20 directories under `tools/conformance/fixtures/`.

The schema rules run twice over the same rule set: once by parsing migration SQL text, once by introspecting `information_schema`/`pg_catalog` on a really-migrated database, so a rule cannot pass statically while the live schema disagrees.

### Skeleton files created

`DECISION_LOG.md`, `PROVIDER_MATRIX.md`, `RISK_REGISTER.md`.

### Key Phase 0 decisions

| Decision | Choice | Why |
|---|---|---|
| Query builder (ADR-021) | **Kysely** | explicit transaction/session control for RLS with no codegen layer between call site and SQL |
| Transaction + RLS | **one helper**, `platform/db/tenant-context.ts` | `@singleton-role: tenant-context`; sets `app.tenant_id`/`app.user_id`/`app.store_id` transaction-locally; bypassing it fails CI |
| Database roles | **`nexora_migrate`** owns and migrates; **`nexora_app`** (`NOSUPERUSER`, `NOBYPASSRLS`, never an owner) is the only role the app and tests use | a table's owner bypasses RLS by default — confirmed empirically, which is why `FORCE ROW LEVEL SECURITY` is also mandatory and a runtime assertion refuses to run isolation tests under a role that could bypass |
| Migration naming | `<timestamp>_<module>__<description>.sql` | globally ordered across modules, self-identifying, collision-proof; enforced by the runner |
| Test runner | Vitest | ESM-first; the toolchain is esbuild-based |
| CI | GitHub Actions | starts PostgreSQL via compose, then typecheck → harness self-test → real-tree scan |

---

## 2. Phase 1, Task 1 — the golden path

**`GET /api/v1/stores/{storeId}`**, implemented as the reference every later slice mirrors.

All eleven ordered steps of `08_PHASE_1_BRIEF.md` §2 are present and tested:

| Steps | Where | Transaction |
|---|---|---|
| 1 authenticate against a server-side session | `SessionGuard` → `ValidateSessionService` | none (identity tables are not tenant-scoped) |
| 2–3 resolve membership, explicit `storeId`, store access check | `StoreAccessGuard` → `ResolveStoreAccessService` | short transaction, `app.user_id` only — this is what establishes which tenant may be trusted, so it cannot already run inside that tenant's context |
| 4 build trusted `TenantContext` | `StoreAccessGuard` | — |
| **5–8** transaction + RLS, authorize, execute, audit | `StoreController` → `CheckPermissionService`, `ReadStoreService` | **one transaction** |
| 9 stable error contract | `HttpExceptionFilter` | — |
| 10 structured logging | `requestContextMiddleware` + `loggingMiddleware` | — |
| 11 tests at every layer | see below | — |

**Modules:** `identity`, `tenant`, `authorization`, `audit`, `capability` — each following `03_TECHNICAL_BLUEPRINT.md` §2.1 (`contracts/`, `domain/`, `application/`, `infrastructure/`, `interfaces/`, `migrations/`).

**Tables: 11 of the 16 named in `08_PHASE_1_BRIEF.md` §4**, across **9 migrations** under `<timestamp>_<module>__` naming — `users`, `sessions`, `organizations`, `memberships`, `stores`, `store_memberships`, `roles`, `permissions`, `role_permissions`, `membership_roles`, `audit_events`. Nothing outside §4 was created.

**Tests: 64**, all passing — domain unit tests, application tests with fakes, capability policy tests, and 15 integration tests driving real HTTP against real PostgreSQL with RLS active. No mocked database anywhere.

**Harness: 26 conformance tests, zero violations, empty exceptions report.**

### Key findings from Task 1

| Finding | Resolution |
|---|---|
| **Pipeline transaction boundary** — permission authorization ran in its own transaction that committed before execution and audit began, making it a check against released state | **Fixed.** One transaction now spans steps 6–8; `PermissionGuard` deleted, guards reduced to steps 1–4 |
| **RLS exemptions** — six tables had been exempted on implementer authority | **Finalized by decision.** Reverted, surfaced as 16 harness violations, then re-applied as a recorded decision (§3) |
| **Audit placement** — `08` §2 and `03` §3.1 disagreed; inside one transaction a `FAILURE` audit is rolled back by the failure it records | **Option B agreed**, `08` §2 amended. Implementation deferred to Task 2 (§5) |
| **Test/production drift** — the integration test applied only `cookieParser()`, so `requestId` was undefined throughout and step 10 had no coverage at all | **Fixed at the root.** `apps/api/create-app.ts` is now the single composition used by both `main.ts` and the tests |
| **A table's owner bypasses RLS** by default, and `INSERT … RETURNING` re-checks the `USING` policy | Both confirmed empirically; drove role separation, mandatory `FORCE`, and client-generated ids for organization creation |
| **NestJS type-based DI fails silently under esbuild** (`emitDecoratorMetadata` is not emitted) | Explicit construction everywhere; also decisive for ADR-033 |

---

## 3. Decisions and amendments

### Six decisions taken (2026-08-22)

| # | Decision | Outcome |
|---|---|---|
| 1 | `sessions` tenancy | **Platform-global** — one user, many organizations, one live session |
| 2 | `roles`/`permissions`/`role_permissions` | **Platform-global** — Phase 1 core; capability keys are platform-defined |
| 3 | Self-access RLS clause | **Kept** on `memberships`/`store_memberships` only; removing it disables the system |
| 4 | Audit placement | **Option B** — separate connection, committed independently, written before the domain transaction resolves |
| 5 | OpenAPI artifacts | **ADR-033**, accepted; generate from Zod, CI drift check; Task 2 scope |
| 6 | Migration naming | `<timestamp>_<module>__<description>.sql`; all 9 renamed, convention enforced |

Neither `tenant_id` nor an RLS policy had to be removed for (1) or (2) — those columns were never added, so the change was confined to the harness exemption list.

### Three normative amendments made

1. **`08_PHASE_1_BRIEF.md` §5** — exemption list now names `sessions` and the platform-wide role catalog, with reasoning inline, and states explicitly that `membership_roles` is *not* exempt.
2. **`08_PHASE_1_BRIEF.md` §2 step 8** — audit is written before commit on a separate connection that commits independently, with the semantic that follows recorded (an audit event attests to an authorized *attempt*, `outcome` distinguishing success from failure).
3. **`03_TECHNICAL_BLUEPRINT.md` §2.1** — migration pattern corrected to `<timestamp>_<module>__<description>.sql`.

**ADR-033 accepted** and folded into `02_ADR_INDEX_NORMATIVE_DECISIONS.md` (index row + full body); the standalone proposal file was removed so there is one source of truth.

> *Citation note:* the instruction described the audit rule as "ADR-033 option B", but ADR-033 is the API schema ADR — the audit-placement options live in `DECISION_LOG.md`, which is what §2 now cites. `DECISION_LOG.md` is a working log and is **not** part of the precedence chain in `README_START_HERE.md`. If this rule should be normatively citable it needs its own ADR; flagged rather than assumed.

### Items still OPEN in `DECISION_LOG.md`

| Item | Note |
|---|---|
| `platform/` directory name | vs. `shared/`, `infra/`, or a `modules/platform/` pseudo-module; cheap to rename while nothing depends on the name |
| Redis in `docker-compose.yml` | omitted as unused; add when sessions/idempotency need it |
| `credentials` / `identity_providers` tenancy | same structural case as `sessions`, deliberately **not** pre-decided — the call belongs to the Task 2 slice that creates them |

Open risks in `RISK_REGISTER.md`: **R-001** (the Docker compose path itself is still unverified — a native PostgreSQL 17 install is the verification basis) and **R-003** (tenant isolation for the two membership tables depends on a `user_id`-keyed RLS clause; Task 2 re-evaluates a clause-free alternative).

---

## 4. Phase 1 exit criteria — current results

Against `08_PHASE_1_BRIEF.md` §6. **Six of nine met, one partial, two not met** — the outstanding ones are Task 2 and later work, not defects in the golden path.

| Criterion | Result |
|---|---|
| Tenant A cannot read/write/delete/execute against Tenant B data | ✅ RLS fail-closed, proven at the database level and through HTTP |
| A valid session with another tenant's `storeId` is denied | ✅ tested; `storeId` is a path parameter only, never derived from the token (ADR-002) |
| A query without tenant context returns zero rows **and** raises an application error | ✅ both halves tested separately |
| `store_memberships` checked independently of organization membership | ✅ both failure directions tested — a revoked org membership with a live store membership is denied, and vice versa |
| Sessions are server-side and revocable | ✅ opaque hashed token in an `httpOnly` cookie (ADR-029) |
| Every error path returns a documented `05` code | ✅ stable `{code, message, details, requestId}` envelope, asserted across failure paths |
| Integration tests run against real PostgreSQL | ✅ no mocks |
| Every capability emits an audit event | ⚠️ **partial** — true for `store.read` success; failure-path durability arrives with option B in Task 2 |
| Revoking a membership invalidates active sessions within one request | ❌ **not met** — needs `membership.revoke` (Task 2) |
| `Money` allocator test over randomized inputs | ❌ **not met** — `Money`/`currencies` deferred to the slice that first needs them |

---

## 5. Readiness for Task 2

**Schema ready:** 11 tables with RLS + `FORCE` where tenant-owned, role separation enforced, migration runner rejecting non-conforming filenames.

**Remaining `08_PHASE_1_BRIEF.md` §4 tables — 5 of 16:**

```text
credentials            → auth.login
identity_providers     → contract-ready extension point (ADR-029 item 7)
reserved_subdomains    → store.create slug validation (§5)
currencies             → the Money value object (§4, deliberately in Phase 1)
outbox_events          → when eventing starts
```

> **Correction — this matters.** The brief for this summary listed the pending tables as "credentials, identity_providers, plan, plan_version, price, subscription, invoice, payment_intent (per 08 §4)". **`plan`, `plan_version`, `price`, `subscription`, `invoice` and `payment_intent` are not in §4.** They are Phase 2 billing tables from `04_DATABASE_BLUEPRINT.md` §2.3/§2.5, and §4 says in terms: *"Do not create billing, commerce, domain, plugin, AI or MCP tables."* Writing them into a hand-off document would have authorized exactly what §4 forbids, so the correct five are listed above. Phase 2 opens after Phase 1's exit criteria are met (`06_IMPLEMENTATION_PLAN.md`).

**Golden path approved** ✅ — the pattern every Task 2 slice mirrors is fixed, hand-reviewed, and enforced by the harness.

**Task 2 order** (`08_PHASE_1_BRIEF.md` §3): `organization.create` → `membership.invite` → `membership.role.assign` → `store.create` → `auth.login`/`logout`/`logout_all` → `organization.switch`.

> *Correction:* the brief called `organization.create` "Task 2 step 2"; §3 lists it **first**.

**Carried into the first Task 2 slice:**
- audit placement option B becomes mandatory (`organization.create` and `store.create` audit reachable failures);
- `organization.create` must generate the organization id itself rather than relying on the column default with `RETURNING` (the `USING`-policy finding);
- ADR-033's generator and CI drift check;
- the `credentials`/`identity_providers` tenancy decision, when `auth.login` creates them.

---

## 6. Repository and CI status

```text
apps/api/          NestJS bootstrap + composition root; no business logic
  create-app.ts      the one middleware stack, shared by main.ts and tests
platform/          cross-cutting infrastructure only
  config.ts, clock.ts, db/{pool,kysely,migrate,discover-migrations,
                           tenant-context,assert-role-safety,ident}.ts
modules/           identity, tenant, authorization, audit, capability
  <module>/{contracts,domain,application,infrastructure,interfaces,migrations}
tools/conformance/ harness: rules/, fixtures/, lib/, run.ts
```

| Check | Status |
|---|---|
| `npm run typecheck` | ✅ clean (strict, `noUncheckedIndexedAccess`) |
| `npm test` | ✅ 64 passing across 9 files |
| `npm run conformance` | ✅ 0 violations, empty exceptions report |
| Full pipeline runtime | ~10s (ADR-030 requires under two minutes) |
| CI workflow | committed; **not yet executed** — the repository is local-only with no remote by instruction (R-001) |

**Last commit:** `9c53166`, 2026-08-22 06:04 — *"Normative amendments: RLS exemptions, audit placement, migration naming; accept ADR-033"*.

**Code freeze point:** Phase 1 golden path approved and frozen as the reference pattern. Task 2 may begin from `organization.create`.
