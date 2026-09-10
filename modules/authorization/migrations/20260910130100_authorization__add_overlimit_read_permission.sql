-- Phase 2 item 8's capability. `05` §4.2 scopes `overlimit.read` tenant / READ.
--
-- Owner and admin, matching `entitlement.resolve` and `subscription.read`, per
-- `PHASE_2_BRIEF.md` §5's D2-8 rule and the narrower precedent §5 names
-- explicitly: `store.read` is seeded to all three roles and a Phase 2 billing
-- permission is not. Which limits an organization has crossed is its commercial
-- standing.
--
-- ADR-026 item 6 is what makes this a capability rather than a log line: "over-
-- limit is a visible state, not an error condition. It is queryable per tenant
-- so the Admin UI can display it and so support can answer questions without
-- reading logs."
--
-- Adds a permission only. Forward-only (ADR-021 item 8).

INSERT INTO permissions (key, description) VALUES
  ('overlimit.read', 'Read which quota limits this organization has crossed');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key = 'overlimit.read';
