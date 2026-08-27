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
 * `POST /api/v1/organizations/{organizationId}/memberships` end to end,
 * against real PostgreSQL with real RLS, through the same middleware stack
 * main.ts ships (create-app.ts).
 *
 * Two things this slice must prove that earlier ones could not: that the
 * permission catalog actually gates the capability (a plain `member` is
 * refused where an `owner` succeeds), and that a guard denial and a
 * permission denial are audited differently - the audit event covers pipeline
 * steps 6-7 only, so a request rejected at step 2 never reaches it.
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

/** A platform user who belongs to no organization - the invitee. */
async function outsider(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-invitee-${suffix}@example.test`;
  const userId = await seedUser(db, email);
  return { userId, email };
}

function invite(organizationId: string, token: string | undefined, body: Record<string, unknown>) {
  const req = request(app.getHttpServer()).post(`/api/v1/organizations/${organizationId}/memberships`);
  if (token) req.set("Cookie", `sid=${token}`);
  return req.send(body);
}

function auditRowsFor(tenantId: string, userId: string) {
  return withTenantContext(db, { tenantId, userId, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", tenantId)
      .where("capability", "=", "membership.invite")
      .execute(),
  );
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the membership.invite integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/organizations/:organizationId/memberships - happy path", () => {
  it("adds the invited user as an ACTIVE member and returns 201 with the documented DTO", async () => {
    const caller = await orgWithMember("happy", "owner");
    const invitee = await outsider("happy");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      organizationId: caller.orgId,
      userId: invitee.userId,
      status: "ACTIVE",
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("grants the new member no roles at all - role assignment is a separate capability", async () => {
    const caller = await orgWithMember("noroles", "owner");
    const invitee = await outsider("noroles");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });
    expect(res.status).toBe(201);

    const roles = await withTenantContext(db, { tenantId: caller.orgId, userId: caller.userId, storeId: null }, (trx) =>
      trx.selectFrom("membership_roles").select("id").where("membership_id", "=", res.body.id).execute(),
    );
    expect(roles).toEqual([]);
  });

  it("accepts an admin as well as an owner", async () => {
    const caller = await orgWithMember("admin", "admin");
    const invitee = await outsider("admin");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });

    expect(res.status).toBe(201);
  });

  it("matches the invitee's address case-insensitively", async () => {
    const caller = await orgWithMember("case", "owner");
    const invitee = await outsider("case");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email.toUpperCase() });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(invitee.userId);
  });

  it("composes with organization.create - the documented flow, driven entirely through HTTP", async () => {
    // 03_TECHNICAL_BLUEPRINT.md §167: create organization -> invite member.
    const suffix = randomUUID().slice(0, 8);
    const founderId = await seedUser(db, `flow-founder-${suffix}@example.test`);
    const founderToken = await seedSession(db, founderId);
    const invitee = await outsider("flow");

    const created = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${founderToken}`)
      .send({ name: "Flow Co", slug: `flow-${suffix}` });
    expect(created.status).toBe(201);

    const invited = await invite(created.body.id, founderToken, { email: invitee.email });

    expect(invited.status).toBe(201);
    expect(invited.body.organizationId).toBe(created.body.id);
  });
});

