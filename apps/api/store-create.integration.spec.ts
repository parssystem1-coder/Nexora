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
 * `POST /api/v1/stores` end to end, against real PostgreSQL with real RLS,
 * through the same middleware stack main.ts ships (create-app.ts).
 *
 * Unlike every prior slice, `organizationId` arrives in the BODY, not the
 * path (05_API_CAPABILITY_CONTRACTS.md §6.1 - see DECISION_LOG.md), so this
 * suite pins that shape directly. It is also the first slice whose happy
 * path proves an end-to-end property spanning TWO capabilities: the
 * creator can immediately `store.read` the store they just made, which is
 * the single best evidence that the store_membership row this slice writes
 * is both necessary and correct (08_PHASE_1_BRIEF.md §5: organization
 * membership alone does not grant store access).
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

function createStore(token: string | undefined, body: Record<string, unknown>) {
  const req = request(app.getHttpServer()).post("/api/v1/stores");
  if (token) req.set("Cookie", `sid=${token}`);
  return req.send(body);
}

function readStore(storeId: string, token: string | undefined) {
  const req = request(app.getHttpServer()).get(`/api/v1/stores/${storeId}`);
  if (token) req.set("Cookie", `sid=${token}`);
  return req;
}

function auditRowsFor(tenantId: string, userId: string) {
  return withTenantContext(db, { tenantId, userId, storeId: null }, (trx) =>
    trx
      .selectFrom("audit_events")
      .select(["capability", "outcome", "resource_type", "resource_id", "metadata"])
      .where("tenant_id", "=", tenantId)
      .where("capability", "=", "store.create")
      .execute(),
  );
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the store.create integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/stores - happy path", () => {
  it("creates the store and returns 201 with the documented DTO, organizationId in the BODY per 05 §6.1", async () => {
    const caller = await orgWithMember("happy", "owner");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Main Store",
      slug: `main-${caller.suffix}`,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      organizationId: caller.orgId,
      name: "Main Store",
      slug: `main-${caller.suffix}`,
      status: "ACTIVE",
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lets the creator immediately store.read the store they just created - proof that store_membership was written correctly", async () => {
    const caller = await orgWithMember("readback", "owner");

    const created = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Readback Store",
      slug: `readback-${caller.suffix}`,
    });
    expect(created.status).toBe(201);

    const read = await readStore(created.body.id, caller.token);

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({
      id: created.body.id,
      organizationId: caller.orgId,
      slug: `readback-${caller.suffix}`,
    });
  });

  it("accepts an admin as well as an owner", async () => {
    const caller = await orgWithMember("admin", "admin");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Admin Store",
      slug: `admin-${caller.suffix}`,
    });

    expect(res.status).toBe(201);
  });

  it("the SAME slug succeeds in a DIFFERENT organization - uniqueness is per-tenant, not global (04 §5)", async () => {
    const first = await orgWithMember("scopeA", "owner");
    const second = await orgWithMember("scopeB", "owner");
    const sharedSlug = `shop-${first.suffix}`;

    const firstRes = await createStore(first.token, { organizationId: first.orgId, name: "Shop", slug: sharedSlug });
    const secondRes = await createStore(second.token, { organizationId: second.orgId, name: "Shop", slug: sharedSlug });

    expect(firstRes.status).toBe(201);
    expect(secondRes.status).toBe(201);
    expect(firstRes.body.id).not.toBe(secondRes.body.id);
  });
});

