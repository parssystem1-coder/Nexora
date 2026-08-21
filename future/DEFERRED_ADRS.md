# Deferred ADRs

Status `DEFERRED`: intentionally undecided. Blocks nothing in V1. Each must be reopened and moved to the main ADR index before its owning system is implemented.

These are retained verbatim in intent from pack 1.0 so nothing is lost.

---

## ADR-011 - Co-Pilot Cadence vs AI Credit Cost

**Reopen before:** Phase 12
**Question:** how often may a proactive AI co-pilot run per tenant, and how is that metered against the AI credit ledger without producing surprise cost?
**Constraints already binding:** ADR-006 reservation lifecycle, ADR-022 money model. Every billable run must produce a ledger entry.

## ADR-012 - Autonomous AI Execution Opt-In

**Reopen before:** Phase 13
**Question:** what does a tenant explicitly opt into when they allow an AI agent to execute rather than suggest, and how is that scoped, revoked and audited?
**Constraints already binding:** AI is suggestion-first, approval-gated, and inherits every policy check. Autonomy never bypasses ADR-001 or the capability policy chain.

## ADR-013 - Voice Input Retention

**Reopen before:** Phase 14
**Question:** how long is captured audio retained, where, under what tenant consent, and how is it purged?
**Constraints already binding:** ADR-020 retention and deletion model.

## ADR-014 - Channel Sync Conflict Resolution

**Reopen before:** Phase 15
**Question:** when an external channel and the platform both mutate the same catalog or order entity, which wins, and how is divergence detected and reconciled?
**Constraints already binding:** a channel order enters through the same order creation path as the storefront. A channel is a doorway, not a second implementation.

## ADR-015 - Dynamic Pricing Auto-Apply Policy

**Reopen before:** Phase 16
**Question:** may an AI price suggestion apply automatically, under what guardrails, and with what merchant-visible audit trail?
**Constraints already binding:** explainability by contract, approval gating, ADR-022 money model.

## ADR-016 - Multi-Approver Quorum Rules

**Reopen before:** Phase 17
**Question:** how are quorum, role weighting, tie-breaking and timeout defined for enterprise multi-approver workflows?
**Constraints already binding:** extends ADR-001 and ADR-001b. Platform-side approval state remains authoritative.

## ADR-017 - Marketplace Plugin Review and Payout

**Reopen before:** Phase 18
**Question:** what is the plugin review process, the revenue split, the payout mechanism, and the revocation path for a malicious published plugin?
**Hard gate:** the public marketplace does not open until untrusted plugin code runs in real isolation. ADR-005 and ADR-005b must be satisfied first.

## ADR-018 - Financial Services Compliance and Deployment Isolation

**Reopen before:** Phase 19
**Question:** what regulatory regime applies, what deployment and data isolation does it require, and what partner contracts are prerequisite?
**Hard gate:** blocked until explicit legal and regulatory sign-off exists, regardless of engineering readiness.
