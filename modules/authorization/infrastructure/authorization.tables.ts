import type { ColumnType, Generated } from "kysely";

export interface RolesTable {
  id: Generated<string>;
  key: string;
  name: string;
}

export interface PermissionsTable {
  id: Generated<string>;
  key: string;
  description: string;
}

export interface RolePermissionsTable {
  role_id: string;
  permission_id: string;
}

export interface MembershipRolesTable {
  id: Generated<string>;
  tenant_id: string;
  membership_id: string;
  role_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

declare module "../../../platform/db/kysely.js" {
  interface Database {
    roles: RolesTable;
    permissions: PermissionsTable;
    role_permissions: RolePermissionsTable;
    membership_roles: MembershipRolesTable;
  }
}
