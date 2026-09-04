# Audit Programme — state, and how to pick it up

> **سند غیرنرمتیو.** این فایل هیچ چیزی را تصمیم نمی‌گیرد و در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست. کارش فقط این است که اگر گفتگو قطع شد یا سشن جدیدی شروع شد،
> بشود از همین‌جا ادامه داد. **این فایل حذف نمی‌شود؛ به‌روز می‌شود.**

**Last updated: 2026-09-04, after session 18.**

---

## What this programme is

An analyst session (in the Claude desktop app, reading `D:\Nexora` read-only)
writes execution prompts; a separate Claude Code session with repository access
carries them out and reports back; the analyst reviews the report against the
repository and either issues a correction or moves to the next item.

**The analyst never edits normative documents.** It writes prompt and plan files
into the repository root, each carrying a "سند غیرنرمتیو" header, and those files
are deleted once spent. **One exception, established 2026-09-04: a file that the
normative documents end up *citing* stops being a spent prompt and becomes a dated
source document, which is retained.** See the housekeeping note below.

**The single source of truth is `D:\Nexora` on the maintainer's computer.** Any
other copy — in a cloud workspace, in a summary, in a prior session's memory — may
be stale. Verify against the repository before trusting anything, including this
file.

---

## The working rule that has repeatedly paid off

Every prompt in this programme ends with the same instruction: *verify every
factual claim the prompt makes about a file against that file; where it is wrong,
stop and report rather than working around it.*

**Every session so far has found at least one false premise.** Among them: a
recommendation that an already-ruled ADR forbade; a preference order stated
backwards against ADR-027 item 3; a rule about `ALTER DEFAULT PRIVILEGES` that was
scoped to one schema; an RPO target invented when ADR-010 already carried one; and
a ruling that had to be withheld entirely because the empirical evidence
disqualified its premise. **Keep the instruction in every prompt.**

---

## What has been done

| Session | Subject | Outcome |
|---|---|---|
| 9 | ADR-041 — the four PostgreSQL questions | Answered empirically; **ruling withheld**, because a parent-only RLS policy does not protect partitions (R-042) |
| 10 | ADR-041 ruling | Ruled as a fifth option: partition-*compatible*, not partitioned. Built `npm run check:partitions` with a deliberately failing fixture |
| 11 | Tax and currency | ADR-055 (tax on a subscription purchase) and ADR-022's amendment (IRR stored, Toman displayed, machine output in IRR). `tax_rates` added to §4 |
| 12 | Credit notes and buyer identity | ADR-056 and ADR-057; `billing_profiles` added to §4; a sixteenth capability added to §3 |
| 13 | Payment | ADR-023's amendment (declared wire unit, charging granularity, the per-vendor checklist), ADR-055's second amendment (tax absorbs the rounding), ADR-058 (direct debit not in V1) |
| 14 | Domains and the edge | ADR-059 (status codes for a non-serving host), amendments to ADR-019, ADR-027 and ADR-028 |
| 15 | The last two open ADRs | ADR-039 and ADR-040 ruled. **No `OPEN` ADR remains.** Added a pooled-connection tenant-context test and extended the domain import rule |
| 16 | Storage, backup, certificates | ADR-060 (object storage port), ADR-061 (cluster recovery), ADR-027's certificate amendment, `RUNBOOK_DISASTER_RECOVERY.md` |
| 18 | The 44 competitive rulings | All recorded. **Seven ADR amendments, one error code, two brief amendments, twelve phase placements, one risk row — and no new ADR, because none was needed.** R-044 opened |

**State after session 18:** 64 ADRs — 56 accepted, 8 deferred, **zero open**;
**no new ADR was written, only amendments.** 44 risk-register rows, 34 open.
Phase 2 still at 31 tables and 16 capabilities, **zero feature code written**.

### What session 18 recorded, and where

| Where | What |
|---|---|
| `02_ADR_INDEX_NORMATIVE_DECISIONS.md` | Seven dated amendments — ADR-023 (`supportsInstallment` false in V1), ADR-024 (one cadence; the platform pays for lifecycle notifications), ADR-025 (direction from entitlements not price; a fourth **incomparable** case, prohibited), ADR-027 (the seven الف domain rulings), ADR-028 (subdomain domain; trial names), ADR-047 (each term length its own price version), ADR-052 (trial 7 → **14** days) |
| `05_API_CAPABILITY_CONTRACTS.md` §7 | `PLAN_CHANGE_INCOMPARABLE` |
| `PHASE_2_BRIEF.md` §9.13 | The V1 quota list **closed** to `members`, `stores`, `domains`; storage and bandwidth neither enforced **nor advertised**; two item-1 `plan_features` seeds |
| `06_IMPLEMENTATION_PLAN.md` | ث-1 … ث-12, twelve competitive gaps each placed in a phase |
| `RISK_REGISTER.md` | **R-044** — an unrate-limited SMS channel, opened as a **spend** control rather than a notification feature |
| `decisions/2026-09.md` | The commercial rulings (پ, ج, چ) and the category fence that kept them out of the ADRs |

