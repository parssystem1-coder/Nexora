# Phase 2 Brief

**This is the only scope you are authorized to implement right now.**

Load this file plus `AGENTS.md`. Pull sections from `03`, `04`, `05` and specific ADRs on demand. Do not load `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018.

`08_PHASE_1_BRIEF.md` is the closed phase's record and remains the authority on Phase 1's own schema — in particular its §5 RLS exemption list, which explains the tenancy of every table that already exists. Read it for that; do not build from it.

The fourteen decisions this brief was drafted around (D2-1 … D2-14) were answered by the maintainer on 2026-08-28. Each is folded into the section where it operates; §7 is the disposition table recording where each landed, plus the items still owed to other files. The full reasoning lives in `decisions/2026-08.md` (2026-08-28), not here.

---

## 0. Stack and settled decisions. Do not re-litigate.

Phase 1's rows carry forward unchanged; Phase 2's additions follow. A concern with no settled authority is not in this table.

| Concern | Decision | Authority |
|---|---|---|
| Backend | NestJS + TypeScript, modular monolith | RFC 7 |
| Frontend | Next.js + React + TypeScript | RFC header |
| Database | PostgreSQL with RLS | RFC 12 |
| Data access | SQL-first typed query builder over `pg`. No heavy ORM. | ADR-021 |
| Cache / queue | Redis + BullMQ | RFC 37, 38 |
| Auth | first-party, Argon2id, server-side revocable sessions | ADR-029 |
| Money representation | integer minor units + explicit currency; float prohibited | ADR-022 items 1–3 |
| Money over the wire | `{ amount: string, currency: string, minorUnits: number }` | ADR-022 item 7, `05` §3 |
| Money allocation | remainder-distributing allocator, half-up; sum of parts equals whole | ADR-022 item 5 |
| Time storage | UTC `timestamptz`; no naive local timestamp persisted | ADR-031 item 1 |
| Business boundaries | computed in the organization's declared billing timezone, never server local time | ADR-031 item 2 |
| Term arithmetic | calendar arithmetic with end-of-month clamping; `+30 days`/`+365 days` prohibited | ADR-031 item 3 |
| Period convention | half-open `[period_start, period_end)`, uniformly | ADR-031 item 4 |
| Clock | injected, never a direct system call | ADR-031 item 6 |
| Subscription term | explicit `term_length` + append-only `subscription_periods`; renewal appends, never mutates | ADR-024 item 1 |
| Serving state | derived by exactly one function, never stored twice | ADR-024 item 2 |
| Legal state transitions | the eight-status machine, transitions recorded append-only | ADR-024 item 3 |
| Grace window | default 7 days, configurable per plan, never per code path | ADR-024 item 4 |
| Plan/price versioning | a change pins a specific `plan_version_id`/`price_version_id`; later edits never apply retroactively | ADR-025 item 6 |
| Plan-change timing | upgrade immediate on verified payment; downgrade at `period_end`; expiry date never moves on upgrade | ADR-025 items 2–3 |
| Proration formula | `amountDue = newCharge − unusedCredit`, floored at zero, via the ADR-022 allocator | ADR-025 item 3 |
| Entitlement precedence | Policy Constraint → Tenant Override (ABSOLUTE before DELTA) → Add-on → Plan Version → Platform Default | ADR-008 |
| Entitlement conflict | explicit DENY always wins; unresolvable conflict fails closed with `ENTITLEMENT_CONFLICT` | ADR-008 rules 1, 3 |
| Add-on rung | present in the resolver and always empty in Phase 2; no add-on construct is built | **D2-7** |
| Entitlement caching | none in Phase 2; resolve per request | **D2-4** |
| Quota enforcement | at creation time only, never retroactively | ADR-026 item 3 |
| Over-limit behaviour | preserve, block new creates, never delete or hide | ADR-026 item 1 |
| Pagination | keyset/cursor with an opaque cursor, one style platform-wide | **ADR-036** |
| Payment flow | redirect-and-verify is normative; the callback is a hint, never truth | ADR-023 items 2–3 |
| Provider abstraction | capability flags, never provider-name branching | ADR-023 item 1 |
| Provider scope in Phase 2 | port plus fixture-modelled adapter; commercial selection and live credentials are Phase 3/4 | **D2-3** |
| Credential storage shape | a `secret_ref` to a secret held outside the database; never a plaintext secret, in any code path | **ADR-037** |
| Reconciliation | mandatory scheduled sweep of `PENDING` intents, idempotent | ADR-023 item 4 |
| Idempotency | exactly one platform service, owned by the `idempotency` module; no module-local mechanism | ADR-009, `AGENTS.md` §4 |
| Idempotency composition | a `withIdempotentCapability` wrapper composing with `runCapabilityAttempt`, never a branch inside it; `runCapabilityAttempt` outermost | **ADR-038** |
| Idempotency storage | PostgreSQL authoritative; Redis only as a read-through cache | ADR-009 |
| Lifecycle vocabularies | subscription status (ADR-024) and tenant-data state (ADR-020) are two independent axes with an exhaustive crosswalk (§5) | **D2-5** |
| Plan administration | seed migrations in Phase 2; no plan-write capability exists | **D2-11** |
| Retention on billing events | expiry, downgrade and cancellation are never destructive | ADR-020 rule 1, ADR-026 item 1 |
| Audit placement | one event per capability attempt, on an independent connection, both outcomes | ADR-034 |
| Platform-scope audit | reserved sentinel `tenant_id` for capabilities with no tenant | ADR-035 |
| Error message audience | `message` is developer-facing and never shown to an end user; `code` is the localization key, `details` carries the parameters | **ADR-042** |
| `CapabilityDefinition` field drift | a field is added in the same slice that adds its enforcement; the difference from `05` §5 is itself declared and CI-asserted | **ADR-043** |
| Schema artifacts | OpenAPI generated from Zod + `CapabilityDefinition`, committed, CI-drift-checked | ADR-033 |
| Migrations | reviewed plain SQL, forward-only | ADR-021 item 8 |

---

## 1. What must be true before any Phase 2 feature code

Phase 1's Task 0 (repository audit, conformance harness, decision/risk/provider logs) is complete and does not repeat. **All fourteen D2 decisions are answered**, so nothing in §7 blocks slice 1 any longer.

What remains before item 1 opens:

1. **Nothing in this brief.** The harness, the golden path, the migration runner, `modules/money`, `modules/calendar`, `runCapabilityAttempt`, the audit mechanism, the error taxonomy and the OpenAPI generator all exist and are proven. `06`'s items 3, 10 and 11 are Phase 2's own infrastructure and sit inside the ordered list rather than before it.
2. **Three amendments are owed to files this brief does not edit**, and none of them blocks slice 1: `PROVIDER_MATRIX.md`'s correction (D2-3), and dated amendment entries for ADR-006 and ADR-010 in `02_ADR_INDEX_NORMATIVE_DECISIONS.md` (D2-6, D2-9). They are tracked in §7's disposition table so they are not lost.

Explicitly **not** prerequisites, checked against the register rather than assumed: R-020 (pool configuration) is a production-readiness gap with no Phase 2 dependency; R-021 (coverage tooling) measures a proxy for `AGENTS.md` §7 and blocks nothing; R-025 (storage port) is Phase 3; R-030 (audit growth) is not urgent at ADR-010's assumed scale.

---

## 2. The Phase 2 reference slice

`AGENTS.md` §2 names exactly one golden path — `store.read` — and **it remains the golden path for structure**: guard chain, `withTenantContext`, `runCapabilityAttempt`, error mapping, audit, test layering. Nothing here replaces it, and Phase 5's capability registry stays deferred.

**Reference slice: `06` item 1, "plan and plan version", delivering the `plan.list` capability.**

### What it demonstrates that `store.read` does not

1. **A collection read, and therefore pagination.** Every Phase 1 READ capability is single-resource. Whatever ships here becomes the platform contract by construction, because `AGENTS.md` §2 guarantees `invoice.list` and every later `*.list` copies it. The style is settled (D2-1); the implementation is not.
2. **Platform-global reference data with no `tenant_id` and no RLS policy.** This inverts Phase 1's universal assumption. `05` §4.2 scopes `plan.list` **global** — the first capability whose primary table is deliberately exempt from the isolation model every Phase 1 table carried, and the first whose guard chain cannot rely on `app.tenant_id` to constrain a result set.
3. **A versioned, immutable aggregate.** `plans` → `plan_versions` establishes the version-pinning pattern ADR-025 item 6 depends on. Getting the immutability boundary wrong here propagates into `prices`, `subscriptions`, `invoices` and `subscription_changes`.

### What it must NOT try to demonstrate

- **Money over the wire.** Prices are item 2. Keeping `MoneyDto` out keeps the reference slice reviewable and keeps the money question — ADR-022 item 7's shape has never crossed a real capability — as item 2's own explicit gate (§6 criterion 14).
- **Idempotency** (item 3), **entitlement** (item 6), **subscription state** (items 4–5), or any write path. `plan.list` is a READ with `Idempotency: no` (`05` §4.2).
- **Plan administration.** No capability creates or edits a plan (D2-11). This slice reads what a seed migration wrote; it does not invent a write path.

### Review posture

**Hand-review and stop, as `08_PHASE_1_BRIEF.md` §2 prescribes.** Pagination shape and the platform-global-table pattern are both replicated by later slices and expensive to change afterwards; version immutability is load-bearing for the entire billing history. Stop after item 1, request review, do not begin item 2 until approved.

**A second review stop at item 4.** Item 1's only capability is a global READ, so it proves nothing about the Phase 2 write pipeline. Item 4 (`plan.subscribe`) is the first tenant-scoped write combining `Money`, the state machine and idempotency. This is a deliberate deviation from `08`'s single-stop model: one reference slice cannot cover both a global read and a multi-aggregate transactional write.

---

## 3. Slice order, and the capability mapping

### (a) The capability-to-item mapping

`05` §4.2 lists **15** capabilities; `06` Phase 2 lists **18** items (both counted by grep). They do not correspond one-to-one: an infrastructure item surfaces no capability, and one item can surface several.

Assignments are marked **EXPLICIT** where `06`'s item text names the work and **INFERRED** where the item is the only plausible home but does not name it. The distinction is kept visible deliberately (D2-13): `06`'s items are phrased as work packages rather than capability deliveries, so this mapping is ratified, not mechanically derivable.

| # | `05` §4.2 capability | Scope / Risk | Owning `06` item | Basis |
|---:|---|---|---|---|
| 1 | `plan.list` | global / READ | 1 — plan and plan version | INFERRED, ratified (D2-13) |
| 2 | `plan.subscribe` | tenant / HIGH_WRITE | 4 — subscription with explicit term | INFERRED, ratified (D2-13) |
| 3 | `plan.change.preview` | tenant / READ | 15 — plan change | EXPLICIT |
| 4 | `plan.change` | tenant / HIGH_WRITE | 15 — plan change | EXPLICIT |
| 5 | `plan.change.cancel_scheduled` | tenant / MEDIUM_WRITE | 15 — plan change | EXPLICIT |
| 6 | `subscription.read` | tenant / READ | 4 — subscription + derived serving-state | INFERRED, ratified (D2-13) |
| 7 | `subscription.renew` | tenant / HIGH_WRITE | **14 — renewal lifecycle** | INFERRED, ratified (**D2-12**) |
| 8 | `subscription.cancel` | tenant / HIGH_WRITE | 5 — state machine + transition log | INFERRED, ratified (D2-13) |
| 9 | `subscription.reactivate` | tenant / HIGH_WRITE | 16 — reactivation after expiry | EXPLICIT |
| 10 | `entitlement.resolve` | tenant / READ | 6 — entitlement resolution | EXPLICIT |
| 11 | `overlimit.read` | tenant / READ | 8 — over-limit state and policy | EXPLICIT |
| 12 | `usage.record` | tenant / LOW_WRITE | 9 — usage ledger | EXPLICIT |
| 13 | `invoice.list` | tenant / READ | 13 — invoices | EXPLICIT |
| 14 | `billing.payment.initiate` | tenant / HIGH_WRITE | 12 — payment intent, verify, sweep | EXPLICIT |
| 15 | `billing.payment.verify` | tenant / HIGH_WRITE | 12 — payment intent, verify, sweep | EXPLICIT |

Every capability now has an owning item. **`subscription.renew` → item 14, not item 12** (D2-12): item 12 is payment intent/verify/reconciliation, and routing renew there would put a subscription-domain invariant inside the payment slice. See §5's module-boundary rule.

**Items that surface no capability — infrastructure, and correct:** 2 (price and price version), 3 (shared idempotency service), 7 (quota policies), 10 (payment provider port), 11 (first adapter + stub), 17 (notification flows), 18 (concurrency and reconciliation tests). Seven infrastructure items, eleven capability-surfacing items.

### (b) Implementation order

**`06`'s own order, unchanged.** Each item was checked for a dependency inversion and none was found: idempotency (3) precedes every idempotent write; the port (10) precedes its adapter (11) precedes intent/verify (12); entitlement (6) precedes quota (7) precedes over-limit (8); invoices (13) follow the versioned aggregates they must reference (1, 2).

Item 1 carries the review stop; item 4 carries the second one (§2).

---

## 4. Tables in scope

**Amendment, 2026-09-03 — two tables added, 27 → 29. This is the first dated amendment to this brief, and it establishes the pattern here rather than following one** (the same note `04_DATABASE_BLUEPRINT.md` §8 made on 2026-09-02). Nothing below is removed or reworded; the superseded count is struck through where it appears.

Both additions were **owed** rather than discovered. ADR-048 and ADR-050 were ruled on 2026-09-02, and each ruling requires a table this list did not contain. Both ADRs said so explicitly and both declined to add it, on the ground that **amending this list is a scope decision belonging to this file — `AGENTS.md` §1 authority #2 — and not to an ADR.** That fence was correct and this amendment is the other half of it.

| Added | Required by | Item | Tenancy |
|---|---|---|---|
| the invoice-number counter | **ADR-048** — gap-free numbering allocated from a single-row counter locked `SELECT … FOR UPDATE` inside the issuing transaction | 13 | **platform-global** — see §5 for its RLS-exemption reason |
| the outbox delivery table | **ADR-050** — delivery state lives outside `outbox_events`, which keeps its `REVOKE UPDATE, DELETE` with no column-level exception | 14 | tenant-owned |

**Neither table's columns are specified here, deliberately.** The counter's shape is item 13's design work and the delivery table's is item 14's; ADR-050 says so in its own ruling. This amendment adds them to the scope list and states what each is for. The names below follow this section's existing convention, stated for the entitlement/quota split and applying equally here: **table names are indicative; membership of this list is binding.**


**Only these. Creating anything else is out of scope.** Derived from `04_DATABASE_BLUEPRINT.md` §§2.3–2.6 by one rule: a table is in scope if `04` names it **and** a `06` Phase 2 item creates it.

| Table | Owning module | Tenancy | Holds | Item |
|---|---|---|---|---|
| `plans` | billing | platform-global | plan identity | 1 |
| `plan_versions` | billing | platform-global | immutable versioned plan definition | 1 |
| `plan_features` | billing | platform-global | features a plan version grants | 1 |
| `prices` | billing | platform-global | price identity | 2 |
| `price_versions` | billing | platform-global | immutable versioned amount + currency | 2 |
| `idempotency_records` | idempotency | tenant-owned | `UNIQUE (tenant_id, capability, idempotency_key)`, status, `request_hash`, `response_snapshot` | 3 |
| `subscriptions` | subscription | tenant-owned | term, `auto_renew`, status, pinned version ids | 4 |
| `subscription_periods` | subscription | tenant-owned | append-only period history, `grace_end`, status | 4 |
| `subscription_state_transitions` | subscription | tenant-owned | append-only transition log with actor and reason | 5 |
| `plan_entitlements` | entitlement | **platform-global** | entitlements a plan version grants | 6 |
| `tenant_entitlement_overrides` | entitlement | **tenant-owned** | ADR-008's ABSOLUTE/DELTA tenant overrides | 6 |
| `entitlement_sources` | entitlement | tenant-owned | ADR-008's explainability record of a resolution | 6 |
| `plan_quota_policies` | entitlement | **platform-global** | per-resource limits a plan version sets | 7 |
| `tenant_quota_overrides` | entitlement | **tenant-owned** | per-tenant quota overrides | 7 |
| `tenant_over_limit_states` | entitlement | tenant-owned | resource, current count, limit, entered_at | 8 |
| `usage_ledger_entries` | usage | tenant-owned | append-only usage records | 9 |
| `billing_provider_configs` | billing | platform-global | platform-scoped credential **reference** — never a plaintext secret (§5) | 10 |
| `billing_payment_intents` | billing | tenant-owned | our id/amount/currency, provider authority, status, verification attempts | 12 |
| `billing_payment_events` | billing | tenant-owned | append-only provider interaction log | 12 |
| `scheduled_job_runs` | platform | platform-global | job name, window, status, timings, error | 12 |
| `invoices` | billing | tenant-owned | references exact `plan_version` and `price_version` | 13 |
| `invoice_lines` | billing | tenant-owned | invoice line items | 13 |
| `billing_refunds` | billing | tenant-owned | refund records | 13 |
| `invoice_number_counter` | billing | **platform-global** | the single counter row ADR-048's gap-free allocation locks inside the issuing transaction | 13 |
| `outbox_events` | eventing | tenant-owned | domain events for out-of-request delivery | 14 |
| `outbox_event_deliveries` | eventing | tenant-owned | ADR-050's delivery state — one row per attempt, keeping `outbox_events` strictly append-only | 14 |
| `subscription_changes` | subscription | tenant-owned | direction, from/to versions, `effective_at`, prorated amount | 15 |
| `notifications` | notification | tenant-owned | lifecycle notifications | 17 |
| `notification_deliveries` | notification | tenant-owned | per-channel delivery attempts | 17 |

**29 tables. Not sixty.** Phase 1 built 14 in 20 migrations. ~~27 tables~~ — superseded by the 2026-09-03 amendment above, which adds ADR-048's invoice-number counter and ADR-050's delivery table.

**On the five entitlement/quota tables** (D2-14): `04` §2.4 names three — `entitlements`, `entitlement_sources`, `quota_policies`. The split into five is deliberate and is not a departure from `04`, which describes itself as a "conceptual schema and ownership baseline" whose "exact columns are finalized per module during its slice." Splitting one conceptual table into a platform-global and a tenant-owned physical table is that finalization. **Table names above are indicative; the split itself is binding.**

**Out of scope, and this list is the wall, not a suggestion:**

- **`subscription_items`** (`04` §2.3) — no add-on construct is built in Phase 2 (D2-7), and this table's only documented purpose is an inference `04` never states. Not created.
- **`ai_credit_ledger_entries`, `ai_credit_reservations`** (`04` §2.4) — AI credit accounting is out of Phase 2 (D2-6). **This exclusion rests on the D2-6 decision, not on the ADR index as currently written:** `02_ADR_INDEX_NORMATIVE_DECISIONS.md`'s summary table still marks ADR-006 `Blocks: Phase 2`, and is owed a dated amendment (§7). Until that amendment lands, an implementer reading the index alone would reach the opposite conclusion — read this line first.
- **All of `04` §3 (Commerce)** — products, variants, categories, brands, attributes, inventory, customers, carts, orders, coupons, shipping, tax, `commerce_payment_*`, `store_payment_provider_configs`. Phase 3.
- **All of `04` §4 (Storefront read model)** — the four `storefront_*_view` projections. Phase 4.
- **All of `04` §2.7 (Domains and certificates)** — `store_domains`, `store_domain_certificates`, `email_sending_domains`. Phase 4. (`reserved_subdomains` already exists.)
- **From `04` §2.6:** `approval_requests` (ADR-001 is Phase 9, and `CapabilityDefinition.approval` is deliberately unimplemented — see §5), `files` (object storage, no phase owns it yet), `webhook_endpoints`, `webhook_deliveries` (no Phase 2 item).
- **All of `04` §9's deferred schema** — CRM, SEO, marketplace, RAG, multi-region, channel, financial-services.
- Do not create plugin, AI, or MCP tables.

**One correction to a prior record, made here rather than by editing it.** `PHASE_1_DEBT_CLOSURE.md` D-5 closed `outbox_events`' absence with the trigger "most likely `06` Phase 2 item 17." That is one item too late: ADR-024 item 9 requires a transition to a non-serving state to "emit `SubscriptionExpired` through the outbox," and that transition is item 14's `subscription.deprovision` job. D-5's closure itself is unaffected — the table was correctly absent through Phase 1; only the predicted trigger point moves.

---

## 5. Non-negotiable rules for this phase

Phase 1's rules that still apply, carried forward: RLS fails closed; the application role cannot bypass RLS; one use case per file; controllers contain no business logic; no `domain` file imports the query builder, driver, NestJS, React or a provider SDK; `storeId` is always explicit, never inferred.

### Tenancy and RLS

Every table in §4 marked tenant-owned carries `tenant_id` and an RLS policy **in the same migration that creates it** (`04` §7, CI-enforced). The platform-global tables are exempt, each for a stated reason:

- **`plans`, `plan_versions`, `plan_features`, `prices`, `price_versions`, `plan_entitlements`, `plan_quota_policies`** — platform-authored reference data, identical for every tenant. `05` §4.2 scopes `plan.list` **global**, not tenant; a tenant-scoped plan catalogue would make `plan.list` unanswerable before a tenant context exists, the same bootstrap problem R-003 documents for `memberships`.
- **`billing_provider_configs`** — no tenant to scope to; ADR-023 item 7 requires the platform's billing credentials never be resolvable from a store-scoped context. Exempt from `tenant_id`, not thereby less protected — see the credentials rule below.
- **`scheduled_job_runs`** — operational record of the platform, not of any tenant; a sweep job's bookkeeping cannot be constrained by a tenant context it runs outside of.
- **`invoice_number_counter`** (added 2026-09-03 by §4's amendment) — **the invoice series belongs to the platform as issuer, not to any tenant.** ADR-048 ruled the numbering global rather than per-tenant on exactly that ground: the issuer of these invoices is one legal entity, and a seller keeps one book, not one book per subscriber. A counter scoped to a tenant would be a different decision, not a safer version of this one. It holds no tenant data — a single integer and its lock — so there is nothing for a tenant predicate to protect, and giving it a `tenant_id` would misdescribe what it is.

**The entitlement and quota split is structural, not stylistic (D2-14).** Plan-derived and tenant-override rows live in separate tables and must not be merged into one table with a nullable `tenant_id`. The mechanism, because it is the part that will be forgotten: this codebase's RLS policies compare `tenant_id::text = current_setting('app.tenant_id', true)`. For a row whose `tenant_id` is `NULL` that comparison evaluates to `NULL` — neither true nor false — so the row is invisible to **every** caller, including its intended reader, and the failure is silent rather than loud. ADR-035 rejected the closely related nullable-`tenant_id` approach for `audit_events` on exactly this ground.

### Pagination

- **Keyset/cursor, with an opaque cursor string. One style platform-wide (D2-1).** No capability introduces offset/limit, and no capability invents a second cursor format.
- The cursor is opaque to clients: its encoding is an implementation detail, never part of the contract.
- **A small global collection may return its entire set in one page with a null or absent next-cursor.** That is this contract exercising its natural bound, not a second style — `plan.list` in particular will normally do so. Do not later "optimise" `plan.list` into an offset endpoint on the grounds that it is small; a second style is what this rule exists to prevent.

### Money

- Integer minor units plus an explicit currency; never a float, never a bare number, in code, in JSON, or in the database (ADR-022 items 1–2, `AGENTS.md` §4). `numeric` with explicit scale or `bigint` minor units only — the existing `SCHEMA-FLOAT-MONEY-COLUMN` conformance rule enforces this.
- Minor units are read per currency from `currencies`, never hard-coded to 2 (ADR-022 item 3). Zero-minor-unit currencies are first-class.
- Every monetary column has a companion currency column, both non-null together (`04` §5).
- No arithmetic across currencies; `CURRENCY_MISMATCH` (`05` §7) rather than a conversion (ADR-022 item 6).
- Over the wire: `MoneyDto` (ADR-022 item 7, `05` §3). **This shape has never crossed a real capability** — no Phase 1 capability returns money and `openapi.json` contains no money-shaped response. Item 2 is its first test, and owes a contract test proving a zero-minor-unit currency round-trips unchanged.
- Proration and tax use the ADR-022 allocator, never independent rounding (ADR-022 item 5, ADR-025 item 3).

### Time

- UTC `timestamptz` everywhere; no naive local timestamp persisted (ADR-031 item 1).
- Every billing, term, grace and expiry boundary is computed in the organization's declared billing timezone, never server local time (ADR-031 item 2, `AGENTS.md` §4).
- Calendar arithmetic, not day counting: `+30 days` and `+365 days` are prohibited for terms (ADR-031 item 3). **`modules/calendar/` already exists** and is the only permitted implementation — no ad-hoc `Date` arithmetic beside it.
- Half-open `[start, end)` for periods, usage windows, quota windows and proration, uniformly (ADR-031 item 4).
- Time comes from the injected clock (ADR-031 item 6).

### Module boundaries

- **ADR-024 item 5's extension arithmetic — early renewal extends from the existing `period_end`, never from the payment date, and paying twice extends twice — lives in the subscription module (D2-12).** It must not be implemented in the payment module or in a payment-slice controller. `subscription.renew` is delivered by item 14, not item 12, for this reason: item 12 is payment intent/verify/reconciliation, and folding renew there would put a subscription-domain invariant inside the payment slice — the module-boundary violation `AGENTS.md` §4 and `03_TECHNICAL_BLUEPRINT.md` both forbid.
- No cross-module foreign keys; cross-module reads go through contracts (`04` §1).

### Append-only ledgers

`04` §1 requires audit and ledger records to be append-only, and Phase 1 established the enforcement pattern rather than leaving it to convention: `modules/audit/migrations/20260822100100_audit__enforce_append_only.sql` adds `REVOKE UPDATE, DELETE ON audit_events FROM nexora_app`, scoped to that one table. That migration's own comment predicted this phase: *"each ledger-shaped table Phase 2 adds — usage, payment — needs this same treatment in its own creating migration."*

**Every ledger-shaped table in §4 owes `REVOKE UPDATE, DELETE` in its own creating migration:** `subscription_periods`, `subscription_state_transitions`, `usage_ledger_entries`, `billing_payment_events`, `invoices`, `invoice_lines`, `outbox_events`. A comment asserting append-only is not append-only — the Phase 1 repair that produced this pattern exists precisely because the original `audit_events` migration said so only in prose.

### Idempotency

- Exactly one platform mechanism, owned by the `idempotency` module (item 3). No module invents its own — `AGENTS.md` §4, ADR-009; a module-local idempotency table is already a live-DB conformance violation (`SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE`).
- The claim is made inside the same transaction as the write where the write is single-transaction; where the operation spans an external call, the claim commits first and is reconciled (ADR-009).
- **The claim is composed, never branched in (D2-10):** a separate `withIdempotentCapability` wrapper composes with `runCapabilityAttempt`. **The reason, because it is the reason that will be forgotten:** `runCapabilityAttempt`'s own doc comment declares a scope ceiling — it "does not choose a transaction strategy" — and names Phase 5's capability registry as deliberately deferred. Adding an idempotency branch inside it breaches that ceiling and drags Phase 5 forward under Phase 2 pressure; hand-rolling idempotency per controller re-creates exactly the ten-fold duplication `PHASE_1_DEBT_CLOSURE.md` D-3 removed. Composition violates neither.
- **Five existing capability declarations flip** from `idempotent: false` to `true` when item 3 lands: `organization.create`, `membership.invite`, `membership.revoke`, `membership.role.assign`, `store.create`. `auth.logout_all` already declares `true` and is naturally idempotent — leave it. `openapi.json` carries no idempotency claim and needs no correction.

### Credentials

ADR-023 item 8, quoted verbatim because it is accepted and binding:

> **Store-scoped credentials** are encrypted at rest, never returned by any read API, and never logged. A store operator may rotate them; rotation must not invalidate historical payment records.

No mechanism in this repository implements this today. Phase 2 defers **the mechanism** — a KMS/encryption service — to the first slice that stores a real credential (D2-2, D2-3: Phase 2's adapters are fixture-modelled and hold none).

**The deferral covers building the mechanism. It does not cover storing a plaintext secret (D2-2, amended).**

- Item 10's `billing_provider_configs` migration must store the credential in a form that can be encrypted in place later **without a data migration**: either a reference to a secret held outside the database, or an envelope-shaped column.
- **A plaintext secret must never be written to that table — including by a stub adapter, a seed, or a test fixture.**
- The reason to record: once item 10's table exists, an undecided column shape becomes a schema commitment, and migrations are forward-only (ADR-021 item 8). Retrofitting encryption afterwards is a data migration rather than a configuration change.

### Permissions

**Every Phase 2 billing permission is granted to `owner` and `admin` only (D2-8).** The implemented role catalog is `["owner", "admin", "member"]` (`modules/authorization/domain/role-key.vo.ts`, seeded by `20260822090600_authorization__create_permission_catalog.sql`); `00_PLATFORM_OVERVIEW.md` §4.1 describes six roles, and which catalog is real is deferred to Phase 3 (§7).

This rule is what makes that deferral safe rather than lucky. Every Phase 2 capability that writes — `plan.subscribe`, `plan.change`, `plan.change.cancel_scheduled`, `subscription.renew`, `subscription.cancel`, `subscription.reactivate`, `billing.payment.initiate`, `billing.payment.verify`, `usage.record` — needs a `role_permissions` seed row, and granting to `owner` and `admin` only is correct under the three-role catalog as implemented **and** remains correct under a six-role catalog, where the additional roles (Manager, Editor, Support, Viewer) would not hold billing authority either. It forecloses neither outcome.

Note this is narrower than the existing precedent: `store.read` is seeded to all three roles. A Phase 2 billing permission is not.

### Entitlement resolution

- ADR-008's precedence chain is implemented in full and in order: Policy Constraint → Tenant Override (ABSOLUTE before DELTA) → Add-on → Plan Version → Platform Default.
- **The Add-on rung exists in the resolver and always resolves empty (D2-7).** No add-on construct, table, or purchase path is built. The rung is present so the chain is faithful to the accepted ADR and so adding add-ons later is an insertion rather than a re-ordering.
- Explicit DENY wins over every grant including an ABSOLUTE override; an unresolvable conflict fails closed with `ENTITLEMENT_CONFLICT` (ADR-008 rules 1, 3).
- Resolution is deterministic and reproducible for identical inputs (ADR-008 rule 4), and never computed in an interface layer, an AI prompt or a plugin (rule 5).
- **No cache in Phase 2 (D2-4).** Resolve per request. This is a deferral with a condition, not an omission: **revisit when a measured p95 on `entitlement.resolve` exceeds a stated budget.** No budget is named here because none is derivable — ADR-010's Admin API p95 target (under 500 ms) is a whole-request budget, not a per-resolution one, and no measurement of the uncached path exists. **The budget itself is owed** (§7); an unmeasured deferral with a named measurement is honest, an unmeasured deferral with an invented threshold is not.

### Lifecycle: two axes and the crosswalk

ADR-024's eight subscription statuses and ADR-020's four tenant-data states are **two independent axes** (D2-5), not one vocabulary. ADR-020's `GRACE` row is not an ADR-024 status — it is ADR-020's name for the tenant-data posture during `PAST_DUE` within the grace window.

**Derived rule, stated because both ADRs assume it without writing it: a storefront is served only when the subscription's derived serving state AND the tenant-data state both permit it.** ADR-020's `SUSPENDED` and `OFFBOARDED` suppress serving that a subscription would otherwise permit; ADR-024's serving function (item 2) is the subscription half of that conjunction, never the whole answer.

The exhaustive crosswalk. Rows are ADR-024 statuses; columns are ADR-020 states. **P** = possible, **✗** = impossible with the reason.

| ADR-024 status | ADR-020 ACTIVE (retained/full/served) | ADR-020 GRACE (retained/full/served) | ADR-020 SUSPENDED (retained/read-only/not served) | ADR-020 OFFBOARDED (purge after window/none/not served) |
|---|---|---|---|---|
| `TRIALING` | **P** | ✗ grace is entered only from `PAST_DUE`; ADR-024 item 3 sends an unconverted trial to `EXPIRED` | **P** | **P** |
| `ACTIVE` | **P** — the normal state | ✗ `ACTIVE` means paid and current; grace means unpaid past `period_end` | **P** — but see finding (i) | **P** — but see finding (ii) |
| `PAST_DUE` | ✗ by ADR-020's own definition, `PAST_DUE` within grace *is* the `GRACE` state | **P** — the canonical pairing | **P** | **P** |
| `PAUSED` | ✗ not serving (ADR-024 item 2); ADR-020 `ACTIVE` is served | ✗ same, and grace is entered only from `PAST_DUE` | **P** | **P** |
| `CANCEL_AT_PERIOD_END` | **P** — before `period_end` | ✗ ADR-024 item 3 sends it straight to `EXPIRED` at `period_end`, with no grace | **P** | **P** |
| `EXPIRED` | ✗ not serving | ✗ grace has by definition already elapsed | **P** | **P** |
| `CANCELED` | ✗ not serving, terminal | ✗ not serving, terminal | **P** | **P** — the canonical pairing (ADR-024 item 6) |
| `SUSPENDED` | ✗ not serving | ✗ not serving | **P** | **P** |

Twenty combinations possible, twelve impossible; all thirty-two accounted for.

**Two combinations neither ADR defines. These are findings, recorded not resolved** (see §7 and `RISK_REGISTER.md` R-033):

- **(i) `ACTIVE` subscription × `SUSPENDED` tenant.** ADR-024 has `SUSPENDED` as a *subscription* status and ADR-020 has `SUSPENDED` as a *tenant* state. Whether administratively suspending a tenant must also transition its subscription, and whether billing continues during tenant suspension, is stated by neither.
- **(ii) `ACTIVE` subscription × `OFFBOARDED` tenant.** ADR-020 rule 2 permits a deletion request at any time. Whether a live paid subscription must first be cancelled, and whether remaining paid time is honoured or refunded, is stated by neither. ADR-020 rule 1 covers expiry, downgrade and cancellation — not a deletion request arriving mid-term.

Until these are answered, **no Phase 2 capability may transition a tenant into `SUSPENDED` or `OFFBOARDED`**, and none does — both are operator actions outside `05` §4.2's capability list. An implementer who finds a need for either must stop and report (`AGENTS.md` §5).

### Data preservation

- Nothing is deleted by any billing event. Expiry, downgrade and cancellation are never destructive (ADR-020 rule 1, ADR-026 item 1, `AGENTS.md` §4).
- Over limit: existing records retained, reads retained, export permitted, updates permitted; only *new creates* of that resource are blocked, with `QUOTA_EXCEEDED` carrying `resource`, `current`, `limit` and `resolution` in `details` (ADR-026 item 1, `05` §7).
- Exceeding a seat limit never locks out existing members; exceeding a store limit never takes a store offline (ADR-026 items 7–8).
- Deletion is only ever an explicit, authenticated, logged tenant or operator request, two-phase with a reversible window (ADR-020 rules 2–3). No Phase 2 capability performs one.

### `CapabilityDefinition` fields

The implemented type omits `approval`, `requiresServingSubscription`, `requiredEntitlements`, `quota` and `emitsEvents` — deliberately, because nothing enforces them, and declaring a field nothing enforces is the "documentation, not architecture" failure ADR-030 warns about.

**The rule: a field is added in the same slice that adds its enforcement, never ahead of it.** Items 6 and 7 are the first work that would add `requiredEntitlements` or `quota`; item 4 is the first that could justify `requiresServingSubscription`. No conformance rule ties this type to `05` §5's shape, so the reviewer of those slices is currently the only guard.

### Structure

- Mirror the golden path by **using its shared pieces**: `runCapabilityAttempt` is the shared outcome/audit/rethrow tail (`AGENTS.md` §2, D-3). Do not hand-roll its skeleton again.
- Guard selection, transaction strategy and each capability's own audit fields still live in the controller. Phase 5's capability registry and policy pipeline stay deferred.
- Every capability declares its error codes in its `CapabilityDefinition`, sourced from `05` §7; the OpenAPI artifact is regenerated and committed on every contract change (ADR-033 items 4–6).

---

## 6. Exit criteria, all proven by tests in CI

Criteria 1–8 decompose `06`'s Phase 2 **Exit** paragraph; 9–20 are ADR requirements it omits; 21–26 come from the D2 rulings. Each names the layer its test lives at, per `AGENTS.md` §8.

**From `06`'s Exit sentence:**

- [ ] 1. A subscription in a serving state resolves to a deterministic effective entitlement set for identical inputs — *capability policy test* (ADR-008 rule 4)
- [ ] 2. A subscription resolves to a deterministic effective quota for identical inputs — *capability policy test* (ADR-008)
- [ ] 3. A one-year term computes its `period_end` at the same calendar date in the organization's billing timezone, proven across a leap year — *domain unit test* (ADR-031 item 3)
- [ ] 4. An unpaid subscription is served through its grace window and not served after it — *application integration test* (ADR-024 item 4)
- [ ] 5. An upgrade applies only after payment is verified; an unverified upgrade leaves the subscription untouched — *application integration test* (ADR-025 item 4)
- [ ] 6. An upgrade does not move `period_end` — *domain unit test + application integration test* (ADR-025 item 3)
- [ ] 7. A payment abandoned before callback is resolved to a correct terminal state by the reconciliation sweep — *application integration test against real PostgreSQL* (ADR-023 item 4)
- [ ] 8. No code path deletes tenant data as a side effect of any billing state change — *application integration test + CI conformance test* (ADR-020 rule 1, ADR-026 item 1)

**Required by the ADRs, absent from `06`'s sentence:**

- [ ] 9. `plan.change.preview` returns the exact prorated amount, effective date and unchanged expiry date **before** any payment — *interface contract test* (ADR-025 item 3, `05` §4.2)
- [ ] 10. A provider callback claiming success, with no successful server-side verify, never marks a payment paid — *application integration test* (ADR-023 item 3)
- [ ] 11. A provider-reported amount or currency differing from the persisted intent fails hard and raises a security event — *application integration test* (ADR-023 item 5)
- [ ] 12. Double verification of one intent produces exactly one ledger entry — *application integration test* (ADR-023 item 4)
- [ ] 13. A second provider adapter is added with zero changes outside its own adapter and configuration — *interface contract test against fixtures, no network* (ADR-023)
- [ ] 14. A zero-minor-unit currency round-trips unchanged through API, database and invoice — *interface contract test* (ADR-022 verification; this shape's first real exercise)
- [ ] 15. An explicit DENY beats every grant including an ABSOLUTE override; an unresolvable conflict fails closed with `ENTITLEMENT_CONFLICT` — *capability policy test* (ADR-008 rules 1, 3)
- [ ] 16. Early renewal extends from `period_end`, not from the payment date — proven by a test that fails under payment-date extension — *domain unit test in the subscription module* (ADR-024 item 5, D2-12)
- [ ] 17. Running every scheduled job twice produces identical state — *application integration test* (ADR-024 item 8)
- [ ] 18. No illegal subscription state transition is reachable through any interface — *domain unit test + interface contract test* (ADR-024 item 3)
- [ ] 19. Concurrent identical idempotent requests execute exactly once; the same key with a divergent payload returns `IDEMPOTENCY_CONFLICT` — *application integration test against real PostgreSQL* (ADR-009)
- [ ] 20. Downgrading a tenant over its new limit deletes nothing and hides nothing; creating one more returns `QUOTA_EXCEEDED` with `resource`, `current`, `limit` and `resolution` in `details`; updating an existing over-limit record still succeeds — *capability policy test + application integration test* (ADR-026 items 1, 3)

**From the D2 rulings:**

- [ ] 21. No plaintext secret is written to `billing_provider_configs` by any code path, including a stub adapter, a seed, or a test fixture; the stored shape is encryptable in place without a data migration — *CI conformance test + application integration test* (D2-2)
- [ ] 22. The subscription-status × tenant-state crosswalk is exhaustive: every one of the 32 combinations resolves to a defined serving and data-retention behaviour, or is asserted impossible with its reason — *domain unit test* (D2-5)
- [ ] 23. Serving requires both axes: a subscription in a serving status within a `SUSPENDED` or `OFFBOARDED` tenant is not served — *domain unit test + application integration test* (D2-5)
- [ ] 24. Every Phase 2 billing permission is granted to `owner` and `admin` only; a `member`-role caller is denied with `FORBIDDEN` — *capability policy test* (D2-8)
- [ ] 25. A `tenant_entitlement_overrides` (or `tenant_quota_overrides`) row is invisible without tenant context and invisible from a different tenant's context; a `plan_entitlements` (or `plan_quota_policies`) row is readable with no tenant context — *integration test against real PostgreSQL* (D2-14)
- [ ] 26. Every paginated capability returns an opaque cursor and rejects an offset parameter; a collection that fits one page returns a null/absent next-cursor rather than a second style — *interface contract test* (D2-1)

**Carried forward from Phase 1, still required:** conformance harness green with an empty or fully justified exceptions report; integration tests against real PostgreSQL, not mocks; every error path returning a documented `05` §7 code; every capability emitting exactly one audit event per attempt on both outcomes (ADR-034).

**Deliberately not a criterion:** ADR-010's non-functional targets. Its own verification text requires that "metrics exist for every dimension in the table, otherwise the target is unmeasurable and therefore fictional," and none exist. A Phase 2 criterion asserting a latency or throughput target would be unprovable. ADR-010 is owed an amendment saying so (§7).

---

## 7. Decision disposition

All fourteen questions this brief was drafted around are answered. Full reasoning is in `decisions/2026-08.md` (2026-08-28); this table is the ruling and the pointer.

| # | Ruling | Now lives in |
|---|---|---|
| D2-1 | Keyset/cursor, opaque cursor, one style platform-wide; a small collection returning one page with a null cursor is the same style | §0; §5 "Pagination"; §6 criterion 26 |
| D2-2 | Mechanism deferred with a trigger — **but the column shape is not**: no plaintext secret, ever, and the stored shape must be encryptable in place | §5 "Credentials"; §6 criterion 21 |
| D2-3 | Port + fixture-modelled adapter in Phase 2; commercial selection and live credentials Phase 3/4 | §0; §2; §5 "Credentials" |
| D2-4 | No entitlement cache in Phase 2; revisit on a measured `entitlement.resolve` p95 exceeding a budget **that is itself still owed** | §0; §5 "Entitlement resolution" |
| D2-5 | Two independent axes with an exhaustive 8×4 crosswalk; serving requires both | §0; §5 "Lifecycle"; §6 criteria 22–23 |
| D2-6 | AI credit accounting out of Phase 2; both tables excluded. **ADR-006 amended 2026-08-28 — debt paid.** The amendment is a *split*, not a wholesale re-designation: ADR-006's usage-ledger half genuinely blocks Phase 2 item 9, only its AI-credit half moves to Phase 6+ | §4 out-of-scope; ADR-006's amendment |
| D2-7 | Add-on rung present and always empty; no add-on construct; `subscription_items` unbuilt | §0; §4 out-of-scope; §5 "Entitlement resolution" |
| D2-8 | Catalog question deferred to Phase 3; **every Phase 2 billing permission granted to `owner` and `admin` only** | §5 "Permissions"; §6 criterion 24 |
| D2-9 | ADR-010 to be amended to state its targets are unverified assumptions. **ADR-010 amended 2026-08-28 — debt paid**, naming `06` Phase 4 item 9 as the point they become measurable | §6 "Deliberately not a criterion"; ADR-010's amendment |
| D2-10 | `withIdempotentCapability` wrapper composing with `runCapabilityAttempt`, never a branch inside it | §0; §5 "Idempotency" |
| D2-11 | Seed migrations in Phase 2; `00` §4.2's "configurable without a code deployment" is **NOT MET** and is tracked as `RISK_REGISTER.md` R-032 | §0; §2; §4 (item 1) |
| D2-12 | `subscription.renew` → item 14; extension arithmetic lives in the subscription module | §3(a) row 7; §5 "Module boundaries"; §6 criterion 16 |
| D2-13 | Four INFERRED mappings ratified; EXPLICIT/INFERRED marking kept visible | §3(a) |
| D2-14 | `entitlements` and `quota_policies` each split platform-global / tenant-owned; no nullable `tenant_id` | §4; §5 "Tenancy and RLS"; §6 criterion 25 |

### Still open, and owed to files this brief does not edit

| Owed | To | Raised by |
|---|---|---|
| ~~Correct the "no earlier than Phase 3/4" claim and its unsound `03` §9 citation~~ — **PAID 2026-09-01.** `PROVIDER_MATRIX.md` carries a dated correction block stating D2-3's ruling with ADR-023/ADR-037 as authority. R-015 stays OPEN: the file is fixed, but no provider has been selected, which is what that row tracks. | `PROVIDER_MATRIX.md` | D2-3 / R-015 |
| ~~Dated amendment revising ADR-006's `Blocks: Phase 2` designation~~ — **PAID 2026-08-28** (split, not moved: the usage-ledger half still blocks Phase 2) | `02_ADR_INDEX_NORMATIVE_DECISIONS.md` | D2-6 / R-019 |
| ~~Dated amendment stating ADR-010's targets are unverified assumptions, naming the phase that changes that~~ — **PAID 2026-08-28** | `02_ADR_INDEX_NORMATIVE_DECISIONS.md` | D2-9 |
| Re-phrase Phase 2's items to name their capabilities, so the §3(a) mapping becomes mechanical | `06_IMPLEMENTATION_PLAN.md` | D2-13 |
| A measured p95 budget for `entitlement.resolve` as an **inner pipeline step**, so D2-4's deferral has a checkable trigger — assessed for ADR-010 on 2026-08-28 and deliberately not placed there: ADR-010's existing "Admin API p95 under 500 ms" already bounds `entitlement.resolve` *as a request*, and adding a row for the inner path would mean inventing a number | this brief, §5 | D2-4 / R-016 |
| Define `ACTIVE`×`SUSPENDED` and `ACTIVE`×`OFFBOARDED` (crosswalk findings (i) and (ii)) | ADR-020 / ADR-024 | D2-5 / R-033 |
| Six-role vs three-role catalog | `00_PLATFORM_OVERVIEW.md` / the role catalog | D2-8 / R-028 |

Every row above is tracked in `RISK_REGISTER.md` or named in a D2 ruling. **None blocks slice 1.**

---

## 8. What this brief does not cover

A Phase 2 gate review must establish these independently:

- **Exact columns, constraints and indexes.** `04` finalizes those per module during its slice, under ADR review. §4 names tables, owners, tenancy and creating items; `04` §5's constraint list and §8's index baseline are binding and are not restated here.
- **Whether `btree_gist` behaves in CI.** `04` §5 requires an exclusion constraint on the subscription period range. It was proven to work as `nexora_migrate` against this machine's PostgreSQL 17, and that the constraint shape rejects a real overlap — **on this machine only.** The compose/CI path (`postgres:17-alpine`) has never run it.
- **Module boundaries for the new modules.** §4 names `billing`, `subscription`, `entitlement`, `usage`, `idempotency`, `notification`, `eventing` as owners. Whether those are seven modules or fewer is a slice-time decision under `AGENTS.md` §2.
- **Job scheduling mechanics.** ADR-024 item 8 requires six named jobs, and `PHASE_1_DEBT_CLOSURE.md` D-2 defers the BullMQ dependency to item 14. Worker topology, retry policy and dead-letter handling are not designed here — D-2's reasoning is that a first real job is needed to design against.
- **The five entitlement/quota table names.** §4's names are indicative; only the platform-global/tenant-owned split is binding.
- **Anything about Phase 3 or later.** Commerce, storefront, domains, plugins, AI and MCP are out of scope and were not analysed.
- **Whether the fourteen D2 answers are mutually consistent in implementation.** They were checked for contradiction as written (see `decisions/2026-08.md`, 2026-08-28); they have not been exercised against code, because none exists yet.
- **Independent re-verification of the risk rows this brief relies on.** R-014 … R-033 were read as written. Only a sample of the earlier rows has ever been verified against code.

---

## 9. Amendment, 2026-09-03 — Phase 2.5 is created, and one of its decisions has a Phase 2 deadline

**This section is an amendment, not original scope.** It is placed here rather than woven into §§1–8 so that what this brief said on the day Phase 2 opened stays legible. Phase 2's own scope is unchanged by it, with one exception stated in full below.

**Phases are enumerated in `06_IMPLEMENTATION_PLAN.md`, and Phase 2.5 is recorded there too.** This brief describes one phase; it does not enumerate them. The two files were checked against each other before writing and they do not disagree — they have different jobs.

### 9.1 Scope of Phase 2.5

Three things, ruled by the maintainer on 2026-09-03:

1. **Subscription discounts** — both **bulk** (every subscriber of a plan) and **individual** (one named subscriber).
2. **Referral codes** — a subscriber's own code, attribution of who referred whom, credit that accumulates with the number of successful referrals, and application of that credit to the referrer's next period.
3. **Tenant data export** — ADR-020 rule 6's capability, *"with its own quota, not an ad-hoc script"*, per `RISK_REGISTER.md` **R-038**.

**Order inside the phase is fixed and is not a preference: discounts first, referral second.** The referral reward is paid **as a discount**, so the referral model cannot be designed before the discount model it depends on exists. Building them in the other order would mean designing a reward with no mechanism to pay it.

### 9.2 Why the phase is defined now rather than when it is built

**The discount decision must land before Phase 2 item 13's migration.** `invoices` and `invoice_lines` are append-only under §5's `REVOKE UPDATE, DELETE` list, and migrations are forward-only (ADR-021 item 8). Adding a discount line to an invoice after those tables exist is a **data migration**, not a schema change — the same trap ADR-041 names for ledger partitioning and ADR-046 names for `deleted_at`.

**This is the one place Phase 2.5 reaches back into Phase 2, and it is a deadline rather than a scope change.** Item 13 does not build discounts. It must merely not foreclose them — which requires knowing, before its migration is written, whether an invoice can carry a discount line at all. That question belongs to the discount design session, and this amendment exists so the question is asked before the migration rather than after.

### 9.3 Two accepted obligations that now have an owner

`RISK_REGISTER.md` **R-038** recorded that two requirements inside ADR-020's own body were accepted and had **no owning phase**. Both are Phase 2.5's:

- **Rule 6's tenant data-export capability.** Ruled posture: a **per-tenant logical export taken before the destructive phase of a deletion**, retained for the reversible window. This is the mechanism ADR-020 already requires — it is being given a phase, not invented, which is why **no ADR was written for it**: ADR-020 decided it, and what was missing was an owner, which lives here.
- **Rule 7's tenant-facing retention documentation** — *"the retention window must be documented to the tenant."* Owed to whichever tenant-facing document Phase 2.5 produces. **That document does not exist yet and is named as owed rather than assigned a location invented here.**

**A constraint that shapes whatever gets built, carried from R-038 rather than restated loosely.** Ledger-shaped tables carry `REVOKE UPDATE, DELETE … FROM nexora_app`, so the application role cannot delete a ledger row. Restoring one tenant is therefore **a restore for mutable state and a compensating entry for ledgers**, and it runs outside the application under a different role — which changes who may run it and how it is audited.

### 9.4 What Phase 2.5 excludes — its own wall, in §4's sense

- **No fraud scoring**, of referrals or of trials. ADR-052 accepts the self-serve trial's abuse surface explicitly and names detection rather than prevention as the mitigation; that detection belongs to no current phase and is not created here.
- **No marketplace, and no split payments.**
- **No commerce coupons.** These are a merchant's own coupons offered to *their* shoppers (`04` §3) and they are **Phase 3** — a different subject with a different tenant, and the name similarity is the only thing the two share. Recorded explicitly because it is the single most likely thing to be pulled into this phase by mistake.
- **No AI credit economy** (D2-6's exclusion is unchanged).

### 9.5 What this amendment does not do

**It defines scope. It designs nothing.** Which tables and capabilities belong to Phase 2.5 is decided here; the discount model, the referral attribution model, their tables, their capabilities and their contracts are **a later session's work and must not be started from this text.** No table is added to §4 for Phase 2.5 — §4 is Phase 2's scope list, and Phase 2.5 will need its own.

It also does not set a date, a duration, or a position relative to Phase 3 beyond its name. The one hard sequencing fact is §9.2's deadline against Phase 2 item 13.

### 9.6 Amendment, 2026-09-03 (second this date) — Phase 2.5 also carries per-tenant recovery

**ADR-054** (`Per-Tenant Recovery from Nightly Snapshots`, ACCEPTED, ruled the same day) gives **R-038**'s restore half a mechanism and a phase, and that phase is this one. §9.3 above already assigned Phase 2.5 the *export* capability; this amendment adds the three operational items it shares a mechanism with, and the prerequisite all three depend on.

**Added to §9.1's scope:**

4. **Nightly per-tenant snapshot job** — one snapshot per tenant per day, written by a scheduled job.
5. **Operator-run per-tenant restore** — restoring a named tenant from a named snapshot, **outside the application role**, because the application role cannot delete a ledger row by design and therefore cannot perform this on itself. An operator action with its own audit trail (ADR-034), never a tenant-facing capability.
6. **The recovery drill** — a periodic automated restore into a sandbox that **verifies the result**, not merely that the restore ran. ADR-054 gives this its own verification checkbox because it is the part of every backup design that is dropped first.
7. **Object storage** — the **named prerequisite of items 4, 5 and 6**, not an implementation detail of them. See §9.7.

**Items 4–6 share a mechanism with §9.3's export capability, and that is a different statement from being the same item.** A nightly snapshot and a tenant's own data export are the same extraction on different schedules with different consumers — one unattended and written where an operator can reach it, the other on a tenant's request under their own quota. **ADR-054 rules that one mechanism is built, not two**, because two independently-written extractors drift in the way that matters most: one quietly stops covering a table the other covers, and nobody finds out until a restore. They are therefore **built together and remain separate deliverables** — the export is a capability with a quota, the snapshot is a job, and the restore is an operator action.

**Order:** items 4–6 follow the discount and referral work only in the sense that §9.1's ordering constraint does not apply to them. **They have no dependency on discounts or referrals in either direction** and may be built in parallel; their only hard dependency is item 7.

### 9.7 Object storage is a prerequisite, and it currently has no owner

**This platform has no object storage, and snapshots have to be written somewhere.** §4's exclusion list records `files` as out of Phase 2 with *"object storage, no phase owns it yet"*, and `RISK_REGISTER.md` **R-025** confirms it directly: no port exists (`platform/` contains only `clock.ts`, `config.ts`, `db/`, `http/`, `rate-limit/`), and no phase list delivers one.

**Nothing in §9.6 items 4–6 can be built before this is resolved.** It is recorded here as a named prerequisite rather than left inside ADR-054's mechanism, so that it is visible when the phase is planned rather than discovered when it is started.

**R-025's own ratings are now stale as a consequence** — it reads *"two full phases away from current work"*, written 2026-08-28 and accurate then. R-025 carries a dated addendum recording that ADR-054 moved it to the next phase; **re-rating its Likelihood and Impact cells is left to the maintainer** rather than taken as a side effect of this amendment.

### 9.8 What unifies this phase, restated — and one question left to the maintainer

Phase 2.5 was created on 2026-09-03 as **Commercial Growth**, carrying discounts, referrals and tenant export. It now also carries snapshots, restore and drills. **Recording the unifying reading, because a phase whose name explains half its contents is a phase people will look in the wrong place for:**

**Phase 2 makes the product sellable. Phase 2.5 makes it responsible to run for real customers** — you can price it flexibly (discounts, referrals) and you can be trusted with the data (export, restore, verified drills). Both halves are things a platform needs before it has customers who would be hurt by their absence, which is why they sit in one phase rather than two.

**The honest caveat on that reading:** it is coherent, not forced. Nothing prevents selling at list price, so "must exist before the first paying tenant" is truer of the recovery half than of the discount half. The reading is recorded as the reason the phase holds together, not as a derivation.

**One question this amendment deliberately does not answer: the name `Commercial Growth` now under-describes the phase**, and whether Phase 2.5 should be renamed, or split into a commercial phase and an operational one, **is a maintainer decision and is not taken here.** Recorded rather than acted on, because renaming or splitting a phase is a scope decision of exactly the kind §9.5 says this amendment does not make.

### 9.9 Amendment, 2026-09-03 (third this date) — the phase is renamed `Launch Readiness`, and deliberately not split

§9.8 above left one question open: the name `Commercial Growth` under-described a phase that had just acquired recovery, restore and drills, and whether to rename or split was recorded as the maintainer's. **Ruled the same day: rename, do not split.** §9.8's text is left exactly as written — it is the record of the question, and this section is the answer.

**`Phase 2.5: Launch Readiness`**, renamed in `06_IMPLEMENTATION_PLAN.md` in the same amendment.

**Why not split, which is the part worth keeping.** The phase is one coherent thing — **what must exist before the first paying tenant.** Selling to them needs discounts and referrals; being trustworthy with what they hand over needs export, restore and verified drills. Both halves gate the same event, so splitting them would produce a Phase 2.6, a second set of exit criteria, and an ordering question between two things that have no dependency on each other in either direction (§9.6 records that items 4–6 do not depend on items 1–2 either way). That is administrative overhead bought with nothing.

**What the new name fixes** is narrower than it looks and is worth stating precisely: nothing about the phase's scope, ordering, exclusions or deadlines changes here. The rename fixes **where a reader looks.** Someone searching for the platform's recovery story would not have opened a phase called `Commercial Growth`, and §9.8's own observation was that a phase whose name explains half its contents is a phase people look in the wrong place for.

**Occurrences of the old name are not swept.** The two in §9.8 above and those in `decisions/2026-09.md` sit inside dated records, which say what was true when written; they are left alone deliberately, in the same convention this register-and-decision pack applies everywhere else. Only the live enumeration in `06_IMPLEMENTATION_PLAN.md` and the status line in `CLAUDE.md` were changed.

