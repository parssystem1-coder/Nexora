-- VIOLATION FIXTURE (SCHEMA-MISSING-RLS): tenant-owned table with no RLS enable/policy.
CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