**Three judgements this session made, recorded because a later reader will
otherwise re-litigate them.** Commercial rulings — price, red lines, marketing
claims — **did not enter an ADR**, because an ADR that rules a price is a category
error. The twelve phase placements went to `06`, not an ADR, following the
ADR-048/ADR-057 precedent that an ADR may not amend the owning document. And
**الف-8 was recorded as a confirmation, not a narrowing**: ADR-027 item 4 already
scopes its wildcard exclusion to *tenant-owned* domains and already permits
`DNS-01` where the platform controls the zone, so a delegated zone was always
inside its text.

**One obligation left outside this repository.** ADR-052's trial is now 14 days;
the commercial specification it was originally justified against
(`D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md` §2)
still says 7 and is out of step. **Nobody inside this repository can reconcile the
two** — it needs the owner of that document.

---

## What is next, in order

1. **`SESSION_17_PLAN_LIST_SLICE_PROMPT.md`** — Phase 2 item 1, `plan.list`. The
   first Phase 2 code, after sixteen sessions of documentation. Ends at a
   hand-review stop; do not begin item 2. **Its precondition is now satisfied** —
   session 18 ran on 2026-09-04, and ruling ب-3's finding is the one it was
   waiting on: **item 1's migration is unchanged.** The prompt file has been
   updated in place to say so.
2. After item 1 is reviewed: items 2 onward, one slice per session, using the
   `/new-slice` skill.

**Session 18 ran first and is done.** The competitive rulings were approved after
the `plan.list` prompt was already written, and three of them (ب-4, ب-5, ب-8) bind
Phase 2 migrations, so they went on the record first.

---

## Files in the repository root, and which are live

**Live — do not delete:**

- `AUDIT_PROGRAMME_STATE.md` — this file
- `SESSION_17_PLAN_LIST_SLICE_PROMPT.md` — until it runs
- `COMPETITIVE_RULINGS_2026-09-04.md` — **retained permanently, and the reason is a
  correction to this file's own earlier plan.** It was listed as spent-once-recorded
  and session 18's prompt ordered it deleted. **It is now cited nine times from
  normative documents** — the seven ADR amendments, `06`'s amendment,
  `PHASE_2_BRIEF.md` §9.13, R-044 and `decisions/2026-09.md` all name it as the
  provenance of a ruling. Deleting it would leave nine dangling references. **The
  precedent decides it:** `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` and
  `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` are dated source documents cited from
  seven files each, and both are retained. **The rule is not "prompts are deleted"
  but "a document nothing cites is spent."**

**Removed on 2026-09-04, as session 18's housekeeping step:** all seventeen spent
`SESSION_*.md` prompts and `NEXORA_PLAN_3ROUNDS.md`. **Those seventeen are in git
history and nothing cited them.** `SESSION_18_COMPETITIVE_RULINGS_PROMPT.md` was
also removed but **was never committed, so unlike the rest it is not recoverable
from git** — its substance survives as the rulings file plus the
`decisions/2026-09.md` entry for that date.

---

## Open items that are not sessions

These are tracked in `RISK_REGISTER.md` and need action outside this programme:

- **R-025** — object storage: a port exists (ADR-060), nothing is bought. Buy at
  launch; the adapter arrives with its first consumer.
- **R-041** — cluster recovery: policy, targets and a runbook exist. **The row
  stays open until the first restore drill actually runs.** A backup is a
  hypothesis until it has been restored.
- **R-043** — the platform issues invoices as a legal entity and registers none
  with سامانه مودیان. Needs a decision with an accountant, not an engineer.
- **The purge split for personal data** — which fields of the buyer-identity
  snapshot survive ADR-020 rule 4's reduction. Recorded as a **low-confidence
  proposal**; the natural-person national ID is the likeliest thing to be wrong.
  A question for an accountant.
- **A separate registrable domain for tenant subdomains** (ruling الف-5) — must be
  purchased before the first customer.

---

## Two artifacts that hold the reasoning

Published on claude.ai, private to the maintainer. They are the readable form of
how the rulings were reached; the repository is the normative record.

- **«ممیزی پیش از فاز ۲»** — every problem found from the start of the programme,
  with the recommendation for each
- **«وبزی از داخل»** and **«حکم‌نامهٔ رقابتی نکسورا»** — the competitor review and
  the 44 rulings that came out of it

If a future session needs them and the links are lost, the maintainer's artifact
gallery lists them.
