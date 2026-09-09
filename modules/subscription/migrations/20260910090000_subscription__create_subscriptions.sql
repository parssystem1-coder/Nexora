-- Phase 2 item 4: subscriptions, the term, and the period history.
--
-- **The shape below comes from ADR-024 item 1, not from `PHASE_2_BRIEF.md`
-- §4.** §4's two rows are scope entries — *"term, `auto_renew`, status, pinned
-- version ids"* and *"append-only period history, `grace_end`, status"* — and
-- item 3 proved the expensive way that reading §4 as a column list ships a
-- table missing a column. ADR-024 item 1 and `04` §2.3 are the specification;
-- §4 is the fence that says which tables this item may create at all.
--
-- ADR-024 item 1, verbatim:
--
--   subscription
--     term_length            interval, e.g. 1 month, 1 year
--     auto_renew             boolean
--     current_period_id      reference
--     status
--
--   subscription_period
--     id, subscription_id, plan_version_id, price_version_id
--     period_start (utc), period_end (utc)
--     grace_end (utc, nullable)
--     invoice_id (nullable)
--     status: SCHEDULED | CURRENT | ENDED | UNPAID
--
-- `04` §2.3 adds `tenant_id`, `plan_version_id`, `price_version_id`,
-- `trial_end`, `canceled_at` and `reactivation_deadline` to the subscription,
-- and `tenant_id` to the period. Everything below is one of those two sources
-- except `version` (ADR-045), `created_at`/`updated_at`, and the constraints —
-- each noted where it appears.

-- ---------------------------------------------------------------------------
-- subscriptions — mutable by design, and therefore NOT on §5's REVOKE list.
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY,

  -- §5's tenancy rule. A plain column, not a foreign key to `organizations`:
  -- that table belongs to `modules/tenant` and `04` §1 forbids a cross-module
  -- foreign key. `npm run check:fk` now fails the build on one, and **this is
  -- the slice it was built for** — item 3 built it precisely because item 4
  -- would be the first to want the constraint out of habit.
  tenant_id uuid NOT NULL,

  -- ADR-025 item 6's pinning: "a change moves the subscription to a specific
  -- target plan_version_id and price_version_id, captured at change time. A
  -- later edit to that plan must not retroactively alter the change." Both are
  -- plain columns for the same cross-module reason as `tenant_id` — they
  -- reference `billing`'s `plan_versions` and `price_versions`.
  --
  -- Their integrity is not thereby unprotected: both tables are append-only
  -- for `nexora_app` since 2026-09-05, so a pinned version cannot be rewritten
  -- underneath a subscription by the application role at all. That is the
  -- property the foreign key would have been protecting, and it is already
  -- held by a stronger mechanism.
  plan_version_id uuid NOT NULL,
  price_version_id uuid NOT NULL,

  -- ADR-024 item 3's eight states, exactly. The CHECK is the enumeration; the
  -- legal *transitions* between them live in the domain
  -- (`domain/subscription-status.ts`) because a CHECK constraint cannot see the
  -- previous value of a row.
  status text NOT NULL CHECK (
    status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCEL_AT_PERIOD_END', 'EXPIRED', 'CANCELED', 'SUSPENDED')
  ),

  -- ADR-024 item 1's "interval, e.g. 1 month, 1 year", the same type item 2
  -- gave `prices.term_length` so the two join without a translation. ADR-031
  -- item 3 forbids `+365 days` for a term; an interval of months or years is
  -- calendar arithmetic.
  term_length interval NOT NULL,

  auto_renew boolean NOT NULL DEFAULT true,

  -- ADR-024 item 1's "reference". Nullable and constrained after
  -- `subscription_periods` exists — the two tables reference each other, so one
  -- of the constraints must be added second. Same module, so `check:fk` is
  -- satisfied either way.
  current_period_id uuid,

  -- `04` §2.3. `trial_end` is the record that this subscription began as a
  -- trial, and it is never cleared on conversion — ADR-052 item 3's "one trial
  -- per organization" is enforced against it below, and a cleared column would
  -- make the constraint enforce "one *active* trial", which is a different and
  -- weaker rule.
  trial_end timestamptz,
  canceled_at timestamptz,
  reactivation_deadline timestamptz,

  -- ADR-045's ruling, which names this table explicitly: "`subscriptions` |
  -- **yes** | the renewal job, `subscription.cancel`, `plan.change` and
  -- `subscription.reactivate` all write it." Every update carries
  -- `WHERE ... AND version = $n` and bumps it; zero rows affected surfaces as
  -- `CONCURRENCY_CONFLICT` / 409. **None of those four writers exists yet** —
  -- they are items 5, 14, 15 and 16 — and the column is added here because
  -- ADR-045 requires it "in each table's **creating** migration".
  version integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_term_length_positive CHECK (term_length > interval '0'),
  -- A canceled subscription is the only one that may carry `canceled_at`, and
  -- ADR-024 item 3 makes `CANCELED` terminal.
  CONSTRAINT subscriptions_canceled_at_matches_status CHECK (
    (status = 'CANCELED') = (canceled_at IS NOT NULL)
  )
);

