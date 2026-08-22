import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { PermissionCheckRepository } from "../domain/permission-check.repository.js";
import "./authorization.tables.js";

export class PermissionCheckRepositoryPg implements PermissionCheckRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async hasPermission(tenantId: string, membershipId: string, permissionKey: string): Promise<boolean> {
    const row = await this.conn
      .selectFrom("membership_roles")
      .innerJoin("role_permissions", "role_permissions.role_id", "membership_roles.role_id")
      .innerJoin("permissions", "permissions.id", "role_permissions.permission_id")
      .select("membership_roles.id")
      .where("membership_roles.tenant_id", "=", tenantId)
      .where("membership_roles.membership_id", "=", membershipId)
      .where("permissions.key", "=", permissionKey)
      .executeTakeFirst();
    return row !== undefined;
  }
}
