# Nexora — Claude Code entry point

@AGENTS.md

## Read order

`AGENTS.md` (imported above) is the operating contract. Then `08_PHASE_1_BRIEF.md` for current scope.

Do **not** load the whole documentation pack into one context window — `README_START_HERE.md` explains why. Pull sections of `03`, `04`, `05` and individual ADRs on demand. Never load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018 during Phase 1 or 2.

When documents disagree: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Current state

See `PROJECT_STATUS.md` for the full per-slice narrative. In short, as of 2026-08-28:

- Phase 0 and Phase 1 (all seven capabilities) are implemented and repaired. **The Phase 1 gate is OPEN** (`PHASE_1_GATE_OPEN_2026-08-27.md`). CI is live and green.
- A real production build exists (`npm run build`/`npm start`, proven booted under `npm ci --omit=dev`) and `.env` actually works (`cp .env.example .env` is sufficient, zero manual `export`). `npm run check:dist-deps` (in CI) fails the build if a devDependency ever leaks into `dist/` again.
- HTTP hardening: security headers, CORS denied by default, `X-Powered-By` disabled, `GET /health` (liveness + DB readiness, not a capability).
- `PHASE_1_DEBT_CLOSURE.md`: D-1, D-3, D-4, D-5, D-6 CLOSED (D-5 on the closing *decision*, not on either table being built); D-2 (Redis/BullMQ) PARTIALLY CLOSED.
- `RISK_REGISTER.md` roll-call, **31 rows as of 2026-08-28** (the date is part of the claim — an undated count reads as current forever): only six rows are not OPEN — **CLOSED** R-001, R-007, R-009 · **RESOLVED** R-002 · **ACCEPTED** R-003 · **PARTIALLY CLOSED** R-005 (rate limiter, single-instance only). **All other 25 rows are OPEN.** Read the row before assuming a gap is unknown or already fixed — several record a plausible concern investigated and refuted. The register's own preamble defines what each status word means here.
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
