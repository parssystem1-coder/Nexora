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
  revoked_at: ColumnType<Date, string | undefined, never> | null;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    users: UsersTable;
    sessions: SessionsTable;
  }
}
