---
name: phase-gate
description: Audit whether a phase actually meets its exit criteria before the next phase opens. Use when asked whether Phase 0/1/2/3 is done, whether it is safe to start the next phase, to review progress against 06_IMPLEMENTATION_PLAN.md, or to produce a phase completion or readiness report. Verifies by running the build and tests and reading code — never by trusting the repository's own status documents.
---

# Phase gate review

`06_IMPLEMENTATION_PLAN.md`: *"a phase exit is a test in CI, never a screenshot."*

This review's job is to find the gap between what the repository's status documents claim and what the code actually does. Those documents are evidence of intent, not evidence of completion. **Read them last, not first** — form your own judgment from the code, then compare.

Produce an honest result. A criterion that is nearly met is not met.

---

## Step 1 — Establish the target

Get the exit criteria from the source of truth, not from a summary:

- `06_IMPLEMENTATION_PLAN.md` — the phase's ordered step list and its **Exit** paragraph
- the phase brief's exit-criteria section (for Phase 1, `08_PHASE_1_BRIEF.md` §6) — the itemised checklist
- `AGENTS.md` §6 — the required implementation sequence
- `AGENTS.md` §7 — the definition of done

Write the criteria out as a flat list before you start checking. If the plan and the brief disagree on scope, that is itself a finding — record it, do not silently pick one.

## Step 2 — Run everything, and record real numbers

```bash
npm run typecheck
npm run db:migrate     # from an empty database, not an already-migrated one
npm test
npm run conformance
npm run graph          # regenerate the structural map
```

Then, if a previous gate review exists, diff against the commit it reviewed:

```bash
npm run graph -- --since <that-commit>
```

That names every table, capability, route, dependency edge and RLS change the phase added — the structural half of "what happened since last time", extracted rather than recalled. It does **not** cover the semantic half: contradictions between documents, tests that assert the wrong thing, unreachable code paths. Those still need reading, and they are where every real defect in this repository has been found so far.

The last two need PostgreSQL on the port `.env.example` names, with the roles `platform/db/init/001_roles.sql` creates. `docker compose up -d --wait` is the intended path; a native install works if you create the two roles by hand and set `DATABASE_URL` / `MIGRATE_DATABASE_URL`.

Record the actual counts — tests passed, migrations applied, violations, exceptions. Do not paraphrase them from a status document.

**The app/test role must not be able to bypass RLS.** If tests connect as a superuser, as a `BYPASSRLS` role, or as the table owner, every tenant-isolation test passes for the wrong reason and the whole suite proves nothing. `platform/db/assert-role-safety.ts` exists to catch this — confirm it is actually wired into the isolation tests.

## Step 3 — Map each criterion to the test that proves it

For each criterion, find the specific test. Do not accept "covered by the suite".

- Locate the test by name and file, and confirm it asserts the criterion rather than something adjacent to it.
- **Check what the test asserts, not what its title says.** A test can be green while encoding the opposite of the requirement.
- If a criterion has no test, it is **not met**, regardless of whether the behaviour appears correct in the code.
- If the rule lives at a different layer than its test (`AGENTS.md` §8), that is a partial, not a pass.

Classify each: `MET | PARTIAL | NOT MET`. Say which test proves each `MET`.

## Step 4 — Independent checks the criteria list does not spell out

These are the failures that hide behind a green build.

**Scope.** Compare the tables that actually exist against the phase brief's allowed list. Anything extra is scope creep; anything missing that a criterion depends on is a gap. `\dt` on the migrated database, not a reading of the migration filenames.

**RLS reality.** For each tenant-owned table confirm in the live database — not in the SQL text — that `relrowsecurity` and `relforcerowsecurity` are both true and a policy exists. Then confirm empirically that a query with no tenant context returns zero rows.

**The reference pattern.** `AGENTS.md` §2 makes the golden path the template every later slice mirrors. If the golden path contradicts a normative document or a recorded decision, that is a high-severity finding even when every test is green — the defect multiplies once replication starts.

**Exceptions.** `exceptions.json` must be empty or every entry justified with a real ADR reference. An exception added to make the harness green is a failed gate.

**CI.** A workflow file that has never executed does not satisfy "proven by a test in CI". Check whether it has actually run.

**Open risks and decisions.** Read `RISK_REGISTER.md` and the open items in the decision log — `DECISION_LOG.md` is now an index over `decisions/YYYY-MM.md` files; check the recent period files it names, not just the index itself. An open risk that a criterion depends on is a blocker, not a footnote.

**Next-phase prerequisites.** Read the next phase's ordered steps in `06_IMPLEMENTATION_PLAN.md` and check its first three or four steps against the repository. A phase whose own criteria are met can still be blocked by infrastructure the next phase assumes exists — the money/currency model, the shared idempotency service, the queue, the outbox table, calendar arithmetic. Name each missing prerequisite and which step needs it.

## Step 5 — Report

Write it to a dated file at the repository root. Structure:

1. **Verdict** — can the next phase open? One paragraph, the answer first.
2. **Evidence** — the commands run and their real output numbers.
3. **Exit criteria** — the table from step 3, one row per criterion, with the proving test named.
4. **Findings** — ordered by the cost of leaving them, each with file and line, which normative document it violates, and a concrete fix. Findings in the reference pattern rank above findings in a leaf.
5. **Next-phase prerequisites** — what is missing and which step needs it.
6. **Recommended order** — the smallest sequence of work that opens the gate, and why that order.

Rules for the report:

- Cite `file:line` and the document clause. A finding without a location is a guess.
- Separate **broken** from **not yet built** — they need different responses.
- Say what you could not verify and why. An unverified area is not a passing area.
- Where the repository's own status documents were accurate, say so — that is real information about how much the next report can be trusted.
- Do not soften a `NOT MET` into a `PARTIAL` because the remaining work looks small.
