-- user_id is a plain column, not a foreign key, because it points at
-- modules/identity's users table (DECISION_LOG.md "No cross-module
-- foreign-key constraints...").
--
-- The self-access OR clause is what lets 08_PHASE_1_BRIEF.md §2 steps 2-3
-- (resolve organization membership, before step 4 builds TenantContext)
-- query this table before app.tenant_id is known: a user can always see
-- their own membership rows. See DECISION_LOG.md "RLS bootstrap...".
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations (id),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX memberships_user_id_idx ON memberships (user_id);
CREATE INDEX memberships_tenant_id_idx ON memberships (tenant_id);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY memberships_self_or_tenant_access ON memberships
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR user_id::text = current_setting('app.user_id', true)
  );
