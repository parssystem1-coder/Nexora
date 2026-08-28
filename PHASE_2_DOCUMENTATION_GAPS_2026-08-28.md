# Phase 2 Documentation Gaps — 2026-08-28

An external review raised twelve findings against this repository's own normative documents, ahead of Phase 2 opening. This document verifies each one independently against the current files (not against the review's own claim) and records the result. **This is a recording pass only:** no code, migration, contract, or ADR was changed to produce it, and none of the twelve findings is resolved here — each states what must be decided and by whom, not what the decision should be.

Method: for each finding, the cited document/section was opened directly and the quoted text confirmed against the current file, not assumed from the review's paraphrase. Two findings' own citations turned out to be imprecise even though the underlying gap is real (G-3's `03_TECHNICAL_BLUEPRINT.md` §9 citation, G-4's `R-013` citation) — both are corrected in place below, per this task's own instruction that a false citation recorded as sound is worse than no finding.

---

## Blocking-class

### G-1 — No `PHASE_2_BRIEF.md` exists

**Verdict: CONFIRMED.**

`AGENTS.md` §1 item 2 names `08_PHASE_1_BRIEF.md` as authority #2, "for what to build now." `ls PHASE_2_BRIEF.md` confirms no such file exists at the repository root. `08_PHASE_1_BRIEF.md` is what let the Phase 1 exit gate be verified at all: §0 (settled stack), §2 (normative pipeline ordering), §3 (slice list), §4 ("Only these. Creating anything else is out of scope" — the table ceiling that made scope creep mechanically checkable), §5 (RLS exemption list, checked directly against the live database in the entry-review two sessions ago), §6 (the nine exit criteria this repository's three gate reviews were built around). `06_IMPLEMENTATION_PLAN.md`'s Phase 2 section (lines 53-77) has an ordered item list and one **Exit** paragraph, but none of `08`'s other five sections has a Phase 2 counterpart anywhere in the doc pack.

**Why it is a gap:** the moment Phase 2 opens, `AGENTS.md` §1's own read order points a new session at a brief describing a phase that already closed. Nothing currently tells an implementer which tables are in scope for Phase 2 specifically (only `04`'s full, all-phases schema), what Phase 2's RLS exemptions are, or what a Phase 2 exit gate would even check beyond `06`'s one-paragraph **Exit** clause.

**What it blocks:** a Phase 2 gate review with the same rigor as the three Phase 1 reviews — there is no itemised checklist to build an exit-criteria table against.

**Who decides:** the maintainer. A phase brief is a top-level scoping document, not something an implementer picks up mid-slice.

---

### G-2 — No mapping from `05` §4.2's capabilities to `06`'s Phase 2 items

**Verdict: CONFIRMED.**

`05_API_CAPABILITY_CONTRACTS.md` §4.2 ("Commercial lifecycle") lists exactly 15 capabilities (`plan.list` through `billing.payment.verify`, lines 87-101 — counted directly, not estimated: `grep`-counted at 15). `06_IMPLEMENTATION_PLAN.md`'s Phase 2 order (lines 57-74) lists 18 items, phrased as work packages ("subscription state machine and append-only transition log"), not as a list of capabilities. No section, table, or document anywhere in the doc pack (`grep -rn` for a capability-name/item-number cross-reference across `*.md` returns nothing that is an actual mapping table — two incidental single-item pointers exist, in `PHASE_1_DEBT_CLOSURE.md` D-5 and `PROJECT_STATUS.md`, naming one specific item each in passing, not a mapping) states which of the 18 items deliver which of the 15 capabilities, or whether the counts should even match one-to-one (they plausibly should not — e.g., a state machine item and an entitlement-resolution item might each surface multiple capabilities, or none directly).

**Why it is a gap:** without this mapping, "Phase 2 is done" has no operational definition — the same failure mode `08_PHASE_1_BRIEF.md` §6 existed specifically to prevent for Phase 1.

**What it blocks:** a Phase 2 exit gate. This is the same root cause as G-1 and would likely be resolved by the same document.

**Who decides:** the maintainer, as part of writing the Phase 2 brief (G-1).

---

### G-3 — `PROVIDER_MATRIX.md` and `06`'s Phase 2 item order disagree on when a payment provider is chosen

