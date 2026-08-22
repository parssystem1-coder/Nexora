-- tenant_id and actor_user_id are plain columns, not foreign keys — they
-- point at modules/tenant and modules/identity respectively (DECISION_LOG.md
-- "No cross-module foreign-key constraints..."). actor_user_id is nullable
-- for non-user actors (service/system/plugin/agent, per
-- 05_API_CAPABILITY_CONTRACTS.md's TenantContext.actorType).
--
-- Append-only per 04_DATABASE_BLUEPRINT.md §1 ("audit and ledger records are
-- append-only") — enforced by convention in Phase 1 (only INSERT is used by
-- application code); a REVOKE/trigger-based hard guarantee is not added yet
-- to avoid speculative schema ahead of a slice that needs it.
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_user_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'service', 'system', 'plugin', 'agent')),
  capability text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text NOT NULL,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_tenant_id_idx ON audit_events (tenant_id, occurred_at);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_events_tenant_isolation ON audit_events
  USING (tenant_id::text = current_setting('app.tenant_id', true));
