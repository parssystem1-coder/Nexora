# Repository Audit Report

**Date:** 2026-08-22
**Scope:** Phase 0, Task 0 — mandated by `AGENTS.md` section 0 and `08_PHASE_1_BRIEF.md` section 1.
**Auditor:** AI implementer, first session.

---

## 0. Amendment (same session, second pass)

The user asked for four additional things beyond the first pass: (1) extend the secret rules to cover snapshot/log-embedded credentials and confirm the host-resolution singleton role, (2) run the schema-conformance rule against a real, migrated PostgreSQL database instead of only static SQL-text parsing, (3) log — not silently resolve — a real contradiction between `06_IMPLEMENTATION_PLAN.md`'s 7-item Phase 0 list and `08_PHASE_1_BRIEF.md`'s 3-item list, and (4) build only the minimal additional scaffold needed for that (docker-compose, migration runner, the one transaction/RLS helper, config loading, corrected directory structure), with every tool choice logged. All four are done; see `DECISION_LOG.md` for the contradiction write-up and every tool-choice rationale, and section 4.5 below for the live-DB verification. Tables in this report below were updated in place rather than duplicated, so the numbers here reflect the current, post-amendment state.

**Environment note:** Docker is not available in this session's sandbox (`docker`/`docker compose` — command not found, in both Bash and PowerShell). `docker-compose.yml` is provided and is what CI (`.github/workflows/conformance.yml`) and any developer with Docker will use. To still prove the live-DB mechanism actually works rather than just compiling, this session used a PostgreSQL 17 instance already installed natively on this machine (found listening on `localhost:5432`) as a substitute: created a scratch `nexora` role/database there, ran the migration runner and the live schema-conformance check against it for real (see 4.5), then left that role/database in place since it's harmless, dev-only, and matches what `docker-compose.yml` would produce. **A human should still run `docker compose up -d && npm test` at least once** to confirm the Docker path itself works, since only the native-Postgres path was exercised here.

---

## 1. Summary

**This is a new repository.** Before this session it contained only the documentation pack (12 numbered specs + `AGENTS.md` + `README_START_HERE.md`) and a `future/` folder that is out of scope for Phase 1 and was not read. There was no `package.json`, no source code, no database, no migrations, no tests, and no CI. No git repository existed either (`git status` failed with "not a git repository").

Per `AGENTS.md` section 0: *"If the repository is empty or newly scaffolded, the audit is not skipped, it is trivial... Produce it anyway."* Everything below that isn't documentation is therefore classified `MISSING`. This is normal for session 1 and is not a blocker.

This session's output turns the repository from "docs only" into "docs + a working toolchain + a working, self-proving conformance harness + a migration runner and RLS helper proven against a real PostgreSQL database." No feature code, no NestJS/Next.js app, and no golden path (`store.read`) were built — those are Task 1 of `08_PHASE_1_BRIEF.md` and are explicitly out of scope until this report and the harness are reviewed. See section 0 for what changed in this session's second pass.

---

## 2. Classification legend

| Code | Meaning |
|---|---|
| MATCH | Present and consistent with the docs pack |
| PARTIAL | Present but incomplete or not yet conformant |
| MISSING | Not present; needs to be built |
| CONFLICT | Present but contradicts the docs pack |
| UNKNOWN | Could not be determined without information outside this session's scope |

---

## 3. Findings

### 3.1 Documentation pack

