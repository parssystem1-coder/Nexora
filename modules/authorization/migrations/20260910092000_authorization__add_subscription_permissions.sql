-- Phase 2 item 4's two capabilities.
--
-- `PHASE_2_BRIEF.md` §5's Permissions rule: "**Every Phase 2 billing permission
-- is granted to `owner` and `admin` only (D2-8).**" It then enumerates the
-- capabilities that *write* — `plan.subscribe` among them — as the ones needing
-- a `role_permissions` seed row.
--
-- **`subscription.read` is granted to owner and admin as well, and that is the
-- narrower of the two available precedents, chosen deliberately.** `store.read`
-- is seeded to all three roles, and §5 says so explicitly — "Note this is
-- narrower than the existing precedent: `store.read` is seeded to all three
-- roles. A Phase 2 billing permission is not." A subscription record carries the
-- organization's commercial standing: what it pays, when its term ends, whether
-- it is past due. That is the same class of information as the writes beside it,
-- not the same class as a store's name.
--
-- Both remain correct under the six-role catalog `00_PLATFORM_OVERVIEW.md` §4.1
-- describes, where Manager, Editor, Support and Viewer would hold no billing
-- authority either — which is what makes §7's deferral of the catalog question
-- safe rather than lucky.
--
-- Adds permissions only. ROLE_KEYS (modules/authorization/domain/role-key.vo.ts)
-- and the roles table are unaffected, so role-catalog-agreement.spec.ts has
-- nothing new to disagree about. Forward-only (ADR-021 item 8).

INSERT INTO permissions (key, description) VALUES
  ('plan.subscribe', 'Subscribe this organization to a plan'),
  ('subscription.read', 'Read this organization''s subscription');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key IN ('owner', 'admin') AND p.key IN ('plan.subscribe', 'subscription.read');
