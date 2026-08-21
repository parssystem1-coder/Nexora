# future/ - Deferred Surfaces

**Do not load anything in this folder into an implementation context during Phase 1 through Phase 5.**

These surfaces are architecturally reserved. Their contracts are preserved in the RFC so they can be added without a rebuild. Their implementation detail lives here, deliberately out of sight, because their presence in an implementation context causes over-engineering of the current phase.

| Surface | Reopen at | Blocking ADR |
|---|---|---|
| Full CRM domain | after commerce is profitable | none |
| Full SEO domain | Phase 7 | none |
| Marketing and Analytics domains | Phase 7+ | none |
| Plugin platform, trusted plugins | Phase 6 | ADR-005, ADR-005b |
| Plugin marketplace, untrusted | after a real sandbox exists | ADR-017 |
| AI plane and co-pilot | Phase 8 | ADR-004, ADR-004b, ADR-011, ADR-012 |
| Voice input | Phase 14 | ADR-013 |
| MCP server and client | Phase 9 | ADR-001, ADR-001b, ADR-002, ADR-003, ADR-007 |
| RAG and embeddings | after AI plane ships | none |
| Advanced automation builder | Phase 10 | none |
| Multi-channel commerce | Phase 15 | ADR-014 |
| Dynamic pricing | Phase 16 | ADR-015 |
| Multi-approver quorum | Phase 17 | ADR-016 |
| Embedded financial services | Phase 19, legal sign-off first | ADR-018 |
| Multi-warehouse inventory | when a merchant needs it | none |
| Dedicated-tenant and multi-region | enterprise demand | none |
| Multi-currency conversion | second market | extends ADR-022 |
| Wildcard certificates for tenant domains | when tenant DNS API access is in scope | extends ADR-027 |
| OpenSearch | when PostgreSQL FTS is measurably insufficient | none |

## The rule that keeps this folder honest

Anything in here may influence a **contract**. Nothing in here may influence a **table, an abstraction or a code path** before its phase. If you find yourself building for something on this list, stop.
