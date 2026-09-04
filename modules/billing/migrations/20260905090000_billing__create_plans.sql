-- Phase 2 item 1: plan and plan version — the Phase 2 reference slice
-- (PHASE_2_BRIEF.md §2), delivering the `plan.list` capability.
--
-- These are the first three tables in this codebase with no `tenant_id` and
-- no RLS policy. That is deliberate and is PHASE_2_BRIEF.md §5's stated
-- exemption, quoted here because a reader arriving at this file must not
-- have to guess whether the omission is a decision or an oversight:
--
--   "plans, plan_versions, plan_features, prices, price_versions,
--    plan_entitlements, plan_quota_policies — platform-authored reference
--    data, identical for every tenant. 05 §4.2 scopes plan.list global, not
--    tenant; a tenant-scoped plan catalogue would make plan.list
--    unanswerable before a tenant context exists, the same bootstrap
--    problem R-003 documents for memberships."
--
-- The catalogue is what the platform offers to everyone; there is no tenant
-- whose rows these are, and every tenant may read all of it. Both
-- conformance schema rules (static and live) carry these three names on
-- their TENANT_EXEMPT list — the checker being told the truth about a
-- table's design, which is not the same act as an exceptions.json entry.

-- ---------------------------------------------------------------------------
-- plans — plan identity, and nothing else.
-- ---------------------------------------------------------------------------
-- ADR-044's ruling item 1, verbatim: "plans, plan_versions and plan_features
-- carry a stable machine `key` only. No name, label, title, description or
-- locale-map column is added by item 1." A plan's display name is marketing
-- copy with a far shorter half-life than this schema, and a client renders
-- `key` through its own catalogue mapping.
--
-- Ruling ب-3 (2026-09-04): no family or product-line column. The competitor's
-- product tabs are presentation, and nothing here depends on them.
CREATE TABLE plans (
  id uuid PRIMARY KEY,
  -- Machine key. Lowercase, dot- and underscore-safe, never displayed as-is.
  key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_key_is_machine_key CHECK (key ~ '^[a-z][a-z0-9_]*$')
);

