# Competitive Position

**Dated 2026-09-01. Non-normative.** This document informs decisions; it does not make them. `AGENTS.md` §1's read order does not include it and must not. Where a section touches a real decision, it points at the ADR or register row that owns it and never restates the ruling.

## Method, and which projects are actually comparable

- **Claims about Nexora are verified** against this repository in this pass, with paths cited.
- **Claims about the reference projects are not.** Web search was available and was used, but search results are secondary sources rather than upstream documentation or source. Every external claim is *understood at 2026-09-01, not verified against upstream in this pass*. This asymmetry is the point: nothing in `D:\Nexora` can contradict a wrong claim about Hasura's permission model, which makes such a claim more likely to survive unchallenged, not less.

**Not all seven reference projects are competitors, and saying which is part of the analysis:**

| Project | Comparable? |
|---|---|
| **PostgREST** | Yes — the clearest architectural contrast: schema-derived API versus hand-written capabilities. |
| **Hasura** | Yes — same contrast in GraphQL form, with its own permission layer. |
| **Supabase** | Yes, partially — it is a *platform* (Postgres + PostgREST + auth + storage + realtime), so it competes on assembled surface rather than on architecture per component. |
| **NestJS** | **No — it is a dependency.** Nexora is built on it (`package.json`). Comparing them is a category error. |
| **Prisma** | **No — it is the alternative to a choice already made.** ADR-021 item 1 rejects "a full active-record or unit-of-work ORM… for V1" and names Kysely or Drizzle. Prisma is what ADR-021 declined, not a competing product. |
| **Strapi** | Weakly — a headless CMS. Content modelling with a generated admin panel is a different product category from subscription billing. |
| **KeystoneJS** | Weakly — same category as Strapi; TypeScript-defined models generating a GraphQL API and admin UI *(understood at 2026-09-01)*. |

The useful comparison is therefore mostly against **PostgREST, Hasura and Supabase**, on *architectural posture* rather than feature count.

---

## §1 — What Nexora does that these projects do not

Each of these is verified in this repository. For each, what the comparison projects do instead is stated as understood at 2026-09-01 and not verified upstream.

### 1. Architecture rules that fail a build, not rules written in prose

**Nexora:** ADR-030's conformance harness — **7 rules** across **23 fixture directories**, counted directly (`tools/conformance/rules/`, `tools/conformance/fixtures/`), each rule carrying at least one *deliberately failing* fixture proving it can fail. It runs in CI (`.github/workflows/conformance.yml`) alongside `graph --check` and `openapi --check`. `exceptions.json` is `[]` — no suppressions. It forbids, mechanically: a `domain` file importing the query builder or driver, cross-module repository access, a second idempotency table, a floating-point money column, a tenant-owned table without `tenant_id` + RLS + `FORCE`, and direct pool access bypassing the tenant-context helper.

**The others:** enforce their invariants through the framework's own shape — you cannot easily violate PostgREST's model because you barely write code. That is a real form of safety, and it is a *different* one: it constrains what you can express, where Nexora's harness constrains what you may express in a codebase that could otherwise express anything. `AGENTS.md` §2 states the reason plainly: "Rules expressed only as prose are not enforceable on a long task."

**Honest caveat:** the harness cannot check everything. `RISK_REGISTER.md` R-022 records that nothing mechanically ties the implemented `CapabilityDefinition` to `05` §5's declared shape.

### 2. Tenant isolation proven live, against a role that cannot bypass it

**Nexora:** every tenant-owned table carries `tenant_id`, `ENABLE ROW LEVEL SECURITY`, **`FORCE ROW LEVEL SECURITY`**, and a policy — verified in the live database rather than read from SQL text (`PHASE_2_ENTRY_REVIEW_2026-08-28.md` §2 confirmed `relrowsecurity` and `relforcerowsecurity` both true on all six tenant-owned tables, then proved empirically that no context returns zero rows, a wrong tenant returns zero rows, and the correct tenant returns its own). The application connects as `nexora_app` — `NOSUPERUSER`, `NOBYPASSRLS`, and deliberately **not** the table owner (`platform/db/init/001_roles.sql`), because R-002 established empirically that a table's owner bypasses RLS by default.

**The others:** Supabase and PostgREST also lean on PostgreSQL RLS, and Supabase's own guidance treats RLS as what makes direct client access safe *(understood at 2026-09-01)*. The differences worth naming are `FORCE` and role separation: RLS enabled without `FORCE` still exempts the owning role, and it is an easy thing to get wrong quietly. Nexora treats that as a conformance rule (`SCHEMA-MISSING-FORCE-RLS`) rather than a convention.

### 3. One enforced path to a database connection

**Nexora:** transaction-local RLS context is set by exactly one helper, and bypassing it is a conformance violation (`DB-ACCESS-TRANSACTION-BYPASSES-HELPER`, with `db-access-transaction-bypass/` as its failing fixture). ADR-021 item 5 requires it; the harness enforces it. There are exactly two pools, created once and injected by explicit `Symbol` tokens (`platform/db/connections.ts`) — a deliberate repair after three independent pools were being created as an import side effect.

