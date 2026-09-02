# SESSION 4 — Three small items: a register integrity rule, R-001's repair, and R-036's contract

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected.
> **Tooling and documentation only** — no production code, no migration, no
> capability. One conformance rule, one register repair, one ADR draft.

Three items, none of which blocks Phase 2 slice 1. They are grouped because
they are all small and all left over, and because item 1 finds item 2.

**Do them in the order below.** The rule is written first so that it fails on a
real defect before that defect is repaired — that failure is the proof the rule
works on live drift rather than only on a fixture, and it is not available once
the repair lands.

---

## Step 0 — Read

1. `AGENTS.md` §2, §5 and §8
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — the **ADR-030** body (the harness's
   own contract and its stated scope) and the **ADR-043** body (the trap this
   rule must avoid), plus **ADR-033**
3. `tools/conformance/` — `run.ts`, every file in `rules/`, `lib/`, and both
   self-test files (`harness.selftest.spec.ts`, `harness.selftest.live-db.spec.ts`)
4. `RISK_REGISTER.md` — the **preamble** and rows **R-001**, **R-008**,
   **R-036**, **R-037** only. Do not read the other 36.
5. `05_API_CAPABILITY_CONTRACTS.md` §7 (the error-code list) and §1 (the error
   envelope)
6. `modules/capability/domain/capability.errors.ts`
7. `modules/identity/interfaces/session.guard.ts`,
   `modules/tenant/interfaces/organization-access.guard.ts`,
   `modules/tenant/application/revoke-membership.service.ts`
8. `decisions/2026-09.md` — the entries about R-008, R-036 and R-037

Do not read `future/` or `99_SOURCE_MASTER_SPEC_v1.2.md`.

---

## ITEM 1 — A register-row integrity rule

### The evidence, which is not hypothetical

`RISK_REGISTER.md` is one large Markdown table. Its rows have broken the table's
rendering **three times, by three different mechanisms**:

1. A row spanning multiple physical lines. A table row containing literal
   newlines terminates the table in every CommonMark renderer — the register
   rendered as a broken table from R-008 onward, anywhere it is read rendered
   rather than raw.
2. The same defect reintroduced by a later edit to the same row, caught only
   because the author re-ran an ad-hoc `awk` check by hand.
3. Unescaped `|` inside inline code spans, creating phantom cells. GFM drops
   every cell past the eighth, so **R-008's entire Status cell and its Opened
   date were invisible in every rendered view** until 2026-09-02. R-034 had the
   same defect.

`AGENTS.md` §2 states the governing thesis directly: *"Rules expressed only as
prose are not enforceable on a long task."* A hand-run `awk` check that must be
remembered is exactly that.

### Before building it — check that it belongs in this harness

**Read ADR-030's stated scope first.** If that ADR scopes the conformance
harness to architecture and schema boundaries and a Markdown-integrity check
falls outside it, **stop and say so** rather than silently widening an accepted
ADR's scope. In that case the correct output is a recommendation — either a
short amendment to ADR-030, or a separate `npm run` script wired into CI beside
conformance — and a note in the decision log. Do not decide it silently in
either direction.

### What the rule checks

Keep it narrow. ADR-043's lesson is explicit: *a brittle parser that silently
matches nothing would be a check that always passes.* A narrow rule that
provably works beats a broad one that matches nothing.

For every line in `RISK_REGISTER.md` that begins a register row:

- **exactly 8 rendered cells**, counting `\|` (an escaped pipe) as content and
  not as a delimiter — `ID | Risk | Likelihood | Impact | Mitigation | Owner |
  Status | Opened`
- **the row occupies exactly one physical line** — no row may contain a literal
  newline

Also assert the header row and the delimiter row are intact, so that a rule
which matched nothing at all cannot pass quietly.

### Prove it can fail — this is mandatory, not a nicety

ADR-030's own standard: a rule that cannot be demonstrated to fail is not a
rule. Ship **three** fixtures, following the naming and layout of the fixtures
already in `tools/conformance/fixtures/`:

1. a register with a 9-cell row (the unescaped-pipe defect)
2. a register with a row split across two physical lines (the newline defect)
3. a **clean** register that passes — without this, a rule that rejects
   everything also looks like it works

And a fourth guard, which is the one ADR-043 actually warns about: **a fixture
proving the parser matches something.** If the row-detection pattern is changed
so that it matches zero rows, the rule must fail loudly rather than pass
vacuously. Assert a minimum matched-row count, or assert the header is found.

Extend `harness.selftest.spec.ts` — per `AGENTS.md` §8, a conformance rule's
test lives at the CI-conformance layer.

