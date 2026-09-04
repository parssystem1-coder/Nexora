# Audit Programme — state, and how to pick it up

> **سند غیرنرمتیو.** این فایل هیچ چیزی را تصمیم نمی‌گیرد و در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست. کارش فقط این است که اگر گفتگو قطع شد یا سشن جدیدی شروع شد،
> بشود از همین‌جا ادامه داد. **این فایل حذف نمی‌شود؛ به‌روز می‌شود.**

**Last updated: 2026-09-05, after session 17 — the last prompt of the programme.** Every count below was taken from
the repository on that date, not carried forward from a previous version of this
file.

---

## What this programme is

An analyst session (in the Claude desktop app, reading `D:\Nexora` read-only)
writes execution prompts; a separate Claude Code session with repository access
carries them out and reports back; the analyst reviews the report against the
repository and either issues a correction or moves to the next item.

**The analyst never edits normative documents.** It writes prompt and plan files
into the repository root, each carrying a "سند غیرنرمتیو" header, and those files
are deleted once spent.

**One exception, established 2026-09-04 and re-confirmed 2026-09-05: a file the
normative documents end up *citing* stops being a spent prompt and becomes a dated
source document, which is retained.** The operative rule is *"a document nothing
cites is spent"*, not *"prompts are deleted"*. See the file list below.

**The single source of truth is `D:\Nexora` on the maintainer's computer.** Any
other copy — in a cloud workspace, in a summary, in a prior session's memory — may
be stale. Verify against the repository before trusting anything, including this
file.

> **A process failure worth keeping, 2026-09-05.** After session 18 finished and
> pushed, the analyst pushed **stale copies of three root files over its work** —
> this file was reverted to its pre-session state, a deleted prompt was re-created,
> and the rulings file's header was replaced. **Nothing normative was touched**, so
> the damage was cosmetic, but it cost a session to repair. **The rule it produced:
> the repository is downstream of nobody. An analyst copy never overwrites a file a
> Code session has already updated.**

---

## The working rule that has repeatedly paid off

Every prompt in this programme ends with the same instruction: *verify every
factual claim the prompt makes about a file against that file; where it is wrong,
stop and report rather than working around it.*

**Every session so far has found at least one false premise.** Among them: a
recommendation that an already-ruled ADR forbade; a preference order stated
backwards against ADR-027 item 3; a rule about `ALTER DEFAULT PRIVILEGES` that was
scoped to one schema; an RPO target invented when ADR-010 already carried one; a
ruling that had to be withheld entirely because the empirical evidence disqualified
its premise; and, in session 18, a prompt instruction to delete a file that the
recording had just made load-bearing. **Keep the instruction in every prompt.**

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
| 18 | The 44 competitive rulings (الف–چ) | All recorded. **Seven ADR amendments, one error code, two brief amendments, twelve phase placements, one risk row — and no new ADR, because none was needed.** R-044 opened |
| 19 | The 11 addendum rulings (ح, خ) + repair | All recorded, **again with no new ADR**. R-032 given an owner and a deadline. The three overwritten files rebuilt from the repository |
| 17 | **Phase 2 item 1 — `plan.list`** | **The first Phase 2 code.** New `billing` module, three platform-global tables, ADR-036's pagination contract built as platform machinery, `queryParams` added to `CapabilityRoute`. **Stopped at the hand-review gate** |

### What session 18 recorded, and where

