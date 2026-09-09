-- Phase 2 item 5: the append-only subscription state transition log.
--
-- ADR-024 item 3, which requires it: "Any other transition is a domain error.
-- **Transitions are recorded in an append-only transition log with actor and
-- reason.**"
--
-- `04` §2.3 gives the shape, and per §4's 2026-09-10 note it is that shape and
-- not §4's summary row that is the specification:
--
--   subscription_state_transitions     -- new, append-only
--     id, tenant_id, subscription_id
--     from_status, to_status, reason_code, actor_type, actor_id, occurred_at
--
-- ---------------------------------------------------------------------------
-- **This is the first table any Phase 2 item has created that ADR-041's
-- obligations actually bind.** Items 1–4 created none of its candidates.
-- ---------------------------------------------------------------------------
-- ADR-041's ruling names this table explicitly as a partitioning candidate,
-- under its own definition: "a table is a **partitioning candidate** if its row
-- count grows with platform **activity** — one row per attempt, per event, per
-- interaction. It is **not** if its row count is bounded by **business volume**
-- — one row per invoice, per period, per subscription." A transition is an
-- event; `subscription_periods` (item 4) was the other side of that line and is
-- deliberately not a candidate.
--
-- Nothing here is partitioned — that is the whole of ADR-041's ruling, which
-- chose "keep the append-only tables partition-*compatible*, and do not
-- partition them". What binds are three cheap negatives, each worked through
-- rather than assumed:
--
--   **Obligation 1 — an immutable `timestamptz NOT NULL` event column.**
--   `occurred_at` below. The ruling's own words: "Append-only tables have one
--   anyway; this makes it a requirement rather than a coincidence." It is the
--   column a future partition key would use, so it is `NOT NULL`, has no
--   default that could be overridden per row inconsistently, and is never
--   updated — the REVOKE in the migration beside this one makes that a
--   privilege rather than a convention.
--
--   **Obligation 2 — no table may declare a foreign key REFERENCING a candidate
--   table.** Read the direction carefully, because the two are opposite risks.
--   Forbidden: some other table pointing *at* this one. Permitted, and present
--   below: this table pointing *at* `subscriptions`. The reason is
--   PostgreSQL's, not a preference — "an FK's referenced columns [must] be
--   covered by a unique constraint, and on a partitioned table every unique
--   constraint must include the partition key — so an FK on `id` alone is
--   exactly what a later conversion cannot keep." That constrains what may be
--   *referenced*, and says nothing about what a candidate may reference.
--   `subscriptions` is not a candidate, is in this module, and is not going to
--   be partitioned, so `subscription_id` below is a real foreign key.
--
--   **Obligation 3 — no uniqueness requirement that excludes the event column.**
--   **This table needs none beyond the primary key**, and that is a design
--   statement rather than an omission: a subscription may legitimately make the
--   same transition twice (`ACTIVE` → `PAST_DUE` → `ACTIVE` → `PAST_DUE` across
--   two renewal cycles), so there is nothing here to make unique. Idempotency
--   for the jobs that will write these rows lives on `idempotency_records`
--   (ADR-009), which is where ADR-041's own analysis of `billing_payment_events`
--   says it belongs. **No permanent exclusion from partitioning is created, and
--   none is recorded.**
--
-- `id uuid PRIMARY KEY` **stays**, per the ruling's own last line: "Uniqueness
-- is kept while it is free; Q0's finding that partitioning surrenders it is a
-- known price of the future conversion, recorded and not paid today."
CREATE TABLE subscription_state_transitions (
  id uuid PRIMARY KEY,

  -- §5's tenancy rule. A plain column, not a foreign key to `organizations`:
  -- that is `modules/tenant`'s table and `04` §1 forbids a cross-module foreign
  -- key. `npm run check:fk` enforces it.
  tenant_id uuid NOT NULL,

  -- Intra-module, and permitted by obligation 2 as read above.
  subscription_id uuid NOT NULL REFERENCES subscriptions(id),

  -- ADR-024 item 3's eight states, both sides. `from_status` is NOT NULL
  -- because every row here is a *transition* — a subscription's creation is not
  -- one, and item 4 deliberately writes no row for it, so this column never has
  -- to be nullable to represent an opening entry.
  from_status text NOT NULL CHECK (
    from_status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCEL_AT_PERIOD_END', 'EXPIRED', 'CANCELED', 'SUSPENDED')
  ),
  to_status text NOT NULL CHECK (
    to_status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCEL_AT_PERIOD_END', 'EXPIRED', 'CANCELED', 'SUSPENDED')
  ),

  -- ADR-024 item 3's "reason", as a closed vocabulary rather than free text.
  -- The list matches `domain/transition-reason.ts` exactly; item 14's jobs and
  -- item 16's reactivation will write into it, and they must use the same words
  -- or the log cannot be queried. Adding one is a migration plus a code edit,
  -- deliberately.
  reason_code text NOT NULL CHECK (
    reason_code IN (
      'TRIAL_STARTED', 'CANCELED_BY_TENANT', 'SCHEDULED_CANCELLATION_BY_TENANT',
      'PAYMENT_VERIFIED', 'PAYMENT_MISSED', 'GRACE_ELAPSED', 'TRIAL_EXPIRED',
      'TERM_ENDED', 'REACTIVATED', 'PLAN_CHANGED',
      'PAUSED_BY_OPERATOR', 'RESUMED_BY_OPERATOR',
      'SUSPENDED_BY_OPERATOR', 'REINSTATED_BY_OPERATOR'
    )
  ),

  -- ADR-024 item 3's "actor". The same vocabulary `audit_events.actor_type`
  -- uses, not a second one.
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'service', 'system', 'plugin', 'agent')),

  -- Nullable on purpose: a scheduled job (item 14) is `system` and has no user
  -- id. A fabricated one would be worse than an honest null — the same
  -- reasoning `audit_events.actor_user_id` already carries for an unresolved
  -- actor.
  actor_id uuid,

  -- ADR-041 obligation 1's event column. ADR-031 item 1: UTC `timestamptz`.
  occurred_at timestamptz NOT NULL DEFAULT now(),

  -- A transition must move somewhere. The legal *pairs* are ADR-024 item 3's
  -- and live in `domain/subscription-status.ts`, because a CHECK cannot see the
  -- previous row; this only rules out the degenerate case, which no legal
  -- transition includes anyway.
  CONSTRAINT subscription_state_transitions_actually_transitions CHECK (from_status <> to_status)
);

