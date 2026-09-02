# SESSION 6 — ADR-054: per-tenant restore, and its place in the phases

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected. **Documentation-only.**
> No migration, no table, no module, no capability, no infrastructure change.

R-038 has recorded since 2026-09-02 that there is no way to recover one tenant
without rolling back all of them. Phase 2.5 gave the *export* half an owner. The
*restore* half — the maintainer's actual requirement, *"store #357 broke, put it
back"* — was never decided and belongs to no phase. This session decides it.

**The maintainer ruled on 2026-09-03, and this is an input, not a question:**

> **Recovery granularity is the last nightly snapshot.** Up to 24 hours of a
> tenant's data may be lost in a recovery. Arbitrary point-in-time recovery for a
> single tenant is **explicitly not** what is being built.

That ruling is the whole reason this ADR is cheap. Record *why* it makes it
cheap: arbitrary point-in-time restore would require continuous WAL archiving, a
standby restore target and a full-cluster restore per incident. A nightly
per-tenant snapshot requires none of those.

---

## Step 0 — Read

1. `AGENTS.md`
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — §1.1, and the bodies of **ADR-010**
   (its numeric targets and why they are flagged unverified — the precedent this
   ADR must follow), **ADR-020**, **ADR-021**, **ADR-026**, **ADR-034**,
   **ADR-035**, **ADR-041**, **ADR-046**, **ADR-053**
3. `PHASE_2_BRIEF.md` — §4, §5, and **§9** (Phase 2.5, created 2026-09-03)
4. `06_IMPLEMENTATION_PLAN.md` — the phase list, and Phase 2.5's entry
5. `RISK_REGISTER.md` — the preamble and rows **R-038** and **R-039** only
6. `04_DATABASE_BLUEPRINT.md` §7 and §8

