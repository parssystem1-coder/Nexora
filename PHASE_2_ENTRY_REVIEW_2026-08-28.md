# Phase 2 Entry Review — 2026-08-28

Scope, stated by the requester and preserved here: this is an **entry review for Phase 2**, not a re-run of the Phase 1 exit gate. The Phase 1 gate is OPEN (`PHASE_1_GATE_OPEN_2026-08-27.md`) and this document does not reopen it. It verifies independently — against live code, a live database, and `git log` — whether the seven pre-Phase-2 sessions (context-cost split; build path + `.env`; dist devDependency guard; HTTP hardening + `/health`; shared rate limiter; audit-failure signal + `AUDIT_DB` seam; concurrency error mapping + five closing decisions) actually left the nine Phase 1 exit criteria standing, whether `RISK_REGISTER.md` and `PHASE_1_DEBT_CLOSURE.md` are honest, and what — if anything — blocks Phase 2 item 1. No code was changed to produce this review.

## 1. Verdict

**Phase 2 item 1 ("plan and plan version") can start now.** All nine Phase 1 exit criteria still hold, verified directly against a from-empty migration and a fresh test/conformance run, not inherited from any prior session's report. `RISK_REGISTER.md` and `PHASE_1_DEBT_CLOSURE.md` are both honest: every sampled row/item matches the code exactly, and nothing is marked CLOSED that isn't. `CLAUDE.md`'s risk roll-call — checked as its own claim, not assumed — is also fully accurate against the register's actual 13 status words. One real, moderate finding survives verification (the RLS bypass-safety assertion is wired into one narrow spec file, not into the two suites making the broadest cross-tenant claims) and is recorded below; it does not block Phase 2 item 1, which touches none of that machinery.

## 2. Evidence

Run against a scratch database (`nexora_phase2_gate_check`, owned by `nexora_migrate`, grants mirroring `platform/db/init/001_roles.sql`) created fresh for this review, so migrations and tests were proven from empty state exactly as CI does with a disposable volume — not against the long-lived dev database used for day-to-day work.

| Check | Result |
|---|---|
| `npm run db:migrate` from empty | 20/20 migrations applied cleanly |
| `npx vitest run` | 42 files, 401 tests, all passing |
| `npm run conformance` | PASS, 0 violations |
| `exceptions.json` | `[]` — empty, nothing to justify |
| Live `\dt` on the fresh DB | 15 relations: 14 domain tables + `schema_migrations`; every domain table is on `08_PHASE_1_BRIEF.md` §4's allowed list; `identity_providers` and `outbox_events` correctly absent (D-5, CLOSED as a deliberate non-build decision, not silently missing) |
| `pg_class` on the 6 tenant-owned tables (`organizations`, `memberships`, `membership_roles`, `stores`, `store_memberships`, `audit_events`) | `relrowsecurity = t` and `relforcerowsecurity = t` on all 6, live, not read from migration SQL text |
| `pg_policies` | a policy present on all 6 (9 policies total — `organizations` and `memberships`/`store_memberships` split their policy per operation/access pattern) |
| Empirical RLS proof (`organizations`, raw `psql`, both `nexora_app` and the owning `nexora_migrate` role) | no `app.tenant_id` → 0 rows; wrong tenant → 0 rows; correct tenant → 1 row. `nexora_migrate` (the table owner) gets 0 rows with no context too — `FORCE ROW LEVEL SECURITY` applying even to the owner, confirmed live, not assumed from the SQL |
| CI, current HEAD (`57beff2`) | run `33132131516`, actually executed and green — not a workflow file that has never run |
| `npm run graph -- --since fbc7ba4` (the commit the Phase 1 gate confirmed CI green on) | no new tables, capabilities, or routes since the gate opened; only the D-3 extraction changed an internal dependency edge (all ten controllers → `runCapabilityAttempt`) |

## 3. Exit criteria — still holding after the seven sessions

