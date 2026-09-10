-- Phase 2 item 7: quota policies.
--
-- **An infrastructure item — it surfaces no capability.** `PHASE_2_BRIEF.md`
-- §3(a) names it among the seven: *"2 (price and price version), 3 (shared
-- idempotency service), **7 (quota policies)**, 10, 11, 17, 18."* So this module
-- gains migrations, table types and the spec that proves them, following the
-- pattern items 2 and 3 established. `overlimit.read` is item 8's.
--
-- **The resource vocabulary is closed, and ruling ب-4 closed it** — recorded in
-- §5 via §9.13 and quoted rather than restated: *"The V1 quota resource list
-- contains only what the platform can count: `members`, `stores`, `domains`."*
-- Read as a **restriction**: not those three plus whatever a plan promises, but
-- those three and nothing else in V1. **Storage and bandwidth are excluded and
-- are neither enforced nor advertised** until ADR-060 has an adapter and edge
-- metering exists.
--
-- `domains` is on the list because **ADR-027 item 9** puts it there, verbatim:
-- *"Domain count is a quota; custom domains are an entitlement. Both are
-- enforced through the standard capability policy chain. Add `domains` to the
-- quota resource list."*
--
-- The vocabulary is a closed set in **both** places — this CHECK and the
-- TypeScript union in `domain/quota-resource.ts` — the same discipline item 5
-- used for `reason_code`, so the two cannot drift.

-- ---------------------------------------------------------------------------
-- plan_quota_policies — the per-resource limits a plan version sets.
-- ---------------------------------------------------------------------------
-- **Platform-global, and not append-only.** The direct analogue is item 6's
-- `plan_entitlements`, which is platform-authored reference data seeded by
-- migration and read — not appended to per event. §5's exemption clause already
-- names this table among the platform-global seven, so no new exemption reason
-- is owed; both conformance schema rules carry the name.
--
-- `plan_version_id` is a **plain column, not a foreign key**: `plan_versions`
-- belongs to `modules/billing`, and `04` §1 plus §5 forbid a constraint across a
-- module boundary. `npm run check:fk` fails the build on one.
CREATE TABLE plan_quota_policies (
  id uuid PRIMARY KEY,
  plan_version_id uuid NOT NULL,

  -- Ruling ب-4's closed list. The same three names as
  -- `domain/quota-resource.ts`.
  resource text NOT NULL CHECK (resource IN ('members', 'stores', 'domains')),

  -- ADR-008's `LIMIT` carries a number; this is that number for the
  -- PLAN_VERSION rung. Non-negative: a plan granting a negative count of
  -- anything is not a policy, it is a defect. Zero is legal and means "none of
  -- this resource", which is a real plan shape.
  limit_value integer NOT NULL CHECK (limit_value >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plan_quota_policies_plan_version_resource_key UNIQUE (plan_version_id, resource)
);

-- ---------------------------------------------------------------------------
-- tenant_quota_overrides — per-tenant adjustment of that number.
-- ---------------------------------------------------------------------------
-- Tenant-owned, mutable by definition, and **no `version` column** — checked
-- independently rather than inherited from item 6. ADR-045's ruling gives Tier 2
-- no column now and names the trigger: *"for the two override tables it is a
-- capability that sets an override, of which `05` §4.2 currently has none."*
-- Verified against `05` §4.2's fifteen rows: still none. The trigger has not
-- fired, so no column is added.
--
-- **Nothing writes this table in Phase 2**, for that same reason. It is created
-- because §4 scopes it here and because the resolver must read it — a chain
-- missing a rung it is required to implement in full is worse than an unwritten
-- table.
--
-- `override_type` is ADR-008 rule 2's, and it governs quotas as well as
-- entitlements: that ADR's states are `ALLOW | DENY | **LIMIT**`, and a `LIMIT`
-- *is* a quota-shaped answer — its Explainability shape carries `limit`
-- alongside `state`. So the same `ABSOLUTE`/`DELTA` model applies here, and item
-- 6's finding carries over unchanged: **a `DELTA` is a modifier, not a base.**
CREATE TABLE tenant_quota_overrides (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  resource text NOT NULL CHECK (resource IN ('members', 'stores', 'domains')),
  override_type text NOT NULL CHECK (override_type IN ('ABSOLUTE', 'DELTA')),

  -- No non-negative CHECK, deliberately, and this is the one place it differs
  -- from `plan_quota_policies`: a `DELTA` may legitimately be negative — an
  -- operator reducing a tenant's allowance — while an `ABSOLUTE` may not. The
  -- CHECK below ties the sign to the type rather than banning it outright.
  limit_value integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_quota_overrides_tenant_resource_key UNIQUE (tenant_id, resource),
  CONSTRAINT tenant_quota_overrides_absolute_is_non_negative CHECK (
    override_type <> 'ABSOLUTE' OR limit_value >= 0
  )
);

CREATE INDEX tenant_quota_overrides_tenant_id_idx ON tenant_quota_overrides (tenant_id);

-- ---------------------------------------------------------------------------
-- Tenancy and RLS on the tenant-owned table, in the creating migration.
-- ---------------------------------------------------------------------------
-- §6 exit criterion 25 names this table as one of its two alternates: "a
-- `tenant_entitlement_overrides` (or `tenant_quota_overrides`) row is invisible
-- without tenant context and invisible from a different tenant's context; a
-- `plan_entitlements` (or `plan_quota_policies`) row is readable with no tenant
-- context." Both halves are asserted in this item's spec, each with a positive
-- control.
ALTER TABLE tenant_quota_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_quota_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_quota_overrides_tenant_isolation ON tenant_quota_overrides
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- ---------------------------------------------------------------------------
-- Seed: the standard plan version's limits.
-- ---------------------------------------------------------------------------
-- **These three numbers are pre-launch commercial placeholders, not a
-- commitment**, and they are recorded that way for the same reason item 2
-- recorded its prices: ruling ح-2 gives Phase 2.5 an operator capability that
-- *publishes* a new plan version, so a limit changes without a schema change,
-- and nothing here should be read as a decided product.
--
-- **They are owed to the commercial specification**, which is outside this
-- repository and states no quota numbers — the same class of obligation ADR-052
-- carries for the trial length. **Seeding something is nonetheless right, and
-- the alternative is worse:** with no row, ADR-008's chain yields the plan's
-- plain `ALLOW` with no limit, which silently promises an unlimited resource —
-- exactly the unenforced promise ب-4 exists to prevent, reached from the other
-- direction.
--
-- Item 6 deliberately left these numbers here. Its migration says so: "their
-- numeric limits belong to item 7's `plan_quota_policies`, not here … this table
-- answers *may they*, not *how many*."
INSERT INTO plan_quota_policies (id, plan_version_id, resource, limit_value) VALUES
  ('5e6f7081-0000-4000-8000-000000000001', '1a2b3c4d-0000-4000-8000-000000000002', 'members', 5),
  ('5e6f7081-0000-4000-8000-000000000002', '1a2b3c4d-0000-4000-8000-000000000002', 'stores', 3),
  ('5e6f7081-0000-4000-8000-000000000003', '1a2b3c4d-0000-4000-8000-000000000002', 'domains', 5);
