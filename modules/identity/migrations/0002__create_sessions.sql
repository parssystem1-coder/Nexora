-- sessions is exempt from tenant_id/RLS for the same reason users is: it is
-- owned by the identity module's User aggregate, not by a tenant, and RLS
-- here would be circular — validating a session is the step that
-- establishes which tenant is trusted in the first place
-- (DECISION_LOG.md "RLS exemption list is incomplete...").
--
-- active_organization_id is ADR-029 item 5's "active organization is
-- session state" — a plain column, not a foreign key, because it points at
-- modules/tenant's organizations table (DECISION_LOG.md "No cross-module
-- foreign-key constraints...").
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL,
  active_organization_id uuid,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX sessions_token_hash_key ON sessions (token_hash);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
