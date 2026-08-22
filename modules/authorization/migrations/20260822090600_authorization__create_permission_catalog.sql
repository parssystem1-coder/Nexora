-- roles/permissions/role_permissions are platform-global reference data,
-- not tenant-owned — see DECISION_LOG.md "roles/permissions/role_permissions
-- are platform-global...". Phase 1 does not support tenant-custom roles.
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles (id),
  permission_id uuid NOT NULL REFERENCES permissions (id),
  PRIMARY KEY (role_id, permission_id)
);

-- Phase 1 seed: the fixed catalog store.read needs. Any org member (any of
-- the three roles) may read a store; write permissions are added when the
-- capabilities that need them (store.update, etc.) are implemented.
INSERT INTO roles (key, name) VALUES
  ('owner', 'Owner'),
  ('admin', 'Admin'),
  ('member', 'Member');

INSERT INTO permissions (key, description) VALUES
  ('store.read', 'Read a store''s details');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin', 'member') AND p.key = 'store.read';
