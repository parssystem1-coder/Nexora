-- membership.revoke (the seventh capability, not one of 08_PHASE_1_BRIEF.md
-- §3's six-slice list, but the capability exit criterion 4 depends on - see
-- DECISION_LOG.md 2026-08-24) is HIGH_WRITE (05_API_CAPABILITY_CONTRACTS.md
-- §4.1). Granted to `owner` ONLY, deliberately NOT to `admin` as
-- membership.invite's permission was - the same reasoning
-- 20260823100000_authorization__add_membership_role_assign_permission.sql
-- already gives for that capability: an admin holding this permission could
-- revoke an OWNER's membership, unilaterally removing every check on their
-- own standing in the organization, with no approval step to catch it
-- (ADR-001's approval flow is Phase 9). Restricting the grant to `owner`
-- sidesteps that escalation question the same way membership.role.assign
-- already does, rather than building per-target-role logic this phase has
-- no machinery for.
--
-- Forward-only (ADR-021 item 8): adds a row rather than editing
-- 20260822090600_authorization__create_permission_catalog.sql or any later
-- permission migration. Adds a PERMISSION only - ROLE_KEYS and the `roles`
-- table are untouched, so role-catalog-agreement.spec.ts is unaffected.

INSERT INTO permissions (key, description) VALUES
  ('membership.revoke', 'Revoke a membership in this organization');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'owner' AND p.key = 'membership.revoke';