-- **ADR-052 item 3, which rules the mechanism and leaves the shape here:**
-- "One trial per organization, enforced by a database constraint. Not by
-- application logic. A uniqueness rule that lives only in a service is a rule
-- that a second caller, a retry, or a future second code path can violate."
--
-- A partial unique index on the tenant is that constraint. Because `trial_end`
-- is never cleared, this holds for the organization's whole life rather than
-- only while a trial is running — which is what "one trial per organization"
-- says.
CREATE UNIQUE INDEX subscriptions_one_trial_per_tenant
  ON subscriptions (tenant_id)
  WHERE trial_end IS NOT NULL;

-- The tenant-leading access path `04` §8 requires of a tenant-owned table.
CREATE INDEX subscriptions_tenant_id_status_idx ON subscriptions (tenant_id, status);

-- ---------------------------------------------------------------------------
-- subscription_periods — append-only period history.
-- ---------------------------------------------------------------------------
-- ADR-024 item 1: "Renewal appends a period. It never mutates a previous one.
-- This is what makes billing history reconstructible."
--
-- **Not an ADR-041 partitioning candidate**, and this was read rather than
-- assumed: that ruling's own text says "`invoices`, `invoice_lines` and
-- `subscription_periods` are **not** [candidates], being bounded by business
-- volume". Its three obligations bind items 4, 5, 9 and 12, so they were worked
-- through for this table rather than applied by reflex — obligation 1 (an
-- immutable event column) and obligation 3 (no uniqueness excluding it) bind
-- candidate tables and bind nothing here; obligation 2 (no foreign key
-- referencing a candidate) binds this table and is satisfied: the only
-- candidate in reach is `subscription_state_transitions`, which is **item 5's**
-- and is not created here.
CREATE TABLE subscription_periods (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,

  -- Same module, so a real foreign key is correct here and `check:fk` agrees.
  subscription_id uuid NOT NULL REFERENCES subscriptions(id),

  -- Pinned per period, not inherited from the subscription. ADR-047 re-pins the
  -- price version at each renewal invoice's issuance, so two periods of one
  -- subscription can legitimately carry different versions — which is exactly
  -- what makes the history reconstructible.
  plan_version_id uuid NOT NULL,
  price_version_id uuid NOT NULL,

  -- ADR-031 item 1: UTC `timestamptz`. ADR-031 item 4: half-open [start, end).
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,

  -- ADR-024 item 4's grace window, set when a period goes unpaid. Null until
  -- then; item 14 owns the transition that sets it.
  grace_end timestamptz,

  -- Nullable, and deliberately not a foreign key: `invoices` is item 13's table
  -- in the `billing` module and does not exist yet. Both reasons stand alone.
  invoice_id uuid,

  status text NOT NULL CHECK (status IN ('SCHEDULED', 'CURRENT', 'ENDED', 'UNPAID')),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscription_periods_end_after_start CHECK (period_end > period_start),
  CONSTRAINT subscription_periods_grace_after_end CHECK (grace_end IS NULL OR grace_end > period_end)
);

-- No `version` column: ADR-045's list does not name this table, and an
-- append-only table cannot have an optimistic-concurrency token anyway — that
-- ADR's own recommendation calls it "a defect, not a harmless extra", since the
-- column would be a field nothing can ever change.

CREATE INDEX subscription_periods_subscription_id_period_start_idx
  ON subscription_periods (subscription_id, period_start DESC);
CREATE INDEX subscription_periods_tenant_id_idx ON subscription_periods (tenant_id);

-- The second half of the mutual reference, added now that both tables exist.
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_current_period_id_fkey
  FOREIGN KEY (current_period_id) REFERENCES subscription_periods(id);

-- ---------------------------------------------------------------------------
-- Tenancy and RLS, in the creating migration as `PHASE_2_BRIEF.md` §5 requires.
-- ---------------------------------------------------------------------------
-- Compared as text, not uuid: `current_setting(..., true)` returns '' for an
-- unset context and `''::uuid` raises instead of failing closed.
--
-- One policy per table covering every command, following `idempotency_records`
-- rather than `organizations`. `organizations` needed per-command policies
-- because its INSERT creates its own tenant and has no pre-existing `tenant_id`
-- to check against; nothing here creates a tenant, so one predicate is correct
-- for USING and WITH CHECK alike and PostgreSQL applies it to both.
--
-- No self-access OR clause: neither table is read before a TenantContext
-- exists. The bootstrap case that forced one onto `memberships` (R-003) has no
-- analogue here — the guard chain has already resolved the tenant before any
-- subscription is looked up.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE subscription_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_periods FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_periods_tenant_isolation ON subscription_periods
  USING (tenant_id::text = current_setting('app.tenant_id', true));
