# Phase 1 Gate Review — 2026-08-24

**Method:** ran the build/test/migration/conformance commands directly, ran empirical `psql` checks against a live database, read guard/service/repository source for every capability, and dispatched an independent sub-agent to trace every `CapabilityError` throw site against every capability's declared `errorCodes` array — all before reading `CLAUDE.md`, `DECISION_LOG.md`, `RISK_REGISTER.md`, or any prior `PHASE_1_*.md` report, per this skill's instruction to form an independent judgment first. Reviewed at HEAD `6d1f866` ("graph: regenerate after the ADR-035 correction, ignore .freebuff/"), tree clean, in sync with `origin/main`.

**Baseline for the structural diff:** the previous gate review (`PHASE_1_GATE_REVIEW_2026-08-22.md`) names commit `49fde2c`, which no longer exists — the 2026-08-23 rebase onto the GitHub remote rewrote every hash. Found by subject instead: "Repair wrap-up: repair report, corrected exit-criteria table, CLAUDE.md" is now `c8115b5`. However `npm run graph -- --since c8115b5` fails outright (`tools/graph/extract.ts` did not exist yet at that commit — it was added later, at `59df633`), so the graph tool cannot mechanically diff back that far. Used `59df633` instead as the nearest available structural baseline, and relied on direct reading (guards, services, migrations, tests) rather than the graph tool to cover the gap between `c8115b5` and `59df633`. This dependency on manual review for part of the window is itself worth naming: the graph tool's usable history does not yet reach back to the last gate review, and will not until a gate review is run again after today.

---

## 1. Verdict

**The gate does not open. Phase 2 should not start yet — but the reason is narrower than it looks.** Every one of Phase 1's mechanical checks is green (307/307 tests, 0 conformance violations, 19/19 migrations from empty, CI green on the current commit, RLS verified both structurally and empirically live). Eight of the nine exit criteria in `08_PHASE_1_BRIEF.md` §6 are genuinely MET, each with a real test whose assertions were read, not assumed. The ninth — "revoking a membership invalidates active sessions within one request" — is **NOT MET**, because `membership.revoke` does not exist as a capability anywhere in the codebase; there is no code path that can revoke a membership at all, so nothing can be attempted, let alone tested. This is not a partial credit situation: the criterion asks for a specific, testable behavior, and the precondition for testing it does not exist.

The repository's own status documents describe this accurately (`membership.revoke` is consistently named as the gap, not glossed over), which is itself informative: where this review checked a claim the documents made, the documents were right far more often than they were wrong. The exceptions found — a mislabeled test, a Postgres version mismatch between what every document says was verified and what CI actually runs on, and a mechanically-unenforced error-code contract — are all real, but none of them independently blocks the gate the way the missing criterion does.

---

## 2. Evidence

Commands run against HEAD `6d1f866`, `DATABASE_URL`/`MIGRATE_DATABASE_URL` pointed at the native PostgreSQL 17 install on port 5432 (Docker unavailable on this machine):

| Command | Result |
|---|---|
| `npm run typecheck` | Clean, 0 errors |
| `npm run db:migrate` (against `nexora_gate_review`, created empty by a superuser, dropped after) | **Applied 19, already up to date: 0** — all 19 migrations apply cleanly from empty |
| `npm test` | **307 passed / 307** across **32 files**, 0 failed |
| `npm run conformance` | **PASS (0 violations, 0 justified exception(s))**; `exceptions.json` is `[]` on disk, `conformance-exceptions-report.md` confirms "No exceptions on record" |
| `npm run graph -- --check` | up to date |
| `npm run openapi -- --check` | up to date (9 capabilities) |

**Live RLS check, structural** (`pg_class`/`pg_policy` on the migrated database, not SQL text):

| Table | `relrowsecurity` | `relforcerowsecurity` | Policies |
|---|---|---|---|
| `organizations`, `stores`, `memberships`, `store_memberships`, `membership_roles`, `audit_events` | all `t` | all `t` | ≥1 each (`organizations` has 4: select/insert/update/delete) |
| `users`, `sessions`, `credentials`, `currencies`, `reserved_subdomains`, `roles`, `permissions`, `role_permissions` | all `f` | all `f` | 0 — matches `08_PHASE_1_BRIEF.md` §5's exemption list exactly, no extra and no missing exemption |

