# Technology Radar

**Dated 2026-09-01. Non-normative.** This document informs decisions; it does not make them. `AGENTS.md` §1's read order does not include it and must not — a radar that acquires authority becomes a second, competing decision record. Where an entry corresponds to a real decision, it points at the ADR or register row that owns it and never restates the ruling. If this document and an ADR disagree, the ADR is right and this document is stale.

## Method, and what is verified versus not

- **Claims about Nexora are verified** against this repository in this pass, with the path cited. That half is accountable in the usual way.
- **Claims about external projects are not.** Web search was available for this pass and was used, but search results are secondary sources, not upstream documentation. Every external claim below is qualified as *understood at 2026-09-01, not verified against upstream docs or source in this pass*. Versions, current features and present-tense capabilities of external tools are the single most likely thing here to be wrong, because nothing in this repository can contradict them — the same reason `RISK_REGISTER.md` R-008 says `UNDETERMINED` and R-013 says `UNMEASURED` rather than guessing.
- **No entry appears without an anchor** — a register row, an ADR, a phase item in `06_IMPLEMENTATION_PLAN.md`, or a documented gap. Candidates that could not be anchored were cut rather than included speculatively.

## What the rings mean here

These are not the generic industry definitions. For this project:

- **Adopt** — in use now, and its position is settled by an accepted ADR. Listed for orientation, not as a proposal.
- **Trial** — the decision is already made by an ADR or a register row, and the work is waiting on a **named trigger** that has not fired yet. Nothing here is an open question; it is scheduled.
- **Assess** — a real open question. Something a maintainer should look at before the phase named, with a decision owed. Several of these are owned by an `OPEN` ADR, in which case that ADR governs and this entry only points at it.
- **Hold** — do not start work with this now. **For this project, `Hold` usually means "correctly deferred by the phase plan," not "bad technology."** Four of the five entries below are on Hold because a phase plan or an ADR defers them and the deferral is working as intended. Where `Hold` means something stronger, the entry says so.

---

## Adopt

