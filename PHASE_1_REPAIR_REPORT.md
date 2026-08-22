# Phase 1 Golden Path — Repair Report

**Date:** 2026-08-22
**Trigger:** an independent audit of commit `944e359` (the state after the previous review round) confirmed the repository's own claims — typecheck clean, 64/64 tests green, 9 migrations applied, conformance harness at 0 violations — and then found six defects the green build did not catch, all inside the golden path or the schema it depends on.
**Commits:** `e613bff`..`979bf3d` (five commits — items 1 and 2 share one commit, per instruction; six items total).
**Documents read for this task, and only these:** `AGENTS.md` (whole file), `08_PHASE_1_BRIEF.md` §2/§4/§5/§6, `DECISION_LOG.md`'s "Conflict: is the audit event inside the transaction..." and "Pipeline step 6 must share the transaction with steps 7-8" entries, `02_ADR_INDEX_NORMATIVE_DECISIONS.md` ADR-021 and ADR-029 only, `05_API_CAPABILITY_CONTRACTS.md` §7.
**Result:** all six items fixed. Typecheck clean, 74/74 tests passing (was 64, +10), conformance 0 violations, all 11 migrations (9 original + 2 new) apply cleanly from an empty database. No Task 2 slice started. No table outside `08_PHASE_1_BRIEF.md` §4. No exceptions.json entry added.

---

## Item 1 — Audit events must survive the transaction they describe

**Commit:** `68c2a29` (with item 2)

**What was wrong.** `StoreController` built the audit repository with `createAuditEventRepository(trx)` — the *same* transaction as the domain work (steps 6-7). Two consequences: a `FORBIDDEN` outcome (step 6, permission denial) was **invisible to the only code that wrote audit events**, since `ReadStoreService` — the sole caller of `AuditEventRepository.record()` — is constructed *after* the permission check succeeds, so a request that failed authorization never reached any audit-writing code at all. A `RESOURCE_NOT_FOUND` outcome fared no better: `ReadStoreService` wrote a `FAILURE` row and then threw, and the throw rolled back the transaction that row lived in.

This was worse than the "latent, because `store.read`'s not-found branch is unreachable" reasoning `DECISION_LOG.md` had previously recorded — that reasoning covered only the not-found branch. Permission denial is a second, independently reachable failure path with zero audit coverage, reachable through ordinary use (any user without the `store.read` permission on a store they can otherwise see).

**What changed.**
- `platform/db/connections.ts` (item 4) adds a second pool, `AUDIT_DB`, distinct from `APP_DB`.
- `modules/audit/contracts/audit.contract.ts` exports `recordAuditEventDurable(db, context, event)` — opens its own `withTenantContext()` transaction on whatever connection it's given and returns once that commits. A self-contained "write one event durably" primitive.
- `modules/tenant/application/read-store.service.ts` no longer writes audit at all. It does only step 7 (find the store, map to DTO, throw `RESOURCE_NOT_FOUND` if absent) — a single use case cannot see both step 6 and step 7, so audit moved to whichever layer *can* see both.
- `modules/tenant/interfaces/store.controller.ts` wraps the whole step 6+7 span (permission check, then execution) in one `try`/`catch`, capturing the outcome without letting the exception escape yet. It then calls `recordAuditEventDurable(auditDb, ...)` **exactly once**, on the separate `AUDIT_DB` pool, before returning the result or re-throwing. One audit event per capability attempt, not one per pipeline step — if step 6 fails, step 7 never runs, so there is only ever one outcome to record.

**Correction made mid-implementation**, recorded in `DECISION_LOG.md`: the domain transaction and the audit write cannot simply be nested one inside the other and still be "independent" in the sense that matters — the audit write must survive even if something *inside* the domain callback throws. The actual shape is try/catch around the whole `withTenantContext(appDb, ...)` call, not audit-inside-the-callback.

**Proof.** `apps/api/store-read.integration.spec.ts`:
- *"durably records a SUCCESS audit event for a successful read"* — a working request produces an `outcome: "SUCCESS"` row.
- *"durably records a FAILURE audit event when authorization fails"* — a `403 FORBIDDEN` request produces an `outcome: "FAILURE"` row, proven against real PostgreSQL, satisfying the acceptance criterion exactly.

**Deliberately not done.** The `RESOURCE_NOT_FOUND` path's durable-audit behavior is **not** exercised at the integration level. I attempted to seed a fixture for it (a `store_membership` pointing at a nonexistent store) and it fails on `store_memberships.store_id`'s foreign key to `stores(id)` — the branch is unreachable even for a test fixture, not merely unreachable through HTTP. It remains covered only at the unit level (`read-store.service.spec.ts` proves `ReadStoreService` itself throws `RESOURCE_NOT_FOUND`); the controller's audit-wrapping around that throw is structurally identical to the proven `FORBIDDEN` case (same `try`/`catch`, same `recordAuditEventDurable` call), so this is a coverage gap in form only.

---

## Item 2 — The test that locked in the wrong behaviour

**Commit:** `68c2a29` (with item 1, as instructed)

