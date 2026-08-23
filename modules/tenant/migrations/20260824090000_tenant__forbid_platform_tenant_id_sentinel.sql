-- ADR-035 introduced PLATFORM_TENANT_ID (00000000-0000-0000-0000-000000000000)
-- as the audit_events.tenant_id value a global/user-scope capability (auth.login,
-- auth.logout, auth.logout_all, organization.switch) writes when there is no
-- real tenant. ADR-035's decision 1 argued this is safe because
-- gen_random_uuid() cannot produce that value "with probability effectively
-- zero" and no foreign key exists for a colliding row to violate. That is an
-- argument about likelihood, not a guarantee: nothing before this migration
-- actually forbade an organizations row from holding this id, whether by a
-- future manual insert, a seed script, or a client-supplied id on some future
-- capability that accepts one. If it ever did, that organization would read
-- every platform-scope audit row ever written - a structural exposure, not a
-- theoretical one, sitting behind an argument about probability.
--
-- Closes it mechanically, the same move the role-catalog agreement test
-- makes for a different invariant: a rule stated only in a comment or an ADR
-- is not enforced. A CHECK constraint (not a live-DB conformance rule) is
-- chosen because this can be prevented outright, at write time, for every
-- future writer (a migration, a seed script, a capability not yet built) -
-- rather than merely detected after the fact the next time someone happens
-- to run `npm run conformance`. See DECISION_LOG.md 2026-08-24 and
-- 02_ADR_INDEX_NORMATIVE_DECISIONS.md's ADR-035, decision 5.
ALTER TABLE organizations
  ADD CONSTRAINT organizations_id_not_platform_tenant_sentinel
  CHECK (id <> '00000000-0000-0000-0000-000000000000'::uuid);
