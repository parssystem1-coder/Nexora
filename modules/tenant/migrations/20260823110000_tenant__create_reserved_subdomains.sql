-- reserved_subdomains (08_PHASE_1_BRIEF.md §4's scope list; §5: "store slug
-- creation rejects anything in reserved_subdomains") is data, not code -
-- 04_DATABASE_BLUEPRINT.md §2.1 sketches it as a single `name` column near
-- the Phase 4 domains cluster. It lives in modules/tenant's migrations, not
-- a new `domains` module, because the only Phase 1 consumer is store slug
-- validation inside modules/tenant, and AGENTS.md §4 forbids creating a
-- module for anything in future/ - the same reasoning that already put
-- `currencies` (platform-wide reference data) under modules/money rather
-- than a module of its own, because money was its only Phase 1 consumer.
--
-- Exempt from tenant_id/RLS, explicitly per 08_PHASE_1_BRIEF.md §5's
-- exemption list ("users, sessions, currencies, reserved_subdomains, roles,
-- permissions, role_permissions") - not omitted by oversight. A reserved
-- word is reserved platform-wide, not per tenant, so a tenant_id column
-- would be meaningless here.
CREATE TABLE reserved_subdomains (
  name text PRIMARY KEY
);

-- Seed: a small, defensible starter set of names any platform that offers
-- subdomains conventionally withholds, so they cannot collide with a
-- service the platform itself may need to host there later (a status page,
-- API docs, a CDN endpoint, an admin console) - not a random or
-- speculative list. Stored already lowercase: store slugs are normalized to
-- lowercase before this table is ever consulted (see
-- create-store.input.ts's `.toLowerCase()`, matching organization.create's
-- precedent), and this seed is written in that same normalized form so the
-- two cannot drift apart.
--
-- Expected to grow before Phase 4's host resolution (ADR-028) ships - this
-- is a Phase 1 starting point, not the final list.
INSERT INTO reserved_subdomains (name) VALUES
  ('www'), ('api'), ('admin'), ('app'), ('mail'), ('static'), ('cdn'),
  ('assets'), ('status'), ('docs'), ('blog'), ('help'), ('support');
