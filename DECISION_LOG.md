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

## 2026-08-23 — `organization.create`: five decisions the docs pack leaves open

**Context:** implementing Task 2 slice 1 (`08_PHASE_1_BRIEF.md` §3). The capability is one row in `05_API_CAPABILITY_CONTRACTS.md` §4.1 (`organization.create | user | MEDIUM_WRITE | yes`) plus one constraint in `04_DATABASE_BLUEPRINT.md` §5 ("organization slug unique within its namespace"). Nothing else in the pack describes its behaviour, and it is the first capability that does not fit the golden path's shape exactly, because it *creates* the tenant rather than acting inside one.

**1. Does creating an organization also make the creator a member?** The pack never says. `membership.invite` is a separate slice (§3 item 2) and `organization.switch` is another (item 6).
  - Options: (A) create only the organization — but every subsequent capability authorizes through `membership_roles` (pipeline step 6), so the organization would be permanently unreachable by anybody, including its creator, and slices 2 and 6 would have no reachable starting state; (B) create the organization, an ACTIVE membership for the creator, and grant them the platform `owner` role, all in one transaction.
  - **Decision: B.** This resolves an ambiguity rather than inventing architecture: (A) makes the documented slice order impossible to execute, so it cannot be the intended reading. The role granted is `owner` from the existing platform catalog — no new role, no new permission. Cross-module write goes through a new `RoleGrantRepository` port exported from `modules/authorization/contracts/`, mirroring how `modules/audit` already exposes `createAuditEventRepository`; `modules/tenant` never touches `membership_roles` directly.

**2. Pipeline steps 2–4 have nothing to resolve.** The golden path puts "resolve membership, check resource access, build `TenantContext`" in `StoreAccessGuard`, before any transaction. Here there is no pre-existing membership and no resource to check access to.
  - Options: (A) add a guard anyway, whose only acts are validating the body and calling `randomUUID()`; (B) do that work in the controller and document the absence.
  - **Decision: B.** A guard named for access resolution that resolves no access would imply a check that did not happen — worse than an honest gap. What genuinely survives of those steps is input validation and minting the organization id, which is also the tenant id and therefore has to exist *before* the transaction, because it is what the RLS context is set to. `AGENTS.md` §2 requires documenting a mismatch rather than inventing a second structure; this is that record. Everything else — step 1 in a guard, one `withTenantContext` transaction for step 7, one durable audit event for the whole attempt — is the golden path unchanged.

**3. Pipeline step 6 has no permission to assert.** §4.1 scopes the capability to `user`, and the caller holds no membership until step 7 creates one, so `membership_roles` has nothing to read.
  - **Decision:** `requiredPermissions: []`, and the controller *throws* if that list is ever non-empty, rather than looping over it and silently doing nothing. An unenforceable requirement that looks enforced is the failure mode ADR-030 exists to prevent.

**4. Idempotency: §4.1 says yes, and there is no mechanism.** ADR-009's shared idempotency store is Phase 2, no idempotency table is in `08` §4's scope list, and `AGENTS.md` §4 forbids a module-local substitute.
  - Options: (A) `idempotent: true` in the capability definition, matching §4.1 — but the ADR-033 generator turns that metadata into a published contract, so the OpenAPI document would advertise an `Idempotency-Key` guarantee nothing provides; (B) `idempotent: false`, recording what is actually enforced.
  - **Decision: B**, with the divergence stated in the capability file. The globally-unique slug index means a naive retry returns `CONFLICT` rather than creating a second organization, so the failure mode is a wrong status code on retry, not duplicate data. **Flip to `true` in the slice that lands ADR-009.**

**5. Duplicate-slug detection cannot be a pre-check.** Inside the transaction `app.tenant_id` is the *new* organization's id, so a `SELECT` for a colliding slug owned by another tenant returns zero rows — RLS hides exactly the row the check is looking for.
  - **Decision:** no pre-check exists. `OrganizationRepositoryPg` catches the `organizations_slug_key` unique violation and raises the domain-level `OrganizationSlugTakenError`, which `CreateOrganizationService` maps to the documented `CONFLICT` code. The unique index is both the only authority that sees the whole namespace and the only race-free one. `platform/db/constraint-violation.ts` inspects the error structurally rather than importing `pg`, which ADR-030 confines to three platform files.

**Also settled, minor:** `reserved_subdomains` is deliberately not consulted — `08` §5 and `04` §5 both scope that rejection to *store* slug creation, and the table belongs to the `store.create` slice. Organization slugs are still constrained to a DNS-label-safe character set (3–63 chars, lowercase alphanumeric segments separated by single hyphens) so nothing has to be re-validated under ADR-028 later.

**Status:** RESOLVED, except item 4, which is **OPEN pending ADR-009** (Phase 2).

---

## 2026-08-23 — `TenantContext` split so a non-store capability can have one

**Context:** `TenantContext` was declared inline in `store-access.guard.ts` with `storeId: string` and `membershipId: string` both required. `05_API_CAPABILITY_CONTRACTS.md` §2 declares `storeId` **optional** precisely because not every capability is store-scoped. `organization.create` is the first capability with neither a store nor a membership, and pipeline step 10 requires *every* request's structured log line to carry `tenantId` — which `loggingMiddleware` reads off `request.tenantContext`.
**Options considered:**
  A. Leave the type alone and attach an untyped partial object to `request.tenantContext` — two shapes under one property name, exactly the "second structure" `AGENTS.md` §2 forbids.
  B. Widen the existing type in place — loses the golden path's compile-time guarantee that `storeId`/`membershipId` are present.
  C. Move the 05 §2 shape into `modules/tenant/interfaces/tenant-context.ts` and derive `StoreTenantContext extends TenantContext` with both fields required; `StoreAccessGuard` still produces the narrower one and `StoreController` still consumes it.
**Decision:** C. Type-only change, no behaviour change to the golden path, and it makes the repository *more* conformant to `05` §2 rather than less. Without it `POST /api/v1/organizations` logged `tenantId: null` on every request, which is a step-10 defect, not a cosmetic one; `apps/api/organization-create.integration.spec.ts` now pins the log line.
**Status:** RESOLVED.

---

## 2026-08-23 — ADR-033 implemented with this slice, not deferred

