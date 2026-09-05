-- Phase 2 item 3: the shared idempotency store (ADR-009).
--
-- **The second infrastructure item, and the first tenant-owned table Phase 2
-- creates.** It surfaces no capability — `PHASE_2_BRIEF.md` §3(a) names item 3
-- among the seven that do not — so this module ships migrations, table types
-- and the spec that proves them, and nothing in `domain/`, `application/` or
-- `interfaces/` until a consumer exists. That consumer is ADR-038's
-- `withIdempotentCapability`, which arrives with the first idempotent
-- capability (item 4).
--
-- Items 1 and 2 were platform-global and rode the conformance TENANT_EXEMPT
-- list. **This one takes the full §5 treatment**: `tenant_id`, `ENABLE` and
-- `FORCE ROW LEVEL SECURITY`, and a policy, all in this creating migration.

CREATE TABLE idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- **A plain column, deliberately not a foreign key to `organizations`.**
  -- `PHASE_2_BRIEF.md` §5 and `04` §1 forbid cross-module foreign keys, and
  -- `organizations` belongs to `modules/tenant`. This follows the shape
  -- `audit_events.tenant_id` and `membership_roles.membership_id` already use.
  -- As of this migration the rule is also **enforced**: `npm run check:fk`
  -- fails the build on any foreign key that crosses a module boundary, which
  -- until now was convention with nothing behind it.
  tenant_id uuid NOT NULL,

  -- ADR-009's identity triple.
  capability text NOT NULL,
  idempotency_key text NOT NULL,

  -- ADR-009 names every column below: "The record stores `request_hash`,
  -- `status`, `response_snapshot`, `created_at`, `expires_at`, and the
  -- originating `actor_type`." All six exist here rather than being added when
  -- a consumer first wants one, because the ADR states them as the record's
  -- shape rather than as a suggestion.
  request_hash text NOT NULL,

  -- ADR-009's lifecycle, exactly: CLAIMED -> IN_PROGRESS -> COMPLETED | FAILED.
  status text NOT NULL CHECK (status IN ('CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),

  -- Null until the operation completes; ADR-038 item 4 replays "the outcome the
  -- stored snapshot records". **This column is the reason retention is a privacy
  -- decision and not only a size one** — see ADR-009's 2026-09-05 amendment.
  response_snapshot jsonb,

  -- The same vocabulary `audit_events.actor_type` uses (`05` §2's TenantContext).
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'service', 'system', 'plugin', 'agent')),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- **ADR-009 requires this column; it is not a convenience.** "Retention is
  -- bounded and configurable" is a per-record property, so the window is
  -- resolved from configuration when the claim is made and stored here, rather
  -- than a constant living in a purge job's WHERE clause. A job that computed
  -- the boundary itself would make every already-written row's lifetime change
  -- retroactively whenever the configuration changed. ADR-009's 2026-09-05
  -- amendment sets the default at 30 days.
  expires_at timestamptz NOT NULL,

  CONSTRAINT idempotency_records_tenant_capability_key_key UNIQUE (tenant_id, capability, idempotency_key),
  CONSTRAINT idempotency_records_expires_after_creation CHECK (expires_at > created_at)
);

-- **No `version` column, and this is a ruling rather than an omission.**
-- ADR-045 lists `idempotency_records` in its Tier 1 table and then rules **no**
-- for it specifically: "ADR-009's UNIQUE (tenant_id, capability,
-- idempotency_key) plus the claim-inside-the-transaction rule already serialises
-- every writer of a given row: a second claimant does not read-modify-write, it
-- collides on the constraint and is rejected by the database before any
-- application-computed value exists to be lost." Its named reopening trigger is
-- "the first slice that adds a writer which mutates an already-claimed record
-- outside the claiming transaction", and it names ADR-009's own reconciliation
-- path for operations spanning an external call as the likeliest candidate —
-- which is **item 12**, not this one.
--
-- No `deleted_at` either: ADR-046 rules no soft-delete column in Phase 2.

-- The purge path. ADR-009's expiry is swept by time across the whole table, so
-- the index leads with `expires_at` rather than with `tenant_id`. ADR-036 item
-- 7's leading-tenant rule governs a *paginated* tenant query and does not apply
-- to a sweep; the UNIQUE constraint above already provides the tenant-leading
-- index every lookup by key uses.
CREATE INDEX idempotency_records_expires_at_idx ON idempotency_records (expires_at);

-- `PHASE_2_BRIEF.md` §5, in the creating migration as required. Compared as
-- text, not uuid: `current_setting(..., true)` returns '' for an unset context
-- and `''::uuid` raises instead of failing closed.
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY;

-- A single policy covering every command, deliberately. `organizations` needed
-- the split into per-command policies (20260822100000) because its INSERT has
-- no pre-existing `tenant_id` to check against — a row creating its own tenant.
-- Nothing here creates a tenant: a claim is always written inside an
-- already-established tenant context, so one predicate is correct for USING and
-- WITH CHECK alike, and PostgreSQL applies it to both.
--
-- **No self-access OR clause.** `memberships` and `store_memberships` carry one
-- because they are read *before* a TenantContext exists (the bootstrap case
-- risk R-003 records). A claim is never read before its tenant is known — the
-- guard chain has already run — so widening this policy would grant reach
-- nothing needs, in the one table that holds a copy of every write's response.
CREATE POLICY idempotency_records_tenant_isolation ON idempotency_records
  USING (tenant_id::text = current_setting('app.tenant_id', true));