| Area | Status | Notes |
|---|---|---|
| `README_START_HERE.md`, `AGENTS.md`, `08_PHASE_1_BRIEF.md` | MATCH | Read in full this session per the mandated read order. |
| `02_ADR_INDEX_NORMATIVE_DECISIONS.md` (ADR-030, ADR-031, ADR-032) | MATCH | Read the sections needed to build the harness and to understand time/storefront boundaries. |
| `03_TECHNICAL_BLUEPRINT.md` | MATCH | Read in full; module layout (section 2) and Phase 0 deliverables (section 4) drove the scaffold below. |
| `01_ARCHITECTURE_BASELINE_RFC.md`, `04_DATABASE_BLUEPRINT.md`, `05_API_CAPABILITY_CONTRACTS.md`, `06_IMPLEMENTATION_PLAN.md`, `07_ARCHITECTURE_GAP_REPORT.md`, `09_CHANGELOG_AND_CORRECTIONS.md` | UNKNOWN | Not loaded this session, per the context-budget rule in `README_START_HERE.md` ("loaded on demand for the current slice"). Nothing in Phase 0 required them. Will be pulled section-by-section when the golden path (Task 1) starts. |
| `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, ADR-011–ADR-018, any Phase 1+ doc beyond the three named files | N/A — not read | Explicitly forbidden for this session. Confirmed still present on disk and untouched. |

### 3.2 Toolchain and dependencies

| Area | Status | Notes |
|---|---|---|
| Node/npm availability | MATCH | Node v24.18.0, npm 11.16.0, registry reachable. |
| `package.json` | MISSING → now scaffolded | Created this session. Runtime dependencies: `pg`, `kysely`. Dev toolchain: `typescript`, `tsx`, `vitest`, `@types/node`, `@types/pg`. No NestJS, Next.js or Redis/BullMQ yet — those belong to Task 1 (golden path), not Task 0. Query builder (ADR-021) is now decided: **Kysely**, confirmed by the user; see `DECISION_LOG.md`. |
| `tsconfig.json` | MISSING → now scaffolded | Strict mode on. Covers `tools/`, `modules/`, `platform/`. Excludes `tools/conformance/fixtures` from type-checking since those files contain deliberately-invalid imports by design. |
| Dependency audit | PARTIAL | `npm install` reports 5 vulnerabilities (3 moderate, 1 high, 1 critical), all transitive, all inside `esbuild`/`vite`'s dev-server CORS advisory (GHSA-67mh-4wv8-2f99), pulled in by `vitest`. This class of finding only affects a running `vite` dev server, which this project does not start. `pg` itself has no reported advisories at the installed version. Re-run `npm audit` once the real app dependencies (Task 1: NestJS/Next.js) are added. |
| Database setup | MATCH | `docker-compose.yml` provides PostgreSQL 16 on host port 5433 (chosen to avoid colliding with a developer's pre-existing local Postgres — see `DECISION_LOG.md`). `platform/config.ts` loads `DATABASE_URL` from the environment with a dev-friendly default matching docker-compose. `platform/db/kysely.ts`'s `createDb()` is the one place a Kysely instance is constructed, wrapping `platform/db/pool.ts`'s `pg.Pool`. |
| Migration runner + RLS/transaction helper | MATCH | `platform/db/migrate.ts` (forward-only, raw SQL, tracked in `schema_migrations`) + `platform/db/discover-migrations.ts` (discovers `modules/<module>/migrations/*.sql`) + `platform/db/tenant-context.ts` (the one `@singleton-role: tenant-context` helper, rebuilt on Kysely this session — opens a `db.transaction()`, sets `app.tenant_id` via `set_config(..., true)` as the first statement, commits/rolls back). Proven against a real, running PostgreSQL both structurally (section 4.5) and behaviorally (`platform/db/tenant-context.spec.ts`: tenant isolation, fail-closed, no cross-call leakage, rollback-on-error — 4/4 passing). A new conformance rule (`tools/conformance/rules/db-access.ts`) mechanically forbids any other file from importing `pg` directly or calling `.transaction(` — see `DECISION_LOG.md`. |
| Config/secret loading | MATCH | `platform/config.ts` — `DATABASE_URL` / `CONFORMANCE_TEST_DATABASE_URL` from environment only, `.env.example` documents them, `.env` is gitignored. Nothing else needs a secret yet in Phase 0. |
| Migrations (product) | MISSING | Zero actual migrations exist under `modules/*/migrations/` (no modules exist yet). Per-module placement corrected this session from an earlier root-level `migrations/` folder — see `DECISION_LOG.md`. Building real migrations is Task 1/2 work, gated on this report being reviewed. |
| Tests | MISSING (product) / MATCH (harness + DB helper) | No product tests exist (no product code exists). Three self-test files, 28/28 passing: `tools/conformance/harness.selftest.spec.ts` (19 cases, static rules incl. `db-access.ts`), `tools/conformance/harness.selftest.live-db.spec.ts` (5 cases, schema rules against a real migrated PostgreSQL), `platform/db/tenant-context.spec.ts` (4 cases, the RLS helper's behavior against real PostgreSQL). |
| CI/CD | MISSING → now scaffolded | `.github/workflows/conformance.yml`: starts `docker compose up -d --wait` (Postgres), then runs typecheck, the harness self-test (incl. the live-DB cases), and the real-tree conformance scan, on every PR and on push to `main`. Not yet exercised by an actual GitHub remote/PR since there is no git remote configured in this environment (explicit user instruction: local-only, no remote, no push). |
| Git repository | MISSING → now initialized | `git init` run this session (see section 5). No remote configured, per explicit user instruction. |

### 3.3 Conformance harness (ADR-030)

Built this session under `tools/conformance/`. See section 4 for detail. Status: MATCH — all four required check families exist, each has a deliberately failing fixture, and the harness both fails on a broken commit and passes on a clean one (verified live, see section 4.4).

### 3.4 Module/schema scope (`03_TECHNICAL_BLUEPRINT.md` §2, `08_PHASE_1_BRIEF.md` §4)

| Area | Status | Notes |
|---|---|---|
| `modules/` tree (24 modules per the blueprint) | MISSING | `modules/README.md` documents the approved §2.1 per-module structure (`contracts/`, `domain/`, `application/`, `infrastructure/`, `interfaces/`, `migrations/`) so it's discoverable; no module subfolders exist yet — those get created as each slice is implemented, starting with the golden path. The structure is mechanically enforced (not just documented) by `tools/conformance/rules/imports.ts` and `schema.ts`/`schema-live.ts`. |
| Phase 1 tables (`users`, `credentials`, `sessions`, ... `reserved_subdomains`, ~12 tables) | MISSING | Zero migrations exist. Building them is Task 1/2 work, gated on this report being reviewed. |
| `store.read` golden path | MISSING | Not started. Explicitly gated behind this report per `AGENTS.md` section 0 and `08_PHASE_1_BRIEF.md` section 2. |

---

## 4. Conformance harness detail (ADR-030)

### 4.1 What was built

- `tools/conformance/rules/imports.ts` — dependency direction (domain → application/infrastructure/interfaces forbidden; application → interfaces/infrastructure forbidden), cross-module internals (only `contracts/` may be imported across modules), and forbidden-import lists for `domain`, the `plugin` boundary, and repository access from `ai`/`mcp`/`automation`/`storefront`.
- `tools/conformance/rules/singleton.ts` — the five ADR-030 singleton rules (idempotency, tenant-context, serving-state, money-allocator, host-resolution), enforced via an explicit `@singleton-role:` marker comment rather than a naming convention. **This is a Phase 0 judgment call**, logged in `DECISION_LOG.md`, because file names will vary across modules but the architectural claim "this is THE implementation of X" needs to be unambiguous and greppable.
- `tools/conformance/rules/schema.ts` — static SQL-text check: parses `**/migrations/*.sql`: every non-exempt table must have `tenant_id`; every non-exempt table must have both `ENABLE ROW LEVEL SECURITY` and a `CREATE POLICY`; no `FLOAT`/`DOUBLE`/`REAL` column on a money-shaped column name; no more than one `*idempotency*`-named table across all migrations.
- `tools/conformance/rules/schema-live.ts` — the same rules, proven against a real, migrated PostgreSQL database via `information_schema`/`pg_catalog` introspection, per ADR-030 §3 ("a schema conformance test executed against a real migrated database"). See section 4.5.
- `tools/conformance/rules/secrets.ts` — flags AWS-shaped access key IDs, PEM private key blocks, generic `key/secret/password/token = "..."` literal assignments, and — added this session's second pass — the same keywords embedded inside a larger string (`SECRET-IN-LOG-OR-SNAPSHOT`, e.g. a captured log line or a `.snap` file), which the standalone-literal pattern alone would miss. Placeholder values like `changeme` are allow-listed.
- `tools/conformance/rules/db-access.ts` — added with the Kysely decision: only `platform/db/pool.ts`/`migrate.ts`/`migrate-cli.ts` may import `pg` directly, and only `platform/db/tenant-context.ts` may open a transaction. Makes "exactly one tenant-context helper" an enforced boundary, not just a convention.
- `tools/conformance/lib/exceptions.ts` + root `exceptions.json` — implements ADR-030 item 5: a suppression is only honored if it references a real ADR (`ADR-###`); anything else fails CI outright. `npm run conformance` regenerates `conformance-exceptions-report.md` on every run.
- `tools/conformance/run.ts` — the CI entry point. Scans the real tree (everything except `node_modules`, `.git`, `dist`, `coverage`, and `tools` itself — the harness's own code and fixtures are not "product code" and are reviewed by hand instead, logged in `DECISION_LOG.md`), plus a best-effort live-DB schema check against the real `modules/*/migrations` tree (skipped with a clear log line, not a failure, if no database is reachable — see 4.5).
- `tools/conformance/fixtures/**` — one deliberately-violating fixture per rule (15 fixtures) plus one `clean/` control tree that must produce zero violations across every rule.
- `tools/conformance/harness.selftest.spec.ts` — 19 Vitest cases: one asserting detection per fixture, plus one asserting the clean tree is silent across all rule families.
- `tools/conformance/harness.selftest.live-db.spec.ts` — 5 Vitest cases proving the schema rules against a real PostgreSQL connection (4 violation fixtures + the clean control), isolated in a dedicated schema that's reset between fixtures.
- `platform/db/tenant-context.spec.ts` — 4 Vitest cases proving the RLS helper itself (not just the schema rules) against real PostgreSQL: tenant isolation, fail-closed with no context, no leakage across pooled-connection reuse, rollback-on-error. Uncovered a real finding — see `DECISION_LOG.md` "RLS: FORCE ROW LEVEL SECURITY or a non-owner app role".
- `.github/workflows/conformance.yml` — starts Postgres via `docker compose up -d --wait`, then runs `npm run typecheck`, `npm test` (all self-test files above), and `npm run conformance` (the real scan), on every PR and on push to `main`.

### 4.2 Why not `dependency-cruiser`

ADR-030 names `dependency-cruiser` or ESLint boundary rules as options but says tool choice is free. The cross-module rule ("module A may only import module B's `contracts/`") needs to compare the *source* module against the *target* module for every import, which is awkward to express as a static dependency-cruiser rule without capture-group backreferences across `from`/`to`. A small, fully-owned TypeScript checker made that rule (and the marker-based singleton rule, which has no equivalent in either tool) straightforward and kept all four rule families in one place with one output format. Logged in `DECISION_LOG.md`.

### 4.3 Known limitation

Import resolution is regex-based (source-text scanning of `import`/`require` specifiers), not the TypeScript compiler API or a real module resolver. This is sufficient to prove the rule mechanics now and will catch the overwhelming majority of real violations, but it does not resolve `tsconfig` path aliases or barrel re-exports perfectly. Flagged in `DECISION_LOG.md` as something to revisit if false negatives show up once real code lands.

### 4.4 Live verification performed this session

```
npx tsc --noEmit                    -> 0 errors
npx vitest run                      -> 28/28 self-test cases pass (19 static + 5 live-DB schema + 4 tenant-context)
npx tsx tools/conformance/run.ts    -> PASS (0 violations) on the current (empty) real tree
```

Additionally, a throwaway file importing `pg` was added under `modules/tmp_smoke_test/domain/` and the scan was re-run: it failed with `FORBIDDEN-IMPORT-DOMAIN`, exit code 1, exactly as required by `03_TECHNICAL_BLUEPRINT.md` §4 exit criterion ("the harness fails a deliberately broken commit, and passes a clean one"). The file was then deleted and the scan re-run clean. The exceptions mechanism was also smoke-tested: an `exceptions.json` entry with an invalid ADR reference fails CI even with zero real violations, as ADR-030 item 5 requires.

### 4.5 Live-database proof (second pass, this session)

Per ADR-030 §3 and the user's explicit request, the schema rules are proven against a real, migrated PostgreSQL, not only static SQL text. Docker was not available in this sandbox (see section 0), so a native PostgreSQL 17 already installed on this machine was used as a stand-in for `docker compose up`:

```
CREATE ROLE nexora LOGIN PASSWORD 'nexora_dev_only';
CREATE DATABASE nexora OWNER nexora;
DATABASE_URL=postgresql://nexora:nexora_dev_only@localhost:5432/nexora  (local Postgres substitute for docker-compose's 5433)

npx vitest run
  -> harness.selftest.live-db.spec.ts: 5/5 pass — each schema-* fixture's migrations were
     actually applied via platform/db/migrate.ts into a dedicated, reset schema, then
     tools/conformance/rules/schema-live.ts introspected the live database and found the
     expected violation (or none, for the clean fixture).

npx tsx tools/conformance/run.ts
  -> without DATABASE_URL reachable: "(live-DB schema check skipped: could not reach
     postgresql://...@localhost:5433/nexora — ECONNREFUSED)" then PASS — confirms the
     real-tree scan degrades gracefully, not silently, when no DB is configured.
  -> with DATABASE_URL reachable: PASS (0 violations) against the real, currently-empty
     modules/*/migrations tree.