-- ---------------------------------------------------------------------------
-- plan_versions — the immutable versioned definition.
-- ---------------------------------------------------------------------------
-- PHASE_2_BRIEF.md §4 calls this an "immutable versioned plan definition" and
-- §2 warns that "getting the immutability boundary wrong here propagates into
-- prices, subscriptions, invoices and subscription_changes". ADR-025 item 6's
-- version pinning rests on it.
--
-- IMMUTABILITY IS NOT ENFORCED BY A GRANT HERE, AND THAT IS A KNOWN GAP, NOT
-- AN OVERSIGHT. `plan_versions` is NOT on PHASE_2_BRIEF.md §5's
-- `REVOKE UPDATE, DELETE` list — checked against that list rather than
-- assumed. Amending §5's list is that file's decision (authority #2), exactly
-- as ADR-048 could not add a table to §4 and ADR-057 could not add a
-- capability to §3, so this slice does not take it. What this slice CAN do,
-- and does, is make the later decision free: no column below is ever
-- updated, supersession is by appending a row with a later `effective_from`
-- (ADR-055 part 5's resolution rule for `tax_rates`), and `audit_events`
-- already proves a REVOKE can be added by its own later migration
-- (20260822100100_audit__enforce_append_only.sql) without a data migration.
--
-- ADR-052 (self-serve trial) blocks this migration: "trial eligibility and
-- duration are plan-version columns and migrations are forward-only." The ADR
-- deliberately does not name the columns — "their names, types and
-- nullability are items 1 and 2's design work". One non-null integer carries
-- both: eligibility is `trial_period_days > 0`, duration is its value, and
-- "offers no trial" is 0 rather than NULL so that the ADR's own verification
-- item holds — "the second is not a special case in any query".
--
-- 14, not 7: ADR-052's 2026-09-04 amendment (ruling ب-7) supersedes the
-- original number. The seed below uses it; the column default stays 0,
-- because a plan version that says nothing about trials offers none.
--
-- ADR-045 gives this table NO `version` column in its optimistic-concurrency
-- sense. Its ruling names four tables — subscriptions, subscription_changes,
-- billing_payment_intents, tenant_over_limit_states — and item 1's tables are
-- not among them. `version` below is the plan version's own ordinal, which is
-- a different thing wearing the same word, and it is immutable.
CREATE TABLE plan_versions (
  id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES plans(id),
  -- The version ordinal within its plan. Not an ADR-045 concurrency token.
  version integer NOT NULL,
  -- ADR-052: eligibility and duration in one column. 0 = offers no trial.
  trial_period_days integer NOT NULL DEFAULT 0,
  -- ADR-031 item 1: UTC timestamptz. Resolution rule for "the version in
  -- force" is the greatest `effective_from` not in the future, matching
  -- ADR-055 part 5's rule for `tax_rates` rather than inventing a second one.
  effective_from timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_versions_plan_id_version_key UNIQUE (plan_id, version),
  CONSTRAINT plan_versions_version_positive CHECK (version >= 1),
  CONSTRAINT plan_versions_trial_period_days_non_negative CHECK (trial_period_days >= 0)
);

-- The index behind plan.list's ordering. ADR-036 item 7's leading-column rule
-- is about tenant-owned tables and does not apply — there is no tenant_id to
-- lead with — but the sort still needs an index to seek into.
CREATE INDEX plan_versions_plan_id_effective_from_idx
  ON plan_versions (plan_id, effective_from DESC, version DESC);

-- ---------------------------------------------------------------------------
-- plan_features — the features a plan version GRANTS.
-- ---------------------------------------------------------------------------
-- PHASE_2_BRIEF.md §4's own description of this table is "features a plan
-- version grants", and that word decides the polarity of every row below:
-- these are grants, not restrictions. See the seed for what that means for
-- ruling ب-8.
--
-- A feature key is a machine key, exactly as ADR-044 requires of `plans` and
-- `plan_versions`. No display text, and no brand name — the platform's
-- commercial name is not chosen, and a key that embedded it would be a
-- rename away from being wrong in an append-only-shaped table.
CREATE TABLE plan_features (
  plan_version_id uuid NOT NULL REFERENCES plan_versions(id),
  feature_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_features_pkey PRIMARY KEY (plan_version_id, feature_key),
  CONSTRAINT plan_features_key_is_machine_key CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$')
);

-- ---------------------------------------------------------------------------
-- Seed. D2-11: no capability creates or edits a plan in Phase 2, so this
-- migration is how the catalogue exists at all. RISK_REGISTER.md R-032 tracks
-- that gap; ruling ح-2 (2026-09-04) gives it Phase 2.5 and an owner.
-- ---------------------------------------------------------------------------
-- NO AMOUNT AND NO CURRENCY APPEARS BELOW. Prices are item 2, and
-- PHASE_2_BRIEF.md §2 is explicit that money must not cross this slice:
-- "Keeping MoneyDto out keeps the reference slice reviewable and keeps the
-- money question as item 2's own explicit gate (§6 criterion 14)."
--
-- Two plans, and the reason is ruling ب-8. That ruling says the attribution
-- mark "appears on trials only and is removed on every paid plan", and that
-- it is "one flag in plan_features". A flag on a plan version can only
-- distinguish the two if a trial offering and a paid offering are different
-- plan versions — on a single shared version, a trialling and a paid
-- subscription differ by subscription STATE, which no plan_features row can
-- see. So the catalogue carries a trial offering and a paid plan.
--
-- That is consistent with ADR-052, not a departure from it: "plan.subscribe
-- has two outcomes depending on the plan version it is given — a trialling
-- subscription when that version offers a trial, an ACTIVE one when it does
-- not." Subscribing to `trial` yields the first; subscribing to `standard`
-- yields the second. It is also consistent with ADR-044's reading of the
-- commercial catalogue as "one subscription plan and three add-ons": the sold
-- plan is one (`standard`), the trial is the free offering rather than a
-- second tier, and no add-on construct is built (D2-7).
INSERT INTO plans (id, key) VALUES
  ('0f5c9e34-0b1a-4a63-9d54-3b7a6e2f1c01', 'trial'),
  ('0f5c9e34-0b1a-4a63-9d54-3b7a6e2f1c02', 'standard');

INSERT INTO plan_versions (id, plan_id, version, trial_period_days, effective_from) VALUES
  -- ADR-052 as amended by ب-7: fourteen days.
  ('1a2b3c4d-0000-4000-8000-000000000001', '0f5c9e34-0b1a-4a63-9d54-3b7a6e2f1c01', 1, 14, '2026-01-01T00:00:00Z'),
  -- The paid plan offers no trial of its own; 0 is the ordinary value here,
  -- not a sentinel for "unknown".
  ('1a2b3c4d-0000-4000-8000-000000000002', '0f5c9e34-0b1a-4a63-9d54-3b7a6e2f1c02', 1, 0, '2026-01-01T00:00:00Z');

-- Two feature keys, both required by rulings recorded in PHASE_2_BRIEF.md
-- §9.13, and both capability flags rather than text.
--
-- `storefront.attribution_free` — ruling ب-8, recorded as a GRANT because
-- this table holds grants. The paid plan grants a storefront carrying no
-- platform attribution mark; the trial does not grant it, which is what makes
-- the mark appear on trials only. Deliberately named for the capability and
-- not for the mark's wording or the platform's name: the wording lives in the
-- interface layer (ADR-044), and the commercial name is not yet chosen, so
-- nothing in this migration may embed it.
--
-- `billing.all_payment_gateways` — ruling پ-3: every gateway is free on every
-- plan, so this is granted by both. It is seeded rather than assumed so that
-- a later plan cannot gate a gateway by quietly omitting a row.
INSERT INTO plan_features (plan_version_id, feature_key) VALUES
  ('1a2b3c4d-0000-4000-8000-000000000001', 'billing.all_payment_gateways'),
  ('1a2b3c4d-0000-4000-8000-000000000002', 'billing.all_payment_gateways'),
  ('1a2b3c4d-0000-4000-8000-000000000002', 'storefront.attribution_free');