**The others:** the equivalent question does not arise in the same form, because request-scoped context is the framework's own job rather than the application's.

### 4. Generated artifacts that CI refuses to let drift

**Nexora:** `openapi.json` is generated from each capability's Zod schemas and `CapabilityDefinition` (ADR-033) and `PROJECT_GRAPH.md` from source; both are committed and both are diffed in CI (`npm run openapi -- --check`, `npm run graph -- --check`). ADR-033 rejected the conventional NestJS route — `@nestjs/swagger`'s decorator inference — for a specific and verified reason: esbuild does not implement `emitDecoratorMetadata`, so it fails *silently*, producing an empty or wrong schema. A drift-detection artifact that fails silently is worse than none.

**The others:** PostgREST and Hasura derive the API from the schema, so drift between schema and API is structurally impossible — a genuinely stronger guarantee for that specific problem. The trade is that the API's shape is then the *schema's* shape.

### 5. Plan and price versioning as a founding rule, not a later migration

**Nexora:** ADR-025 item 6 requires a plan change to pin a specific `plan_version_id` and `price_version_id` captured at change time, so "a later edit to that plan must not retroactively alter the change"; ADR-024 item 1 makes `subscription_periods` append-only so billing history is reconstructible; `04` §5 requires invoices to reference exact versions. `PHASE_2_BRIEF.md` §4 schedules `plans`, `plan_versions`, `prices`, `price_versions` in items 1–2 — the first two items of the phase.

**The others:** none of the reference projects is a billing system, so they neither have nor need this. It is worth stating anyway because retrofitting immutable versioning into a live billing schema is the class of change that is a data migration plus a reconciliation of every historical invoice.

### 6. Money that cannot silently become a float

**Nexora:** ADR-022 — integer minor units plus explicit currency; floats prohibited in code, JSON and the database; minor units read per currency from a table rather than hard-coded to 2; a remainder-distributing allocator whose property test asserts the parts sum to the whole over randomized *and* adversarial inputs (`modules/money/domain/money.vo.spec.ts`); cross-currency arithmetic throws. The float prohibition is a live conformance rule (`SCHEMA-FLOAT-MONEY-COLUMN`) with its own failing fixture.

**The others:** a general-purpose backend leaves this to the developer, which is the correct division of responsibility for a general-purpose backend.

### 7. A capability model designed as one boundary for every surface — **with the caveat that only one surface exists**

**Nexora:** each capability declares `id`, `version`, `requiredPermissions`, `risk`, `idempotent`, `storeScoped`, `route`, Zod input/output schemas and `errorCodes` in one file, and `05_API_CAPABILITY_CONTRACTS.md:14` §1 requires that "REST, Admin UI, Storefront, AI, MCP, Automation and Plugins converge on the same Application Service." `AGENTS.md` §4 forbids AI, MCP, plugins or automation from reaching repositories directly.

**The claimed strength that did not fully survive checking, stated rather than dropped:** today **only REST exists**. There is no admin UI (R-034), no AI plane (ADR-004, Phase 8), no MCP server (Phase 9), no plugin host (Phase 6). So "one boundary for five surfaces" is a design property with the metadata to support it — genuinely more than a stated intention, since the manifest is already machine-readable — but it is currently *exercised* by exactly one surface. The convergence is unproven, not disproven. `TECHNOLOGY_RADAR.md`'s MCP entry records why that cheapness is a temptation to resist rather than evidence of the claim.

---

## §2 — What Nexora deliberately does not have

**This section exists to stop §3 from being read as a backlog.** Each of these is a decision with an authority, not an omission.

### Auto-generated CRUD or GraphQL from the schema
**Who has it:** PostgREST generates a REST endpoint per table/view/function; Hasura generates GraphQL with per-row and per-column permissions *(understood at 2026-09-01)*.
**Why Nexora rejects it:** the capability is the unit of authorization, audit, idempotency and rate limiting — not the table. `05` §5's `CapabilityDefinition` carries `requiredPermissions`, `risk`, `idempotent` and `errorCodes` *per operation*, and ADR-034 requires exactly one audit event per capability *attempt*, on both outcomes. A schema-derived endpoint has no natural place to hang any of that, because it corresponds to a table rather than to a business operation. `AGENTS.md` §4's "do not put authoritative business logic in controllers" points the same way.
**The trade, honestly:** far more code per endpoint. Ten capabilities took a phase. PostgREST would have exposed the same fourteen tables in an afternoon — and would have exposed them as tables.

