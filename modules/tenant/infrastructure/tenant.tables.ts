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
  updated_at: ColumnType<Date, string | undefined, never>;
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
