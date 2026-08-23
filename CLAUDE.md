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

**Task 2 slice 2 done:** `membership.invite` (`POST /api/v1/organizations/{organizationId}/memberships`). Adds an existing platform user, found by email, as an ACTIVE member holding **no roles** — role assignment is slice 3, per `03` §167's flow. First slice with a real permission behind it (`membership.invite`, granted to `owner`+`admin` only, added by migration) and the first with an `OrganizationAccessGuard` doing steps 2–4 at organization level. No structural divergence from the golden path. `DECISION_LOG.md` (2026-08-23) records what "invite" can mean given no `invitations` table and no `PENDING` status — items 1 and 2 there are **OPEN for V1**, to revisit when the notification module and an accept flow exist.

**Task 2 slice 3 done:** `membership.role.assign` (`POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/roles`). Adds one role to a membership's set (does not replace it) — first HIGH_WRITE capability, granted to `owner` only (not admin, unlike `membership.invite`'s owner+admin), sidestepping the self-escalation question rather than solving it with approval machinery that doesn't exist until Phase 9. Unknown role keys are rejected by a Zod enum over the closed platform role catalog (`ROLE_KEYS`, new in `modules/authorization/domain`), never reaching the database. `MembershipRepository` gained `findById`, which is **not** safe to trust without an explicit tenant check — `memberships`' self-access RLS clause (R-003) can surface a caller's own membership row from a *different* organization; the service checks `target.tenantId !== command.tenantId` explicitly and this is proven by a dedicated integration test, not just documented.

**Session invalidation on role change is now implemented** — the first of `08` §5's three triggers ("password change, membership revocation, role change") to be built. A new `SessionRevocationRepository` port (`modules/identity/contracts/`) revokes every ACTIVE session for the target user, in the same transaction as the role grant, so the two writes are atomic. This was a deliberate choice, not an obvious one: `membership.role.assign` is the *only* point among all six Task 2 slices where a role change can occur at all, since `membership.revoke` and any password-change capability are both absent from the six-slice list — deferring here risked the trigger never being built in Task 2's announced scope. The other two triggers (password change, membership revocation) remain **unimplemented** — see `DECISION_LOG.md` (2026-08-23, decision 9) before assuming session invalidation is fully covered.

Fixed along the way: `modules/identity/infrastructure/identity.tables.ts`'s `sessions.revoked_at` column was typed in a way (`ColumnType<...> | null` wrapped outside, not inside) that made it silently un-updatable through Kysely — nothing had ever updated it before this slice needed to.

**Task 2 slice 4 done:** `store.create` (`POST /api/v1/stores`, body `{ organizationId, name, slug }`). **First slice whose route breaks the path-nested-organizationId pattern** slices 2–3 established — `05_API_CAPABILITY_CONTRACTS.md` §6.1 gives this capability an explicit worked contract (flat route, `organizationId` in the body), the first Task 2 capability with one, and it was followed literally over the unwritten internal convention. `OrganizationAccessGuard` now reads `organizationId` from the path if present, falling back to the body otherwise — proven not to regress `membership.invite`/`membership.role.assign` by running their full existing suites unchanged. **Read this before adding a fifth capability**: there is no single routing convention across the four capabilities; each follows its own `05` contract where one exists (`organization.create`, `store.create` — both flat) and falls back to path-nesting where none does (`membership.invite`, `membership.role.assign`).

Creates the store, then a `store_membership` row for its creator in the same transaction — otherwise the creator could not `store.read` the store they just made (08 §5: org membership alone is insufficient for store access). Proven end to end: the integration suite drives `store.create` then `store.read` through real HTTP in one test, the first test in this codebase to exercise two capabilities together.

Adds `reserved_subdomains` (13 seeded names — the conventional infrastructure subdomains a platform withholds from itself; expected to grow before Phase 4) and a new `DOMAIN_RESERVED` error code (409, distinct from the duplicate-slug `CONFLICT`). Checked after slug normalization so the two cannot drift. `store.create`'s permission (owner+admin, matching `membership.invite`'s tier) is a new migration; no role added, so `role-catalog-agreement.spec.ts` is unaffected.

**RISK_REGISTER.md R-004 (new):** per-organization store-slug uniqueness (correct, per `04` §5) is in tension with `reserved_subdomains`' implication that a slug becomes a subdomain — subdomains are a global namespace. Flagged for Phase 4, not solved; the index is unchanged.

**Fixed after slice 4: a body field could silently override a path parameter.** `membership.controller.ts` and `membership-role.controller.ts` built their Zod input as `{ pathParams, ...body }` — body spread last — so a client-supplied body key with the same name as a path parameter won silently. For `membership.role.assign` this was a real defect: a body `membershipId` could name a DIFFERENT membership than the URL, and that membership — not the one in the path — is what got the role, the audit `resource_id`, and the audit metadata. **Read this before writing a fifth controller that mixes a path parameter with a body**: the rule now is that a path parameter is authoritative, and a body value for the same key that DIFFERS is rejected with `VALIDATION_ERROR` (an identical echo is accepted). Enforced by one shared function — `resolvePathOrBodyValue`/`buildValidationInput` in `modules/capability/interfaces/path-body-conflict.ts`, exported via `modules/capability/contracts/`, driven by `CapabilityDefinition.route.pathParams` rather than a hand-written list per controller. `organization.create`/`store.create` (`route.pathParams: []`) don't need it and aren't routed through it; `store.controller.ts` (golden path, GET, no body) doesn't exhibit the pattern and is untouched. See `DECISION_LOG.md` 2026-08-23.

**Task 2 slices 5–6 not started** (`auth.login`/`logout`/`logout_all`, `organization.switch`). Exit criteria still **eight of nine** (`PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §4); the remaining row is "revoking a membership invalidates active sessions," which needs `membership.revoke` (not one of the six slices).

237 tests passing (24 files), conformance 0 violations, 16 migrations apply cleanly from empty.

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
