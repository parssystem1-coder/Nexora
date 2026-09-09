-- Phase 2 item 6's capability. `05` §4.2 scopes `entitlement.resolve` as
-- tenant / READ.
--
-- Owner and admin, per `PHASE_2_BRIEF.md` §5's D2-8 rule that "every Phase 2
-- billing permission is granted to `owner` and `admin` only" — and §5 names the
-- narrower precedent explicitly: `store.read` is seeded to all three roles and a
-- Phase 2 billing permission is not. What a tenant is entitled to is the
-- commercial shape of their account, the same class as the subscription beside
-- it.
--
-- Adds a permission only. Forward-only (ADR-021 item 8).

INSERT INTO permissions (key, description) VALUES
  ('entitlement.resolve', 'Resolve this organization''s effective entitlements');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key = 'entitlement.resolve';
