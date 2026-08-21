# Repository Audit Report

**Date:** 2026-08-22
**Scope:** Phase 0, Task 0 — mandated by `AGENTS.md` section 0 and `08_PHASE_1_BRIEF.md` section 1.
**Auditor:** AI implementer, first session.

---

## 1. Summary

**This is a new repository.** Before this session it contained only the documentation pack (12 numbered specs + `AGENTS.md` + `README_START_HERE.md`) and a `future/` folder that is out of scope for Phase 1 and was not read. There was no `package.json`, no source code, no database, no migrations, no tests, and no CI. No git repository existed either (`git status` failed with "not a git repository").

Per `AGENTS.md` section 0: *"If the repository is empty or newly scaffolded, the audit is not skipped, it is trivial... Produce it anyway."* Everything below that isn't documentation is therefore classified `MISSING`. This is normal for session 1 and is not a blocker.

This session's output turns the repository from "docs only" into "docs + a working toolchain + a working, self-proving conformance harness." No feature code, no NestJS app, no database, and no golden path (`store.read`) were built — those are Task 1 of `08_PHASE_1_BRIEF.md` and are explicitly out of scope until this report and the harness are reviewed.

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
| `package.json` | MISSING → now scaffolded | Created this session. Contains only the conformance-harness toolchain (`typescript`, `tsx`, `vitest`, `@types/node`) — no NestJS, Next.js, Drizzle/Kysely, Redis or BullMQ yet, because those belong to Task 1 (golden path), not Task 0. |
| `tsconfig.json` | MISSING → now scaffolded | Strict mode on. Excludes `tools/conformance/fixtures` from type-checking since those files contain deliberately-invalid imports by design. |
| Dependency audit | PARTIAL | `npm install` reports 5 vulnerabilities (3 moderate, 1 high, 1 critical), all transitive, all inside `esbuild`/`vite`'s dev-server CORS advisory (GHSA-67mh-4wv8-2f99), pulled in by `vitest`. This class of finding only affects a running `vite` dev server, which this project does not start. No production or NestJS/Next.js dependency tree exists yet to audit. Re-run `npm audit` once the real app dependencies (Task 1) are added. |
| Database setup | MISSING | No PostgreSQL connection, no ORM/query-builder choice wired up yet (ADR-021 names Drizzle or Kysely as the option; neither is installed). |
| Migrations | MISSING | `migrations/` created as an empty placeholder directory this session so the schema-conformance rule has somewhere real to scan. Zero actual migrations exist. |
| Tests | MISSING (product) / MATCH (harness) | No product tests exist (no product code exists). The conformance harness has its own self-test suite (`tools/conformance/harness.selftest.spec.ts`, 15 tests, all passing) that proves each ADR-030 rule detects the violation it claims to. |
| CI/CD | MISSING → now scaffolded | `.github/workflows/conformance.yml` added: runs typecheck, the harness self-test, and the real-tree conformance scan on every PR and on push to `main`. Not yet exercised by an actual GitHub remote/PR since there is no git remote configured in this environment. |
| Git repository | MISSING → now initialized | `git init` run this session (see section 5). No remote configured — that is an environment/account decision outside this session's authority. |

### 3.3 Conformance harness (ADR-030)

Built this session under `tools/conformance/`. See section 4 for detail. Status: MATCH — all four required check families exist, each has a deliberately failing fixture, and the harness both fails on a broken commit and passes on a clean one (verified live, see section 4.4).

### 3.4 Module/schema scope (`03_TECHNICAL_BLUEPRINT.md` §2, `08_PHASE_1_BRIEF.md` §4)

| Area | Status | Notes |
|---|---|---|
| `modules/` tree (24 modules per the blueprint) | MISSING | Created as an empty placeholder directory only, so real code has a home and the harness has something to scan. No module subfolders exist yet — those get created as each slice is implemented, starting with the golden path. |
| Phase 1 tables (`users`, `credentials`, `sessions`, ... `reserved_subdomains`, ~12 tables) | MISSING | Zero migrations exist. Building them is Task 1/2 work, gated on this report being reviewed. |
| `store.read` golden path | MISSING | Not started. Explicitly gated behind this report per `AGENTS.md` section 0 and `08_PHASE_1_BRIEF.md` section 2. |

---

## 4. Conformance harness detail (ADR-030)

### 4.1 What was built