**Live RLS check, empirical**, run twice independently (once via a throwaway database that turned out to be missing `001_roles.sql`'s per-database grants — my own setup gap, not a product defect, worked around by using the already-provisioned `nexora` database instead):
- `nexora_app`, no `app.tenant_id` set, querying a real seeded `organizations` row → **0 rows**.
- `nexora_app`, correct `app.tenant_id` set → **1 row**.
- `nexora_app`, a different tenant's `app.tenant_id` set → **0 rows**.
- Same three-way check repeated against `stores` with two real organizations (`gate-review-a`/`gate-review-b`) → tenant B's context sees **0** of tenant A's store. Confirms `store-read.integration.spec.ts:96-104`'s and `store-create.integration.spec.ts:310-321`'s claims directly, not by trusting the test file.

**`assertRoleCannotBypassRls`** (`platform/db/assert-role-safety.ts`) is genuinely wired in: `platform/db/tenant-context.spec.ts:64,81-83` runs it as a hard `beforeAll` precondition before any isolation assertion in that file, against the same `nexora_app` connection every integration test uses. Confirmed it checks superuser, `BYPASSRLS`, and table ownership — all three ways a role can defeat RLS.

**Table scope** (`\dt` on the freshly-migrated throwaway database): 14 application tables, all inside `08_PHASE_1_BRIEF.md` §4's allowed list. `identity_providers` and `outbox_events` are the two allowed-but-unbuilt tables; no scope creep found.

**CI, treated as first-class evidence, not as "unproven":**
- `.github/workflows/conformance.yml` triggers on `push: [main]` and on `pull_request`; this repository has never used a PR, so only the push trigger has ever fired.
- The workflow runs, in order: checkout → setup-node (24) → `npm ci` → `docker compose up -d --wait` → `npm run db:migrate` → `npm run typecheck` → `npm test` → (`if: always()`) `npm run conformance` → `npm run graph -- --check` → `npm run openapi -- --check` → teardown. This is the same four-command ritual `CLAUDE.md` documents locally, run for real on `ubuntu-latest` against the actual `docker-compose.yml` Postgres, not a stand-in.
- Last 7 runs: **3 success, 4 failure** — every failure was a real, distinct defect the harness caught and a human/agent fixed in the next commit (missing migration step; a `localeCompare`-driven platform-dependent sort; an empty-directory artifact leaking into `PROJECT_GRAPH.md`; a self-inflicted stale-artifact miss). The run for the current HEAD (`32676598921`) is green and its `headSha` matches `6d1f866` exactly — confirmed via `gh run view --json headSha`, not assumed from the run title.
- **What CI does NOT cover:** no branch protection exists on this repository (`gh api .../branches/main/protection` returns 403 — the feature requires a paid plan or a public repo), so nothing currently prevents a direct push to `main` that skips CI entirely; CI is a check that runs, not a gate that blocks. CI does not run on a schedule, does not test Windows, does not load-test, and does not exercise anything beyond exactly what `npm run typecheck/test/conformance/graph/openapi` already does locally — it is a parity check on a second OS, not a superset of local verification.

---

## 3. Exit criteria (`08_PHASE_1_BRIEF.md` §6)

| # | Criterion | Verdict | Proving test |
|---|---|---|---|
| 1 | Tenant A cannot read, write, delete or execute against Tenant B data | **MET** | Cross-tenant READ: `apps/api/store-read.integration.spec.ts:96-104` (confirmed empirically live, see §2). Cross-tenant WRITE/EXECUTE: `apps/api/membership-role-assign.integration.spec.ts:287` (a `membershipId` naming another tenant's row is denied `RESOURCE_NOT_FOUND`, the R-003 forcing case). **DELETE is unexercised** because no Phase 1 capability performs a delete at all — not a gap in the criterion's proof, a fact about what exists to test. |
| 2 | A valid session with a `storeId` belonging to another tenant is denied | **MET** | `apps/api/store-read.integration.spec.ts:96-104` — asserts `403`/`STORE_ACCESS_DENIED` precisely, not merely a non-2xx status. |
| 3 | A query issued without tenant context returns zero rows and raises an error | **MET, but see Finding 1** | Two halves, in two different files: the "zero rows" half is `apps/api/store-read.integration.spec.ts:296-304` (direct query against the real `stores` table, no synthetic stand-in). The "raises an error" half is `modules/tenant/application/read-store.service.spec.ts:32-43` ("raises RESOURCE_NOT_FOUND when the store is not visible" — a null repository result becomes a thrown `CapabilityError`). Together these fully substantiate the criterion. The test at `store-read.integration.spec.ts:306-312`, titled as if it proved the *application-layer* version of this exact scenario, does not — see Finding 1. |
| 4 | Revoking a membership invalidates active sessions within one request | **NOT MET** | No test, because no capability exists. `grep -rln "membership.revoke"` across `modules/` returns nothing but a doc-comment reference in `session-revocation.repository.ts` to a *different* trigger (role change). `DECISION_LOG.md`'s decision-9 entries (2026-08-23, 2026-08-24) and `CLAUDE.md` both already say this plainly — the documents are not overclaiming here. |
| 5 | Every capability in scope emits an audit event | **MET** | All 9 capabilities have a dedicated audit test in their integration spec (`auth-login`, `auth-logout`, `membership-invite`, `membership-role-assign`, `organization-create`, `organization-switch`, `store-create`, `store-read` — one file each, each with both a SUCCESS-row test and a "guard denial writes no row" test). Read in full for `organization.switch` and `auth.logout`/`auth.logout_all` (built this session) and spot-checked for the rest; every one asserts the actual row shape (`capability`, `outcome`, `actor_user_id`, `resource_type`, `resource_id`, `metadata`), not just "an audit call happened." |
| 6 | Every error path returns a documented code from `05_API_CAPABILITY_CONTRACTS.md` | **MET in practice, PARTIAL as a criterion "proven by a test in CI"** | A dedicated trace of all 9 capabilities (every guard in the pipeline, the controller, the application service, the repository) found **zero under-declarations and zero over-declarations** — every `CapabilityError` code reachable from a capability's real request path is in its declared `errorCodes`, and every declared code has a real throw site. But this was proved by reading, not by a mechanical check: no conformance rule (`tools/conformance/rules/*.ts` — checked: `db-access`, `imports`, `schema`, `schema-live`, `secrets`, `singleton`, no seventh) cross-references a capability's declared codes against what its code can actually throw. `tools/openapi/openapi.spec.ts:77-93` checks only one direction (every *declared* code is documented in the OpenAPI artifact under the right status) — it would not catch a future capability that throws an undeclared code. See Finding 2. |
| 7 | Conformance harness green with an empty or fully justified exceptions report | **MET** | `npm run conformance` → `PASS (0 violations, 0 justified exception(s))`; `exceptions.json` is `[]` on disk (confirmed directly, not via the report). |
| 8 | Integration tests run against real PostgreSQL, not mocks | **MET** | Every `*.integration.spec.ts` file's `beforeAll` does `createDb(loadDbConfig())` then `sql\`select 1\`.execute(db)` against a real connection before proceeding — confirmed for `store-read`, `store-create`, `auth-login`, `auth-logout`, `organization-switch` directly; the pattern is identical (copy-mirrored) across all 9 files. |
| 9 | `Money` allocator test proves parts sum to the whole over randomized inputs | **MET** | `modules/money/domain/money.vo.spec.ts:144-171` ("always produces parts that sum to exactly the original whole, fairly distributed") — read directly: a seeded RNG, 5000 iterations, varying currency/magnitude(including past 2^53)/sign/1-8 weights including zero-weight lines, asserting `Money.sum(parts).amountMinor === amountMinor` exactly every iteration. A second test at line 199 repeats this for adversarial (non-random) weight vectors. |

**8 of 9 MET, 1 NOT MET.** No criterion was softened to PARTIAL for having a small amount of remaining work — criterion 4 has *no* work in progress, only a documented absence, which is exactly a NOT MET.

---

## 4. Findings, ordered by cost of leaving them

### Finding 0 (blocking) — `membership.revoke` does not exist; exit criterion 4 is unimplementable until it does
**Location:** no location — that is the finding. `08_PHASE_1_BRIEF.md:115`; `05_API_CAPABILITY_CONTRACTS.md` has no row for `membership.revoke` in §4.1 either, meaning even its scope/risk/idempotency classification has never been decided.
**Why it matters:** this is Phase 1's only unmet exit criterion, and the gate cannot open without it or an explicit, recorded decision to descope it. It is correctly and consistently tracked (`CLAUDE.md`, `DECISION_LOG.md` decision 9, `RISK_REGISTER.md` implicitly via the ADR-029 checklist) as a known gap, not a surprise.
**Fix:** implement `membership.revoke` as a seventh slice (not one of the six Task 2 slices, so it needs its own `/new-slice` run), including the session-invalidation trigger this criterion asks for — the existing `SessionRevocationRepository.revokeAllForUser` port already does exactly the revocation half; only the capability wrapping it is missing.

### Finding 1 (moderate) — a test's title claims to prove the application-layer half of exit criterion 3; its assertions prove a different, unrelated scenario
**Location:** `apps/api/store-read.integration.spec.ts:306-312`.
**What it says:** `it("the application layer raises a stable AUTHENTICATION_REQUIRED error for the same case, never a raw DB error", ...)`.
**What it actually does:** sends a request with **no session cookie at all** and asserts `401`/`AUTHENTICATION_REQUIRED`. This is `SessionGuard` rejecting an unauthenticated request — a completely different failure mode from "an authenticated request whose query somehow runs without tenant context," which is what the title and the preceding test (line 296) are about. The two happen to share an HTTP status by coincidence.
**Why it matters:** this is exactly the failure mode `AGENTS.md`/the phase-gate skill warn about — a green test whose title overclaims. The criterion itself is still MET (via the split proof in §3's table above), so this is a test-hygiene defect, not a gate-blocking one — but a future reader citing this test as "the" proof of criterion 3's application-layer half would be citing the wrong evidence.
**Fix:** rename the test to describe what it actually proves (a missing-cookie rejection), and, if the application-layer half of criterion 3 is worth a dedicated test at all, write one that gets an authenticated request to a state where tenant context is genuinely absent — which may not be possible without either an intentionally broken guard-bypass test double or accepting that this half is only provable at the unit layer (`read-store.service.spec.ts:32-43`), which is a legitimate but different answer than what the current title implies.

### Finding 2 (moderate) — "every error path returns a documented code" has no mechanical enforcement, only a manually-verified-today invariant
**Location:** `tools/conformance/rules/` (six files, none of them this rule); `modules/capability/domain/capability-definition.ts` (declares `errorCodes` but nothing checks it against source); `tools/openapi/openapi.spec.ts:77-93` (checks only the declared→documented direction).
**Why it matters:** exit criterion 6 says "proven by tests in CI" (`08_PHASE_1_BRIEF.md` §6's own header). Today it *is* true (confirmed by direct trace, §3 above), but nothing stops a tenth capability from throwing an undeclared code and shipping — the same class of drift ADR-030 exists to catch mechanically for import direction and secrets, but does not yet catch here.
**Fix:** a conformance rule that greps each `*.controller.ts` (and the guards/services/repositories it reaches) for `CapabilityError("CODE"` literals and asserts the set is a subset of the matching `*.capability.ts`'s `errorCodes` array. This is the same "a rule without a check is documentation, not architecture" reasoning ADR-030 §Decision 1 already states.

### Finding 3 (moderate, documentation accuracy) — every document claims "PostgreSQL 17" as the verification basis; `docker-compose.yml` — the thing CI actually runs, and the thing R-001's closure now rests on — pins Postgres **16**
**Location:** `docker-compose.yml:3` (`image: postgres:16-alpine`) vs. `CLAUDE.md:69`, `DECISION_LOG.md:641,710`, `RISK_REGISTER.md:9`, `REPOSITORY_AUDIT_REPORT.md:13,119,146,184`, `PHASE_1_GATE_REVIEW_2026-08-22.md:5,17,140`, `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md:126` — seven documents, all describing the native PostgreSQL 17 install used for local verification as "a stand-in for" or verifying "the same statements" as the docker-compose path.
**Why it matters:** these documents' framing implies version parity between the environment that has been verified locally throughout this project's entire history and the environment CI (and any real deployment using this compose file) actually runs. That parity was never true — 16 and 17 are different major versions. RLS/`FORCE ROW LEVEL SECURITY` behavior is stable across both, and CI's now-green run is real evidence the *application* works on 16 — but the "stand-in" framing itself was inaccurate the whole time it was written, and nobody has verified there is no 16-vs-17 behavioral difference relevant to this codebase (there is no reason to expect one, but "no reason to expect one" is not the same claim as "verified"). This is exactly the class of error the task's brief named as having cost this project three times already: a document claiming a state that was never actually true.
**Fix:** either pin `docker-compose.yml` to `postgres:17-alpine` (aligning the documented and actual verification basis, and now that CI is real, cheap to re-verify), or correct the seven documents to say "verified against 17 locally and 16 in CI" rather than implying they are the same thing.

### Finding 4 (low, correctly tracked already) — R-003's widened self-access RLS clause (`memberships`/`store_memberships`) remains a structural risk, not eliminated
**Location:** `modules/tenant/migrations/20260822090300_tenant__create_memberships.sql`, `20260822090500_tenant__create_store_memberships.sql`; confirmed live via `pg_policy` (§2 table above) — the `OR user_id::text = current_setting('app.user_id', true)` clause is present exactly as documented.
**Why it matters:** this is not a new finding — `RISK_REGISTER.md` R-003 already tracks it accurately, status `ACCEPTED` (correctly distinguished from `RESOLVED` as of the 2026-08-24 correction), and the one place it is actually exploitable in production code (`AssignMembershipRoleService`) has the required defensive re-check, tested (`assign-membership-role.service.spec.ts` and the corresponding integration test). Naming it here only to confirm: it is real, it is understood, it is not silently forgotten, and nothing in Task 2 introduced a *new* unguarded reader of these tables' widened policy.
**Fix:** none needed for Phase 1 exit. Any future capability that does an id-only lookup against `memberships` or `store_memberships` must repeat the explicit tenant re-check — worth a one-line addition to the `/new-slice` skill's checklist if it isn't already there (it references R-003 already, so this may already be sufficient).

### Finding 5 (low, informational) — R-005 (no rate limiting on `auth.login`) does not block any Phase 1 exit criterion, but blocks real deployment
**Location:** `modules/identity/interfaces/auth-login.controller.ts` (no throttling anywhere in the request path); `RISK_REGISTER.md:13`.
**Why it matters:** correctly tracked, correctly scoped as "not this slice's job" (a rate limiter is cross-capability, shared infrastructure per `01_ARCHITECTURE_BASELINE_RFC.md`). None of `08_PHASE_1_BRIEF.md` §6's nine criteria mention rate limiting. Listed here only so it is visible next to the exit-criteria table rather than requiring a second document to notice it.
**Fix:** build the shared rate limiter before any real, untrusted traffic reaches `auth.login` — independent of phase gating.

---

## 5. Next-phase prerequisites (`06_IMPLEMENTATION_PLAN.md` Phase 2, first steps)

Checked Phase 2's ordered list (`06_IMPLEMENTATION_PLAN.md:53-76`) against what exists today:

- **Step 3, shared idempotency service (ADR-009):** does not exist. `ADR-009`'s own decision text (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:613-643`) describes a Postgres-table-backed service (`UNIQUE (tenant_id, capability, idempotency_key)`), not something that strictly requires Redis — but it is entirely unbuilt, and every capability implemented so far (`organization.create`, `membership.invite`, `store.create`) has an explicit, individually-recorded `idempotent: false` divergence from `05`'s stated `yes` specifically because this doesn't exist yet. Phase 2 cannot proceed past its own step 3 without it.
- **Redis + BullMQ** (`08_PHASE_1_BRIEF.md` §0's stack table): zero references anywhere in `package.json` or any `.ts` file under `platform/`, `modules/`, or `apps/` — confirmed by direct grep, not by absence of a mention. Phase 2 step 14 ("renewal lifecycle jobs: notice, reminders, rollover, expire, deprovision, trial expiry") is very unlikely to be buildable without a job queue. This is a decided-but-unbuilt piece of infrastructure the next phase's own step list assumes exists by around step 14.
- **`outbox_events` table** (`08_PHASE_1_BRIEF.md` §4, listed as in-scope but explicitly deferred by `.claude/skills/new-slice/SKILL.md:129`): does not exist. Phase 2 step 17 ("notification flows for every lifecycle event") plausibly needs a reliable event-publishing mechanism, for which the outbox pattern is the usual answer — not confirmed as strictly required, but worth naming before Phase 2 discovers it needs one mid-slice.
- **`identity_providers`:** does not exist, tenancy undecided (`08_PHASE_1_BRIEF.md` §5 says so explicitly). Not referenced anywhere in Phase 2's step list — not a Phase 2 blocker.

---

## 6. Recommended order

1. **Decide and record `membership.revoke`'s scope** (route, risk tier, permission — none of this exists in `05` §4.1 yet) in `DECISION_LOG.md`, the same way every other slice's ambiguities were resolved before code — this is a documentation step, not a code step, and it is what the next `/new-slice` run needs before it can start.
2. **Implement `membership.revoke`** via `/new-slice`, wiring the existing `SessionRevocationRepository.revokeAllForUser` port into the new capability's transaction so the membership-status UPDATE and the session revocation are atomic (the same pattern `membership.role.assign` already established for the role-change trigger). This closes exit criterion 4 and is the only step that changes the verdict in §1.
3. **Fix Finding 1** (rename the mislabeled test, or replace it with a real one) — cheap, isolated, no dependency on anything else.
4. **Add the error-code conformance rule (Finding 2)** — turns a currently-true-by-discipline invariant into a mechanically-enforced one before a tenth capability has the chance to violate it silently.
5. **Resolve Finding 3** (pin `docker-compose.yml` to `postgres:17-alpine`, or correct the seven documents) — low cost, but should happen before anyone next reads those documents and assumes the parity they describe.
6. **Run this gate review again** once 1-2 land, to confirm 9 of 9, then re-check §5's next-phase prerequisites before starting Phase 2's own step 1.

Findings 4 and 5 need no action to open this gate — they are correctly tracked already and are named here only for completeness, per the instruction to say plainly where the repository's own documents already had it right.
