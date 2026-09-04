# SESSION 16 — Three things that must be decided before a real server exists, and one that was left hanging

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **Documentation only — no migration, no table, no adapter, no dependency.**
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session

The ADR index now has no `OPEN` row. What remains from the pre-Phase-2 audit is
three decisions and one loose end, and all four share a property: **they are free
today and they are procurement or an incident later.**

1. **R-025** — object storage has no port, and four separate things now depend on
   one existing.
2. **R-041** — total loss of the cluster has no recovery path. ADR-054 recommended
   this row rather than opening it, and named the reason: per-tenant recovery is a
   different mechanism from cluster recovery.
3. **The certificate question Session 14 surfaced and correctly refused to rule.**
   ADR-027 item 4 renews automatically; item 10 leaves a certificate to expire
   naturally; neither says which applies while a store is suspended.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-054 in full including its
   `What this ADR does not do`**; **ADR-027 in full** (items 3, 4, 10);
   **ADR-059** (recorded in Session 14 — its 503→410 boundary is Part A's whole
   argument); **ADR-023** (items 1, 4, 7, 8, 9 and *Adding a new provider* — Part B
   copies its discipline); **ADR-037 in full**; **ADR-041**'s ruling (its Part 6
   deferred disposal to object storage); **ADR-020** (rules 4 and 5);
   **ADR-019**; **ADR-048**'s ruling part 2
3. `03_TECHNICAL_BLUEPRINT.md` §9 — the "keep behind contracts from day one" list,
   which already names object storage
4. `RISK_REGISTER.md` — **R-025 and R-041 in full**, plus any row about backup,
   recovery, encryption or key management
5. `PHASE_2_BRIEF.md` — §4's out-of-scope list (`files` is on it), §9's Phase 2.5
   sections including 9.6 and 9.7
6. `docker-compose.yml`, `platform/db/` — what a restore would actually have to
   reconstruct

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — Establish, before any ruling

**1.1** Confirm the next free ADR numbers and risk-row ids from the files.

**1.2** Quote ADR-054's own words about what it does **not** cover. Part C rests on
that sentence and must not paraphrase it.

**1.3** Does anything in the repository already describe a backup, a snapshot
schedule, a restore procedure, or an RPO/RTO target? Grep for it. **Report "nothing"
if that is the answer** — Session 11 found far more already built than expected, and
Session 15 found the logger already chosen. Do not assume this is greenfield either.

**1.4** Is there any operational runbook file in the repository today, and does
`AGENTS.md` §1's authority list mention one? Part C has to put a runbook somewhere
and the answer decides where.

---

## Step 2 — Part A: the certificate question, ruled

Record as a **dated amendment to ADR-027**.

### A1 — The tension, as Session 14 established it

- item 4: *"automatic renewal starting at a configured margin before expiry,
  default 30 days"* — with no exception for a non-serving store
- item 10: *"the certificate is left to expire naturally rather than being revoked"*

Read together they are ambiguous about the case that actually occurs: a store whose
subscription lapsed, whose certificate renewal window arrives while it is dark.

### A2 — The ruling, and the reason it is the same boundary as two other rules

> **Renewal continues for as long as the subscription can still be revived** —
> through ADR-024 item 4's grace window and item 6's reactivation window.
> **It stops at the moment the subscription becomes `CANCELED`**, and from then on
> item 10 applies exactly as written: the certificate is left to expire naturally.

**That is the same boundary ADR-059 uses to turn 503 into 410, and the same one
ADR-028's amendment uses to reserve a platform subdomain permanently.** Say so in
the amendment. One lifecycle boundary with three consequences is a thing a person
can hold in their head; three boundaries that nearly coincide is how they drift
apart.

Three reasons to record:

1. **A 503 needs a valid certificate to be seen at all.** ADR-059 rules that a
   suspended store returns 503 with `Retry-After`, which is a considered, SEO-safe
   answer — and a visitor whose browser refuses the connection over an expired
   certificate never receives it. An expired certificate converts a designed
   response into a browser interstitial.
2. **Reactivation must be instant.** ADR-024 item 6 promises reactivation restores
   *"the same store, domains and data"*. A tenant who pays and then waits for
   certificate issuance has not been restored.
3. **It costs nothing.** ADR-059 already requires the ACME challenge path to answer
   while a store is non-serving, so the mechanism is in place, and automated
   issuance is free.

### A3 — The condition this ruling depends on, stated so it can be checked later

