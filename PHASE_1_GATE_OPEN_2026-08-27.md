# Phase 1 Gate Open — 2026-08-27

**Scope:** a closure note, not a fourth audit. `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` found all nine exit criteria MET and withheld the gate for exactly one reason: CI had never executed on `fd13c1e` (run `32985409838` stuck `queued`, zero jobs, over 30 minutes of observation). This note records what changed and states the verdict.

**Supersedes nothing.** `PHASE_1_GATE_REVIEW_2026-08-24.md`, `PHASE_1_GATE_REVIEW_2026-08-24-II.md`, and `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` are left unedited, per this project's standing convention for dated records.

---

## 1. What was left open

`PHASE_1_GATE_CONFIRMATION_2026-08-26.md` §7: *"The gate does not fully open on this commit today, for exactly one reason: CI has not run on `fd13c1e`... What stands between here and open: a successful CI run on `fd13c1e` (or a subsequent commit, re-checked the same way)."* Every other check in that report was verified locally and independently; only the CI-run condition was outstanding.

## 2. Cause of the stuck run

**Established correlation, not a diagnosed mechanism:** the repository had been switched to **private** on 2026-08-26; the queued run (`32985409838`) never scheduled a job — consistent with its `updated_at` being byte-identical to its `created_at` for over 30 minutes, against every run before and after it starting and completing normally. The repository has since been switched back to **public**, and Actions runs again (§4).

**Correction, 2026-08-28: the actual cause is UNKNOWN, not the "Actions quota/plan" explanation first assumed here.** Settings → Billing and licensing → Usage was checked: month-to-date gross metered usage is ~$7 with **$0.00 billed** (fully offset by discount — no spending threshold crossed), and its usage curve rises well before this repository even had a git remote (added 2026-08-23), so most of that $7 isn't this repository's CI. Against GitHub Free's ~2,000 included private-repo Actions minutes (a derived estimate, not a page reading), ~$7 of mostly-unattributed usage does not look like an exhausted allowance. The quota/plan theory is withdrawn; no replacement cause is asserted. Open, unperformed checks (full detail in `DECISION_LOG.md` 2026-08-27): a budget/alert that blocks rather than bills usage; the Usage page broken down by product; this repository's own Actions permissions setting. **The warning that returning to private may break CI again stands regardless of cause, and matters more now that the mechanism isn't understood.**

## 3. Proof the reviewed code tree is unchanged

`git diff --stat fd13c1e..fbc7ba4`:

```
.gitignore                              | 1 +
PHASE_1_GATE_CONFIRMATION_2026-08-26.md | 139 ++++++++++++++++++++++++++++++++
2 files changed, 140 insertions(+)
```

No code, migration, test, or workflow file changed between `fd13c1e` (the commit the 2026-08-26 confirmation verified) and `fbc7ba4` (current `HEAD`). The code tree CI has now exercised is therefore identical to the one that report certified locally.

## 4. The confirming CI run

`gh run view 33014271741` — commit `fbc7ba4`, workflow `Conformance`, conclusion `success`, 41s. Full step list, all ✓:

```
Set up job → checkout → setup-node → npm ci → Start PostgreSQL (docker-compose.yml)
→ Apply migrations → Type check → Harness self-test → Conformance scan of real source tree
→ Project graph up to date → OpenAPI artifact up to date (ADR-033) → Stop PostgreSQL
→ Upload exceptions report → Post steps → Complete job
```

No step was skipped or unrun. This is the same step sequence `RISK_REGISTER.md` R-001 cites for its own closing run (`32666989546`) — the same standard is applied here.

**One intermediate run does not change this verdict, but is on the record (`RISK_REGISTER.md` R-008, new):** run `32987662296` on `09a8017` — code byte-identical to `fd13c1e`/`fbc7ba4` — failed once in CI, five hours before the green run above, on the same two-concurrent-owners test `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` §2 had just run 5/5 green locally. The precise cause is **UNDETERMINED** from the available log (an initial hypothesis of an unhandled 500 was checked and does not hold up — see R-008 for the full correction trail); a Postgres deadlock in `lockActiveForUpdate`'s unordered `SELECT ... FOR UPDATE` is one plausible, explicitly UNVERIFIED hypothesis, not a diagnosis, alongside a second — the controller's audit write sits outside its `try/catch`, so a real commit followed by a throwing audit write also reaches the client as a non-200 (see R-008). **Correction, 2026-08-28: this paragraph previously said "neither concurrent request... was measured as succeeding, so the zero-active-owner dead end... requires both to succeed and did not occur" — that inference is unsound and is withdrawn** (a non-200 does not prove non-commit, per the mechanism above; the run's own database-state assertion at line 459 never executed, since the failure was at the earlier line 451, so the actual end state of the `memberships` table that run is unknown). **R-007 stays CLOSED on the correct ground instead: `lockActiveForUpdate` serializes the two transactions on the tenant's whole ACTIVE membership set, so neither can pass its last-member/last-owner check while the other is also active, regardless of what HTTP status either client observed.** R-008 is opened as a separate, narrower, intermittent finding, root cause still UNDETERMINED. A future red run on this specific test must not be assumed to be flake without investigation.

## 5. Verdict

**The Phase 1 gate is OPEN.** All nine exit criteria were independently verified MET by `PHASE_1_GATE_CONFIRMATION_2026-08-26.md`, the one outstanding condition it named — a successful CI run on `fd13c1e` or a subsequent commit with an identical code tree, re-checked the same way — is satisfied by run `33014271741` on `fbc7ba4`.

## 6. Carried forward, unchanged and still open

None of the following are resolved by this note. They are re-stated, not re-litigated:

- **R-003** (ACCEPTED) — the `memberships`/`store_memberships` self-access RLS clause remains a deliberate, permanent widening beyond plain `tenant_id` scoping.
- **R-005** (OPEN) — `auth.login` still has no rate limiting or lockout. Must exist before internet-facing exposure.
- **R-006** (OPEN, hardening) — `PermissionCheckRepositoryPg.hasPermission` still does not independently filter by membership status; safe only because every current caller is guard-verified first.
- **The coarse tenant-wide `membership.revoke` lock** — `lockActiveForUpdate` locks every ACTIVE membership row in the tenant, not just the target, trading revoke throughput for correctness. Undocumented and unmeasured tradeoff, fine at Phase 1 scale.
- **The RLS same-row-probe nuance** — `tenant-isolation-rls.spec.ts`'s concurrent SELECT/UPDATE/DELETE probes against the same seeded row don't always independently confirm all three operations are denied in a single run (see `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` §1); the suite still cannot silently pass against a fully broken policy, but a single run proves less per-operation than three independent runs would.
- **The ADR-009 shared idempotency service** — still not built. Most-cited Phase 2 blocking prerequisite.
- **R-008** (new, OPEN, intermittent) — see §4 above and `RISK_REGISTER.md` for the full record.

---

**Committed as this note only** — no code, test, migration, workflow, or normative document was edited to reach this verdict, beyond the `RISK_REGISTER.md` row this note cites.