**Verdict: CONFIRMED, with a citation correction.**

`PROVIDER_MATRIX.md:5` reads: *"Populate as each extraction seam (`03_TECHNICAL_BLUEPRINT.md` §9) is implemented, starting no earlier than Phase 3/4 per the phase slices in that document."* `06_IMPLEMENTATION_PLAN.md` Phase 2 items 10-12 (lines 66-68) are, in order: "payment provider port with capability flags (ADR-023)," "first provider adapter, plus a second stub adapter to prove the port," "payment intent, verify, and the reconciliation sweep job" — all inside Phase 2, and Phase 2's own **Exit** paragraph (line 76) requires "an abandoned payment is resolved by reconciliation." These two claims are in direct tension: `06` requires a real adapter and a working reconciliation sweep inside Phase 2; `PROVIDER_MATRIX.md` says provider work starts no earlier than Phase 3/4.

**The correction:** `PROVIDER_MATRIX.md`'s own citation for the Phase 3/4 timing does not hold up. `03_TECHNICAL_BLUEPRINT.md` §9 ("Extraction Seams," read in full — it is four lines) lists payment providers among things to "keep behind contracts from day one" and says not to add network calls between internal modules until extraction is justified. It contains no phase numbers and no "phase slices" at all. `PROVIDER_MATRIX.md`'s claim that Phase 3/4 timing comes "per the phase slices in that document" is not supported by the document it cites — the timing claim is asserted, not sourced, as stated.

**A nuance that narrows but does not remove the gap:** ADR-023's own verification list requires only that "adapter contract test suite runs against fixtures with no network" and "a second provider is added in a test with no changes outside its adapter and configuration" — both satisfiable without a live production PSP account. So `06`'s Phase 2 items 10-12 do not strictly require *selecting and going live with* a real payment provider in `PROVIDER_MATRIX.md`'s sense; they do require modeling the first adapter's fixtures against some real provider's actual API shape, which is itself a form of provider selection `PROVIDER_MATRIX.md` says shouldn't start yet. The disagreement is real; it is narrower than "Phase 2 needs a live PSP integration."

**What it blocks:** Phase 2 items 10-12 cannot be scoped precisely (fixture-only against a real provider's shape, vs. `PROVIDER_MATRIX.md`'s literal "not yet") until this is resolved.

**Who decides:** the maintainer — this is a cross-document authority conflict, not something an implementer should resolve silently by picking whichever document is more convenient.

---

## Design-gap class

### G-4 — Entitlement caching has no home

**Verdict: CONFIRMED, with a citation correction.**

ADR-008 (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:601`) permits a cache and names five invalidation triggers exactly: "subscription change, plan version migration, add-on change, override change and term boundary crossing (ADR-024)." ADR-024 item 9 (line 1040) requires that on transition to a non-serving state the platform "invalidate effective entitlement cache" as the first step of expiry propagation. Neither `04_DATABASE_BLUEPRINT.md` §2.4 (`entitlements`, `entitlement_sources`, no cache table) nor any ADR states where this cache lives — in-process, Redis, or a materialized table.

**The correction:** the review cited `RISK_REGISTER.md` R-013 as "the live precedent" for "an in-process store cannot be invalidated across instances." Read directly, R-013 is about a different failure mode entirely — `InProcessRateLimitStore.sweepExpired()`'s O(n)-per-write eviction cost under many simultaneously-live keys, not cross-instance invalidation. The correct precedent is **R-005**, whose own text states the actual claim: *"the store is per-process — it does not hold across multiple instances of this API and resets on every restart"* (`RISK_REGISTER.md` R-005's Mitigation cell), with a named hard trigger to swap to a Redis-backed store once more than one instance runs. `PHASE_1_DEBT_CLOSURE.md` D-2 confirms no Redis client dependency exists yet (`docker-compose.yml`'s `redis` service was added; `bullmq`/`ioredis` deliberately were not).

**Why it is a gap:** an entitlement cache is read on every request that resolves what a tenant may do — a materially hotter, higher-stakes path than the login rate limiter R-005 already had to fix once for exactly this reason (in-process state invisible across instances). Building it ad hoc when item 6 (entitlement resolution) is reached risks repeating R-005's original mistake with higher consequence: a stale entitlement served from one instance's cache after a downgrade or expiry is a real business-logic and (for LIMIT/DENY features) potential security-adjacent defect, not a cosmetic one.

**What it blocks:** Phase 2 item 6 (entitlement resolution) starting without first knowing where its own cache invalidation lands.

**Who decides:** the maintainer — this is the same class of decision R-005/D-2's Redis question already was, and `AGENTS.md` §4 forbids inventing a module-specific mechanism for what is inherently cross-cutting.

---

### G-5 — How ADR-009's idempotency composes with `runCapabilityAttempt` is undefined

**Verdict: CONFIRMED.**

ADR-009 (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:638`): *"A claim is made inside the same transaction that performs the write where the write is single-transaction."* `modules/capability/interfaces/capability-attempt.ts:51-59`'s own doc comment, verified directly: *"SCOPE CEILING... this is not Phase 5's 'capability registry and policy pipeline'... It does not know what a capability IS, does not resolve guards, does not read a `CapabilityDefinition`, and **does not choose a transaction strategy**. It is the minimal, genuinely-identical tail every controller already had, pulled into one place."* Each controller currently opens its own transaction independently (or none, for `auth.login`/`auth.logout`/`auth.logout_all`) via `withTenantContext`, entirely outside `runCapabilityAttempt`'s own scope.

