import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "./kysely.js";

/**
 * Fails fast, with a clear message, if the connected role could bypass RLS —
 * per ADR-021 ("the application database role cannot bypass RLS"). Without
 * this, a test asserting tenant isolation could pass for the wrong reason
 * (the connected role simply sees everything) rather than because RLS
 * actually enforced isolation. See DECISION_LOG.md "RLS: FORCE ROW LEVEL
 * SECURITY or a non-owner app role".
 *
 * Checks three independent ways a role can defeat RLS: being a superuser,
 * having the BYPASSRLS attribute, or owning the table (which exempts it
 * even when FORCE ROW LEVEL SECURITY is set, unless combined with the other
 * two checks already covering that).
 */
export async function assertRoleCannotBypassRls(db: Kysely<Database>, tableName: string): Promise<void> {
  const roleResult = await sql<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>`
    SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `.execute(db);
  const role = roleResult.rows[0];
  if (!role) {
    throw new Error("Could not resolve current_user in pg_roles.");
  }

  if (role.rolsuper) {
    throw new Error(
      `Connected role '${role.rolname}' is a PostgreSQL superuser, which bypasses RLS entirely regardless of ` +
        `ENABLE/FORCE ROW LEVEL SECURITY (ADR-021: "the application database role cannot bypass RLS"). ` +
        `Point DATABASE_URL at the nexora_app role instead — see platform/db/init/001_roles.sql.`,
    );
  }

  if (role.rolbypassrls) {
    throw new Error(
      `Connected role '${role.rolname}' has the BYPASSRLS attribute, which defeats RLS entirely (ADR-021). ` +
        `Point DATABASE_URL at the nexora_app role instead (created with NOBYPASSRLS in platform/db/init/001_roles.sql).`,
    );
  }

  const ownerResult = await sql<{ tableowner: string }>`
    SELECT tableowner FROM pg_tables WHERE tablename = ${tableName}
  `.execute(db);
  const owner = ownerResult.rows[0]?.tableowner;
  if (owner && owner === role.rolname) {
    throw new Error(
      `Connected role '${role.rolname}' owns table '${tableName}'. Schema DDL must run as the migrate role ` +
        `(nexora_migrate), never the app/test role, even though FORCE ROW LEVEL SECURITY would otherwise make ` +
        `RLS apply to an owner too — this is defense in depth per DECISION_LOG.md "RLS: FORCE ROW LEVEL ` +
        `SECURITY or a non-owner app role".`,
    );
  }
}