`apps/api/store-read.integration.spec.ts`'s *"writes no audit event when authorization fails"* asserted the *absence* of exactly the record item 1 now requires. It is replaced by *"durably records a FAILURE audit event when authorization fails..."* (see item 1). No separate change beyond that inversion.

---

## Item 3 — A 404 returned the error code `VALIDATION_ERROR`

**Commit:** `0d0d681`

**What was wrong.** `HttpExceptionFilter` mapped every NestJS-thrown `HttpException` to `VALIDATION_ERROR` while keeping its original HTTP status — so `GET /api/v1/stores` (no `storeId`) returned `404 {"code":"VALIDATION_ERROR", ...}`: status and code contradicting each other, and `RESOURCE_NOT_FOUND` (a documented `05_API_CAPABILITY_CONTRACTS.md` §7 code) could never be produced on this path regardless of the actual failure.

**What changed.** A `STATUS_TO_CODE` map translates the framework's own HTTP status onto the matching `CapabilityErrorCode` (400→`VALIDATION_ERROR`, 401→`AUTHENTICATION_REQUIRED`, 403→`FORBIDDEN`, 404→`RESOURCE_NOT_FOUND`, 409→`CONFLICT`). A status with no documented code falls through to the same no-leaked-detail `INTERNAL_ERROR`/500 path as a genuinely unexpected error, logging the real status server-side without exposing it or the framework's message in the response body.

**Verified empirically, not assumed:** I checked what this app's actual routing produces for "an unknown route" and "a wrong-method request" before writing the test, rather than guessing. Both come back as 404 — NestJS/Express have no built-in 405 behavior; an unmatched method on an existing route is treated the same as an unmatched route entirely. The test asserts whichever status is real and pins that the code always agrees with it, rather than hardcoding an assumption.

**Proof.** `apps/api/error-contract.integration.spec.ts` (3 tests): an unknown route now returns `RESOURCE_NOT_FOUND` (not `VALIDATION_ERROR`) at 404; a wrong-method request's code matches its real status; a forced unmapped status (418, which no current route can produce through normal traffic) proves the no-leak `INTERNAL_ERROR` branch directly against the filter, since nothing in this app's current routing exercises it naturally.

---

## Item 4 — Three connection pools, created at import time

**Commit:** `e613bff`

**What was wrong.** `modules/identity/interfaces/session.guard.ts`, `modules/tenant/interfaces/store-access.guard.ts` and `modules/tenant/interfaces/store.controller.ts` each called `createDb(loadDbConfig())` at module scope — three independent `pg.Pool` instances as a side effect of importing a module, multiplying with every guard/controller Task 2 adds.

**What changed.** `platform/db/connections.ts` defines two DI tokens (`APP_DB`, `AUDIT_DB` — `Symbol`s) and their factories, created once via `apps/api/app.module.ts`'s provider registration and injected with explicit `@Inject(TOKEN)`. The tokens live in `platform/`, not `apps/api/`: a module cannot import from `apps/api` without inverting the composition direction (`apps/api` composes modules; modules must not depend on `apps/api`) — I initially wrote them into `apps/api/db-providers.ts` and had to move them after checking the dependency-direction rule against `tools/conformance/rules/imports.ts`'s actual `locate()` logic.

Explicit tokens, not implicit type-based injection, because esbuild (which `tsx`/Vitest use to run this repository) does not implement `emitDecoratorMetadata` — confirmed in the previous review round (`DECISION_LOG.md`, "NestJS's type-based constructor DI silently fails..."). `@Inject(TOKEN)` doesn't need that metadata; `constructor(db: Kysely<Database>)` alone would silently resolve to `undefined`.

Two pools, not one: `APP_DB` serves the request pipeline; `AUDIT_DB` is dedicated to durable audit writes (item 1), on a connection independent of whatever domain transaction is open on `APP_DB`.

**Also in this item, per the instruction:**
- `apps/api/main.ts`'s `bootstrap()` had no `.catch()` — a startup failure (e.g. Postgres unreachable) surfaced only as an unhandled rejection. Now logs and `process.exit(1)`.
- No shutdown hooks existed — pools were never drained on restart/SIGTERM. `apps/api/database-lifecycle.provider.ts` (`OnApplicationShutdown`) destroys both pools; `app.enableShutdownHooks()` added to `main.ts` so the hook actually fires on an OS signal (it already fires on `app.close()`, which is how tests already shut down — verified this needed no change on the test side).

**Proof.** No new dedicated test — this item is exercised indirectly by every test that hits the HTTP surface at all, since a broken DI wire-up (the `Reflector` failure mode from the previous round) throws immediately on the first request. All 74 tests, including 15 through the golden path, pass with guards and the controller resolving their connections via `@Inject`.

---

## Item 5 — `organizations` RLS: `WITH CHECK (true)` also covered UPDATE

**Commit:** `b65c10a`

