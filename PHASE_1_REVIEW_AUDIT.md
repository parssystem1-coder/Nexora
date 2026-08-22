# Phase 1 Re-Audit (Task 1 / golden path)

**Date:** 2026-08-22
**Trigger:** review instruction to re-audit the golden path against `08_PHASE_1_BRIEF.md` §§2/4/5/6, `AGENTS.md` §§4/7/8, and `03_TECHNICAL_BLUEPRINT.md` §2.1 — looking for deviation, not confirmation.
**Scope audited:** 9 migrations, modules `identity`/`tenant`/`authorization`/`audit`/`capability`, the request pipeline, tests, conformance harness.

Documents deliberately not loaded, per instruction: `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, ADR-011–ADR-018, any Phase 2+ document.

---

## 1. Summary of what changed as a result of this audit

| # | Finding | Action taken |
|---|---|---|
| B1 | Permission authorization ran in its own transaction, separate from execution and audit | **Fixed** — one transaction now spans steps 6–8 |
| B2 | RLS exemptions for `sessions` + role catalog were my decision, not the decider's | **Reverted** — harness now red, decisions returned to OPEN |
| B3 | Steps 9–10 existed in production code but no test ever exercised them | **Fixed** — test and production now share one composition root; 4 new tests |
| A-1 | Golden-path use case had no application-layer spec | **Fixed** — `read-store.service.spec.ts` added |
| A-2 | `<capability>.capability.ts` (§2.1) missing; permission was a hardcoded string | **Fixed** — `store-read.capability.ts` added |

Remaining findings are listed in §4 and are **not** fixed — several are Task 2 scope, and two are decisions that are not mine to make.

---

## 2. Part B — the three items raised in review

### B1. Pipeline ordering: transaction boundary — CONFIRMED DEVIATION, FIXED

**The precise answer to "which connection and which context does `store-access.guard.ts` read `store_memberships` with":**

It reads over the `appDb` connection — the `nexora_app` role (`NOSUPERUSER`, `NOBYPASSRLS`, not the tables' owner, with `FORCE ROW LEVEL SECURITY` enabled on every tenant-owned table) — *inside* `withTenantContext()`, with `app.user_id` set and `app.tenant_id`/`app.store_id` deliberately empty.

**So it is not an RLS bypass.** RLS was enabled and evaluated for that read; the row matched through the self-access clause in the `store_memberships` policy (`tenant_id = app.tenant_id OR user_id = app.user_id`), not by evading a policy. A role that could bypass RLS would have failed `platform/db/assert-role-safety.ts`, which runs in the test suite.

**But the transaction boundary was genuinely wrong.** Three separate transactions existed where the brief requires one:

| Step (08 §2) | Before | After |
|---|---|---|
| 1 authenticate | `appDb`, no transaction | unchanged |
| 2–3 resolve membership + store access | transaction A | transaction A |
| **6 permission authorization** | **transaction B** | **transaction C** |
| 7 execute + 8 audit | transaction C | transaction C |

Steps 2–3 sitting before the transaction is per spec — `08_PHASE_1_BRIEF.md` §2 places them ahead of step 5 deliberately, since they are what establishes which tenant may be trusted. The defect was step 6 committing and releasing before steps 7–8 began, which `03_TECHNICAL_BLUEPRINT.md` §3.1 also contradicts (`Open Transaction → … → Authorize Permission → … → Execute → Commit → Audit`).

Why it mattered: a permission checked in an already-committed transaction is a check against released state — a concurrent role revocation between the two transactions would let the read proceed on stale authorization. The same argument applies to the audit row.

**Fix:** `PermissionGuard` and `@RequirePermission` deleted; `StoreController` opens exactly one transaction and runs steps 6, 7, 8 inside it. Guards now cover only steps 1–4. Required permissions come from `store-read.capability.ts`, not a string literal. Logged in `DECISION_LOG.md`. NestJS did not prevent this — guards were simply the wrong home for a step the brief places after the transaction opens.

**New conflict surfaced while fixing this** (logged OPEN, not decided): `08 §2` implies audit is inside the transaction; `03 §3.1` explicitly places it *after* commit. This is not academic — `ReadStoreService` writes a `FAILURE` audit row then throws, so inside one transaction that audit row is rolled back by the very failure it records, contradicting §6's "every capability in scope emits an audit event". For `store.read` the branch is currently unreachable (a `store_memberships` row implies the store exists via FK), so the defect is latent — but it goes live with the first Task 2 capability that audits a failure.

### B2. RLS exemptions — CONFIRMED OVERREACH, REVERTED

Correct on both counts. `08_PHASE_1_BRIEF.md` §5 exempts exactly `users`, `currencies`, `reserved_subdomains`. I had widened `TENANT_EXEMPT` to also cover `sessions`, `credentials`, `identity_providers`, `roles`, `permissions`, `role_permissions` — six additional tables — and marked one of those entries RESOLVED on my own authority. Widening a normative exemption list is a documentation amendment, and marking an entry OPEN does not license shipping the recommended option meanwhile.

**Reverted:** `TENANT_EXEMPT` in `tools/conformance/rules/schema.ts` and `schema-live.ts` now contains exactly §5's three tables (`schema_migrations` remains excluded in the live checker as the migration runner's own bookkeeping table, not as a tenancy exemption).

**Consequence — the harness is now RED, deliberately:** 16 violations (8 distinct, each caught twice by the static and live checkers) across `sessions`, `roles`, `permissions`, `role_permissions`. This is the honest state: the schema deviates from §5 and the deviation is now mechanically visible instead of being sanctioned by a rule I widened myself.

Migrations were deliberately **not** rewritten either, because adding `tenant_id`/RLS to those tables is the competing option and equally your call. Both entries are OPEN in `DECISION_LOG.md` with options A/B/C and a recommendation. Nothing further will be implemented until you decide.

**One more of the same class, which you did not name:** the self-access clause (`… OR user_id = current_setting('app.user_id')`) on `memberships` and `store_memberships`. Same category of call, so it is now flagged OPEN too. It is **not** reverted, because unlike the other two it is load-bearing: with a plain `tenant_id`-only policy, steps 2–3 return zero rows and `store.read` returns `STORE_ACCESS_DENIED` for every request — backing it out leaves a non-functional system, not a more-conformant one, so it needs a replacement design in the same change. Options are in the log; it interacts with the `sessions` decision and the two are best decided together.

### B3. Steps 10 and 9 — PARTIAL, NOW COMPLETE

Both existed in production code before this audit — `apps/api/request-context.middleware.ts`, `apps/api/logging.middleware.ts`, `modules/capability/interfaces/http-exception.filter.ts` — and were wired in `main.ts`. You were right that they were absent from my summary, and the audit found a worse problem behind that:

**The integration test applied only `cookieParser()`, not the middleware.** So the test suite exercised a different middleware stack than the one that ships: `requestId`/`correlationId` were `undefined` throughout every test, `audit_events.request_id` was written as `""`, and step 10 had no test coverage at all. Tests were passing against a stack that did not exist in production.

**Fixed at the root**, not by patching the test: `apps/api/create-app.ts` is now the single definition of how the app is assembled, used by both `main.ts` and the integration test, so the two cannot drift again. Four tests added:
- the stable envelope (`code`, `message`, `requestId`) on three distinct failure paths;
- a real `requestId` and a caller-supplied `x-correlation-id` reaching `audit_events` (proving the empty-string bug is gone);
- exactly one structured log line per request carrying `requestId`, `correlationId`, `tenantId`, method, path, status;
- no audit event written when authorization fails.

`tenantId` is `null` in log lines for pre-authorization failures (401/400/403-at-store-access). That is correct — the tenant is not yet verified at that point, and logging an unverified tenant id would be worse than logging none.

---

## 3. Part A — full re-audit findings

### 3.1 `08_PHASE_1_BRIEF.md` §2 — the eleven ordered steps

| Step | Status | Note |
|---|---|---|
| 1 authenticate against server-side session | MATCH | `SessionGuard` → `ValidateSessionService`; opaque hashed cookie token (ADR-029 §3) |
| 2 resolve user, org membership, explicit `storeId` | MATCH | `storeId` from the path, validated by zod |
| 3 store access check, server-side | MATCH | `store_memberships` **and** `memberships` checked independently, both directions tested |
| 4 trusted `TenantContext` | MATCH | built only from server-verified values |
| 5 transaction + RLS via single helper | MATCH | `withTenantContext()`, the sole `@singleton-role: tenant-context` |
| 6 permission authorization | MATCH *(was CONFLICT)* | fixed under B1; now inside the transaction |
| 7 application service + domain mapping | MATCH | `ReadStoreService`, entity → DTO |
| 8 audit event | PARTIAL | emitted and tested, but placement is the OPEN 08-vs-03 conflict above |
| 9 stable error contract | MATCH *(was PARTIAL)* | now tested across three failure paths |
| 10 structured logging | MATCH *(was PARTIAL)* | now tested; was untested before this audit |
| 11 tests at every layer incl. RLS-zero-rows | MATCH | see §3.4 |

### 3.2 `08_PHASE_1_BRIEF.md` §4 (tables) and §5 (non-negotiables)

| Rule | Status | Note |
|---|---|---|
| Only §4 tables created | MATCH | 11 of the ~16 created; 5 deferred to the slice that needs them; nothing outside §4 |
| Every non-exempt table has `tenant_id` + RLS in its creating migration | **CONFLICT** | 4 tables deviate — the OPEN B2 decisions; harness now reports it |
| RLS fails closed | MATCH | proven at DB level and application level |
| App role cannot bypass RLS | MATCH | `assert-role-safety.ts` asserts non-superuser, non-`BYPASSRLS`, non-owner |
| `store_memberships` checked for every store-scoped read | MATCH | independent check, both failure directions tested |
| `storeId` always explicit, never inferred | MATCH | path param only; cross-tenant test proves the token grants nothing |
| Store slug rejects `reserved_subdomains` | N/A | `store.create` is Task 2 |
| One use case per file; controllers no business logic | MATCH | controller body is composition; no business branch |
| No `domain` file imports query builder/driver/NestJS/React/SDK | MATCH | enforced by `FORBIDDEN-IMPORT-DOMAIN`, harness green on that rule |
| Sessions invalidate on password/membership/role change | **MISSING** | Task 2 — see §3.3 |
| No storefront customer identity | MATCH | none created |

### 3.3 `AGENTS.md` §4 (prohibitions) and §7 (definition of done)

Hard prohibitions: no violations found. Specifically checked — no business logic in the controller; no module reaching another module's repository (only `contracts/`); no module-local idempotency; no plaintext secrets; no float money (no money at all yet); `storeId` never derived from the token; no broad refactor bundled into this work.

Definition of done, unmet items:

| Item | Status | Note |
|---|---|---|
| Generated schema artifacts (OpenAPI/JSON Schema) | **MISSING** | `05_API_CAPABILITY_CONTRACTS.md` §1 and §8 require these generated from code, committed, with a CI drift check. Not built. Affects every capability, so worth deciding the approach once, before Task 2 multiplies it. |
| Entitlement / quota / approval | N/A Phase 1 | Phase 2 machinery; deliberately not stubbed |
| Idempotency | N/A | `store.read` is a READ (`05` §4.1: idempotency "no") |
| Events / outbox | N/A Phase 1 | `outbox_events` deferred with the slice that emits |

One deviation worth naming: `modules/audit/contracts/audit.contract.ts` imports Kysely types, so a module's public contract surface leaks the query builder. It is deliberate and logged (it lets a caller pass its own `trx` for a same-transaction audit write without importing audit's concrete class), and no rule currently forbids it — but it is the only contract that does this, and if the audit-placement conflict resolves toward audit-after-commit, the reason for it disappears and it should be removed.

### 3.4 `AGENTS.md` §8 — test layering

| Rule lives in | Required test | Status |
|---|---|---|
| Domain invariant | domain unit test | MATCH — `session.entity.spec.ts` (4) |
| Use case orchestration / transaction | application test | MATCH *(was MISSING)* — `read-store.service.spec.ts` added (4), plus `resolve-store-access` (4), `validate-session` (4) |
| Permission / entitlement / quota | capability policy test | PARTIAL — `check-permission.service.spec.ts` (2) + end-to-end FORBIDDEN path; entitlement/quota N/A in Phase 1 |
| Tenant isolation, RLS | integration test against real PostgreSQL | MATCH — `store-read.integration.spec.ts` (15) + `tenant-context.spec.ts` (5), real PostgreSQL, no mocks |
| HTTP contract, error codes | interface contract test | MATCH *(was PARTIAL)* — envelope + codes now asserted |
| Architecture boundary | CI conformance test | MATCH — 26 harness self-tests |

**64 tests, all passing.**

### 3.5 `03_TECHNICAL_BLUEPRINT.md` §2.1 — file conventions

| Convention | Status | Note |
|---|---|---|
| `contracts/<module>.contract.ts` + `index.ts` | MATCH | all five modules |
| `domain/<aggregate>.entity.ts`, `.vo.ts`, `.repository.ts` | MATCH | interfaces only in domain; no implementations |
| `domain/<aggregate>.invariants.ts` | PARTIAL | none exist; the only invariant so far (`Session.isValid`) lives on the entity. Defensible now, but the convention exists so richer aggregates do not accrete rules inside entities — worth honouring from the first aggregate that has more than one rule |
| `domain/<aggregate>.errors.ts` | PARTIAL | no per-module error files; all codes are centralised in `modules/capability/domain/capability.errors.ts`. Deliberate (one stable taxonomy per `05` §7 rather than per-module dialects) but it is a documented deviation from §2.1 |
| `application/<use-case>.service.ts` + `.input.ts` + `.spec.ts` | MATCH *(was PARTIAL)* | every use case now has a spec |
| `infrastructure/<aggregate>.repository.pg.ts` | MATCH | |
| `infrastructure/<aggregate>.mapper.ts` | PARTIAL | row→entity mapping is inline in repositories. Fine at this size; extract when a mapper is non-trivial or shared |
| `interfaces/<resource>.controller.ts` | MATCH | thin |
| `interfaces/<capability>.capability.ts` | MATCH *(was MISSING)* | added this audit |
| `migrations/<timestamp>__<description>.sql` | **PARTIAL** | I used sequential `0001__`, `0002__`, not timestamps. Works today because `discover-migrations.ts` sorts by `<filename>__<module>`, but sequence numbers collide across modules the moment two modules both add an `0005__` — timestamps exist precisely to avoid that. Recommend switching before Task 2 adds more migrations; a rename is cheap now and expensive after any environment has applied them (the filename is the tracking key in `schema_migrations`) |

### 3.6 `08_PHASE_1_BRIEF.md` §6 — exit criteria

| Criterion | Status |
|---|---|
| Tenant A cannot reach Tenant B data | MATCH — RLS + cross-tenant test |
| Valid session + other tenant's `storeId` denied | MATCH — tested |
| Query without tenant context → zero rows **and** an application error | MATCH — both halves tested separately |
| Revoking a membership invalidates sessions within one request | **MISSING** — Task 2 (`membership.revoke`); no mechanism yet |
| Every capability emits an audit event | PARTIAL — true for `store.read` success; failure-path audit is the OPEN 08-vs-03 conflict |
| Every error path returns a documented `05` code | MATCH |
| Conformance harness green, exceptions empty or justified | **RED (deliberate)** — 16 violations from the B2 revert, pending your decision |
| Integration tests against real PostgreSQL | MATCH — no mocked database anywhere |
| `Money` allocator test | **MISSING** — `Money`/`currencies` deferred; Phase 1 exit blocker, not a Task 1 blocker |

---

## 4. Open decisions — yours, not mine

1. **`sessions` tenancy** (`DECISION_LOG.md`) — literal §5, amend §5, or split. Harness red until decided.
2. **Role catalog tenancy** (`DECISION_LOG.md`) — tenant-owned, amend §5, or split `permissions` from `roles`. Harness red until decided.
3. **Self-access RLS clause** — keep, `SECURITY DEFINER`, or give sessions an authoritative tenant. Couples to (1).
4. **Audit inside transaction vs after commit** — `08` §2 and `03` §3.1 disagree; latent for `store.read`, live in Task 2.
5. **Generated OpenAPI artifacts** — required by `05` §1/§8; approach undecided; cheapest to settle before Task 2.
6. **Migration filename convention** — `0001__` vs `<timestamp>__`; cheap to change now.

No Task 2 slice was started. No table outside `08_PHASE_1_BRIEF.md` §4 was created. No unrelated refactor was bundled into this work.
