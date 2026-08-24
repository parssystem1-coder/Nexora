import type { ColumnType, Generated } from "kysely";

export interface OrganizationsTable {
  id: Generated<string>;
  /** GENERATED ALWAYS AS (id) STORED — Postgres rejects providing it on INSERT. */
  tenant_id: ColumnType<string, never, never>;
  name: string;
  slug: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface MembershipsTable {
  id: Generated<string>;
  tenant_id: string;
  user_id: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  /**
   * Updatable, unlike `created_at` and unlike `OrganizationsTable`/
   * `StoresTable`'s own `updated_at` (left as `never` — nothing in this
   * codebase updates those yet, and widening them isn't this slice's job).
   * `membership.revoke` (DECISION_LOG.md 2026-08-24) is the first thing that
   * ever needs to bump this column: the same silent-un-updatable pattern
   * `sessions.revoked_at` had before `auth.login`/`auth.logout` needed it —
   * nothing had tried to write here through Kysely until now.
   */
  updated_at: ColumnType<Date, string | undefined, string>;
}

export interface StoresTable {
  id: Generated<string>;
  tenant_id: string;
  name: string;
  slug: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface StoreMembershipsTable {
  id: Generated<string>;
  tenant_id: string;
  store_id: string;
  user_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

/** Platform-wide reference data, no tenant_id/RLS (08_PHASE_1_BRIEF.md §5) — see the creating migration's comment. */
export interface ReservedSubdomainsTable {
  name: string;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    organizations: OrganizationsTable;
    memberships: MembershipsTable;
    stores: StoresTable;
    store_memberships: StoreMembershipsTable;
    reserved_subdomains: ReservedSubdomainsTable;
  }
}
