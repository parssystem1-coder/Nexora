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
import { hashSessionToken } from "../../modules/identity/domain/session-token.vo.js";
import { seedUser, seedSession, seedOrganization, seedMembership, grantRole } from "./test-support/seed.js";

/**
 * `POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/revoke`
 * end to end, against real PostgreSQL with real RLS, through the same
 * middleware stack main.ts ships (create-app.ts).
 *
 * The seventh capability, not one of 08_PHASE_1_BRIEF.md §3's six-slice
 * list — see DECISION_LOG.md 2026-08-24. This is the slice
 * 08_PHASE_1_BRIEF.md §6 exit criterion 4 depends on: revoking a membership
 * must invalidate active sessions within one request. That property is
 * proved here the same way membership.role.assign proves its own session
 * trigger — using the target's real cookie against a real route on the very
 * next request, not by asserting a repository method was called.
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

/** A second member of the SAME organization, with a live session, optionally also holding `role`. */
async function memberOf(orgId: string, label: string, role?: "owner" | "admin" | "member") {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-target-${suffix}@example.test`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  if (role) await grantRole(db, orgId, membershipId, role);
  const token = await seedSession(db, userId);
  return { userId, membershipId, token };
}

function revoke(orgId: string, membershipId: string, token: string | undefined) {
  const req = request(app.getHttpServer()).post(`/api/v1/organizations/${orgId}/memberships/${membershipId}/revoke`);
  if (token) req.set("Cookie", `sid=${token}`);
  return req;
}

/** Any real, unrelated, already-existing capability - proves the target's cookie either still authenticates or no longer does. */
function createOrganizationWith(token: string) {
  const suffix = randomUUID().slice(0, 8);
  return request(app.getHttpServer())
    .post("/api/v1/organizations")
    .set("Cookie", `sid=${token}`)
    .send({ name: "Probe Org", slug: `probe-${suffix}` });
}

function auditRowsFor(tenantId: string) {
  return withTenantContext(db, { tenantId, userId: null, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", tenantId)
      .where("capability", "=", "membership.revoke")
      .execute(),
  );
}

async function membershipStatus(tenantId: string, membershipId: string): Promise<string | undefined> {
  const row = await withTenantContext(db, { tenantId, userId: null, storeId: null }, (trx) =>
    trx.selectFrom("memberships").select("status").where("id", "=", membershipId).executeTakeFirst(),
  );
  return row?.status;
}

async function sessionStatus(token: string): Promise<string | undefined> {
  const row = await db.selectFrom("sessions").select("status").where("token_hash", "=", hashSessionToken(token)).executeTakeFirst();
  return row?.status;
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the membership.revoke integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/revoke", () => {
  it("returns 200 with the membership shown as REVOKED - the row survives, it is not destroyed", async () => {
    const caller = await orgWithMember("happy", "owner");
    // A second owner so revoking `target` never trips the last-owner guard.
    await memberOf(caller.orgId, "happy-owner2", "owner");
    const target = await memberOf(caller.orgId, "happy", "member");

    const res = await revoke(caller.orgId, target.membershipId, caller.token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: target.membershipId,
      organizationId: caller.orgId,
      userId: target.userId,
      status: "REVOKED",
      createdAt: expect.any(String),
    });
    expect(await membershipStatus(caller.orgId, target.membershipId)).toBe("REVOKED");
  });

  it("revokes the target's session, so their existing cookie stops authenticating on the very next request (exit criterion 4)", async () => {
    const caller = await orgWithMember("invalidate", "owner");
    await memberOf(caller.orgId, "invalidate-owner2", "owner");
    const target = await memberOf(caller.orgId, "invalidate", "member");
    expect(await sessionStatus(target.token)).toBe("ACTIVE");

    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    expect(await sessionStatus(target.token)).toBe("REVOKED");
    const nextRequest = await createOrganizationWith(target.token);
    expect(nextRequest.status).toBe(401);
    expect(nextRequest.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("does NOT revoke the caller's own session for an unrelated target", async () => {
    const caller = await orgWithMember("untouched", "owner");
    await memberOf(caller.orgId, "untouched-owner2", "owner");
    const target = await memberOf(caller.orgId, "untouched", "member");

    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    expect(await sessionStatus(caller.token)).toBe("ACTIVE");
  });

  it("allows self-revocation when other members remain - an accepted consequence, not a special case (decision 4)", async () => {
    const caller = await orgWithMember("selfrevoke", "owner");
    await memberOf(caller.orgId, "selfrevoke-owner2", "owner");

    const res = await revoke(caller.orgId, caller.membershipId, caller.token);

    expect(res.status).toBe(200);
    expect(await sessionStatus(caller.token)).toBe("REVOKED");
  });

  it("returns CONFLICT and revokes nothing when the target is the organization's only remaining member", async () => {
    const caller = await orgWithMember("lastmember", "owner");

    const res = await revoke(caller.orgId, caller.membershipId, caller.token);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(await membershipStatus(caller.orgId, caller.membershipId)).toBe("ACTIVE");
  });

  it("returns CONFLICT and revokes nothing when the target is the organization's only remaining owner, even though other members exist", async () => {
    const caller = await orgWithMember("lastowner", "owner");
    await memberOf(caller.orgId, "lastowner-admin", "admin");

    const res = await revoke(caller.orgId, caller.membershipId, caller.token);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(await membershipStatus(caller.orgId, caller.membershipId)).toBe("ACTIVE");
  });

  it("succeeds against a non-owner target even when the target is the org's only admin - only OWNER count is protected", async () => {
    const caller = await orgWithMember("onlyadmin", "owner");
    const target = await memberOf(caller.orgId, "onlyadmin-admin", "admin");

    const res = await revoke(caller.orgId, target.membershipId, caller.token);

    expect(res.status).toBe(200);
  });

  it("returns CONFLICT, not RESOURCE_NOT_FOUND, for an already-revoked target - deliberately different from membership.role.assign's choice (decision 7)", async () => {
    const caller = await orgWithMember("revoked", "owner");
    await memberOf(caller.orgId, "revoked-owner2", "owner");
    const target = await memberOf(caller.orgId, "revoked", "member");
    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    const second = await revoke(caller.orgId, target.membershipId, caller.token);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe("CONFLICT");
  });

  it("does not remove the target's membership_roles rows - revocation is a status change, not a data deletion (decision 8)", async () => {
    const caller = await orgWithMember("rolespreserved", "owner");
    await memberOf(caller.orgId, "rolespreserved-owner2", "owner");
    const target = await memberOf(caller.orgId, "rolespreserved", "admin");

    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    const roleRows = await withTenantContext(db, { tenantId: caller.orgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("membership_roles").select("id").where("membership_id", "=", target.membershipId).execute(),
    );
    expect(roleRows).toHaveLength(1);
  });

  it("returns RESOURCE_NOT_FOUND for a membershipId that does not exist", async () => {
    const caller = await orgWithMember("notfound", "owner");

    const res = await revoke(caller.orgId, randomUUID(), caller.token);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns RESOURCE_NOT_FOUND, not CONFLICT, when the caller names their OWN membership from a DIFFERENT organization while acting in this one - the R-003 self-access leak, guarded explicitly in the service", async () => {
    const caller = await orgWithMember("selfleak", "owner");
    await memberOf(caller.orgId, "selfleak-owner2", "owner");
    const secondOrgId = await seedOrganization(db, "Second Org", `selfleak-second-${caller.suffix}`);
    const secondMembershipId = await seedMembership(db, secondOrgId, caller.userId, "ACTIVE");
    await grantRole(db, secondOrgId, secondMembershipId, "owner");

    const res = await revoke(caller.orgId, secondMembershipId, caller.token);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
    expect(await membershipStatus(secondOrgId, secondMembershipId)).toBe("ACTIVE");
  });

  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const caller = await orgWithMember("noauth", "owner");
    const target = await memberOf(caller.orgId, "noauth", "member");

    const res = await revoke(caller.orgId, target.membershipId, undefined);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns FORBIDDEN when the caller is not a member of the named organization", async () => {
    const outsider = await seedUser(db, `outsider-${randomUUID().slice(0, 8)}@example.test`);
    const outsiderToken = await seedSession(db, outsider);
    const caller = await orgWithMember("notmember", "owner");
    const target = await memberOf(caller.orgId, "notmember", "member");

    const res = await revoke(caller.orgId, target.membershipId, outsiderToken);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for an ADMIN caller - membership.revoke is owner-only, like membership.role.assign", async () => {
    const admin = await orgWithMember("adminforbidden", "admin");
    const target = await memberOf(admin.orgId, "adminforbidden", "member");

    const res = await revoke(admin.orgId, target.membershipId, admin.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for a plain MEMBER caller", async () => {
    const member = await orgWithMember("memberforbidden", "member");
    const target = await memberOf(member.orgId, "memberforbidden", "member");

    const res = await revoke(member.orgId, target.membershipId, member.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR for a malformed organizationId", async () => {
    const caller = await orgWithMember("badorg", "owner");
    const target = await memberOf(caller.orgId, "badorg", "member");

    const res = await revoke("not-a-uuid", target.membershipId, caller.token);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a malformed membershipId", async () => {
    const caller = await orgWithMember("badmembership", "owner");

    const res = await revoke(caller.orgId, "not-a-uuid", caller.token);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("records one SUCCESS audit event naming the revoked membership", async () => {
    const caller = await orgWithMember("audit", "owner");
    await memberOf(caller.orgId, "audit-owner2", "owner");
    const target = await memberOf(caller.orgId, "audit", "member");

    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    const events = await auditRowsFor(caller.orgId);
    expect(events).toEqual([
      {
        capability: "membership.revoke",
        outcome: "SUCCESS",
        resource_type: "membership",
        resource_id: target.membershipId,
        metadata: {},
      },
    ]);
  });

  it("records a FAILURE event when the permission check refuses the caller", async () => {
    const member = await orgWithMember("auditfail", "member");
    const target = await memberOf(member.orgId, "auditfail", "member");

    await revoke(member.orgId, target.membershipId, member.token).expect(403);

    const events = await auditRowsFor(member.orgId);
    expect(events).toEqual([
      expect.objectContaining({ capability: "membership.revoke", outcome: "FAILURE", resource_id: target.membershipId }),
    ]);
  });

  it("records a FAILURE event, not a missing one, when the last-owner guard refuses", async () => {
    const caller = await orgWithMember("auditlastowner", "owner");

    await revoke(caller.orgId, caller.membershipId, caller.token).expect(409);

    const events = await auditRowsFor(caller.orgId);
    expect(events).toEqual([
      expect.objectContaining({ capability: "membership.revoke", outcome: "FAILURE", resource_id: caller.membershipId }),
    ]);
  });

  it("writes NO audit event when the guard refuses before step 6 - the event covers steps 6-7, not the whole request", async () => {
    const outsider = await seedUser(db, `auditguard-${randomUUID().slice(0, 8)}@example.test`);
    const outsiderToken = await seedSession(db, outsider);
    const caller = await orgWithMember("auditguard", "owner");
    const target = await memberOf(caller.orgId, "auditguard", "member");

    await revoke(caller.orgId, target.membershipId, outsiderToken).expect(403);

    const events = await auditRowsFor(caller.orgId);
    expect(events).toEqual([]);
  });

  it("the revoked status is invisible to another tenant's context", async () => {
    const caller = await orgWithMember("crosstenant", "owner");
    await memberOf(caller.orgId, "crosstenant-owner2", "owner");
    const target = await memberOf(caller.orgId, "crosstenant", "member");
    await revoke(caller.orgId, target.membershipId, caller.token).expect(200);

    const otherOrgId = await seedOrganization(db, "Other Org", `crosstenant-other-${randomUUID().slice(0, 8)}`);
    const rows = await withTenantContext(db, { tenantId: otherOrgId, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("memberships").select("id").where("id", "=", target.membershipId).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("emits one structured log line carrying requestId, correlationId and the organization's tenantId", async () => {
    const caller = await orgWithMember("logline", "owner");
    await memberOf(caller.orgId, "logline-owner2", "owner");
    const target = await memberOf(caller.orgId, "logline", "member");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await revoke(caller.orgId, target.membershipId, caller.token).expect(200);
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
    expect(entries[0]).toMatchObject({ tenantId: caller.orgId, status: 200, method: "POST" });
  });
});
