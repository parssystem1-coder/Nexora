# Phase 1 Gate Review

**Date:** 2026-08-22
**Reviewed commit:** `49fde2c` (working tree clean except two new untracked docs, `.claude/` and `README_INSTALL.md`, neither of which is product code)
**Method:** ran the build/test/migration/conformance commands directly against a native PostgreSQL 17 install (Docker is unavailable in this environment — confirmed `docker: command not found`); read code and ran empirical `psql` checks before reading the repository's own status documents, per this skill's instruction to form an independent judgment first.

---

**Amendment, 2026-08-24 (from the 2026-08-24 gate review's Finding 3):** this review's characterization of the native PostgreSQL 17 install as a stand-in for an unverified `docker-compose.yml` path (line 75 in particular) was accurate on 2026-08-22 and is left as written. It stopped being true on 2026-08-23/24: CI executed for real against `docker-compose.yml` and passed end to end (`RISK_REGISTER.md` R-001, CLOSED), and `docker-compose.yml` now pins `postgres:17-alpine`, matching this review's native install rather than the `16-alpine` it ran on between then and now. Read this review as history; read `PHASE_1_GATE_REVIEW_2026-08-24.md` for the next one.

## 1. Verdict

**Phase 2 cannot open yet, and this is not a surprise finding — the repository's own documents already say so accurately.** Task 1 (the golden path, `store.read`) is genuinely done to a high standard: every claim I checked against it held up exactly as documented. But Phase 1 as a whole is not finished — Task 2's six remaining slices (`organization.create`, `membership.invite`, `membership.role.assign`, `store.create`, `auth.login`/`logout`/`logout_all`, `organization.switch`) have not been started, two of the brief's nine explicit exit criteria are unmet with no code behind them at all (membership-revocation session invalidation, the `Money` allocator), and the CI workflow required by `AGENTS.md` §0 as a non-negotiable precondition to writing feature code has never actually executed — it exists as a file only, because the repository has no git remote. None of this is new information; it corrects nothing the repository claims about itself. It is a confirmation, plus one live documentation contradiction (§4, finding 2) that the repository's own audits had flagged but not resolved.

---

## 2. Evidence — commands run, real output

All commands run from a clean working tree, against native PostgreSQL 17 (`localhost:5432`), using the `nexora_app`/`nexora_migrate` roles `platform/db/init/001_roles.sql` defines (roles already present on this machine from a prior session).

| Command | Result |
|---|---|
| `npm run typecheck` | Clean, no output, exit 0 |
| `npm run db:migrate` (fresh throwaway database `nexora_gate_check`, created empty, dropped after) | `Applied 11, already up to date: 0` — all 11 migrations apply cleanly together from empty |
| `npm test` (against the existing migrated `nexora` database) | `Test Files 12 passed (12)`, `Tests 74 passed (74)` |
| `npm run conformance` | `Conformance harness: PASS (0 violations, 0 justified exception(s))` |

These numbers match what `CLAUDE.md`, `PHASE_1_REPAIR_REPORT.md` and `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` claim exactly (74/12/11/0).

**RLS reality, checked empirically, not read from SQL text** (throwaway database, `nexora_migrate`-owned row, queried as `nexora_app`):

```
insert org as nexora_migrate                    → succeeds
select as nexora_app, no app.tenant_id set       → 0 rows
select as nexora_app, app.tenant_id = own org    → 1 row
select as nexora_app, app.tenant_id = other org  → 0 rows
```

`pg_class.relrowsecurity`/`relforcerowsecurity` on the migrated schema: both `t` on every tenant-owned table (`organizations`, `memberships`, `stores`, `store_memberships`, `membership_roles`, `audit_events`); both `f` on the five documented exemptions (`users`, `sessions`, `roles`, `permissions`, `role_permissions`) — matches `08_PHASE_1_BRIEF.md` §5's exemption list exactly, including the `sessions`/role-catalog amendments recorded in `DECISION_LOG.md`.

`platform/db/assert-role-safety.ts` is wired into `platform/db/tenant-context.spec.ts`'s `beforeAll` (confirmed by reading the file) — a superuser or `BYPASSRLS`-capable connection cannot pass the isolation tests silently.

**Table scope:** 11 tables + `schema_migrations` exist (`\dt`), all 11 within the ≤16-table allow-list in `08_PHASE_1_BRIEF.md` §4. Nothing extra.

**CI:** `git remote -v` returns nothing; `git branch -a` shows only `master`. `.github/workflows/conformance.yml` is committed but, by construction, has never run — there is nowhere for GitHub Actions to run it.

---

## 3. Exit criteria (`08_PHASE_1_BRIEF.md` §6)

| # | Criterion | Result | Proving test / evidence |
|---|---|---|---|
| 1 | Tenant A cannot read/write/delete/execute Tenant B data | **MET** (for the one capability that exists; mechanism is capability-agnostic) | `apps/api/store-read.integration.spec.ts` — "denies a valid session reading a store belonging to another tenant"; `modules/tenant/infrastructure/organizations-rls.spec.ts` (4 tests, `pg_policy` introspection + cross-tenant UPDATE); empirical `psql` check above |
| 2 | A valid session with another tenant's `storeId` is denied | **MET** | same test as above, asserts `403 STORE_ACCESS_DENIED` |
| 3 | A query without tenant context returns zero rows **and** raises an application error | **MET** | `store-read.integration.spec.ts` — "a query issued without tenant context returns zero rows, at the database level" (DB-level) + "the application layer raises a stable AUTHENTICATION_REQUIRED error" (app-level) — both halves tested separately, as the skill requires |
| 4 | Revoking a membership invalidates active sessions within one request | **NOT MET** | No code: `grep -ri "invalidat\|logout_all\|revok.*session"` across the tree returns nothing. `membership.revoke` doesn't exist. Confirmed by the repo's own table in `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §4 |
| 5 | Every capability in scope emits an audit event | **PARTIAL** | Met for the 1 of 7 Phase-1 capabilities that exists (`store.read` — both `SUCCESS` and `FAILURE` rows proven against real Postgres in `store-read.integration.spec.ts`). The other six don't exist yet, so the criterion can't be fully claimed; see Finding 4 |
| 6 | Every error path returns a documented `05` code | **MET** (for the golden path's reachable error surface) | `apps/api/error-contract.integration.spec.ts` (3 tests) + `modules/capability/interfaces/http-exception.filter.ts`'s `STATUS_TO_CODE` map, read and confirmed to match `05_API_CAPABILITY_CONTRACTS.md` §7's code list exactly for the 5 statuses this API currently produces |
| 7 | Conformance harness green, empty/justified exceptions | **MET** | `npm run conformance` → 0 violations; `exceptions.json` is literally `[]` |
| 8 | Integration tests run against real PostgreSQL, not mocks | **MET** | No `pg` mock anywhere in the test tree; `assert-role-safety.ts` wired into `tenant-context.spec.ts` so a bypass-capable role fails loudly rather than passing vacuously |
| 9 | `Money` allocator test proves parts sum to whole over randomized inputs | **NOT MET** | No `Money`/`currencies` code exists anywhere: `grep -ril "Money\|currencies\|currency" modules` returns nothing |

**7 of 9 rows check out under independent verification; the 2 the repository itself marks unmet are in fact unmet, with nothing partially built toward them.**

`06_IMPLEMENTATION_PLAN.md`'s own Phase 1 exit line — *"Proven by the tenant isolation suite in CI"* — is not literally true yet: the suite passes locally but has never run in CI, because CI has never executed at all (§4, finding 1). Local proof and CI proof are not the same claim, and this skill's instructions are explicit that a workflow which has never executed does not satisfy that bar.

---

## 4. Findings, ordered by cost of leaving them

### Finding 1 — The CI harness required by `AGENTS.md` §0 as a precondition to any feature code has never executed [HIGH]

**Location:** `.github/workflows/conformance.yml` (whole file); `AGENTS.md:1-8` (§0, non-negotiable #3: "The mechanical conformance harness required by ADR-030 runs in CI and fails on violation").

`git remote -v` is empty; there is no branch but `master`. The workflow is well-formed and would very likely work (it mirrors the exact commands verified in §2), but "would very likely work" is precisely the gap between a demo and a CI-proven gate that `06_IMPLEMENTATION_PLAN.md` line 6 exists to close ("a phase exit is a test in CI, never a screenshot"). Six feature-implementing commits (`0d0d681` through `49fde2c`) have already landed under a documented "must be true before feature code" precondition that remains unmet. This is tracked honestly as `RISK_REGISTER.md` R-001 — not a surprise — but it is still open, and it is the single fact that would most cheaply and most fundamentally raise confidence in everything else in this report if resolved.

**Fix:** push to a real remote (even a private one) and let the workflow run once. This also finally verifies R-001's other open half — that `docker-compose.yml`'s Postgres path (image pull, port 5433 mapping, healthcheck) actually works, since every verification to date (mine included) has used a native PostgreSQL install as a stand-in, never the compose file itself.

### Finding 2 — The golden path's audit-placement pattern contradicts `03_TECHNICAL_BLUEPRINT.md`, which outranks the document that was amended to match it [MEDIUM-HIGH]

**Location:** `03_TECHNICAL_BLUEPRINT.md:122-127` vs. the actual implementation (`modules/tenant/interfaces/store.controller.ts`, `modules/audit/contracts/audit.contract.ts`'s `recordAuditEventDurable`) and `08_PHASE_1_BRIEF.md:52` (already amended).

`03_TECHNICAL_BLUEPRINT.md` §3.1's pipeline diagram still reads:

```
Execute Application Service → Commit Domain Data + Outbox → Audit → Return Stable Result
```

— audit strictly *after* the domain transaction commits (option C in `DECISION_LOG.md`'s framing). But the actual, tested, frozen golden path implements option B: `recordAuditEventDurable` runs on a separate connection (`AUDIT_DB`), invoked from the controller before it returns or re-throws, independent of whether the domain transaction (`APP_DB`) committed or rolled back. `08_PHASE_1_BRIEF.md` §2 step 8 was amended to describe option B correctly (confirmed by reading it — it now says "written before commit but on a separate connection that commits independently"). `03_TECHNICAL_BLUEPRINT.md` was not amended to match.

Per `CLAUDE.md`'s stated precedence — *"ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec"* — `03` (a Technical/Contract doc) ranks **above** `08` (the Phase 1 Brief, closer to "Platform Overview" tier in spirit, and not in the named precedence list at all). The document that was actually updated to match the implementation is not the one with authority; the one with authority still describes a different, rejected option. `AGENTS.md` §2 is explicit that this class of finding — the golden path disagreeing with a normative document — is high-severity *even when every test is green*, because the golden path is what every later slice mirrors; a wrong pattern here multiplies once Task 2 starts, and Task 2's very first item (`organization.create`) is named in `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §5.3 as reusing this exact mechanism.

This is not undiscovered — `DECISION_LOG.md`'s "Conflict: is the audit event inside the transaction..." entry ends with its own citation note: *"the audit-placement options live in `DECISION_LOG.md`, which is... not part of the precedence chain... If this rule should be normatively citable it needs its own ADR; flagged rather than assumed."* That flag was never resolved.

**Fix:** either amend `03_TECHNICAL_BLUEPRINT.md` §3.1's diagram to read `Execute → Audit (durable, independent connection) → Commit Domain Data + Outbox → Return`, or promote the option-B decision to a real ADR as the citation note itself recommends, so the golden path's most distinctive design choice is backed by a document actually in the precedence chain rather than by `DECISION_LOG.md` (a working log, explicitly excluded from precedence) plus one brief that happens to have been kept in sync.

### Finding 3 — Two exit criteria are unmet with zero code behind them, and one blocks Phase 2 directly [MEDIUM]

Already covered in the table in §3 (rows 4 and 9). Restated here only for the Phase 2 linkage: `06_IMPLEMENTATION_PLAN.md`'s Phase 1 order lists the currency registry and `Money` value object as *step 4, before the golden path itself*, specifically "because Phase 2 cannot be retrofitted with it" — and Phase 2 step 1/2 (plan, price) are priced in `Money` from the start (`04_DATABASE_BLUEPRINT.md`). This was a deliberate, documented sequencing choice that Task 1 did not follow (confirmed reasonable at the time — `DECISION_LOG.md` "Task 1 migration scope" explicitly defers `currencies` to "whichever later Task 2 slice first needs them" — but it means Phase 2 is structurally blocked on Task 2 work, not just procedurally waiting on it).

### Finding 4 — The Task 1 completion document's exit-criteria table slightly overstates row 5 [LOW]

**Location:** `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md:143` marks "every capability emits an audit event" as a plain "✅" row.

It's accurate for what exists (`store.read`, proven both success and failure paths) but the criterion as worded in `08_PHASE_1_BRIEF.md` §6 is phase-wide ("every capability in scope"), and 6 of the 7 Phase-1-scoped capabilities don't exist yet to check. The distinction matters because Task 2's slices should each be required to reprove this row, not inherit a phase-wide checkmark earned by one capability — worth rewording to "✅ for the capability built so far" so a future reader (or a future gate review) doesn't read this as phase-complete.

### Finding 5 — R-003 (self-access RLS clause) is an open, load-bearing risk directly ahead of Task 2's first slices [LOW, informational]

`RISK_REGISTER.md` R-003 is accurately described and currently behaviorally correct (tested), but is explicitly flagged for re-evaluation "at Task 2," and Task 2's first three slices (`organization.create`, `membership.invite`, `membership.role.assign`) all touch the same `memberships`/`store_memberships` tables this clause governs. Not a defect today; flagging only because it sits directly on the path of the very next work.

---

## 5. Next-phase prerequisites (`06_IMPLEMENTATION_PLAN.md` Phase 2, steps 1-4)

| Phase 2 step | Status | What's missing |
|---|---|---|
| 1. plan and plan version | Not started (correct — Phase 2 not open) | No `plan`/`plan_version` tables or module; expected at this stage |
| 2. price and price version | Not started | Depends on `Money` (below) being real first |
| 3. shared idempotency service (ADR-009) | **Missing entirely** | `grep -ril idempotency modules platform` finds only conformance-harness rule code and fixtures (the mechanism that would *detect* a duplicate idempotency implementation), not an implementation. Confirmed nothing beyond scaffolding exists |
| 4. subscription + `subscription_periods` + serving-state function | Not started | Depends on steps 1-3 |

The one prerequisite that actually blocks Phase 2 structurally rather than just sequentially is `Money`/`currencies` (Finding 3) — it's a named Phase 1 deliverable, not a Phase 2 one, and every later Phase 2 table that touches price is typed against it.

`outbox_events` (needed later, Phase 2 payment reconciliation and Phase 4's projection) does not exist yet either — expected at this stage, not a blocker for Phase 2's first steps specifically.

---

## 6. Recommended order

1. **Finish Task 2's six slices** (`08_PHASE_1_BRIEF.md` §3), starting with `organization.create` as already scoped in `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §5 — each mirroring the golden path per `AGENTS.md` §2. This closes exit criterion 5 properly (one audit-emitting capability at a time) and is the only way `credentials`/`identity_providers`' RLS tenancy decision (currently deliberately deferred) gets made on real evidence rather than speculation.
2. **Build `Money`/`currencies` and its allocator test** before or alongside slice 4 (`store.create`) — it's cheaper now, while only 11 tables exist, than after Task 2 adds more monetary-adjacent surface. This closes exit criterion 9 and unblocks Phase 2 structurally, not just procedurally.
3. **Build `membership.revoke`'s session-invalidation behavior** as part of (or immediately after) slice 3 (`membership.role.assign`), since revocation is the natural companion capability to role assignment and closes exit criterion 4.
4. **Push to a real git remote and let `.github/workflows/conformance.yml` execute at least once**, ideally in parallel with the above rather than blocking them — it's independent of Task 2's code and closes Finding 1 and the `docker-compose.yml` half of R-001 for free the first time it runs.
5. **Resolve Finding 2** (amend `03_TECHNICAL_BLUEPRINT.md` §3.1 or write the ADR the citation note asks for) before Task 2's `organization.create` reuses the audit pattern again — cheap now, compounds if deferred, per `AGENTS.md` §2's own reasoning about the golden path.

Only after 1-3 are all true does `08_PHASE_1_BRIEF.md` §6 read as fully met; only then does `06_IMPLEMENTATION_PLAN.md`'s Phase 1 exit criterion hold in substance. Item 4 is what makes it hold *in CI*, which is what the plan actually asks for.

---

## 7. What I could not verify

- **The `docker-compose.yml` path itself** — Docker is unavailable in this environment (`docker: command not found`), so, like every verification round before this one, I confirmed the migration/RLS/test behavior against a native PostgreSQL 17 install instead. This is the same substitution `REPOSITORY_AUDIT_REPORT.md` and `RISK_REGISTER.md` R-001 already document; I did not add new information here, only confirm the gap is still open.
- **CI execution itself** — cannot be verified by definition; see Finding 1.
- **Whether the native-Postgres roles on this machine (`nexora_app`/`nexora_migrate`) exactly match a truly fresh `001_roles.sql` run** — they predate this session. I did not re-run `001_roles.sql` from scratch against a clean cluster; I verified role *attributes* (`rolsuper`/`rolbypassrls`/ownership) directly via `pg_roles`, which is the property that actually matters for RLS correctness, and it matched the script's intent exactly.

Everything else in this report reflects direct command output or direct inspection of the code, not a restatement of the repository's own claims.
