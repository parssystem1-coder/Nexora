# SESSION 15 — Close the last two open ADRs: what the pool may do, and what the platform may say about itself

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`) —
> use the native PostgreSQL 17.5 the test suite uses, and say so.
> **This session may write one test and one conformance-rule entry. No migration,
> no table, no feature code, no new dependency installed.**
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session

ADR-039 and ADR-040 are the last two `OPEN` ADRs. Neither blocks a Phase 2
migration, which is exactly why they have survived — and both become expensive at
the same moment, the first deployment that carries real traffic or runs a second
instance.

ADR-039 also hides something that is **not** an operational nicety. `ADR-021`
requires tenant isolation to work through a session setting on a pooled
connection. **A pooled connection that carries one request's tenant context into
the next request's checkout is a cross-tenant read** — the same class of defect
Session 9 found in partitioning, reached by a different route. Part A treats it
that way.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7, §8
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-039 and ADR-040 in full,
   including their option lists**; **ADR-021 in full** (the RLS session handling is
   Part A's whole subject); **ADR-010** (the scale assumptions that are Part A's
   only numeric input); **ADR-034** (audit placement — Part B ties to it);
   **ADR-035**; **ADR-037** (item 3, what may never be written); **ADR-042**
   (error audience); **ADR-057** (the buyer identity recorded two sessions ago —
   Part B's "never log" list now has personal data in scope for the first time);
   **ADR-030**
3. `PHASE_2_BRIEF.md` §5 — "Tenancy and RLS", "Module boundaries", "Credentials"
4. `platform/db/` **in full** — the pool construction, the connection acquire and
   release path, and every place `app.tenant_id` is set or read. Part A cannot be
   written without this.
5. `tools/conformance/rules/` — specifically the rule that forbids a `domain` file
   from importing the query builder, driver, NestJS, React or a provider SDK.
   **Part B proposes adding one name to that list; you must see how the list is
   expressed before proposing it.**
6. `RISK_REGISTER.md` — **R-039** and any row about pooling, connections, timeouts,
   logging or observability
7. `package.json` — what logging dependency, if any, is already present

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — Establish, before any ruling

**1.1** How does the application set the tenant context today? Quote the call.
**Specifically: is it `set_config(..., is_local => true)` — transaction-scoped — or
session-scoped?** ADR-021 uses `current_setting('app.tenant_id', true)` on the read
side, where that second argument is `missing_ok` and says nothing about scope. The
write side is what decides this, and it is the whole of Part A2.

**1.2** What is the pool's configured size today, and where does the number come
from — a config value, a default, or a literal?

**1.3** Is any logger present in `package.json` or imported anywhere? Report
honestly, including "none". Session 11 found far more already built than expected;
do not assume this is a greenfield.

---

## Step 2 — Part A: rule ADR-039

### A1 — The ADR asked for a number. It gets a derivation instead, and that is the ruling.

A pool size written as a constant is wrong the first time anything about the
deployment changes. Rule the **relationship**, and let the number fall out of it:

> **The database's `max_connections` is the budget. Every connecting process draws
> from it.** Per-instance pool size is
> `floor((max_connections − reserved) / max_application_instances)`, where
> `reserved` covers superuser slots, the migration role, and any monitoring
> connection.

Two obligations that make this real rather than arithmetic:

1. **The application refuses to start** if its configured pool size, multiplied by
   the configured instance count, exceeds the budget. ADR-023 item 1 already
   establishes this shape for the platform — *"Any code path that assumes an
   unavailable capability must fail at startup with a configuration error, not at
   runtime with a customer-facing failure."* The same principle, applied to a
   resource instead of a capability.
2. **A larger pool is not a faster system**, and the ADR should say so once so
   nobody "fixes" latency by raising it: past the database's real concurrency,
   more connections add context-switching and lock contention, not throughput.
   ADR-010's assumptions — restate them from the ADR, do not take them from here —
   are the only sizing input the project actually has, and they should be cited as
   assumptions rather than measurements.

### A2 — The cross-tenant hazard, which is the part that matters most

If the tenant setting is **session-scoped**, it survives the transaction. A pooled
connection then returns to the pool still carrying it, and the next request that
checks out that connection — possibly for a different tenant, possibly for no
tenant at all — inherits it. Every RLS policy in the platform reads that setting.

**Rule it, then prove it:**

> The tenant context is **transaction-scoped**. It is set inside the transaction
> that uses it, and no connection is ever returned to the pool carrying a tenant
> setting.

**Write the proving test.** This is the one piece of code this session may add:

- acquire a connection, set a tenant context, run a query, release it
- acquire again — looping if necessary until the same underlying connection comes
  back — and assert `current_setting('app.tenant_id', true)` is **null or empty**
- then assert that a tenant-owned table returns **zero rows** in that state, which
  is the property that actually matters

Follow `AGENTS.md` §8's test layering. **If Step 1.1 shows the setting is already
transaction-scoped, the test is still written** — it is the regression guard, and
ADR-030's standard is that a check nobody has watched fail is not evidence. If the
setting is session-scoped, **stop and report before changing anything**: that is a
live cross-tenant defect and it needs a risk row and the maintainer's attention,
not a quiet fix inside a documentation session.

### A3 — Four timeouts, each with the failure it prevents

Rule all four. A timeout without a stated failure mode gets tuned away by the first
person who hits it:

| Setting | Prevents |
|---|---|
| `statement_timeout` | one slow query holding a connection until the pool is exhausted and every tenant is down |
| `idle_in_transaction_session_timeout` | a leaked transaction pinning a connection **and its tenant setting** indefinitely — the ADR should note this one interacts directly with A2 |
| `lock_timeout`, **set for the migration role specifically** | a migration queueing behind a long read, then blocking every write behind itself. Under a forward-only migration rule this turns a slow deploy into an outage. |
| a request-scoped deadline shorter than the HTTP timeout | a client that has already given up leaving work running and a connection held |

State where each is set — role default, connection string, or per-transaction — and
say which are the same value in every environment and which are not.

### A4 — Revisit trigger

ADR-039's own `Blocks` cell already names it: *the first deployment carrying real
traffic, or the first second instance.* Keep that, and add what must be **measured**
at that moment, so the revisit has an input rather than an opinion: peak concurrent
checkouts, checkout wait time, and how often the pool is saturated.

---

## Step 3 — Part B: rule ADR-040

### B1 — What is actually being decided

ADR-040 is titled *Observability Boundary*, so the ruling is about the boundary
first and the library second. Rule both, in that order, and do not let the library
choice swallow the ADR.

### B2 — The boundary

1. **Logging is a port.** No `domain` file and no `application` file imports a
   logging library. The logger is injected at the interface and infrastructure
   layers, exactly as ADR-023 item 9 confines provider SDKs to adapters.
2. **Propose adding the logger to the existing conformance rule** that already
   forbids a `domain` file from importing the query builder, driver, NestJS, React
   or a provider SDK. Step 0 required you to read how that list is expressed.
   **If adding to it is a one-line change with an existing failing-fixture pattern,
   make it. If it is not, record it as owed with a named trigger and say why** —
   do not invent a new rule mechanism inside a documentation session.
3. **Metrics and traces are deferred**, with the same trigger as ADR-039: the first
   deployment carrying real traffic. The boundary is decided now so that adding
   them later is an adapter, not a refactor.

### B3 — What a log line is

- **structured, one JSON object per line.** No line whose only content is prose.
- **carries the same correlation id `audit_events` records** for that capability
  attempt (ADR-034 item 4 puts one row there per attempt). This is the ruling's
  most useful consequence and deserves saying plainly: **a log line and an audit
  row for the same attempt must be joinable**, or an incident is investigated
  twice from two half-views.
- **carries `tenant_id` wherever one exists.** Every support question begins with
  which tenant.

### B4 — What must never be logged, and why this list changed recently

- **credentials and secrets** — ADR-037 item 3 already forbids writing a plaintext
  secret to the database *"by any code path — including a stub adapter, a seed, a
  fixture, or a test."* Extend the same prohibition to logs explicitly, because a
  log file is the other place secrets end up and ADR-037 does not mention it.
- **the buyer's personal identifiers.** ADR-057 has just put کد ملی and postal
  address into the platform. **Before that ADR there was no personal data to
  protect; now there is, and the logging rule must be written against the system as
  it now is.** A national identifier in a log line survives every retention policy
  that applies to the database and none that applies to it.
- **whole request or response bodies**, for the same reason.

State the enforcement honestly: this is a review rule, not a checked one, unless
you can name a cheap check. **Do not claim enforcement the project does not have** —
that is worse than an unenforced rule, because it stops anyone looking.

### B5 — Levels, tied to the error taxonomy that already exists

`05_API_CAPABILITY_CONTRACTS.md` §7 already distinguishes a retryable
`CONCURRENCY_CONFLICT` from a permanent `CONFLICT` and says *"a client must not
treat the two the same way."* Neither is a system fault.

> An expected, contracted error is not logged at error level. The error level is
> for faults the platform did not anticipate.

The reason to record: an error channel that fills with contracted outcomes is an
error channel nobody reads, which is the same as not having one.

### B6 — The library

Choose one and name it. **Recommendation: `pino`** — JSON-first, low overhead, and
it composes with NestJS without a bridge layer. But Step 1.3 comes first: **if a
logger is already present and in use, adopting it is the ruling** unless there is a
stated reason against it, and this prompt's recommendation is void.

**Install nothing in this session.** The ADR names the choice; the dependency
arrives with the first code that uses it, in its own change, where a lockfile diff
belongs.

---

## Step 4 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`** — a `### Ruling` in **ADR-039** and in
   **ADR-040**, each after the existing options, both left as written. §1.1: both
   → `**ACCEPTED (was OPEN)**`, with rewritten `Blocks` cells. **After this commit
   the index has no `OPEN` ADR** — state that in the entry, since it is the
   condition the whole programme has been working toward.