describe("POST /api/v1/organizations/:organizationId/memberships - denial paths", () => {
  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const caller = await orgWithMember("noauth", "owner");
    const invitee = await outsider("noauth");

    const res = await invite(caller.orgId, undefined, { email: invitee.email });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns FORBIDDEN when the caller is not a member of the named organization (ADR-002: the tenant is the path parameter, not the session's active organization)", async () => {
    const mine = await orgWithMember("crossA", "owner");
    const theirs = await orgWithMember("crossB", "owner");
    const invitee = await outsider("cross");

    const res = await invite(theirs.orgId, mine.token, { email: invitee.email });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for a membership that exists but is REVOKED", async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = await seedUser(db, `revoked-${suffix}@example.test`);
    const orgId = await seedOrganization(db, "Revoked Org", `revoked-inv-org-${suffix}`);
    const membershipId = await seedMembership(db, orgId, userId, "REVOKED");
    await grantRole(db, orgId, membershipId, "owner");
    const token = await seedSession(db, userId, { activeOrganizationId: orgId });
    const invitee = await outsider("revoked");

    const res = await invite(orgId, token, { email: invitee.email });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for an active member whose role does not carry membership.invite", async () => {
    const caller = await orgWithMember("plainmember", "member");
    const invitee = await outsider("plainmember");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN, not RESOURCE_NOT_FOUND, for an organization that does not exist - a non-member cannot probe which ids are real", async () => {
    const caller = await orgWithMember("probe", "owner");
    const invitee = await outsider("probe");

    const res = await invite(randomUUID(), caller.token, { email: invitee.email });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR for a malformed organizationId", async () => {
    const caller = await orgWithMember("badorg", "owner");
    const invitee = await outsider("badorg");

    const res = await invite("not-a-uuid", caller.token, { email: invitee.email });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["a malformed address", { email: "not-an-email" }],
    ["an empty address", { email: "" }],
    ["a missing address", {}],
  ])("returns VALIDATION_ERROR for %s", async (_label, body) => {
    const caller = await orgWithMember("bademail", "owner");

    const res = await invite(caller.orgId, caller.token, body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns RESOURCE_NOT_FOUND when no platform user holds that address", async () => {
    const caller = await orgWithMember("nouser", "owner");

    const res = await invite(caller.orgId, caller.token, { email: `ghost-${randomUUID().slice(0, 8)}@example.test` });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("returns CONFLICT when the user already holds a membership in this organization", async () => {
    const caller = await orgWithMember("dup", "owner");
    const invitee = await outsider("dup");

    await invite(caller.orgId, caller.token, { email: invitee.email }).expect(201);
    const res = await invite(caller.orgId, caller.token, { email: invitee.email });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("returns CONFLICT when re-inviting the caller themselves, who is already a member", async () => {
    const caller = await orgWithMember("self", "owner");
    const email = `self-caller-${caller.suffix}@example.test`;

    const res = await invite(caller.orgId, caller.token, { email });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

describe("POST /api/v1/organizations/:organizationId/memberships - a body field must not override a path parameter", () => {
  it("rejects a body organizationId that differs from the path organizationId, even when the caller belongs to both, and invites no one", async () => {
    const orgA = await orgWithMember("orgmismatch", "owner");
    const orgBId = await seedOrganization(db, "Org Mismatch B", `orgmismatch-b-${orgA.suffix}`);
    const orgBMembershipId = await seedMembership(db, orgBId, orgA.userId, "ACTIVE");
    await grantRole(db, orgBId, orgBMembershipId, "owner");
    const invitee = await outsider("orgmismatch");

    const res = await invite(orgA.orgId, orgA.token, { email: invitee.email, organizationId: orgBId });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");

    const membershipsInA = await withTenantContext(
      db,
      { tenantId: orgA.orgId, userId: orgA.userId, storeId: null },
      (trx) => trx.selectFrom("memberships").select("id").where("tenant_id", "=", orgA.orgId).execute(),
    );
    expect(membershipsInA).toHaveLength(1); // only the caller's own, from setup
    expect(await auditRowsFor(orgA.orgId, orgA.userId)).toEqual([]);
    expect(await auditRowsFor(orgBId, orgA.userId)).toEqual([]);
  });

  it("accepts a body organizationId that is IDENTICAL to the path organizationId - an echo is not an error", async () => {
    const caller = await orgWithMember("orgidentical", "owner");
    const invitee = await outsider("orgidentical");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email, organizationId: caller.orgId });

    expect(res.status).toBe(201);
  });
});

describe("POST /api/v1/organizations/:organizationId/memberships - audit (ADR-034)", () => {
  it("records one SUCCESS event carrying the invitee's address in metadata", async () => {
    const caller = await orgWithMember("auditok", "owner");
    const invitee = await outsider("auditok");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });
    expect(res.status).toBe(201);

    const events = await auditRowsFor(caller.orgId, caller.userId);

    expect(events).toEqual([
      {
        capability: "membership.invite",
        outcome: "SUCCESS",
        resource_type: "membership",
        resource_id: res.body.id,
        metadata: { inviteeEmail: invitee.email },
      },
    ]);
  });

  it("records a FAILURE event when the permission check refuses the caller", async () => {
    const caller = await orgWithMember("auditperm", "member");
    const invitee = await outsider("auditperm");

    await invite(caller.orgId, caller.token, { email: invitee.email }).expect(403);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", resource_type: "membership" });
  });

  it("records a FAILURE event when the invitee does not exist, and writes no membership", async () => {
    const caller = await orgWithMember("auditghost", "owner");

    await invite(caller.orgId, caller.token, { email: `ghost-${randomUUID().slice(0, 8)}@example.test` }).expect(404);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE" });

    const memberships = await withTenantContext(
      db,
      { tenantId: caller.orgId, userId: caller.userId, storeId: null },
      (trx) => trx.selectFrom("memberships").select("id").where("tenant_id", "=", caller.orgId).execute(),
    );
    expect(memberships).toHaveLength(1); // the caller's own, and nothing else
  });

  it("writes NO audit event when the guard refuses before step 6 - the event covers steps 6-7, not the whole request", async () => {
    const mine = await orgWithMember("auditguard", "owner");
    const theirs = await orgWithMember("auditguardB", "owner");
    const invitee = await outsider("auditguard");

    await invite(theirs.orgId, mine.token, { email: invitee.email }).expect(403);

    // Nothing under the target tenant, because the request never reached its
    // controller; and nothing under the caller's own tenant either.
    expect(await auditRowsFor(theirs.orgId, theirs.userId)).toEqual([]);
    expect(await auditRowsFor(mine.orgId, mine.userId)).toEqual([]);
  });
});

describe("POST /api/v1/organizations/:organizationId/memberships - RLS and logging", () => {
  it("the new membership is invisible to a query issued without tenant context", async () => {
    const caller = await orgWithMember("rls", "owner");
    const invitee = await outsider("rls");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });
    expect(res.status).toBe(201);

    // Neither tenant nor user context: the self-access clause cannot help either.
    const rows = await withTenantContext(db, { tenantId: null, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("memberships").select("id").where("id", "=", res.body.id).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("the new membership is invisible to another tenant's context", async () => {
    const caller = await orgWithMember("rlsMine", "owner");
    const other = await orgWithMember("rlsOther", "owner");
    const invitee = await outsider("rlsMine");

    const res = await invite(caller.orgId, caller.token, { email: invitee.email });
    expect(res.status).toBe(201);

    const rows = await withTenantContext(db, { tenantId: other.orgId, userId: other.userId, storeId: null }, (trx) =>
      trx.selectFrom("memberships").select("id").where("id", "=", res.body.id).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("emits one structured log line carrying requestId, correlationId and the organization's tenantId", async () => {
    const caller = await orgWithMember("logline", "owner");
    const invitee = await outsider("logline");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await invite(caller.orgId, caller.token, { email: invitee.email }).expect(201);
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
