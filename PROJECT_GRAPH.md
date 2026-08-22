# Project Graph

**Generated** by `npm run graph` from commit `53d0850` (working tree dirty). **Do not hand-edit** — every row is parsed from source.

This file answers *what exists*, cheaply. It does not answer *whether it is correct* — that is the conformance harness (ADR-030) and human review. A fact here that looks wrong means the source is wrong, not this file.

**At a glance:** 6 modules · 12 tables (6 with RLS) · 4 capabilities · 4 routes · 189 test cases in 21 files · 37 ADRs (29 accepted)

## Modules

| module | layers | files | depends on | platform |
|---|---|---|---|---|
| `audit` | application, contracts, domain, infrastructure, interfaces, migrations | 9 | — | yes |
| `authorization` | application, contracts, domain, infrastructure, interfaces, migrations | 14 | `capability` | yes |
| `capability` | contracts, domain, interfaces | 5 | — | — |
| `identity` | application, contracts, domain, infrastructure, interfaces, migrations | 19 | `capability` | yes |
| `money` | contracts, domain, infrastructure, migrations | 11 | — | yes |
| `tenant` | application, contracts, domain, infrastructure, interfaces, migrations | 48 | `audit`, `authorization`, `capability`, `identity` | yes |

## Tables

`tenant_id` + RLS + FORCE is required for every tenant-owned table. Exemptions are named in the phase brief §5 — an absent mark here is a fact, not a verdict.

| table | module | tenant_id | RLS | FORCE | policies | migration |
|---|---|---|---|---|---|---|
| `audit_events` | audit | yes | yes | yes | `audit_events_tenant_isolation` | `20260822090800_audit__create_audit_events.sql` |
| `currencies` | money | — | — | — | — | `20260822110000_money__create_currencies.sql` |
| `membership_roles` | authorization | yes | yes | yes | `membership_roles_tenant_isolation` | `20260822090700_authorization__create_membership_roles.sql` |
| `memberships` | tenant | yes | yes | yes | `memberships_self_or_tenant_access` | `20260822090300_tenant__create_memberships.sql` |
| `organizations` | tenant | yes | yes | yes | `organizations_tenant_isolation` | `20260822090200_tenant__create_organizations.sql` |
| `permissions` | authorization | — | — | — | — | `20260822090600_authorization__create_permission_catalog.sql` |
| `role_permissions` | authorization | — | — | — | — | `20260822090600_authorization__create_permission_catalog.sql` |
| `roles` | authorization | — | — | — | — | `20260822090600_authorization__create_permission_catalog.sql` |
| `sessions` | identity | — | — | — | — | `20260822090100_identity__create_sessions.sql` |
| `store_memberships` | tenant | yes | yes | yes | `store_memberships_self_or_tenant_access` | `20260822090500_tenant__create_store_memberships.sql` |
| `stores` | tenant | yes | yes | yes | `stores_tenant_isolation` | `20260822090400_tenant__create_stores.sql` |
| `users` | identity | — | — | — | — | `20260822090000_identity__create_users.sql` |

## Capabilities

| capability | route | permissions | risk | audit | store-scoped |
|---|---|---|---|---|---|
| `membership.invite` | `POST /api/v1/organizations/:organizationId/memberships` | `membership.invite` | MEDIUM_WRITE | yes | — |
| `membership.role.assign` | `POST /api/v1/organizations/:organizationId/memberships/:membershipId/roles` | `membership.role.assign` | HIGH_WRITE | yes | — |
| `organization.create` | `POST /api/v1/organizations` | — | MEDIUM_WRITE | yes | — |
| `store.read` | `GET /api/v1/stores/:storeId` | `store.read` | READ | yes | yes |

## Platform singletons

Roles ADR-030 requires exactly one implementation of.

| role | file |
|---|---|
| `money-allocator` | `modules/money/domain/money.vo.ts` |
| `tenant-context` | `platform/db/tenant-context.ts` |

## Tests by layer

| layer | files | cases |
|---|---|---|
| application | 7 | 36 |
| conformance | 2 | 26 |
| domain | 2 | 21 |
| infrastructure | 3 | 14 |
| integration | 5 | 80 |
| other | 1 | 7 |
| platform | 1 | 5 |

<details><summary>Per file</summary>

