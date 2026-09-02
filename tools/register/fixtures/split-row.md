# Risk Register

R-004 spans two physical lines, which terminates the table outright. Every row is one physical line and renders
exactly eight cells, including rows carrying escaped pipes inside inline code
spans — `a \| b` is content, not a delimiter.

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status | Opened |
|---|---|---|---|---|---|---|---|
| R-001 | A plain row | Low | Low | None | User | OPEN | 2026-08-22 |
| R-002 | A row quoting a grep pattern `parallel\|pool\|concurren` | Medium | Low | None | User | OPEN | 2026-08-23 |
| R-003 | A row quoting `s === 409 \|\| s === 401` | Low | Medium | None | User | CLOSED | 2026-08-24 |
| R-004 | Row four, whose mitigation cell
continues onto a second physical line | Low | Low | None | User | OPEN | 2026-08-25 |
| R-005 | Row five | Low | Low | None | User | OPEN | 2026-08-26 |
| R-006 | Row six | Low | Low | None | User | OPEN | 2026-08-27 |
| R-007 | Row seven | Low | Low | None | User | OPEN | 2026-08-28 |
| R-008 | Row eight | Low | Low | None | User | OPEN | 2026-08-29 |
| R-009 | Row nine | Low | Low | None | User | OPEN | 2026-08-30 |
| R-010 | Row ten | Low | Low | None | User | OPEN | 2026-08-31 |
