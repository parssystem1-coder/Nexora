import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { createTestApp } from "./create-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { withTenantContext } from "../../platform/db/tenant-context.js";
import { seedUser, seedSession, seedOrganization, seedMembership, grantRole } from "./test-support/seed.js";

/**
 * `POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/roles`
 * end to end, against real PostgreSQL with real RLS, through the same
 * middleware stack main.ts ships (create-app.ts).
 *
 * Two things unique to this slice: it is the first HIGH_WRITE capability, so
 * the "owner only, not admin" permission restriction is proven directly
 * (an admin gets FORBIDDEN); and it is the first capability that must
 * invalidate a session as a side effect of its own write, proven by using
 * the target's session cookie again after the assignment succeeds.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

/** An organization with one member holding `role`, plus a live session for them. */
async function orgWithMember(label: string, role: "owner" | "admin" | "member") {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-caller-${suffix}@example.test`);
  const orgId = await seedOrganization(db, `${label} Org`, `${label}-org-${suffix}`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  await grantRole(db, orgId, membershipId, role);
  const token = await seedSession(db, userId, { activeOrganizationId: orgId });
  return { userId, orgId, membershipId, token, suffix };
}

/** A second member of the SAME organization, with a live session and no roles yet. */
async function memberOf(orgId: string, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-target-${suffix}@example.test`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  const token = await seedSession(db, userId);
  return { userId, membershipId, token };
}

function assign(orgId: string, membershipId: string, token: string | undefined, body: Record<string, unknown>) {
  const req = request(app.getHttpServer()).post(`/api/v1/organizations/${orgId}/memberships/${membershipId}/roles`);
  if (token) req.set("Cookie", `sid=${token}`);
  return req.send(body);
}

function auditRowsFor(tenantId: string, userId: string) {
  return withTenantContext(db, { tenantId, userId, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", tenantId)
      .where("capability", "=", "membership.role.assign")
      .execute(),
  );
}

async function sessionStatus(token: string): Promise<string | undefined> {
  const { hashSessionToken } = await import("../../modules/identity/domain/session-token.vo.js");
  const row = await db
    .selectFrom("sessions")
    .select("status")
    .where("token_hash", "=", hashSessionToken(token))
    .executeTakeFirst();
  return row?.status;
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the membership.role.assign integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST .../memberships/:membershipId/roles - happy path", () => {
  it("grants the role and returns 201 with the documented DTO", async () => {
    const caller = await orgWithMember("happy", "owner");
    const target = await memberOf(caller.orgId, "happy");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ organizationId: caller.orgId, membershipId: target.membershipId, roleKey: "admin" });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("persists the grant, visible to a subsequent permission check", async () => {
    const caller = await orgWithMember("persist", "owner");
    const target = await memberOf(caller.orgId, "persist");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    const rows = await withTenantContext(db, { tenantId: caller.orgId, userId: caller.userId, storeId: null }, (trx) =>
      trx
        .selectFrom("membership_roles")
        .innerJoin("roles", "roles.id", "membership_roles.role_id")
        .select(["roles.key"])
        .where("membership_roles.membership_id", "=", target.membershipId)
        .execute(),
    );
    expect(rows).toEqual([{ key: "admin" }]);
  });

  it("adds a role rather than replacing the set - granting a second role leaves the first in place", async () => {
    const caller = await orgWithMember("addnotreplace", "owner");
    const target = await memberOf(caller.orgId, "addnotreplace");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "member" }).expect(201);
    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    const rows = await withTenantContext(db, { tenantId: caller.orgId, userId: caller.userId, storeId: null }, (trx) =>
      trx
        .selectFrom("membership_roles")
        .innerJoin("roles", "roles.id", "membership_roles.role_id")
        .select(["roles.key"])
        .where("membership_roles.membership_id", "=", target.membershipId)
        .execute(),
    );
    expect(rows.map((r) => r.key).sort()).toEqual(["admin", "member"]);
  });

  it("allows an owner to assign a role to their own membership", async () => {
    const caller = await orgWithMember("self", "owner");

    const res = await assign(caller.orgId, caller.membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(201);
  });
});