**What was wrong.** The single combined policy's `WITH CHECK (true)` was correct for INSERT — a brand-new organization has no pre-existing `tenant_id` to check against, since `tenant_id` is `GENERATED ALWAYS AS (id) STORED` — but `WITH CHECK` also governs UPDATE under a `FOR ALL` policy, so any row that passed `USING` (i.e., any row in the caller's own tenant) could be updated with zero additional validation. The exposure was narrow only because `tenant_id` cannot itself be changed by an UPDATE; the concern was the *pattern*, since `organization.create` (Task 2's first slice) touches exactly this policy next.

**What changed.** New migration (forward-only — the original cannot be edited): `modules/tenant/migrations/20260822100000_tenant__split_organizations_rls_policies.sql` drops the single policy and replaces it with four, one per command — INSERT keeps `WITH CHECK (true)` unchanged; SELECT and DELETE keep the original `USING`; UPDATE gets both `USING` and a real `WITH CHECK` matching it.

**Proof.** `modules/tenant/infrastructure/organizations-rls.spec.ts` (4 tests): `pg_policy` introspection confirms UPDATE's `polwithcheck` is no longer the literal string `"true"`; INSERT still succeeds with no pre-existing tenant context (regression check); a cross-tenant UPDATE affects zero rows of another organization; a same-tenant UPDATE persists.

**Deliberately not done / honestly limited.** I cannot force an actual `WITH CHECK` *violation* for this table specifically — since `tenant_id` is generated and no other column is currently tenant-sensitive, there is no UPDATE that a same-tenant caller could issue that would fail the new check. The test proves the policy is structurally real (not `true`) and behaviorally correct for every case reachable today; it does not (cannot) prove a rejection, because none exists to trigger. This is the intended, narrow state of the fix — the value is in the *pattern* being correct for Task 2's tables that won't have a generated column to fall back on.

---

## Item 6 — `audit_events` was append-only by convention only

**Commit:** `979bf3d`

**What was wrong.** `04_DATABASE_BLUEPRINT.md` §1 requires audit and ledger records to be append-only. The original migration's own comment said this was "enforced by convention... only INSERT is used by application code" — `nexora_app` held UPDATE and DELETE on `audit_events` via the blanket `ALTER DEFAULT PRIVILEGES` in `platform/db/init/001_roles.sql`, identical to every other table, with nothing in the database actually preventing either.

**What changed.** New migration: `modules/audit/migrations/20260822100100_audit__enforce_append_only.sql` runs `REVOKE UPDATE, DELETE ON audit_events FROM nexora_app`. Scoped to this one table deliberately — this does not change the default-privileges pattern itself, so it does not affect what any *future* table gets by default; each ledger-shaped table Phase 2 adds (usage, payment) needs the same treatment in its own creating migration.

**Evaluated per the instruction** ("add `ALTER DEFAULT PRIVILEGES` handling if the grant pattern would re-grant it"): it would not. `ALTER DEFAULT PRIVILEGES` only affects objects created *after* it runs; it does not retroactively re-grant anything on an existing table, and `audit_events` is never dropped and recreated (migrations are forward-only, ADR-021 item 8). No change to `001_roles.sql` was made.

**Proof.** `modules/audit/infrastructure/audit-events-append-only.spec.ts` (3 tests): an UPDATE from `nexora_app` is rejected with a real `permission denied` error (not merely "application code doesn't call this"); a DELETE is likewise rejected; INSERT and SELECT still work (regression check).

---

## Cross-cutting notes

- **No conformance rule was weakened and no `exceptions.json` entry was added.** `exceptions.json` remains `[]`. The harness's `SCHEMA-MISSING-RLS` check continued to pass through item 5's four-policy split without modification (it only checks that a policy exists for the table, not how many).
- **A pre-existing, unrelated type-looseness was found and worked around, not fixed:** `OrganizationsTable`'s `status` column (and every other table's) is typed as required-on-insert despite having a database `DEFAULT`, because it isn't wrapped in `ColumnType<..., T | undefined, ...>`. This blocked `organizations-rls.spec.ts`'s inserts at typecheck; I supplied `status: "ACTIVE"` explicitly (matching the existing convention in `apps/api/test-support/seed.ts`) rather than touching the shared table-type definitions, which would be a change outside this task's six items and would touch every module's `*.tables.ts` file — exactly the "broad refactor" the instruction rules out. Left as-is; worth a follow-up if it causes friction again.
- **Migration filenames:** the two new migrations follow `<timestamp>_<module>__<description>.sql`, matching the convention `platform/db/discover-migrations.ts` already enforces (confirmed by construction — a misnamed file fails the runner with an explicit error, per the previous review round).
- **Definition-of-done order run in full, in the specified sequence, before every commit and again at the end:** `npm run typecheck` → `npm test` → `npm run conformance` → `npm run db:migrate` (against a database reset to empty, to prove all 11 migrations apply cleanly together, not just individually as each was added).

## Test count

| | Before | After | Δ |
|---|---|---|---|
| Test files | 9 | 12 | +3 (`error-contract.integration.spec.ts`, `organizations-rls.spec.ts`, `audit-events-append-only.spec.ts`) |
| Tests | 64 | 74 | +10 |
| Conformance violations | 0 | 0 | — |
| Migrations | 9 | 11 | +2 |

The golden path is re-frozen as of `979bf3d`. Task 2 was not started.
