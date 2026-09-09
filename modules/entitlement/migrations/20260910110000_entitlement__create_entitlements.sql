-- Phase 2 item 6: entitlement resolution (ADR-008).
--
-- Three tables, per `PHASE_2_BRIEF.md` §4 and D2-14's split — and per §4's
-- 2026-09-10 note, that list is the scope fence while **ADR-008 is the
-- specification**.
--
-- **The deliverable is the precedence chain, not the tables.** ADR-008 is titled
-- *Entitlement Precedence and Conflict Resolution*; the storage is how the
-- inputs are held. The chain itself lives in
-- `modules/entitlement/domain/resolve-entitlement.ts`.

-- ---------------------------------------------------------------------------
-- plan_entitlements — what a plan version grants. Platform-global.
-- ---------------------------------------------------------------------------
-- Exempt from `tenant_id`/RLS by §5's existing clause, which already names it:
-- "`plans`, `plan_versions`, `plan_features`, `prices`, `price_versions`,
-- **`plan_entitlements`**, `plan_quota_policies` — platform-authored reference
-- data, identical for every tenant." No new exemption reason is owed; both
-- conformance schema rules carry the name.
--
-- `plan_version_id` is a **plain column, not a foreign key**: `plan_versions`
-- belongs to `modules/billing` and this table to `modules/entitlement`, so a
-- constraint would cross a module boundary (`04` §1, `PHASE_2_BRIEF.md` §5).
-- `npm run check:fk` fails the build on one. The integrity it would have given
-- is already held more strongly — `plan_versions` is append-only for
-- `nexora_app` since 2026-09-05, so a granted entitlement's plan version cannot
-- be rewritten underneath it.
CREATE TABLE plan_entitlements (
  id uuid PRIMARY KEY,
  plan_version_id uuid NOT NULL,

  -- ADR-044's rule reaches here too: a machine key, never display text.
  feature_key text NOT NULL,

  -- ADR-008: "Every entitlement decision must resolve to an explicit policy
  -- state: ALLOW | DENY | LIMIT."
  state text NOT NULL CHECK (state IN ('ALLOW', 'DENY', 'LIMIT')),

  -- ADR-008's `limit`. Meaningful only for `LIMIT`, and the CHECK below ties
  -- the two together so a `LIMIT` with no number — which the resolver could not
  -- act on — cannot be stored.
  limit_value integer,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plan_entitlements_plan_version_feature_key UNIQUE (plan_version_id, feature_key),
  CONSTRAINT plan_entitlements_feature_key_is_machine_key CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  CONSTRAINT plan_entitlements_limit_matches_state CHECK (
    (state = 'LIMIT') = (limit_value IS NOT NULL)
  ),
  CONSTRAINT plan_entitlements_limit_non_negative CHECK (limit_value IS NULL OR limit_value >= 0)
);

