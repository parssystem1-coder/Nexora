-- VIOLATION FIXTURE (SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE): a second, module-local idempotency table.
CREATE TABLE billing_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_idempotency_records_tenant_isolation ON billing_idempotency_records
  USING (true);