| # | Criterion | Status | Proving test |
|---|---|---|---|
| 1 | Tenant A cannot read/write/delete/execute Tenant B data | MET | `apps/api/tenant-isolation-rls.spec.ts` (live PostgreSQL, cross-tenant), plus live `psql` reproduction above |
| 2 | A valid session with a `storeId` belonging to another tenant is denied | MET | `StoreAccessGuard`'s existing suite (`08_PHASE_1_BRIEF.md` §5's "checked for every store-scoped read" rule); untouched by any of the seven sessions |
| 3 | A query without tenant context returns zero rows and raises an error | MET | Proven both by construction (`FORCE ROW LEVEL SECURITY` + fail-closed policy) and empirically, live, above |
| 4 | Revoking a membership invalidates active sessions within one request | MET | `apps/api/membership-revoke.integration.spec.ts:131-142`, named explicitly in its own title: *"revokes the target's session, so their existing cookie stops authenticating on the very next request (exit criterion 4)"* — asserts session status flips to `REVOKED` and the very next request with that cookie returns 401/`AUTHENTICATION_REQUIRED` |
| 5 | Every capability in scope emits an audit event | MET | All 10 real capability controllers call `runCapabilityAttempt` (grep-confirmed, 10/10); `/health` correctly excluded (not a capability). 11 integration spec files assert against `audit_events` rows directly |
| 6 | Every error path returns a documented code from `05` | MET | Conformance harness, 0 violations, against the fresh DB. The two codes added since the gate opened are each traced to a real, real-PostgreSQL-driven test: `CONCURRENCY_CONFLICT` → `apps/api/concurrency-conflict.integration.spec.ts` (induces a genuine `40P01` deadlock via two manually-interleaved transactions, confirms the driver error code before trusting the HTTP mapping); `RATE_LIMITED` → `apps/api/auth-login-rate-limit.integration.spec.ts:104` |
| 7 | Conformance harness green, exceptions empty/justified | MET | 0 violations, `exceptions.json` is `[]` |
| 8 | Integration tests run against real PostgreSQL, not mocks | MET | Every `apps/api/*.integration.spec.ts` and the two `*-rls.spec.ts` files run against the real scratch/dev database. The one stubbed `Kysely` object in the whole repository (`modules/capability/interfaces/capability-attempt.spec.ts`'s `auditDbThatThrows`) is a unit test of `runCapabilityAttempt`'s own control flow when a write throws (R-009/R-010) — an application-layer test of orchestration logic, correctly placed per `AGENTS.md` §8's layering table, not one of the tenant-isolation-proving suites this criterion is about |
| 9 | `Money` allocator test proves parts sum to the whole over randomized inputs | MET | `modules/money/domain/money.vo.spec.ts:144-145`, *"always produces parts that sum to exactly the original whole, fairly distributed"*, plus a second property test at line 202 for adversarial (not just random) weight vectors. File untouched by any of the seven sessions |

No criterion was weakened. The two criteria most plausibly at risk from the seven sessions' own subject matter — 5 (new `runCapabilityAttempt` audit path) and 6 (two new error codes) — were the two checked most directly here, not assumed covered by green CI.

## 4. Findings

### Finding 1 — RLS bypass-safety assertion is not wired into the suites making the broadest claim (moderate; test-layering gap, not a live vulnerability)

`platform/db/assert-role-safety.ts`'s `assertRoleCannotBypassRls` — the function `08_PHASE_1_BRIEF.md` §5's "the application database role cannot bypass RLS" rule and `RISK_REGISTER.md` R-002 depend on — is called from exactly two places, both inside `platform/db/tenant-context.spec.ts`, against one hardcoded table. It is **not** called from `apps/api/tenant-isolation-rls.spec.ts` (the broad, live-`pg_class`-driven cross-tenant proof suite) or from `modules/tenant/infrastructure/organizations-rls.spec.ts` — the two suites that make this repository's strongest tenant-isolation claims.

Today this is harmless: every test in the run connects through the same `DATABASE_URL`, so `tenant-context.spec.ts` passing transitively proves the connected role is safe for the whole suite. But the wiring is fragile, not structural — nothing stops a future test file, or a future CI job splitting suites across different database roles or connection strings, from running the cross-tenant proof suites without ever exercising this assertion. Per the skill's own step 2 ("confirm it is actually wired into the isolation tests" — plural, and by name the ones proving isolation, not an adjacent unit test), this is a **PARTIAL**, not a full MET, on that specific check.

No file:line fix is prescribed here per the review's own "do not fix anything" instruction; the concrete remedy, when picked up, is a one-line call to `assertRoleCannotBypassRls` added to `apps/api/tenant-isolation-rls.spec.ts`'s and `organizations-rls.spec.ts`'s own setup.

### Finding 2 — the review's own framing undercounted structural change since the gate opened (observation, not a defect)

The task named seven pre-Phase-2 sessions. `git log fbc7ba4..HEAD` on the shared files these sessions touch shows three more landed in the same window and are not in that list: D-3 (`runCapabilityAttempt` extraction + R-009 fix, `30be5bd`/`6a57f50`), D-4 (ESLint + Prettier, `311d184`/`7746c63`/`cfd13f3`), and D-6 (R-008 investigation, `d5e1de0`). None of these weakened an exit criterion — D-3 was checked directly against the golden path in §5 below and found consistent; D-4 is tooling-only and its own closure documents a before/after zero-behavior-change proof; D-6 is investigation-only, changed no production code. Recorded because the honest answer to "how much changed since 2026-08-27" is more than the task's own enumeration named, and a future review should count from `git log`, not from a session list someone remembers.

### Verified, not findings — stated because an absence of defects is itself information

- **`CLAUDE.md`'s `RISK_REGISTER.md` roll-call is accurate.** Read all 13 rows' actual Status column values directly and compared word-for-word: CLOSED (R-001, R-007, R-009), RESOLVED (R-002), ACCEPTED (R-003), PARTIALLY CLOSED (R-005), OPEN (R-004, R-006, R-008, R-010, R-011, R-012, R-013) — every one matches `CLAUDE.md` line 21 exactly, including the parenthetical detail on each OPEN row. No drift found.
- **The golden path is unchanged in substance.** `store.controller.ts` was touched once since the gate opened, by the D-3 extraction, and remains internally consistent with its own doc comment and `AGENTS.md` §2 — it explicitly states it is not Phase 5's capability registry, matching the boundary `AGENTS.md` §2 itself now documents.
- **`RISK_REGISTER.md` and `PHASE_1_DEBT_CLOSURE.md` are honest on substance.** Every row/item sampled against the actual code matched precisely: R-006's five `CheckPermissionService.assert` call sites all pass the caller's own resolved membership id, never a path-supplied target (re-confirmed fresh, not inherited); R-013's `sweepExpired` really does walk the full map unconditionally; R-005/R-010's `AUDIT_DB` seam (`loadAuditDbConfig`'s fallback chain, `createAuditDb`) matches exactly as described; D-3's "all ten controllers" and D-5's "no `outbox_events`/`identity_providers` migration exists" both check out by direct grep; nothing marked CLOSED lacks the commit or decision-log entry it claims.
- **A known, already-resolved documentation quirk, re-confirmed rather than re-discovered:** `PHASE_1_DEBT_CLOSURE.md`'s and `RISK_REGISTER.md`'s dated closures for D-1/D-2/D-3/D-4/D-6 and R-008's later occurrences carry dates (2026-08-29 through 2026-09-02) that never occurred — every underlying commit lands on 2026-08-27. This was caught and recorded by a prior session (`decisions/2026-08.md`, "2026-08-27 — Date-integrity check"), which correctly declined to edit the historical documents (per this project's own no-rewrite convention for dated records) and fixed the process going forward. Checked here whether that fix held: every decision-log and register entry dated after that check (2026-08-28, matching commits `800ebbd` through `57beff2`) uses the real system date. It held.

## 5. Next-phase prerequisites — Phase 2 item 1 ("plan and plan version")

- **Schema is already specified, not open.** `04_DATABASE_BLUEPRINT.md:59-79` names `plan_versions` and its relationship to `price_version_id`; `05_API_CAPABILITY_CONTRACTS.md:87-91` names `plan.list`/`plan.subscribe`/`plan.change*` with their scope and write class; ADR-025 (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:1057-1126`) governs plan-version pinning and immutability. There is no open design ambiguity blocking a first slice — this is a real, met prerequisite, not a gap.
- **Golden path and shared pipeline are current and usable.** `store.controller.ts` + `runCapabilityAttempt` (D-3, CLOSED) are exactly what a `plan.*` controller should mirror.
- **Money value object exists** (`modules/money/`, Phase 1, untouched, 401-test-suite-covered) — needed once `price_version_id` pricing is wired, not blocking `plan` itself, which per the schema is name/feature/version data.
- **Calendar/timezone helpers exist** (D-1, CLOSED, `modules/calendar/`) — available if plan-version effective-dating needs calendar-boundary arithmetic; not confirmed required by item 1's own scope, named here as available rather than as a blocker.
- **Not a prerequisite, correctly sequenced already:** the shared idempotency service (ADR-009) is Phase 2 item **3**, after plan (1) and price (2). Nothing about a plan/plan-version write needs idempotency before item 3 is reached — re-confirms the prior session's own reasoning on this exact question rather than reopening it.
- **Not a prerequisite:** BullMQ/Redis client (D-2, PARTIALLY CLOSED) — its named trigger is Phase 2 item 14 (renewal jobs), eleven items away from item 1.

**Distinguishing real from nice-to-have:** nothing found here actually blocks starting item 1. The one item worth doing first as hygiene rather than as a hard gate is Finding 1 above (wiring the RLS safety assertion into the two broad isolation suites) — cheap, and better done before Phase 2 adds more concurrent-writer surface than done after.

## 6. Recommended order

1. (Optional, cheap, not blocking) Wire `assertRoleCannotBypassRls` into `apps/api/tenant-isolation-rls.spec.ts` and `modules/tenant/infrastructure/organizations-rls.spec.ts` — closes Finding 1 before Phase 2 adds more tables these suites will need to cover.
2. Start Phase 2 item 1 (`plan`/`plan_version`) directly — no prerequisite is unmet.
3. Carry R-004, R-006, R-008, R-010, R-011, R-012, R-013 forward as-is; none blocks item 1, and each already names its own trigger condition for when it stops being deferrable.

Not verified in this pass, and stated rather than left implied: the full space of `decisions/2026-08.md` and `decisions/2026-09.md` entries beyond the ones cited above was not read end-to-end line by line — the sampling here targeted the entries the four numbered questions and the nine exit criteria actually depend on. A reviewer wanting exhaustive coverage of every open decision-log item, not just the ones load-bearing for this review's questions, should treat that as a separate pass.
