# SESSION 8 — Implement ADR-051: `SESSION_INVALIDATED` for a mid-flight revocation

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected.
> **This session writes production code** — the first in this programme.
> No migration, no new table, no new capability.

ADR-051 was ruled `ACCEPTED` on 2026-09-03 and implements nothing. This session
implements it.

**Why now, ahead of Phase 2 slice 1:** R-008 recorded occurrences 5 and 6 within
about twenty minutes, both on documentation-only pushes. A green CI run is no
longer the default outcome of a merge, and every slice from here on verifies
against that build. The contract this fixes is already decided, so what remains
is implementation rather than judgement.

**`/new-slice` does not apply here** and must not be invoked. That skill builds a
new vertical capability slice; this is a targeted change to two existing guards
in Phase 1 modules. Follow `AGENTS.md` directly.

---

## Step 0 — Read

1. `AGENTS.md` — **§2 (the golden path rule), §3 (the pre-change checklist), §4,
   §7 (definition of done), §8 (the test layering rule)**. All five matter here.
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-051** in full including its
   `### Ruling`, plus **ADR-029**, **ADR-033**, **ADR-030**
3. `05_API_CAPABILITY_CONTRACTS.md` §1, §5 and §7
4. `RISK_REGISTER.md` — rows **R-008**, **R-036**, **R-037** only
5. The code, in full:
   - `modules/identity/interfaces/session.guard.ts`
   - `modules/tenant/interfaces/organization-access.guard.ts`
   - `modules/tenant/application/resolve-organization-access.service.ts`
   - `modules/tenant/application/revoke-membership.service.ts`
   - `modules/capability/domain/capability.errors.ts`
   - `modules/capability/contracts/index.ts` (`runCapabilityAttempt`)
   - `apps/api/membership-revoke.integration.spec.ts`
   - `tools/conformance/rules/error-codes.ts`
   - the golden path: `store.read`'s controller and capability definition

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register
```

Tree must be clean. **If it is not, stop and report.**

---

## Step 1 — Before writing anything: check that this needs no new decision

A previous session recorded that Option B *"needs 'a session existed and was
revoked' to be distinguishable from 'no such session' at guard time — that is
ADR-029's territory and I did not assume it."*

**Resolve that first.** Read ADR-029 and the `sessions` migration and answer, in
your report:

- Does a revoked session leave a row that the guard can still read, or is it
  deleted? `revoke-membership.service.ts` revokes sessions — determine what
  "revoke" means in the schema: a status column, a `revoked_at`, a delete.
- If a revoked session leaves no readable trace, **stop.** The ruled contract is
  then not implementable without a schema change, which is a new decision and
  not this session's to take. Report it as a documentation defect per
  `AGENTS.md` §5.

Everything below assumes the trace exists. **Do not assume it — verify it.**

---

## Step 2 — The change, as a candidate design to validate rather than a directive

This is my reading of the guard chain from the register rows. **Check it against
the code and correct it if it is wrong** — four prompts in this programme have
carried a wrong premise and each catch was worth more than the prompt.

**`SessionGuard`** currently throws `AUTHENTICATION_REQUIRED` for every failure.
Split it:

- no cookie, no session row, or an expired one → **`AUTHENTICATION_REQUIRED`**,
  unchanged
- a row that exists and was revoked → **`SESSION_INVALIDATED`**

**`OrganizationAccessGuard`** currently throws `FORBIDDEN` whenever the caller's
membership is not active. It cannot distinguish the two cases ADR-051 separates,
because it knows nothing about sessions. The narrowest change that implements the
ruling:

> On finding the membership inactive, re-check whether the caller's own session
> is still valid. **Session revoked → `SESSION_INVALIDATED` (401). Session still
> valid → `FORBIDDEN` (403), unchanged.**

That extra read happens **only on the failure path** — the happy path costs
nothing — and it implements ADR-051's scope limit exactly: 401 when the caller's
own session was revoked, 403 when they are still authenticated and merely no
longer a member.

**If you find a cleaner way to reach the same contract, take it and say why.**
The contract is fixed; the mechanism is not.

**Do not** change `membership.revoke`'s business rules, the state machine, the
transaction boundary, or anything in `revoke-membership.service.ts` beyond what
the contract requires. `AGENTS.md` §4: no broad refactor while implementing.

---

## Step 3 — The consequence that will fail the build if you miss it

`SESSION_INVALIDATED` becomes **thrown** for the first time. The conformance rule
`ERROR-CODE-UNDECLARED` checks *thrown → declared*.

**Every capability reachable through these guards must now declare it** in its
`CapabilityDefinition.errorCodes`. Enumerate them from the code rather than
guessing — it may be most of the ten — and update each. Then regenerate
`openapi.json` (`npm run openapi`) and commit the regenerated artifact, since
ADR-033 items 4–6 make it a generated contract.

Check both directions before you finish: `ERROR-CODE-UNDOCUMENTED` checks
*declared → documented in `05` §7*. `SESSION_INVALIDATED` is already in §7, so
that direction should already hold — **verify it rather than assuming**.

---

## Step 4 — Tests, at the layers `AGENTS.md` §8 requires

**An interface contract test — this is the proving test, and it is the deliverable.**
Deterministic, not concurrent: revoke a session, then make a request with it, and
assert the response is **`SESSION_INVALIDATED` / 401** — the specific code, not
merely "a 401". Assert the same for the membership-revoked-mid-flight path if you
can construct it deterministically.

**A test that the 403 path still returns 403.** A caller who is authenticated and
simply not a member of that organization must be unaffected. Without this, the
ruling's scope limit is unenforced and a later change could quietly turn every
403 into a 401.

**Do not widen `membership-revoke.integration.spec.ts`'s accepted status set.**
Its `losses` filter already accepts 401. Once the guard returns 401 in that
window the existing test passes as written — that is the point, and changing the
filter would hide whether the fix worked.

**Do not add a retry, `retry: n`, or any flake suppression.**

---

## Step 5 — What you may and may not claim about R-008

R-008's failing mode is intermittent and has never been reproducible on demand —
165 local attempts returned nothing. **One green run proves nothing**, and six
occurrences arrived across pushes you cannot schedule.

So: record what was changed and why it should end the flake, and **name an
observation window rather than declaring victory.** Choose R-008's status word
deliberately, per the register's own vocabulary, and justify it in one sentence
in the row. `RESOLVED` requires the risk to be eliminated — consider carefully
whether a fix that cannot yet be observed to have worked meets that bar.

**R-036** — its contract is now decided *and* obeyed by running code. That is a
different state from yesterday. Choose its word deliberately too.

**R-037** — `SESSION_INVALIDATED` now has a real producer, so its example is
gone; the structural gap it records (nothing checks *documented → declared*)
is untouched. Say both.

Re-run `npm run check:register` after every register edit.

---

## Step 6 — The pre-change checklist

`AGENTS.md` §3 requires this stated for any code change. Produce it in your
report, every line answered — including the ones that are "not applicable" with
a reason:

owning module and aggregate · tenant scope and store scope · required permission,
entitlement, quota, rate limit · audit requirement · Application Service and
Capability id · transaction boundary · idempotency behaviour · emitted events and
external side effects · money handling · time and timezone handling · affected
ADRs · whether a new ADR is required.

---

## Step 7 — Verify

The full gate from `CLAUDE.md`, not a subset:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run conformance
npm run openapi && npm run graph && npm run check:register
git diff --stat
```

