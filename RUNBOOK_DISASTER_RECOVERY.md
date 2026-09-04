# Runbook — Total Loss of the Database Cluster

**Owner:** the maintainer. **Ruled by:** ADR-061 (`ACCEPTED`, 2026-09-03). **Tracked by:** `RISK_REGISTER.md` R-041.

> **Status, stated first because everything below depends on it.** **No backup exists yet. No provider has been chosen and nothing has been provisioned.** This runbook is written now, while nobody is under pressure, so that the procurement decision has something to be judged against — ADR-061's reasoning. **Until the first restore drill has run, the platform does not claim a recovery path**, and R-041 stays open regardless of what is configured. Every `‹…›` below is a value that does not exist yet and must be filled in when it does.

**This is an operational document, not a decision authority.** It is deliberately absent from `AGENTS.md` §1's read order, which lists what binds an implementer building the product — the same treatment `TECHNOLOGY_RADAR.md` and `COMPETITIVE_POSITION.md` already get. It follows ADR-061; it does not decide anything.

---

## 0. Scope

**This runbook covers total loss of the machine or account carrying the PostgreSQL cluster.**

It does **not** cover recovering one tenant. That is **ADR-054**'s nightly per-tenant logical snapshot, a different mechanism with a different RPO (24 hours) and a different operator action. **If one tenant is broken and the cluster is healthy, you are in the wrong document** — the two were separated deliberately, and conflating them under pressure is how a single-tenant incident becomes a platform-wide restore.

**Targets, from ADR-010's assumptions table:** **RPO 15 minutes, RTO 4 hours.** ADR-010's 2026-08-28 amendment records that every number in that table is an unverified design assumption rather than a measured requirement or a contractual SLO. **They are what to design and drill against; they are not a promise anyone has kept yet.**

---

## 1. Declaring the incident

**Who declares:** the maintainer. Until there is a second operator, there is no escalation path and no rota, and pretending otherwise in a runbook is worse than saying so.

**First action, before any restore:** **stop the application.** A running application against a partially restored or stale database writes rows that the real restore then has to reconcile against — and because `invoices`, `billing_payment_events`, `usage_ledger_entries` and the other append-only tables carry `REVOKE UPDATE, DELETE` (`PHASE_2_BRIEF.md` §5), **those writes cannot be cleaned up afterwards by the application role.** Every minute the application runs during an incident adds rows to a ledger that will need compensating entries.

**Record the wall-clock moment of loss.** Section 4 uses it to bound what was lost, and it is the one fact that is hardest to reconstruct later.

---

## 2. Where things are

| What | Where | Credential |
|---|---|---|
| Base backup / nightly snapshot | ‹object storage bucket, ADR-060› | ‹`secret_ref` → ADR-037 resolver› |
| WAL archive | ‹object storage bucket, ADR-060› | ‹as above› |
| Off-account copy | ‹second account or provider — **must not be the account that ran the cluster**› | ‹separate credential› |
| Backup encryption key | ‹**not** stored with the backup› | ADR-037; today this resolves from configuration, not a secret store |

**ADR-037's resolver is deferred**, so today a `secret_ref` resolves from `platform/config.ts` — an environment variable. **If the environment that held that configuration is also gone, the key is gone and the backup is unreadable.** That is a real single point of failure in the current state, named here rather than discovered during an incident. **Keeping a copy of the backup encryption key somewhere independent of both the cluster and its configuration is the minimum owed before the first backup is taken.**

---

## 3. Restore sequence

Run in order. Steps 1–2 are the ones most often skipped, and skipping them produces a database that looks restored and is not usable.

1. **Provision an empty PostgreSQL 17 instance.** Match the major version; a base backup does not restore across major versions.
2. **Bootstrap the roles — `platform/db/init/001_roles.sql`.** This creates `nexora_migrate` (owner) and `nexora_app` (`NOSUPERUSER`, `NOBYPASSRLS`, never an owner) and the `ALTER DEFAULT PRIVILEGES` grant. **The entire RLS model depends on that split** (ADR-021): restored data under a single superuser role is data with no tenant isolation, and the application connecting as an owner would bypass every policy. A restore that omits this step yields a database the application **cannot safely be pointed at**, and nothing later in this sequence will fail visibly because of it.
3. **Restore the base backup.**
4. **Replay the WAL archive** to the latest available point, or to a chosen point before a logical corruption if that is the incident.
5. **Verify — section 4. Do not start the application first.**
6. **Point the application at the restored instance and start it.**
7. **Recover payments taken inside the lost window — section 5.**

---

## 4. Verifying completeness

**Two checks the append-only tables give for free.** Both are arithmetic rather than judgement, which is what you want at 3am.

**Invoice numbering.** ADR-048 rules the invoice number **gap-free**, allocated from a single counter locked inside the issuing transaction. **So a gap is detectable and means exactly one thing: invoices were issued after the restore point.** Compare the highest `invoices.number` against the counter row. A counter ahead of the highest invoice is the number of invoices lost.

**Audit timestamps.** ADR-034 item 4 writes one `audit_events` row per capability attempt, success or failure. **The newest `occurred_at` bounds the restore point directly**, and the gap between it and the recorded moment of loss (section 1) **is** the lost window. Everything in section 5 is scoped by that interval.

**Then run the tenant-isolation suite** against the restored instance. It enumerates every RLS-protected table live from `pg_class`/`pg_policy` and proves cross-tenant denial as the real `nexora_app` role — which is the check that would catch a step-2 failure, and the only one that would.

---

## 5. Payments taken inside the lost window

**This is the step usually missing from a runbook, and it needs no new mechanism.**

A payment the provider accepted inside the lost window exists on the provider's side and not on ours. **ADR-023 item 4's reconciliation sweep already exists for exactly this shape** — *"sweep every `PENDING` intent older than a configured threshold and verify it against the provider"* — and it is idempotent through ADR-009 and must handle verified-paid, verified-failed, expired and provider-unknown.

**Run it over the lost window.** Its `provider-unknown` path already escalates to a human queue after a bounded number of attempts rather than failing silently, which is the correct behaviour here too.

**What it cannot recover: an intent that was never persisted.** If the intent row itself was in the lost window, there is no `PENDING` row for the sweep to find. **Those are found from the provider's side**, by listing the provider's transactions over the window and matching against what the restored database holds. **List that as a manual step and do not pretend the sweep covers it** — ADR-023 item 10 already establishes the precedent that where automation is absent, the domain exposes a manual path with audit rather than pretending.

---

## 6. What tenants are told

**During:** that the platform is unavailable and that an incident is in progress. ADR-059 rules that a non-serving host returns `503` with `Retry-After`, which is the correct response while this runbook is being executed and requires no separate decision.

**After, to every tenant:** that an incident occurred, the window affected, and whether any of their data was lost.

**After, to affected tenants specifically:** what was lost and what was reconstructed. **ADR-020 rule 7 already obliges the platform to document its retention window to the tenant**; a data-loss incident is the moment that obligation is actually tested.

---

## 7. After the drill or the incident

**Write down the measured restore time and compare it against ADR-010's 4-hour RTO.** ADR-061's verification list requires this, and the first drill produces **the first real measurement of a number ADR-010 has only ever assumed** — so record it as a measurement, and note that ADR-010's amendment forbids citing its targets as met until Phase 4 item 9 has run.

**Record what the runbook got wrong.** A drill whose only output is "it worked" has wasted the rehearsal.

**Quarterly cadence**, per ADR-061. **The first drill is what allows R-041 to close.**
