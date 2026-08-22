import type { Kysely } from "kysely";
import { randomUUID } from "node:crypto";
import type { Database } from "../../../platform/db/kysely.js";
import { generateSessionToken, hashSessionToken } from "../../../modules/identity/domain/session-token.vo.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";

/**
 * Test-only seeding, bypassing the (not-yet-built, Task 2) capabilities that
 * would normally create this data — auth.login, organization.create,
 * membership.invite, store.create. Lives under apps/ specifically because it
 * legitimately needs to touch every module's tables directly, which no
 * single module's own code is allowed to do (DEP-DIRECTION-CROSS-MODULE).
 */

export async function seedUser(db: Kysely<Database>, email: string): Promise<string> {
  const row = await db
    .insertInto("users")
    .values({ email, email_normalized: email.toLowerCase(), display_name: email, status: "ACTIVE" })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function seedSession(
  db: Kysely<Database>,
  userId: string,
  options: { activeOrganizationId?: string | null; expired?: boolean } = {},
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = options.expired ? new Date(Date.now() - 60_000) : new Date(Date.now() + 60 * 60 * 1000);
  await db
    .insertInto("sessions")
    .values({
      user_id: userId,
      token_hash: hashSessionToken(token),
      active_organization_id: options.activeOrganizationId ?? null,
      status: "ACTIVE",
      expires_at: expiresAt.toISOString(),
    })
    .execute();
  return token;
}

/**
 * Generates the id client-side and never uses .returning() here — Postgres
 * evaluates a RETURNING clause's rows against the table's USING policy (not
 * just WITH CHECK), and organizations' USING clause can never match a
 * brand-new row whose own id nothing has told Postgres to trust yet. See
 * DECISION_LOG.md "INSERT ... RETURNING re-checks the USING policy...".
 */
export async function seedOrganization(db: Kysely<Database>, name: string, slug: string): Promise<string> {
  const id = randomUUID();
  await db.insertInto("organizations").values({ id, name, slug, status: "ACTIVE" }).execute();
  return id;
}

export async function seedMembership(
  db: Kysely<Database>,
  orgId: string,
  userId: string,
  status: "ACTIVE" | "REVOKED" = "ACTIVE",
): Promise<string> {
  return withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, async (trx) => {
    const row = await trx
      .insertInto("memberships")
      .values({ tenant_id: orgId, user_id: userId, status })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });
}

export async function seedStore(db: Kysely<Database>, orgId: string, name: string, slug: string): Promise<string> {
  return withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, async (trx) => {
    const row = await trx
      .insertInto("stores")
      .values({ tenant_id: orgId, name, slug, status: "ACTIVE" })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });
}

export async function seedStoreMembership(db: Kysely<Database>, orgId: string, storeId: string, userId: string): Promise<void> {
  await withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, async (trx) => {
    await trx.insertInto("store_memberships").values({ tenant_id: orgId, store_id: storeId, user_id: userId }).execute();
  });
}

export async function grantRole(db: Kysely<Database>, orgId: string, membershipId: string, roleKey: string): Promise<void> {
  await withTenantContext(db, { tenantId: orgId, userId: null, storeId: null }, async (trx) => {
    const role = await trx.selectFrom("roles").select("id").where("key", "=", roleKey).executeTakeFirstOrThrow();
    await trx
      .insertInto("membership_roles")
      .values({ tenant_id: orgId, membership_id: membershipId, role_id: role.id })
      .execute();
  });
}
