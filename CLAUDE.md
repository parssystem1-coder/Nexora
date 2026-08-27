# Nexora — Claude Code entry point

@AGENTS.md

## Read order

`AGENTS.md` (imported above) is the operating contract. Then `08_PHASE_1_BRIEF.md` for current scope.

Do **not** load the whole documentation pack into one context window — `README_START_HERE.md` explains why. Pull sections of `03`, `04`, `05` and individual ADRs on demand. Never load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018 during Phase 1 or 2.

When documents disagree: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Current state

See `PROJECT_STATUS.md` for the full per-slice narrative (moved out of this file 2026-08-27 to keep this an entry point, not a changelog — `decisions/2026-08.md` 2026-08-27, "Cutting per-session context cost"). In short:

- Phase 0 and Phase 1 (all seven capabilities: `organization.create`, `membership.invite`, `membership.role.assign`, `store.create`, `auth.login`/`logout`/`logout_all`, `organization.switch`, `membership.revoke`) are implemented and repaired.
- **The Phase 1 gate is OPEN** (`PHASE_1_GATE_OPEN_2026-08-27.md`). CI is live and green on GitHub Actions.
- `PHASE_1_DEBT_CLOSURE.md`: D-1 (calendar/timezone), D-3 (shared capability pipeline), D-4 (lint/format), D-6 (R-008 investigation) CLOSED; D-2 (Redis/BullMQ) PARTIALLY CLOSED; D-5 (`outbox_events`/`identity_providers`) PENDING.
- `RISK_REGISTER.md` carries the open risks (R-003 ACCEPTED, R-005/R-006/R-008 OPEN, others CLOSED) — read it before assuming a gap is unknown.
- Test counts, by what they measure: `npm test` reports **380 test cases passing across 37 files** (the authoritative runtime count). `PROJECT_GRAPH.md`'s mechanically-extracted "test cases" figure is lower (363) because its static parser counts one `it.each([...])` call site as one case, not one per generated case — 5 files use `it.each`. Both numbers are correct for what they measure; neither is stale.
- 10 capabilities, 10 routes, 7 modules, 14 tables (6 with RLS), 20 migrations, conformance 0 violations.

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

Before tests, conformance, or migrations, export:

```
DATABASE_URL=postgresql://nexora_app:nexora_app_dev_only@localhost:5432/nexora
MIGRATE_DATABASE_URL=postgresql://nexora_migrate:nexora_migrate_dev_only@localhost:5432/nexora
```

`platform/config.ts`'s defaults point at compose's `5433` — always override for local work. `nexora_migrate` has no `CREATEDB`, so a from-empty migration run needs a database created by a superuser first.