-- ---------------------------------------------------------------------------
-- tenant_entitlement_overrides — ADR-008's ABSOLUTE/DELTA overrides.
-- ---------------------------------------------------------------------------
-- Tenant-owned, and mutable by definition: an override is changed, not
-- superseded. **No `version` column** — ADR-045's ruling puts this table in
-- Tier 2 and gives Tier 2 no column now, with a named reopening trigger: "for
-- the two override tables it is a capability that sets an override, of which
-- `05` §4.2 currently has none." That is still true, so the trigger has not
-- fired and no column is added.
--
-- **Nothing writes this table in Phase 2**, for the same reason: no capability
-- sets an override. It is created because §4 scopes it here and because the
-- resolver must read it — the chain would otherwise be missing a rung it is
-- required to implement in full.
CREATE TABLE tenant_entitlement_overrides (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  feature_key text NOT NULL,

  -- ADR-008 rule 2: "Overrides must declare whether they are `ABSOLUTE`
  -- (replaces the resolved value) or `DELTA` (adjusts the resolved value)."
  override_type text NOT NULL CHECK (override_type IN ('ABSOLUTE', 'DELTA')),

  state text NOT NULL CHECK (state IN ('ALLOW', 'DENY', 'LIMIT')),

  -- For an ABSOLUTE override this replaces the limit; for a DELTA it adjusts
  -- it, and may be negative — which is why this column has no non-negative
  -- CHECK while `plan_entitlements.limit_value` does.
  limit_value integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_entitlement_overrides_tenant_feature_key UNIQUE (tenant_id, feature_key),
  CONSTRAINT tenant_entitlement_overrides_feature_key_is_machine_key CHECK (feature_key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  CONSTRAINT tenant_entitlement_overrides_limit_matches_state CHECK (
    (state = 'LIMIT') = (limit_value IS NOT NULL)
  )
);

CREATE INDEX tenant_entitlement_overrides_tenant_id_idx ON tenant_entitlement_overrides (tenant_id);

-- ---------------------------------------------------------------------------
-- entitlement_sources — ADR-008's explainability record. **A log.**
-- ---------------------------------------------------------------------------
-- **ADR-045 left this open and named item 6 as its owner**, which is this item:
-- "`entitlement_sources` is record-shaped, and arguably it should never be
-- updated at all. Side finding, recorded because this derivation surfaced it
-- and nothing else owns it: `entitlement_sources` is record-shaped and is *not*
-- on `PHASE_2_BRIEF.md` §5's `REVOKE UPDATE, DELETE` list. Whether that omission
-- is deliberate is stated nowhere. **It is not this ADR's to decide.**"
--
-- **It is a log, and ADR-008's own Explainability clause is what decides it:**
-- "The entitlement engine must expose the final resolved entitlement and, where
-- required, the resolution source **for audit and debugging**: `feature, state,
-- limit, resolvedFrom[], **evaluatedAt**`." An `evaluatedAt` is the timestamp of
-- one resolution *event*; a snapshot keyed by tenant and feature would have no
-- use for a per-row evaluation time, because it would only ever hold the latest.
-- "For audit and debugging" points the same way, and `04` §1 already rules that
-- "audit and ledger records are append-only".
--
-- **Two consequences follow, and both are recorded rather than left implicit:**
--
--   1. It owes `REVOKE UPDATE, DELETE`, which the migration beside this one
--      applies, and **§5's append-only list owes the amendment** — made on this
--      date, in the same shape item 2 made for `plan_versions`,
--      `plan_features` and `price_versions`.
--   2. **Its row count grows with platform activity, so by ADR-041's own test it
--      is a partitioning candidate — and that ruling's candidate list does not
--      contain it.** Recorded as a dated cross-reference in ADR-041 rather than
--      left as a fifth fast-growing table nobody classified. Its three
--      obligations are satisfied here: `evaluated_at` is the immutable event
--      column; nothing declares a foreign key referencing this table; and there
--      is no uniqueness beyond the primary key, so no permanent exclusion from
--      partitioning is created.
--
-- `resolved_from` is ADR-008's `resolvedFrom[]`: which rungs of the precedence
-- chain contributed, in order. `jsonb` rather than a child table because it is
-- read as one opaque explanation and never joined or filtered — a child table
-- would also have to be a second candidate.
CREATE TABLE entitlement_sources (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  feature_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('ALLOW', 'DENY', 'LIMIT')),
  limit_value integer,
  resolved_from jsonb NOT NULL,

  -- ADR-041 obligation 1's event column, and ADR-008's `evaluatedAt`.
  evaluated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT entitlement_sources_limit_matches_state CHECK (
    (state = 'LIMIT') = (limit_value IS NOT NULL)
  )
);

CREATE INDEX entitlement_sources_tenant_id_evaluated_at_idx
  ON entitlement_sources (tenant_id, evaluated_at DESC);

-- ---------------------------------------------------------------------------
-- Tenancy and RLS on the two tenant-owned tables, in the creating migration.
-- ---------------------------------------------------------------------------
-- §6 exit criterion 25 is the test this exists to pass: "a
-- `tenant_entitlement_overrides` row is invisible without tenant context and
-- invisible from a different tenant's context; a `plan_entitlements` row is
-- readable with no tenant context."
ALTER TABLE tenant_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_entitlement_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_entitlement_overrides_tenant_isolation ON tenant_entitlement_overrides
  USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE entitlement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY entitlement_sources_tenant_isolation ON entitlement_sources
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ---------------------------------------------------------------------------
-- Seed: what the `standard` plan version grants.
-- ---------------------------------------------------------------------------
-- The three V1 quota resources are ruling ب-4's closed list — `members`,
-- `stores`, `domains` — recorded in `PHASE_2_BRIEF.md` §9.13. **Their numeric
-- limits belong to item 7's `plan_quota_policies`, not here**: §5 keeps
-- entitlement and quota as two axes, and this table answers *may they*, not
-- *how many*.
--
-- Seeded as `ALLOW` rather than `LIMIT` for that reason: a `LIMIT` here would
-- be item 7's number in item 6's table. The two feature keys item 1 seeded into
-- `plan_features` are deliberately not repeated — `plan_features` is what a plan
-- version *advertises*, `plan_entitlements` is what the resolver *enforces*, and
-- collapsing them would make ADR-008's chain read a marketing surface.
INSERT INTO plan_entitlements (id, plan_version_id, feature_key, state) VALUES
  ('4d5e6f70-0000-4000-8000-000000000001', '1a2b3c4d-0000-4000-8000-000000000002', 'members', 'ALLOW'),
  ('4d5e6f70-0000-4000-8000-000000000002', '1a2b3c4d-0000-4000-8000-000000000002', 'stores', 'ALLOW'),
  ('4d5e6f70-0000-4000-8000-000000000003', '1a2b3c4d-0000-4000-8000-000000000002', 'domains', 'ALLOW');
