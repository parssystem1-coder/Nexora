import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { isUniqueViolation } from "../../../platform/db/constraint-violation.js";
import { RoleAlreadyGrantedError, RoleNotInCatalogError } from "../domain/role-grant.repository.js";
import type { GrantRoleCommand, RoleGrant, RoleGrantRepository } from "../domain/role-grant.repository.js";
import "./authorization.tables.js";

/** The UNIQUE (membership_id, role_id) constraint from 20260822090700_authorization__create_membership_roles.sql. */
const MEMBERSHIP_ROLE_UNIQUE = "membership_roles_membership_id_role_id_key";

export class RoleGrantRepositoryPg implements RoleGrantRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async grantRoleByKey(grant: GrantRoleCommand): Promise<RoleGrant> {
    // roles is platform-global reference data with no RLS, so this lookup is
    // visible regardless of the caller's tenant context.
    const role = await this.conn.selectFrom("roles").select("id").where("key", "=", grant.roleKey).executeTakeFirst();
    if (!role) {
      throw new RoleNotInCatalogError(grant.roleKey);
    }

    try {
      await this.conn
        .insertInto("membership_roles")
        .values({
          id: grant.id,
          tenant_id: grant.tenantId,
          membership_id: grant.membershipId,
          role_id: role.id,
          created_at: grant.createdAt.toISOString(),
        })
        .execute();
    } catch (err) {
      if (isUniqueViolation(err, MEMBERSHIP_ROLE_UNIQUE)) {
        throw new RoleAlreadyGrantedError(grant.membershipId, grant.roleKey);
      }
      throw err;
    }

    return { id: grant.id, tenantId: grant.tenantId, membershipId: grant.membershipId, roleKey: grant.roleKey, createdAt: grant.createdAt };
  }
}