### A heavy ORM
**Who has it:** Prisma, and Strapi/KeystoneJS through their own layers.
**Why:** ADR-021 item 1 — "A full active-record or unit-of-work ORM is rejected for V1" — for three named reasons: the platform needs explicit control of transaction and session state to set RLS context, needs `SELECT … FOR UPDATE` on ledgers, and needs persistence rows kept distinct from domain entities (item 3). Heavy ORMs fight all three.
**Authority:** ADR-021. Prisma is not a gap here; it is the road not taken.

### Realtime subscriptions
**Who has it:** Supabase and Hasura *(understood at 2026-09-01)*.
**Why not now:** ADR-019 and ADR-032 own storefront delivery and read-path separation for **Phase 4**, and ADR-019 item 1 is explicit that revalidation is driven by domain events through the transactional outbox, "never by a timer as the primary mechanism." Push-based client sync is a Phase 4 design question inside those ADRs, not an unaddressed gap.
**Authority:** ADR-019, ADR-032. See `TECHNOLOGY_RADAR.md` → Hold.

### A CMS-style admin UI generated from the schema
**Who has it:** Strapi and KeystoneJS generate an admin panel from content types *(understood at 2026-09-01)*.
**Why not:** a generated admin binds the UI to table shape, which is the same coupling the capability model exists to avoid — and it would need a write path for plans that `05` §4.2 deliberately does not define (decision **D2-11**: Phase 2 administers plans by seed migration; `00_PLATFORM_OVERVIEW.md` §4.2's "configurable without a code deployment" is recorded **NOT MET**, tracked as **R-032**).
**Note the distinction from §3:** Nexora rejects a *schema-generated* admin. It does not have an admin UI *at all*, which is a genuine gap — R-034, below.

### Vendor-coupled payments
**Who has it:** most billing stacks assume the international card-and-webhook model.
**Why Nexona rejects it:** ADR-023's problem statement is explicit that "a large class of real gateways, including every Iranian PSP, does not work that way," so the port declares capability flags and application code branches on declared capability, never on provider name. The normative flow is redirect-and-verify, and the callback is "a hint, never a source of truth."
**Authority:** ADR-023.

---

## §3 — What Nexora lacks and will eventually need

Only things genuinely owed. Each is anchored, or explicitly marked unanchored — and an unanchored gap is a finding, now opened as a register row.

| Gap | Anchor | Status |
|---|---|---|
| **No admin UI or any frontend** | **R-034 (opened by this document)** | `00_PLATFORM_OVERVIEW.md` and `05` §1 both name an Admin UI; **no `06` phase item delivers one** — verified by grep. Previously unanchored. |
| **No development seed data** | **R-035 (opened by this document)** | Reference seeds exist inside migrations (permissions, currencies, reserved subdomains) but there is no way to get a working tenant/org/store/user locally, and no `seed` script. Previously unanchored. |
| **No object storage port** | R-025; `03` §9 names it a day-one seam | Needed by Phase 3 product images and ADR-019 item 5's theme assets. No phase item owns it. |
| **No background job runner** | `PHASE_1_DEBT_CLOSURE.md` D-2, `PARTIALLY CLOSED` | `redis` service exists; BullMQ deliberately deferred to `06` Phase 2 **item 14**, which ADR-024 item 8's six jobs and ADR-023 item 4's sweep both require. |
| **No generated API client** | ADR-033 supplies the artifact; no consumer exists | Downstream of R-034. Cheap when a frontend is scheduled; a build step maintained for nothing before that. |
| **No i18n / RTL layer** | R-026 | Blocked on a prior question: `05` never says whether the error envelope's `message` is human- or developer-facing. |
| **No search** | Phase 3 (`06`) | Nothing to search until products exist. |
| **No observability beyond structured logs** | R-010; **ADR-040 (`OPEN`)** owns the boundary | Structured request logging, an `audit_write_failed` event and a counter seam exist; metrics, tracing, redaction and alerting do not. |
| **No connection pool configuration** | R-020; **ADR-039 (`OPEN`)** owns it | `platform/db/pool.ts` sets no `max`, no timeouts; no `statement_timeout` at any layer. |

**Two rows were opened by writing this section** (R-034, R-035). Everything else was already tracked, and is cross-referenced rather than duplicated — the practice `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` established.

---

## The one-sentence version

Nexora trades the thing PostgREST, Hasura and Supabase are best at — getting a working, safe API over a schema very fast — for something they do not attempt: a capability-shaped platform where authorization, audit, idempotency, money, time and tenancy are architectural invariants enforced by CI rather than conventions upheld by reviewers. That trade is only worth it for a system whose hard part is billing correctness and multi-tenant safety over years, which is exactly what `06_IMPLEMENTATION_PLAN.md` describes — and it is a bad trade for anything smaller.

## Review trigger

Re-read at the **Phase 2 exit gate**, or when R-034 (a frontend) is scheduled — whichever comes first. §1's item 7 in particular is contingent: it becomes a stronger claim the day a second surface consumes the capability layer, and a weaker one the longer only REST does. Backstop: **2026-12-01**.
