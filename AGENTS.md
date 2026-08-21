# SaaS Platform Agent Operating Contract

**Version:** 2.0
**Applies to:** every human and AI implementer of this repository

---

## 0. Non-Negotiable Starting Point

You may not write feature code until all three are true:

1. `REPOSITORY_AUDIT_REPORT.md` exists at the repository root and has been reviewed.
2. The Phase 1 scope in `08_PHASE_1_BRIEF.md` is approved.
3. The mechanical conformance harness required by ADR-030 runs in CI and fails on violation.

**If the repository is empty or newly scaffolded, the audit is not skipped, it is trivial.** Produce the audit against the actual current state, marking every target area `MISSING` where nothing exists yet, then proceed to scaffold. Do not fabricate an audit from these documents, and do not use "there is no repository yet" as a reason to skip the audit or as a reason to stall.

## 1. Authority and Read Order

1. `AGENTS.md` (this file) for how to work.
2. `08_PHASE_1_BRIEF.md` for what to build now.
3. `02_ADR_INDEX_NORMATIVE_DECISIONS.md` for binding decisions. **ADRs override every other document.**
4. `01_ARCHITECTURE_BASELINE_RFC.md` for architectural shape.
5. `03_TECHNICAL_BLUEPRINT.md` for implementation boundaries.
6. `04_DATABASE_BLUEPRINT.md` for data ownership and schema rules.
7. `05_API_CAPABILITY_CONTRACTS.md` for public and internal contracts.
8. `06_IMPLEMENTATION_PLAN.md` for execution order.
9. `07_ARCHITECTURE_GAP_REPORT.md` for known gaps and release blockers.
10. `99_SOURCE_MASTER_SPEC_v1.2.md` for traceability only, never for current decisions.

`future/` is out of scope. Reading it during Phase 1 or Phase 2 is a defect, because it causes premature abstraction.

## 2. The Reference Slice Rule

Exactly one vertical slice in this codebase is the **golden path**: `store.read`.

It is hand-reviewed and it is the canonical example of module layout, file naming, transaction handling, tenant context, authorization, error mapping, audit and tests.

When implementing anything new:

1. Open the golden path first.
2. Mirror its structure exactly.
3. If your feature cannot be expressed in that structure, **stop and document the mismatch**. Do not invent a second structure.

Rules expressed only as prose are not enforceable on a long task. The golden path plus the CI harness are the real contract.

## 3. Mandatory Pre-Change Checklist

Before changing code, state in the PR description:

- [ ] owning module and aggregate
- [ ] tenant scope and store scope
- [ ] required permission, entitlement, quota, rate limit
- [ ] audit requirement
- [ ] Application Service and Capability id
- [ ] transaction boundary
- [ ] idempotency behaviour (or explicit "not applicable" with reason)
- [ ] emitted events and external side effects
- [ ] money/currency handling, if any value is monetary
- [ ] time and timezone handling, if any date boundary matters
- [ ] affected ADRs
- [ ] whether a new ADR is required

## 4. Hard Prohibitions

- Do not introduce microservices without an approved ADR.
- Do not put authoritative business logic in controllers, React components, AI prompts, MCP handlers, plugins, or database triggers.
- Do not let AI, MCP, plugins, automation or any other module access repositories directly.
- Do not bypass tenant context, authorization, entitlement, quota or approval policy.
- Do not create module-specific idempotency mechanisms.
- Do not store plaintext secrets, in code, images, logs or API responses.
- Do not treat in-process plugins as a security sandbox.
- Do not delete tenant data on downgrade, expiry or cancellation without the explicit policy in ADR-020 and ADR-026.
- Do not represent money as a float or as a bare number without currency.
- Do not compute a billing or expiry boundary in local server time.
- Do not derive `storeId` from a token alone, or trust a `Host` header without a verified domain mapping.
- Do not change an accepted ADR silently.
- Do not perform a broad refactor while implementing a feature.
- Do not create tables, modules or abstractions for anything in `future/`.

## 5. When You Are Uncertain

Stop. Write the ambiguity into `DECISION_LOG.md` with options and a recommendation. Do not invent a competing architecture, and do not pick silently because a decision was inconvenient.

Ambiguity that blocks you is a documentation defect. Report it as one.

## 6. Required Implementation Sequence

```text
repository audit
 -> conformance harness in CI (ADR-030)
 -> golden path slice, hand reviewed
 -> remaining Phase 1 slices
 -> tenant isolation suite green
 -> conformance review
 -> Phase 2
```

## 7. Definition of Done

A feature is done only when all of the following are complete: domain boundaries, tenant scope, authorization, entitlement, quota, transaction boundary, idempotency, events, audit, API contract, generated schema artifacts, tests at the same layer as each rule, observability, and documentation.

A feature that works but has no test at the layer where its rule lives is not done.

## 8. Test Layering Rule

| Rule lives in | Test lives in |
|---|---|
| Domain invariant | domain unit test |
| Use case orchestration, transaction, idempotency | application integration test |
| Permission, entitlement, quota, approval | capability policy test |
| Tenant isolation, RLS | integration test against real PostgreSQL |
| HTTP contract, error codes | interface contract test |
| Architecture boundary | CI conformance test (ADR-030) |

Mocked PostgreSQL never satisfies a tenant isolation requirement.