-- No `version` column: ADR-045's list does not name this table, and an
-- append-only table cannot carry an optimistic-concurrency token — that ADR's
-- own recommendation calls it "a defect, not a harmless extra", since the
-- column would be a field nothing can ever change.
--
-- No `deleted_at`: ADR-046 rules no soft-delete column in Phase 2.

-- Tenant-leading, per `04` §8, and ordered by the event column so that reading
-- one subscription's history is a range scan rather than a sort.
CREATE INDEX subscription_state_transitions_subscription_id_occurred_at_idx
  ON subscription_state_transitions (subscription_id, occurred_at DESC);
CREATE INDEX subscription_state_transitions_tenant_id_occurred_at_idx
  ON subscription_state_transitions (tenant_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Tenancy and RLS, in the creating migration as `PHASE_2_BRIEF.md` §5 requires.
-- ---------------------------------------------------------------------------
-- Compared as text, not uuid: `current_setting(..., true)` returns '' for an
-- unset context and `''::uuid` raises instead of failing closed.
--
-- One policy covering every command, following `idempotency_records` and item
-- 4's two tables. Nothing here creates a tenant, so one predicate is correct
-- for USING and WITH CHECK alike.
ALTER TABLE subscription_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_state_transitions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_state_transitions_tenant_isolation ON subscription_state_transitions
  USING (tenant_id::text = current_setting('app.tenant_id', true));
