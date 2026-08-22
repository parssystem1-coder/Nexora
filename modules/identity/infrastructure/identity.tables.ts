import type { ColumnType, Generated } from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  email_normalized: string;
  display_name: string;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, never>;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  active_organization_id: string | null;
  status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  last_seen_at: ColumnType<Date, string | undefined, never>;
  expires_at: ColumnType<Date, string, string>;
  /**
   * Nullable timestamptz with no default, folded into ColumnType itself
   * (`Date | null` as the SelectType) rather than wrapped as
   * `ColumnType<...> | null` — the latter made Kysely's Insertable/Updateable
   * extraction distribute over the union and land on `null` as the only
   * legal update value, which blocked session-revocation.repository.pg.ts's
   * `UPDATE ... SET revoked_at = $1` (added for membership.role.assign,
   * 08_PHASE_1_BRIEF.md §5's session-invalidation rule) with no such
   * restriction existing before because nothing had ever updated this column.
   */
  revoked_at: ColumnType<Date | null, string | null | undefined, string | null>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    users: UsersTable;
    sessions: SessionsTable;
  }
}
