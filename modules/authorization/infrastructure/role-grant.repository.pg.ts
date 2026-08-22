import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { RoleGrantRepository } from "../domain/role-grant.repository.js";
import "./authorization.tables.js";

export class RoleGrantRepositoryPg implements RoleGrantRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async grantRoleByKey(tenantId: string, membershipId: string, roleKey: string): Promise<void> {
    // roles is platform-global reference data with no RLS, so this lookup is
    // visible regardless of the caller's tenant context.
    const role = await this.conn.selectFrom("roles").select("id").where("key", "=", roleKey).executeTakeFirst();
    if (!role) {
      throw new Error(`Role '${roleKey}' is not in the platform role catalog.`);
    }

    await this.conn
      .insertInto("membership_roles")
      .values({ tenant_id: tenantId, membership_id: membershipId, role_id: role.id })
      .execute();
  }
}
