# Competitive Rulings — ruled by the maintainer on 2026-09-04

> **سند غیرنرمتیو.** این فایل متنِ خامِ احکام است. در ترتیب خواندنِ `AGENTS.md` §۱
> نیست و هیچ چیزی را خودش تصمیم نمی‌گیرد.
>
> **ثبت شد در ۲۰۲۶-۰۹-۰۴ — و برخلاف آنچه اینجا در ابتدا نوشته شده بود، این فایل
> نگه داشته می‌شود.** هر ۴۴ حکم در اسناد نرمتیو ثبت شد، و آن ثبت‌ها **نُه بار به
> همین فایل ارجاع می‌دهند**: هفت اصلاحیهٔ ADR، اصلاحیهٔ `06_IMPLEMENTATION_PLAN.md`،
> اصلاحیهٔ `PHASE_2_BRIEF.md`، سطر R-044 و `decisions/2026-09.md`. حذفِ آن، هر نُه
> ارجاع را می‌شکند. همان قاعده‌ای که برای `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md`
> به کار رفته اینجا هم صدق می‌کند: **یک سندِ منبعِ تاریخ‌دار نگه داشته می‌شود و به آن
> ارجاع داده می‌شود؛ یک پرامپت، مصرف‌شدنی است.**

**Source.** These rulings come from a review of a live competitor — a trial
account inside the Webzi admin panel (`mywebzi.ir`), its public pricing page (all
three product tabs) and its public documentation — conducted 2026-09-03/04,
read-only. They were proposed by the analyst session, and **ruled by the
maintainer on 2026-09-04**.

**Evidence limits, recorded because they bound several rulings.** One competitor
only. No other Iranian site builder was examined. Where a ruling below refers to
"the market" or "competitors", that is a generalisation from one observed
instance plus general knowledge, **not a comparative study** — and any ruling that
depends on such a claim says so in its own text.

**How to use this file — it is a record now, not an instruction.** Each ruling has
an id and an anchor naming where it is recorded, and the normative documents cite
those ids back to here. The prompt that drove the recording
(`SESSION_18_COMPETITIVE_RULINGS_PROMPT.md`) was spent and removed on 2026-09-04;
what it produced is in `decisions/2026-09.md` under that date.

---

## الف — Domains and DNS

**الف-1. Two domain-connection methods are supported. Record-based is the default;
nameserver delegation is optional.**
A tenant either places two records in their own DNS and keeps ownership of their
zone, or delegates nameservers to the platform and in exchange gets wildcard
certificates, mailboxes on the domain, and an apex that needs no maintenance.
*Why both:* ADR-027 records two limits as facts — no wildcard in V1, and the apex
address being a "long-lived public contract". **Both are consequences of the
chosen method, not laws.** Delegation removes them, but a platform outage then
takes down the tenant's whole domain including their email, not just their site.
Making it mandatory imposes that cost on everyone.
*Anchor: dated amendment to ADR-027.*

**الف-2. A full zone export, one click, on every plan, at no charge.**
Any tenant whose zone we hold must be able to download a standard zone file plus a
human-readable record list at any moment.
*Why:* this is what makes delegation safe to accept. It is a read, and it is
cheap; its effect is to neutralise exactly the fear a merchant has about handing
over their domain.
*Anchor: dated amendment to ADR-027; Phase 4.*

**الف-3. Any domain the platform gives or sells is registered in the tenant's own
name.**
Registrant is the tenant, with their own IRNIC handle for `.ir`; Nexora is
technical contact only. **Never Nexora as registrant.**
*A "free domain" registered under the platform's own handle is not a gift.*
*Anchor: dated amendment to ADR-027; registrar port, Phase 4.*

**الف-4. The apex, with no prefix, is the default primary domain; `www` redirects
to it.**
ADR-027 item 7 already allows both to be claimed with one primary; this ruling
sets the default. What a merchant prints on a business card is `example.ir`.
*Anchor: dated amendment to ADR-027.*

