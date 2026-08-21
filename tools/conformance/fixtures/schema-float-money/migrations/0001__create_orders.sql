-- VIOLATION FIXTURE (SCHEMA-FLOAT-MONEY-COLUMN): amount_total must be BIGINT/NUMERIC, never FLOAT.
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  amount_total FLOAT NOT NULL,
  currency_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  USING (true);
