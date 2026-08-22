# Nexora — Claude Code entry point

@AGENTS.md

## Read order

`AGENTS.md` (imported above) is the operating contract. Then `08_PHASE_1_BRIEF.md` for current scope.

Do **not** load the whole documentation pack into one context window — `README_START_HERE.md` explains why. Pull sections of `03`, `04`, `05` and individual ADRs on demand. Never load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018 during Phase 1 or 2.

When documents disagree: **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec.**

## Current state

Phase 0 complete. Phase 1 Task 0 and Task 1 (golden path `store.read`) complete and **repaired** — an independent audit found six defects (audit events not surviving their own transaction, a 404 returning `VALIDATION_ERROR`, three connection pools created at import time, `organizations`' RLS `WITH CHECK` covering UPDATE with no real predicate, `audit_events` not actually append-only) and all six are fixed as of commit `979bf3d`; see `PHASE_1_REPAIR_REPORT.md` for the defect-by-defect record and `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §4 for the current exit-criteria state. **Task 2 not started.** Phase 2 is not open — `06_IMPLEMENTATION_PLAN.md` gates it on Phase 1's exit criteria, and `Money`/`currencies` (Phase 1 step 4) do not exist yet.

74 tests passing (12 files), conformance 0 violations, 11 migrations apply cleanly from empty.

Update this section when that changes.

## Skills

- `/new-slice` — implement one vertical capability slice mirroring the golden path. Use for every new capability.
- `/phase-gate` — audit a phase against its exit criteria before the next one opens.

## Always verify before reporting done

```bash
npm run typecheck && npm test && npm run conformance && npm run db:migrate
```

Run `npm run db:migrate` against a database reset to empty when a migration changed, to confirm every migration still applies cleanly together, not just the new one in isolation.

Needs PostgreSQL up (`docker compose up -d --wait`) with the roles from `platform/db/init/001_roles.sql`.

Never weaken a conformance rule or add an `exceptions.json` entry to reach green.
