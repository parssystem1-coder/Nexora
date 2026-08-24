# Phase 1 Gate Review — 2026-08-24 (second review, post `membership.revoke`)

**Supersedes:** `PHASE_1_GATE_REVIEW_2026-08-24.md`, which is left unedited as a dated record. That review verdict was "gate does not open, solely for the `membership.revoke` gap"; this review re-verifies all nine exit criteria independently against HEAD `7d18296`, does not inherit any of that review's `MET` verdicts, and finds a different reason the gate still does not fully open.

**Reviewed commit:** `7d18296551c88d58203ecac94d1ccb83c36e3a41` ("tenant/authorization: membership.revoke slice (the seventh capability)"). Working tree clean, `main` in sync with `origin/main`, confirmed before any command ran.

**Method:** ran the build/test/migration/conformance commands directly against a native PostgreSQL 17 install (`localhost:5432`; Docker unavailable in this environment), plus live `psql` probes issued as the actual `nexora_app` role — not read from SQL text — before reading this repository's own status documents, per this skill's instruction to form an independent judgment first.

---

## 1. Verdict

**The gate does not fully open.** Eight of the nine `08_PHASE_1_BRIEF.md` §6 exit criteria are genuinely `MET`, each with a specific proving test whose assertions (not just its title) were read and confirmed. The ninth — criterion 1, tenant isolation — is `PARTIAL`: cross-tenant write and delete protection is empirically *correct* for every one of the six tenant-owned tables (verified live against the real database in this review, not inferred from RLS policy text), but automated proof of that fact exists in the test suite for only two of the six (`organizations`, `audit_events`). §6 requires each criterion "proven by tests in CI," and "true but untested" does not satisfy that wording. This is a small, mechanical gap — four regression tests mirroring a pattern this codebase already has, no application code changes — not a rediscovery of last review's blocking defect.

Independently of the nine criteria, this review found a genuine, unresolved concurrency defect in `membership.revoke`'s last-owner/last-member checks: two concurrent revoke requests against a two-owner organization can both pass their guard check before either commits, leaving the organization with zero active owners — the exact dead-end state this capability exists to prevent. No exit criterion tests for this, so it does not itself block the gate, but it is a real correctness bug and is ranked first in the findings below on cost, not on gate-relevance.

Where the repository's own documents claimed a state, they were checked against the code rather than trusted, and in every case but one were accurate: the three findings closed in `371e80a` are genuinely closed, not merely declared closed (§4 below). The one inaccurate documentation claim found is low-cost (Finding 3).

---

## 2. Evidence

All commands run against HEAD `7d18296`, `DATABASE_URL`/`MIGRATE_DATABASE_URL` pointed at the native PostgreSQL 17 install on port 5432 (Docker unavailable on this machine; CI's `docker-compose.yml` path is evaluated separately below via its own run history, per this skill's instruction to treat CI as first-class evidence).

```
npm run typecheck        → clean, 0 errors
npm test                 → Test Files 34 passed (34) · Tests 342 passed (342)
npm run conformance      → Conformance harness: PASS (0 violations, 0 justified exception(s))
npm run db:migrate       → run against a freshly superuser-created, genuinely empty database
                            (nexora_gate_review, dropped after use): Applied 20, already up to
                            date: 0 — all 20 migration files listed, ending
                            20260824100000_authorization__add_membership_revoke_permission.sql
npm run graph -- --check → Project graph: up to date.
npm run openapi -- --check → OpenAPI artifact up to date (10 capabilities).
```

`exceptions.json` is `[]` — matches the "0 justified exception(s)" conformance output exactly.