**Context:** ADR-033 is "ACCEPTED, applies from Task 2 (Phase 1)" and `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §5.3 lists its generator and CI drift check as carried into the first Task 2 slice. `AGENTS.md` §7 makes "generated schema artifacts" part of the definition of done. This slice is that first slice.
**Options considered:**
  A. Defer to a separate task — but the ADR's own rationale is that "Task 2 adds seven more [capabilities], so the cost of deciding late rises with every slice," and every deferred slice would ship undone against §7.
  B. Build it here, minimally.
**Decision:** B. `@asteasolutions/zod-to-openapi@7.3.4` (the last line supporting Zod 3.x, which this repo is on), `tools/openapi/generate.ts`, committed `openapi.json`, `npm run openapi [-- --check]`, and a CI step. `CapabilityDefinition` gained `route`, `inputSchema`, `outputSchema` and `errorCodes` — the generator reads only those and never a controller, so it runs with no database reachable, which `tools/openapi/openapi.spec.ts` proves by running the real CLI as a subprocess with every connection string pointed at a closed port. The stale-artifact case is proven the ADR-030 way: the real check is run against a deliberately tampered copy and must exit 1.
**Scope note:** this is platform tooling, not a second vertical slice. It touched two frozen golden-path files additively (`read-store.input.ts` gained an output schema, `store-read.capability.ts` gained route/schema/error metadata) because ADR-033's first verification item is that the artifact covers *every* implemented capability.
**Status:** RESOLVED.

---

## 2026-08-22 — `modules/money`: four decisions ADR-022 leaves to the implementer

**Context:** implementing Phase 1 step 4 (`06_IMPLEMENTATION_PLAN.md`: currency registry + `Money` + allocator). `03_TECHNICAL_BLUEPRINT.md` §2 already assigns this to a `money/` module ("Money value object, currency registry, allocator"), so module ownership was not in question. ADR-022 is precise about representation, float prohibition, per-currency minor units, allocation and cross-currency arithmetic, but silent on four points that had to be settled to write the code.

**1. Which currencies to seed.** ADR-022 requires a currency table but names no rows.
  - Options: (A) seed nothing, let each deployment populate it — leaves the ADR-022 verification item "a currency with zero minor units round-trips" with no data to run against; (B) seed a broad ISO 4217 set (~180 rows) — bulk reference data nothing yet consumes; (C) seed a small set chosen to span the minor-unit exponents that actually break assumptions.
  - **Decision: C.** Seeded `IRR` (0), `USD` (2), `EUR` (2), `JPY` (0), `KWD` (3). The spread is the point: 0 and 3 both exist, so no caller can pass its tests while assuming 2. `IRR` additionally carries the presentation pair (`IRT`, divisor 10) because rial-stored/toman-displayed is the platform's home-market case per ADR-023, and that factor of 10 must never appear as a literal in code. Widening to the full ISO list is a data task, not a design change, whenever a deployment needs it.

**2. Where the presentation unit lives.** ADR-022 item 4 says the presentation unit, divisor and symbol are configuration and that "Domain and Application never see a presentation unit," but does not say how that is enforced.
  - **Decision:** the columns exist on `currencies` (configuration has exactly one home), and the domain `Currency` entity deliberately does **not** carry them — `CurrencyRepositoryPg` selects only `code`, `name`, `minor_units`. The rule is structural rather than a convention: domain code cannot reach a presentation unit because the object it holds has no such field. A test pins the entity's key set so a future field addition fails loudly. Applying the divisor is interface-layer work and is deferred until something actually renders money; nothing does yet.

**3. What `Money` carries.** ADR-022 item 1's type is `{ amountMinor: bigint; currency: string }`, but the DTO in item 7 also needs `minorUnits`, which suggests carrying the `Currency` entity instead of a bare code.
  - **Decision:** follow item 1 literally — `Money` holds `amountMinor: bigint` + `currency: string`. Allocation and all arithmetic operate purely on integer minor units and never need the exponent, so carrying it would add a registry dependency to a value object that does not use it. The exponent is supplied at the boundary instead: `toMoneyDto(money, currency)` takes the `Currency` explicitly and throws if it does not match. This keeps the registry lookup at the edge, where it belongs, and makes "which currency's exponent is this?" an explicit argument rather than an assumption.

**4. Rounding modes and decimal multiplication.** ADR-022 item 5 requires every fraction-producing operation to declare a rounding mode, default half-up.
  - **Decision:** implement no fraction-producing operation at all in Phase 1. `multiply` takes a `bigint` and is exact; splitting by a ratio goes through `allocate`, which distributes the remainder rather than rounding each part independently — which is what item 5 mandates for allocation anyway. So there is currently no operation that needs to declare a mode, and no `RoundingMode` enum has been invented ahead of a caller. The first capability that genuinely needs a decimal factor (ADR-025 proration is the likely one) adds it then, with its mode declared at that call site.

**Also settled, minor:** `modules/money`'s domain errors (`CurrencyMismatchError`, `InvalidCurrencyCodeError`, `InvalidAllocationError`) are plain `Error` subclasses, not `CapabilityError`. `CapabilityError` carries an `httpStatus`, which is an interface concern, and `Money` has no HTTP surface; a caller maps these at its own boundary like any other domain failure.

**Module shape:** `contracts/`, `domain/`, `infrastructure/` and `migrations/` are populated. `application/` and `interfaces/` are **not** — there is no use case and no HTTP surface in this slice, and creating an empty service or controller to fill the template would be exactly the premature abstraction `AGENTS.md` §4 warns against. `03_TECHNICAL_BLUEPRINT.md` §2's "each module owns interfaces/, application/, domain/, infrastructure/, and contracts/ where other modules must consume it" is read as naming the permitted layers, not as requiring every one to be occupied before it has content. The first Phase 2 slice that resolves a currency through a use case adds `application/`.

**Status:** RESOLVED.

## 2026-08-22 — Audit placement promoted to ADR-034; `03` and `08` both corrected

**Context:** a gate review found `03_TECHNICAL_BLUEPRINT.md` §3.1 still describing audit as `Commit Domain Data + Outbox -> Audit` — the rejected after-commit-only design — while `08_PHASE_1_BRIEF.md` §2 step 8 had been amended to describe option B. The instruction to fix this assumed `03` outranks `08` and that `08` correctly described the implementation. Verification found **neither assumption holds**, which is what turned a documentation sync into an ADR.

**What verification actually found:**

1. **The precedence chain does not rank `08` at all.** `CLAUDE.md` and `README_START_HERE.md` both state `ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec`. `08` is none of those categories. Meanwhile both read orders (`AGENTS.md` §1, `README_START_HERE.md`) place `08` *above* `03`, and the audit-placement entry below concluded the two are "peers." Three documents, three incompatible answers to "which wins."
2. **`08` was also wrong about the implementation.** Its amended text said the event is "written before commit." `platform/db/tenant-context.ts` is `db.transaction().execute(...)`, whose promise settles only after the transaction commits or rolls back — so the audit write in `store.controller.ts`, issued outside that callback, is necessarily issued *after* the domain transaction has resolved. The accurate description existed only in the "Correction to the above during implementation" paragraph in the entry below.
3. **`03`'s ordering was actually closer to the code than `08`'s.** Its real defects were implying the success path only, and saying nothing about the independent connection.

**Decision: write the ADR (ADR-034), rather than amend `03` to match `08` and leave the citation here.**

Reasoning, in the order it mattered:

- **Amending one document to match the other would not settle which governs.** The rule would still rest on a `03`-vs-`08` precedence relationship that three documents describe differently. `AGENTS.md` §1 states the one unambiguous rule in the pack — "ADRs override every other document" — so an ADR moots the precedence question instead of depending on its answer.
- **The accurate description lived only in the excluded document.** This log is explicitly outside the precedence chain, which is precisely the gap `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md` §116 flagged and left open ("if this rule should be normatively citable it needs its own ADR; flagged rather than assumed").
- **It is about to be copied.** `AGENTS.md` §2 makes the golden path the literal template, and Task 2's first slice reuses this mechanism while — unlike `store.read` — actually exercising the failure path.
- **Cost is low.** One entry in a pack that already carries 33, for a genuine cross-cutting normative decision rather than an implementation detail.

**Implemented:** ADR-034 "Audit Event Placement and Durability" + its index row in `02_ADR_INDEX_NORMATIVE_DECISIONS.md`; `03` §3.1's diagram corrected to `Commit or Roll Back Domain Data + Outbox -> Audit, durable, independent connection, either outcome (ADR-034)` plus a paragraph stating the semantics; `08` §2 step 8 rewritten to drop "before commit" and cite ADR-034. Both now describe the identical design, and both cite the ADR rather than this log. No code changed — the implementation was already correct.

**Deliberately not changed:** the dated point-in-time reports (`PHASE_1_REVIEW_AUDIT.md`, `PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md`, `PHASE_1_GATE_REVIEW_2026-08-22.md`) still describe the conflict as open, because that is what was true when each was written. The gap each flagged is closed by ADR-034's existence, not by rewriting the record of it having been flagged.

**Status:** RESOLVED.

## 2026-08-22 — Pipeline step 6 must share the transaction with steps 7–8 (fixed); NestJS guards were the wrong home for it

**Context:** raised in review. `08_PHASE_1_BRIEF.md` §2 orders the golden path: …4. build TenantContext → **5. transaction open + RLS context** → 6. permission authorization → 7. application service execution → 8. audit event. `03_TECHNICAL_BLUEPRINT.md` §3.1 states the same chain linearly (`Open Transaction + set RLS session context → Validate Input → Authorize Permission → … → Execute Application Service → Commit Domain Data + Outbox → Audit`). Both put authorization *after* the transaction opens, therefore inside it, together with execution.

**What was actually built (the defect):** three separate transactions. `StoreAccessGuard` opened one (steps 2–3), `PermissionGuard` opened a second (step 6), and `StoreController` opened a third (steps 7–8). Each committed before the next began.

**Was it an RLS bypass?** No — and the review's precise question deserves a precise answer. `StoreAccessGuard` read `store_memberships` over the `appDb` connection (the `nexora_app` role: `NOSUPERUSER`, `NOBYPASSRLS`, not the tables' owner, with `FORCE ROW LEVEL SECURITY` on), *inside* `withTenantContext()`, with `app.user_id` set and `app.tenant_id`/`app.store_id` empty. RLS was enabled and evaluated for that read; it matched via the self-access clause (see the entry below), not by evading a policy. So: not a bypass, but genuinely the wrong transaction boundary.

**Why the boundary still mattered.** Splitting step 6 from steps 7–8 makes the permission check a check against state that has already been committed and released: between `PermissionGuard`'s commit and the controller's transaction, a concurrent `membership.role.assign`/revoke could change the answer, and the read would proceed on a stale authorization. Same argument for the audit row: an audit written in a transaction that can commit independently of the read it describes is not an audit of that read.

**Fix (implemented):** `PermissionGuard` and its `@RequirePermission` decorator are deleted. `StoreController` now opens exactly one transaction via the single helper and runs step 6 (permission), step 7 (execute), step 8 (audit) inside it. Guards are reduced to steps 1–4, which the brief deliberately places *before* step 5 — they establish which tenant may be trusted, so they cannot already be running inside that tenant's context. The required permission is no longer a string literal at the route: it comes from `modules/tenant/interfaces/store-read.capability.ts`, the `<capability>.capability.ts` file `03_TECHNICAL_BLUEPRINT.md` §2.1 asks for.
**Status:** RESOLVED.

## 2026-08-22 — Conflict: is the audit event inside the transaction (08 §2) or after commit (03 §3.1)?

**Context:** found while making the fix above. The two normative documents disagree on where step 8 sits. `08_PHASE_1_BRIEF.md` §2 lists `5. transaction open … 7. execute … 8. audit event`, which reads as all-inside-one-transaction. `03_TECHNICAL_BLUEPRINT.md` §3.1 spells the chain out as `… Execute Application Service → **Commit Domain Data + Outbox** → Audit → Return Stable Result`, placing audit explicitly *after* the commit. Precedence (`README_START_HERE.md`) puts the ADR index above both and does not settle this; `03` and `08` are peers in the read order.

This is not academic. `ReadStoreService` writes a `FAILURE` audit row and then throws `RESOURCE_NOT_FOUND`. Inside one transaction, that throw rolls the audit row back — so the failure audit never persists, which contradicts `08_PHASE_1_BRIEF.md` §6's exit criterion "every capability in scope emits an audit event". Audit-after-commit (03's reading) does not have this problem; audit-inside-transaction (08's reading) gives atomicity between the domain effect and its audit record but silently loses every failure audit.

**Current state:** audit is inside the transaction (08's reading), because that is what the fix above produced and because for `store.read` specifically the `!store` branch is **currently unreachable** — `StoreAccessGuard` requires a `store_memberships` row, whose `store_id` is a foreign key to `stores(id)`, so a store the caller has access to cannot fail to exist. The defect is therefore latent here, but it becomes live the moment any capability audits a failure it also throws on — i.e. almost immediately in Task 2 (`store.create` on a reserved slug, `membership.invite` on a duplicate).
**The three options:**
  - **(A) Inside the transaction**, as `08_PHASE_1_BRIEF.md` §2 reads. Audit is atomic with the domain effect — an audited read cannot appear without the read having happened, and vice versa. Cost: an audit row written before a throw is rolled back by that throw, so failure audits are lost unless failure auditing moves elsewhere entirely.
  - **(B) Before commit, but on a separate connection/transaction that commits independently** — the same shape as an idempotency claim, which must also survive the outcome of the work it guards. Audit is written at the point in the pipeline the brief specifies (step 8, before the domain transaction resolves), yet persists whether that transaction commits or rolls back. Cost: the audit row and the domain effect are no longer atomic with each other — a crash between the two can leave an audit row describing a rolled-back effect, so audit means "this was attempted and authorized," not "this committed."
  - **(C) After commit**, as `03_TECHNICAL_BLUEPRINT.md` §3.1 reads. Failure audits survive, ordering matches `03` literally. Cost: an audit write that fails after a successful commit leaves a committed effect with no audit record at all — the worst failure mode of the three for an audit trail.

**Decision (2026-08-22):** **(B) is the target.** It is the only option where the audit record survives both outcomes *and* the operation cannot commit un-audited, and it reuses a pattern the platform already needs for idempotency (ADR-009), so it is one mechanism rather than two. The semantic shift it implies — an audit event attests to an authorized attempt, not to a committed effect — is accepted deliberately, and the outcome column (`SUCCESS`/`FAILURE`) is what distinguishes them.

**Superseded 2026-08-22: (B) is now implemented, not deferred.** An independent audit of commit `944e359` found this decision recorded but not built — `store.read` still audited inside its domain transaction, so a `FORBIDDEN` outcome (step 6 failing, before `ReadStoreService`/step 7 is even constructed) was **invisible to the only code that wrote audit events**, not merely "latent because unreachable" as reasoned above. That reasoning covered the `RESOURCE_NOT_FOUND` branch correctly but missed that permission denial is a *second*, independently reachable failure path with no audit coverage at all.

**Implementation:**
- `platform/db/connections.ts` adds a second pool, `AUDIT_DB`, distinct from `APP_DB`. `modules/audit/contracts/audit.contract.ts` exports `recordAuditEventDurable(db, context, event)`, which opens its own `withTenantContext()` transaction on whatever `db` it's given and returns once that commits — a self-contained "write one event durably" primitive.
- **Audit moved out of `ReadStoreService` entirely.** A single use case cannot see both step 6 (permission, checked by the controller before the service exists) and step 7 (execution, inside the service) — so `modules/tenant/application/read-store.service.ts` now does only steps 7 (find + map), no audit, no `AuditEventRepository` dependency. `modules/tenant/interfaces/store.controller.ts` wraps **both** step 6 and step 7 in one `try`/`catch`, and calls `recordAuditEventDurable(auditDb, ...)` exactly once after that block — before returning or re-throwing — with `outcome` set from whether the block threw. **One audit event per capability attempt**, not one per pipeline step: if step 6 fails, step 7 never runs, so there is only ever one outcome to record, matching the brief's "an audit event" (singular).
- This keeps the audit write structurally *before* the domain transaction's own resolution: `recordAuditEventDurable` is called using `AUDIT_DB` (a separate pool) from inside the callback passed to the `APP_DB` `withTenantContext()` call span... no — see correction below.

**Correction to the above during implementation:** the domain transaction (`APP_DB`) and the audit write both had to complete before the controller decides what to return, but they cannot be nested inside a single `withTenantContext` callback and still be "independent" in the way that matters — the audit write must survive even if something *inside* the domain callback throws. The actual shape: the whole `withTenantContext(appDb, ...)` call (steps 5-7) is wrapped in a `try`/`catch` that captures its outcome (result or thrown error) without letting the exception propagate yet; `recordAuditEventDurable(auditDb, ...)` runs next, unconditionally, on the separate pool; only then does the handler re-throw (if step 6/7 failed) or return. This still satisfies "before this handler resolves" (the caller — NestJS's router — never sees a result until the audit write has completed) while keeping the two connections genuinely independent throughout.

**Verified:** `apps/api/store-read.integration.spec.ts` proves both a `SUCCESS` row for a working request and a `FAILURE` row for a `FORBIDDEN` (permission-denied) request, against real PostgreSQL. The `RESOURCE_NOT_FOUND` branch remains genuinely unreachable through the HTTP path (confirmed by attempting to seed around it, which fails on `store_memberships`' foreign key to `stores`, not on any test assertion) and is covered only at the unit level (`read-store.service.spec.ts`).
**Status:** RESOLVED.

The conflicting sentence in `08_PHASE_1_BRIEF.md` §2 step 8 should be amended to match `03` §3.1's ordering when (B) lands.
**Status:** RESOLVED (direction agreed); implementation deferred to Task 2 by decision, tracked as the first item of Task 2's scope.

**Superseded 2026-08-22 by the ADR-034 entry at the top of this log.** The amendment was not deferred to Task 2 after all, and it did not resolve the way this paragraph anticipated: `08` was *not* amended to match `03` §3.1's ordering, because verification found `03` §3.1 described the rejected design and `08`'s own amended text ("written before commit") was unachievable against `platform/db/tenant-context.ts`. Both documents were corrected to match the implementation instead, and the rule now lives in ADR-034 rather than in this log.

## 2026-08-22 — How repositories participate in a `withTenantContext` transaction without domain seeing Kysely

**Context:** domain repository interfaces must not reference Kysely types (`FORBIDDEN-IMPORT-DOMAIN` explicitly forbids importing the query builder), but a repository call issued partway through `store.read`'s pipeline must run *inside* the one transaction `withTenantContext()` opened, using its `trx`, not a fresh connection — otherwise RLS session variables set on `trx` don't apply to the query. Full NestJS request-scoped DI (or AsyncLocalStorage-based ambient transaction propagation) would solve this generically but is real infrastructure complexity with nothing yet to generalize from — exactly the premature abstraction `AGENTS.md` warns against for a single slice.
**Decision:** repository interfaces (`domain/*.repository.ts`) stay connection-agnostic (`findById(id): Promise<User | null>`, no connection parameter — keeps domain pure). Concrete implementations (`infrastructure/*.repository.pg.ts`) take the Kysely connection (`Kysely<Database>` for RLS-exempt tables, or the `Transaction<Database>` from inside a `withTenantContext` callback for tenant-scoped ones) as a **constructor** argument. The `interfaces/` layer (guards, controllers) is the composition root: it constructs the concrete repository bound to the right connection and passes it into the application service's constructor. This is allowed because `DEP-DIRECTION-APPLICATION` forbids *application* importing infrastructure, but says nothing about `interfaces` doing so — `interfaces` importing `infrastructure` to wire things together is exactly what a composition root does. Application services themselves import only domain repository interfaces + contracts, never a concrete implementation, so they stay swappable and testable with a fake.
**Status:** RESOLVED. Revisit if/when a second capability needs to share a transaction across more than one guard+controller boundary — that's the point at which a generic ambient-transaction mechanism starts paying for itself.

**Extension — cross-module writes inside the same transaction (audit):** `store.read`'s step 8 (audit event) must write to `modules/audit`'s table using the *same* transaction as step 7's read, for atomicity — but `DEP-DIRECTION-CROSS-MODULE` forbids `modules/tenant` importing `modules/audit`'s `infrastructure/` directly, only its `contracts/`. Resolution: `modules/audit/contracts/index.ts` exports a **factory function**, `createAuditEventRepository(conn: Kysely<Database> | Transaction<Database>): AuditEventRepository` — the one place a module's `contracts/` intentionally imports Kysely types, specifically so a caller can hand in the `trx` it already has without ever importing `audit`'s concrete PG class. Every module that needs to write audit events from inside its own transaction uses this same factory; it is not re-invented per module.

## 2026-08-22 — NestJS's type-based constructor DI silently fails under esbuild/tsx — never rely on it

**Context:** `modules/authorization/interfaces/permission.guard.ts` originally took `Reflector` as a constructor-injected dependency (`constructor(private readonly reflector: Reflector) {}`), NestJS's normal idiom. At runtime, `this.reflector` was `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'get')` on every request through `PermissionGuard`. Root cause: NestJS's DI resolves an implicitly-typed constructor parameter (no `@Inject(TOKEN)`) by reading TypeScript's `emitDecoratorMetadata`-generated `design:paramtypes` array via `reflect-metadata` — and **esbuild does not implement `emitDecoratorMetadata`** (it only supports the legacy decorator *syntax*, not this metadata emission). This repo runs everything through `tsx`/Vitest, both esbuild-based, so any class relying on implicit type-based constructor injection gets `undefined` for that parameter with no compile-time warning — `tsc --noEmit` type-checks fine because the *types* are correct; only the *runtime* metadata is missing.
**Decision:** don't rely on NestJS's DI container for constructor injection by implicit type anywhere in this codebase, echoing (not contradicting) the earlier choice to keep repositories/services explicitly composed rather than DI-managed. Concretely: `Reflector` is instantiated directly (`private readonly reflector = new Reflector()`) since it has no dependencies of its own; the same "construct it directly, don't ask the container" approach already used for every repository and application service extends naturally to any NestJS-provided utility class a guard/controller needs. `@Injectable()`/`@Controller()`/`@Get()`/`@UseGuards()`/`SetMetadata()` etc. — decorators that don't depend on constructor parameter *type* metadata — are unaffected and safe to keep using.
**Status:** RESOLVED. If a future slice genuinely needs the DI container (e.g. request-scoped providers), either switch the run/build step off esbuild for that path or use explicit `@Inject(TOKEN)` tokens everywhere (which don't need `emitDecoratorMetadata`) rather than implicit type inference.

## 2026-08-22 — `INSERT ... RETURNING` re-checks the `USING` policy, not just `WITH CHECK` — breaks naive organization creation under FORCE RLS

**Context:** found while writing `apps/api/test-support/seed.ts`'s `seedOrganization()`, which needs to hand the caller the new organization's id. `organizations`' RLS policy is `USING (tenant_id::text = current_setting('app.tenant_id', true)) WITH CHECK (true)` (the `WITH CHECK (true)` from the entry below, specifically to let organization creation happen with no pre-existing tenant to check against). Verified empirically (`psql`, both as `nexora_app` and as `nexora_migrate`, the table owner — same failure either way, so this is not a role/grant issue): a plain `INSERT ... VALUES (...)` succeeds, but the identical insert with `RETURNING id, tenant_id` fails with "new row violates row-level security policy," even though `WITH CHECK` is unconditionally `true`. Postgres applies the table's `USING` policy (not `WITH CHECK`) to rows an `INSERT`/`UPDATE` returns, since returning a row is treated as a read of it — and a brand-new organization's `tenant_id` (generated from its own not-yet-trusted `id`) can never match whatever `app.tenant_id` happens to be set to.
**Options considered:** (A) set `app.tenant_id` to the new row's id *before* inserting, which only works if the id is already known — i.e. generated client-side, not by the column's `DEFAULT gen_random_uuid()`; verified this combination (client-generated id + `set_config` first + `RETURNING`) succeeds. (B) Generate the id client-side and skip `RETURNING` entirely, since the caller already knows the id; verified this succeeds with no `set_config` needed at all, because with no `RETURNING` only `WITH CHECK` is evaluated. (C) Relax `organizations`' `USING` clause to also allow self-access analogous to `memberships`/`store_memberships` — rejected, there is no independent identifier to key that off (the row *is* the tenant).
**Decision:** B — simplest, no context-setting choreography needed. `seedOrganization()` generates the id with `randomUUID()` and inserts without `.returning()`. **This is the pattern Task 2's real `organization.create` capability must also use** — noted here so it doesn't have to be rediscovered.
**Status:** RESOLVED for Task 1's test seeding. Flag for Task 2: `organization.create`'s application service must generate the id itself, not rely on the column default + `RETURNING`.

## 2026-08-22 — Correction: `platform/clock.ts` is needed in Task 1 after all

**Context:** the directory-structure entry below originally said no clock was needed since store.read does no calendar arithmetic. Writing `modules/identity/domain/session.entity.ts`'s expiry check surfaced that ADR-031 item 6 names "expiry" explicitly ("Application code obtains time from an injected clock... so term, grace and expiry logic is testable at boundaries") — a session's `expiresAt` comparison against "now" is exactly that, regardless of how simple the comparison is.
**Decision:** added `platform/clock.ts` (a one-method `Clock` interface + `systemClock`), injected into `modules/identity/application/validate-session.service.ts` rather than comparing against `new Date()` directly, so a test can assert "an expired session is rejected" without waiting on real time or mutating the system clock.
**Status:** RESOLVED.

## 2026-08-22 — No cross-module foreign-key constraints; `organizations.tenant_id` is a generated mirror of `id`

**Context:** two schema-design questions that came up writing Task 1's actual migrations, both direct corollaries of already-stated rules rather than new ambiguity, recorded because they set the pattern every later migration copies.

1. **Cross-module FKs.** `04_DATABASE_BLUEPRINT.md` §1: "every table has exactly one owning module. Cross-module reads go through contracts, never through a foreign repository." A `REFERENCES` constraint from e.g. `modules/tenant/.../memberships` to `modules/identity/.../users` is the schema-level version of exactly that coupling, and also creates a real migration-ordering hazard (`platform/db/discover-migrations.ts` sorts `<filename>__<module>` alphabetically by module, so `identity`'s migrations don't reliably run before `tenant`'s). **Decision:** FK constraints only within the same module's own tables; a cross-module reference (e.g. `memberships.user_id`, `store_memberships.user_id`, `membership_roles.tenant_id`/`membership_id`, `audit_events.tenant_id`/`actor_user_id`) is a plain indexed column, integrity enforced at the application layer via the owning module's contract.
2. **`organizations.tenant_id`.** An organization *is* the tenant — there is no separate tenant row for it to point at, so a literal `tenant_id` column referencing itself would be redundant and error-prone to keep in sync by hand. **Decision:** `tenant_id uuid GENERATED ALWAYS AS (id) STORED` — always consistent by construction, and it means `tools/conformance/rules/schema.ts`/`schema-live.ts` need no special case for `organizations`: it has a real `tenant_id` column and a normal `tenant_id = ...` RLS policy like every other table.

**Status:** RESOLVED.

## 2026-08-22 — `roles`/`permissions`/`role_permissions` are platform-global, not tenant-owned; only `membership_roles` is tenant-scoped

**Context:** `08_PHASE_1_BRIEF.md` §5's blanket rule ("every table above except users, currencies and reserved_subdomains carries tenant_id") would, taken completely literally, put `tenant_id` on `roles` and `permissions` too. But a permission key like `store.read` is a fixed, platform-defined capability identifier (`05_API_CAPABILITY_CONTRACTS.md` §4's capability table), not something each tenant defines independently — structurally identical to why `currencies` is exempt. Phase 1 does not need tenant-custom roles (that would be a real feature, out of scope per the user's "no feature code" framing for schema plumbing).
**Recommendation:** treat `roles`, `permissions`, `role_permissions` as platform-global reference data (no `tenant_id`, no RLS), seeded with a fixed Phase 1 catalog (`owner`/`admin`/`member` roles, a `store.read` permission, all three roles granted it), on the grounds above. `membership_roles` (which membership holds which role) is genuinely tenant-scoped either way, since a membership only exists within one organization — that part is not in question.
**DECIDED 2026-08-22: option (B) — the role catalog stays platform-global.** Rationale given: this is Phase 1 core, and capability keys are platform-defined rather than per-tenant. No `tenant_id` was ever added to `roles`, `permissions` or `role_permissions`, so nothing had to be removed; `TENANT_EXEMPT` has been re-widened to include all three and the harness is green again. `membership_roles` remains tenant-scoped with `tenant_id` + RLS + FORCE, which was never in question. `08_PHASE_1_BRIEF.md` §5 should be amended to cover platform-global reference data. Revisit only if tenant-custom roles become a real feature.

**Superseded status record (kept for history):** **OPEN — REVERTED, awaiting decision (2026-08-22).** Previously marked RESOLVED on my own authority; it should not have been. §5's rule is normative and enumerates its exemptions explicitly, so exempting three more tables is a documentation amendment, not an implementation detail. The `TENANT_EXEMPT` widening is backed out; **the harness now reports `roles`, `permissions` and `role_permissions` as `SCHEMA-MISSING-TENANT-ID` + `SCHEMA-MISSING-RLS`.** The migration was deliberately left as-is (global catalog, no `tenant_id`) rather than rewritten, because adding `tenant_id` to the role catalog is the competing option and equally the decider's call.

The decision needed is one of:
  - **(A)** the catalog becomes tenant-owned: every organization gets its own `roles`/`permissions`/`role_permissions` rows, with `tenant_id` + RLS per §5 read literally. Implies seeding a role/permission set per organization at `organization.create` time, and makes "what does `store.read` mean" a per-tenant answer.
  - **(B)** §5's exemption list is amended to also cover platform-global reference data, and `TENANT_EXEMPT` is widened to match. My recommendation.
  - **(C)** a split: `permissions` (fixed capability identifiers, platform-global) stays global while `roles`/`role_permissions` (which could plausibly become tenant-customizable later) become tenant-owned now to avoid a migration later.

Nothing further will be implemented on this until a decision is given.

## 2026-08-22 — Task 1 toolchain additions: NestJS 11 + Express, Zod, cookie-parser

**Context:** `08_PHASE_1_BRIEF.md` §0 names NestJS + TypeScript as the decided backend stack but doesn't pin a major version or an HTTP adapter (Express vs. Fastify), and no input-validation library was named anywhere in the pack.
**Decision:** `@nestjs/core`/`@nestjs/common`/`@nestjs/platform-express` **v11**, not v10 — v10's dependency tree (`@nestjs/platform-express` <=10.x pulls `multer`/`express`/`qs`/`body-parser` versions with 5 known DoS advisories plus a `file-type` DoS pulled in by `@nestjs/common`) resolved cleanly to zero new advisories on v11; verified via `npm audit` before and after. Express over Fastify: no measured requirement favors either yet, and Express has the larger NestJS ecosystem/example base for a first slice. `zod` for capability input schemas (`05_API_CAPABILITY_CONTRACTS.md` §5's `inputSchema: unknown`): TS-first, no decorator-based DTO ceremony, composes cleanly with the "one input schema per use-case file" convention (`<use-case>.input.ts`). `cookie-parser`: ADR-029 item 3 requires an `httpOnly`/`Secure`/`SameSite=Lax` session cookie for browser surfaces; this is the standard, minimal Express middleware for reading it.
**Status:** RESOLVED.

## 2026-08-22 — Task 1 directory structure, finalized before golden-path code

**Context:** the user asked to finalize and log the directory map before writing any Task 1 code, since the golden path (`store.read`) is the pattern every later slice mirrors (`AGENTS.md` §2) and a wrong pattern here multiplies.

**Decision:**

```text
apps/api/            the one NestJS deployable Phase 1 needs (03_TECHNICAL_BLUEPRINT.md
                      §1: "api, worker and web may be separate deployables"). main.ts
                      (bootstrap) + app.module.ts (wires every module's NestControllers/
                      Providers together) ONLY — no business logic, no module-specific
                      code. worker/ and web/ are added under apps/ if/when a slice needs
                      them; not created speculatively now.

platform/            cross-cutting infrastructure only — never business logic, never a
                      module aggregate. db/ (pool, kysely, migrate, tenant-context,
                      assert-role-safety), config.ts, clock.ts (ADR-031 item 6, injected
                      clock — corrected below: session expiry needs it, not deferred).

modules/<module>/    exactly 03_TECHNICAL_BLUEPRINT.md §2.1, no deviation:
  contracts/           public types + index.ts — the only cross-module import surface
  domain/              entities, invariants, value objects, repository INTERFACES, errors
  application/         one use case per file (services), input schemas, specs
  infrastructure/      repository implementations (.repository.pg.ts), mappers
  interfaces/          controllers (thin, no business logic), capability definitions,
                        and — see note below — guards
  migrations/           <timestamp>__<description>.sql, owned by this module only
```

**Modules touched by Task 1** (per `03_TECHNICAL_BLUEPRINT.md` §2's module list, which names table ownership directly): `identity/` (`users`, `sessions` — `credentials`/`identity_providers` deferred, see the migration-scope entry below), `tenant/` (`organizations`, `memberships`, `stores`, `store_memberships` — the blueprint explicitly assigns "store ownership" to `tenant/`, not a separate `store/` module), `authorization/` (`roles`, `permissions`, `role_permissions`, `membership_roles`), `audit/` (`audit_events`).

**Where guards live — a genuine gap in §2.1, resolved here:** the file convention names `controllers` and `capability` definitions under `interfaces/` but never mentions authentication/authorization middleware, even though the golden path's own pipeline (`08_PHASE_1_BRIEF.md` §2, steps 1–6) is entirely guard-shaped work (authenticate, resolve org, check store access, build context, open transaction, authorize permission) that must run *before* a controller method and must not itself contain business logic beyond orchestration. Options considered: (A) put all pipeline orchestration in the controller — rejected, directly contradicts "controllers contain no business logic" (`AGENTS.md` §4) and would force every future controller to hand-repeat the same five steps; (B) build the Phase 5 "capability registry and policy pipeline" now — rejected, Phase 5 is explicitly deferred (`06_IMPLEMENTATION_PLAN.md`), and building it against a single slice with no other capabilities to generalize from would be exactly the premature abstraction `AGENTS.md` warns against; (C) NestJS Guards, one per pipeline step, each thin and delegating to its owning module's `application/` use case, chained on the controller with `@UseGuards(...)`, living at `modules/<module>/interfaces/<step>.guard.ts`. **Decision: C.** A guard is interface-layer orchestration wired to a specific transport (NestJS), exactly analogous to a controller, so it belongs in `interfaces/` even though §2.1's file list doesn't name it explicitly — this is a naming gap, not a structural one. Guards for Task 1: `modules/identity/interfaces/session.guard.ts`, `modules/tenant/interfaces/store-access.guard.ts`, `modules/authorization/interfaces/permission.guard.ts`.

**Dependency Direction alignment:** `tools/conformance/rules/imports.ts`'s `locate()` already matches `^modules/([^/]+)/([^/]+)/` generically against any module/layer name, so no code change was needed — the rule was already correct for this map. What changes is which paths are *populated*: `platform/` stays outside `modules/`, is excluded from the module-boundary rules by construction (the rule only fires on `modules/...` paths), and remains subject to the forbidden-import and secret rules like everything else (it is not excluded the way `tools/` is).

**Status:** RESOLVED.

## 2026-08-22 — Task 1 migration scope: which Phase-1 tables now, which deferred

**Context:** the user's constraint is "migrations only for the tables in `08_PHASE_1_BRIEF.md` §4" — a ceiling, not a floor. §4 lists ~16 tables; Task 1 is explicitly "only `store.read`" (the user's words), not the rest of Task 2's slices.
**Decision:** create migrations only for the tables `store.read`'s own pipeline touches: `users`, `sessions` (step 1, authenticate), `organizations`, `memberships` (step 2/3, org + store membership resolution), `stores`, `store_memberships` (steps 3/7, the access check and the read target), `roles`, `permissions`, `role_permissions`, `membership_roles` (step 6, permission authorization), `audit_events` (step 8). Deferred to whichever later Task 2 slice first needs them: `credentials`, `identity_providers` (needed by `auth.login`, not by validating an *existing* session), `currencies` (needed once `Money` is first used), `outbox_events` (needed once eventing starts), `reserved_subdomains` (needed by `store.create`'s slug validation). All five remain inside the §4 ceiling and will be added in their own migration when that slice starts, per `AGENTS.md` §4's "no half-finished implementations."
**Status:** RESOLVED.

## 2026-08-22 — RLS exemption list is incomplete for the identity cluster (users/credentials/sessions/identity_providers)

**Context:** `08_PHASE_1_BRIEF.md` §5 states every Phase 1 table except `users`, `currencies` and `reserved_subdomains` carries `tenant_id` and RLS. Taken literally, that would put `tenant_id` and RLS on `sessions`, `credentials` and `identity_providers` — but a platform user is not owned by a single tenant (the same user can hold memberships in multiple organizations and switch between them, ADR-029 item 5), so a session/credential/identity-provider row cannot be correctly scoped to one `tenant_id` any more than `users` itself can. Enforcing RLS on `sessions` would also be circular: validating a session is the step that *establishes* which tenant is trusted (`08_PHASE_1_BRIEF.md` §2 step 1, before step 4's `TenantContext` exists) — a policy requiring `app.tenant_id` to already be set would make it impossible to ever read the row that tells you what to set it to.
**Options considered:** (A) follow §5 literally, add a synthetic/nullable `tenant_id` to these tables anyway — rejected, there is no correct value to put there for a user with multiple memberships, and it doesn't resolve the circularity. (B) Treat `sessions`, `credentials`, `identity_providers` as exempt for the same structural reason `users` is exempt — they are all owned by the `identity` module's `User` aggregate, not by a tenant — and let `tools/conformance/rules/schema.ts`'s `TENANT_EXEMPT` set be the actual source of truth rather than treating §5's enumerated list as exhaustive.
**Recommendation:** B, but see status — this is a documentation change, and the call is not the implementer's to make.

**DECIDED 2026-08-22: option (B) — `sessions` stays platform-global.** Rationale given: a user holds memberships in several organizations at once while having one active session, so a session row has no single correct `tenant_id`. No `tenant_id` column was ever added to `sessions`, so nothing had to be removed; `TENANT_EXEMPT` has been re-widened to include it in both `tools/conformance/rules/schema.ts` and `schema-live.ts`, and the harness is green again. `08_PHASE_1_BRIEF.md` §5's exemption sentence should be amended to name this exemption so it is not rediscovered per-table.

**Not covered by this decision:** `credentials` and `identity_providers` do not exist yet. They are the same structural case and will very likely take the same answer, but that is deliberately not pre-decided here — the call gets made in the Task 2 slice (`auth.login`) that creates them.

**Superseded status record (kept for history):** **OPEN — REVERTED, awaiting decision (2026-08-22).** This was previously marked OPEN while nevertheless being implemented, which was wrong: widening §5's exemption list is a change to a normative document, not an implementation detail, and marking an entry OPEN does not license shipping the recommended option in the meantime. The `TENANT_EXEMPT` widening has been backed out of both `tools/conformance/rules/schema.ts` and `schema-live.ts`, which now contain exactly §5's three tables. **The harness therefore now reports `sessions` as `SCHEMA-MISSING-TENANT-ID` + `SCHEMA-MISSING-RLS`, and is red.** That red state is the correct, honest signal: the schema as built deviates from §5, and the deviation is now visible rather than sanctioned by a rule I widened myself. The migration was deliberately *not* changed either, because adding `tenant_id`/RLS to `sessions` is the competing option and equally the decider's call.

Concretely, the decision needed is one of:
  - **(A)** `sessions` gets `tenant_id` + an RLS policy, per §5 read literally. Requires resolving the circularity: the session row is what tells the server which tenant to trust, so its policy cannot require `app.tenant_id` to already be set. A self-access policy keyed on `app.user_id` (as already used for `memberships`, see the entry below) would work, but `tenant_id` still has no single correct value for a user holding memberships in several organizations — it would have to be nullable, or mean "the session's active organization," which changes on `organization.switch`.
  - **(B)** §5's exemption list is amended to name the identity cluster, and `TENANT_EXEMPT` is widened to match. My recommendation, on the grounds above, but it is a documentation amendment.
  - **(C)** something else, e.g. splitting session-tenant association into a separate tenant-owned table.

Nothing further will be implemented on this until a decision is given.

## 2026-08-22 — RLS bootstrap: how a query resolves tenant context before tenant context exists

**Context:** `08_PHASE_1_BRIEF.md` §2 steps 2–3 (resolve organization membership, check store access) must query `memberships` and `store_memberships` — both tenant-owned, RLS-protected tables — *before* step 4 builds the trusted `TenantContext` those tables' RLS policies would normally require. This is the same circularity as the entry above, one level later in the pipeline.
**Decision:** `04_DATABASE_BLUEPRINT.md` §6 already sets three session variables, not one — `app.tenant_id`, `app.user_id`, `app.store_id` — which only makes sense if some policies key off `app.user_id` alone. `memberships` and `store_memberships` get a policy allowing a row when **either** `tenant_id = current_setting('app.tenant_id', true)` **or** `user_id = current_setting('app.user_id', true)`, so a user can always see their own membership rows (self-access, used to bootstrap which tenant to trust) even with no tenant context set, while a fully-scoped query (e.g. "list every member of org X") still requires `app.tenant_id`. `platform/db/tenant-context.ts`'s `withTenantContext()` is generalized from a single `tenantId` argument to a `{ tenantId, userId, storeId }` context object (all independently nullable) so it can express both the bootstrap phase (`userId` set, `tenantId`/`storeId` null) and the fully-trusted phase (all three set) through the one helper — no second helper, no duplicate transaction-opening code.
**DECIDED 2026-08-22: option (A) — the self-access clause stays**, on the stated grounds that removing it disables the system. It remains on `memberships` and `store_memberships` only (`user_id = current_setting('app.user_id', true)` OR the tenant match), and must not be copied onto other tenant-owned tables without a decision of its own: it is a deliberate, narrow bootstrap affordance for the two tables read at pipeline steps 2–3, not a general pattern. Tracked as a standing risk in `RISK_REGISTER.md` R-003, which Task 2 re-evaluates against a clause-free alternative.

**Superseded status record (kept for history):** **OPEN — flagged 2026-08-22, still implemented (unlike the two entries above), see below.** This is the same class of decision as the two RLS entries now reverted: it widens a tenant-owned table's policy beyond a plain `tenant_id` match, which §5 does not describe. It is surfaced here for the same decision-maker rather than left marked RESOLVED on my authority.

It is *not* backed out the way the other two were, because it is load-bearing in a way they are not: `memberships` and `store_memberships` are read at pipeline steps 2–3, which by the brief's own ordering run *before* step 5 opens the tenant transaction. With a plain `tenant_id`-only policy those two reads return zero rows, the store access check can never succeed, and `store.read` returns `STORE_ACCESS_DENIED` for every request — i.e. removing it does not leave a more-conformant system, it leaves a non-functional one. Backing it out therefore needs a replacement design in the same change, which is a decision, not a revert.

Options if the self-access clause is not acceptable:
  - **(A)** keep it (current state) — a user may always read their own membership rows regardless of tenant context; cross-user reads still require `app.tenant_id`.
  - **(B)** resolve steps 2–3 through a `SECURITY DEFINER` function that encapsulates exactly the bootstrap lookup, keeping the table policy strict. Narrower blast radius, but moves trust into a database function.
  - **(C)** give the session row an authoritative `tenant_id` (see the `sessions` entry above — these two questions are coupled) so `app.tenant_id` is known from step 1 and the bootstrap phase disappears entirely. Most structurally clean; largest change; depends on how the `sessions` question is decided.

Note (A)/(B)/(C) interact with the `sessions` decision — worth deciding both together.

## 2026-08-22 — RLS: FORCE ROW LEVEL SECURITY or a non-owner app role

**Context:** while writing `platform/db/tenant-context.spec.ts` to prove the new Kysely-based `withTenantContext()` helper against real PostgreSQL, empirically verified (via `psql`, see session transcript) that **the role owning a table bypasses `ENABLE ROW LEVEL SECURITY` entirely by default** — a table owner sees every tenant's rows regardless of `app.tenant_id`, `ENABLE ROW LEVEL SECURITY` notwithstanding. This is standard PostgreSQL behavior (RLS never applies to a table's owner or a superuser unless forced), but it directly threatens `08_PHASE_1_BRIEF.md` §5's non-negotiable rule: "the application database role cannot bypass RLS." This Phase 0 scaffold currently uses one role (`nexora`) for everything — the migration runner creates tables as `nexora`, so `nexora` owns them, so `nexora` would silently bypass RLS if it's also the role the running application connects as.
**Options considered:**
  A. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on every tenant-owned table (in addition to `ENABLE ROW LEVEL SECURITY`) — makes RLS apply even to the owner. Confirmed working empirically (with FORCE, the owner is correctly restricted to zero rows with no tenant context, and an INSERT with the wrong/no tenant context is rejected by the policy's implicit `WITH CHECK`).
  B. Two roles: a migration/owner role (used only by the migration runner, never by the running application) and a separate, non-owner application role granted `SELECT`/`INSERT`/`UPDATE`/`DELETE` via `GRANT` — RLS applies automatically to any non-owner role without needing `FORCE`. This is the more conventional production pattern and also limits the app role's privileges (can't `DROP TABLE`, alter schema, etc. — useful defense in depth independent of RLS).
  C. Both — `FORCE` as a belt-and-suspenders default even with a separate app role, in case a future migration accidentally reuses the owner role for a live connection.
**Decision, confirmed by the user 2026-08-22: C — both, plus a runtime assertion.** Not belt-and-suspenders as a hedge; three independent, mandatory layers, none optional:

1. **Two roles.** `nexora_migrate` owns the schema and runs migrations only (`platform/db/migrate-cli.ts`, and the harness's live-DB schema-structure checks — see `platform/config.ts`'s `loadMigrateDbConfig()`). `nexora_app` (`NOSUPERUSER NOBYPASSRLS`, never an owner) is the only role the running app, and its tests, connect through (`loadDbConfig()` / `loadConformanceTestDbConfig()`). Bootstrapped by `platform/db/init/001_roles.sql` (mounted into `docker-entrypoint-initdb.d/` by `docker-compose.yml`), including `ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrate ... GRANT ... TO nexora_app` so every future table nexora_migrate creates automatically grants nexora_app DML rights — no per-migration `GRANT` needed. Verified locally against the native PostgreSQL 17 install (same statements, by hand).
2. **`FORCE ROW LEVEL SECURITY` on every tenant-owned table, mechanically enforced.** Added as a new conformance rule, `SCHEMA-MISSING-FORCE-RLS`, in both `tools/conformance/rules/schema.ts` (static) and `schema-live.ts` (live introspection via `pg_class.relforcerowsecurity`) — checked only once `ENABLE ROW LEVEL SECURITY` + a policy already exist, so it doesn't pile onto `SCHEMA-MISSING-RLS`'s message when RLS is absent outright. New fixture `tools/conformance/fixtures/schema-missing-force-rls/`, two new self-test cases (static + live), both passing. The `clean` control fixture was updated to include `FORCE` so it still asserts zero violations.
3. **A runtime safety assertion**, `platform/db/assert-role-safety.ts`'s `assertRoleCannotBypassRls(db, tableName)`: checks the connected role is not a superuser, does not have `BYPASSRLS`, and does not own the table being tested — throws a specific, actionable error naming which condition failed if any do. Called from `platform/db/tenant-context.spec.ts`'s `beforeAll`, before any test that asserts tenant isolation, per the user's own framing: "otherwise tenant-isolation tests would go green for the wrong reason." Verified this actually fires: manually pointed `DATABASE_URL` at `nexora_migrate` (the owner) and separately at the `postgres` superuser — both failed loudly with the expected message and skipped the isolation assertions rather than passing vacuously.

`platform/db/tenant-context.spec.ts` now does schema DDL via a `nexora_migrate`-backed Kysely instance and every tenant-scoped query via a `nexora_app`-backed one through `withTenantContext()` — mirroring how migrations vs. app queries will work in Task 1.
**Status:** RESOLVED.

## 2026-08-22 — Conformance rule: no direct pool/transaction access bypassing the tenant-context helper

**Context:** the user asked, alongside picking Kysely, for a mechanical rule so any code that reaches the database pool or opens a transaction without going through `withTenantContext()` fails CI — otherwise "exactly one tenant-context helper" (ADR-030 singleton rule) is a convention, not an enforced boundary, and a future repository could open `db.transaction()` directly and forget to set `app.tenant_id`.
**Decision:** added `tools/conformance/rules/db-access.ts` with two checks, scoped to `modules/**` and `platform/**` (matching how other rules scope to real product code):
  - `DB-ACCESS-RAW-PG-IMPORT` — only `platform/db/pool.ts`, `platform/db/migrate.ts` and `platform/db/migrate-cli.ts` may import from `"pg"` directly. Everything else must go through `platform/db/kysely.ts`'s `createDb()`. (Migrations legitimately need raw `pg` because migrations are "reviewed plain SQL," not query-builder-constructed — see the Kysely entry above.)
  - `DB-ACCESS-TRANSACTION-BYPASSES-HELPER` — only `platform/db/tenant-context.ts` may call `.transaction(`. Regex-based (`\.transaction\s*\(`), same known limitation as `imports.ts` (source-text scanning, not the TS compiler API) — acceptable for the same reason: no false negatives observed against a currently-empty real tree, and the fixtures prove true positives are caught.
**Status:** RESOLVED.

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
**Status:** RESOLVED — confirmed by the user 2026-08-22: option B. `08_PHASE_1_BRIEF.md`'s Task 0 list is a summary of what to do first, not a ceiling on Phase 0 scope; `06_IMPLEMENTATION_PLAN.md`'s full 7-item list is the authoritative Phase 0 deliverable set, corroborated by `03_TECHNICAL_BLUEPRINT.md` §4.

## 2026-08-22 — Query builder: Kysely

**Context:** `08_PHASE_1_BRIEF.md` §0 and ADR-021 name Drizzle or Kysely as the accepted options but do not pick one; `06_IMPLEMENTATION_PLAN.md` Phase 0 item 2 lists "the query builder chosen in ADR-021" as a toolchain-inventory deliverable. An earlier entry in this log deferred the pick, reasoning that Phase 0's own DB code (migration runner, RLS helper) doesn't need one. The user has since decided directly rather than waiting for Task 1 evidence.
**Decision:** Kysely, confirmed by the user 2026-08-22. Reason given: explicit control over transaction/session scope for RLS, with no codegen layer sitting between the call site and the SQL Postgres actually runs — matters specifically because every tenant-scoped query must execute inside the one transaction that has `app.tenant_id` set via `set_config` (ADR-021), and Kysely's `db.transaction().execute(trx => ...)` makes that scope explicit at the type level (the callback only receives a `Transaction<DB>`, not the top-level `Kysely<DB>`), where a heavier ORM/codegen layer (Drizzle's generated client, or a full ORM) would make it easier to accidentally issue a query outside that scope.
**Implementation, same session:** `platform/db/kysely.ts` (`createDb()`, wrapping the existing `pg.Pool` from `platform/db/pool.ts` in a `PostgresDialect`, plus a placeholder `Database` interface each module will extend via declaration merging as its migrations land) and `platform/db/tenant-context.ts` (`@singleton-role: tenant-context`, rewritten to open a Kysely transaction and run `set_config('app.tenant_id', ...)` as the first statement inside it, per the user's request that the single transaction/RLS helper be built on Kysely immediately rather than left raw). Migrations themselves stay on raw `pg` (`platform/db/migrate.ts`/`migrate-cli.ts`) since they are "reviewed plain SQL, forward-only" (ADR-021 item 8), not query-builder-constructed — Kysely is for application/repository query code, migrations are a different concern.
**Enforcement:** added `tools/conformance/rules/db-access.ts` (two new rules, `DB-ACCESS-RAW-PG-IMPORT` and `DB-ACCESS-TRANSACTION-BYPASSES-HELPER`) so that only `platform/db/pool.ts`, `platform/db/migrate.ts` and `platform/db/migrate-cli.ts` may import `pg` directly, and only `platform/db/tenant-context.ts` may call `.transaction(`. Any other file reaching the pool or opening its own transaction — bypassing the one RLS helper — fails CI. Fixtures and self-tests in `tools/conformance/fixtures/db-access-*`.
**Status:** RESOLVED.

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