Verify first:

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -3
grep -c "^| R-0" RISK_REGISTER.md
npm run check:register
git status --short
```

Expected: highest ADR **ADR-053**, **40** rows, register check green, clean tree.
**If any differs, stop and report.** Next free number is **ADR-054**.

---

## Step 1 — Write ADR-054

**Title:** Per-Tenant Recovery from Nightly Snapshots
**Status:** `ACCEPTED (new)`, ruled by the maintainer on 2026-09-03
**Depends on** ADR-020, ADR-021, ADR-034; **interacts with** ADR-041 and
ADR-053; **owns** R-038's restore half.

### Problem

State it from the evidence, not from this prompt: the only recovery mechanism
this platform has is PostgreSQL physical point-in-time recovery, which operates
on the whole cluster. Restoring one tenant by that route rolls every other
tenant back with it. R-038 records this. ADR-020 rule 6 requires a tenant export
capability but says nothing about restoring one.

### The ruling, in six parts

**1. Mechanism: a nightly per-tenant logical snapshot.** One snapshot per tenant
per day, written by a scheduled job. Recovery restores a named tenant from a
named snapshot.

**2. RPO is 24 hours, and it is a decision rather than an assumption.** Up to a
day of that tenant's data may be lost. **Say this in the ADR in plain terms** —
it is the number a tenant must be told, and it is the term ADR-020 rule 7 already
requires be documented to them.

**3. RTO is owed a measurement and must not be invented here.** ADR-010's numeric
targets are already flagged as unverified assumptions until `06` Phase 4 item 9;
inventing a recovery-time number here would repeat that mistake in a new place.
State the shape — *restore time scales with one tenant's data volume, not the
cluster's* — and owe the number to the first drill.

**4. The mechanism is shared with ADR-020 rule 6's export capability.** A nightly
snapshot and a tenant's own data export are the same operation on different
schedules and with different consumers. **Build one mechanism, not two.** Say
this explicitly, because two mechanisms for one thing is what `AGENTS.md` §4
forbids and what the idempotency rule already had to prevent once.

**5. Restore is asymmetric across table families, and this is a property of the
design rather than a limitation to apologise for.**

- **Mutable tenant-owned rows** are restored — replaced from the snapshot.
- **Ledger-shaped tables** — `invoices`, `invoice_lines`, `usage_ledger_entries`,
  `billing_payment_events`, `subscription_periods`,
  `subscription_state_transitions`, `outbox_events`, `audit_events` — carry
  `REVOKE UPDATE, DELETE FROM nexora_app`. **They are never rewound.** An invoice
  issued after the snapshot point stays issued; if it must be undone, that is a
  compensating entry, which is what a financial record demands anyway.
- Therefore **restore runs outside the application, under a role the application
  does not have.** That changes who may run it and how it is authorised — record
  that it is an operator action with its own audit trail (ADR-034), never a
  tenant-facing capability.

**6. A snapshot that has never been restored is not a backup.** Require a
periodic automated drill that restores a tenant into a sandbox and verifies the
result. **This is the item most likely to be quietly dropped**, so give it its
own verification checkbox rather than a sentence in prose.

### Retention

Snapshots are kept **30 days**, matching ADR-020 rule 3's reversible-deletion
window — one retention number for the platform rather than two that drift apart.
Say that the alignment is the reason.

### What this ADR does not do — and this section does real work here

- **It does not provide arbitrary point-in-time recovery.** Ruled out on cost by
  the maintainer, 2026-09-03. Name what it would have required.
- **It does not address total cluster or server loss.** That is a different risk
  with a different mechanism (physical backup and off-site replication), it is
  **not covered by this ADR**, and **no phase owns it.** State this plainly — a
  reader must not close this ADR believing disaster recovery is solved. Recommend
  it be recorded as its own risk row, and say you are recommending rather than
  opening one.
- It does not choose a storage backend, a snapshot format, a scheduler, or a
  compression scheme. Those are Phase 2.5's design work.
- It does not build anything.

### The prerequisite that has no owner — name it, do not assume it

**Snapshots have to be stored somewhere, and this platform has no object
storage.** `files` is explicitly out of Phase 2's scope and `PHASE_2_BRIEF.md`
§4's exclusion list records that **no phase owns object storage**. Nightly
per-tenant snapshots cannot exist without somewhere to put them.

Record this as a **named prerequisite of Phase 2.5**, not as an assumption
buried in the mechanism. If it is not resolved, this ADR's mechanism has nowhere
to write.

### Verification checklist

- [ ] a restore of one tenant leaves every other tenant's data bit-identical,
      proven by a test against real PostgreSQL — not asserted
- [ ] a restore does not delete or alter any ledger-shaped row
- [ ] the restore operation is audited, with the operator identified
- [ ] a drill runs on a schedule and its result is recorded, not just its
      execution
- [ ] the 24-hour RPO is documented in tenant-facing terms (ADR-020 rule 7)
- [ ] a measured RTO replaces the placeholder after the first drill

---

## Step 2 — Amend Phase 2.5

`PHASE_2_BRIEF.md` §9 and `06_IMPLEMENTATION_PLAN.md`'s Phase 2.5 entry, as a
dated amendment in each file's own style — the precedent for dated amendments in
both was established on 2026-09-03.

**Add to Phase 2.5's scope:**

1. **Nightly per-tenant snapshot job** — the shared mechanism of ADR-054 and
   ADR-020 rule 6.
2. **Operator-run per-tenant restore** — outside the application role.
3. **The recovery drill.**
4. **Object storage** — named as the prerequisite of items 1–3, per Step 1.

**Do not silently merge these with the export capability already in §9.** Say
that they share a mechanism and are therefore built together, which is a
different statement from being the same item.

**Consider whether Phase 2.5's own framing should be restated**, and report what
you decided rather than acting silently: it was created as *commercial growth*
and now also carries operational resilience. A coherent reading is that Phase 2.5
is **what must exist before the first paying tenant** — you need discounts and
referrals to sell, and export, restore and drills to be trustworthy. If you
restate it, do so as a dated amendment and say why. If you judge the two
concerns should be separate phases, say that instead and do not split them
yourself — a phase split is a maintainer decision.

---

## Step 3 — Update R-038

Dated addendum, not a rewrite. Its restore half now has a mechanism, a
granularity, a retention period and a phase.

**Choose its status word deliberately and justify it in one sentence in the row**,
per the register's own vocabulary. Think before writing `RESOLVED`: nothing is
built, no snapshot exists, and a tenant that breaks tonight still cannot be
recovered — the register reserves `RESOLVED` for a risk that is eliminated, "not
merely deferred or accepted." Consider also whether ADR-020 rule 7's
tenant-facing documentation obligation, recorded in this row, is now closer to
an owner than it was.

**Re-run `npm run check:register` after the edit.**

---

## Step 4 — Summaries

**`CLAUDE.md`** — ADRs **56 → 57** (ACCEPTED **45 → 46**, OPEN stays **3**).
Name ADR-054. Keep the dates in the sentences. Note Phase 2.5's widened scope.

**`decisions/2026-09.md`** — one entry, newest at top, four-field template,
recording:

- the maintainer's granularity ruling and **what it bought** — that choosing
  nightly over arbitrary point-in-time removed WAL archiving, a standby restore
  target and full-cluster restore time from the design
- that snapshot and export are **one mechanism**, and why that was stated rather
  than left implied
- the ledger asymmetry, as a design property
- **the two things this ADR deliberately leaves unowned**: total cluster loss,
  and object storage — with object storage flagged as blocking Phase 2.5's
  ability to build any of this
- R-038's status word and its justification

---

## Step 5 — Verify

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
npm run conformance && npm run check:register && npm run graph
```

```bash
grep -cE "^\| ADR-054 " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 1
grep -cE "^## ADR-054 " 02_ADR_INDEX_NORMATIVE_DECISIONS.md   # expect 1
grep -c "^| R-0" RISK_REGISTER.md                              # expect 40
```

Confirm against `PROJECT_GRAPH.md`'s generated register: **57 ADRs, 46 accepted,
3 open**, the three open still being ADR-039, ADR-040 and ADR-041.

`npm run db:migrate` is not required. Commit in two commits — the ADR, and the
phase amendment — then push and report the CI result.

---

## Step 6 — Report

- what you wrote, file by file
- **R-038's status word and its one-sentence justification**, quoted
- what you decided about Phase 2.5's framing, and why
- **any premise in this prompt that did not survive checking** — in particular
  the ledger table list, the object-storage exclusion, and whether ADR-020 rule 3's
  window is really 30 days. If one is wrong, stop and report rather than writing
  it; this has already happened three times in this programme
- what remains owed, including the two items this ADR deliberately does not own

---

## Hard boundaries

- **Documentation only.** No migration, no table, no capability, no job, no
  infrastructure.
- **Do not invent an RTO.** A measured number or none.
- Do not open a risk row for total cluster loss — recommend it and let the
  maintainer decide.
- Do not split or rename a phase on your own initiative.
- Do not touch ADR-039, ADR-040 or ADR-041.
- Never weaken a conformance rule, the register check, or add an
  `exceptions.json` entry.
- No reading of `future/`.
- If you become uncertain: stop and write the ambiguity down with options and a
  recommendation.