**الف-5. Tenant subdomains live on a registrable domain entirely separate from the
brand domain.**
Three reasons: cookies are scoped across a domain's subdomains and separating them
is a security boundary; thousands of abandoned stores affect the brand domain's
own search reputation; and a subdomain takeover on the brand domain is far more
dangerous than on a service domain.
*Anchor: dated amendment to ADR-028; domain purchased before the first customer.*

**الف-6. A trial receives a random subdomain. A chosen name is granted only with
the first paid subscription.**
ADR-028's amendment rules that a platform subdomain is never reissued. That rule
plus a free trial means **every abandoned signup burns a good name permanently.**
Short commercial names are an asset and must not be spent on trials.
*Anchor: dated amendment to ADR-028 and ADR-052.*

**الف-7. The address published in a tenant's DNS is always an edge address, never
an origin's.**
Already ruled; restated here as a red line. An origin address in ten thousand DNS
zones is both an irreversible hosting decision and a direct target that bypasses
every protection the edge provides.
*Anchor: already recorded — ADR-027 item 3 and its 2026-09-03 amendment.*

**الف-8. Wildcard certificates are available for delegated zones and not for
tenant-held zones.**
ADR-027 item 4 excludes wildcards from V1 absolutely, on the stated ground that
`DNS-01` requires zone control. Ruling الف-1 removes that ground for some tenants,
so the exclusion must be **narrowed, not lifted.**
*Anchor: dated amendment to ADR-027 item 4.*

**الف-9. Mailboxes on a tenant's domain exist only for delegated zones, and are a
plan feature.**
An `MX` record is out of reach without zone control. This turns delegation from a
request into an **incentive**: the tenant delegates because they gain something.
*Anchor: ADR-027 item 8; Phase 4.*

**الف-10. Before any delegation, the tenant's current zone is read and migrated.**
Before we ask anyone to change nameservers, their existing records are read,
whatever must carry over is carried over, and if they hold mail records we do not
cover, they are warned **before** the switch.
*This is the difference between a professional migration and taking a business's
email offline.*
*Anchor: dated amendment to ADR-027; Phase 4.*

---

## ب — Plans, prices and quotas

**ب-1. Plan-change direction is determined from entitlements and quotas, never
from price.**
ADR-025 item 2 currently reads "Lateral (same price) — immediately, no charge".
Two plans at the same price can be incomparable. Under the current rule a tenant
would lose a capability and gain another in one step, with no protection.
Upgrade means a superset of entitlements **and** every quota greater or equal.
Downgrade is its inverse. Lateral means exactly identical.
*Anchor: dated amendment to ADR-025 item 2.*

**ب-2. A fourth case, "incomparable", is defined and prohibited in V1.**
A change that simultaneously grants and removes is rejected with a specific error
code.
*Why prohibited rather than treated as a downgrade:* losing a **capability** needs
a data-preservation story that does not exist — ADR-026 covers quota overage only.
Prohibiting is cheap and reopens the moment that story is written.
*Anchor: dated amendment to ADR-025; error code in `05_API_CAPABILITY_CONTRACTS.md` §7.*

**ب-3. `plans` gains no family or product-line column.**
The pricing page's tabs are presentation, and with ب-1 nothing depends on them.
ADR-044 already forbids a display column in item 1. **Consequence: item 1's
migration is unchanged.**
*Anchor: `decisions/2026-09.md` — no schema change.*

**ب-4. The V1 quota resource list contains only what the platform can count.**
`members`, `stores`, `domains` — all countable from our own tables. Storage and
bandwidth are neither enforced **nor advertised** until an object storage adapter
(ADR-060) and edge metering exist.
*A limit that is not counted is a promise someone eventually discovers.*
*Anchor: dated amendment to `PHASE_2_BRIEF.md` §5; binds item 7.*

**ب-5. Each term length is its own price version. A discount is stored, never
computed.**
One-year and two-year are two price rows, not one price and a percentage.
ADR-047 pins a price version at renewal and a discount would have to be reproduced
years later; ADR-022 forbids floating-point arithmetic on money and every
percentage carries a rounding.
*Seed value:* two-year at 80% of twice the annual price. That number is commercial
and changes without any schema change.
*Anchor: dated amendment to ADR-047; binds item 2's price tables.*

