-- user_id is a plain column, not a foreign key (identity module, see
-- DECISION_LOG.md "No cross-module foreign-key constraints...").
-- Self-access OR clause: same bootstrap reason as memberships (this table
-- is exactly what 08_PHASE_1_BRIEF.md §2 step 3's store access check reads,
-- before TenantContext / step 4 exists).
CREATE TABLE store_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations (id),
  store_id uuid NOT NULL REFERENCES stores (id),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX store_memberships_user_id_idx ON store_memberships (user_id);
CREATE INDEX store_memberships_tenant_id_idx ON store_memberships (tenant_id);

ALTER TABLE store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY store_memberships_self_or_tenant_access ON store_memberships
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR user_id::text = current_setting('app.user_id', true)
  );
