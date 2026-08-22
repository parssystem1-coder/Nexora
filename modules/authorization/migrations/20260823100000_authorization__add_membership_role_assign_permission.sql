-- membership.role.assign (08_PHASE_1_BRIEF.md §3 slice 3) is HIGH_WRITE
-- (05_API_CAPABILITY_CONTRACTS.md §4.1) and grants access to the platform's
-- highest role, `owner`, among others. Granted to `owner` ONLY, deliberately
-- NOT to `admin` as membership.invite's permission was: an admin holding
-- this permission could grant themselves (or anyone) the `owner` role,
-- promoting past their own ceiling with no approval step to catch it
-- (ADR-001's approval flow is Phase 9, and CapabilityDefinition has no
-- `approval` field to gate on even if it existed yet). Restricting the grant
-- to `owner` sidesteps the escalation question entirely rather than trying
-- to solve it with per-role-target logic this phase has no machinery for.
-- See DECISION_LOG.md "membership.role.assign: who may call it, and why
-- HIGH_WRITE buys nothing extra yet" for the full reasoning.
--
-- Forward-only (ADR-021 item 8): adds a row rather than editing
-- 20260822090600_authorization__create_permission_catalog.sql or
-- 20260823090000_authorization__add_membership_invite_permission.sql.

INSERT INTO permissions (key, description) VALUES
  ('membership.role.assign', 'Grant a platform-defined role to a membership in this organization');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'owner' AND p.key = 'membership.role.assign';