```

A further smoke test added a throwaway module (`modules/tmp_smoke_test/migrations/0001__bad.sql`) creating a table with no `tenant_id`, no RLS, and a `FLOAT` money column, then ran `npm run db:migrate`-equivalent logic via `tools/conformance/run.ts` against the real local database: it reported **6** violations — the same 3 rules caught twice, once by the static parser (`schema.ts`) and once by live introspection (`schema-live.ts`) — confirming both layers work and agree. The throwaway module, its migrated table, and its `schema_migrations` tracking row were then deleted/dropped, and the scan was re-run clean.

The scratch `nexora` role and database on the local Postgres instance were left in place (harmless, dev-only, matches what `docker-compose.yml` would create) rather than dropped, since a next session will likely want them again for the golden path. They can be dropped with `DROP DATABASE nexora; DROP ROLE nexora;` if unwanted.

---

## 5. Actions taken this session (for the record)

- `npm install` — dependency `pg`; dev dependencies `typescript`, `tsx`, `vitest`, `@types/node`, `@types/pg`.
- `git init`, with `git config --local user.email` set to the user's own address (the machine's *global* git email was found to be a leftover placeholder string, not a real address — flagged to the user, who chose to fix it locally only; global config was not touched, per instruction never to modify it). One commit made this session (first pass); the second-pass amendment work is uncommitted pending review, per this report's own gate.
- No git remote added and nothing pushed — explicit user instruction, repo is local-only for now.
- On the local, pre-existing PostgreSQL 17 instance on this machine (unrelated to this project): created a `nexora` role and a `nexora` database, used only as a stand-in for `docker-compose.yml`'s Postgres since Docker isn't available here (see section 4.5). Left in place, dev-only, not referenced by anything outside this repo's own config defaults.

No destructive action was taken. No file under `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011–ADR-018 was opened.

