-- Phase 2 item 8: over-limit state (ADR-026).
--
-- `PHASE_2_BRIEF.md` §4's row gives the scope — *"resource, current count,
-- limit, entered_at"* — and per §4's 2026-09-10 note that is a scope entry
-- rather than a column list. **ADR-026 is the specification.**
--
-- ---------------------------------------------------------------------------
-- **Mutable, not append-only, and ADR-026's own verification list decides it.**
-- ---------------------------------------------------------------------------
-- Its last verification item reads: *"upgrading immediately **clears** the
-- over-limit state without data migration."* **A log cannot be cleared** — you
-- can only append a row saying the crossing ended, which is a different table
-- with a different name. Item 6 resolved the same ambiguity for
-- `entitlement_sources` from a single word (`evaluatedAt`, the timestamp of one
-- event); here the word is *clears*, and it points the other way.
--
-- ADR-026 item 6 says the same thing in the positive: *"Over-limit is a
-- **visible state**, not an error condition. It is **queryable per tenant** so
-- the Admin UI can display it."* A state is entered, held and left; one row per
-- tenant per resource, rewritten.
--
-- So it is **not** on §5's append-only list and **not** an ADR-041 partitioning
-- candidate: its row count is bounded by tenants × the three resources of ruling
-- ب-4's closed list, not by platform activity.
CREATE TABLE tenant_over_limit_states (
  id uuid PRIMARY KEY,

  -- §5's tenancy rule. A plain column, not a foreign key to `organizations`:
  -- that is `modules/tenant`'s table and `04` §1 forbids the crossing.
  tenant_id uuid NOT NULL,

  -- Ruling ب-4's closed V1 list, the same three names as item 7's
  -- `plan_quota_policies` and `domain/quota-resource.ts`. Closed in every place
  -- it appears, so the three cannot drift.
  resource text NOT NULL CHECK (resource IN ('members', 'stores', 'domains')),

  -- ADR-026 item 4: the tenant must be told "which resource, the current count,
  -- the new limit". Both are snapshotted at the moment of crossing rather than
  -- only recomputed, because item 4's message is about the moment the state was
  -- entered — and because a later recount cannot say what the limit was then.
  current_count integer NOT NULL CHECK (current_count >= 0),
  limit_value integer NOT NULL CHECK (limit_value >= 0),

  -- **The column that cannot be computed on demand**, which is the reason this
  -- table exists at all rather than the state being derived on every read. A
  -- current count can be recounted and a limit re-resolved; the moment a tenant
  -- crossed the line is gone unless something present at that moment wrote it
  -- down.
  entered_at timestamptz NOT NULL DEFAULT now(),

  -- **ADR-045 names this table in Tier 1 with an explicit `yes`**, unlike items
  -- 6 and 7's tables, which are Tier 2 and got none: *"`tenant_over_limit_states`
  -- | **yes** | the usage recorder and the over-limit evaluator both write it."*
  -- Its Tier 1 entry states the race directly — *"two concurrent `usage.record`
  -- calls, which is the ordinary case rather than the edge case"*. **Neither
  -- writer exists yet** (the usage recorder is item 9), and the column is added
  -- here because ADR-045 requires it "in each table's **creating** migration".
  version integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One state per tenant per resource. Not a history: see the append-only note
  -- above, and ADR-026's "clears".
  CONSTRAINT tenant_over_limit_states_tenant_resource_key UNIQUE (tenant_id, resource),

  -- A row here means the tenant is over the line. A row where the count does
  -- not exceed the limit is not an over-limit state, it is a stale row that
  -- should have been cleared, and the database refuses to hold one.
  CONSTRAINT tenant_over_limit_states_is_actually_over CHECK (current_count > limit_value)
);

CREATE INDEX tenant_over_limit_states_tenant_id_idx ON tenant_over_limit_states (tenant_id);

-- No `deleted_at`: ADR-046 rules no soft-delete column in Phase 2, and this row
-- is *cleared* by deletion when the tenant upgrades or reduces usage — which is
-- ADR-026's own word and is not a tenant-data deletion of any kind. ADR-020's
-- and ADR-025 item 8's prohibitions are about the tenant's *data*; this row is
-- the platform's bookkeeping about a limit.

-- ---------------------------------------------------------------------------
-- Tenancy and RLS, in the creating migration as §5 requires.
-- ---------------------------------------------------------------------------
ALTER TABLE tenant_over_limit_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_over_limit_states FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_over_limit_states_tenant_isolation ON tenant_over_limit_states
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- **No seed, and nothing in Phase 2 writes this table.** ADR-045 names its two
-- writers — the usage recorder and the over-limit evaluator — and neither
-- exists: the usage recorder is item 9, and no capability evaluates limits. The
-- entry cause ADR-026 is written around is a **downgrade**, which is item 15's
-- `plan.change`.
--
-- **`overlimit.read` is therefore built not to depend on this table being
-- populated.** It evaluates live — counting through each owning module's
-- contract and resolving the limit through ADR-008's chain — and reads a row
-- here only for `entered_at`, the one fact it cannot recompute. A read path that
-- returned "not over limit" for every tenant because the table is empty would be
-- the silent-success failure `AGENTS.md` §8's second rule exists to catch.