**The rule must not be satisfiable by an `exceptions.json` entry.** Verify that
by reading how `lib/exceptions.ts` is applied and, if exceptions are applied
generically to all rules, say so and state how this rule opts out.

### Then run it against the real file

It will fail on **R-001**, which currently has 12 cells. **That failure is the
deliverable of this item** — it is the proof the rule catches live drift and not
just fixtures. Capture the output before fixing anything.

---

## ITEM 2 — Repair R-001

### What is wrong

R-001 has **12 rendered cells**. Its cause differs from R-008's and R-034's:
status updates were appended over time as new `| User | <status>` cell pairs
rather than by rewriting the Status cell. The result, verified 2026-09-02:

| position | content |
|---|---|
| cell 7 — the Status column, and the only one that renders | `**PARTIALLY CLOSED, 2026-08-24** — CI has now actually executed…` |
| cell 9 | `**CLOSED, 2026-08-24** — run "graph: a layer with no files is not a layer"…` |
| cell 11 | `CLOSED` |
| cell 12 | `2026-08-22` |

So a closed row renders as `PARTIALLY CLOSED`, and its real status and its
`Opened` date are both in dropped cells. **A gate review reading the register
rendered concludes this risk is still partly open. It is not.**

### The repair, and why it is worth making despite not being provable byte-wise

A previous session left this row alone on the grounds that the repair — merging
cells and removing two duplicate `User` tokens — cannot be proven content-neutral
the way the pipe-escaping repairs were (where the file with every `\|` reduced
to `|` was byte-identical before and after).

**That reasoning applies to a repair that must not change content. This one
must.** The rendered status is currently wrong, and a wrong rendered status on a
closed row is a worse defect than a repair whose proof is read rather than
diffed.

Repair it as follows:

- **Preserve every word of every status update.** Merge cells 7, 9 and 11 into
  one Status cell, keeping each dated update in full and in chronological order,
  so the row's history survives. The register's convention is that a row's
  history is the point.
- **The final status is `CLOSED`**, dated, and it must be the part a reader sees
  first in that cell.
- Remove only the **duplicate `Owner` tokens** that the appends introduced, and
  say in your report exactly how many you removed and where.
- `Opened` returns to cell 8 with its real value, `2026-08-22`.

**Prove it by reading, and show the proof.** Print the row's cells before and
after, numbered, in your report. The count must go 12 → 8 and no status text may
be missing.

Add a dated correction line to the register's preamble recording that R-001's
rendered status was wrong until this date — **this one does get a dated
correction**, unlike the transcription fix of 2026-09-02, because the register
genuinely did display a different status and a reader may have acted on it.

Then re-run Item 1's rule. It must go green.

---

## ITEM 3 — Draft ADR-051 for R-036

### The question

**R-036 is now R-008's only live thread.** R-008 cannot close until it is
answered, and the answer is a contract decision, not a test change.

No document states which error code is correct when a membership is revoked
while another request from that same session is already in flight. Read from the
guard chain — verified, not inferred:

- `revoke-membership.service.ts` revokes the target's sessions **and** updates
  their membership status **in one atomic transaction**.
- The loser's request makes **two sequential, non-atomic guard reads**:
  `SessionGuard` queries `sessions` and throws `AUTHENTICATION_REQUIRED` (401);
  `OrganizationAccessGuard` then queries `memberships` in its own
  `withTenantContext` and throws `FORBIDDEN` (403).
- If the request gets past both, `lockActiveForUpdate`'s post-commit re-check
  yields `CONCURRENCY_CONFLICT` (409).

So the code returned depends only on **where in the pipeline the winner's commit
lands** — 401, 403 or 409 — while the underlying fact is identical in all three
cases and is a single atomic event.

### The three options, with what each costs

Draft them fairly; do not stack the deck toward the recommendation.

| Option | What it costs | What it forecloses |
|---|---|---|
| **A. Accept all three as correct.** Document in `05` §7 that a mid-flight revocation may surface as 401, 403 or 409 depending on pipeline position, and widen the test's accepted set. | The public contract now leaks internal pipeline ordering, and a client must handle three codes for one condition. Cheapest to implement — nothing changes but prose. | Any later normalization becomes a breaking contract change. |
| **B. Normalize to 401 `SESSION_INVALIDATED`.** The revoke invalidates the session atomically, so every subsequent request from it is invalid regardless of which checkpoint notices. | Guards must distinguish *"no session presented"* from *"session existed and was revoked"*, and `OrganizationAccessGuard` must distinguish *"membership revoked mid-flight"* from *"never a member"*. Real production code, in a later slice. | Nothing. |
| **C. Normalize to 409 `CONCURRENCY_CONFLICT`.** Treat it as what it structurally is — a request that raced a conflicting write. | 409 conventionally invites a retry, and a retry here can never succeed: the state is final. Misleads the client about recoverability. | Nothing. |