- `tools/conformance/rules/imports.ts` — dependency direction (domain → application/infrastructure/interfaces forbidden; application → interfaces/infrastructure forbidden), cross-module internals (only `contracts/` may be imported across modules), and forbidden-import lists for `domain`, the `plugin` boundary, and repository access from `ai`/`mcp`/`automation`/`storefront`.
- `tools/conformance/rules/singleton.ts` — the five ADR-030 singleton rules (idempotency, tenant-context, serving-state, money-allocator, host-resolution), enforced via an explicit `@singleton-role:` marker comment rather than a naming convention. **This is a Phase 0 judgment call**, logged in `DECISION_LOG.md`, because file names will vary across modules but the architectural claim "this is THE implementation of X" needs to be unambiguous and greppable.
- `tools/conformance/rules/schema.ts` — parses `**/migrations/*.sql`: every non-exempt table must have `tenant_id`; every non-exempt table must have both `ENABLE ROW LEVEL SECURITY` and a `CREATE POLICY`; no `FLOAT`/`DOUBLE`/`REAL` column on a money-shaped column name; no more than one `*idempotency*`-named table across all migrations.
- `tools/conformance/rules/secrets.ts` — flags AWS-shaped access key IDs, PEM private key blocks, and generic `key/secret/password/token = "..."` literal assignments (with an allow-list for obvious placeholders like `changeme`).
- `tools/conformance/lib/exceptions.ts` + root `exceptions.json` — implements ADR-030 item 5: a suppression is only honored if it references a real ADR (`ADR-###`); anything else fails CI outright. `npm run conformance` regenerates `conformance-exceptions-report.md` on every run.
- `tools/conformance/run.ts` — the CI entry point. Scans the real tree (everything except `node_modules`, `.git`, `dist`, `coverage`, and `tools` itself — the harness's own code and fixtures are not "product code" and are reviewed by hand instead, logged in `DECISION_LOG.md`).
- `tools/conformance/fixtures/**` — one deliberately-violating fixture per rule (11 fixtures) plus one `clean/` control tree that must produce zero violations across every rule.
- `tools/conformance/harness.selftest.spec.ts` — 15 Vitest cases: one asserting detection per fixture, plus one asserting the clean tree is silent across all four rule families.
- `.github/workflows/conformance.yml` — runs `npm run typecheck`, `npm test` (the self-test suite above), and `npm run conformance` (the real scan) on every PR and on push to `main`.

### 4.2 Why not `dependency-cruiser`

ADR-030 names `dependency-cruiser` or ESLint boundary rules as options but says tool choice is free. The cross-module rule ("module A may only import module B's `contracts/`") needs to compare the *source* module against the *target* module for every import, which is awkward to express as a static dependency-cruiser rule without capture-group backreferences across `from`/`to`. A small, fully-owned TypeScript checker made that rule (and the marker-based singleton rule, which has no equivalent in either tool) straightforward and kept all four rule families in one place with one output format. Logged in `DECISION_LOG.md`.

### 4.3 Known limitation

Import resolution is regex-based (source-text scanning of `import`/`require` specifiers), not the TypeScript compiler API or a real module resolver. This is sufficient to prove the rule mechanics now and will catch the overwhelming majority of real violations, but it does not resolve `tsconfig` path aliases or barrel re-exports perfectly. Flagged in `DECISION_LOG.md` as something to revisit if false negatives show up once real code lands.

### 4.4 Live verification performed this session

```
npx tsc --noEmit                    -> 0 errors
npx vitest run                      -> 15/15 self-test cases pass
npx tsx tools/conformance/run.ts    -> PASS (0 violations) on the current (empty) real tree
```

Additionally, a throwaway file importing `pg` was added under `modules/tmp_smoke_test/domain/` and the scan was re-run: it failed with `FORBIDDEN-IMPORT-DOMAIN`, exit code 1, exactly as required by `03_TECHNICAL_BLUEPRINT.md` §4 exit criterion ("the harness fails a deliberately broken commit, and passes a clean one"). The file was then deleted and the scan re-run clean. The exceptions mechanism was also smoke-tested: an `exceptions.json` entry with an invalid ADR reference fails CI even with zero real violations, as ADR-030 item 5 requires.

---

## 5. Actions taken this session (for the record)

- `npm install` (added `typescript`, `tsx`, `vitest`, `@types/node` as dev dependencies only).
- `git init` — the repository had no `.git` directory. No commits were made and no remote was added; that is left for explicit instruction.

No destructive action was taken. No file under `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011–ADR-018 was opened.

---

## 6. What is NOT in scope yet (by design)

Per `AGENTS.md` section 6 and `08_PHASE_1_BRIEF.md`, none of the following start until this report and the harness are reviewed and approved:

- The `store.read` golden path.
- Any of the ~12 Phase 1 tables or their migrations.
- NestJS/Next.js app scaffolding, the query builder choice, Redis/BullMQ wiring, or auth (ADR-029).
- Any module folder under `modules/` beyond the empty placeholder.
