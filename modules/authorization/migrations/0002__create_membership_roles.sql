-- tenant_id and membership_id are plain columns, not foreign keys, because
-- they point at modules/tenant's tables (DECISION_LOG.md "No cross-module
-- foreign-key constraints..."). role_id references this module's own
-- roles table, so it does get a real FK.
--
-- No self-access OR clause needed here (unlike memberships/store_memberships):
-- by the time this table is queried (08_PHASE_1_BRIEF.md §2 step 6,
-- permission authorization), TenantContext already exists.
CREATE TABLE membership_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES roles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, role_id)
);

CREATE INDEX membership_roles_membership_id_idx ON membership_roles (membership_id);
CREATE INDEX membership_roles_tenant_id_idx ON membership_roles (tenant_id);

ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_roles_tenant_isolation ON membership_roles
  USING (tenant_id::text = current_setting('app.tenant_id', true));