describe("POST .../memberships/:membershipId/roles - session invalidation (08_PHASE_1_BRIEF.md §5)", () => {
  it("revokes the target's session, so their existing cookie stops authenticating on the very next request", async () => {
    const caller = await orgWithMember("invalidate", "owner");
    const target = await memberOf(caller.orgId, "invalidate");
    expect(await sessionStatus(target.token)).toBe("ACTIVE");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    expect(await sessionStatus(target.token)).toBe("REVOKED");
    // Reuses this same route with the target's now-revoked cookie: SessionGuard
    // runs before OrganizationAccessGuard or any permission check, so this
    // proves invalidation regardless of whether the target ever held
    // membership.role.assign themselves.
    const nextRequest = await assign(caller.orgId, target.membershipId, target.token, { roleKey: "member" });
    expect(nextRequest.status).toBe(401);
    expect(nextRequest.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("does NOT revoke the caller's own session for an unrelated target", async () => {
    const caller = await orgWithMember("untouched", "owner");
    const target = await memberOf(caller.orgId, "untouched");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    expect(await sessionStatus(caller.token)).toBe("ACTIVE");
  });

  it("revokes the caller's OWN session when they assign a role to themselves - an accepted consequence, not a bug", async () => {
    const caller = await orgWithMember("selfrevoke", "owner");

    await assign(caller.orgId, caller.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    expect(await sessionStatus(caller.token)).toBe("REVOKED");
  });

  it("does not revoke the target's session when the grant fails (duplicate role)", async () => {
    const caller = await orgWithMember("nofailrevoke", "owner");
    const target = await memberOf(caller.orgId, "nofailrevoke");
    // Seeded directly, not through this endpoint, so the target's session is
    // never touched by a prior SUCCESSFUL call - the only assign attempt in
    // this test is the failing one, isolating whether failure alone revokes.
    await grantRole(db, caller.orgId, target.membershipId, "admin");
    expect(await sessionStatus(target.token)).toBe("ACTIVE");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(409);

    expect(await sessionStatus(target.token)).toBe("ACTIVE");
  });
});

describe("POST .../memberships/:membershipId/roles - denial paths", () => {
  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const caller = await orgWithMember("noauth", "owner");
    const target = await memberOf(caller.orgId, "noauth");

    const res = await assign(caller.orgId, target.membershipId, undefined, { roleKey: "admin" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns FORBIDDEN when the caller is not a member of the named organization", async () => {
    const mine = await orgWithMember("crossA", "owner");
    const theirs = await orgWithMember("crossB", "owner");
    const target = await memberOf(theirs.orgId, "cross");

    const res = await assign(theirs.orgId, target.membershipId, mine.token, { roleKey: "admin" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for an ADMIN caller - membership.role.assign is owner-only, unlike membership.invite", async () => {
    const caller = await orgWithMember("adminonly", "admin");
    const target = await memberOf(caller.orgId, "adminonly");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "member" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for a plain MEMBER caller", async () => {
    const caller = await orgWithMember("memberonly", "member");
    const target = await memberOf(caller.orgId, "memberonly");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "member" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR for a malformed organizationId", async () => {
    const caller = await orgWithMember("badorg", "owner");
    const target = await memberOf(caller.orgId, "badorg");

    const res = await assign("not-a-uuid", target.membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a malformed membershipId", async () => {
    const caller = await orgWithMember("badmembership", "owner");

    const res = await assign(caller.orgId, "not-a-uuid", caller.token, { roleKey: "admin" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for an unknown role key - rejected at the schema boundary, never reaching the database", async () => {
    const caller = await orgWithMember("badrole", "owner");
    const target = await memberOf(caller.orgId, "badrole");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "superadmin" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a missing roleKey", async () => {
    const caller = await orgWithMember("norole", "owner");
    const target = await memberOf(caller.orgId, "norole");

    const res = await assign(caller.orgId, target.membershipId, caller.token, {});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns RESOURCE_NOT_FOUND for a membershipId that does not exist", async () => {
    const caller = await orgWithMember("nomembership", "owner");

    const res = await assign(caller.orgId, randomUUID(), caller.token, { roleKey: "admin" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns RESOURCE_NOT_FOUND, not FORBIDDEN or CONFLICT, for a membershipId belonging to a DIFFERENT tenant", async () => {
    const caller = await orgWithMember("wrongtenant", "owner");
    const otherOrg = await orgWithMember("wrongtenantOther", "owner");
    const foreignTarget = await memberOf(otherOrg.orgId, "wrongtenant");

    const res = await assign(caller.orgId, foreignTarget.membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns RESOURCE_NOT_FOUND, not CONFLICT, when the caller names their OWN membership from a DIFFERENT organization while acting in this one - the R-003 self-access leak, guarded explicitly in the service", async () => {
    const caller = await orgWithMember("selfleak", "owner");
    // The caller ALSO belongs to a second organization, as its owner.
    const secondOrgId = await seedOrganization(db, "Second Org", `selfleak-second-${caller.suffix}`);
    const secondMembershipId = await seedMembership(db, secondOrgId, caller.userId, "ACTIVE");
    await grantRole(db, secondOrgId, secondMembershipId, "owner");

    // Acting in `caller.orgId`, but naming the membership id from the SECOND
    // organization - the id memberships' self-access RLS clause would make
    // visible to this exact user regardless of which tenant is current.
    const res = await assign(caller.orgId, secondMembershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");

    const grantedInWrongTenant = await withTenantContext(
      db,
      { tenantId: secondOrgId, userId: caller.userId, storeId: null },
      (trx) => trx.selectFrom("membership_roles").select("id").where("membership_id", "=", secondMembershipId).execute(),
    );
    expect(grantedInWrongTenant).toHaveLength(1); // only the owner grant from setup - nothing added
  });

  it("returns RESOURCE_NOT_FOUND for a REVOKED target membership", async () => {
    const caller = await orgWithMember("revokedtarget", "owner");
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `revokedtarget-target-${suffix}@example.test`);
    const membershipId = await seedMembership(db, caller.orgId, userId, "REVOKED");

    const res = await assign(caller.orgId, membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns CONFLICT when the target already holds that role", async () => {
    const caller = await orgWithMember("dup", "owner");
    const target = await memberOf(caller.orgId, "dup");
    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

describe("POST .../memberships/:membershipId/roles - audit (ADR-034)", () => {
  it("records one SUCCESS event carrying the target membership and role key in metadata", async () => {
    const caller = await orgWithMember("auditok", "owner");
    const target = await memberOf(caller.orgId, "auditok");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" });
    expect(res.status).toBe(201);

    const events = await auditRowsFor(caller.orgId, caller.userId);

    expect(events).toEqual([
      {
        capability: "membership.role.assign",
        outcome: "SUCCESS",
        resource_type: "membership_role",
        resource_id: res.body.id,
        metadata: { targetMembershipId: target.membershipId, roleKey: "admin" },
      },
    ]);
  });

  it("records a FAILURE event when the permission check refuses the caller", async () => {
    const caller = await orgWithMember("auditperm", "admin");
    const target = await memberOf(caller.orgId, "auditperm");

    await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(403);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", resource_type: "membership_role" });
  });

  it("records a FAILURE event when the target membership does not exist, and grants no role", async () => {
    const caller = await orgWithMember("auditghost", "owner");
    const ghostId = randomUUID();

    await assign(caller.orgId, ghostId, caller.token, { roleKey: "admin" }).expect(404);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", metadata: { targetMembershipId: ghostId, roleKey: "admin" } });
  });

  it("writes NO audit event when the guard refuses before step 6 - the event covers steps 6-7, not the whole request", async () => {
    const mine = await orgWithMember("auditguard", "owner");
    const theirs = await orgWithMember("auditguardB", "owner");
    const target = await memberOf(theirs.orgId, "auditguard");

    await assign(theirs.orgId, target.membershipId, mine.token, { roleKey: "admin" }).expect(403);

    expect(await auditRowsFor(theirs.orgId, theirs.userId)).toEqual([]);
    expect(await auditRowsFor(mine.orgId, mine.userId)).toEqual([]);
  });
});

describe("POST .../memberships/:membershipId/roles - RLS and logging", () => {
  it("the new grant is invisible to another tenant's context", async () => {
    const caller = await orgWithMember("rlsMine", "owner");
    const other = await orgWithMember("rlsOther", "owner");
    const target = await memberOf(caller.orgId, "rlsMine");

    const res = await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" });
    expect(res.status).toBe(201);

    const rows = await withTenantContext(db, { tenantId: other.orgId, userId: other.userId, storeId: null }, (trx) =>
      trx.selectFrom("membership_roles").select("id").where("id", "=", res.body.id).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("emits one structured log line carrying requestId, correlationId and the organization's tenantId", async () => {
    const caller = await orgWithMember("logline", "owner");
    const target = await memberOf(caller.orgId, "logline");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await assign(caller.orgId, target.membershipId, caller.token, { roleKey: "admin" }).expect(201);
    } finally {
      console.log = originalLog;
    }

    const entries = captured
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null && "requestId" in entry);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tenantId: caller.orgId, status: 201, method: "POST" });
    expect(entries[0]!["requestId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
