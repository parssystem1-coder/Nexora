# Decision Log

Per `AGENTS.md` section 5: when an implementer is uncertain, the ambiguity is written here with options and a recommendation instead of being silently resolved. Newest entries at the top.

Template for a new entry:

```
## YYYY-MM-DD — <short title>

**Context:** what document or task raised the ambiguity, and why the docs pack doesn't settle it.
**Options considered:** A, B, C with tradeoffs.
**Decision:** what was picked and why.
**Status:** OPEN (needs human review) | RESOLVED
```

---

## 2026-08-22 — Contradiction: Phase 0 scope in `06_IMPLEMENTATION_PLAN.md` vs `08_PHASE_1_BRIEF.md`

**Context:** flagged by the user explicitly, per `AGENTS.md` section 5 ("if a phase reveals a contradiction in these documents, stop and file it in `DECISION_LOG.md` rather than routing around it" — also `06_IMPLEMENTATION_PLAN.md` line 127, same rule stated a second time).

`06_IMPLEMENTATION_PLAN.md` "Phase 0: Foundation Audit and Guardrails" lists **7** deliverables: (1) audit report, (2) toolchain inventory incl. TypeScript/NestJS/Next.js/query builder/test runner/linter/formatter/**Docker compose for PostgreSQL and Redis**, (3) conformance harness, (4) **migration runner plus the single transaction/RLS-context helper**, (5) **configuration and secret loading**, (6) the three skeleton docs, (7) **approved target directory structure matching `03_TECHNICAL_BLUEPRINT.md` §2**.

`08_PHASE_1_BRIEF.md` "1. Task 0, before any feature code" lists only **3** items: (1) audit report, (2) conformance harness, (3) the three skeleton docs. It omits items 2, 4, 5 and 7 above entirely.

`03_TECHNICAL_BLUEPRINT.md` §4 "Phase 0 Deliverables, before any feature" independently corroborates the *broader* 06 list (toolchain baseline, harness, migration runner + RLS helper, config/secret loading, skeleton docs) — so two documents agree on 7 items and one (08) states a narrower 3.

**Options considered:**
  A. Follow `08_PHASE_1_BRIEF.md` literally — it calls itself "the only scope you are authorized to implement right now" and sits earlier in `AGENTS.md`'s read order than `06`. Stop after the 3 items and wait for explicit sign-off before touching toolchain/DB/migration-runner work.
  B. Follow the broader `06`/`03` list — both agree on 7 items, `03` outranks `06` in the stated read order (and outranks `08`'s *specificity* is about "what to build," not precedence between documents), and `08`'s own Task 1 golden path step 5 ("transaction open plus RLS session context via the single helper (ADR-021)") presupposes that helper already exists — meaning 08's terse Task 0 silently depends on work it doesn't itself list. Read this as 08 being incomplete/compressed rather than a deliberate narrowing.
  C. Split the difference: do 08's 3 items now, treat 06 items 2/4/5/7 as a *separate*, later Phase 0 sub-step requiring its own sign-off gate.
**Recommendation:** B. The internal dependency (Task 1 step 5 needs the RLS helper) is strong evidence this is a documentation gap in 08, not an intentional scope cut, and building migration/RLS/config plumbing is explicitly "no feature code" per `06` line 12 and `03` §4's own framing, so it doesn't jump ahead of the Task-1 gate the user cares about.
**Status:** OPEN — needs human confirmation. Per the user's explicit instruction this session, proceeding under option B for the current work (docker-compose, migration runner, the tenant-context/RLS helper, config loading, corrected directory structure) rather than stalling, since the user's own follow-up message independently asked for exactly that scope. A human should still confirm B over A/C before Phase 0 is signed off as complete.

## 2026-08-22 — Query builder selection deferred

**Context:** `08_PHASE_1_BRIEF.md` §0 and ADR-021 name Drizzle or Kysely as the accepted options but do not pick one; `06_IMPLEMENTATION_PLAN.md` Phase 0 item 2 lists "the query builder chosen in ADR-021" as a toolchain-inventory deliverable.
**Options considered:**
  A. Pick one now (Drizzle or Kysely) so the toolchain list is "complete."
  B. Defer the pick — Phase 0's actual DB code (migration runner, the tenant-context/RLS helper) talks to Postgres directly via `pg`, because migrations are "reviewed plain SQL" (ADR-021 item 8) and the RLS helper only needs `BEGIN`/`set_config`/`COMMIT`, none of which benefit from a query builder. The first real consumer of a query builder is application-layer repository code in the golden path (Task 1), which is out of scope this session.
**Decision:** B. Picking Drizzle vs. Kysely with zero real queries written yet would be a guess with no evidence behind it — exactly the kind of premature decision `AGENTS.md` §5 warns against making silently. Raw `pg` is used for `platform/db/*` in this Phase 0 scaffold; the query builder decision is left for Task 1 when the golden path's repository code gives real query shapes to evaluate against.
**Status:** OPEN — must be resolved before Task 1 (golden path) begins, since the golden path's repository layer needs it.

## 2026-08-22 — Test runner: Vitest

**Context:** `06_IMPLEMENTATION_PLAN.md` Phase 0 item 2 requires a test runner choice in the toolchain inventory.
**Options considered:**
  A. Jest — the incumbent default for NestJS projects, most examples online use it.
  B. Vitest — native ESM and TypeScript support without a transpile step, fast, and the harness's self-test suite (`tools/conformance/harness.selftest.spec.ts`) needed something usable standalone this session, before any NestJS app exists.
**Decision:** B. This repo's `tsconfig.json` targets ESNext modules; Jest's ESM support still requires extra flags/experimental config, while Vitest is ESM-first. Vitest also shares its config format with Vite, which Next.js tooling increasingly assumes, and starts in well under a second, keeping the "harness runs in under two minutes" requirement (ADR-030 Verification) comfortable. NestJS itself is framework-agnostic about the test runner at the unit-test layer; this does not block using Jest later for anything NestJS-specific if a real conflict shows up.
**Status:** RESOLVED for Phase 0 tooling. Revisit only if a genuine NestJS+Vitest integration problem appears in Task 1.

## 2026-08-22 — Secret scanner: custom regex checker, not gitleaks/trufflehog

**Context:** ADR-030's SECRET RULES need "a secret scanner"; tool choice is free.
**Options considered:**
  A. Shell out to `gitleaks` or `trufflehog` — battle-tested, much larger pattern library.
  B. A small, owned TypeScript checker (`tools/conformance/rules/secrets.ts`) covering exactly the patterns ADR-030 names: AWS-shaped access keys, PEM private key blocks, and generic `key/secret/password/token = "literal"` assignments, plus a dedicated pass over `.snap` files and log-assertion lines.
**Decision:** B. Shelling out to a third-party binary means either vendoring a platform-specific executable or an install-time network fetch, neither of which fits "the harness runs locally with actionable output" (ADR-030 item 6) as simply as a same-language checker that lives next to the other three rule families and shares their `Violation` type and exceptions/reporting pipeline. The tradeoff is a smaller pattern library than gitleaks' — acceptable for Phase 0 because ADR-030 names a closed, specific list of things to catch, not "every known secret shape."
**Status:** RESOLVED. Revisit if the pattern list needs to grow significantly (at that point gitleaks' maintained ruleset starts winning on cost/benefit).

## 2026-08-22 — CI: GitHub Actions

**Context:** ADR-030 requires the harness to "run in CI on every pull request." No CI provider was previously configured; no git remote exists yet either (this repo is local-only for now, per explicit user instruction this session).
**Options considered:**
  A. GitHub Actions — ubiquitous, free public/private-repo minutes, first-class Docker/Postgres service support (needed for the live-DB schema check below).
  B. Leave CI unconfigured until a remote/host is chosen.
**Decision:** A, as a workflow file (`.github/workflows/conformance.yml`) that will activate the moment this repo gets a GitHub remote — writing it now costs nothing and documents the intended CI shape. It does not run anywhere yet since there is no remote and none was added this session (explicit user instruction: no remote, no push).
**Status:** RESOLVED for Phase 0. Revisit only if the eventual git host isn't GitHub.

## 2026-08-22 — docker-compose Postgres on port 5433, not 5432

**Context:** Building the live-DB schema check (below) required a real Postgres. This machine already has a native PostgreSQL 17 service listening on the default port 5432 (discovered while building this).
**Decision:** `docker-compose.yml`'s `postgres` service maps container port 5432 to host port **5433**, so `docker compose up` never collides with a developer's pre-existing local Postgres install. `.env.example` and `platform/config.ts`'s default both point at `5433`.
**Status:** RESOLVED.

## 2026-08-22 — Root-level `migrations/` replaced with per-module `modules/<module>/migrations/`

**Context:** the first Phase 0 pass (this session, before this amendment) created a top-level `migrations/` placeholder directory. `03_TECHNICAL_BLUEPRINT.md` §2.1's file convention is explicit that migrations live *inside* each module: `modules/<module>/migrations/<timestamp>__<description>.sql`. Every Phase 1 table maps to an owning module in the §2 module list (e.g. `currencies` → `money`, `audit_events` → `audit`, `outbox_events` → `eventing`, `reserved_subdomains` → `domains`), so there is no case where a table's migration doesn't belong to some module.
**Decision:** removed the root `migrations/` placeholder. `platform/db/migrate.ts` discovers migrations via `modules/*/migrations/*.sql` and applies them in filename order across modules (filenames are `<timestamp>__...`, so cross-module ordering stays deterministic). The schema-conformance rules (`tools/conformance/rules/schema.ts`) already matched on any path containing `migrations/`, so no change was needed there. This is a self-correction of the earlier pass, not a new ambiguity.
**Status:** RESOLVED.

## 2026-08-22 — Where cross-cutting DB plumbing lives before any module exists: `platform/`

**Context:** the migration runner, the pg connection pool, and the one tenant-context/RLS helper (ADR-021, and the ADR-030 "exactly one tenant-context helper" singleton rule) are used by every module, so they cannot live inside any single `modules/<module>/` folder without implying false ownership. The docs pack's module list (`03_TECHNICAL_BLUEPRINT.md` §2) does not name a home for pre-module, cross-cutting platform code.
**Options considered:**
  A. Put it inside an existing module (e.g. `modules/tenant/infrastructure/`) — wrong, `tenant` owns organizations/memberships/store ownership, not raw DB plumbing every module depends on, and it would make every other module reach into `tenant`'s internals, violating the cross-module contracts-only rule this same helper is supposed to help enforce.
  B. A new top-level `platform/` directory, sibling to `modules/` and `tools/`, holding only infrastructure with no business/tenant logic: `platform/config.ts`, `platform/db/pool.ts`, `platform/db/migrate.ts`, `platform/db/tenant-context.ts`.
**Decision:** B. Kept deliberately thin — no domain concepts, no module-specific code — so it doesn't become a dumping ground. `tools/conformance/lib/walk.ts` does *not* exclude `platform/` from the real-tree scan (unlike `tools/`), so it stays subject to the forbidden-import and secret rules like any other source.
**Status:** OPEN — needs human confirmation that `platform/` (vs. naming it e.g. `shared/` or `infra/`, or folding it into a `modules/platform/` pseudo-module) is the right long-term home; low cost to rename later since nothing else depends on the directory name yet.

## 2026-08-22 — Redis left out of `docker-compose.yml` for now

**Context:** `06_IMPLEMENTATION_PLAN.md` Phase 0 item 2 asks for "Docker compose for PostgreSQL and Redis." Nothing built this session (migration runner, RLS helper, live schema check) touches Redis — Redis/BullMQ are Phase 1 concerns (sessions, rate limits, idempotency read-through per `03_TECHNICAL_BLUEPRINT.md` §10).
**Decision:** added only the `postgres` service now, per the user's explicit instruction to build "only the minimal scaffold needed to run the harness." Adding an unused Redis container would be scope creep against that instruction even though `06` technically asks for it.
**Status:** OPEN — add the `redis` service to `docker-compose.yml` when Task 1 needs it (sessions, idempotency service).

## 2026-08-22 — Harness scan scope excludes `tools/`

**Context:** ADR-030 requires the conformance harness to scan "the" source tree, but doesn't say whether the harness's own implementation code and its self-test fixtures (which are *deliberately* broken) count as scannable source. Scanning them naively produced false positives — the harness's own documentation comments matched the exact patterns they were documenting (e.g. a comment illustrating the secret-literal pattern was itself flagged as a secret; a comment illustrating the singleton marker syntax was itself flagged as a singleton claim).
**Options considered:**
  A. Scan everything including `tools/`, and hand-tune every comment in the harness to never resemble a violation.
  B. Exclude `tools/` (harness code + fixtures) from the real-tree scan; rely on ordinary code review for the harness itself, since it isn't product code.
  C. Move fixtures outside `tools/` (e.g. top-level `__conformance_fixtures__/`) and scan `tools/conformance/rules|lib|run.ts` normally.
**Decision:** B. Product code lives under `modules/` and `migrations/` per `03_TECHNICAL_BLUEPRINT.md` §2; the harness itself is tooling, not a module, and is reviewed by hand. This keeps the harness's own comments free to use realistic examples without fighting its own detectors. Implemented in `tools/conformance/lib/walk.ts` (`ALWAYS_IGNORE` includes `"tools"`).
**Status:** RESOLVED. Revisit if `tools/` ever grows product-adjacent code that should be covered (e.g. a shared CLI other modules depend on).

## 2026-08-22 — Singleton-rule enforcement mechanism

**Context:** ADR-030 requires "exactly one" implementation for five roles (idempotency, tenant-context, serving-state, money-allocator, host-resolution) but does not specify how a mechanical check identifies which file *is* the implementation of a given role, since file names will vary by module and convention (`03_TECHNICAL_BLUEPRINT.md` §2.1 only fixes suffixes like `.service.ts`, `.repository.ts`, not semantic role).
**Options considered:**
  A. Naming convention (e.g. exactly one file matching `**/idempotency/application/*.service.ts`) — brittle, breaks the moment a legitimate second file in that module needs the same suffix.
  B. Explicit marker comment (`@singleton-role: idempotency`) that the implementer adds to the one file that fulfils the role — greppable, explicit, survives refactors and renames.
  C. Static analysis of exported symbol names/interfaces implemented — most accurate but far more implementation effort than Phase 0 warrants.
**Decision:** B, implemented in `tools/conformance/rules/singleton.ts`. Recommend keeping this convention when the golden path and later slices are implemented — the first real idempotency/tenant-context/serving-state/money-allocator/host-resolution file each needs the marker comment added, or the harness will report zero claimants (informational only right now, not a failure, since nothing is built yet) rather than catching a future accidental duplicate.
**Status:** RESOLVED, but the *convention itself* (marker comments) is a judgment call worth a human sanity check before Task 1 starts, since it's not named anywhere in the docs pack.

## 2026-08-22 — Custom checker instead of dependency-cruiser

**Context:** ADR-030 §3 names `dependency-cruiser` or ESLint boundary rules as example tooling for import-direction checks, but says "choice of tool is free; the checks are not."
**Options considered:**
  A. `dependency-cruiser` with a rules config — standard, well-tested, but the cross-module rule ("module A may import module B's `contracts/` only") needs a from/to comparison keyed on a *captured* module name from the `from` side, which is awkward without cross-field backreferences in the OSS rule DSL.
  B. ESLint + a custom `import/no-restricted-paths`-style plugin — similar limitation, plus adds ESLint as a dependency this repo doesn't otherwise need yet.
  C. A small, fully-owned TypeScript checker (regex-based import extraction + path classification) covering direction, forbidden imports, and cross-module in one place.
**Decision:** C, implemented in `tools/conformance/rules/imports.ts`. Revisit once real code volume makes hand-rolled import scanning too slow or too inaccurate — dependency-cruiser remains a reasonable migration target for the direction/forbidden-import rules specifically (not the cross-module or singleton rules, which would still need custom code).
**Status:** RESOLVED for Phase 0. Known limitation: import resolution is regex/source-text based, not the TS compiler API, so `tsconfig` path aliases and barrel re-exports are not fully resolved. No false negatives observed yet because no real code exists to test against; re-evaluate once the golden path lands real imports.