Reason 3 holds **only while certificates come from an automated, free issuer.** If
the platform ever buys certificates per hostname from a commercial CA, renewing for
non-paying tenants becomes a real cost and this ruling is what must be revisited.
Record that as the trigger. **Do not bury it** — it is the only thing that makes
the ruling contingent.

---

## Step 3 — Part B: the object storage port

Record as a **new ADR**. **The port only. No adapter, no vendor, no bucket, no
credentials, no Phase 2 table** — `files` is on §4's out-of-scope list and stays
there.

### B1 — Why now: it has four consumers, and that is what shapes a port

`03` §9 already lists object storage among the things to *"keep behind contracts
from day one"*, and R-025 records that no such contract exists. What has changed is
that the consumers are now named:

- **ADR-054** — per-tenant recovery archives, Phase 2.5, which that ADR already
  calls a hard prerequisite
- **ADR-041**'s ruling Part 6 — ledger archival, deferred explicitly *because*
  there is nowhere to put an archive
- **Part C of this session** — the WAL archive
- Phase 3 — store media

A port designed against four known consumers is a different and better artifact
than one designed against zero.

### B2 — Shape it after S3 semantics, and say why that is not a vendor choice

Every candidate the platform could realistically use — the Iranian cloud providers
and the S3-compatible servers used for local development alike — speaks the S3
API. **Choosing those semantics is choosing the intersection of the market, not
choosing a supplier**, and that distinction is the whole justification. Write it
down, because "we picked S3" reads like a vendor decision unless the reason is on
the page.

### B3 — Capability flags, on ADR-023's discipline

ADR-023 item 1 established that a port *declares what a provider can do* and that
*"application code branches on declared capability, never on provider name"*, and
item 9 confines every SDK, URL and field name to the adapter. Apply both.

Declare at least: presigned URLs, multipart upload, versioning, lifecycle rules,
server-side encryption, and **object immutability (object lock / WORM)**.

**Immutability is the flag that carries weight and the ADR should say why:** a
backup that a compromised credential can delete is not a backup. Part C depends on
this flag existing, and a provider that lacks it is legal — the platform then knows
its backups are deletable and can say so, which is better than assuming they are
not.

### B4 — Two rules that are security rules, not conveniences

1. **Keys are tenant-prefixed, and a tenant never controls a key segment
   unsanitised.** A filename that a tenant supplies, concatenated into a key, is
   how one tenant reads or overwrites another's objects. State it as a rule with
   that failure named.
2. **Two registries, platform-scoped and store-scoped**, exactly as ADR-023 item 7
   requires for payment providers and for the same reason: *"they must never be
   resolvable from the same context."* Credentials live under ADR-037's rules,
   including its item 3 prohibition, which now also covers logs after Session 15.

### B5 — Trigger

The first consumer to be built — ADR-054's Phase 2.5 recovery, or Part C's WAL
archive, whichever comes first. **The ADR is the contract; the adapter arrives with
its consumer.**

---

## Step 4 — Part C: cluster recovery, and the number nobody has said out loud

Record as a **new ADR**, plus a **runbook file** placed where Step 1.4's answer
says it belongs.

### C1 — The finding that makes this urgent rather than tidy

ADR-054 rules per-tenant recovery **from nightly snapshots**. Nightly snapshots, on
their own, mean the platform can lose **up to twenty-four hours** of writes.

Apply that to what the platform actually stores. A payment verified at 23:50 and a
cluster lost at 23:55 is **money received with no record of it on our side.** The
customer was charged, the provider has the record, and the platform has nothing —
no intent, no event, no invoice. Every one of those tables is append-only, so there
is nothing to reconcile *from*; the reconstruction has to come from the payment
provider.

**That is the argument for the ruling. Lead with it.**

### C2 — The ruling

1. **Targets, stated as choices rather than derivations:**
   - **RPO ≤ 5 minutes** for financial data
   - **RTO ≤ 4 hours** for a full cluster restore

   Both are numbers the maintainer is choosing. Record them that way, in the
   epistemic style ADR-041 and ADR-048 established, so a later reader knows they
   are negotiable and against what.

2. **Nightly snapshot plus continuous WAL archiving.** The snapshot alone cannot
   meet a 5-minute RPO and no amount of scheduling makes it. The WAL archive goes
   to object storage — **so this ruling depends on Part B and must say so.**

