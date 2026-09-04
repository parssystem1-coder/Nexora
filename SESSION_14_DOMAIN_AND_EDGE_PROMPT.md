# SESSION 14 — What a tenant's domain does when the store behind it stops

> **سند غیرنرمتیو.** پرامپت اجرایی برای یک سشن Claude Code. در ترتیب خواندنِ
> `AGENTS.md` §۱ نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.

> Model: Opus. `D:\Nexora` connected. **Docker is not installed** (`CLAUDE.md`).
> **Documentation only — no migration, no table, no feature code.**
> **`/new-slice` does not apply and must not be invoked.**

---

## Why this session, and why it is not "just Phase 4"

Five findings about domains and the edge are unrecorded. Four of them land in
Phase 4. **One of them is owed by Phase 2 item 14 and has a hole in an existing
verification list right now:**

ADR-024 item 9 requires that on a transition to a non-serving state the platform
*"invalidate effective entitlement cache, remove the store from the serving set,
invalidate storefront and CDN cache (ADR-019), and emit `SubscriptionExpired`"*,
and calls a storefront that stays live *"a release-blocking defect."* Its
verification list then says the storefront must stop serving **"within the defined
bound."**

**No document defines that bound.** A release-blocking criterion with an undefined
threshold cannot fail, which means it cannot pass either.

The other four are recorded now because they cost nothing today and because two of
them — what a tenant is told to put in their DNS, and whether a released subdomain
can be claimed by someone else — become **permanent public contracts** the moment
the first tenant acts on them.

---

## Step 0 — Read, then prove the tree is clean

