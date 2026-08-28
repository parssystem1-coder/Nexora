# External Architecture Review — 2026-08-28

Sixteen findings (F-1 … F-16) were raised by an external read of this repository and handed to this session as claims to test. This document records the result of testing each one. **It is a recording pass only:** nothing was fixed, no `.ts`, `.sql`, config file, ADR, or existing document was edited, and no finding here is resolved. Where a finding warrants an immediate fix, that belief is stated in the finding and left for a separately-scoped session.

It follows the format and epistemic standard of `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` (the G-findings), including its central rule: a finding's *citation* is verified independently of the finding's *claim*, because a false citation recorded as sound is worse than no finding at all.

Three of the sixteen turned out to be wrong or materially overstated as handed over, and are recorded with the correction rather than the claim: **F-7** (its central premise about what the code declares is factually incorrect), **F-14** (the named test does not test what the finding says it tests, and the coverage it claims is missing largely exists elsewhere), and **F-15** (the normative rule the finding says is absent is present, and quoted below). **F-11** and **F-13** carry smaller corrections in the same spirit.

## Method

For each finding: open the exact files named, quote the current text with line numbers, prove any claimed absence with a command whose output is pasted, and reach the verdict from what was read rather than from what the prompt asserted. Severity (`BLOCKING` / `MODERATE` / `LOW` / `OBSERVATION`) is assigned by this review, not inherited. Every finding is cross-referenced against the register's 19 rows (R-001 … R-019) and the 12 G-findings.

Read order followed `AGENTS.md` §1. `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, and ADR-011 … ADR-018 were not read.

Where something is unknown, it is written as unknown. This repository's own standard for that is `RISK_REGISTER.md` R-008 ("root cause remains UNDETERMINED"), R-013 ("UNMEASURED"), and `PHASE_1_DEBT_CLOSURE.md` D-6 (an investigation closed on a failure to reproduce) — an honest unknown outranks a confident guess.

---

## Findings

### F-1 — `CLAUDE.md`'s risk roll-call is stale

**Verdict: CONFIRMED.**

`CLAUDE.md:21` currently reads, verbatim:

> `RISK_REGISTER.md` roll-call (13 rows): **CLOSED** R-001, R-007, R-009 · **RESOLVED** R-002 · **ACCEPTED** R-003 · **PARTIALLY CLOSED** R-005 …

The register now holds 19 rows:

```
$ grep -c "^| R-0" RISK_REGISTER.md
19
$ grep -o "^| R-[0-9]*" RISK_REGISTER.md | tr -d '| '
R-001 R-003 R-002 R-004 R-005 R-006 R-008 R-009 R-010 R-007 R-011 R-012 R-013 R-014 R-015 R-016 R-017 R-018 R-019
```

**When and how it went stale — the more useful fact.** `PHASE_2_ENTRY_REVIEW_2026-08-28.md` §4 verified this same roll-call word-for-word against all 13 rows and recorded it as accurate. That verification was correct when made. It went stale a few hours later, on the same calendar date, when the G-findings pass added R-014 … R-019 to the register and — correctly, per its own scope, which forbade editing `CLAUDE.md` — did not update the roll-call. Both commits show the same last-touched commit for the two files (`57beff2`), and the six new rows are uncommitted working-tree changes, so the drift exists entirely between `CLAUDE.md` as committed and `RISK_REGISTER.md` as it now stands.

This is not a process failure so much as an unowned coupling: `CLAUDE.md`'s roll-call duplicates a count and a status list that live authoritatively in `RISK_REGISTER.md`, with nothing mechanical keeping the two in step. Any pass that adds a register row silently invalidates the entry-point document every future session reads first. The count is the visible symptom; the duplication is the cause.

**Severity: MODERATE.** Not a correctness risk, but `CLAUDE.md` is the first thing loaded into every session's context, and it now understates the open-risk surface by six rows — precisely the "read the row before assuming a gap is unknown" instruction that same line gives.

**Blocks:** nothing technically; it degrades every future session's starting picture.
**Who decides:** maintainer — whether to re-sync the line, reduce it to a pointer without counts, or accept periodic drift.
**Cross-reference: NEW.** Not covered by any R-nnn or G-n row. (`PHASE_2_ENTRY_REVIEW_2026-08-28.md` §4 recorded the opposite conclusion, correctly, at an earlier point in the same day.)

---

### F-2 — The PostgreSQL connection pool is entirely unconfigured

**Verdict: CONFIRMED.**

`platform/db/pool.ts` in full — six lines, quoted complete:

```ts
import { Pool } from "pg";
import type { DbConfig } from "../config.js";

export function createPool(config: DbConfig): Pool {
  return new Pool({ connectionString: config.connectionString });
}
```

No `max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, or `allowExitOnIdle`. `platform/db/init/001_roles.sql` was read in full: it creates both roles and grants, and sets no `statement_timeout` or `idle_in_transaction_session_timeout` on either. The absence across the whole tree:

```
$ grep -rn "statement_timeout\|idle_in_transaction\|max:\|connectionTimeoutMillis\|idleTimeoutMillis\|allowExitOnIdle" --include=*.ts --include=*.sql .
(no output)
```

**What ADR-021 actually says, quoted because the finding asks whether sizing is specified** — `02_ADR_INDEX_NORMATIVE_DECISIONS.md:813`, ADR-021 item 6:

> **Connection pooling.** Because context is transaction-local, an external pooler in transaction mode is compatible, but statement mode is **forbidden**. The application maintains its own pool; the pooler configuration must be documented and asserted in the deployment checklist.

ADR-021 therefore requires the application to maintain its own pool (it does) and requires the *pooler* configuration to be documented and asserted in a deployment checklist — it specifies **no sizing, no timeout, and no ceiling** for the application's own pool. The ADR is silent, not violated.

