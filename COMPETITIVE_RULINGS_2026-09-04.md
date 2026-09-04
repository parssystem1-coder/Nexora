# Competitive Rulings — ruled by the maintainer on 2026-09-04

> **سند غیرنرمتیو، ولی نگه‌داشته می‌شود.** این فایل متنِ خامِ احکام است. **بخش‌های
> الف تا چ در ۴ شهریور ۱۴۰۵ ثبت شدند** و اکنون نُه ارجاع نرمتیو این فایل را
> به‌عنوان منشأ تصمیم نام می‌برند — پس حذف نمی‌شود، همان‌طور که
> `EXTERNAL_ARCHITECTURE_REVIEW_2026-08-28.md` و
> `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` نگه داشته شده‌اند. قاعده این نیست که
> «پرامپت‌ها پاک می‌شوند»؛ این است که «سندی که چیزی به آن ارجاع ندهد مصرف‌شده است».
>
> **بخش‌های ح و خ در ۵ سپتامبر ۲۰۲۶ ثبت شدند.** یازده حکم که پس از سشنِ ثبت
> اضافه شده بودند — دو تا دربارهٔ پرداخت کرایه و مدیریت قیمت، نُه تا دربارهٔ نرخ
> حمل. **هیچ ADR تازه‌ای نوشته نشد**؛ ح-۲ در فاز ۲.۵ و ح-۱ به‌همراه هر نُه حکمِ خ
> در فاز ۳ ثبت شدند (`06_IMPLEMENTATION_PLAN.md`، دومین اصلاحیهٔ ۲۰۲۶-۰۹-۰۴)، و
> R-032 صاحب و مهلت گرفت. **اکنون هیچ بخشی از این فایل ثبت‌نشده نیست.**

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
those ids back to here. **Every section is recorded:** الف through چ on 2026-09-04,
ح and خ on 2026-09-05. The two prompts that drove those recordings were spent and
deleted; what they produced is in `decisions/2026-09.md` under those two dates.

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

---

## ح — Addendum, ruled 2026-09-04 (second this date)

Two rulings added after the first forty-four, in the same session and by the same
maintainer. **The total is 46 before section خ, and 55 with it.**

**ح-1. A shipping method declares who bears the freight cost, and only a prepaid
method contributes money to the order.**

Iranian storefronts sell under three distinct arrangements, and they are not three
payment methods — they are three answers to *who pays the carrier*:

| Mode | Goods | Freight |
|---|---|---|
| **پیش‌کرایه** (prepaid) | paid online | paid online, a line on our order |
| **پس‌کرایه** (collect) | **paid online** | paid by the buyer to the carrier at delivery |
| **پرداخت در محل** (COD) | paid at delivery | paid at delivery |

The ruling, in four parts:

1. **A shipping method carries a cost-bearer attribute** with those three values.
   It is an attribute of the shipping method, **not** of the payment method, and it
   must not be modelled as a payment provider capability.
2. **Only a prepaid method puts a freight amount into the order total or onto the
   invoice.** For پس‌کرایه the platform never receives the freight money, so an
   amount for it must never appear in a total, a payment intent, or an invoice
   line. `invoices` is append-only; a figure we never collected cannot be corrected
   out of it later.
3. **Where the freight is collected at delivery, any figure shown at checkout is an
   estimate and is labelled as one.** It never enters `Money` arithmetic and never
   crosses the payment port. Carriers price by weight and destination at handover,
   so the true figure does not exist at checkout — presenting it as a price would
   be wrong twice over.
4. **The shipping port declares which modes each carrier supports.** Same
   discipline as ADR-023's payment port: a capability flag per carrier, application
   code branching on the declared capability and never on a carrier's name. An
   intra-city courier that has no collect-on-delivery arrangement simply declares
   `false`, and the storefront does not offer the option.

**Why this is worth recording now, two phases early:** پس‌کرایه is the *simplest*
of the three for us — the goods still flow through the ordinary
redirect-and-verify path and only the freight sits outside — while COD is the hard
one, because the money arrives through the carrier rather than through any payment
provider and ADR-023's intent model does not describe it at all. **Recording the
distinction now prevents the common mistake of building COD's machinery for
پس‌کرایه, or of treating پس‌کرایه as a payment method and pushing it through the
payment port.**

*Anchor: `06_IMPLEMENTATION_PLAN.md` Phase 3 (shipping) alongside ث-5; the
cost-bearer attribute recorded in `decisions/2026-09.md` so that the first shipping
ADR inherits it.*

**ح-2. Plan and price administration is a Phase 2.5 deliverable.**

`00_PLATFORM_OVERVIEW.md` §4.2 promises "multiple plan tiers, configurable without
a code deployment", and **R-032 records that nothing delivers it and no phase owns
it.** Phase 2 seeds plans by migration and D2-11 rules that no capability creates or
edits one — correctly, because item 1 is a read slice.

The ruling: **an operator-facing capability to publish a new plan version and a new
price version lands in Phase 2.5, before the platform runs on a real server.**

Three constraints it inherits and must not violate:

- **ADR-047** — publishing a new price version does not touch existing
  subscriptions; each is re-priced at its own next renewal invoice, at T-30d.
- **`plan_versions` is immutable** — administration means *publishing a new
  version*, never editing one. The word "edit" must not appear in the capability's
  contract.
- **ب-5** — a term length is its own price version, so the administration surface
  publishes a price per term, not a price plus a discount.

Until it exists, a price change is a migration. That is acceptable before launch
and unacceptable after it, which is exactly why the deadline is Phase 2.5 rather
than "later".

