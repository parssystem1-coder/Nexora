# SESSION 7 — Four small items, then Phase 2 opens for code

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست.

> Model: Opus. `D:\Nexora` connected. **Documentation-only.**
> No migration, no table, no capability, no code.

Four loose ends, all raised by the previous session's own findings. Each is
small. Together they are the last documentation work before slice 1.

**All four are maintainer rulings taken on 2026-09-03, not questions.**

---

## Step 0 — Read and verify

1. `AGENTS.md`
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-054**'s body in full, plus
   **ADR-006** and **ADR-010** (the two ADRs that carry dated amendments — the
   precedent item 4 follows), and **ADR-029**
3. `PHASE_2_BRIEF.md` §9 in full
4. `06_IMPLEMENTATION_PLAN.md` — the phase list
5. `RISK_REGISTER.md` — the preamble and rows **R-025** and **R-038** only
6. `modules/identity/migrations/20260822090100_identity__create_sessions.sql`
   and `modules/tenant/migrations/*memberships*`

```bash
grep -o "^| ADR-[0-9b]*" 02_ADR_INDEX_NORMATIVE_DECISIONS.md | sort -u | tail -2
grep -o "^| R-0[0-9]*" RISK_REGISTER.md | tail -1
grep -c "^| R-0" RISK_REGISTER.md
npm run check:register && git status --short
```

Expected: highest ADR **ADR-054**, highest row **R-040**, count **40**, register
check green, clean tree. Next free row is **R-041**. **If any differs, stop.**

---

## Item 1 — Rename Phase 2.5. Do not split it.

The previous session recorded that `Commercial Growth` under-describes a phase
that now also carries recovery, export and drills, and left the decision here.

**Ruling: rename, do not split.** The phase is one coherent thing — *what must
exist before the first paying tenant.* Selling needs discounts and referrals;
being trustworthy needs export, restore and drills. Splitting would create a
Phase 2.6 and a second set of exit criteria for no gain.

**New name: `Phase 2.5: Launch Readiness`.**

Rename it in `06_IMPLEMENTATION_PLAN.md` and in `PHASE_2_BRIEF.md` §9's heading
and body, as a **dated amendment** in each file's own style — both files
established that precedent on 2026-09-03. `grep -rn "Commercial Growth"` across
tracked Markdown and update every occurrence; **report how many you found**, and
leave any occurrence inside a dated record alone (a dated record says what was
true when written).

## Item 2 — Re-rate R-025

Its Likelihood cell reads *"Low near-term — two full phases away from current
work."* That was accurate on 2026-08-28 and is false now: object storage is a
**prerequisite of the immediately next phase**, blocking three of Phase 2.5's
four recovery items.

**Ruling: re-rate it up**, on both axes, with the reasoning stated.

Use the register's **no-rewrite convention** — a dated correction above the
superseded text, struck through, not a silent edit. Derive the new wording
yourself from what ADR-054 and §9.7 actually establish; do not paste a rating
from this prompt. State plainly what changed: not the risk, but its distance
from current work.

## Item 3 — Open R-041: total loss of the cluster

ADR-054 explicitly excludes this and recommended a row rather than opening one.
Open it.

**What it records:** there is no physical backup, no off-site copy and no
restore drill for the total loss of the machine carrying the database. ADR-054's
nightly snapshots recover **one tenant from a logical snapshot**; they are not a
disaster-recovery mechanism and would themselves be lost if they lived only on
the same host. Nothing in any phase owns this today.

**Keep it distinct from its two neighbours, and say how in the row itself:**

- **R-038** is tenant-granular recovery — one tenant, logical, ADR-054's
  mechanism.
- **R-025** is the absence of an object-storage port — the substrate both this
  row and ADR-054 depend on.
- **R-041** is total loss — a different mechanism entirely (physical backup,
  off-site replication), and an operational concern rather than an architectural
  one, which is precisely why no ADR owns it and why it needs a row.