1. `AGENTS.md` — §1, §3, §4, §5, §7
2. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` — **ADR-019 in full**, **ADR-027 in
   full** (especially item 7 on the single primary and item 10 on certificate
   expiry), **ADR-028 in full** (the `UNIQUE (hostname_ascii) WHERE
   status='VERIFIED'` rule and the unknown-host behaviour), **ADR-020** (the four
   states and rules 1–7), **ADR-024** (items 2, 6, 9, 10 and the verification
   list), **ADR-026**, **ADR-032**, **ADR-010**
3. `PHASE_2_BRIEF.md` — §4's out-of-scope list (the §2.7 domain tables), §5, and
   whatever describes **item 14** and its `subscription.deprovision` job
4. `04_DATABASE_BLUEPRINT.md` §2.7, and whatever describes `reserved_subdomains`
5. `RISK_REGISTER.md` — grep for rows about domains, DNS, CDN, subdomain,
   certificate, SEO
6. Any code or migration for `reserved_subdomains` — it exists from an earlier
   phase; establish what it currently holds and who writes it

```bash
git status --short && git log --oneline -5
npm run conformance && npm run check:register && npm run check:partitions
npm run typecheck && npm run test
```

**If the tree is not clean or anything is red, stop and report.**

---

## Step 1 — Establish three things before recording

**1.1** Confirm the next free ADR number and risk-row id. This prompt assumes
**ADR-059**; verify from the file.

**1.2 Quote ADR-024's verification bullet about the serving bound verbatim, and
confirm that no document defines the bound.** Grep for it. If something does define
it, **stop and report** — Part A becomes a correction rather than a first record.

**1.3** Read `reserved_subdomains` — its migration and any code that writes it — and
state what it currently reserves and why. Part C rules on it and must not assume.

---

## Step 2 — Part A: the bound, and the fact that there are two of them

Record as a **dated amendment to ADR-019**, with a dated cross-reference from
ADR-024 item 9 pointing at it.

### A1 — One bound is not enough, and this is the substance of the ruling

ADR-024 item 2 already says *"Serving state is derived, not stored twice"* and that
exactly one function answers whether a tenant may be served. So the **origin** stops
serving as soon as the data says so — bounded only by whatever entitlement cache
sits in front of that function.

The **edge** is a different machine with a different clock. A page already cached at
a CDN keeps being served until it expires or is purged, and nothing the origin does
changes that.

**So the ruling defines two bounds and names the mechanism for each:**

| Bound | Mechanism | Ruled value |
|---|---|---|
| Origin | the deprovision job invalidates the entitlement cache; the cache's own TTL is the ceiling if the job fails | **60 seconds** |
| Edge | the job requests a purge; the response's `s-maxage` is the ceiling if the purge fails or is unsupported | **5 minutes** |

### A2 — The consequence that makes this enforceable rather than aspirational

**A promised bound is an upper limit on cache lifetime.** If the platform promises a
storefront goes dark within five minutes, then no storefront response may carry an
`s-maxage` greater than 300 seconds, because a purge is best-effort and the TTL is
the only thing that holds when it fails.

Record that as a rule on ADR-019's caching, not as a note. It is the single line
that turns "we will invalidate the cache" into something a test can check.

### A3 — Purge is a port capability, not an assumption

ADR-019 already establishes that *CDN and DNS are a port, not a vendor.* Apply
ADR-023's own discipline to it:

- the CDN port **declares** whether it supports purge, and whether purge is
  by-URL, by-tag, or whole-zone only
- application code branches on the declared capability, never on a vendor name
- a provider that cannot purge is legal — the edge bound is then the `s-maxage`
  alone, and the platform's promise is whatever that TTL is

### A4 — A failed purge is not allowed to be silent

The difference between the two bounds is a factor of five, and a **persistently**
failing purge makes the promise unbounded rather than merely slow. So: the
deprovision job records the purge outcome — `scheduled_job_runs` already carries
job name, status, timings and error, so **confirm that from §4 and do not invent a
table** — and repeated failure escalates to a human queue rather than being
retried forever, in the same shape ADR-023 item 4 already uses for a
`provider-unknown` payment.

---

## Step 3 — Part B: what a resolving host returns when the store behind it is not serving

Record as a **new ADR** at the number Step 1.1 confirmed. This is its own decision
because it spans the subscription lifecycle, the storefront, and how a search engine
treats the site — and it belongs to none of them alone.

### B1 — The matrix

| Situation | Status | Reason to record |
|---|---|---|
| host resolves to no `VERIFIED` domain | **404** | ADR-028 already rules this; carry it in for completeness and cite it rather than restating it as new |
| domain verified, subscription not serving (`EXPIRED`, `PAST_DUE` past grace, `SUSPENDED`, `PAUSED`) | **503** with `Retry-After` | the condition is temporary and the platform intends the site to come back |
| store permanently gone — past ADR-020's reversible window, or `CANCELED` past ADR-024 item 6's reactivation window | **410** | the condition is permanent, and 410 says so where 404 only says "not here today" |
| a missing path inside a serving store | **404** | ordinary |

### B2 — The transition that ties this to the lifecycle, and the reason it is the important half

**A 503 is a promise that the site is coming back.** Held indefinitely, it stops
being true — a search engine that sees an unavailable site for weeks will treat the
URL as gone regardless of the code. So the status must **change with the
subscription's own state**, not sit at 503 forever:

> A host serves 503 while the subscription can still be revived — through grace
> (ADR-024 item 4) and through the reactivation window (item 6, default 30 days).
> When that window closes and the subscription becomes `CANCELED`, the host serves
> **410**.

This is the rule that makes B1 more than a table: **the HTTP status is a projection
of the lifecycle state**, computed by the same derived function ADR-024 item 2
already requires, not a separate switch someone flips.

### B3 — Two prohibitions, both of which are the standard way this gets done wrong

1. **Never a `200` carrying an "unavailable" page.** A success status with an error
   body is a soft 404: it tells every automated consumer the page is fine and keeps
   the content indexed as the real thing.
2. **Never a redirect to a platform-branded page.** Sending a tenant's domain to a
   Nexora page moves the tenant's traffic and their search signals onto the
   platform's own hostname. Whatever the platform's SEO interest, doing it with a
   customer's domain without their agreement is not the platform's to take.

### B4 — What still answers while the store does not

A non-serving host is not a dead host. These must keep working, and the ADR should
say why each one is on the list rather than just listing them:

- **the ACME HTTP-01 challenge path** (`/.well-known/acme-challenge/…`) —
  certificate renewal must not fail because a subscription lapsed. ADR-027 item 10
  already rules that a certificate is *left to expire naturally*; a suspended store
  whose certificate then expires fails with a browser interstitial instead of a
  clean 503, which is a worse outcome for a tenant who is about to pay.
- **the domain-verification path**, if HTTP verification is used at all — a tenant
  fixing their domain while suspended must be able to.
- **nothing else.** In particular `robots.txt` returns 503 with everything else, and
  the ADR should note that this is deliberate and correct: a crawler that cannot
  read `robots.txt` backs off rather than crawling, which is exactly the desired
  behaviour for a store that is temporarily dark.

---

## Step 4 — Part C: a platform subdomain is never given to a second tenant

Record as a **dated amendment to ADR-028**.

### C1 — The hazard, stated concretely

`shop-a.<platform>` belongs to tenant A. Tenant A leaves. Tenant B signs up and
asks for `shop-a`. Every link, bookmark, QR code, printed card, third-party
integration and callback URL still pointing at that hostname now reaches **tenant
B's store**. This is not a cosmetic confusion — a callback or redirect URL that
still resolves is a live path into a system that no longer belongs to the party
that configured it.

### C2 — The ruling

> **A platform subdomain, once assigned to an organization, is never assigned to a
> different one.** On offboarding it moves permanently into `reserved_subdomains`.

It may be returned to **the same** organization — ADR-024 item 6 already promises
reactivation restores *"the same store, domains and data"*, and that promise is only
keepable if the name was not given away.

The cost is that the namespace only ever shrinks, and the ADR should say so plainly
rather than pretending it is free. At ADR-010's assumed scale it is not a
constraint that binds.

### C3 — The distinction that must be drawn, or the rule will be misapplied

**This applies to platform-owned subdomains only.** A customer-owned domain is
different: if tenant B genuinely buys a domain tenant A once used, DNS ownership is
the proof, and ADR-028's existing `UNIQUE (hostname_ascii) WHERE status='VERIFIED'`
already handles it correctly — the first registration must be unverified before the
second can verify.

**Say why the two are different rather than just that they are:** for a customer
domain, control of DNS *is* the ownership check, and it changed hands legitimately.
For a platform subdomain, nothing changed hands — the platform simply reissued a
name, and only the platform can prevent that.

---

## Step 5 — Part D: what the platform publishes in a tenant's DNS is a permanent public contract

Record as a **dated amendment to ADR-027**.

### D1 — The constraint

Whatever value a tenant is told to put in their zone ends up in **thousands of DNS
zones the platform does not control and cannot edit.** Changing it later means
asking every tenant to act, and the ones who do not act go dark.

So the published value must be something the platform can **repoint without asking
anyone.**

### D2 — The ruling

1. **Wherever the record type allows a name, publish a hostname the platform
   controls** — a `CNAME` target — never a bare address. A hostname can be
   repointed at a new edge, a new vendor, or a new region by changing one record
   the platform owns.
2. **The apex is the exception, and the ADR must state why:** a zone apex cannot
   hold a `CNAME`, because the apex must also hold `SOA` and `NS` and `CNAME`
   cannot coexist with other records at the same name. The two supported paths are
   therefore:
   - **preferred** — the tenant's DNS provider supports `ALIAS`/`ANAME` or CNAME
     flattening, and the apex resolves through the platform's hostname exactly like
     `www` does
   - **fallback** — a fixed anycast address the platform publishes, used only when
     the tenant's provider offers no flattening
3. **The published address, when the fallback is used, is an edge address and never
   an origin's.** An origin address in ten thousand zones is both an unchangeable
   hosting decision and a directly attackable target that bypasses every protection
   the edge provides.
4. **The origin accepts traffic only from the edge.** State the requirement — the
   mechanism (an authenticated header, mutual TLS, or a network allowlist) is the
   CDN port's business and is chosen when a vendor is chosen, exactly as ADR-023
   leaves per-provider detail to adapters.

### D3 — And say what this buys the tenant, because it is the reason they asked

A tenant's own domain — apex, with no platform prefix — serving their store
directly is what this makes possible, and it is worth one sentence in the ADR: the
tenant's brand is the hostname, the platform is invisible in the URL, and the
tenant's search authority accrues to the tenant's domain rather than to a
platform subdomain.

---

## Step 6 — Where each thing is recorded

Existing text is never reworded or deleted; corrections are dated addenda.

1. **`02_ADR_INDEX_NORMATIVE_DECISIONS.md`** — the new ADR (Part B); dated
   amendments to **ADR-019** (Part A), **ADR-028** (Part C), **ADR-027** (Part D);
   a dated cross-reference in **ADR-024** item 9 pointing at ADR-019's bound; §1.1
   rows updated with honest `Blocks` cells — most of this is Phase 4, and **Part A
   is Phase 2 item 14.**
2. **`PHASE_2_BRIEF.md`** — a dated amendment **only** for what item 14 now owes:
   the two bounds, and the purge-outcome recording. **§4 gains no table** — confirm
   `scheduled_job_runs` already covers the purge outcome and say so. Everything else
   in this session is Phase 4 and must not enter the brief.
3. **`04_DATABASE_BLUEPRINT.md` §2.7** — a dated note only if Part C changes what
   `reserved_subdomains` or `store_domains` must hold. If it does not, say so.
4. **`RISK_REGISTER.md`** — judge each; do not open rows to look thorough:
   - subdomain reassignment — is it covered by any existing row? If not, it is a
     real one, and Part C is its control.
   - the published apex address as an unchangeable contract — Part D is its
     control, so probably a design decision rather than an open risk.
   `npm run check:register` must pass; escape every `|` inside a cell.
5. **`decisions/2026-09.md`** — one entry: the two bounds and the `s-maxage`
   consequence, the 503→410 transition, the never-reassign rule and why customer
   domains differ, and the hostname-over-address rule.
6. **`CLAUDE.md`, `PROJECT_GRAPH.md`, `PROJECT_STATUS.md`** — only what is stale.

---

## Step 7 — Verify

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

One commit, repository style, referencing the new ADR, ADR-019, ADR-027 and ADR-028.

---

## What to report back

1. Step 1.2 — the verbatim bullet, and confirmation that the bound was undefined.
2. Step 1.3 — what `reserved_subdomains` holds today and who writes it.
3. Whether `scheduled_job_runs` really covers the purge outcome, quoted from §4.
4. Whether ADR-027 item 10's "left to expire naturally" and Part B4's ACME
   exception actually sit together, or whether one of them needs amending. **This
   is the part of this prompt most likely to be wrong.**
5. Which risk rows you opened and which you judged covered.
6. Files changed and the commit hash.
7. **Anything in this prompt that was wrong.**

**Standing instruction.** This prompt is written by an analyst reading the
repository, not by the repository. Verify every factual claim it makes about a file
against that file. Where it is wrong, **stop and report rather than working around
it.** Every session in this programme has found at least one false premise here.