The consequence is real and arithmetically concrete: `platform/db/connections.ts` builds two pools per process (`APP_DB`, `AUDIT_DB`), each at `pg`'s default `max: 10` — 20 connections per instance that nobody chose. Every capability opens a transaction through `withTenantContext`; with no `statement_timeout` server-side, a single slow query holds its connection with no ceiling at any layer.

**Severity: MODERATE now, BLOCKING before production.** Nothing in Phase 1 or in Phase 2's first items is likely to exercise it, and there is no production traffic. But this is the substrate F-3's hypothesis rests on, and it is the kind of gap that is invisible until it is an incident.

**Blocks:** nothing in the current phase; it is a production-readiness gap, not a Phase 2 entry gap.
**Who decides:** maintainer for the policy (target pool size, timeout values, and whether they belong in `config.ts` or the deployment checklist ADR-021 item 6 already names); implementer to apply it.
**Cross-reference: NEW.** No R-nnn or G-n row covers pool sizing or statement timeouts. Adjacent to, but distinct from, R-010/G-9's observability gap — this is about ceilings, those are about visibility.

---

### F-3 — An untested hypothesis for R-008 that D-6's investigation never named

**Verdict: HYPOTHESIS — UNTESTED. Confirmed that D-6 never considered it.**

`vitest.config.ts` in full:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/**/*.spec.ts", "modules/**/*.spec.ts", "platform/**/*.spec.ts", "apps/**/*.spec.ts"],
    reporters: "default",
  },
});
```

No `fileParallelism`, `poolOptions`, `maxConcurrency`, or `testTimeout` — Vitest's defaults apply, including file-level parallelism across worker processes. Thirteen spec files under `apps/api/` construct an app through `createTestApp`:

```
$ grep -rl "createTestApp" apps/api/ | grep "\.spec\.ts$" | wc -l
13
```

(A bare `grep -rl "createTestApp" apps/api/` returns 16; the extra three are `app.module.ts`, `create-app.ts`, and the factory itself, which reference the name without constructing anything. The distinction is recorded because the first count was the one this review reached for initially, and it was wrong.)

`apps/api/test-support/create-test-app.ts` compiles the full `AppModule` each time, so each of those 13 files constructs its own pair of unbounded pools (F-2).

**Confirmed absence from the existing investigation.** `PHASE_1_DEBT_CLOSURE.md` D-6 and the R-008 entries in `decisions/` were grepped for `parallel|pool|max_connections|fileParallelism|concurren`. D-6's matches are all the word "concurrent" describing the *test scenario* (two concurrent revoke requests) — never test-runner parallelism or connection-pool state. The decision-log matches are unrelated (the rate limiter's rejected `setInterval`, and Argon2's `parallelism` parameter). `git grep -c "max_connections" | wc -l` → `0`: the phrase appears nowhere in the repository. D-6 tested and refuted the deadlock hypothesis (`pg_stat_database.deadlocks` unchanged across 150 attempts) and could not reproduce in 165 attempts; connection-pool saturation or acquisition stalls appear nowhere in it.

**A counter-argument this review found, stated because it weakens the hypothesis and omitting it would be dishonest.** Vitest's default worker count scales with CPU count, so a *higher*-core machine runs *more* spec files simultaneously and opens *more* pools. The maintainer's machine is very likely to have at least as many cores as a standard 2-core GitHub runner. If pool exhaustion were the mechanism, the failure would be expected to reproduce more readily locally, not less — and D-6's 15 full-suite local runs produced zero anomalies. That is the opposite of what this hypothesis predicts. It does not refute the hypothesis (runner I/O latency, container `max_connections`, and pool *acquisition timing* under a slower filesystem all differ independently of core count), but it materially lowers its prior, and the hypothesis should not be presented as the leading candidate.

**One teardown detail, checked and found clean.** 13 of the 14 `apps/api/*.integration.spec.ts` files call `app.close()`. The fourteenth, `concurrency-conflict.integration.spec.ts`, never creates an app at all — it uses `createDb` directly and calls `db.destroy()` — so its absence is correct, not a leak. Every file that constructs an app closes it. No pool-leak-on-teardown finding survives here.

**The cheap, falsifiable next test, named and not run** (in the spirit of R-013 naming its own unapplied alternative): one CI run with `fileParallelism: false`, and one with `pg_stat_activity` sampled during the suite, would separate "concurrency of the runner" from "concurrency of the scenario" for roughly the cost of two CI runs. If the failure persists single-file, this hypothesis is dead and R-008's search space narrows usefully. **No experiment was run and no fix was applied here**, per this task's scope.

**Severity: OBSERVATION.** A named, cheap, falsifiable next step for an existing OPEN risk — not a finding in its own right.

**Blocks:** nothing.
**Who decides:** implementer, whenever R-008 is next picked up.
**Cross-reference: NARROWS R-008.** It adds one unconsidered candidate mechanism and one cheap test to an OPEN row whose root cause is explicitly UNDETERMINED. It does not contradict D-6, whose refutation of the deadlock hypothesis stands untouched.

---

### F-4 — No test-coverage measurement exists anywhere

**Verdict: CONFIRMED.**

`package.json` was read in full. `scripts` contains `typecheck`, `build`, `check:dist-deps`, `format`, `format:check`, `lint`, `conformance`, `graph`, `openapi`, `test`, `test:watch`, `db:migrate`, `start:dev`, `start` — no coverage script. `devDependencies` lists no `@vitest/coverage-v8`, `c8`, or `nyc`. `vitest.config.ts` (quoted in full under F-3) has no `coverage` block. The only occurrence of the string in the entire tree is an English word in a comment:

```
$ grep -rn "coverage" --include=*.ts --include=*.json --include=*.yml . | grep -v node_modules
./apps/api/auth-login-rate-limit.integration.spec.ts:85:  // no added coverage.
```

"401 tests across 42 files" is a count of cases, not a measure of what they reach. Nothing identifies an untested branch.

**Assessed against this repository's own rule** — `AGENTS.md` §7: *"A feature that works but has no test at the layer where its rule lives is not done."* That rule is currently enforced by review discipline alone, and this repository's discipline on it has been unusually good (the layering in `AGENTS.md` §8 is visibly followed). But nothing measures whether it holds, and Phase 2 is substantially larger than Phase 1. Worth noting honestly in both directions: line coverage is a weak proxy for §7, which is about the *layer* a test sits at, not the lines it touches — a 100%-covered codebase can still violate §7 completely. Coverage tooling would measure something adjacent to the rule, not the rule.

**Severity: MODERATE.**

**Blocks:** nothing directly.
**Who decides:** maintainer — whether to add coverage tooling at all, given that it measures a proxy rather than §7 itself.
**Cross-reference: NEW.**

---

### F-5 — Observability is two inconsistent logging paths and nothing else

**Verdict: CONFIRMED, with the question it poses answered: partly covered by R-010, not fully.**

Two paths, both confirmed by reading:

- `apps/api/logging.middleware.ts:21` — `console.log(JSON.stringify(entry))`, one line per request, carrying `requestId`, `correlationId`, `tenantId`, `method`, `path`, `status`, `durationMs`.
- `modules/capability/interfaces/http-exception.filter.ts:38` and `modules/capability/interfaces/capability-attempt.ts:8` — both `new Logger(...)`, NestJS's own.

`ls platform/` returns `clock.ts`, `config.ts`, `db/`, `http/`, `rate-limit/` — no `observability/`. No shared log-level control, no field redaction, no trace/span propagation into the database layer, no metrics endpoint (confirmed in the prior entry review: `/health` deliberately carries neither the rate-limit nor the audit-failure counter).

**The two document requirements, quoted and separated, because they are not the same requirement.** `08_PHASE_1_BRIEF.md:54`, §2 step 10: *"structured logging with `requestId`, `correlationId`, `tenantId`"* — **met**, and the middleware's own doc comment cites that exact clause. `06_IMPLEMENTATION_PLAN.md:43`, Phase 1 item 12: *"audit events and structured observability."* The gap between "structured logging exists" (met) and "structured observability exists" (not met) is real: the former is one formatted line per request, the latter conventionally implies metrics, traces, and a consumer. `06` does not define the term, so how large that gap is is genuinely ambiguous rather than simply open — recorded as ambiguity, not resolved.

**Answering the finding's own question on R-010 coverage:** partly. R-010 covers exactly one failure mode (audit-write failures) and states its own limit precisely — detectability exists (a structured event plus an in-process counter), alerting does not. It says nothing about log-level control, redaction, trace propagation, or metrics for anything else. G-9 covers the ADR-010 dimension (RPS, p95, DB CPU) and is likewise narrower than this. What is *not* covered by either: the inconsistency between the two logging paths, and the absence of redaction.

**Severity: LOW.** Almost all of the consequential surface is already tracked under R-010 and G-9; the genuinely new residue is small.

**Blocks:** nothing.
**Who decides:** maintainer, whenever real observability is built — R-010 already names this signal as one of its first consumers.
**Cross-reference: WIDENS R-010 slightly; overlaps G-9.** The new content is the two-paths inconsistency and the missing redaction, not the alerting gap.

---

### F-6 — The implemented `CapabilityDefinition` is a subset of the contracted one, guarded only by prose

**Verdict: CONFIRMED.**

`05_API_CAPABILITY_CONTRACTS.md` §5 and `modules/capability/domain/capability-definition.ts` were read side by side, field by field:

| §5 contract field | Optional in §5? | Implemented? | Where justified |
|---|---|---|---|
| `id` | no | yes | — |
| `version` | no | yes | — |
| `inputSchema` | no | yes | ADR-033 |
| `outputSchema` | no | yes | ADR-033 |
| `requiredPermissions` | no | yes | — |
| `requiredEntitlements` | **yes** (`?`) | **no** | file doc comment |
| `quota` | **yes** (`?`) | **no** | file doc comment |
| `risk` | no | yes | — |
| `approval` | **no** | **no** | file doc comment |
| `idempotent` | no | yes | see F-7 |
| `audit` | no | yes | — |
| `requiresServingSubscription` | **no** | **no** | file doc comment |
| `storeScoped` | no | yes | ADR-002 |
| `emitsEvents` | **yes** (`?`) | **no** | file doc comment |
| — | — | `route` **added** | ADR-033 |
| — | — | `errorCodes` **added** | ADR-033 item 6 |

Five of fourteen contracted fields are unimplemented, two of them (`approval`, `requiresServingSubscription`) non-optional in §5; two fields exist in code that §5 does not list, both justified by ADR-033, which post-dates §5. The omissions are deliberate and well-argued — the file's own doc comment: *"Fields whose supporting machinery does not exist yet … are deliberately omitted rather than declared-and-ignored — declaring a field nothing enforces is the 'documentation, not architecture' failure ADR-030 warns about."* That reasoning is sound and this review does not dispute it.

**The gap is the guard, not the omission.** No conformance rule ties the TypeScript type to §5's shape:

```
$ git grep -n "requiredPermissions\|storeScoped" -- tools/conformance/rules/ | wc -l
0
```

`tools/conformance/rules/error-codes.ts:72` matches `export const (\w+)\s*:\s*CapabilityDefinition` — it locates capability definitions to check their *error codes*, and never inspects the type's field set. So when Phase 2 adds entitlements or quota, nothing mechanically notices a partial, misspelled, or divergent addition.

**Assessed against `AGENTS.md` §2's own thesis** — *"Rules expressed only as prose are not enforceable on a long task. The golden path plus the CI harness are the real contract."* By that sentence's own standard this is a real gap: the correspondence between §5 and the implemented type is currently prose in one file's doc comment. The mitigating fact, stated fairly: the doc comment is unusually explicit and sits in the exact file anyone adding a field would open. The aggravating fact: `AGENTS.md` §2 exists precisely because that is not sufficient over a long task, and Phase 2 is long.

**Severity: MODERATE.**

**Blocks:** nothing today. It becomes live at Phase 2 item 6 (entitlement resolution) and item 7 (quota), the first work that would add these fields.
**Who decides:** maintainer — whether a conformance rule should assert the type against §5, and in which direction (superset, subset, or exact).
**Cross-reference: NEW**, though adjacent to R-017/G-5 (how `runCapabilityAttempt` and ADR-009 compose). Both are about Phase 2 extending Phase 1's capability machinery with no mechanical guard on the extension.

---

### F-7 — The published idempotency contract disagrees with shipped behaviour

**Verdict: CONFIRMED WITH CORRECTION. The finding's central factual claim about the code is wrong, and its severity is materially lower than stated.**

**Correction 1 — "Each capability file correctly declares `idempotent: false`" is false.** `auth.logout_all` declares `idempotent: **true**` (`modules/identity/interfaces/auth-logout-all.capability.ts:35`), and its doc comment explains why, at length:

> `idempotent: true` matches 05 §4.1, and — unlike every earlier capability this codebase has recorded an ADR-009 divergence for — genuinely needs none here: there is no idempotency STORE backing this (Phase 2, ADR-009), but the underlying operation ("revoke every ACTIVE session for this user") is naturally idempotent regardless — calling it again after it has already run finds zero ACTIVE sessions left and revokes zero, every time, with no side effect that compounds.

So the divergence is **five of six**, not six of six: `organization.create`, `membership.invite`, `membership.revoke`, `membership.role.assign`, and `store.create` all declare `false` against §4.1's `yes`; `auth.logout_all` declares `true` and genuinely is. Each of the five carries its own doc comment recording the divergence, and the decision log records it (`organization.create` was the first).

**Correction 2 — the generated, committed artifact is silent, not dishonest.** The finding asks whether `openapi.json` inherits §4.1's claim. It does not:

```
$ grep -c "idempot" openapi.json
0
```

The artifact a client would actually consume makes **no idempotency claim at all**. The optimistic `yes` lives only in `05_API_CAPABILITY_CONTRACTS.md` §4.1 — an internal normative design document, not the published API surface. `05` §1's own rule (*"Writes that can be retried accept `Idempotency-Key` or an application-level equivalent"*) is likewise not published to clients, and `grep -rni "idempotency" --include=*.ts` finds no `Idempotency-Key` header handling anywhere in `apps/`, `modules/`, or `platform/` — confirming the store genuinely does not exist.

**What remains true, and it is the part that matters.** The *behavioural* gap is real: a client retrying `POST /api/v1/organizations` after a timeout does create two organizations today. That is not a documentation defect; it is the absence of ADR-009's store, which is `06`'s Phase 2 item 3 — scheduled, not forgotten, and already tracked. §4.1's `yes` reads as a target state, and every implementing file says so explicitly.

**Severity: LOW.** The published contract is silent rather than wrong; the divergence is documented in five files and the decision log; the fix is a scheduled Phase 2 item.

**Blocks:** nothing beyond what Phase 2 item 3 already addresses.
**Who decides:** already decided and recorded; the implementer of item 3 flips the five declarations when the store exists.
**Cross-reference: NARROWS R-017 (G-5).** R-017 tracks *how* ADR-009's claim composes with `runCapabilityAttempt`; this adds the concrete list of which five declarations flip when it does, and the useful negative fact that `openapi.json` needs no correction.

---

### F-8 — Rate limiting covers one capability out of ten

**Verdict: CONFIRMED.**

Every call site, complete:

```
$ grep -rn "RATE_LIMIT_STORE\|recordAttempt\|RateLimitStore" --include=*.ts apps/ modules/ platform/ | grep -v spec.ts
apps/api/app.module.ts:18,19,53        (DI registration)
modules/identity/interfaces/auth-login.controller.ts:8,9,92,154,155
platform/rate-limit/*.ts               (the mechanism itself)
```

`auth-login.controller.ts` is the only consumer. Nine of the ten capability routes — including `membership.revoke`, whose own `CapabilityDefinition` declares `risk: "HIGH_WRITE"` — have no limit of any kind, and nothing anywhere reads `CapabilityDefinition.risk` to decide one (the field is declared and used only for documentation and OpenAPI generation).

**Answering the finding's own question on R-005 coverage: this is a distinct, unrecorded gap.** R-005 is scoped to the *store's* single-instance limitation and says so explicitly in its own closing text: *"Also not done: no rate limiting on any capability other than `auth.login` — ADR-029 item 2 only names login attempts, and this task was scoped to closing exactly that gap, not to a platform-wide throttling rollout."* So the coverage gap is **named** inside R-005's mitigation cell but is not what R-005 tracks, and no row tracks it. The distinction matters because the two have different triggers: R-005's is "more than one instance runs"; this one's is "a non-login capability needs throttling," which no document currently asserts.

Worth stating fairly: no normative document currently *requires* throttling beyond login. ADR-029 item 2 names failed login attempts only. `01_ARCHITECTURE_BASELINE_RFC.md:539` ("Rate limiting per tenant, per user and per IP") is broader but is an architecture-baseline statement, not a per-capability requirement. So this is a gap against a general expectation, not against a specific clause — which is why it belongs in a review rather than as a violation.

**Severity: MODERATE.**

**Blocks:** nothing today; the platform is not internet-facing.
**Who decides:** maintainer — whether throttling generalizes (e.g. driven by `risk`) or stays per-capability and deliberate.
**Cross-reference: NEW, adjacent to R-005.** Named inside R-005's text, tracked by no row.

---

### F-9 — No pagination pattern exists, and the first list capability arrives in Phase 2

**Verdict: CONFIRMED.**

`05_API_CAPABILITY_CONTRACTS.md:12`, §1: *"Pagination, filtering and sorting are explicit per endpoint."* Every implemented READ capability is single-resource (`store.read`, `organization.switch`). The absence:

```
$ grep -rn "limit\|cursor\|offset\|page" --include=*.capability.ts --include=*.schema.ts modules/ apps/
(no matches other than rate-limit constants, excluded)
```

`plan.list` and `invoice.list` (§4.2) and `domain.list` (§4.4) are contracted. There is no golden-path example a list capability can mirror, and `AGENTS.md` §2 requires mirroring rather than inventing — so the first list capability's implementer is placed in exactly the position §2's third clause anticipates: *"If your feature cannot be expressed in that structure, stop and document the mismatch."*

**One sharpening the finding understates.** `06` Phase 2 item 1 is "plan and plan version," and `05` §4.2's first commercial capability is `plan.list`. Depending on how item 1 is sliced, the very first Phase 2 capability may be a list capability — meaning this lands immediately, not later in the phase.

**Severity: MODERATE.**

**Blocks:** potentially `06` Phase 2 item 1 itself, if that item surfaces `plan.list`.
**Who decides:** maintainer — pagination style (cursor vs. offset) is a platform-wide contract decision with an obvious option space, and `05` §1 requires it be explicit per endpoint without saying what "explicit" looks like. Naming the options neutrally: keyset/cursor, offset/limit, or per-capability choice. This review does not pick one.
**Cross-reference: NEW.** Not covered by R-014 (the missing Phase 2 brief) except insofar as a brief would be the natural place to settle it.

---

### F-10 — `store.update` is contracted and built nowhere

**Verdict: CONFIRMED — re-confirmed still true, and deliberately not restated.**

Already recorded as **G-10** in `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md`. Re-verified rather than assumed:

```
$ grep -rn "store\.update" --include=*.ts apps modules platform tools | wc -l
0
$ grep -rln "store\.update" --include=*.md .
./05_API_CAPABILITY_CONTRACTS.md
./decisions/2026-08.md
./PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md
```

Still absent from all code and from every phase list; the only new mentions are G-10's own record and the decision-log entry recording it. G-10's reasoning — argued as a real gap but not a risk-register item, because nothing depends on `store.update` existing and it carries no correctness risk today — still holds unchanged. No duplicate finding is created here.

**Severity: LOW.**
**Cross-reference: ALREADY COVERED by G-10.**

---

### F-11 — No object/media storage port exists in any phase list

**Verdict: CONFIRMED WITH CORRECTION.**

**The correction:** the finding asks whether storage is among `03_TECHNICAL_BLUEPRINT.md` §9's extraction seams. **It is.** `03_TECHNICAL_BLUEPRINT.md:211`, §9 in full:

> Keep behind contracts from day one: payment providers, notification providers, **object storage**, queue transport, AI providers, search, DNS, CDN, certificate issuance, external channels.

`03:56` additionally lists `files/  object storage metadata` in its directory layout, and `04_DATABASE_BLUEPRINT.md` §2.6 declares a `files` table. So storage is named normatively in three places — the finding's implication that it might be unmentioned is wrong.

**What is confirmed:** no port exists (`platform/` has no `storage/`; no storage-related import appears anywhere in `apps/`, `modules/`, or `platform/`), and no phase list delivers one. `06` Phase 3 was read in full — *"Product, Variant, Category, Attribute, Brand, Pricing, Inventory with reservation, Customer with store-scoped identity, Cart, Checkout, Order with controlled lifecycle, Coupon, Shipping and Tax baseline, Commerce payment through the same port with store-scoped credentials"* — no file or image storage. `06` Phase 4's nine ordered items include *"pages: home, listing, detail, category, search, cart, checkout, account, orders"* and a cache strategy, but no storage item; ADR-019 item 5 (*"Product images and theme assets are served from object storage through the CDN"*) assumes one exists by Phase 4.

So: a required seam, a declared table, and an ADR that depends on it, with no phase scheduled to build it. That is a genuine scheduling gap, materially stronger than "nobody mentioned storage."

**Severity: LOW today, MODERATE by Phase 3.** Two full phases away from the current work.

**Blocks:** `06` Phase 3 (product images) and Phase 4 (ADR-019 item 5), neither imminent.
**Who decides:** maintainer, when Phase 3 is scoped.
**Cross-reference: NEW.** Structurally the same shape as R-019/G-8 (an ADR-declared obligation with no corresponding item in a phase list) but for a different obligation and a later phase.

---

### F-12 — No locale/i18n contract, in a product whose own examples are Persian

**Verdict: CONFIRMED, and the finding's own closing suggestion is the correct framing.**

`05_API_CAPABILITY_CONTRACTS.md:11`, §1: *"Stable machine-readable errors: `code`, `message`, `details`, `requestId`."* §2's `TenantContext` (lines 24-33, read in full) carries `tenantId`, `userId`, `requestId`, `correlationId`, `storeId?`, `actorType` — **no locale**. `modules/capability/domain/capability.errors.ts`'s `CapabilityError` takes a free-text `message: string`, and `modules/capability/interfaces/http-exception.filter.ts` returns it verbatim in the envelope (`message: exception.message`). No locale, i18n, or `Accept-Language` handling exists anywhere:

```
$ grep -rni "locale\|i18n\|accept-language\|translat" --include=*.ts apps/ modules/ platform/ | grep -v spec.ts
(two matches, both false positives: the word "translates" in a comment, and String.localeCompare in migration sorting)
```

Meanwhile `05:231`, §6.4's own worked example is a Persian IDN hostname — `{ "hostname": "فروشگاه.example", "type": "APEX" }` — and `00_PLATFORM_OVERVIEW.md` describes a merchant-facing product.

**The finding's own question, answered: `05` does not say whether `message` is human-facing or developer-facing, and that silence is the real gap.** The evidence points both ways and genuinely does not resolve. Toward developer-facing: `code` is described as the stable machine-readable element, `message` is never described as displayable, and the filter's own generic strings ("An unexpected error occurred.") are operator-shaped, not end-user-shaped. Toward human-facing: `CapabilityError`'s messages at real call sites are specific and readable, and nothing marks them internal-only. Recorded as **ambiguity, not resolved** — per `AGENTS.md` §5 and this task's instruction to say so rather than pick.

Note that the missing translation layer is a *consequence* of that silence, not the defect itself: if `message` is developer-facing, no translation layer is owed, and a locale in `TenantContext` would be premature. Deciding the audience decides whether anything is missing at all.

**Severity: OBSERVATION.** A documentation silence with a real downstream consequence, not a defect in shipped behaviour.

**Blocks:** nothing now. It becomes consequential at the first merchant-facing UI, and expensive to reverse after error messages have been consumed by clients.
**Who decides:** maintainer — this is a contract question about `05` §1, not an implementation choice.
**Cross-reference: NEW.**

---

### F-13 — No committed schema snapshot, therefore no drift detection against a live database

**Verdict: CONFIRMED WITH CORRECTION — partially refuted on scope, confirmed on the core claim.**

`tools/conformance/rules/schema-live.ts` was read in full. What it **does**, against a real migrated database via `information_schema`/`pg_catalog`:

- flags more than one idempotency-like table (`SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE`);
- for every non-exempt table: requires a `tenant_id` column (`SCHEMA-MISSING-TENANT-ID`), requires `relrowsecurity` plus a `pg_policies` entry (`SCHEMA-MISSING-RLS`), and then requires `relforcerowsecurity` (`SCHEMA-MISSING-FORCE-RLS`);
- flags `real`/`double precision` columns whose names match `/amount|price|cost|total|balance|fee|money|charge/i` (`SCHEMA-FLOAT-MONEY-COLUMN`).

Critically, it **enumerates whatever tables exist** and applies rules to them. It compares nothing against a canonical expected schema. And no such canonical artifact is committed:

```
$ git ls-files | grep -i schema
tools/conformance/fixtures/… (6 rule fixtures)
tools/conformance/rules/schema-live.ts
tools/conformance/rules/schema.ts
```

No `schema.sql` dump exists.

**The correction:** this is a stronger control than "checks rules, not drift" implies. Because it enumerates live tables, a rogue table added out-of-band **is** caught — provided it lacks `tenant_id`, RLS, FORCE, or a policy, which any casually-added table would. So the highest-consequence drift for this platform (a tenant-owned table without isolation) is genuinely detected today, not merely assumed.

**What remains genuinely undetected**, and this is the real residue: a column added or dropped; a type changed (other than float-money); an index added, dropped, or changed; a constraint added or dropped; a default changed; a trigger added; and any table added out-of-band that *does* carry `tenant_id` + RLS + FORCE + a policy. None of those would raise a violation.

**Severity: LOW.** The dangerous subset is covered; the uncovered subset matters mainly if someone modifies a production database outside the migration path, which nothing in the current workflow does.

**Blocks:** nothing.
**Who decides:** maintainer, if ever — committing a generated `schema.sql` and diffing it in CI is the obvious option, at the cost of a regenerate step on every migration.
**Cross-reference: NEW.**

---

### F-14 — Data-driven RBAC is verified by a single test case

**Verdict: REFUTED as stated. The named test does not test what the finding says, and the coverage claimed missing largely exists elsewhere.**

**Correction 1 — the named file tests something else entirely.** `modules/authorization/infrastructure/role-catalog-agreement.spec.ts` was read in full. It contains exactly one `it()`, correctly counted, but that test asserts **agreement between `ROLE_KEYS` in code and the seeded `roles` table**, in both directions — not a permission matrix. Its own doc comment says so: *"the rule is about agreement between code and the LIVE seeded catalog … a key in `ROLE_KEYS` with no seeded row is a role the Zod schema accepts but `RoleGrantRepositoryPg` then rejects at runtime; a seeded row with no matching key in `ROLE_KEYS` is a role nothing in the API can ever name or assign."* Citing it as the RBAC verification is a category error: it is a catalog-consistency test, and one test case is the right number for it.

**Correction 2 — permission enforcement is tested, across the integration suites.** Denial assertions by file:

```
$ grep -rc "FORBIDDEN" apps/api/*.integration.spec.ts | grep -v ":0"
membership-invite.integration.spec.ts:8
membership-revoke.integration.spec.ts:6
membership-role-assign.integration.spec.ts:8
organization-switch.integration.spec.ts:5
store-create.integration.spec.ts:4
store-read.integration.spec.ts:3
```

34 `FORBIDDEN` assertions across six files, against real PostgreSQL — including explicitly role-differentiated cases (`membership-revoke.integration.spec.ts` asserts `FORBIDDEN` separately for an ADMIN caller and for a plain MEMBER caller on an owner-only capability). Per `AGENTS.md` §8, "Permission, entitlement, quota, approval" belongs in a capability policy test; these assertions sit at or above that layer, against the real guard chain.

**Correction 3 — a divergence the finding did not name, and which is more interesting than the one it did.** `00_PLATFORM_OVERVIEW.md:59` lists six roles: *"assign roles: Owner, Admin, Manager, Editor, Support, Viewer."* The implemented catalog is three, and one of them is not on that list — `modules/authorization/domain/role-key.vo.ts`: `export const ROLE_KEYS = ["owner", "admin", "member"] as const;`. Its doc comment treats three as current and deliberate (*"Adding a fourth role is a schema change … and a one-line change here"*). Since `00_PLATFORM_OVERVIEW.md` sits below the ADRs and `03`/`04`/`05` in `AGENTS.md` §1's authority order, and Phase 1 deliberately scoped to three roles, this is a documentation-vs-implementation divergence rather than a defect — but it is unrecorded anywhere, and a reader taking `00` at face value would expect six roles and a much larger matrix than exists.

**What is genuinely true, after all three corrections:** there is no single exhaustive role × permission × outcome matrix test. Whether one is owed is a real question — with three roles and a handful of permissions the matrix is small and largely covered case-by-case, and an exhaustive matrix becomes materially more valuable once Phase 2 adds entitlements on top. That is a judgment, not a gap.

**Severity: OBSERVATION** (for the unrecorded six-vs-three role divergence, which is the only new information here).

**Blocks:** nothing.
**Who decides:** maintainer, for whether `00_PLATFORM_OVERVIEW.md`'s six-role list should be reconciled with the implemented three.
**Cross-reference: NEW** (the role-count divergence only). The RBAC-undertested claim itself is REFUTED.

---

### F-15 — No secrets-handling port, immediately before the phase that introduces PSP credentials

**Verdict: CONFIRMED WITH CORRECTION — the finding's premise that no rule exists is wrong; the forward gap it points at is real.**

**The correction, quoted because the finding asks for it either way.** ADR-023 **does** specify credential storage. `02_ADR_INDEX_NORMATIVE_DECISIONS.md:934`, ADR-023 item 8:

> **Store-scoped credentials** are encrypted at rest, never returned by any read API, and never logged. A store operator may rotate them; rotation must not invalidate historical payment records.

And item 7 (line 932) requires two separate registries with platform-scoped and store-scoped credentials that *"must never be resolvable from the same context."* So encryption at rest, non-disclosure, non-logging, and rotation are all already normative — the rule is not missing, and any future work has a governing clause to implement against rather than a blank page.

**What is confirmed:** nothing implements any of it. `platform/config.ts` was read in full — every value is a plain environment variable read (`DATABASE_URL`, `AUDIT_DATABASE_URL`, `MIGRATE_DATABASE_URL`, `CONFORMANCE_TEST_DATABASE_URL`, `TRUST_PROXY`), with no encryption, no rotation, and no KMS/Vault seam. `tools/conformance/rules/secrets.ts` was read: it catches credential-shaped *literals in source* (AWS key ids, PEM blocks, assignment-shaped `api_key`/`password`/`token` literals of 8+ characters) — a real, working control against committing a secret, and unrelated to storing one safely at rest.

The forward gap is therefore precisely: `06` Phase 2 items 10-12 introduce a payment provider adapter whose credentials ADR-023 item 8 requires be encrypted at rest, and no mechanism exists to do that. The rule arrives before the machinery, which is the correct order — but the machinery has no scheduled item.

**Severity: MODERATE**, and rising sharply at Phase 2 item 11. This is the finding closest to a genuine BLOCKING classification: unlike most gaps here, shipping item 11 *without* resolving it would put the implementation in direct violation of an accepted ADR, not merely in an undefined space.

**Blocks:** `06` Phase 2 item 11 ("first provider adapter") cannot be completed in compliance with ADR-023 item 8 as written.
**Who decides:** maintainer — whether encryption-at-rest is a platform port now or is deferred with an explicit, recorded decision, the way this project has handled comparable deferrals (D-2's queue dependency, D-5's tables).
**Cross-reference: NEW, adjacent to R-015 (G-3).** R-015 tracks *when* a payment provider is chosen; this tracks *what must exist* before its credentials can be stored. Same phase items, different obligation.

---

### F-16 — `audit_events` has no partitioning or growth plan

**Verdict: CONFIRMED.**

Both audit migrations were read in full. `20260822090800_audit__create_audit_events.sql` creates the table with a single index — `CREATE INDEX audit_events_tenant_id_idx ON audit_events (tenant_id, occurred_at);` — plus RLS, FORCE RLS, and a tenant-isolation policy. No `PARTITION BY`. `20260822100100_audit__enforce_append_only.sql` adds `REVOKE UPDATE, DELETE ON audit_events FROM nexora_app`. Every capability attempt writes exactly one row via `runCapabilityAttempt`, on both the success and failure paths.

The word does not appear anywhere in the documentation pack:

```
$ grep -rni "partition" *.md
(no output)
```

**What ADR-020 actually covers, since the finding asks.** ADR-020 was read in full. Rule 4: *"Purge scope is tenant-owned data. Append-only records required for financial, tax or legal purposes are retained per the legal retention window and are excluded from purge."* Rule 5: *"Audit events recording the deletion itself are never purged."* So ADR-020 addresses audit records' **retention and their exclusion from purge** — it is explicitly a constraint *against* deleting them, and says nothing about managing the resulting growth. The two are in mild tension by design: ADR-020 guarantees the table only grows.

Worth noting fairly: at ADR-010's own V1 assumptions (up to 5,000 organizations, 50 admin RPS peak), audit growth is not a near-term operational problem, and the existing `(tenant_id, occurred_at)` index is the right one for the query shape a tenant-scoped audit view would use. This is a "decide before it is urgent" item, not a live defect.

**Severity: LOW.**

**Blocks:** nothing.
**Who decides:** maintainer, and not urgently — but note ADR-020 already commits the platform to never purging these rows, so the decision space narrows to partitioning, archival to cold storage, or accepting unbounded growth.
**Cross-reference: NEW.**

---

## Refuted, and why that is worth recording

- **F-14 is REFUTED as stated.** The named test file verifies role-catalog agreement, not permissions; permission enforcement is verified by 34 `FORBIDDEN` assertions across six integration suites against real PostgreSQL, including explicitly role-differentiated cases. Recording this matters because "RBAC is tested by one test" would, if carried forward uncorrected, have justified work that is largely already done.
- **F-15's premise is REFUTED**; its forward gap stands. ADR-023 item 8 already mandates encryption at rest, non-disclosure, non-logging, and rotation for store-scoped credentials. The useful reframing: the implementer of Phase 2 item 11 has a normative clause to build against, not an open design question — which makes the gap smaller *and* more clearly owed.
- **F-7's central factual claim is REFUTED.** `auth.logout_all` declares `idempotent: true`, not `false`; the divergence is five of six. And `openapi.json` contains zero occurrences of "idempot", so the published artifact is silent rather than dishonest — which is what drops this finding from the "published contract lies to clients" severity it was handed over at, to LOW.
- **F-11's and F-13's citations are partly REFUTED.** `03_TECHNICAL_BLUEPRINT.md` §9 does name object storage among the day-one contract seams; `schema-live.ts` does catch the highest-consequence class of live drift by enumerating real tables rather than trusting migration filenames.
- **One would-be finding died on inspection and is recorded so nobody re-raises it:** 13 of 14 `apps/api/*.integration.spec.ts` files call `app.close()`; the fourteenth (`concurrency-conflict.integration.spec.ts`) never constructs an app, using `createDb`/`db.destroy()` instead. There is no pool-leak-on-teardown defect.

## Duplicates of, or already covered by, existing rows

| Finding | Relationship |
|---|---|
| F-3 | **NARROWS R-008** — one unconsidered candidate mechanism plus a cheap falsifying test for a root cause that is explicitly UNDETERMINED |
| F-5 | **WIDENS R-010**, overlaps **G-9** — the genuinely new residue is the two-logging-paths inconsistency and missing redaction, not the alerting gap both rows already own |
| F-7 | **NARROWS R-017 (G-5)** — names the five declarations that flip when ADR-009's store lands, and establishes `openapi.json` needs no correction |
| F-8 | Adjacent to **R-005**, which names this coverage gap inside its own mitigation text but does not track it — the two have different triggers |
| F-10 | **ALREADY COVERED by G-10** — re-confirmed still true, deliberately not restated as a new finding |
| F-15 | Adjacent to **R-015 (G-3)** — same Phase 2 items, different obligation (when a provider is chosen vs. what must exist to store its credentials) |
| F-1, F-2, F-4, F-6, F-9, F-11, F-12, F-13, F-16 | **NEW** — no R-nnn or G-n row covers them |

## What this review did NOT check

Stated plainly, because an unverified area is not a passing area:

- **No experiment was run for F-3**, deliberately and per instruction. The pool-saturation hypothesis is recorded as untested, with a counter-argument that lowers its own prior. It is not a diagnosis and must not be cited as one.
- **No code was executed** beyond `typecheck`, `lint`, and `format:check`. The test suite, conformance harness, and migrations were not run — this pass changed no code, and the prior review (`PHASE_2_ENTRY_REVIEW_2026-08-28.md`) ran all three green against a from-empty database hours earlier.
- **Only the documents each finding named were read.** `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, and ADR-011 … ADR-018 were not read at all. `01_ARCHITECTURE_BASELINE_RFC.md` and `07_ARCHITECTURE_GAP_REPORT.md` were consulted only where a specific finding cited them. Phase 5+ documents were not read.
- **This is not an exhaustive architecture review.** Sixteen handed-over claims were tested; no independent search for a seventeenth was performed. A reviewer starting from the code rather than from this list would likely surface findings absent here.
- **Severity ratings are this review's judgment**, not measurements. F-2's production impact, F-8's exposure, and F-16's growth curve are all unquantified — no benchmark, no load test, and no production traffic exists to calibrate against.
- **The relationship between `00_PLATFORM_OVERVIEW.md`'s six-role list and the implemented three (F-14) was not traced through `03`/`04`/`05`** to determine whether an intermediate document already reconciles them. It is reported as an unrecorded divergence, not as a confirmed contradiction.

## Recommended sequencing for the follow-up sessions

Ordered by cost-of-delay, not by severity. This is a suggested order, not a decision — every item below still needs the maintainer's call on whether to act at all.

1. **F-1 (`CLAUDE.md` roll-call).** Minutes of work, and every subsequent session starts from a wrong picture until it is done. Do it first purely because it is cheap and compounding.
2. **F-15 (credential storage) and F-9 (pagination).** Both land on Phase 2 work that is imminent — F-15 on item 11, F-9 potentially on item 1 itself. Both are maintainer decisions that an implementer cannot make mid-slice, which is exactly the class of thing R-014's missing Phase 2 brief exists to settle. Sequencing them alongside that brief, rather than separately, is likely cheaper than either alone.
3. **F-6 (`CapabilityDefinition` guard) and F-2 (pool configuration).** Both are hardening with no live consequence today, and both get harder to retrofit as Phase 2 adds capabilities and load-bearing paths. F-6 in particular should land *before* the first capability that adds an entitlement field, not after.
4. **F-8 (rate-limit coverage), F-4 (coverage tooling), F-13 (schema snapshot), F-16 (audit growth).** Real, low-urgency, and each independently deferrable with an explicit trigger — the pattern this project already uses well (D-2's queue dependency, R-005's Redis swap, R-012's `TRUST_PROXY`).
5. **F-3 (R-008 hypothesis).** Only when R-008 is next actively worked. Two CI runs would falsify it cheaply; running them outside a focused R-008 session would produce a data point nobody is positioned to interpret.
6. **F-12 (message audience), F-14 (role-count divergence), F-5 (logging paths), F-11 (storage port).** Record-and-defer. F-11 gets scheduled when Phase 3 is scoped; the other three are documentation reconciliations with no forcing date.

F-7 and F-10 need no follow-up: F-7 resolves itself when Phase 2 item 3 ships, and F-10 is already recorded as G-10 with reasoning that still holds.
