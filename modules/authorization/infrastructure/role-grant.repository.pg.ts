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

    return {
      id: grant.id,
      tenantId: grant.tenantId,
      membershipId: grant.membershipId,
      roleKey: grant.roleKey,
      createdAt: grant.createdAt,
    };
  }

  async hasRole(membershipId: string, roleKey: string): Promise<boolean> {
    const row = await this.conn
      .selectFrom("membership_roles")
      .innerJoin("roles", "roles.id", "membership_roles.role_id")
      .select("membership_roles.id")
      .where("membership_roles.membership_id", "=", membershipId)
      .where("roles.key", "=", roleKey)
      .executeTakeFirst();
    return row !== undefined;
  }

  async countActiveMembersWithRole(tenantId: string, roleKey: string): Promise<number> {
    const result = await this.conn
      .selectFrom("membership_roles")
      .innerJoin("roles", "roles.id", "membership_roles.role_id")
      .innerJoin("memberships", "memberships.id", "membership_roles.membership_id")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("membership_roles.tenant_id", "=", tenantId)
      .where("roles.key", "=", roleKey)
      .where("memberships.status", "=", "ACTIVE")
      .executeTakeFirstOrThrow();
    return Number(result.count);
  }
}