| Where | What |
|---|---|
| `02_ADR_INDEX_NORMATIVE_DECISIONS.md` | Seven dated amendments — ADR-023 (`supportsInstallment` false in V1), ADR-024 (one cadence; the platform pays for lifecycle notifications), ADR-025 (direction from entitlements not price; a fourth **incomparable** case, prohibited), ADR-027 (the seven الف domain rulings), ADR-028 (subdomain domain; trial names), ADR-047 (each term length its own price version), ADR-052 (trial 7 → **14** days) |
| `05_API_CAPABILITY_CONTRACTS.md` §7 | `PLAN_CHANGE_INCOMPARABLE` |
| `PHASE_2_BRIEF.md` §9.13 | The V1 quota list **closed** to `members`, `stores`, `domains`; storage and bandwidth neither enforced **nor advertised**; two item-1 `plan_features` seeds |
| `06_IMPLEMENTATION_PLAN.md` | ث-1 … ث-12, twelve competitive gaps each placed in a phase |
| `RISK_REGISTER.md` | **R-044** — an unrate-limited SMS channel, opened as a **spend** control rather than a notification feature |
| `decisions/2026-09.md` | The commercial rulings (پ, ج, چ) and the category fence that kept them out of the ADRs |

### What session 19 recorded, and where

| Where | What |
|---|---|
| `06_IMPLEMENTATION_PLAN.md` | A second dated 2026-09-04 amendment: **ح-2 in Phase 2.5** (an operator capability to *publish* a plan version and a price version) and **ح-1 plus all nine خ rulings in Phase 3**, beside ث-5's carrier port |
| `RISK_REGISTER.md` | A dated addendum to **R-032**, which now has an owner and a phase instead of a trigger. **It stays OPEN** — a deadline is not a delivery |
| `decisions/2026-09.md` | The eleven rulings, the three cross-reference verifications, and the repair |

**Judgements these two sessions made, recorded because a later reader will
otherwise re-litigate them.** Commercial rulings — price, red lines, marketing
claims — **did not enter an ADR**, because an ADR that rules a price is a category
error. Phase placements went to `06`, not an ADR, following the ADR-048/ADR-057
precedent that an ADR may not amend the owning document. **الف-8 was recorded as a
confirmation, not a narrowing**: ADR-027 item 4 already scoped its wildcard
exclusion to *tenant-owned* domains. And **none of the eleven shipping and
administration rulings became an ADR**, because shipping has no port yet and ruling
a design nobody has drafted is the failure a premature ADR causes.

**State after session 17 (which ran last, despite its number), verified against
the repository on 2026-09-05:**

- **64 ADRs — 56 `ACCEPTED`, 8 `DEFERRED`, zero `OPEN`** (`npm run graph`). Sessions
  18 and 19 wrote **no new ADR**; both worked entirely by amendment.
- **44 risk-register rows, 34 OPEN** (`npm run check:register` passes at 44). The
  ten that are not open: `CLOSED` R-001, R-007, R-009, R-014 · `RESOLVED` R-002,
  R-036, R-040 · `ACCEPTED` R-003, R-030 · `PARTIALLY CLOSED` R-005.
  **A caution for anyone counting these mechanically:** the register's no-rewrite
  convention means a status cell *begins* with its original word and carries dated
  supersessions after it, so reading the first token misreads R-036 and R-040 as
  open. **The last dated entry in the cell governs.**
- **Phase 2 scope unchanged at 31 tables and 16 capabilities** — no session touched
  `PHASE_2_BRIEF.md` §3 or §4 — but **5 of those tables and 1 of those capabilities
  are now built** (items 1 and 2; item 2 surfaces no capability by design).
- **Implemented today: 8 modules, 19 tables, 11 capabilities, 12 routes**; 475 tests
  across 50 files; conformance 0 violations; `exceptions.json` still does not exist.

**The documentation programme is finished. What follows is slices.**

---

## What is next, in order

1. **A hand review of item 1.** `PHASE_2_BRIEF.md` §2's review posture is a stop,
   not a suggestion: *"Stop after item 1, request review, do not begin item 2 until
   approved."* Two things in it are copied by every later slice and expensive to
   change afterwards — **the pagination shape** (`AGENTS.md` §2 makes it the
   platform contract by construction) and **the platform-global-table pattern**. A
   third, version immutability, is load-bearing for the whole billing history.
