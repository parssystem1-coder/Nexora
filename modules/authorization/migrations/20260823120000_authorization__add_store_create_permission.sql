-- store.create (08_PHASE_1_BRIEF.md §3 slice 4) is MEDIUM_WRITE
-- (05_API_CAPABILITY_CONTRACTS.md §4.1), the same risk tier as
-- membership.invite, not the HIGH_WRITE tier membership.role.assign sits at.
-- Granted to owner and admin, following membership.invite's precedent
-- exactly: creating a store is an administrative act inside an existing
-- organization, not a top-tier action needing membership.role.assign's
-- owner-only restriction (that restriction exists specifically to close a
-- self-escalation path - granting a role - that creating a store has no
-- equivalent of). A plain member does not hold it, for the same reason a
-- plain member does not hold membership.invite: the three-role catalog
-- would be meaningless for either capability otherwise.
--
-- This adds a PERMISSION only. ROLE_KEYS
-- (modules/authorization/domain/role-key.vo.ts) and the roles table are
-- unaffected, so modules/authorization/infrastructure/
-- role-catalog-agreement.spec.ts has nothing new to disagree about.
--
-- Forward-only (ADR-021 item 8): adds rows rather than editing any of the
-- three earlier permission-catalog migrations.

INSERT INTO permissions (key, description) VALUES
  ('store.create', 'Create a store within this organization');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key = 'store.create';