### Kysely over the native `pg` driver
**What it is** — a SQL-first, type-safe query builder; not an ORM.
**Anchor** — ADR-021 item 1, which requires exactly this shape and rejects "a full active-record or unit-of-work ORM… for V1" (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:828`).
**What it enables** — explicit control of transaction and session state, which is what makes transaction-local RLS context (`set_config('app.tenant_id', …, true)`) expressible at all, plus `SELECT … FOR UPDATE` on ledgers.
**Cost** — hand-written queries; no migration generation; the mapper between persistence rows and domain entities is written by hand (ADR-021 item 3).
**Phase** — in use since Phase 1. **Blocked by** — nothing.

### Zod as the single schema source, generating OpenAPI
**What it is** — runtime validation schemas that also drive `openapi.json` via `@asteasolutions/zod-to-openapi`.
**Anchor** — ADR-033, which rejected `@nestjs/swagger`'s decorator inference because esbuild does not implement `emitDecoratorMetadata` and fails *silently* — the worst failure mode for a drift-detection artifact.
**What it enables** — one source of truth per contract, and a CI drift check (`npm run openapi -- --check`, wired at `.github/workflows/conformance.yml`).
**Cost** — the generator must key off `CapabilityDefinition` rather than the controller, so a capability's route metadata is declared twice-adjacent rather than inferred.
**Phase** — in use since Task 2. **Blocked by** — nothing.

### Vitest
**What it is** — the test runner; esbuild-based, same constraint family as ADR-033's.
**Anchor** — `decisions/2026-08.md` 2026-08-22 ("Test runner: Vitest").
**What it enables** — the 42-file suite that every gate review has run.
**Cost** — its esbuild transform is why `emitDecoratorMetadata` is unavailable, which shaped ADR-033 and constrains ADR-040's OpenTelemetry assessment.
**Phase** — in use. **Blocked by** — nothing.

### Argon2id via `@node-rs/argon2`
**What it is** — a napi-rs Argon2 binding with prebuilt per-platform binaries.
**Anchor** — ADR-029 item 2; chosen over the classic `argon2` package because that one has historically needed node-gyp and a C++ toolchain, and this development machine is Windows with no guaranteed toolchain (`decisions/2026-08.md` 2026-08-23).
**What it enables** — password verification with OWASP's current minimum profile, installed and verified on the real machine before being committed to.
**Cost** — a native dependency, with `optionalDependencies` platform binaries.
**Phase** — in use. **Blocked by** — nothing.

### The ADR-030 conformance harness
**What it is** — this repository's own static and live-database rule checker, not a third-party tool.
**Anchor** — ADR-030. **7 rules** with **23 fixture directories**, counted directly (`tools/conformance/rules/`, `tools/conformance/fixtures/`) — each rule has at least one deliberately-failing fixture proving the rule can fail.
**What it enables** — the only mechanism turning `AGENTS.md`'s prose prohibitions into something that fails a build.
**Cost** — rules are regex-and-introspection based, so a reformat can move what they see (this happened once, during the Prettier slice).
**Phase** — in use since Phase 1 start. **Blocked by** — nothing.

---

## Trial

*Decided; waiting on a named trigger.*

### Redis-backed `RateLimitStore`
**What it is** — a drop-in replacement for `InProcessRateLimitStore` behind the existing `platform/rate-limit/store.ts` interface.
**Anchor** — `RISK_REGISTER.md` **R-005**, `PARTIALLY CLOSED`: the current store "does not hold across multiple instances of this API and resets on every restart."
**What it replaces** — `platform/rate-limit/in-process-store.ts`, and it would also retire **R-013**'s O(n)-per-write sweep, since the eviction problem is Redis's rather than ours.
**Cost** — a Redis client dependency; the `redis` service already exists in `docker-compose.yml` (D-2), so the infrastructure cost is already paid.
**Phase** — Phase 2, at the trigger. **Blocked by** — nothing technical. **Trigger:** the first time more than one instance of this API runs.

### BullMQ
**What it is** — a Redis-backed job queue.
**Anchor** — `PHASE_1_DEBT_CLOSURE.md` **D-2**, `PARTIALLY CLOSED` — the `redis` service landed deliberately, the client dependency deliberately did not, because "a queue's real design (worker topology, retry/backoff, dead-letter handling) needs a first real job to design against."
**What it enables** — ADR-024 item 8's six required jobs (`renewal.notice`, `renewal.reminder`, `subscription.rollover`, `subscription.expire`, `subscription.deprovision`, `trial.expire`) and ADR-023 item 4's reconciliation sweep.
**Cost** — worker topology, retry policy and dead-letter handling all become owned surface; a second runtime process to deploy and observe.
**Phase** — Phase 2. **Blocked by** — nothing. **Trigger:** `06` Phase 2 **item 14**, named explicitly by D-2 so the deferral cannot lapse the way its 2026-08-22 predecessor did.

---

## Assess

*Real open questions. A decision is owed by the phase named.*

### OpenTelemetry
**What it is** — a vendor-neutral tracing and metrics standard with auto-instrumentation for Node, NestJS and `pg` *(understood at 2026-09-01, not verified against upstream docs in this pass)*.
**Anchor** — **ADR-040 (`OPEN`)** already assesses it and owns the decision. This entry does not re-litigate it and deliberately assigns a ring consistent with that ADR being open.
**What it would enable** — request-to-query correlation across both pools (`APP_DB`, `AUDIT_DB`), and the metrics ADR-010's amendment says do not exist — the amendment states its numeric targets are unverified assumptions precisely because nothing measures them.
**Cost** — a substantial dependency surface, and a real technical caution this repository has already paid for once: ADR-033 established that esbuild does not implement `emitDecoratorMetadata`, and auto-instrumentation that relies on decorator metadata or monkey-patching under an esbuild transform must be proven here rather than assumed to work.
**Phase** — earliest Phase 2; not required by any Phase 2 exit criterion. **Blocked by** — ADR-040 remaining `OPEN`.

### A structured logger with a JSON transport (pino, or NestJS `Logger` reconfigured)
**What it is** — one logging path with level control and field redaction.
**Anchor** — **R-010**'s addendum records the concrete finding: two inconsistent paths today — a bare `console.log(JSON.stringify(…))` in `apps/api/logging.middleware.ts:21`, and NestJS `Logger` in `http-exception.filter.ts:38` and `capability-attempt.ts:8` — plus no redaction anywhere. **ADR-040 (`OPEN`) owns the decision.**
**What it would replace** — both paths, with one.
**Cost** — low; but doing it *before* ADR-040 rules would pre-empt an open ADR, which is why this is Assess and not Trial.
**Phase** — earliest Phase 2. **Blocked by** — ADR-040.

### Testcontainers
**What it is** — programmatic, per-test-run disposable database containers *(understood at 2026-09-01, not verified upstream in this pass)*.
**Anchor** — **R-001**'s compose-versus-native split (CI runs `postgres:17-alpine` on port 5433; this machine runs a native PostgreSQL 17 on 5432) and **R-008**'s F-3 addendum, where CI-versus-local environment divergence is the one hypothesis D-6's 165 local reproduction attempts could not rule out. Both are symptoms of one environment gap.
**What it would replace** — the ambient-database assumption in every `apps/api/*.integration.spec.ts`, and the two-configurations-of-one-thing problem underneath R-001.
**Cost** — container startup per run; and a genuine circularity worth stating plainly: **Testcontainers requires Docker, and this development machine has none** — it is blocked by precisely the gap it would close. Adopting it would move the maintainer's local workflow onto Docker first, which is a bigger decision than the tool.
**Phase** — earliest Phase 2. **Blocked by** — no Docker on the development machine; nothing else.

### `@vitest/coverage-v8`
**What it is** — V8-based coverage reporting for the existing runner.
**Anchor** — **R-021**: no coverage measurement exists anywhere (`package.json` has no script, `vitest.config.ts` has no `coverage` block, and the only occurrence of the string in the tree is an English word in a comment).
**What it would enable** — identifying untested branches, which nothing currently does.
**Cost** — near zero to add. The real cost is epistemic, and R-021 states it: **line coverage measures a proxy for `AGENTS.md` §7, not §7 itself.** §7 is about the *layer* a rule's test sits at; a fully-covered codebase can violate it completely. Adding the tool risks a number that looks like compliance and is not.
**Phase** — any. **Blocked by** — nothing but the decision R-021 records as owed, which includes "adopt nothing and keep §7 review-enforced."

### Load testing as code (k6 or equivalent)
**What it is** — scripted, version-controlled load scenarios run in CI or on demand *(tool landscape understood at 2026-09-01, not verified upstream in this pass)*.
**Anchor** — **ADR-010's 2026-08-28 amendment**, which now states every number in its table is an unverified design assumption, usable for sizing and **not** citable as a met figure — and names `06` **Phase 4 item 9** ("load test against the ADR-010 assumptions") as the point they become measurable.
**What it would enable** — the one thing that turns ADR-010 from assumption into measurement, and the only way its "observed for seven consecutive days" revisit triggers can ever fire.
**Cost** — the load test is worth little without the metrics ADR-040 owns; sequencing matters more than tool choice here.
**Phase** — Phase 4 item 9. **Blocked by** — practically, ADR-040: measuring against no instrumentation produces a number nobody can attribute.

### A committed schema snapshot with CI diffing
**What it is** — a generated `schema.sql` committed like a lockfile and diffed in CI, in the shape of the existing `graph --check` and `openapi --check` guards.
**Anchor** — **R-027** — but read the row before valuing this, because its originating finding was **partly refuted**: `tools/conformance/rules/schema-live.ts` *enumerates live tables* and applies rules to each, so an out-of-band table missing `tenant_id`, RLS, `FORCE` or a policy **is already caught**. The dangerous class is covered.
**What it would add** — only the residue: a dropped or retyped column, an added or removed index, constraint, default or trigger, and an out-of-band table that *does* carry correct tenancy.
**Cost** — a regenerate step on every migration, and a diff that will be noisy against PostgreSQL's own formatting.
**Phase** — any. **Blocked by** — nothing. Ranked lower than its register row alone suggests, because of the refutation.

### A generated TypeScript client from `openapi.json`
**What it is** — a typed client generated from the committed, CI-drift-checked artifact.
**Anchor** — ADR-033 already guarantees the artifact is accurate, which is the precondition; and **no frontend exists**, so nothing would have to be discarded.
**What it would enable** — a typed consumer for the Admin UI when one is built (**R-034**).
**Cost** — near zero to generate; but a generated client with **no consumer** is a build step maintained for nothing, and it would need regenerating on every contract change from the day it lands.
**Assessment** — cheap *later*, premature *now*, and the two are not in tension: the artifact's quality is what makes it cheap later, and that quality already exists. Revisit when a frontend is actually scheduled.
**Phase** — whenever R-034's admin UI is scheduled. **Blocked by** — nothing; it simply has no consumer.

### An object storage port
**What it is** — a `StorageProvider` interface in `platform/`, with an adapter per vendor.
**Anchor** — **R-025**, and `03_TECHNICAL_BLUEPRINT.md:211` §9 names **object storage** among the seams to "keep behind contracts from day one." `04_DATABASE_BLUEPRINT.md` §2.6 declares a `files` table. ADR-019 item 5 assumes storage exists by Phase 4 ("Product images and theme assets are served from object storage through the CDN").
**What it would enable** — Phase 3's product images, Phase 4's theme assets.
**Cost** — one more port and a vendor decision; genuinely small if done before Phase 3 rather than during it.
**Phase** — **Phase 3.** **Blocked by** — nothing. This is Assess rather than Hold precisely because a required day-one seam with **no owning phase item** is a scheduling gap, not a working deferral.

### Native PostgreSQL declarative partitioning (and `pg_partman`)
**What it is** — range partitioning of an append-only table by time; `pg_partman` is an extension that automates partition creation and retention *(understood at 2026-09-01, not verified upstream in this pass)*.
**Anchor** — **R-030**: `audit_events` has a single `(tenant_id, occurred_at)` index, no partitioning, and one row per capability attempt — while ADR-020 rules 4–5 guarantee these rows are **never purged**, so the table only grows. The same question lands on every Phase 2 append-only ledger (`usage_ledger_entries`, `billing_payment_events`, `subscription_state_transitions`, `invoices`, `outbox_events`).
**What it would enable** — bounded per-partition scans and cheap archival, without deletion — which matters because ADR-020 has already removed deletion from the option space.
**Cost** — partitioning an existing table is a migration, and migrations are forward-only (ADR-021 item 8), so doing it later is more expensive than doing it at table-creation time. **`pg_partman` specifically ranks below native partitioning here**: it is a further extension dependency for automation that, at ADR-010's assumed scale, native declarative partitioning covers without it.
**Phase** — Phase 2 is when the ledger tables are created, which is the cheap moment; R-030 rates the risk itself as `UNMEASURED` and not urgent. **Blocked by** — nothing. The tension between "not urgent" and "cheapest now" is the assessment.

---

## Hold

*Do not start work with these now. In four of the five cases the hold is the phase plan working as intended, not a gap.*

### ReBAC / a policy engine (OpenFGA, SpiceDB, Cedar)
**What it is** — permissions modelled as a relationship graph traversed at check time, rather than roles assigned to users *(understood at 2026-09-01 from secondary sources, not verified upstream in this pass)*.
**Anchor** — `00_PLATFORM_OVERVIEW.md` §3.2 does describe nested access: an Organization "can contain multiple team members with different roles, own multiple stores under one account… This is why the platform can sell to agencies, multi-brand retailers and enterprises." The implemented model is flat RBAC over three roles (`ROLE_KEYS = ["owner", "admin", "member"]`, **R-028**).
**Why Hold, honestly** — the common guidance is to reach for ReBAC when user-driven sharing ships: invitations to arbitrary resources, nested teams, folder-style inheritance. **Phase 2 is billing.** Not one of its fifteen capabilities shares a resource with anyone, and the org→store nesting `00` §3.2 describes is already modelled flatly and adequately by `store_memberships`. Starting ReBAC now would also foreclose **R-028**'s open question — whether the catalog is three roles or six — by answering it with a different model entirely, which is not the implementer's call.
**Cost if adopted early** — a separate permissions service, a second source of authorization truth alongside PostgreSQL RLS, and a new trust boundary to audit.
**Phase** — assessment owed at **Phase 3 scoping**, when commerce introduces per-resource access. **Blocked by** — R-028, and the absence of any sharing requirement.

### An MCP server over the capability layer
**What it is** — exposing capabilities as Model Context Protocol tools.
**Anchor** — ADR-001, ADR-003 and ADR-007 all exist and all block on **Phase 9**.
**The genuinely unusual fact, stated because it is what makes this dangerous** — the manifest is nearly free. Every capability already carries a Zod input schema, a Zod output schema, `requiredPermissions`, `risk` and `errorCodes` in its `CapabilityDefinition`, and `05_API_CAPABILITY_CONTRACTS.md:14` §1 already requires that "REST, Admin UI, Storefront, AI, MCP, Automation and Plugins converge on the same Application Service." The hard part — a machine-readable, permission-annotated capability surface — is done, as a side effect of ADR-033.
**Why Hold anyway** — cheapness is not authority. ADR-007 requires treating external MCP output as untrusted data with a full validation boundary; ADR-001 requires a sensitive-write confirmation flow; neither exists. Building the easy 20% and deferring the security 80% is exactly how a trust boundary gets skipped. **This entry exists on the radar specifically so the temptation is recorded rather than acted on quietly.**
**Phase** — Phase 9. **Blocked by** — ADR-001, ADR-003, ADR-007.

### pgvector / semantic search
**What it is** — vector similarity search inside PostgreSQL *(understood at 2026-09-01, not verified upstream in this pass)*.
**Anchor** — nothing to search. Products arrive in Phase 3 (`06` Phase 3); `04` §9 explicitly defers RAG schema.
**Why Hold** — the plan working. Ranked last of everything on this radar: it has no anchor in any current gap, and is listed only because it is a predictable suggestion.
**Phase** — Phase 3 at the earliest, realistically later. **Blocked by** — the absence of any searchable entity.

### Edge/CDN delivery and real-time sync
**What it is** — CDN-fronted static delivery, and push-based client updates.
**Anchor** — **ADR-019** (storefront delivery, caching, CDN/DNS as ports) and **ADR-032** (storefront read path separation) already own both, for **Phase 4**.
**Why Hold** — the hold is the plan working, and ADR-019 is itself an example of this pack correcting course: it was *moved earlier* (from Phase 4 to accepted-now) precisely because the caching strategy constrains Phase 1's tenant-context and pooling decisions. The decision is made; the implementation is scheduled. Real-time subscriptions specifically are a posture difference from Supabase/Hasura, not a missing feature — see `COMPETITIVE_POSITION.md` §2.
**Phase** — Phase 4. **Blocked by** — nothing; scheduled.

### i18n / RTL tooling
**What it is** — a message catalogue and a translation layer, plus RTL layout support.
**Anchor** — **R-026**, and the market context is real: `05_API_CAPABILITY_CONTRACTS.md:231` §6.4's own worked example is a Persian IDN hostname (`فروشگاه.example`).
**Why Hold — and this one is more interesting than "later"** — R-026's actual finding is not "no translation layer." It is that **`05` never says whether the error envelope's `message` is human-facing or developer-facing**, and the evidence points both ways. If it is developer-facing, no translation layer is owed at all and a locale in `TenantContext` would be premature. Choosing i18n tooling before that question is answered means building for a requirement that may not exist. The tooling question is downstream of a contract question.
**Phase** — earliest when a merchant-facing UI exists (**R-034**). **Blocked by** — R-026's undecided `message` audience.

---

## Ring distribution

| Ring | Count |
|---|---:|
| Adopt | 5 |
| Trial | 2 |
| Assess | 9 |
| Hold | 5 |
| **Total** | **21** |

## Review trigger

**This document goes stale the way `CLAUDE.md`'s roll-call did** — silently, because nothing mechanical checks it. `RISK_REGISTER.md` **R-031** tracks that class of failure directly.

It is owed a re-read at **whichever of these comes first**:

1. **The Phase 2 exit gate.** Most Assess entries name Phase 2 or Phase 3, and several rings would move.
2. **Any of these triggers firing:** a second API instance running (Redis store, R-005), `06` Phase 2 item 14 starting (BullMQ, D-2), ADR-039 or **ADR-040 being ruled on** (four entries point at ADR-040 and their rings are contingent on it), or Docker arriving on the development machine (Testcontainers).
3. **2026-12-01** as a backstop, if none of the above has fired — three months, dated so the staleness is visible rather than implicit.

An entry whose anchor row has closed, or whose blocking ADR has been ruled on, is stale by definition and must be re-ringed or cut.