2. **Two questions the review should settle**, both recorded in
   `decisions/2026-09.md` under 2026-09-05:
   - **`plan_versions` is not on `PHASE_2_BRIEF.md` §5's append-only list**, so its
     immutability is discipline rather than a grant. The slice did not add it — that
     list is §5's to amend — and deliberately made adding it later free.
   - **Ruling ب-8 and ADR-052 pull in different directions** on whether a trial and
     a paid offering are the same plan version. The seed answers it one way; item 4
     owns the resolution.
3. After item 1 is approved: items 2 onward, one slice per session, using the
   `/new-slice` skill. **`06_IMPLEMENTATION_PLAN.md` is the order.**

**Sessions 18 and 19 both ran ahead of 17.** The competitive rulings were approved
after the `plan.list` prompt was written, and four of them (ب-4, ب-5, ب-8, ح-2)
bind Phase 2 or Phase 2.5, so they went on the record first.

---

## Files in the repository root, and which are live

**Live — do not delete:**

- `AUDIT_PROGRAMME_STATE.md` — this file
- `COMPETITIVE_RULINGS_2026-09-04.md` — **retained permanently.** It was originally
  marked spent-once-recorded, and two prompts ordered it deleted. **The normative
  documents now cite it as the provenance of a decision** — seven ADR amendments,
  both of `06`'s 2026-09-04 amendments, `PHASE_2_BRIEF.md` §9.13, R-032, R-044 and
  `decisions/2026-09.md`. Deleting it would leave every one of those dangling. **The
  precedent decides it:** `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` and
  `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` are dated source documents cited from
  seven files each, and both are retained.

**No prompt files remain.** `SESSION_17_PLAN_LIST_SLICE_PROMPT.md` and
`SESSION_19_ADDENDUM_PROMPT.md` were both removed on 2026-09-05 by session 17's
housekeeping step, which its own text authorised. **The programme's prompt queue is
empty**; work continues as slices against `06_IMPLEMENTATION_PLAN.md`, not as
prompts.

**Removed:** all seventeen earlier `SESSION_*.md` prompts and
`NEXORA_PLAN_3ROUNDS.md` on 2026-09-04 — **those are in git history and nothing
cited them.** `SESSION_18_COMPETITIVE_RULINGS_PROMPT.md` was removed on 2026-09-04,
re-created by the analyst, and removed again on 2026-09-05; **it was never
committed, so unlike the rest it is not recoverable from git.** Its substance is the
rulings file plus the `decisions/2026-09.md` entries for 2026-09-04 and 2026-09-05.

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
- **R-044** — an SMS channel with no rate limit is a **spend** risk, not a feature
  gap. The limit must ship **with** Phase 2 item 17's first channel, not after it.
- **R-032** — plan and price administration now has a phase (2.5) but no capability.
  **Adding one is a contract change**: `05` §4.2 names no plan writer.
- **The purge split for personal data** — which fields of the buyer-identity
  snapshot survive ADR-020 rule 4's reduction. Recorded as a **low-confidence
  proposal**; the natural-person national ID is the likeliest thing to be wrong.
  A question for an accountant.
- **A separate registrable domain for tenant subdomains** (ruling الف-5) — must be
  purchased before the first customer.

**One item is outside the repository's authority entirely.** ADR-052 as amended
rules a **14-day** trial. The commercial specification it was originally justified
against — `D:\طرح پیشنهادی\12_COMMERCIAL_PRICING_AND_AI_DIAMOND_ECONOMY_SPEC11.md`
§2 — **still says 7 days and is now out of step.** No session may edit that file;
the two must be reconciled by whoever owns it. The obligation is recorded in
ADR-052's own amendment and in `decisions/2026-09.md` under 2026-09-04.

---

## Two artifacts that hold the reasoning

Published on claude.ai, private to the maintainer. They are the readable form of
how the rulings were reached; the repository is the normative record.

- **«ممیزی پیش از فاز ۲»** — every problem found from the start of the programme,
  with the recommendation for each
- **«وبزی از داخل»** and **«حکم‌نامهٔ رقابتی نکسورا»** — the competitor review and
  the rulings that came out of it

If a future session needs them and the links are lost, the maintainer's artifact
gallery lists them.
