---
name: project-graph
description: Regenerate and read the mechanically-extracted map of what this repository contains — modules and their real dependency edges, tables and their RLS posture, capabilities, routes, platform singletons, the ADR register, and tests by layer. Use at the start of any task that needs to know what already exists, and to see what changed structurally since an earlier commit. Cheaper than rediscovering the same facts by reading files.
---

# Project graph

`npm run graph` parses the repository and writes `PROJECT_GRAPH.md` plus `tools/graph/project-graph.json`. Every row is derived from source. Nothing in it is written by hand or summarised by a model — that is deliberate, and it is the only reason the file can be trusted without re-verification.

## Commands

```bash
npm run graph                  # regenerate both files
npm run graph -- --check       # exit 1 if the committed graph is stale (CI)
npm run graph -- --since HEAD~5   # structural diff against an earlier commit
```

## When to run it

- **At the start of any task** that needs to know what exists — a new slice, a review, a question about scope. Reading one table beats grepping the tree.
- **After finishing a slice**, so the committed graph stays current. A stale graph is worse than none, because it is trusted.
- **Before a phase gate**, with `--since` against the last gate's commit, to see exactly what the phase added.

## What it answers, instantly

| Question | Section |
|---|---|
| Which modules exist and what does each actually import? | Modules |
| Which tables exist, which carry `tenant_id`, RLS, `FORCE`, and which policies? | Tables |
| Which capabilities are implemented, on what route, needing which permission? | Capabilities |
| Which file holds each ADR-030 singleton role? | Platform singletons |
| How many tests exist at each layer? | Tests by layer |
| What is every ADR's id, status, and what it blocks? | ADR register |

## What it cannot answer — read this before relying on it

The graph reports **structure**, not **correctness**. Every real defect found in this repository so far was invisible to structural extraction:

- Two documents describing the same mechanism differently — a *semantic* contradiction in prose. No parser sees it.
- A test whose title and imports are fine but whose assertion is backwards.
- An error path that is unreachable because a foreign key prevents the state it handles.
- Whether a design decision is the right one, or which of two findings matters more.

So: use the graph to skip rediscovery, then do the actual reading and judging on top of it. A task that ends at the graph has not been reviewed. Rules are enforced by the conformance harness (ADR-030), not here — this tool asserts nothing and fails nothing except `--check`.

## Reading a row correctly

A missing mark is a **fact**, not a verdict. `users` showing no `tenant_id` and no RLS is correct — it is a documented exemption in the phase brief §5. The graph does not know which absences are intended; cross-reference the brief before calling one a defect.

## When a row looks wrong

The source is wrong, or the extractor's parsing is. Fix the source; if the parsing is at fault, fix `tools/graph/extract.ts` and say so — never hand-edit `PROJECT_GRAPH.md`, because the next run silently overwrites it and the correction disappears.
