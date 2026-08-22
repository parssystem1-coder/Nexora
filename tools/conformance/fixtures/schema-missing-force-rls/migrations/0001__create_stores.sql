-- VIOLATION FIXTURE (SCHEMA-MISSING-FORCE-RLS): has ENABLE + a policy, but no
-- FORCE — the table's owning role would bypass RLS entirely.
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY stores_tenant_isolation ON stores
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