**Why it is a gap:** ADR-009 requires the idempotency claim and the write to share one transaction. `runCapabilityAttempt` deliberately has no opinion on transactions at all — by design, confirmed by its own comment, not by omission. Nothing currently says whether the idempotency claim is made inside the controller's own `withTenantContext` block (before calling `runCapabilityAttempt`), inside `runCapabilityAttempt` itself (which would mean giving it a transaction strategy after all — directly contradicting its stated scope ceiling), or in some third place not yet named.

**What it blocks:** Phase 2 item 3 (the idempotency service itself) cannot be wired into the golden-path pattern every later slice mirrors (`AGENTS.md` §2) without this being settled first — and every idempotent capability from item 4 onward (`04` §2.6's `idempotency_records` table already has its intended unique constraint) depends on item 3 having answered it. Left undecided, Phase 2 either hand-rolls idempotency per controller (the exact duplication `PHASE_1_DEBT_CLOSURE.md` D-3 just spent a slice removing) or grows `runCapabilityAttempt` into Phase 5's capability pipeline early, silently, contradicting its own recorded scope ceiling.

**Who decides:** the maintainer, before Phase 2 item 3 begins — this determines the shape of the golden path every subsequent write-capability slice mirrors, not a decision one slice's implementer should make unilaterally.

---

### G-6 — Add-ons are referenced but never defined

**Verdict: CONFIRMED, with a scope correction.**

ADR-008 mentions "Add-on" three times, each as a bare participant: the precedence chain (line 586, `-> Add-on`), the definition of effective entitlement (line 565, "Base Plan Version, plus Add-ons, plus Tenant Overrides, plus Policy Constraints"), and a cache-invalidation trigger (line 601). No ADR, and no table in `04_DATABASE_BLUEPRINT.md`, defines what an add-on is, how it versions, or how it is purchased.

**The correction:** the review's framing states add-ons are "implied by `04` §2.3's `subscription_items`." Read directly, `04:89` lists `subscription_items` as a bare table name with no columns and no comment — unlike every other table in that block, which carries at least an inline note. Nothing in `04` actually says `subscription_items` is the add-on table; that connection is a plausible inference, not a documented fact, and this document does not adopt it as one.

**Why it is a gap:** ADR-008's precedence chain cannot be implemented without knowing what an add-on's data shape is, and `entitlement_sources`'s "add-on change" invalidation trigger cannot be wired to anything concrete.

**What it blocks:** Phase 2 item 6 (entitlement resolution), which must implement ADR-008's precedence chain in full, including the add-on rung.

**Who decides:** the maintainer, before item 6 — `AGENTS.md` §4 prohibits inventing an abstraction ad hoc, and an add-on's versioning/purchase model is exactly the kind of decision `08_PHASE_1_BRIEF.md`-style scoping settled in advance for Phase 1's own entities.

---

### G-7 — Two lifecycle vocabularies, no stated mapping

**Verdict: CONFIRMED.**

ADR-020's tenant-state table (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:753-760`) names four states: ACTIVE, GRACE (ADR-024), SUSPENDED, OFFBOARDED — the "GRACE" row is written exactly that way, citing ADR-024 as if ADR-024 defined a status by that name. ADR-024 (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:962, 988, 992-1003`) names eight subscription statuses (TRIALING, ACTIVE, PAST_DUE, PAUSED, CANCEL_AT_PERIOD_END, EXPIRED, CANCELED, SUSPENDED — counted directly) and its own serving-state derivation (line 988) writes grace as a *qualifier*, not a status: `"PAST_DUE (within grace)"`. There is no status literally named `GRACE` anywhere in ADR-024. Separately, `OFFBOARDED` does not appear in ADR-024's transition list (lines 995-1003) at all — ADR-024's terminal state is `CANCELED`, and `OFFBOARDED` is an ADR-020-only, tenant-level concept with no stated relationship to any ADR-024 subscription status.

**Why it is a gap:** these are two real, ACCEPTED, currently-load-bearing documents describing what reads as one lifecycle, using vocabulary that does not line up: one document's citation implies a status the other document never defines, and one document's terminal state has no corresponding entry in the other's model at all. An implementer building tenant-offboarding logic against ADR-020's table and subscription-lifecycle logic against ADR-024's transitions, without reading both side by side, could reasonably build a `GRACE` column that doesn't exist, or leave `OFFBOARDED` unreachable from any subscription transition.

**What it blocks:** any Phase 2 or later work that needs to answer "what tenant-level state does this subscription status imply" — most concretely, item 5 (subscription state machine) and any offboarding-triggered logic that must react to a subscription reaching `CANCELED`.

**Who decides:** the maintainer. `AGENTS.md` §4 prohibits changing an accepted ADR silently; reconciling the vocabulary (or explicitly stating they are two independent axes with a named crosswalk) is a correction to two accepted documents, not an implementer's call.

---

### G-8 — AI credit accounting's Phase 2 scope is undefined

**Verdict: CONFIRMED.**

`02_ADR_INDEX_NORMATIVE_DECISIONS.md`'s own summary table (line 507) lists ADR-006 ("Concurrent Usage and AI Credit Accounting") with **Blocks: Phase 2** — the document's own designation, not the review's inference. `04_DATABASE_BLUEPRINT.md` §2.4 (lines 100-101) declares `ai_credit_ledger_entries` and `ai_credit_reservations` ("new: reservation lifecycle per ADR-006"). `06_IMPLEMENTATION_PLAN.md`'s Phase 2 item list (lines 57-74, all 18 items read directly) contains no item naming AI credit, ledger reservation, or anything mapping to ADR-006. `grep -rn "ADR-006"` across `06`, `07_ARCHITECTURE_GAP_REPORT.md`, and `08_PHASE_1_BRIEF.md` returns no result.

**Why it is a gap:** an ADR the index itself marks as blocking Phase 2 has no corresponding Phase 2 work item, and the table it requires has no scheduled slice to create it — this is exactly the kind of question `08_PHASE_1_BRIEF.md` §4's table ceiling answered explicitly for Phase 1 ("Only these... Do not create billing, commerce, domain, plugin, AI or MCP tables") and Phase 2 currently has no equivalent statement either way.

**What it blocks:** declaring Phase 2 complete while ADR-006 remains marked as one of its blockers, unaddressed — a real risk of a false "done."

**Who decides:** the maintainer — either add AI credit accounting to Phase 2's item list, or record that ADR-006's "Blocks: Phase 2" designation is being deliberately revised/deferred, the way ADR-010 and ADR-019 already show this document pack does when a blocking designation changes.

---

## Verifiability class

### G-9 — ADR-010 is currently unmeetable by its own verification text

**Verdict: CONFIRMED.**

ADR-010's verification list (`02_ADR_INDEX_NORMATIVE_DECISIONS.md:708`): *"metrics exist for every dimension in the table, otherwise the target is unmeasurable and therefore fictional."* Its revisit triggers (lines 697-703) require conditions "observed for seven consecutive days" across five dimensions (RPS, p95 latency, DB CPU, per-store load, per-tenant load). `RISK_REGISTER.md` R-010 (read in the prior entry review, re-confirmed here) establishes there is no metric, no alert, and no dashboard anywhere in this platform — only a structured log line and an in-process counter nothing consumes. `06`'s 18 Phase 2 items (lines 57-74) contain no observability, metrics, or dashboard item.

**Why it is a gap, and how it differs from the already-tracked R-010:** R-010 is scoped narrowly to one failure mode (audit-write failures going undetected). ADR-010's requirement is platform-wide — RPS, latency percentiles, database CPU, per-store and per-tenant load — none of which R-010's structured event/counter touches at all. Phase 2 adds materially more load-bearing surface (payment callbacks, subscription jobs, usage recording) that ADR-010's own assumption table is supposed to size against, with no mechanism to ever observe whether those assumptions hold.

**What it blocks:** ADR-010's own revisit mechanism — the thing that is supposed to catch this platform outgrowing its stated scale assumptions cannot fire, because nothing measures the five dimensions it depends on. This does not block starting Phase 2 item 1; it is a standing gap that gets more consequential the longer Phase 2 runs without it.

**Who decides:** the maintainer. Given zero production traffic exists today, an implicit "not yet" may already be the maintainer's real position — but it is not written down anywhere, and ADR-010 as currently worded does not say so itself.

---

### G-10 — `store.update` is contracted but scheduled nowhere and built nowhere

**Verdict: CONFIRMED — but argued below as not a risk-register item.**

`05_API_CAPABILITY_CONTRACTS.md:81` lists `store.update` (store scope, MEDIUM_WRITE, idempotent). `grep -rn "store\.update\|store-update\|StoreUpdate"` across `06_IMPLEMENTATION_PLAN.md` and the entire `apps/`/`modules/` tree returns nothing. `grep -rln "store\.update" *.md` at the repository root returns only `05` itself — no other document, including `07_ARCHITECTURE_GAP_REPORT.md`, mentions it.

**Why it is a gap:** an orphaned contract row — specified, but with no phase ever assigned to build it and no code implementing it.

**What it blocks:** nothing today. No other capability, ADR, or test depends on `store.update` existing.

**Who decides:** whoever eventually picks up store-management capabilities, at slice time — either schedule it into a phase or strike it from `05` as out of scope. Low stakes; not a design-architecture question the maintainer needs to settle in advance.

---

### G-11 — The money-over-the-wire contract shape has never crossed a real capability

**Verdict: CONFIRMED.**

`05_API_CAPABILITY_CONTRACTS.md:50-52` (matching ADR-022 item 7) declares the shape `{ amount: string; currency: string; minorUnits: number }` and `05:194-219` shows it in example Phase 2 payloads (`plan.change.preview`'s proration response). `grep` for `amountMinor`/money-shaped response fields across every `apps/api`/`modules/*/interfaces/*.controller.ts` file, and for `"amount"`/`"minorUnits"` in `openapi.json`, returns nothing. Every Phase 1 capability's actual response body was checked (all ten controllers) — none returns a monetary value; `Money` (`modules/money/`) is fully built and tested at the domain-object level (401 of the current test suite's tests include its allocator property tests) but has never been serialized across an HTTP boundary in this codebase.

**Why it is a gap:** a contract shape that has never actually been exercised end-to-end (domain `Money` → JSON response → client parse) is unverified exactly where verification is cheapest to do — before anything depends on it. `plan.change.preview` (item 15) is explicitly named mandatory in `05:103`; it and `invoice.list`/`billing.payment.*` will be among the first capabilities to actually return this shape.

**What it blocks:** nothing today; this is a standing risk that surfaces the first time a Phase 2 capability tries to return money, potentially forcing a contract-shape fix at a point where more than one capability already depends on it.

**Who decides:** the implementer of the first money-returning capability — the shape itself is already fully specified by ADR-022 and needs no new decision, only a first real exercise and a contract test proving it round-trips (including a zero-minor-unit currency, per ADR-022's own verification list).

---

### G-12 — `btree_gist` for the subscription-period exclusion constraint: empirically tested, not merely assumed

**Verdict: CONFIRMED as a real, previously-untested gap — closed by this review's own experiment with a positive result.**

`04_DATABASE_BLUEPRINT.md:224`: *"subscription periods for a subscription must not overlap, enforced by an exclusion constraint on the period range."* An exclusion constraint combining equality (`subscription_id`) with range overlap (`period_range`) requires GiST support for the equality operator class, which requires `CREATE EXTENSION btree_gist`. `nexora_migrate` (`platform/db/init/001_roles.sql`) owns the database but is `NOSUPERUSER`/`NOCREATEDB` (confirmed live: `rolsuper = f`, `rolcreatedb = f`, `rolbypassrls = f`), and no migration has ever attempted this — confirmed by `grep` finding no `CREATE EXTENSION` anywhere in any committed migration.

**Empirical result, run against a throwaway database (`nexora_g12_check`, dropped after; no migration was added, per the task's explicit instruction):**

```
$ psql -h localhost -p 5432 -U nexora_migrate -d nexora_g12_check -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
CREATE EXTENSION

$ psql ... -c "SELECT extname, extversion FROM pg_extension WHERE extname='btree_gist';"
  extname   | extversion
------------+------------
 btree_gist | 1.7

$ psql ... -c "CREATE TABLE subscription_periods_test (subscription_id uuid NOT NULL, period_range tstzrange NOT NULL, EXCLUDE USING gist (subscription_id WITH =, period_range WITH &&));"
CREATE TABLE

$ psql ... -c "INSERT ... ('...1111', '[2026-01-01,2026-02-01)'); INSERT ... ('...1111', '[2026-01-15,2026-02-15)');"
INSERT 0 1
ERROR:  conflicting key value violates exclusion constraint "subscription_periods_test_subscription_id_period_range_excl"

$ psql ... -c "INSERT ... ('...1111', '[2026-02-01,2026-03-01)');"   -- non-overlapping, same subscription
INSERT 0 1
```

`nexora_migrate` can install `btree_gist` with no elevated privilege beyond what it already has, and the exact constraint shape `04` §5 requires works correctly — rejecting a real overlap, accepting a real adjacency. This was a genuine, previously-unverified assumption (a "trusted extension should install" claim, per PostgreSQL's own trusted-extension mechanism, but never actually run against this database's real role grants) and it is now closed, not merely more strongly assumed.

**What it blocks:** nothing, now. Before this experiment, it would have blocked confidence in Phase 2 item 4's migration (`subscription_periods`) succeeding on the first attempt on this specific database, which matters because migrations here are forward-only (`04` §7).

**Who decides:** no decision is needed. This finding was originally in the verifiability class because it was untested, not because it required a judgment call; the test converts it from "unverified assumption" to "verified fact," and no further action follows.

---

## Summary table

| ID | Verdict | Blocks | Decided by |
|---|---|---|---|
| G-1 | CONFIRMED | Phase 2 gate review | Maintainer |
| G-2 | CONFIRMED | Phase 2 "done" definition | Maintainer (with G-1) |
| G-3 | CONFIRMED, citation corrected | Scoping items 10-12 | Maintainer |
| G-4 | CONFIRMED, citation corrected (R-013 → R-005) | Item 6 | Maintainer |
| G-5 | CONFIRMED | Item 3 and every idempotent capability after it | Maintainer, before item 3 |
| G-6 | CONFIRMED, `subscription_items` linkage un-adopted | Item 6 (add-on rung) | Maintainer, before item 6 |
| G-7 | CONFIRMED | Item 5; offboarding-triggered logic | Maintainer |
| G-8 | CONFIRMED | Phase 2 exit honesty vs. ADR-006 | Maintainer |
| G-9 | CONFIRMED | ADR-010's own revisit mechanism | Maintainer |
| G-10 | CONFIRMED, not a risk | Nothing today | Implementer, at slice time |
| G-11 | CONFIRMED, not a risk needing a decision | Nothing today | Implementer, at slice time |
| G-12 | CONFIRMED, then closed by empirical test in this review | Nothing | No one — resolved |

## What this review did not cover

This review read only the documents named in its own instruction, plus `03_TECHNICAL_BLUEPRINT.md` §9 (needed to check G-3's citation) and the ADR index sections for ADR-006, -008, -009, -010, -019, -020, -022, -023, -024. It did not read `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, or ADR-011 through ADR-018, per standing rule. It did not attempt to find every documentation gap in the Phase 2 surface — only to verify the twelve findings it was handed. A different reviewer reading the same documents from scratch might find others.
