# START HERE

**Package:** SaaS Platform Documentation Pack
**Version:** 2.0 (corrected)
**Supersedes:** 1.0 canonical pack
**Date:** 2026-08-22

---

## What changed in 2.0

Version 1.0 was architecturally strong but not implementable as handed to an autonomous coding agent. Version 2.0 fixes that. Every correction is listed with its origin in `09_CHANGELOG_AND_CORRECTIONS.md`. Nothing from 1.0 was deleted; clauses were either kept, corrected, or explicitly deferred into `future/`.

Five correction themes:

1. **Agent implementability.** The self-blocking repository-audit contradiction is resolved, mechanical CI guardrails are now normative (ADR-030), and a single hand-written reference slice is required before any generated code.
2. **Storefront performance.** Storefront read path, caching and RLS/pooling interaction promoted from deferred Phase 4 guesswork to accepted Phase 0/1 decisions (ADR-019, ADR-032).
3. **Payments reality.** Money/currency modelling (ADR-022) and a payment provider port with capability flags plus reconciliation for gateways that have no webhooks (ADR-023).
4. **Subscription lifecycle.** Terms, expiry, renewal, grace, plan change and proration are now modelled instead of merely named (ADR-024, ADR-025, ADR-026).
5. **Domains and TLS.** Verification, certificate lifecycle, host-resolution security, IDN handling and reserved subdomains (ADR-027, ADR-028).

## Read order

| # | File | Purpose |
|---|---|---|
| 1 | `AGENTS.md` | Operating contract for any human or AI implementer. Read first, always. |
| 2 | `08_PHASE_1_BRIEF.md` | The only scope an implementer is allowed to start with. |
| 3 | `00_PLATFORM_OVERVIEW.md` | What the product is and grows into. |
| 4 | `01_ARCHITECTURE_BASELINE_RFC.md` | Architectural shape. |
| 5 | `02_ADR_INDEX_NORMATIVE_DECISIONS.md` | Binding decisions. Overrides the RFC. |
| 6 | `03_TECHNICAL_BLUEPRINT.md` | Implementation boundaries and topology. |
| 7 | `04_DATABASE_BLUEPRINT.md` | Data ownership, tables, constraints, RLS. |
| 8 | `05_API_CAPABILITY_CONTRACTS.md` | Public and internal contracts. |
| 9 | `06_IMPLEMENTATION_PLAN.md` | Execution order and phase exits. |
| 10 | `07_ARCHITECTURE_GAP_REPORT.md` | Known gaps, blockers, release gates. |
| 11 | `09_CHANGELOG_AND_CORRECTIONS.md` | Every 1.0 -> 2.0 correction and why. |
| 12 | `99_SOURCE_MASTER_SPEC_v1.2.md` | Historical source spec, traceability only. |
| - | `future/` | Deferred surfaces. Do not load into an implementation context. |

## Precedence when documents disagree

```text
ADR Index  >  Architecture RFC  >  Technical/Database/Contract docs  >  Platform Overview  >  Source Master Spec
```

## Context budget rule for AI implementers

Do **not** load the whole pack into one context window. It causes rule amnesia and over-engineering.

- Always loaded: `AGENTS.md` + `08_PHASE_1_BRIEF.md`
- Loaded on demand for the current slice: the relevant sections of `03`, `04`, `05`, and only the ADRs the slice touches
- Never loaded during Phase 1: `future/`, `99_SOURCE_MASTER_SPEC_v1.2.md`, ADR-011 through ADR-018