**ب-6. A subscription never has more than one billing cadence.**
Any add-on, whenever built, is **prorated to the parent's `period_end` and issued
on the parent's invoice** — the same proration mechanism ADR-025 already defines
for upgrades. ADR-024 models one `term_length` per subscription and a second
cadence breaks it.
*Anchor: dated amendments to ADR-024 and ADR-025.*

**ب-7. The trial is 14 days, with a single operator-granted 14-day extension.**
ADR-052 currently rules 7 days. Seven days is not enough to build a real store,
and a trial that ends before the result is worth looking at converts nobody. The
extension is an **operator capability with an audit record**, not an automatic
option.
*Anchor: dated amendment to ADR-052; extension capability in Phase 2.5.*

**ب-8. The "powered by Nexora" mark appears on trials only and is removed on every
paid plan.**
Competitors sell its removal on lower paid tiers as well. We do not: **if you have
paid, the site is yours.** Our visibility comes from trial volume, which always
exceeds paid customers, and the position is itself a sales line. Technically it is
one flag in `plan_features`, seeded in item 1.
*Anchor: item 1 seed; `plan_features`.*

---

## پ — Revenue model

**پ-1. Three revenue layers: the annual plan subscription, optional add-ons, and a
designer marketplace.** There is no fourth. Specifically: no sales commission, no
gateway fee, no traffic charge.
*Anchor: `decisions/2026-09.md`.*

**پ-2. Sales commission is zero and stays zero.**
Already in the commercial spec; fixed here as a ruling because it is the first
thing a merchant compares and changing it later means breaking a promise.
*Anchor: `decisions/2026-09.md`.*

**پ-3. Every payment gateway is free, on every plan.**
ADR-023 rules that adding a gateway must cost exactly one adapter and one
configuration entry. Charging for something our own architecture made nearly free
is rent on our own work.
*Anchor: item 1 seed; ADR-023.*

**پ-4. Shipping carriers and price-comparison engines are free too.**
Torob, Emalls and the carriers increase the tenant's sales, and more sales means
renewal. Anything charged for them comes out of next year's renewal.
*Anchor: Phases 3 and 4.*

**پ-5. Add-ons are deep professional capabilities only, never basics.**
What an ordinary store needs in order to function is in the plan. An add-on is for
what only some merchants want: formula pricing, wholesale tiers, deep reporting,
the accounting bridge.
*Test:* if its absence means the store is incomplete, it is not an add-on.
*Anchor: `decisions/2026-09.md`; Phase 3.*

**پ-6. No third-party plugin marketplace until the plugin security boundary
exists. A designer/template marketplace exists from the start.**
A third-party plugin means running foreign code beside tenant data, and ADR-005
puts that boundary in Phase 9. **A template is data, not code** — a designer
marketplace needs no new security boundary and builds an ecosystem immediately.
*Anchor: ADR-005; template marketplace in Phase 4.*

---

## ت — Notifications and who pays for them

**ت-1. Subscription-lifecycle notifications are ours and we pay for them; the
tenant's own storefront notifications are theirs.**
Renewal reminders, expiry warnings and payment receipts are sent and paid for by
**the platform** — ADR-024 item 10 makes notification mandatory, and a mandatory
obligation must not depend on the tenant's own SMS credit.
Order-status messages to the tenant's own customers run on the tenant's SMS panel;
their volume is thousands of times greater and the economics only work that way.
*Anchor: dated amendment to ADR-024; binds item 17.*

**ت-2. Every SMS channel is rate-limited, and this is a financial control rather
than a feature.**
Login-code and password-reset messages without a rate limit are an open tap into a
bank account. Default: one message per recipient per two minutes, plus a daily cap
per tenant.
*Anchor: item 17; a risk-register row.*

