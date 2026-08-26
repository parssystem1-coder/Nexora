# Phase 1 Gate Open — 2026-08-27

**Scope:** a closure note, not a fourth audit. `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` found all nine exit criteria MET and withheld the gate for exactly one reason: CI had never executed on `fd13c1e` (run `32985409838` stuck `queued`, zero jobs, over 30 minutes of observation). This note records what changed and states the verdict.

**Supersedes nothing.** `PHASE_1_GATE_REVIEW_2026-08-24.md`, `PHASE_1_GATE_REVIEW_2026-08-24-II.md`, and `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` are left unedited, per this project's standing convention for dated records.

---

## 1. What was left open

`PHASE_1_GATE_CONFIRMATION_2026-08-26.md` §7: *"The gate does not fully open on this commit today, for exactly one reason: CI has not run on `fd13c1e`... What stands between here and open: a successful CI run on `fd13c1e` (or a subsequent commit, re-checked the same way)."* Every other check in that report was verified locally and independently; only the CI-run condition was outstanding.

## 2. Root cause of the stuck run

The repository had been switched to **private** on 2026-08-26, which blocked GitHub Actions from scheduling the queued run (`32985409838`) — consistent with its `updated_at` being byte-identical to its `created_at` for over 30 minutes, and with every run before and after it starting and completing normally. The repository has since been switched back to **public**, and Actions runs again.

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

**One intermediate run does not change this verdict, but is on the record (`RISK_REGISTER.md` R-008, new):** run `32987662296` on `09a8017` — code byte-identical to `fd13c1e`/`fbc7ba4` — failed once in CI, five hours before the green run above, on the same two-concurrent-owners test `PHASE_1_GATE_CONFIRMATION_2026-08-26.md` §2 had just run 5/5 green locally. The precise cause is **UNDETERMINED** from the available log (an initial hypothesis of an unhandled 500 was checked and does not hold up — see R-008 for the full correction trail); a Postgres deadlock in `lockActiveForUpdate`'s unordered `SELECT ... FOR UPDATE` is a plausible, explicitly UNVERIFIED hypothesis, not a diagnosis. What is established: neither concurrent request in that failing run was measured as succeeding, so the zero-active-owner dead end R-007 exists to prevent requires both to succeed and did not occur — **R-007 stays CLOSED**. R-008 is opened as a separate, narrower, intermittent finding. A future red run on this specific test must not be assumed to be flake without investigation.

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