---

## 6. What is NOT in scope yet (by design)

Per `AGENTS.md` section 6 and `08_PHASE_1_BRIEF.md`, none of the following start until this report and the harness are reviewed and approved:

- The `store.read` golden path.
- Any of the ~12 Phase 1 tables or their migrations.
- NestJS/Next.js app scaffolding, Redis/BullMQ wiring (deferred, see `DECISION_LOG.md`), or auth (ADR-029). (The query builder is no longer deferred — Kysely, see below.)
- Any module folder under `modules/` beyond the documented-but-empty placeholder.

## 7. Open items needing human confirmation

Full detail and options are in `DECISION_LOG.md`; listed here so they aren't missed. Two of the original five were resolved by the user 2026-08-22 and are struck through; what's left:

1. ~~Contradiction between `06_IMPLEMENTATION_PLAN.md` (7-item Phase 0) and `08_PHASE_1_BRIEF.md` (3-item Task 0)~~ — **RESOLVED**: `06`'s full 7-item list governs; `08` is a summary of Task 0, not its ceiling.
2. Whether `platform/` is the right long-term name for cross-cutting DB plumbing (vs. `shared/`, `infra/`, or a `modules/platform/` pseudo-module) — low cost to rename now, higher later.
3. ~~The query builder choice~~ — **RESOLVED**: Kysely. See `DECISION_LOG.md` for why and for the new `DB-ACCESS-*` conformance rules enforcing that all pool access and transaction-opening goes through it.
4. Whether/when to add a `redis` service to `docker-compose.yml` — currently omitted as out of scope for this session's minimal-scaffold instruction.
5. **Verify the Docker path itself** (`docker compose up -d && npm test`) — moved to `RISK_REGISTER.md` (R-001) since it's a standing risk, not a one-time todo; the user is verifying this locally.
6. **New, from building the tenant-context helper's own tests:** `FORCE ROW LEVEL SECURITY` vs. a non-owner application role — see `DECISION_LOG.md` "RLS: FORCE ROW LEVEL SECURITY or a non-owner app role". Must be decided before Task 1's real migrations create tenant-owned tables, since this Phase 0 scaffold's single `nexora` role would otherwise silently bypass RLS as the tables' owner.
