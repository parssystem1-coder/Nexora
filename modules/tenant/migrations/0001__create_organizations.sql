-- An organization IS the tenant: tenant_id mirrors id rather than being a
-- redundant hand-maintained column (DECISION_LOG.md "No cross-module
-- foreign-key constraints; organizations.tenant_id is a generated mirror").
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid GENERATED ALWAYS AS (id) STORED,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organizations_slug_key ON organizations (slug);
CREATE INDEX organizations_tenant_id_idx ON organizations (tenant_id);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

-- Compares as text: current_setting(..., true) returns '' (not NULL) for a
-- context withTenantContext() left unset, and ''::uuid raises an error
-- rather than failing closed. Text comparison fails closed safely instead.
--
-- WITH CHECK (true) deliberately: creating a brand-new organization (any
-- authenticated user may, 05_API_CAPABILITY_CONTRACTS.md §4.1
-- organization.create is user-scoped, not tenant-scoped) has no pre-existing
-- tenant_id to check the new row against — tenant_id is GENERATED from the
-- new row's own id, so this cannot leak into another tenant regardless.
-- Reads/updates/deletes still go through the USING clause.
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (true);