| file | layer | cases |
|---|---|---|
| `modules/audit/infrastructure/audit-events-append-only.spec.ts` | infrastructure | 3 |
| `modules/authorization/application/check-permission.service.spec.ts` | application | 2 |
| `modules/identity/application/validate-session.service.spec.ts` | application | 4 |
| `modules/identity/domain/session.entity.spec.ts` | domain | 4 |
| `modules/money/domain/money.vo.spec.ts` | domain | 17 |
| `modules/money/infrastructure/currency-registry.spec.ts` | infrastructure | 7 |
| `modules/tenant/application/assign-membership-role.service.spec.ts` | application | 9 |
| `modules/tenant/application/create-organization.service.spec.ts` | application | 6 |
| `modules/tenant/application/invite-member.service.spec.ts` | application | 7 |
| `modules/tenant/application/read-store.service.spec.ts` | application | 4 |
| `modules/tenant/application/resolve-store-access.service.spec.ts` | application | 4 |
| `modules/tenant/infrastructure/organizations-rls.spec.ts` | infrastructure | 4 |
| `platform/db/tenant-context.spec.ts` | platform | 5 |
| `apps/api/error-contract.integration.spec.ts` | integration | 3 |
| `apps/api/membership-invite.integration.spec.ts` | integration | 22 |
| `apps/api/membership-role-assign.integration.spec.ts` | integration | 27 |
| `apps/api/organization-create.integration.spec.ts` | integration | 13 |
| `apps/api/store-read.integration.spec.ts` | integration | 15 |
| `tools/conformance/harness.selftest.live-db.spec.ts` | conformance | 6 |
| `tools/conformance/harness.selftest.spec.ts` | conformance | 20 |
| `tools/openapi/openapi.spec.ts` | other | 7 |

</details>

## ADR register

| ID | Title | Status | Blocks |
|---|---|---|---|
| ADR-001 | MCP Sensitive Write Confirmation | ACCEPTED | Phase 9 |
| ADR-001b | Mobile UX for HIGH_WRITE Platform Approval | ACCEPTED | Phase 9 |
| ADR-002 | OAuth Identity, Tenant and Store Resolution | ACCEPTED | Phase 1, Phase 9 |
| ADR-003 | MCP Write Idempotency | ACCEPTED | Phase 9 |
| ADR-004 | Python AI Plane to NestJS Capability Boundary | ACCEPTED | Phase 8 |
| ADR-004b | Service Authentication Between AI Plane and NestJS | ACCEPTED | Phase 8 |
| ADR-005 | In-Process Plugin Security Boundary | ACCEPTED | Phase 6 |
| ADR-005b | Malicious/Buggy Plugin Tenant Isolation Testing | ACCEPTED | Phase 6 release |
| ADR-006 | Concurrent Usage and AI Credit Accounting | ACCEPTED | Phase 2 |
| ADR-007 | External MCP Trust Boundary | ACCEPTED | Phase 9 |
| ADR-008 | Entitlement Precedence and Conflict Resolution | ACCEPTED | Phase 2 |
| ADR-009 | Shared Idempotency Store | ACCEPTED | Phase 2, Phase 9 |
| ADR-010 | Non-Functional Requirements and Scale Assumptions | ACCEPTED (was OPEN) | nothing; revisit triggers defined |
| ADR-019 | Storefront Delivery, Caching and Domain Routing | ACCEPTED (was OPEN) | Phase 1 exit, Phase 4 |
| ADR-020 | Data Retention, Deletion and Tenant Offboarding | ACCEPTED (was OPEN) | Phase 2 |
| ADR-021 | Database Access, ORM and RLS Session Handling | ACCEPTED (new) | Phase 1 |
| ADR-022 | Money, Currency and Rounding | ACCEPTED (new) | Phase 2, Phase 3 |
| ADR-023 | Payment Provider Port and Iranian PSP Profile | ACCEPTED (new) | Phase 2, Phase 3 |
| ADR-024 | Subscription Term, Renewal, Expiry and Grace | ACCEPTED (new) | Phase 2 |
| ADR-025 | Plan Change, Upgrade, Downgrade and Proration | ACCEPTED (new) | Phase 2 |
| ADR-026 | Over-Limit Policy and Data Preservation on Downgrade | ACCEPTED (new) | Phase 2 |
| ADR-027 | Domain Verification, TLS Lifecycle and DNS/CDN Port | ACCEPTED (new) | Phase 4 |
| ADR-028 | Host Resolution Security and Domain Ownership | ACCEPTED (new) | Phase 4 |
| ADR-029 | Authentication Provider and Session Strategy | ACCEPTED (new) | Phase 1 |
| ADR-030 | Architecture Conformance Enforcement | ACCEPTED (new) | Phase 1 start |
| ADR-031 | Time, Timezone and Calendar | ACCEPTED (new) | Phase 2 |
| ADR-032 | Storefront Read Path Separation | ACCEPTED (new) | Phase 4 |
| ADR-033 | API Schema Artifact Generation | ACCEPTED (new) | Task 2 (Phase 1) |
| ADR-034 | Audit Event Placement and Durability | ACCEPTED (new) | Phase 1 (in effect), Task 2 |
| ADR-011 | Co-Pilot Cadence vs AI Credit Cost | DEFERRED | Phase 12 |
| ADR-012 | Autonomous AI Execution Opt-In | DEFERRED | Phase 13 |
| ADR-013 | Voice Input Retention | DEFERRED | Phase 14 |
| ADR-014 | Channel Sync Conflict Resolution | DEFERRED | Phase 15 |
| ADR-015 | Dynamic Pricing Auto-Apply Policy | DEFERRED | Phase 16 |
| ADR-016 | Multi-Approver Quorum Rules | DEFERRED | Phase 17 |
| ADR-017 | Marketplace Plugin Review and Payout | DEFERRED | Phase 18 |
| ADR-018 | Financial Services Compliance and Deployment Isolation | DEFERRED | Phase 19 |
