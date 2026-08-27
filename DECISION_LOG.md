# Decision Log

Per `AGENTS.md` section 5: when an implementer is uncertain, the ambiguity is written here with options and a recommendation instead of being silently resolved. Entries are grouped by calendar month under `decisions/`, newest month first; within a file, newest entry at the top (unchanged from the original single-file convention).

**This file is now an index.** The entries themselves live in `decisions/YYYY-MM.md`. This split happened 2026-08-27 purely to cut per-session context cost (`DECISION_LOG.md` had grown to ~274 KB); no entry was reworded, reformatted, or reordered — see that date's own entry in `decisions/2026-08.md` for the split's own record and the diff that proved it.

| Period file | Date range covered |
|---|---|
| `decisions/2026-09.md` | 2026-09-01 – 2026-09-02 |
| `decisions/2026-08.md` | 2026-08-22 – 2026-08-31 |

**New entries go into the file for the current month** (e.g. an entry dated 2026-10-05 goes into `decisions/2026-10.md`), creating that file if it does not yet exist — add a row to the table above when you do. Use the template below.

Template for a new entry:

```
## YYYY-MM-DD — <short title>

**Context:** what document or task raised the ambiguity, and why the docs pack doesn't settle it.
**Options considered:** A, B, C with tradeoffs.
**Decision:** what was picked and why.
**Status:** OPEN (needs human review) | RESOLVED
```