**ت-3. Notification templates are fixed in Phase 2 and become editable in Phase 3.**
An editable template means tenant text in our tables, which brings ADR-044's
display-text decisions with it. Phase 2 sends a few correct templates.
*Anchor: item 17; Phase 3.*

---

## ث — What competitors have that we do not — each with a phase

Nothing here is left as "we will see". Every item has a phase or is explicitly
excluded.

| Id | Item | Ruling | Why |
|---|---|---|---|
| ث-1 | Torob and Emalls integration | **Phase 4 — and a phase exit criterion** | A large share of Iranian storefront traffic arrives through these two. A store builder without them is not competitive, so this is a gate rather than a nice-to-have. |
| ث-2 | Mailboxes on the tenant's domain | **Phase 4 — delegated zones only** | An `MX` record is impossible without zone control. Same incentive as الف-9. |
| ث-3 | Multilingual sites | **Out of V1, with a trigger** | It multiplies every content table and every SEO decision. This is the one place we deliberately stay behind. Trigger: the first tenant with real export sales. |
| ث-4 | Support ticketing | **Phase 2.5 — bought, not built** | Needed from the first paying customer; building one takes weeks. An external tool at launch; build in-house only if volume justifies it. |
| ث-5 | Shipping carriers | **Phase 3 — as a port** | The same discipline as ADR-023: capability flags, an adapter, fixtures. Never an `if` on a carrier's name. |
| ث-6 | PWA application | **Phase 4** | Cheap, visible, and expected by the market. |
| ث-7 | Tenant-facing webhooks | **Phase 2.5** | `outbox_events` is already the substrate; exposing it is small and hands integration work to others. |
| ث-8 | Organization ownership transfer | **Phase 2.5** | With the constraint that the buyer-identity snapshot on issued invoices is never rewritten. |
| ث-9 | Template and designer marketplace | **Phase 4** | A template is data, not code; no new security boundary. |
| ث-10 | Accounting-software bridge | **Phase 5** | Its prerequisite is gap-free invoice numbering, which ADR-048 already ruled. A sellable product, not a feature. |
| ث-11 | Installment / BNPL payment | **Flag now, adapter in Phase 3** | Installment is a payment *mode* and ADR-023's current capability flags say nothing about it. The flag is cheap today. |
| ث-12 | A published SLA | **Only after the first restore drill** | A published number with no monitoring behind it is a commitment, not a feature. Prerequisites: R-041 and ADR-040's deferred metrics. After that, publish 99.9%. |

---

## ج — Red lines

**ج-1. No arbitrary script injection by tenants.**
A "custom code" box means running foreign JavaScript on the page that carries a
shopper's cart and payment details. Instead: **a curated list of integrations** —
Google Analytics, Search Console, pixels — as configuration fields. That covers
95% of the real need without arbitrary code execution.
*Anchor: ADR-005; Phase 4.*

**ج-2. We do not sell or advertise a limit we do not count.** (Restates ب-4 as a
red line, because marketing pressure lands precisely here.)

**ج-3. We publish no availability figure without monitoring behind it.** (Restates
ث-12.)

**ج-4. No domain is ever registered in Nexora's name.** (Restates الف-3.)

**ج-5. Full data export, on every plan, free.**
Products, orders, customers, posts and the zone file — all downloadable. Locking a
merchant in by holding their data is not a business model; it is a deferred
bankruptcy. Saying so is itself a reason to buy.
*Anchor: `decisions/2026-09.md`; Phases 3 and 4.*

---

## چ — The claims these rulings license

Not slogans. Each is the outward face of one or more rulings above, which is why
it can be said at all.

1. **"Your domain is yours."** — الف-2, الف-3, ج-5
2. **"An invoice, not a receipt."** — ADR-048, ADR-055, ADR-057, ADR-022
3. **"Renew late and your ranking survives."** — ADR-059, ADR-027's amendment
4. **"We will put your store back to yesterday."** — ADR-054
5. **"Gateways, shipping and Torob are all free. Zero commission."** — پ-2, پ-3, پ-4
