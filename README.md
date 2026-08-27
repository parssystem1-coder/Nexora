# Nexora

> This file is a signpost, not an authority. It makes no normative claims about the system. `AGENTS.md` is the operating contract, and when documents disagree the precedence order is **ADR Index > Architecture RFC > Technical/Database/Contract docs > Platform Overview > Source Master Spec**. If anything below drifts from those, they win.

A multi-tenant SaaS platform that lets a business create and run an online store without engineering, built so the same platform core can later sell CRM, SEO, marketing, analytics, automation and AI products to the same customers without being rebuilt. Phase 1 is in progress — see `PROJECT_GRAPH.md` for what currently exists.

## Stack

| Concern | Decision |
|---|---|
| Backend | NestJS + TypeScript, modular monolith |
| Frontend | Next.js + React + TypeScript |
| Database | PostgreSQL with row-level security |
| Data access | Kysely over `pg`. No heavy ORM |
| Cache / queue | Redis + BullMQ |
| Auth | first-party, Argon2id, server-side revocable sessions |
| Money | integer minor units + explicit currency |
| Time | UTC `timestamptz`, injected clock, calendar arithmetic |
| Migrations | reviewed plain SQL, forward-only |

Fixed in `08_PHASE_1_BRIEF.md` §0 — not decided here.

## Where to start reading

1. `README_START_HERE.md` — why the documentation pack is shaped the way it is, and the full read order.
2. `AGENTS.md` — the operating contract every implementer, human or AI, follows.
3. `08_PHASE_1_BRIEF.md` — the only scope currently authorized.

## Running it locally

```
npm run typecheck && npm run lint && npm run format:check && npm test && npm run conformance && npm run db:migrate
```

Needs PostgreSQL up with the roles `platform/db/init/001_roles.sql` creates. CI runs `docker compose up -d --wait` (`docker-compose.yml`, port 5433); a machine without Docker needs a native PostgreSQL 17 instead — see `CLAUDE.md`'s "Local database note" for the connection strings that case needs.

## What exists right now

`PROJECT_GRAPH.md` is mechanically regenerated from source (`npm run graph`) — modules, tables, capabilities, routes, and tests, as they actually are, not as prose describes them.
