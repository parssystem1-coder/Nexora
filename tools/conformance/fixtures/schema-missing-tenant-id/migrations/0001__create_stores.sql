-- VIOLATION FIXTURE (SCHEMA-MISSING-TENANT-ID): stores is tenant-owned and must carry tenant_id.
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY stores_tenant_isolation ON stores
  USING (true);