### Recommendation to record — advisory, the ruling is the maintainer's

**Option B.**

Three reasons, and the ADR should give all three:

1. **It is the only option whose answer does not depend on timing.** A and C
   both describe a consequence; B describes the fact. The session was revoked —
   that is true at every checkpoint, before, between and after.
2. **It gives R-037's orphaned code its producer.** `SESSION_INVALIDATED` is
   declared in `05` §7, present in `CapabilityErrorCode`, mapped to 401, and
   **never thrown anywhere** — R-037 exists precisely because a code can sit
   fully valid-looking in the contract and never fire. This is its natural and
   perhaps only producer. Ruling B turns a documented-but-unreachable code into
   a used one, and gives R-037 a path to closure.
3. **`AUTHENTICATION_REQUIRED` currently conflates two conditions** a client
   cannot distinguish: *no session presented* and *session existed and was
   revoked*. Separating them is worth doing on its own merits.

**State the scope limit of B precisely, because it is easy to over-read.** A 401
is correct when the caller's **own session** was revoked. It is **not** correct
for a caller who is still authenticated but has merely lost membership in this
organization — that stays 403. In the two-concurrent-owners case the loser's own
session genuinely was revoked, which is why B applies there.

### What this ADR does not do

- It does **not** implement anything. The guard changes B implies are production
  code in a later slice, and this session writes none.
- It does **not** widen the test's accepted status codes. Doing that before the
  ruling would decide the contract in a spec file, which is the trap R-036's row
  records explicitly.
- It does **not** close R-008 or R-037. It names the path to both.

### Mechanics

Status **`OPEN`**. Register row in §1.1 plus a body after ADR-050, in ADR-043's
structure. Re-verify the next free number first:

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -3
```

Expected next free: **ADR-051**. If it differs, stop and report.

Add a dated cross-reference to **R-036** pointing at ADR-051 as the row's owner,
and to **R-008** noting that its remaining thread is now tracked by an ADR.
**Re-run Item 1's rule after any register edit.**

---

## Step 4 — Record

**`decisions/2026-09.md`** — one entry, newest at top, four-field template. It
must record:

- whether ADR-030's scope admitted the integrity rule, and what you did if it
  did not
- the rule's real-file failure output on R-001 **before** the repair, quoted —
  this is the evidence the rule works
- R-001's before/after cell listing, and how many duplicate Owner tokens were
  removed
- that ADR-051 is drafted and unruled

**`CLAUDE.md`** — ADR counts move to **54 (42 ACCEPTED, 4 OPEN, 8 DEFERRED)** if
ADR-051 lands. Risk rows stay **40**. Keep the dates in the sentences. If the
conformance rule count is stated anywhere in that file, update it.

Honest `Status` for the entry: **OPEN** — one ADR drafted and unruled.

---

## Step 5 — Verify

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run conformance
npm run graph
```

- `npm test` should report **more than the current count** — you added
  conformance self-tests. Note the new number; do not "reconcile" it with
  `PROJECT_GRAPH.md`'s static count.
- `npm run conformance` must be **green at the end**, and you must be able to
  demonstrate it going red by breaking a register row on purpose. **Show that**,
  then revert it.
- Register checks:

```bash
grep -c "^| R-0" RISK_REGISTER.md      # expect 40
grep -cE "^\| ADR-051 " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 1
grep -cE "^## ADR-051 " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 1
```

`npm run db:migrate` is not required — no migration changed.

Commit as **three separate commits**, one per item, so each is revertible alone.
Push and report the CI result.

---

## Step 6 — Report

- whether ADR-030's scope admitted the rule, and the reasoning either way
- the rule's failure output on R-001 before the repair
- R-001's cells before and after, numbered
- the demonstration of the rule going red on purpose
- ADR-051's three options as drafted, and whether your own reading of the guard
  chain matched what this prompt describes — **if it did not, say so and do not
  write the ADR on a wrong premise**
- the three commit hashes

---

## Hard boundaries

- **Tooling and documentation only.** No production code, no migration, no
  capability, no guard change.
- ADR-051 is `OPEN`. Do not rule it.
- Never weaken an existing conformance rule or add an `exceptions.json` entry to
  reach green.
- Do not widen `membership-revoke.integration.spec.ts`'s accepted status codes.
- Do not edit `PHASE_1_DEBT_CLOSURE.md` — D-6 is closed and stays closed.
- No reading of `future/`.
- If the integrity rule cannot be made to fail on demand, **it is not finished** —
  report that rather than shipping a check that always passes.
- If you become uncertain: stop and write the ambiguity down with options and a
  recommendation.
