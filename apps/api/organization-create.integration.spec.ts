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
import { seedUser, seedSession } from "./test-support/seed.js";

/**
 * `POST /api/v1/organizations` end to end, against real PostgreSQL with real
 * RLS, through the same middleware stack main.ts ships (create-app.ts).
 *
 * This is the first slice whose *domain transaction* can fail, so it is
 * where ADR-034's central claim becomes testable: a duplicate slug rolls the
 * transaction back, and the audit row must still be there afterwards
 * because it was written on a separate connection in its own transaction.
 * store.read could only ever fail before its transaction did any work.
 */

let app: INestApplication;
const db = createDb(loadDbConfig());

async function actor(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-${suffix}@example.test`);
  const token = await seedSession(db, userId);
  return { userId, token, suffix };
}

/**
 * Posts the payload and returns both the response and the single structured
 * log line loggingMiddleware emitted for it. The line is the only place the
 * tenant id of a *failed* attempt is observable, and pinning it here is also
 * what proves pipeline step 10 covers this route.
 */
async function postCapturingLog(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ response: request.Response; logLine: Record<string, unknown> }> {
  const captured: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    captured.push(String(args[0]));
  };

  let response: request.Response;
  try {
    response = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send(payload);
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
  return { response, logLine: entries[0]! };
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the organization.create integration test. Run "docker compose up -d". Original error: ${describeDbError(err)}`,
    );
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST /api/v1/organizations - happy path", () => {
  it("creates the organization and returns 201 with the documented DTO", async () => {
    const { token, suffix } = await actor("create");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send({ name: "Acme Trading", slug: `acme-${suffix}` });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Acme Trading",
      slug: `acme-${suffix}`,
      status: "ACTIVE",
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.createdAt).toMatch(/Z$/);
  });

  it("makes the creator an ACTIVE member holding the owner role, so the new organization is usable", async () => {
    const { userId, token, suffix } = await actor("owner");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send({ name: "Owner Co", slug: `owner-${suffix}` });
    expect(res.status).toBe(201);
    const orgId: string = res.body.id;

    const rows = await withTenantContext(db, { tenantId: orgId, userId, storeId: null }, (trx) =>
      trx
        .selectFrom("memberships")
        .innerJoin("membership_roles", "membership_roles.membership_id", "memberships.id")
        .innerJoin("roles", "roles.id", "membership_roles.role_id")
        .select(["memberships.status", "memberships.user_id", "roles.key"])
        .where("memberships.tenant_id", "=", orgId)
        .execute(),
    );

    expect(rows).toEqual([{ status: "ACTIVE", user_id: userId, key: "owner" }]);
  });

  it("normalizes the slug to lowercase and trims the name before storing them", async () => {
    const { token, suffix } = await actor("normalize");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send({ name: "  Spaced Name  ", slug: `MiXeD-${suffix}` });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe(`mixed-${suffix}`);
    expect(res.body.name).toBe("Spaced Name");
  });
});

