# Provider Matrix

Tracks the external providers this platform integrates with (payment, DNS, CDN, certificate issuance, notification, object storage, search, AI). Referenced by `03_TECHNICAL_BLUEPRINT.md` §12 ("Operational Baseline") as a required, dated deliverable before production.

Not populated yet — no provider has been selected.

**Correction, 2026-09-01.** This file previously read: *"Populate as each extraction seam (`03_TECHNICAL_BLUEPRINT.md` §9) is implemented, **starting no earlier than Phase 3/4 per the phase slices in that document**."* That sentence is superseded, not deleted, per this repository's convention for a corrected claim. Two things were wrong with it:

1. **Its citation does not support it.** `03_TECHNICAL_BLUEPRINT.md` §9 ("Extraction Seams") is four lines long, names payment providers among the things to "keep behind contracts from day one," and **contains no phase numbers at all**. The Phase 3/4 timing was asserted, not sourced. Found by `PHASE_2_DOCUMENTATION_GAPS_2026-08-28.md` **G-3** and tracked as `RISK_REGISTER.md` **R-015**.
2. **It contradicted `06_IMPLEMENTATION_PLAN.md`**, whose Phase 2 items 10–12 require a payment provider port, a first adapter plus a second stub adapter, and a working reconciliation sweep — inside Phase 2, not Phase 3/4.

**The ruling that replaces it — decision D2-3** (`PHASE_2_BRIEF.md` §0 "Provider scope in Phase 2" and §7; `decisions/2026-08.md` 2026-08-28), which resolved the conflict by splitting it rather than by declaring either document wrong:

- **Phase 2 builds the port and a fixture-modelled first adapter, plus a second stub adapter to prove the port.** This is compliant with ADR-023, whose own verification list requires only that the "adapter contract test suite runs against fixtures with no network" and that "a second provider is added in a test with no changes outside its adapter and configuration." Neither needs a live account.
- **Commercial provider selection and live credentials remain Phase 3/4** — which is what this file actually tracks, and why the original instinct was not wrong even though its citation and its scope were.
- **A fixture still has to be modelled on some real provider's API shape**, so a limited form of provider *evaluation* legitimately begins in Phase 2. Populating a row here does not follow from that: a row means a provider is selected and integrated.

**Related constraint, so it is not discovered at integration time:** ADR-023 item 8 requires store-scoped credentials to be "encrypted at rest, never returned by any read API, and never logged." No mechanism implements that yet (**R-029**), and **ADR-037** rules that the deferral covers building the encryption service but **never** covers storing a plaintext secret — `billing_provider_configs` must hold a `secret_ref` from the day its migration lands, because migrations are forward-only.

**Authority for everything above:** ADR-023, ADR-037, and `PHASE_2_BRIEF.md` §0/§5/§7. This file is a tracking artifact and decides nothing on its own.

Populate a row as each extraction seam (`03_TECHNICAL_BLUEPRINT.md` §9) is actually integrated with a selected vendor.

| Category | Provider | Capability flags supported | Webhook support | Reconciliation strategy | Contract/ADR | Status | Last updated |
|---|---|---|---|---|---|---|---|
| Payment | | | | | | | |
| DNS | | | | | | | |
| CDN | | | | | | | |
| Certificate issuance | | | | | | | |
| Notification | | | | | | | |
| Object storage | | | | | | | |
| Search | | | | | | | |
| AI | | | | | | | |
