# Modules

This directory is intentionally empty until Phase 1 Task 1 (the `store.read` golden path) is reviewed and approved — see `AGENTS.md` section 0 and `08_PHASE_1_BRIEF.md`.

## Approved structure (`03_TECHNICAL_BLUEPRINT.md` §2, §2.1)

Each module gets its own folder here, e.g. `modules/identity/`, `modules/tenant/`, `modules/store/` ... (full list in `03_TECHNICAL_BLUEPRINT.md` §2). Inside each module:

```text
modules/<module>/
  contracts/
    <module>.contract.ts          public types other modules may import
    index.ts                      the only permitted cross-module import surface
  domain/
    <aggregate>.entity.ts
    <aggregate>.invariants.ts
    <value-object>.vo.ts
    <aggregate>.repository.ts     interface only, no implementation
    <aggregate>.errors.ts
  application/
    <use-case>.service.ts         one use case per file
    <use-case>.input.ts
    <use-case>.spec.ts
  infrastructure/
    <aggregate>.repository.pg.ts
    <aggregate>.mapper.ts
    <provider>.adapter.ts
  interfaces/
    <resource>.controller.ts      thin, no business logic
    <capability>.capability.ts
  migrations/
    <timestamp>__<description>.sql
```

This structure is not just documentation — it is mechanically enforced by `tools/conformance/rules/imports.ts` (dependency direction, cross-module boundaries, forbidden imports) and `tools/conformance/rules/schema.ts` / `schema-live.ts` (every migration under here, wherever it lives, is checked). See `REPOSITORY_AUDIT_REPORT.md` and `DECISION_LOG.md` for how the harness was built and verified.

A module claiming one of the ADR-030 singleton roles (idempotency, tenant-context, serving-state, money-allocator, host-resolution) marks the one file that implements it with a `@singleton-role:` marker comment — see `DECISION_LOG.md` "Singleton-rule enforcement mechanism".