describe("POST /api/v1/stores - denial and failure paths", () => {
  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const caller = await orgWithMember("noauth", "owner");

    const res = await createStore(undefined, {
      organizationId: caller.orgId,
      name: "No Auth",
      slug: `noauth-${caller.suffix}`,
    });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns FORBIDDEN when the caller is not a member of the named organization", async () => {
    const mine = await orgWithMember("crossA", "owner");
    const theirs = await orgWithMember("crossB", "owner");

    const res = await createStore(mine.token, {
      organizationId: theirs.orgId,
      name: "Cross",
      slug: `cross-${mine.suffix}`,
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN for a plain MEMBER caller - store.create is owner+admin, not member", async () => {
    const caller = await orgWithMember("memberonly", "member");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Member Store",
      slug: `member-${caller.suffix}`,
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("returns VALIDATION_ERROR for a malformed organizationId", async () => {
    const caller = await orgWithMember("badorg", "owner");

    const res = await createStore(caller.token, {
      organizationId: "not-a-uuid",
      name: "Bad Org",
      slug: `badorg-${caller.suffix}`,
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a slug shorter than three characters", async () => {
    const caller = await orgWithMember("invalidshort", "owner");
    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "Short", slug: "ab" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a slug with an underscore", async () => {
    const caller = await orgWithMember("invalidunderscore", "owner");
    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "Underscore", slug: "bad_slug" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a slug with a leading hyphen", async () => {
    const caller = await orgWithMember("invalidleading", "owner");
    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "Leading", slug: "-leading" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for an empty name", async () => {
    const caller = await orgWithMember("invalidname", "owner");
    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "   ", slug: "empty-name" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a missing slug", async () => {
    const caller = await orgWithMember("invalidnoslug", "owner");
    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "No Slug" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns VALIDATION_ERROR for a missing organizationId - it does not fall back to anything, since no path segment carries it either", async () => {
    const caller = await orgWithMember("invalidnoorg", "owner");
    const res = await createStore(caller.token, { name: "No Org", slug: "no-org" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it.each(["www", "api", "admin", "status"])("returns DOMAIN_RESERVED for the reserved slug %s", async (reserved) => {
    const caller = await orgWithMember("reserved", "owner");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Reserved Attempt",
      slug: reserved,
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DOMAIN_RESERVED");
  });

  it("rejects a reserved slug even when supplied with different case/whitespace - the check runs after normalization", async () => {
    const caller = await orgWithMember("reservedcase", "owner");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Reserved Case",
      slug: "  ADMIN  ",
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DOMAIN_RESERVED");
  });

  it("returns CONFLICT for a slug already taken within the SAME organization", async () => {
    const caller = await orgWithMember("dup", "owner");
    const slug = `dup-${caller.suffix}`;
    await createStore(caller.token, { organizationId: caller.orgId, name: "First", slug }).expect(201);

    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "Second", slug });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

describe("POST /api/v1/stores - audit (ADR-034)", () => {
  it("records one SUCCESS event carrying the slug in metadata", async () => {
    const caller = await orgWithMember("auditok", "owner");
    const slug = `auditok-${caller.suffix}`;

    const res = await createStore(caller.token, { organizationId: caller.orgId, name: "Audited", slug });
    expect(res.status).toBe(201);

    const events = await auditRowsFor(caller.orgId, caller.userId);

    expect(events).toEqual([
      {
        capability: "store.create",
        outcome: "SUCCESS",
        resource_type: "store",
        resource_id: res.body.id,
        metadata: { slug },
      },
    ]);
  });

  it("records a FAILURE event when the permission check refuses the caller", async () => {
    const caller = await orgWithMember("auditperm", "member");

    await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "No Perm",
      slug: `auditperm-${caller.suffix}`,
    }).expect(403);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", resource_type: "store" });
  });

  it("records a FAILURE event for a reserved slug, and creates no store", async () => {
    const caller = await orgWithMember("auditreserved", "owner");

    await createStore(caller.token, { organizationId: caller.orgId, name: "Reserved", slug: "www" }).expect(409);

    const events = await auditRowsFor(caller.orgId, caller.userId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ outcome: "FAILURE", metadata: { slug: "www" } });

    const stores = await withTenantContext(
      db,
      { tenantId: caller.orgId, userId: caller.userId, storeId: null },
      (trx) => trx.selectFrom("stores").select("id").where("tenant_id", "=", caller.orgId).execute(),
    );
    expect(stores).toEqual([]);
  });

  it("writes NO audit event when the guard refuses before step 6 - the event covers steps 6-7, not the whole request", async () => {
    const mine = await orgWithMember("auditguard", "owner");
    const theirs = await orgWithMember("auditguardB", "owner");

    await createStore(mine.token, {
      organizationId: theirs.orgId,
      name: "Cross",
      slug: `auditguard-${mine.suffix}`,
    }).expect(403);

    expect(await auditRowsFor(theirs.orgId, theirs.userId)).toEqual([]);
    expect(await auditRowsFor(mine.orgId, mine.userId)).toEqual([]);
  });
});

describe("POST /api/v1/stores - RLS and logging", () => {
  it("the new store is invisible to a query issued without tenant context", async () => {
    const caller = await orgWithMember("rls", "owner");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Hidden",
      slug: `hidden-${caller.suffix}`,
    });
    expect(res.status).toBe(201);

    const rows = await withTenantContext(db, { tenantId: null, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("stores").select("id").where("id", "=", res.body.id).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("the new store is invisible to another tenant's context", async () => {
    const caller = await orgWithMember("rlsMine", "owner");
    const other = await orgWithMember("rlsOther", "owner");

    const res = await createStore(caller.token, {
      organizationId: caller.orgId,
      name: "Mine",
      slug: `mine-${caller.suffix}`,
    });
    expect(res.status).toBe(201);

    const rows = await withTenantContext(db, { tenantId: other.orgId, userId: other.userId, storeId: null }, (trx) =>
      trx.selectFrom("stores").select("id").where("id", "=", res.body.id).execute(),
    );
    expect(rows).toEqual([]);
  });

  it("emits one structured log line carrying requestId, correlationId and the organization's tenantId", async () => {
    const caller = await orgWithMember("logline", "owner");

    const captured: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      await createStore(caller.token, {
        organizationId: caller.orgId,
        name: "Logged",
        slug: `logged-${caller.suffix}`,
      }).expect(201);
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
    expect(entries[0]).toMatchObject({ tenantId: caller.orgId, status: 201, method: "POST", path: "/api/v1/stores" });
    expect(entries[0]!["requestId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