*Anchor: `06_IMPLEMENTATION_PLAN.md` Phase 2.5; a dated addendum to **R-032**
naming its owner and deadline.*

---

## خ — Shipping rates, ruled 2026-09-04 (third this date)

Nine rulings that complete ح-1. **ح-1 answered *who pays* the freight; this section
answers *how much it is* and *who the carrier may be*.** The total is 55.

**The market this is designed against.** Iranian storefronts ship through the
national post's tiers (پیشتاز، ویژه، اکسپرس), through private carriers (تیپاکس،
چاپار، ماهکس، باکسیت), through intra-city couriers (اسنپ‌باکس، الوپیک), through
aggregators that front several of these behind one integration (پدرو، تاپین،
پستکس), and — for a very large share of real merchants — through **a local
باربری with no API at all.** A model that only serves the integrated ones is
unusable for the merchants who most need a store builder.
*Carrier names are recorded as market context, verified only as names in current
use on 2026-09-04, and no ruling depends on any particular one existing.*

**خ-1. Any carrier can be defined by the merchant. A carrier with no integration is
first-class, not a fallback.**
Two classes exist: an **integrated** carrier, bound to an adapter, and a **manual**
carrier, which is a name the merchant types and a rate table they fill in
themselves. Both produce a shipping method the storefront can offer.
A manual carrier carries a name, and optionally a **tracking URL template with a
placeholder for the consignment code** — so "track my parcel" works for a carrier
the platform has never heard of.
**No application code branches on a carrier's name**, integrated or not — the same
fence ADR-023 item 9 draws around payment providers.
*Anchor: `06_IMPLEMENTATION_PLAN.md` Phase 3; the shipping port's ADR inherits it.*

**خ-2. Rate rules are data, not code.**
A merchant composing "50,000 within Tehran, 90,000 elsewhere, free above
2,000,000" must not require a deployment. This is the shipping analogue of
ADR-023's "adding a gateway costs one adapter and one config entry" — here it costs
**zero code**.

The composable shape, per shipping method and per zone:

| Part | Values |
|---|---|
| **Rate source** | `TABLE` · `CARRIER_QUOTE` (an integrated adapter returns it) · `FREE` · `COLLECT` (ح-1 — no amount exists) |
| **Bracket dimension**, for `TABLE` | `NONE` (a flat rate) · `WEIGHT` · `SUBTOTAL` · `ITEM_COUNT` |
| **Rows** | ordered `(from, to, amount)` brackets |
| **Modifiers** | free above a threshold; an optional maximum |

That composes to every model in common use: flat, free, conditional free, weight
tiers, per-item, زون‌بندی تهران/شهرستان, cart-value tiers, live carrier quotes,
in-store pickup (a zero-rate method), and پس‌کرایه. **Adding a new commercial
arrangement must not mean adding a new rate type.**
*Anchor: Phase 3.*

**خ-3. Zones are defined by the merchant, and a destination no zone covers makes the
method unavailable — never free.**
A merchant may want city-level granularity inside Tehran and province-level
elsewhere; the platform does not decide that for them. **An uncovered destination
must hide the method, not price it at zero** — a silent zero is how a merchant ends
up shipping for free without knowing.
*Anchor: Phase 3.*

**خ-4. The shipping amount is snapshotted on the order and on the invoice.**
The same argument ADR-055 makes for the tax rate: a rate table can change after an
order is placed, `invoices` is append-only, and the record must reproduce what was
actually charged rather than what the current table would say.
*Anchor: Phase 3; cross-reference ADR-055.*

**خ-5. A rate quoted at checkout binds the merchant.**
If a carrier's actual charge at handover differs from the quote the customer
accepted, **the difference is the merchant's.** It is never re-charged to the
customer without a new document.
The customer holds an invoice stating an amount, and that invoice cannot be edited
— ADR-056's correction-document shape is the only path to changing what a customer
owes, and it exists for corrections, not for absorbing a carrier's variance.
*Anchor: Phase 3; cross-reference ADR-056.*

**خ-6. A free-shipping threshold is computed on the goods subtotal, after discount
and before tax.**
Decided explicitly because every reading is defensible and only one can be
implemented. After discount, because a customer earns free shipping on what they
actually pay for goods. Before tax, because otherwise a change in the tax rate
silently moves the threshold — and ADR-055 makes the rate a dated, changeable
thing.
*Anchor: Phase 3; cross-reference ADR-055.*

**خ-7. Insurance and packaging are their own order lines, never folded into the
shipping amount.**
ADR-044 requires each line to carry its own description captured at issuance. A
merchant reconciling with a carrier, and a customer asking what they paid for, both
need the parts separable.
*Anchor: Phase 3.*

**خ-8. One adapter may expose several named services. The port must not assume one
adapter equals one carrier.**
Iranian shipping aggregators front several carriers behind a single integration.
Where one exists, **an aggregator adapter is preferred over writing several carrier
adapters** — less code, one credential, one fixture suite. The port shape has to
allow it, and that is a decision about the port rather than about a vendor.
*Anchor: Phase 3; the shipping port's ADR.*

**خ-9. Volumetric weight is the adapter's business or the merchant's, never the
domain's.**
Carriers price on the greater of actual and volumetric weight, each with their own
divisor, and those divisors change. An integrated adapter applies its carrier's
rule; a manual method uses whatever the merchant enters in their own table. **The
domain never computes a volumetric weight**, for the same reason it never holds a
provider's field names.
*Anchor: Phase 3.*
