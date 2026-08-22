-- Repair (see PHASE_1_REPAIR_REPORT.md item 5, DECISION_LOG.md): the single
-- policy created in 20260822090200_tenant__create_organizations.sql used
-- `WITH CHECK (true)`, correct for INSERT (a brand-new organization has no
-- pre-existing tenant_id to check against — see that migration's comment)
-- but WITH CHECK also governs UPDATE. Any row that passed USING (i.e. any
-- row in the caller's own tenant) could therefore be updated with no
-- second check at all. The exposure was narrow only because tenant_id is
-- GENERATED and cannot itself be changed by an UPDATE — but this is the
-- pattern organization.create (Task 2's first slice) mirrors, so a future
-- table that copies it without the generated-column safety net would have
-- a real gap.
--
-- Forward-only (ADR-021 item 8): this cannot edit the original migration,
-- so it drops and recreates the policy under a new one, split by command.
DROP POLICY organizations_tenant_isolation ON organizations;

CREATE POLICY organizations_insert ON organizations
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY organizations_select ON organizations
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY organizations_update ON organizations
  FOR UPDATE
  USING (tenant_id::text = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

CREATE POLICY organizations_delete ON organizations
  FOR DELETE
  USING (tenant_id::text = current_setting('app.tenant_id', true));