describe("POST /api/v1/organizations - denial and failure paths", () => {
  it("returns AUTHENTICATION_REQUIRED with no session cookie", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .send({ name: "No Auth", slug: `noauth-${randomUUID().slice(0, 8)}` });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns AUTHENTICATION_REQUIRED for an expired session", async () => {
    const userId = await seedUser(db, `expired-${randomUUID().slice(0, 8)}@example.test`);
    const expiredToken = await seedSession(db, userId, { expired: true });

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${expiredToken}`)
      .send({ name: "Expired", slug: `expired-${randomUUID().slice(0, 8)}` });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it.each([
    ["a slug shorter than three characters", { name: "Short", slug: "ab" }],
    ["a slug with an underscore", { name: "Underscore", slug: "bad_slug" }],
    ["a slug with a leading hyphen", { name: "Leading", slug: "-leading" }],
    ["a slug with a trailing hyphen", { name: "Trailing", slug: "trailing-" }],
    ["an empty name", { name: "   ", slug: "empty-name" }],
    ["a missing slug", { name: "No Slug" }],
  ])("returns VALIDATION_ERROR for %s", async (_label, payload) => {
    const { token } = await actor("invalid");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns CONFLICT for a slug already taken by a different user's organization - the unique index sees the whole namespace even though RLS hides the row", async () => {
    const first = await actor("dupA");
    const slug = `shared-${first.suffix}`;

    const created = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${first.token}`)
      .send({ name: "First", slug });
    expect(created.status).toBe(201);

    const second = await actor("dupB");
    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${second.token}`)
      .send({ name: "Second", slug });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rolls the whole transaction back on a duplicate slug - no orphan membership is left behind", async () => {
    const first = await actor("rollbackA");
    const slug = `rollback-${first.suffix}`;
    await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${first.token}`)
      .send({ name: "First", slug })
      .expect(201);

    const second = await actor("rollbackB");
    await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${second.token}`)
      .send({ name: "Second", slug })
      .expect(409);

    // The failed attempt's user must hold no membership anywhere. Scoped by
    // user_id, which memberships' self-access policy permits without a tenant.
    const memberships = await withTenantContext(db, { tenantId: null, userId: second.userId, storeId: null }, (trx) =>
      trx.selectFrom("memberships").select("id").where("user_id", "=", second.userId).execute(),
    );
    expect(memberships).toEqual([]);
  });
});

describe("POST /api/v1/organizations - audit (ADR-034)", () => {
  it("durably records exactly one SUCCESS event for a created organization", async () => {
    const { userId, token, suffix } = await actor("auditok");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send({ name: "Audited", slug: `audited-${suffix}` });
    expect(res.status).toBe(201);
    const orgId: string = res.body.id;

    const events = await withTenantContext(db, { tenantId: orgId, userId, storeId: null }, (trx) =>
      trx
        .selectFrom("audit_events")
        .select(["capability", "outcome", "actor_user_id", "resource_type", "resource_id"])
        .where("tenant_id", "=", orgId)
        .execute(),
    );

    expect(events).toEqual([
      {
        capability: "organization.create",
        outcome: "SUCCESS",
        actor_user_id: userId,
        resource_type: "organization",
        resource_id: orgId,
      },
    ]);
  });

  it("keeps the FAILURE audit row after the domain transaction that failed was rolled back, and the organization is genuinely absent", async () => {
    const first = await actor("auditfailA");
    const slug = `auditfail-${first.suffix}`;
    await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${first.token}`)
      .send({ name: "First", slug })
      .expect(201);

    // The rolled-back attempt still minted a tenant id, and that id is what
    // its audit row is keyed to (audit_events' policy is tenant-only, with no
    // self-access clause). The caller never learns the id from a 409 body, so
    // recover it from the request's own structured log line - which is also
    // what step 10 requires the line to carry.
    const second = await actor("auditfailB");
    const { response, logLine } = await postCapturingLog(second.token, { name: "Second", slug });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("CONFLICT");
    const failedTenantId = logLine["tenantId"];
    expect(typeof failedTenantId).toBe("string");

    const events = await withTenantContext(
      db,
      { tenantId: failedTenantId as string, userId: second.userId, storeId: null },
      (trx) =>
        trx
          .selectFrom("audit_events")
          .select(["capability", "outcome", "resource_id"])
          .where("tenant_id", "=", failedTenantId as string)
          .execute(),
    );
    expect(events).toEqual([
      { capability: "organization.create", outcome: "FAILURE", resource_id: failedTenantId },
    ]);

    // ...and the domain effect really did roll back: nothing exists under
    // that tenant id, even from its own context.
    const organizations = await withTenantContext(
      db,
      { tenantId: failedTenantId as string, userId: second.userId, storeId: null },
      (trx) => trx.selectFrom("organizations").select("id").where("id", "=", failedTenantId as string).execute(),
    );
    expect(organizations).toEqual([]);
  });
});

describe("POST /api/v1/organizations - structured logging (08_PHASE_1_BRIEF.md §2 step 10)", () => {
  it("emits one log line carrying requestId, correlationId and the new organization's tenantId", async () => {
    const { token, suffix } = await actor("logline");

    const { response, logLine } = await postCapturingLog(token, { name: "Logged", slug: `logged-${suffix}` });

    expect(response.status).toBe(201);
    expect(logLine).toMatchObject({
      tenantId: response.body.id,
      status: 201,
      method: "POST",
      path: "/api/v1/organizations",
    });
    expect(logLine["requestId"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(logLine["correlationId"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("POST /api/v1/organizations - RLS (08_PHASE_1_BRIEF.md §6 exit criteria)", () => {
  it("the created organization is invisible to a query issued without tenant context", async () => {
    const { token, suffix } = await actor("rls");

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${token}`)
      .send({ name: "Hidden", slug: `hidden-${suffix}` })
      .expect(201);

    const rows = await withTenantContext(db, { tenantId: null, userId: null, storeId: null }, (trx) =>
      trx.selectFrom("organizations").select("id").where("id", "=", res.body.id).execute(),
    );

    expect(rows).toEqual([]);
  });

  it("the created organization is invisible to another tenant's context", async () => {
    const mine = await actor("rlsMine");
    const theirs = await actor("rlsTheirs");

    const created = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${mine.token}`)
      .send({ name: "Mine", slug: `mine-${mine.suffix}` })
      .expect(201);
    const other = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", `sid=${theirs.token}`)
      .send({ name: "Theirs", slug: `theirs-${theirs.suffix}` })
      .expect(201);

    const rows = await withTenantContext(db, { tenantId: other.body.id, userId: theirs.userId, storeId: null }, (trx) =>
      trx.selectFrom("organizations").select("id").where("id", "=", created.body.id).execute(),
    );

    expect(rows).toEqual([]);
  });
});
