# Risk Register

Tracks known risks to the platform's correctness, security, or delivery timeline, per the phase-exit gates in `06_IMPLEMENTATION_PLAN.md` and the blockers in `07_ARCHITECTURE_GAP_REPORT.md`.

One open item from Phase 0 tooling below. Otherwise not populated yet — no feature code exists, so no implementation-level risk has surfaced beyond what `06_IMPLEMENTATION_PLAN.md`/`07_ARCHITECTURE_GAP_REPORT.md` already track. Populate further as risks are discovered during implementation.

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status | Opened |
|---|---|---|---|---|---|---|---|
| R-001 | `docker-compose.yml`'s PostgreSQL path (used by CI and by any developer without a local Postgres) has never actually been run — Docker was unavailable in the sandbox that built it, so the migration runner and live-DB conformance rules were verified instead against a native PostgreSQL 17 install as a stand-in (see `REPOSITORY_AUDIT_REPORT.md` §4.5). The underlying mechanism is proven; only the Docker/compose plumbing itself (image pull, port mapping, healthcheck, `docker compose up -d --wait` in CI) is unverified. | Low — the compose file is standard and small | Medium — if broken, CI's conformance job and any developer without local Postgres cannot run `npm test` | User to verify locally: `docker compose up -d && npm test`, confirm `.github/workflows/conformance.yml`'s equivalent step on first CI run | User | OPEN — user is verifying locally | 2026-08-22 |