3. **At least one copy outside the account that runs the cluster.** A compromised
   or mistakenly closed provider account that holds both the database and its
   backups has no recovery path at all. Where the provider offers immutability
   (Part B's flag), the backup copy uses it.

4. **Backups are encrypted, and the key does not live with the backup.** Note that
   ADR-037's resolver deferral applies here too — until a resolver exists, this key
   is in configuration like every other secret, and that is a stated limitation
   rather than a silent one.

5. **A backup is a hypothesis until a restore has been performed.** Rule a drill
   cadence — **quarterly** — performed against a scratch environment, with the
   result **written down**, including the measured restore time against the RTO
   target. **Until the first drill has run, the platform does not claim a recovery
   path**, and R-041 stays open regardless of what has been configured.

### C3 — The runbook, written while nobody is under pressure

It must answer, at minimum:

- who declares the incident, and what they do first
- where the snapshot and the WAL archive are, and what credentials reach them
- the restore sequence, in order, including the role bootstrap
  (`platform/db/init/*.sql` creates the roles the whole RLS model depends on — a
  restore that omits it produces a database the application cannot safely use)
- **how completeness is verified.** The append-only tables give natural checks the
  runbook should name: the last invoice number issued (ADR-048's gap-free counter
  makes a gap detectable), and the newest `audit_events` timestamp against the
  moment of loss.
- **how payments taken inside the lost window are recovered.** This is the step
  that is usually missing and it already has a mechanism: ADR-023 item 4's
  reconciliation sweep exists to resolve `PENDING` intents against the provider,
  and it is exactly the right tool here. Say so — reusing a mechanism the platform
  already owes is better than inventing a recovery-only one.
- what is communicated to tenants, and when

### C4 — What is deferred, and what is not

**Procurement is deferred** — no provider is chosen, nothing is bought, and the
maintainer has said this happens at launch. **The policy, the targets and the
runbook are not deferred**, because they are what the procurement decision will be
judged against, and choosing a provider before knowing the RPO you need is how one
ends up with the wrong product.

---

## Step 5 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`** — the dated amendment to ADR-027
   (Part A); two new ADRs (Parts B and C); a dated cross-reference in **ADR-054**
   noting that cluster recovery now has an owner, and in **ADR-041** noting its
   Part 6 archival dependency now has a port; §1.1 rows for both new ADRs with
   honest `Blocks` cells.
2. **the runbook file** — at the path Step 1.4's answer supports. If `AGENTS.md` §1
   should reference it, **say so and say why, but do not edit `AGENTS.md` without
   stating that you are changing authority #1.**
3. **`PHASE_2_BRIEF.md`** — a dated amendment only if §9's Phase 2.5 sections now
   owe something. §9.7 already records that object storage has no owner; if Part B
   changes that, it belongs there. **§4 gains no table.**
4. **`RISK_REGISTER.md`**
   - **R-025** — dated addendum: a port shape exists; nothing is bought; the
     trigger is unchanged.
   - **R-041** — dated addendum: a policy, targets and a runbook exist; **the row
     stays open until the first restore drill**, per C2 item 5. Say that explicitly
     in the addendum, because a reader who sees a runbook will assume otherwise.
   - a new row only if something here is uncovered. `npm run check:register` must
     pass; escape every `|` inside a cell.
5. **`decisions/2026-09.md`** — one entry: the certificate boundary and that it is
   shared with two other rules, the S3-semantics-as-intersection reasoning, the RPO
   finding and the two targets as choices, and that R-041 stays open by design.
6. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is stale.

---

## Step 6 — Verify

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

One commit, repository style, referencing ADR-027, ADR-054, R-025 and R-041.

---

## What to report back

1. Step 1.2's quote from ADR-054, verbatim.
2. Step 1.3's answer — what, if anything, already exists about backups.
3. Where you put the runbook and why, and whether `AGENTS.md` should point at it.
4. Whether ADR-027 item 10's "left to expire naturally" really does sit
   comfortably after the boundary in Part A2, in your own reading of item 10's
   context — **or whether item 10 was written about domain removal rather than
   subscription lapse**, in which case Part A is answering a question item 10 never
   asked and the amendment must say so.
5. Whether R-041 staying open reads correctly against the register's own status
   vocabulary.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.** Two of the last three sessions found
   this prompt's author re-ruling something an ADR had already settled — once with
   the preference order inverted, once recommending a dependency the ADR's own
   preferred option forbade. Check Parts B and C against `03` §9 and ADR-054 the
   same way.

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a file
against that file. Where it is wrong, **stop and report rather than working around
it.**
