# Nexora — Claude Code entry point

@AGENTS.md

## Read order

`AGENTS.md` (imported above) is the operating contract. Then `PHASE_2_BRIEF.md` for current scope. `08_PHASE_1_BRIEF.md` is the closed phase's record — its §5 still explains the existing schema's RLS exemptions, but it is not current scope.

Do **not** load the whole documentation pack into one context window — `README_START_HERE.md` explains why. Pull sections of `03`, `04`, `05` and individual ADRs on demand. Never load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018 during Phase 1 or 2.

When documents disagree: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Current state

See `PROJECT_STATUS.md` for the full per-slice narrative. In short, as of 2026-08-28:

- Phase 0 and Phase 1 (all seven capabilities) are implemented and repaired. **The Phase 1 gate is OPEN** (`PHASE_1_GATE_OPEN_2026-08-27.md`). CI is live and green.
- A real production build exists (`npm run build`/`npm start`, proven booted under `npm ci --omit=dev`) and `.env` actually works (`cp .env.example .env` is sufficient, zero manual `export`). `npm run check:dist-deps` (in CI) fails the build if a devDependency ever leaks into `dist/` again.
- HTTP hardening: security headers, CORS denied by default, `X-Powered-By` disabled, `GET /health` (liveness + DB readiness, not a capability).
- `PHASE_1_DEBT_CLOSURE.md`: D-1, D-3, D-4, D-5, D-6 CLOSED (D-5 on the closing *decision*, not on either table being built); D-2 (Redis/BullMQ) PARTIALLY CLOSED.
- **Phase 2 is OPEN.** `PHASE_2_BRIEF.md` is `AGENTS.md` §1 authority #2 — 27 tables in scope, 18 items, 26 exit criteria, and a §7 disposition table recording the fourteen decisions (D2-1 … D2-14) it was drafted around, all answered.
- **46 ADRs as of 2026-09-01** (35 ACCEPTED, 3 OPEN, the rest deferred — `PROJECT_GRAPH.md`'s ADR register is the mechanical count). New on 2026-09-01, closing the documentation programme: **ADR-041** ledger/audit table growth (`OPEN` — ADR-020 rules 4–5 exclude these rows from purge, so they only grow; four options, a recommendation, and the partitioning × `FORCE ROW LEVEL SECURITY` interaction recorded as *owed empirical verification* rather than asserted); **ADR-042** error message audience (`ACCEPTED` — `message` is developer-facing, `code` is the localization key, `details` carries the parameters; **no localization work is owed in Phase 2**, as a ruling rather than a deferral); **ADR-043** guarding `CapabilityDefinition` against `05` §5 (`ACCEPTED` — asserts the *declared difference*, since subset, superset and exactly-equal all reject correct current code; the rule is decided, its implementation deferred to a code-authorized session).
- Superseded count, kept for orientation: **43 ADRs as of 2026-08-28** (33 ACCEPTED, 2 OPEN, the rest deferred — `PROJECT_GRAPH.md`'s ADR register is the mechanical count). New on 2026-08-28: **ADR-036** pagination contract, **ADR-037** credential storage + encryption deferral, **ADR-038** idempotency composition (all `ACCEPTED (new)`, promoted out of `PHASE_2_BRIEF.md` §5 so a platform contract does not expire with the phase); **ADR-039** pool sizing/timeouts and **ADR-040** observability boundary are `OPEN` — options and a recommendation recorded, the ruling is the maintainer's. **ADR-006 and ADR-010 carry dated amendments** — ADR-006's `Blocks` was *split* (its usage-ledger half still blocks Phase 2 item 9; only the AI-credit half moves to Phase 6+), and ADR-010's numeric targets are now explicitly unverified assumptions until `06` Phase 4 item 9.
- Five items remain owed to *other* files (`PROVIDER_MATRIX.md`, `06`'s re-phrasing, an `entitlement.resolve` inner-path p95 budget, two undefined lifecycle cells, the role-catalog question); none blocks slice 1, and each is tracked as a register row.
- `TECHNOLOGY_RADAR.md` and `COMPETITIVE_POSITION.md` (both 2026-09-01) are **non-normative** — they inform decisions and make none, are deliberately absent from `AGENTS.md` §1's read order, and point at the ADR or register row that owns each decision rather than restating it. Their external claims are explicitly unverified against upstream sources.
- `RISK_REGISTER.md` roll-call, **35 rows as of 2026-09-01** (the date is part of the claim — an undated count reads as current forever): only seven rows are not OPEN — **CLOSED** R-001, R-007, R-009, R-014 · **RESOLVED** R-002 · **ACCEPTED** R-003 · **PARTIALLY CLOSED** R-005 (rate limiter, single-instance only). **All other 28 rows are OPEN.** Read the row before assuming a gap is unknown or already fixed — several record a plausible concern investigated and refuted, and seven carry a dated addendum recording what a D2 decision settled and what it left open. The register's own preamble defines what each status word means here.
- R-020 … R-031 come from `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` (sixteen findings F-1 … F-16, verified one by one; three were materially corrected or refuted on inspection). R-014 … R-019 come from `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md`. Both are dated records — read the finding before acting on a row derived from it.
- A PostgreSQL deadlock/serialization failure now reaches the client as `CONCURRENCY_CONFLICT`/409 (R-008's candidate mitigation, done independently of R-008's own root cause), not `INTERNAL_ERROR`/500.
- Test counts, by what they measure: `npm test` reports **401 test cases passing across 42 files** (`npm test` 2>&1, authoritative runtime count). `PROJECT_GRAPH.md`'s mechanically-extracted figure is lower (384, `npm run graph`) because its static parser counts one `it.each([...])` call site as one case, not one per generated case. Both are correct for what they measure.
- 10 capabilities, 11 routes (one is `/health`, not a capability), 7 modules, 14 tables (6 with RLS), 20 migrations, conformance 0 violations.

Update this section, and `PROJECT_STATUS.md`, when that changes — new slice narrative goes in `PROJECT_STATUS.md`, not here.

## Skills

- `/new-slice` — implement one vertical capability slice mirroring the golden path. Use for every new capability.
- `/phase-gate` — audit a phase against its exit criteria before the next one opens.
- `/project-graph` — regenerate and read the mechanically-extracted map of what the repository contains: modules and their real dependency edges, tables and their RLS posture, capabilities, routes, singletons, ADRs, tests by layer. Run it at the start of a task, to avoid rediscovering the same facts by reading files, and after finishing a slice, to see what changed structurally.

## Always verify before reporting done

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run conformance && npm run db:migrate
```

Run `npm run db:migrate` against a database reset to empty when a migration changed, to confirm every migration still applies cleanly together, not just the new one in isolation.

Never weaken a conformance rule or add an `exceptions.json` entry to reach green.

## Local database note

This machine has **no Docker**. A native PostgreSQL 17 runs on **port 5432** (not `docker-compose.yml`'s `5433`), carrying the `nexora` database and both roles. `docker compose up` is the CI path only — CI runs `docker-compose.yml` (`postgres:17-alpine`, port 5433) on a real GitHub Actions runner; this machine never runs it.

No manual `export` is needed: `cp .env.example .env` once, and Node 24's `--env-file-if-exists=.env` (wired into `start:dev`, `start`, `db:migrate`, `conformance`, `test`) reads `DATABASE_URL`/`MIGRATE_DATABASE_URL` from it automatically. `platform/config.ts`'s own hard-coded fallback still points at compose's `5433` (CI depends on that default; `.env.example`'s committed values are `5432` for this machine) — `AUDIT_DATABASE_URL` also lives here, commented out, defaulting to `DATABASE_URL`. `nexora_migrate` has no `CREATEDB`, so a from-empty migration run needs a database created by a superuser first.
