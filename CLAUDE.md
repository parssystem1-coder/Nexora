# Nexora — Claude Code entry point

@AGENTS.md

## Read order

`AGENTS.md` (imported above) is the operating contract. Then `08_PHASE_1_BRIEF.md` for current scope.

Do **not** load the whole documentation pack into one context window — `README_START_HERE.md` explains why. Pull sections of `03`, `04`, `05` and individual ADRs on demand. Never load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018 during Phase 1 or 2.

When documents disagree: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Current state

Phase 0 complete. Phase 1 Task 0 and Task 1 (golden path `store.read`) complete and **repaired** — an independent audit found six defects (audit events not surviving their own transaction, a 404 returning `VALIDATION_ERROR`, three connection pools created at import time, `organizations`' RLS `WITH CHECK` covering UPDATE with no real predicate, `audit_events` not actually append-only) and all six are fixed as of commit `979bf3d`; see `PHASE_1_REPAIR_REPORT.md` for the defect-by-defect record.

Audit placement is now ADR-034 (`03` §3.1 and `08` §2 step 8 previously contradicted each other and both misdescribed the shipped design).

**Phase 1 step 4 done:** `modules/money` — `Money` value object (bigint minor units + explicit currency), the `currencies` registry, and the remainder-distributing allocator carrying the ADR-030 `money-allocator` singleton role. Per-currency minor units are read from the table, never hard-coded to 2.

**Task 2 slice 1 done:** `organization.create` (`POST /api/v1/organizations`). Creates the organization, an ACTIVE membership for its creator and an `owner` role grant in one transaction; no new tables. Two documented divergences from the golden path, both structural to a capability that creates its own tenant — no guard for steps 2–4, and no permission to assert at step 6. First slice whose domain transaction can actually fail, so it is where ADR-034's "the audit row survives a rolled-back transaction" is proven end to end. See `DECISION_LOG.md` (2026-08-23) for the five open questions it settled, one of which stays OPEN pending ADR-009.

**ADR-033 now in force:** `openapi.json` is generated from each capability's Zod schemas and `CapabilityDefinition` (`npm run openapi`, `-- --check` in CI). `CapabilityDefinition` carries `route`, `inputSchema`, `outputSchema` and `errorCodes`. Never hand-edit the artifact.

**Task 2 slices 2–6 not started.** Exit criteria still **eight of nine** (`PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §4); the remaining row is "revoking a membership invalidates active sessions," which needs `membership.revoke`.

129 tests passing (17 files), conformance 0 violations, 12 migrations apply cleanly.

**Local database note:** `docker compose` is not available on this machine; a native PostgreSQL 17 on **port 5432** carries the `nexora` database and both roles. Export `DATABASE_URL=postgresql://nexora_app:nexora_app_dev_only@localhost:5432/nexora` and `MIGRATE_DATABASE_URL=postgresql://nexora_migrate:nexora_migrate_dev_only@localhost:5432/nexora` before running tests, conformance or migrations — the defaults in `platform/config.ts` point at compose's 5433. `nexora_migrate` has no `CREATEDB`, so a from-empty migration run needs a database created by a superuser first.

Update this section when that changes.

## Skills

- `/new-slice` — implement one vertical capability slice mirroring the golden path. Use for every new capability.
- `/phase-gate` — audit a phase against its exit criteria before the next one opens.
- `/project-graph` — regenerate and read the mechanically-extracted map of what the repository contains: modules and their real dependency edges, tables and their RLS posture, capabilities, routes, singletons, ADRs, tests by layer. Run it at the start of a task, to avoid rediscovering the same facts by reading files, and after finishing a slice, to see what changed structurally.

## Always verify before reporting done

```bash
npm run typecheck && npm test && npm run conformance && npm run db:migrate
```

Run `npm run db:migrate` against a database reset to empty when a migration changed, to confirm every migration still applies cleanly together, not just the new one in isolation.

Needs PostgreSQL up (`docker compose up -d --wait`) with the roles from `platform/db/init/001_roles.sql`.

Never weaken a conformance rule or add an `exceptions.json` entry to reach green.