2. **`PHASE_2_BRIEF.md`** — a dated amendment **only** if §5's "Tenancy and RLS" or
   "Module boundaries" now owes something. The timeouts are deployment
   configuration, not Phase 2 scope. **§4 gains no table.**
3. **`RISK_REGISTER.md`**
   - **R-039** — if it is the pooling/session row, a dated addendum: it now has a
     ruling and, if you wrote the A2 test, a control. If R-039 is about something
     else, say so and find the right row.
   - a **new row** only if Step 1.1 found the tenant setting is session-scoped —
     in which case that is the finding of this session and everything else waits.
   `npm run check:register` must pass; escape every `|` inside a cell.
4. **`decisions/2026-09.md`** — one entry: both rulings, the derivation-not-a-number
   choice, the transaction-scope proof and what it showed, the logger chosen and
   whether it was already present, and the fact that no ADR remains open.
5. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is stale.
   The open-ADR count is stale in at least one of them.

---

## Step 5 — Verify

```bash
npm run typecheck
npm run lint
npm run test
npm run conformance
npm run check:register
npm run check:partitions
npm run graph && npm run openapi     # must produce no diff
git status --short
```

One commit, repository style, referencing ADR-039 and ADR-040.

---

## What to report back

1. Step 1.1's quote — transaction-scoped or session-scoped, and the exact call.
2. The A2 test: what it asserts, and whether you were able to force the same
   underlying connection to come back. **If you could not, say so** — a test that
   silently never exercises the condition is worse than none.
3. Where the pool size comes from today, and what the derivation gives instead.
4. Whether the logger could be added to the existing conformance rule, or why not.
5. Whether a logger was already present.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.** The last session found that Part D
   of its prompt re-ruled a decision ADR-027 item 3 had already made, **with the
   preference order inverted.** Check ADR-039 and ADR-040 the same way: this
   prompt may be proposing things their option lists already settled.

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a file
against that file. Where it is wrong, **stop and report rather than working around
it.**
