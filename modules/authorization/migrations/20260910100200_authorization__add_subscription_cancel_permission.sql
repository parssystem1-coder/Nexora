-- Phase 2 item 5's capability. `05` §4.2 scopes `subscription.cancel` as
-- tenant / HIGH_WRITE, and `PHASE_2_BRIEF.md` §5's Permissions rule names it
-- among the Phase 2 capabilities that write: "**Every Phase 2 billing
-- permission is granted to `owner` and `admin` only (D2-8).**"
--
-- Owner and admin, matching `plan.subscribe` and `subscription.read` from item
-- 4. Cancelling a subscription ends the organization's commercial relationship
-- with the platform; a plain member holding that would make the three-role
-- catalog meaningless, the same argument `store.create`'s migration records.
--
-- Adds a permission only. ROLE_KEYS and the roles table are unaffected.
-- Forward-only (ADR-021 item 8).

INSERT INTO permissions (key, description) VALUES
  ('subscription.cancel', 'Cancel this organization''s subscription');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key = 'subscription.cancel';