**Structural diff since the last review** (`npm run graph -- --since e203c01`, resolving to the graph's own last-recorded ancestor `8a11446`, since `e203c01` and `371e80a` were docs-only commits with no structural change):
```
+ capability: membership.revoke
+ route: POST /api/v1/organizations/:organizationId/memberships/:membershipId/revoke
~ capabilities: 9 → 10
~ routes: 9 → 10
~ testFiles: 32 → 34
~ testCases: 295 → 330
```
(`npm run graph` — no `--check` — was also run to regenerate and diff against the committed artifact for this structural check; the working tree was restored to the committed state immediately after with `git checkout -- PROJECT_GRAPH.md tools/graph/project-graph.json`, confirmed clean before continuing.)

One number needed explaining: the graph reports 330 "test cases" against vitest's own 342. Traced, not assumed: the graph extractor counts `it(`/`test(` call sites textually (`tools/graph/extract.ts:440`), while four files use `it.each([...])` with 3, 6, 4 and 3 array entries respectively (`auth-login.integration.spec.ts:244`, `organization-create.integration.spec.ts:169`, `store-create.integration.spec.ts:210`, `membership-invite.integration.spec.ts:215`) — one static call site each, but 16 runtime tests between them. `16 − 4 = 12`, and `330 + 12 = 342`. Fully reconciled; not a defect in either number, just two different things being counted.

**Role safety (Step 2 requirement):** `platform/db/tenant-context.spec.ts:64` calls `assertRoleCannotBypassRls(appDb, TABLE)` in `beforeAll`, with the comment "if this fails, every other test in this file would be proving nothing," and the same assertion is repeated as its own test at line 82. Confirmed wired in, not merely imported.

**RLS reality, checked live, not from SQL text.** Against a freshly migrated database (`nexora_gate_review`, `\dt`): 14 business tables plus `schema_migrations`, no tables outside `08_PHASE_1_BRIEF.md` §4's allowed list (`identity_providers` and `outbox_events` are in the allowed list but not yet built — not yet built, not broken, and no exit criterion depends on either). `pg_class.relrowsecurity`/`relforcerowsecurity` both `true` for exactly the six tables §5 says are not exempt (`audit_events`, `membership_roles`, `memberships`, `organizations`, `store_memberships`, `stores`) and both `false` for the seven exempt ones. Nine RLS policies exist across those six tables, each with a real `tenant_id`-comparing predicate (`memberships`/`store_memberships` additionally OR a `user_id` self-access clause — R-003).

Then, live as the actual `nexora_app` role against the main `nexora` dev database (not a superuser, not the table owner, `NOSUPERUSER NOBYPASSRLS` confirmed via `\du`):
- A row seeded as superuser, queried as `nexora_app` with **no** tenant context set: `SELECT count(*) FROM organizations WHERE slug='rls-probe-org-gate-review'` → **0**. RLS fails closed, empirically, live.
- Cross-tenant `UPDATE stores ... WHERE id = <org A's store>` issued with `app.tenant_id` set to org B: **`UPDATE 0`**. Store A's name unchanged when re-read from org A's own context.
- Cross-tenant `UPDATE memberships SET status='REVOKED'` and `DELETE FROM store_memberships`, both against org A's rows, issued as org B: **`UPDATE 0` / `DELETE 0`**. Both rows confirmed intact from org A's own context afterward. `app.user_id` was set to an unrelated UUID so the self-access OR clause (R-003) was also genuinely exercised, not bypassed by coincidence.
- Cross-tenant `DELETE FROM membership_roles` against org A's role grant, issued as org B: **`DELETE 0`**. Grant confirmed intact.

All probe rows were cleaned up after each check; the database was left in its original state.

**CI, checked as first-class evidence, not assumed from a green badge.** `gh run list --limit 3` shows the run for this exact commit already completed before this review began:
```
completed  success  tenant/authorization: membership.revoke slice (the seventh capability)  Conformance  main  push  32686741898  1m7s  2026-08-24T03:31:30Z
```
`gh run view 32686741898` — single job `conformance`, single shell step, success, 1m1s. This is not the workflow's first run: `RISK_REGISTER.md` R-001 records that the same workflow caught two real, distinct defects on this repository before ever going green (a missing migration step, a locale-dependent sort), which is why a green run here is treated as meaningful rather than merely present.

---

## 3. Exit criteria (`08_PHASE_1_BRIEF.md` §6)

| # | Criterion | Verdict | Proving test |
|---|---|---|---|
| 1 | Tenant A cannot read, write, delete or execute against Tenant B data | **PARTIAL** | Read: `apps/api/store-read.integration.spec.ts:96` (cross-tenant store read denied), `platform/db/tenant-context.spec.ts:94` (fails closed), `apps/api/membership-revoke.integration.spec.ts:353` (write invisible cross-tenant). Write/delete, empirically correct but only mechanically proven for `organizations`: `modules/tenant/infrastructure/organizations-rls.spec.ts:62` ("does not let a cross-tenant UPDATE affect another organization's row"). No equivalent test exists for `memberships`, `stores`, `store_memberships`, or `membership_roles` — see Finding 2. "Execute" (a capability invoked against a resource in another tenant): every capability's own `FORBIDDEN`/`RESOURCE_NOT_FOUND` guard tests, e.g. `membership-revoke.integration.spec.ts:224` (R-003). |
| 2 | A valid session with a `storeId` belonging to another tenant is denied | **MET** | `apps/api/store-read.integration.spec.ts:96`, "denies a valid session reading a store belonging to another tenant — storeId is never trusted from the token (ADR-002)" |
| 3 | A query issued without tenant context returns zero rows and raises an error | **MET** | `store-read.integration.spec.ts:296` (zero rows, DB level) + `:318` (app-layer `AUTHENTICATION_REQUIRED`, never a raw DB error). The application-layer half of "an authenticated request whose own query runs with no context" has no reachable code path — confirmed independently by reading `modules/identity/interfaces/session.guard.ts` (rejects before any transaction opens) and `modules/tenant/interfaces/tenant-context.ts`'s `TenantContext.tenantId: string` (never `null`) — this is "met by construction," and the comment at `store-read.integration.spec.ts:306-317` states that honestly rather than implying a test proves it. |
| 4 | Revoking a membership invalidates active sessions within one request | **MET** | `apps/api/membership-revoke.integration.spec.ts:126`, "revokes the target's session, so their existing cookie stops authenticating on the very next request (exit criterion 4)" — asserts the target's cookie is `ACTIVE` before, `REVOKED` after, and a genuinely separate HTTP request against `organization.create` (a different, unrelated capability) with that same cookie returns 401 `AUTHENTICATION_REQUIRED`. |
| 5 | Every capability in scope emits an audit event | **MET** | All 10 `*.capability.ts` definitions have a corresponding controller calling `recordAuditEventDurable` — confirmed by direct grep (14 files reference the symbol; the 10 capability controllers among them account for exactly the 10 capabilities), e.g. `membership-revoke.controller.ts:116`. |
| 6 | Every error path returns a documented code from `05_API_CAPABILITY_CONTRACTS.md` | **MET** | Mechanically enforced by `tools/conformance/rules/error-codes.ts` (`ERROR-CODE-UNDOCUMENTED`/`ERROR-CODE-UNDECLARED`), run as part of `npm run conformance` → 0 violations. Its stated limitation ("does not catch a `CapabilityError` constructed with a non-literal code") was checked against actual usage: every one of the 29 `new CapabilityError(...)` call sites in `modules/` uses a literal string code — grepped and read individually, including the two multi-line calls (`organization-access.guard.ts:64`, `resolve-store-access.service.ts:34`). The stated limitation is real but not currently live. |
| 7 | Conformance harness green with an empty or fully justified exceptions report | **MET** | `npm run conformance` → `PASS (0 violations, 0 justified exception(s))`; `exceptions.json` is `[]`. |
| 8 | Integration tests run against real PostgreSQL, not mocks | **MET** | No mocking library in `package.json` (`pg-mem`, `sqlite`, etc. all absent); every `apps/api/*.integration.spec.ts` boots a real Nest app against `createDb(loadDbConfig())`; confirmed no `vi.mock`/`jest.mock` of the DB layer anywhere in the suite. |
| 9 | `Money` allocator test proves parts sum to the whole over randomized inputs | **MET** | `modules/money/domain/money.vo.spec.ts:145`, "always produces parts that sum to exactly the original whole, fairly distributed" — a seeded-RNG property test, 5000 iterations, asserting `Money.sum(parts, currency).amountMinor === amountMinor` (line 171) plus a fairness bound, across randomized currencies, magnitudes (including past 2^53), signs and weight vectors including zero-weight lines. A second test (`:199`) covers adversarial (non-random) weight vectors. |

**8 of 9 MET, 1 PARTIAL.**

---

## 4. Findings, ordered by cost of leaving them

### Finding 1 (high, correctness — not gated by any of the nine criteria, but a real defect) — `membership.revoke`'s last-owner and last-member checks are a read-then-write race with no database backstop

**Location:** `modules/tenant/application/revoke-membership.service.ts:88-98`, `modules/tenant/infrastructure/membership.repository.pg.ts:37-45` (`countActive`), `modules/authorization/infrastructure/role-grant.repository.pg.ts:54-65` (`countActiveMembersWithRole`). Confirmed against `platform/db/tenant-context.ts:32-43`: `db.transaction().execute(...)` with no isolation level set anywhere in the codebase (grepped for `setIsolationLevel`/`SERIALIZABLE`/`REPEATABLE READ` — no matches), so every capability transaction, this one included, runs at Postgres' default **READ COMMITTED**.

**The mechanism:** `RevokeMembershipService.execute` runs `SELECT count(*) ... WHERE status='ACTIVE'` (member count) and, if the target holds `owner`, a second `SELECT count(*)` (active-owner count), then `UPDATE memberships SET status='REVOKED' WHERE id = <target>`. Under READ COMMITTED, each `SELECT` sees a fresh snapshot as of that statement, not a lock — there is no `SELECT ... FOR UPDATE`, no advisory lock, and no database constraint (unlike, for example, `memberships_tenant_id_user_id_key`, the UNIQUE constraint that genuinely backstops `membership.invite`'s duplicate-membership check under the same kind of race) enforcing "at least one ACTIVE owner" or "at least one ACTIVE member" at the row level. The two `UPDATE`s in the interleaving below touch two *different* rows, so no lock ever forces them to serialize.

**Concrete interleaving:** Organization X has exactly two ACTIVE owners, Alice (membership A) and Bob (membership B), no other members. Two requests arrive within the same commit window:
1. T1 (revoking Alice): `SELECT countActiveMembersWithRole('owner')` → sees 2 (Bob's row is still ACTIVE; T1 hasn't committed anything yet). Passes the `activeOwnerCount <= 1` check.
2. T2 (revoking Bob, started before T1 commits): `SELECT countActiveMembersWithRole('owner')` → also sees 2, for the identical reason. Passes the same check.
3. T1: `UPDATE memberships SET status='REVOKED' WHERE id = A`. Commits.
4. T2: `UPDATE memberships SET status='REVOKED' WHERE id = B`. Commits — nothing blocked it; it never touched row A.

Result: organization X now has **zero** ACTIVE owners, despite each request's own check believing "another owner remains." This is exactly the dead-end state the last-owner guard exists to prevent (`revoke-membership.service.ts:44-51`'s own doc comment: "no capability could ever reverse" it). A parallel, lower-severity version of the same race exists for two concurrent revokes of the *same* target: both can pass the "not already revoked" check before either commits, and since the `UPDATE`'s `WHERE` clause filters only by `id` (not by `status`), the second `UPDATE` still applies after waiting on the row lock — so the second caller gets a `200 REVOKED` response and a duplicate audit event for a membership someone else already revoked, rather than the `CONFLICT` the code intends. No data corruption in this second case, since `revokeAllForUser` is naturally idempotent, but it is a silently-bypassed invariant.

**Why this is real and not theoretical:** the same trigger this capability implements — two owners each ending the other's access — is a plausible real sequence (e.g., an owner leaving a company revoking a co-owner at nearly the same moment the co-owner revokes them back, or two admin sessions racing a cleanup script). It requires no adversarial timing, just two requests close enough together, which READ COMMITTED does nothing to rule out.

**Fix, not applied here (read-only review):** the smallest change consistent with the existing helper is `SELECT ... FOR UPDATE` on the rows the two counts depend on (the target's own row, plus — for the owner check — every ACTIVE membership row holding `owner` in the tenant) before counting, so a concurrent revoke against the same tenant's owner set blocks until the first commits and then re-reads a state that already reflects it. An isolation-level bump to `SERIALIZABLE` for this one capability, with `40001` retry handling, is the alternative already implicitly endorsed by this codebase's stated preference for "database constraints over pre-checks," though a true constraint (a `CHECK` or trigger enforcing "count of ACTIVE owners per tenant ≥ 1") is not expressible as a plain `CHECK` constraint in Postgres and would need a trigger — a larger change than this review recommends taking on now.

### Finding 2 (moderate) — exit criterion 1's write/delete half is proven in CI for one of six tenant-owned tables; the other five are correct but untested

**Location:** `modules/tenant/infrastructure/organizations-rls.spec.ts` exists and is thorough (four tests, including a genuine cross-tenant `UPDATE` attempt at line 62). No equivalent file exists for `memberships`, `stores`, `store_memberships`, or `membership_roles` — confirmed by grepping every `*.spec.ts` under `modules/` for `updateTable(`/`deleteFrom(`: only `organizations-rls.spec.ts` and `audit-events-append-only.spec.ts` (a different property — REVOKE-based append-only, not tenant-scoping) match.

This review closed the gap between "untested" and "broken" itself, live (§2 above): all four tables correctly reject cross-tenant `UPDATE`/`DELETE`, including the two tables using the R-003 self-access OR clause. The underlying behavior is correct. But `08_PHASE_1_BRIEF.md` §6 frames every criterion as "proven by tests in CI," and today, for five of six tenant tables, that proof does not exist in the suite — only in this review's one-off manual probe, which does not run again on the next commit.

**Document violated:** `08_PHASE_1_BRIEF.md` §6 (criterion 1's own wording); `AGENTS.md` §8's test-layering table ("Tenant isolation, RLS → integration test against real PostgreSQL").

**Fix:** four small additions mirroring `organizations-rls.spec.ts`'s "does not let a cross-tenant UPDATE affect another organization's row" pattern — one cross-tenant `UPDATE` and one cross-tenant `DELETE` test per table (`memberships`, `stores`, `store_memberships`, `membership_roles`), seeding two tenants directly and asserting zero rows affected plus an unchanged read-back from the owning tenant's own context. No application code changes.

### Finding 3 (low, documentation accuracy) — `REPOSITORY_AUDIT_REPORT.md:61` still states `docker-compose.yml` pins PostgreSQL **16**, and is not covered by the document's own amendment note

**Location:** `REPOSITORY_AUDIT_REPORT.md:61` (§3.2 "Toolchain and dependencies" table): *"`docker-compose.yml` provides PostgreSQL 16 on host port 5433."* This is false as of `371e80a` — `docker-compose.yml:3` has pinned `postgres:17-alpine` since that commit, confirmed by direct read. The document's own amendment note at the top (`REPOSITORY_AUDIT_REPORT.md:9`) explicitly scopes its correction to "`§0 below, §4.5, §4.6`" — §3.2, where line 61 lives, is not in that list, so a reader who jumps to the toolchain summary table (a very plausible entry point) finds an uncorrected, now-false claim with no pointer to the truth.

By contrast, `CLAUDE.md`, `DECISION_LOG.md`, `RISK_REGISTER.md`, `PHASE_1_GATE_REVIEW_2026-08-22.md`, `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` and `docker-compose.yml` itself were all checked and are accurate or correctly annotated as historical — this is the one gap in an otherwise genuinely completed correction. Confirmed as a real, standing gap: the closure commit fixed docker-compose.yml itself plus seven documents' *framing* claims but missed this one specific stale fact inside a document it did partially amend.

**Document violated:** none normative — `REPOSITORY_AUDIT_REPORT.md` is a status document, not an ADR — but it is exactly the kind of "claiming a state that is no longer true" the task asked to be named.

**Fix:** one-line addition to `REPOSITORY_AUDIT_REPORT.md:61` or its surrounding table pointing at the top-of-file amendment, or widening the amendment note's own section list to include §3.2.

### Finding 4 (low, already correctly tracked) — R-005: `auth.login` has no rate limiting

Re-confirmed, not re-litigated: `modules/capability/domain/capability-definition.ts` has no rate-limit field by design, and no module-local substitute exists. Correctly does not block any of the nine Phase 1 criteria — none mention throttling — but is a genuine, `RISK_REGISTER.md`-acknowledged blocker before any internet-facing exposure, and Phase 2 adds more such surfaces (payment webhooks, provider callbacks) that will have the identical need. See next-phase prerequisites.

### Finding 5 (low, informational, newly confirmed accurate) — R-006: `PermissionCheckRepositoryPg.hasPermission` does not filter by membership status, verified still true and still safe only by construction

Read directly (`modules/authorization/infrastructure/permission-check.repository.pg.ts:9-20`): the query joins `membership_roles` → `role_permissions` → `permissions` by `membershipId` alone, no join to `memberships`, no `status` filter. Confirmed the register's mitigating claim by reading both call sites that resolve a `membershipId` before a permission check: `modules/tenant/application/resolve-organization-access.service.ts:30` and `modules/tenant/application/resolve-store-access.service.ts:29,33-37` both explicitly check `membership.isActive`/`!storeMembership`/`!membership.isActive` and refuse before a permission check is ever reached. The register's characterization is accurate: safe today, fragile if a future capability resolves a `membershipId` a third way. Not fixed here, correctly — `AGENTS.md` §4 forbids a broad refactor while implementing an unrelated feature, and this review makes no code changes.

---

## 5. Next-phase prerequisites (`06_IMPLEMENTATION_PLAN.md` Phase 2, first steps)

- **Step 3, shared idempotency service (ADR-009) — not built, and already the single most-cited gap in this codebase.** Every Phase 1 write capability (`organization.create`, `membership.invite`, `membership.role.assign`, `store.create`, `membership.revoke`) declares `idempotent: false` in deliberate divergence from `05_API_CAPABILITY_CONTRACTS.md` §4.1's `yes`, each pointing at this same unbuilt service. Phase 2 steps 10-12 (payment intent creation, verification, reconciliation) are unsafe to retry without it — this is the one Phase 2 prerequisite this review considers load-bearing enough to flag as blocking, not just missing.
- **Steps 1, 2, 4 (plan/price/subscription tables) — correctly not built.** No Phase 1 criterion or table-scope rule is violated by their absence; `08_PHASE_1_BRIEF.md` §4 explicitly excludes them from this phase.
- **Money/currency (Phase 1 step 4, listed under Phase 1 but a hard Phase 2 dependency) — ready.** `modules/money`'s `Money` value object and allocator are built and proven by the randomized property test (criterion 9). No further work needed before Phase 2 consumes it.
- **Clock abstraction (ADR-031) — ready.** `Clock`/`systemClock` (`platform/clock.ts`) already exist and are used by `RevokeMembershipService` and others; calendar-arithmetic needs specific to subscription periods are not yet built but the injection seam is in place.
- **Rate limiting (R-005, Finding 4) — not a named Phase 2 step, but worth bundling.** Phase 2 introduces genuinely public, high-value surfaces (payment provider callbacks); addressing this as shared platform infrastructure once, rather than per-capability, matches the reasoning already recorded in `RISK_REGISTER.md`.

---

## 6. Recommended order

1. **Add the four missing cross-tenant `UPDATE`/`DELETE` regression tests** (`memberships`, `stores`, `store_memberships`, `membership_roles`), mirroring `organizations-rls.spec.ts`. This is the one item that changes criterion 1 from `PARTIAL` to `MET` and is pure test-writing against already-correct code — smallest, safest, and the literal blocker for opening the gate under a strict reading of §6.
2. **Fix `membership.revoke`'s concurrency race** (Finding 1) before it is relied on more heavily. It does not block gate-open under the letter of the nine criteria, but it is the one genuine data-integrity defect this review found, and this codebase already holds itself to "no concurrent-request invariant violations" as a standard elsewhere (Phase 2's and Phase 3's own exit paragraphs both name concurrency explicitly). Cheapest first step: `SELECT ... FOR UPDATE` on the counted rows within the existing transaction.
3. **Correct `REPOSITORY_AUDIT_REPORT.md:61`** (Finding 3) — trivial, one line.
4. **Before Phase 2 begins in earnest:** build the ADR-009 idempotency service and resolve R-005. Neither blocks Phase 1's gate; both block Phase 2's own steps 3 and (implicitly) its payment-surface work.

This order is smallest-first for gate-opening (1), then highest-real-cost-first for what is not gate-blocking but should not be carried into Phase 2 unaddressed (2, 3), then the two named Phase 2 prerequisites (4).