Status **OPEN**, opened **2026-09-03**, owner the maintainer. In the Mitigation
column, record that the mitigation is largely **procurement and operations** —
host-level backups and an independent off-site copy — not application work, and
that it therefore does not block any slice. **Do not invent an RPO or RTO for
it.**

`npm run check:register` after the edit.

## Item 4 — Amend ADR-054: sessions on restore

ADR-054 named this edge and did not answer it: `sessions` carries no
`tenant_id`, so it is not tenant-partitionable the way the snapshot mechanism
assumes.

**Ruling, in two halves — and the first half is the security-relevant one:**

**1. `sessions` rows are excluded from the snapshot and are never restored.**
Restoring a session row would resurrect a session that had been deliberately
revoked between the snapshot and the incident — a live credential brought back
from the dead. **State this as the reason, prominently**, because it is the half
that would otherwise be got wrong by someone reasoning only about completeness.

**2. A restore revokes the live sessions of that tenant's members.** After a
restore, what a signed-in user's client believes no longer matches the database,
so continuing the session shows stale state. The rows are reachable without a
`tenant_id` on `sessions`: `memberships` carries `tenant_id`, joins to the user,
and the user's sessions follow. **Verify that join path against the two
migrations before asserting it**, and if the columns are not what this prompt
describes, stop and report.

Write it as a **dated amendment** to ADR-054 — the shape ADR-006 and ADR-010
already use — not as an edit to the ruling text. The ADR was accepted the same
day; the amendment answers a question it named, and the record should show that
sequence rather than hiding it.

Note in the amendment that this touches nothing in ADR-053 (session retention)
and nothing in ADR-051 (`SESSION_INVALIDATED`), and say why: retention is about
purging expired rows on a clock, and ADR-051 is about a code returned to a
request in flight. Three different things about the same table.

---

## Step 3 — Summaries

**`CLAUDE.md`** — risk rows **40 → 41** (OPEN **32 → 33**). ADR count unchanged
at **57**. Note ADR-054's amendment and Phase 2.5's new name. Keep the dates
inside the sentences.

**`decisions/2026-09.md`** — one entry, newest at top, four-field template:
the four rulings, the rename's occurrence count, why splitting the phase was
rejected, and — for item 4 — that the security half drove the ruling rather than
the completeness half.

---

## Step 4 — Verify

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
npm run conformance && npm run check:register && npm run graph
grep -c "^| R-0" RISK_REGISTER.md        # expect 41
grep -o "^| R-0[0-9]*" RISK_REGISTER.md | tail -1   # expect R-041
grep -rn "Commercial Growth" --include=*.md . | wc -l
```

Confirm against `PROJECT_GRAPH.md`: **57 ADRs, 46 accepted, 3 open** — ADR-039,
ADR-040, ADR-041 *(note: ADR-041 the decision and R-041 the risk row are
unrelated and now share a number; say so in your report if anything reads
ambiguously)*.

Commit in two commits — the register changes, and the phase rename plus the ADR
amendment. Push and report CI.

---

## Step 5 — Report

- what you wrote, file by file
- how many `Commercial Growth` occurrences you found, and how many you left
  alone because they sit inside dated records
- **the join path you verified for item 4**, from the migrations
- R-025's old and new ratings, quoted
- any premise here that did not survive checking — **stop rather than write it**;
  this has happened four times in this programme and each catch was worth more
  than the prompt that missed it
- what remains owed

---

## Hard boundaries

- Documentation only. No migration, no table, no capability, no code.
- Do not split Phase 2.5.
- Do not invent an RPO or RTO for R-041.
- Do not edit ADR-054's ruling text — amend it, dated.
- Never weaken a conformance rule, the register check, or add an
  `exceptions.json` entry.
- No reading of `future/`.
- If uncertain: stop and write the ambiguity down with options and a
  recommendation.
