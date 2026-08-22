-- membership.invite (08_PHASE_1_BRIEF.md §3 slice 2) is the first capability
-- needing a permission the Phase 1 seed catalog did not already carry.
--
-- Granted to owner and admin, deliberately NOT to member: adding people to
-- an organization is an administrative act, and 05_API_CAPABILITY_CONTRACTS.md
-- §4.1 rates the capability MEDIUM_WRITE. A plain member holding it would
-- make the three-role catalog meaningless for this capability.
--
-- Forward-only (ADR-021 item 8): this adds rows rather than editing
-- 20260822090600_authorization__create_permission_catalog.sql.

INSERT INTO permissions (key, description) VALUES
  ('membership.invite', 'Add an existing platform user to an organization as a member');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key = 'membership.invite';
