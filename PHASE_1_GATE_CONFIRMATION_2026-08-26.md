# Phase 1 Gate Confirmation — 2026-08-26

**Scope:** a focused confirmation pass on commit `fd13c1e`, checking whether the two findings `PHASE_1_GATE_REVIEW_2026-08-24-II.md` withheld the gate for (and the one stale-documentation finding it noted) are genuinely closed — not a third full nine-criteria audit from scratch, though all nine are re-confirmed below with their proving tests read fresh this pass, not carried forward from either earlier report.

**Supersedes nothing.** `PHASE_1_GATE_REVIEW_2026-08-24.md` and `PHASE_1_GATE_REVIEW_2026-08-24-II.md` are left unedited, per this project's standing convention for dated records.

---

## 0. Starting state

```
git rev-parse HEAD        → fd13c1e151567fffed3eb205a2cd73c69444e127
git status --porcelain    → (empty — clean)
git status -sb            → ## main...origin/main (in sync, no ahead/behind)
```

Matches the expected starting state exactly.

**CI status on this exact commit: NOT confirmed green — the run never started.** `gh run list`/`gh api repos/.../actions/runs?head_sha=fd13c1e...` show run `32985409838` (event `push`, triggered `2026-08-26T15:32:04Z`) sitting in status `queued` with **zero jobs** (`GET .../actions/runs/32985409838/jobs` → `{"total_count":0,"jobs":[]}`). Its `updated_at` timestamp is byte-identical to its `created_at` — no state transition has occurred at all, not even a runner pickup, in over 30 minutes of observation (a background `gh run watch` left running for ~18 minutes logged nothing but "Triggered via push... ago" on every 3-second poll before GitHub's own API started timing out with a 504). Every prior push on this repository (the last five runs, back through `07909e9`) started and completed in roughly a minute. This is not "CI is slow"; it is CI never being scheduled, coinciding with the repository's move to private earlier today, per the user's own note. It is outside this review's read-only scope to change any Actions/billing setting to unstick it.

**Per the task's own instruction, this is reported rather than routed around.** Everything below this point was verified locally, independently, and directly against the code and a real PostgreSQL instance — it is not weakened by the CI gap. But `08_PHASE_1_BRIEF.md` §6 frames every criterion as "proven by tests in CI," the same standard the second gate review held criterion 1 to, and the same standard this pass holds itself to for the verdict: **the gate is not fully open while this commit's CI run is unconfirmed.** See §5.

---

## 1. Exit criterion 1 — was PARTIAL, now checked fresh

**`apps/api/tenant-isolation-rls.spec.ts` read in full.** `enumerateTenantOwnedTables()` (lines 69–96) queries `pg_class` joined to `pg_namespace`, filtered on `relrowsecurity AND relforcerowsecurity`, both `true` — live, not a hard-coded array. Re-running the suite (below) reproduced its own first assertion: `tenantOwnedTables.map(t => t.table)` equals exactly `["audit_events", "membership_roles", "memberships", "organizations", "store_memberships", "stores"]` (line 247) — the same six `08_PHASE_1_BRIEF.md` §5 names as non-exempt, found live, not asserted from a list a human wrote.

Each table's own test (`it.each`, line 256) fires `probeSelect`/`probeUpdate`/`probeDelete` (lines 194–226) concurrently as a caller in a different org with an unrelated user id, then asserts: zero rows on SELECT, zero rows affected on UPDATE, zero rows affected on DELETE, **and** that the row is still present and unchanged from its own tenant's context afterward (lines 285–288) — the last check is what proves the probes failed for the right reason (RLS) rather than some SQL mistake that happened to also return nothing.

**Suite-has-teeth check, performed live, not asserted:** created a throwaway database (`nexora_rls_probe`), migrated it (20/20 applied), then ran `ALTER POLICY stores_tenant_isolation ON stores USING (true);` — a realistic single-line regression (someone drops the tenant predicate). Re-ran the suite against this weakened database: **it failed**, red, specifically on `'stores': a caller in a DIFFERENT tenant cannot read, write or delete this table's row` — `cross-tenant DELETE on 'stores' must not affect any row: expected false to be true`. Dropped the throwaway database afterward; nothing in the shared dev database was touched.

**One nuance worth recording, found by reading the actual failure, not assumed:** the SELECT and UPDATE assertions in that same failing run did **not** independently fail — only DELETE did. All three probes run concurrently (`Promise.all`) against the *same* seeded row; under the weakened policy the DELETE also succeeded and removed the row, so by the time the SELECT/UPDATE probes' snapshots were taken the row was already gone — they read "0 rows" for the right *symptom* (row absent) but not as *independent proof* that read/write were each denied by policy in this particular run. The suite still went red overall (DELETE alone is sufficient to fail the test), and in every possible execution ordering *at least one* of the three probes will surface a fully-open policy (if DELETE runs last, SELECT sees the still-present row first and fails there instead) — so the suite cannot silently pass against a completely broken policy. But a hypothetical policy broken for SELECT/UPDATE specifically while DELETE remains correctly denied would be caught cleanly (nothing removes the row in that case); a policy broken for DELETE while SELECT/UPDATE are also broken is caught, but only via the DELETE assertion, not as three independent confirmations. Not a false pass — a real gap in how much each single run proves per-operation. Noted for the record, not fixed (read-only pass).

**Verdict: exit criterion 1 is now MET**, not PARTIAL. Read: `store-read.integration.spec.ts:96` (cross-tenant read denied, session-level), `platform/db/tenant-context.spec.ts:94` (fails closed with no context), `apps/api/tenant-isolation-rls.spec.ts` (write/delete, all six tables, live-enumerated, now in CI's own suite — pending §0's caveat that this commit's CI run itself has not executed).

---

## 2. The `membership.revoke` concurrency defect

**Read `modules/tenant/application/revoke-membership.service.ts` and `modules/tenant/infrastructure/membership.repository.pg.ts` in full.**

No unlocked count survives anywhere in the path. `revoke-membership.service.ts:92` calls `this.memberships.lockActiveForUpdate(command.tenantId)` immediately after the tenant check; both decisions that report II flagged as racy now read from its result, `lockedActive`, not from any separate count or from `target`'s own pre-lock snapshot:
- "already revoked" (line 95): `!lockedActive.some((m) => m.id === target.id)`
- "last member" (line 98): `lockedActive.length <= 1`

`membership.repository.pg.ts:38-47` implements `lockActiveForUpdate`: `SELECT id, tenant_id, user_id, status, created_at FROM memberships WHERE tenant_id = $1 AND status = 'ACTIVE' FOR UPDATE`.

**Does the lock actually serialize the report-II interleaving, under READ COMMITTED?** Yes, and the mechanism is worth stating precisely because it is not "the isolation level changed" — it didn't; this codebase still never sets anything but the Postgres default. It works because of standard `SELECT ... FOR UPDATE` re-check behavior under READ COMMITTED (documented Postgres behavior, not specific to this code): a second transaction's `FOR UPDATE` blocks on any row already locked by a first, in-flight transaction; once the first commits, the second's query re-evaluates that row's *new* version against its own `WHERE` clause. In the two-owner race, T2 (revoking Bob) requests a lock on the tenant's whole active set, which includes Alice's row — already locked by T1 (revoking Alice). T2 blocks until T1 commits Alice's `status = 'REVOKED'`; on waking, T2 re-checks Alice's row, finds it no longer matches `status = 'ACTIVE'`, and excludes it. T2's `lockedActive` therefore correctly reflects post-commit reality — `[Bob]`, length 1 — and the "last member" check (or, in a larger org, the owner-count check below) fires correctly.

**The owner-count read is not independently locked, and does not need to be — verified by reading `RoleGrantRepositoryPg.countActiveMembersWithRole` directly** (`modules/authorization/infrastructure/role-grant.repository.pg.ts:54-65`): it joins `membership_roles` → `roles` → `memberships`, filtered on `memberships.status = 'ACTIVE'` (line 62). Since T2 cannot reach *this* query until its own `lockActiveForUpdate` call has unblocked — which only happens after T1 has fully committed — T2's owner-count read is guaranteed to execute strictly after T1's commit, on a fresh READ COMMITTED snapshot that already reflects it. The whole-tenant membership lock is what forces this ordering; no separate lock on `membership_roles` is needed, exactly as the code's own doc comment (`membership.repository.ts:79-84`) claims, and this pass confirms that claim rather than taking it on faith.

**"What happens to a concurrent revoke of a member who is NOT in the locked set" — not possible within one tenant, by construction.** `lockActiveForUpdate`'s `WHERE` clause is `tenant_id = $1 AND status = 'ACTIVE'` — every currently-active membership in the tenant is locked, not just the caller's stated target. Since the target was already confirmed to belong to this tenant (the `target.tenantId !== command.tenantId` check runs before the lock), it is necessarily inside the locked set if it is active at all. The only rows genuinely excluded are already-`REVOKED` ones (irrelevant to this invariant) and rows in a *different* tenant (correctly and deliberately unserialized with this one — no shared invariant to protect). One real consequence worth naming: this is a coarse, tenant-wide lock, not a row-scoped one. Two *unrelated* concurrent revokes in the same organization (neither owner, no shared invariant between them) are still fully serialized against each other, because both must acquire the same whole-active-set lock. That's a concurrency-*width* cost, not a correctness defect — revoke is an infrequent admin action — but it means this fix trades some throughput for the guarantee, and no test measures or documents that tradeoff.

**Does the concurrent test prove the invariant, or just exercise the path?** Read `apps/api/membership-revoke.integration.spec.ts:439-459` in full. It fires two genuine HTTP requests via `Promise.all` with no `await` between them, each targeting the *other* of an org's only two owners, against the real running app and real Postgres — not simulated, not mocked. It asserts exactly one 200, exactly one 409-or-401 (line 451-452), and then re-reads both membership rows from the database and asserts exactly one is `ACTIVE` (line 459) — the actual end-state invariant, not just that the two HTTP calls returned *some* pair of status codes. This proves the invariant, not merely the path. Re-ran it independently, five times in a row against the real dev database this pass: 5/5 green, no flakiness (`Duration` 2.4–2.9s each). Could not regress-test it against the pre-fix code this pass, since the task's read-only constraint forbids editing any code, even temporarily — the reasoning above (the FOR UPDATE re-check mechanism, traced through both repository methods) is offered as the substitute for that experiment.

**One coverage gap found, not present in either earlier report:** only the two-owner race has a dedicated concurrent regression test. The lower-severity "same-target double revoke" race report II also named (two callers racing to revoke the *same* membership) has no equivalent concurrent test — its correctness was reasoned through in this pass (§ above: the second caller blocks on the same row, then correctly sees `REVOKED` and returns `CONFLICT`) but not empirically exercised the way the owner race was.

**Verdict: the fix is real, correctly reasoned, and demonstrated stable under load this pass. Finding 1 is closed**, with two minor, non-blocking notes (coarse lock width; missing same-target concurrent test) recorded above rather than silently passed over.

---

## 3. The stale claim, and a fresh tree-wide grep

`REPOSITORY_AUDIT_REPORT.md:63` (line shifted from the review's cited `:61` by the two amendment-note insertions above it) now reads: *"`docker-compose.yml` provides PostgreSQL 16 on host port 5433... **Stale as of 2026-08-24 (gate review Finding 3, missed by this document's own §0/§4.5/§4.6 amendment note above): `docker-compose.yml` now pins `postgres:17-alpine`, not 16 — see the amendment note at the top of this file.**"* — the original claim is left intact (this document's own convention for a dated record) but is no longer silently wrong; a reader lands on the correction immediately. A second amendment note (lines 11) confirms §3.2 was added to the original note's scope.

Fresh tree-wide grep this pass, case-insensitive, for `PostgreSQL 16|Postgres 16|postgres:16`: six hits, all in `CLAUDE.md:71`, `PHASE_1_GATE_REVIEW_2026-08-24-II.md:122`, `PHASE_1_GATE_REVIEW_2026-08-24.md:93`, `RISK_REGISTER.md:9`, `REPOSITORY_AUDIT_REPORT.md:11,63`. Every one is either a dated report's own historical text (left correctly unedited, per convention) or a correction narrative explicitly describing the fix — none present "PostgreSQL 16" as a live, current, unqualified fact. `docker-compose.yml:3` itself pins `postgres:17-alpine`, confirmed by direct read.

**Verdict: Finding 3 is closed.**

---

## 4. Diff review — `git diff d7bdf7d..fd13c1e`, read as a reviewer

16 files, +500/-41. The interface change (`MembershipRepository.countActive(tenantId): Promise<number>` → `lockActiveForUpdate(tenantId): Promise<Membership[]>`) has exactly one real implementation (`membership.repository.pg.ts`) and five call-site fakes (`assign-membership-role`, `create-organization`, `invite-member`, `resolve-store-access` — all four asserting their service under test must never call it, unchanged in spirit, just renamed; `revoke-membership.service.spec.ts`'s own fake, which now returns an array). A tree-wide grep for `countActive\b` this pass found zero remaining live references outside prose/doc comments — confirms the rename is complete, not partially applied. `npm run typecheck` (which would fail loudly on any interface mismatch a stray fake left behind) is clean.

**What this change could have broken that its own tests would not notice**, beyond the two items already logged in §2:
- **Lock-width/throughput regression** (already noted above) — no test exercises or bounds it.
- **A new cross-module read dependency was NOT introduced**: `RoleGrantRepositoryPg.countActiveMembersWithRole`'s `memberships.status` filter (confirmed by direct read, §2) is what makes the fix's "one lock covers both counts" claim true; had that join been missing or unfiltered, the owner-count race would still exist despite the memberships lock, and nothing in the current test suite would have caught it specifically (the two-owner integration test happens to also validate the owner path, but only because the test's fixture makes the member-count and owner-count checks coincide — an org with 3+ active members where only 2 are owners is not covered by any concurrent test, unit or integration). This is a real, if narrow, blind spot: the concurrent test proves the two-owner *scenario*, not the owner-count-race mechanism in isolation from the member-count check.
- No regression found in the four "must not call" fakes' own guarantees — each still throws if its service under test calls `lockActiveForUpdate`, confirmed by reading all four diffs directly.

---

## 5. Mechanical verification (this pass, on `fd13c1e`)

```
npm run typecheck          → clean, 0 errors
npm test                   → Test Files 35 passed (35) · Tests 351 passed (351)
npm run conformance        → Conformance harness: PASS (0 violations, 0 justified exception(s))
npm run db:migrate         → against nexora_rls_probe, a genuinely empty throwaway database
                              (created for §1's teeth-check, dropped after): Applied 20, already
                              up to date: 0 — all 20 migration files, ending
                              20260824100000_authorization__add_membership_revoke_permission.sql
npm run graph -- --check   → Project graph: up to date.
npm run openapi -- --check → OpenAPI artifact up to date (10 capabilities).
```

All local mechanical checks pass on this exact commit. **CI itself has not executed on this commit** — see §0.

---

## 6. Exit criteria (`08_PHASE_1_BRIEF.md` §6) — all nine, read fresh this pass

| # | Criterion | Verdict | Proving test, assertions read this pass |
|---|---|---|---|
| 1 | Tenant A cannot read/write/delete/execute against Tenant B data | **MET** (was PARTIAL) | `apps/api/tenant-isolation-rls.spec.ts` — live-enumerated, all six tables, teeth confirmed by live regression (§1). Plus `store-read.integration.spec.ts:96`, `tenant-context.spec.ts:94`. |
| 2 | A valid session with a `storeId` belonging to another tenant is denied | **MET** | `store-read.integration.spec.ts:96-104`: asserts `403`/`STORE_ACCESS_DENIED` for a cross-tenant store id — read directly this pass. |
| 3 | A query without tenant context returns zero rows and raises an error | **MET** | `store-read.integration.spec.ts:296-303` (DB-level, zero rows) + `:318-323` (app-level, stable `401`/`AUTHENTICATION_REQUIRED`, `message` asserted not to match `/relation|syntax|SQL|pg_/i`) — both read directly this pass; the application-layer half remains "met by construction," stated honestly in the test's own comment, not claimed as test-proven where it isn't. |
| 4 | Revoking a membership invalidates active sessions within one request | **MET** | `membership-revoke.integration.spec.ts:126-135`: session `ACTIVE`→`REVOKED` asserted, then a genuinely separate request with the same cookie against an unrelated capability — read directly this pass. |
| 5 | Every capability in scope emits an audit event | **MET** | Grepped fresh this pass: exactly 10 controller files call `recordAuditEventDurable`, matching the 10 capabilities exactly. |
| 6 | Every error path returns a documented code | **MET** | `npm run conformance` run fresh this pass → 0 violations, including `ERROR-CODE-UNDOCUMENTED`/`ERROR-CODE-UNDECLARED`. |
| 7 | Conformance harness green with 0 or fully-justified exceptions | **MET** | Same run: `PASS (0 violations, 0 justified exception(s))`; `exceptions.json` unchanged at `[]`. |
| 8 | Integration tests run against real PostgreSQL, not mocks | **MET** | Grepped fresh: no `pg-mem`/sqlite-family package in `package.json`; no `vi.mock`/`jest.mock` of the DB layer in `apps/api/*.spec.ts`. |
| 9 | `Money` allocator: parts sum to the whole over randomized inputs | **MET** | `money.vo.spec.ts:144-171` read directly this pass: seeded RNG, 5000 iterations, `Money.sum(parts, currency).amountMinor === amountMinor` plus fairness/structural invariants. |

**9 of 9 criteria independently verified MET this pass**, each read at the assertion level, not carried forward from either earlier report's verdict.

---

## 7. Verdict

**All nine exit criteria are MET. The two findings that withheld the gate on 2026-08-24 (Finding 1: the concurrency race; Finding 2: missing cross-tenant regression coverage for five of six tables) are both genuinely closed, verified independently in this pass — including a live demonstration that the RLS suite fails when a policy is actually broken, and a traced, mechanism-level explanation (not just an assertion) of why the row lock closes the concurrency race under this codebase's real, unchanged isolation level. Finding 3 (the stale documentation claim) is also closed.**

**The gate does not fully open on this commit today, for exactly one reason: CI has not run on `fd13c1e`.** `08_PHASE_1_BRIEF.md` §6 and this project's own conformance-harness convention (ADR-030) treat CI as part of what "proven" means, not an optional rubber stamp on locally-verified work — and the second gate review itself treated a green CI run on the reviewed commit as first-class evidence, checked directly via `gh run view`, not assumed. This pass could not do the same: run `32985409838` has been stuck in `queued` with zero jobs assigned for over 30 minutes, coinciding with today's repository visibility change to private, and is outside this read-only pass's scope to fix. **What stands between here and open: a successful CI run on `fd13c1e`** (or a subsequent commit, re-checked the same way). Everything else this review could verify locally is verified.

### What Phase 2 is and is not ready for, once CI confirms

**Ready:** the tenant-isolation guarantee Phase 2's payment/subscription tables will depend on is now proven in CI-runnable form for every existing tenant-owned table, live-enumerated so new Phase 2 tables inherit the same proof automatically rather than needing a hand-written test each time. `modules/money`'s allocator (criterion 9) is ready as-is for Phase 2's billing math. The `Clock` injection seam (ADR-031) is in place.

**Not ready, inherited rather than resolved by this pass — same three the second review named, unchanged:**
- **R-003** (ACCEPTED, not a gap to close) — the `memberships`/`store_memberships` self-access RLS clause remains a deliberate, permanent widening beyond plain `tenant_id` scoping. Nothing in this pass touched it.
- **R-005** (OPEN) — `auth.login` still has no rate limiting or lockout; Phase 2 adds more public, high-value surfaces (payment callbacks) with the identical need. Not touched this pass.
- **R-006** (OPEN, hardening) — `PermissionCheckRepositoryPg.hasPermission` still does not independently filter by membership status; still safe only because every current caller is guard-verified first. Not touched this pass.
- **New, from this pass, non-blocking but worth Phase 2 awareness:** the coarse tenant-wide lock `membership.revoke` now takes (§2) trades revoke throughput for correctness — fine at Phase 1's scale, worth remembering if Phase 2 introduces any other capability that writes `memberships` rows under load. The RLS suite's same-row-probe-interference nuance (§1) means a future table added to the suite gets *a* red/green signal reliably, but not always three independently-conclusive ones per run.
- **The ADR-009 shared idempotency service** — still not built, still the most-cited Phase 2 blocking prerequisite, unchanged by this pass (out of this pass's scope; re-flagging per the second review's own §5).

---

**Committed as this report only, per instruction** — no code, test, migration, workflow or normative document was edited in this pass. Everything cited above was read, run, or (for §1's teeth-check) exercised against a throwaway database created and dropped for that purpose alone.