`npm run db:migrate` is not required — no migration changed. Confirm that
explicitly rather than skipping it silently.

**Never weaken a conformance rule or add an `exceptions.json` entry to reach
green.** If `ERROR-CODE-UNDECLARED` fires, the fix is to declare the code, never
to except the rule.

Report the new `npm test` count and do not reconcile it with
`PROJECT_GRAPH.md`'s static figure.

Commit in two commits — the guard change plus its declarations and generated
artifacts, then the register and documentation updates. Push, then **re-run CI at
least twice** and report both outcomes; a single green run is not evidence.

---

## Step 8 — Report

- the `AGENTS.md` §3 checklist, complete
- **the answer to Step 1** — what "revoked" means in the `sessions` schema, quoted
  from the migration
- whether Step 2's candidate design survived contact with the code, and what you
  changed if not
- how many capabilities had to declare `SESSION_INVALIDATED`, and the list
- the new test count, and what each new test proves
- **R-008, R-036 and R-037's status words with their one-sentence
  justifications**, quoted
- both CI outcomes
- anything you could not settle, as a documentation defect

---

## Hard boundaries

- No migration, no new table, no new capability, no new ADR.
- Do not invoke `/new-slice`.
- Do not change `membership.revoke`'s business rules or transaction boundary.
- Do not widen any test's accepted status codes; do not add retries or skips.
- No `exceptions.json` entry; no weakened conformance rule; no weakened register
  check.
- No reading of `future/`.
- **If Step 1 shows the contract is not implementable without a schema change,
  stop and report.** Do not design your way around a missing decision.
- If you become uncertain: stop and write the ambiguity into the decision log
  with options and a recommendation.
