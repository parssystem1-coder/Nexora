import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { createTestApp } from "./test-support/create-test-app.js";
import { createDb } from "../../platform/db/kysely.js";
import { loadDbConfig } from "../../platform/config.js";
import { describeDbError } from "../../platform/db/describe-error.js";
import { withTenantContext } from "../../platform/db/tenant-context.js";
import { seedUser, seedSession, seedOrganization, seedMembership, grantRole } from "./test-support/seed.js";
import "../../modules/subscription/infrastructure/subscription.tables.js";

/**
 * Phase 2 item 5's proof: the append-only transition log, `subscription.cancel`,
 * and the two properties that must be shown live rather than asserted — the
 * `REVOKE` and RLS.
 */
let app: INestApplication;
const db = createDb(loadDbConfig());

const STANDARD_PLAN_VERSION = "1a2b3c4d-0000-4000-8000-000000000002";

async function tenantFixture(label: string, role = "owner") {
  const suffix = randomUUID().slice(0, 8);
  const userId = await seedUser(db, `${label}-${suffix}@example.test`);
  const orgId = await seedOrganization(db, `${label} Org`, `${label}-${suffix}`);
  const membershipId = await seedMembership(db, orgId, userId, "ACTIVE");
  await grantRole(db, orgId, membershipId, role);
  const token = await seedSession(db, userId, { activeOrganizationId: orgId });
  return { userId, orgId, membershipId, token };
}

function subscribe(orgId: string, token: string) {
  return request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgId}/subscription`)
    .set("Cookie", `sid=${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ planVersionId: STANDARD_PLAN_VERSION, termMonths: 12 });
}

function cancel(orgId: string, token: string, key = randomUUID()) {
  return request(app.getHttpServer())
    .post(`/api/v1/organizations/${orgId}/subscription/cancel`)
    .set("Cookie", `sid=${token}`)
    .set("Idempotency-Key", key)
    .send();
}

/**
 * Moves a subscription to `ACTIVE`, which no capability can do yet: item 12's
 * `billing.payment.verify` is what will, and ADR-052's 2026-09-09 amendment
 * makes a verified payment the only other entry into the machine.
 *
 * **Inside `withTenantContext`, and the first version of this helper was not.**
 * Without it the `UPDATE` matched zero rows and silently did nothing — RLS
 * failing closed exactly as designed — and the test failed one assertion later
 * with a confusing message. Left as a note because the same mistake in
 * production code would be a silent no-op rather than a loud error.
 */
async function forceActive(tenantId: string, subscriptionId: string): Promise<void> {
  await withTenantContext(db, { tenantId, userId: null, storeId: null }, async (trx) => {
    const result = await trx
      .updateTable("subscriptions")
      .set({ status: "ACTIVE", trial_end: null })
      .where("id", "=", subscriptionId)
      .executeTakeFirst();
    // Prove the row actually moved, rather than trusting a silent no-op.
    if ((result.numUpdatedRows ?? 0n) !== 1n) {
      throw new Error(`forceActive updated ${result.numUpdatedRows} rows for ${subscriptionId}`);
    }
  });
}

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the cancel integration test. ${describeDbError(err)}`, {
      cause: err,
    });
  }
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("POST .../subscription/cancel", () => {
  it("cancels a trial outright and stops serving immediately", async () => {
    const tenant = await tenantFixture("cancel-trial");
    await subscribe(tenant.orgId, tenant.token);

    const res = await cancel(tenant.orgId, tenant.token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELED");
    expect(res.body.servingNow).toBe(false);
  });

  it("schedules a paid cancellation at period end, and keeps serving until then", async () => {
    const tenant = await tenantFixture("cancel-paid");
    const created = await subscribe(tenant.orgId, tenant.token);
    await forceActive(tenant.orgId, created.body.id);

    const res = await cancel(tenant.orgId, tenant.token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCEL_AT_PERIOD_END");
    // ADR-020 rule 1: cancellation is never destructive.
    expect(res.body.servingNow).toBe(true);
  });

  it("writes one transition carrying both states, the reason and the actor (ADR-024 item 3)", async () => {
    const tenant = await tenantFixture("cancel-log");
    const created = await subscribe(tenant.orgId, tenant.token);

    await cancel(tenant.orgId, tenant.token);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("subscription_state_transitions")
        .selectAll()
        .where("subscription_id", "=", created.body.id)
        .execute(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.from_status).toBe("TRIALING");
    expect(rows[0]?.to_status).toBe("CANCELED");
    expect(rows[0]?.reason_code).toBe("CANCELED_BY_TENANT");
    expect(rows[0]?.actor_type).toBe("user");
    expect(rows[0]?.actor_id).toBe(tenant.userId);
    expect(rows[0]?.occurred_at).toBeInstanceOf(Date);
  });

  it("bumps ADR-045's version, so a stale writer would be rejected", async () => {
    const tenant = await tenantFixture("cancel-version");
    const created = await subscribe(tenant.orgId, tenant.token);

    await cancel(tenant.orgId, tenant.token);

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscriptions").select("version").where("id", "=", created.body.id).execute(),
    );
    expect(rows[0]?.version).toBe(1);
  });

  it("refuses a second cancellation — CANCELED is terminal in ADR-024 item 3", async () => {
    const tenant = await tenantFixture("cancel-twice");
    await subscribe(tenant.orgId, tenant.token);
    await cancel(tenant.orgId, tenant.token);

    const res = await cancel(tenant.orgId, tenant.token);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("replays under one idempotency key rather than attempting an illegal second transition", async () => {
    const tenant = await tenantFixture("cancel-replay");
    const created = await subscribe(tenant.orgId, tenant.token);
    const key = randomUUID();

    const first = await cancel(tenant.orgId, tenant.token, key);
    const second = await cancel(tenant.orgId, tenant.token, key);

    expect(first.status).toBe(200);
    // Without the wrapper this second call would hit the machine and 409.
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("CANCELED");

    const rows = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("subscription_state_transitions")
        .select("id")
        .where("subscription_id", "=", created.body.id)
        .execute(),
    );
    expect(rows).toHaveLength(1);
  });

  it("returns RESOURCE_NOT_FOUND when there is no subscription", async () => {
    const tenant = await tenantFixture("cancel-none");

    const res = await cancel(tenant.orgId, tenant.token);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("refuses a plain member (owner and admin only, D2-8)", async () => {
    const tenant = await tenantFixture("cancel-member", "member");

    const res = await cancel(tenant.orgId, tenant.token);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("requires an Idempotency-Key", async () => {
    const tenant = await tenantFixture("cancel-nokey");

    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${tenant.orgId}/subscription/cancel`)
      .set("Cookie", `sid=${tenant.token}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("requires a session", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${randomUUID()}/subscription/cancel`)
      .set("Idempotency-Key", randomUUID())
      .send();

    expect(res.status).toBe(401);
  });
});

describe("subscription_state_transitions is append-only for the application role", () => {
  // `AGENTS.md` §8: a destructive statement written to prove it is denied must
  // still be harmless if it is ever allowed. Both target an id matching nothing
  // — PostgreSQL checks table privileges at plan time, so the assertion holds
  // and the blast radius is zero.
  const NO_SUCH_ROW = "00000000-0000-4000-8000-0000000000fd";

  it("denies UPDATE to nexora_app", async () => {
    await expect(
      sql`UPDATE subscription_state_transitions SET reason_code = 'PLAN_CHANGED' WHERE id = ${NO_SUCH_ROW}`.execute(db),
    ).rejects.toThrow(/permission denied/i);
  });

  it("denies DELETE to nexora_app", async () => {
    await expect(sql`DELETE FROM subscription_state_transitions WHERE id = ${NO_SUCH_ROW}`.execute(db)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("still permits INSERT, because appending is the whole point", async () => {
    const tenant = await tenantFixture("append-ok");
    const created = await subscribe(tenant.orgId, tenant.token);

    const inserted = await withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("subscription_state_transitions")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          subscription_id: created.body.id,
          from_status: "TRIALING",
          to_status: "ACTIVE",
          reason_code: "PAYMENT_VERIFIED",
          actor_type: "system",
          actor_id: null,
          occurred_at: new Date().toISOString(),
        })
        .returning("id")
        .execute(),
    );

    expect(inserted).toHaveLength(1);
  });

  it("rejects a reason outside the ruled vocabulary", async () => {
    const tenant = await tenantFixture("append-badreason");
    const created = await subscribe(tenant.orgId, tenant.token);

    const attempt = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("subscription_state_transitions")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          subscription_id: created.body.id,
          from_status: "TRIALING",
          to_status: "ACTIVE",
          reason_code: "because_i_said_so",
          actor_type: "system",
          actor_id: null,
          occurred_at: new Date().toISOString(),
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/subscription_state_transitions_reason_code_check/);
  });

  it("rejects a transition that does not actually transition", async () => {
    const tenant = await tenantFixture("append-samestate");
    const created = await subscribe(tenant.orgId, tenant.token);

    const attempt = withTenantContext(db, { tenantId: tenant.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("subscription_state_transitions")
        .values({
          id: randomUUID(),
          tenant_id: tenant.orgId,
          subscription_id: created.body.id,
          from_status: "ACTIVE",
          to_status: "ACTIVE",
          reason_code: "PLAN_CHANGED",
          actor_type: "system",
          actor_id: null,
          occurred_at: new Date().toISOString(),
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/subscription_state_transitions_actually_transitions/);
  });
});

describe("RLS on the transition log, live as nexora_app with a positive control", () => {
  it("shows a tenant its own transitions and hides another tenant's, in the same test", async () => {
    const a = await tenantFixture("tlog-a");
    const b = await tenantFixture("tlog-b");
    const created = await subscribe(a.orgId, a.token);
    await cancel(a.orgId, a.token);

    const asOwner = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("subscription_state_transitions")
        .select("id")
        .where("subscription_id", "=", created.body.id)
        .execute(),
    );
    const asStranger = await withTenantContext(db, { tenantId: b.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .selectFrom("subscription_state_transitions")
        .select("id")
        .where("subscription_id", "=", created.body.id)
        .execute(),
    );

    // The positive control is the point: without it, "zero rows" could mean the
    // row does not exist rather than that the policy hid it.
    expect(asOwner).toHaveLength(1);
    expect(asStranger).toHaveLength(0);
  });

  it("returns zero rows with no tenant context, rather than everything", async () => {
    const a = await tenantFixture("tlog-nocontext");
    await subscribe(a.orgId, a.token);
    await cancel(a.orgId, a.token);

    const withContext = await withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx.selectFrom("subscription_state_transitions").select("id").execute(),
    );
    expect(withContext.length).toBeGreaterThan(0);

    const withoutContext = await db.selectFrom("subscription_state_transitions").select("id").execute();
    expect(withoutContext).toHaveLength(0);
  });

  it("refuses an INSERT attributed to another tenant", async () => {
    const a = await tenantFixture("tlog-insert-a");
    const b = await tenantFixture("tlog-insert-b");
    const created = await subscribe(a.orgId, a.token);

    const attempt = withTenantContext(db, { tenantId: a.orgId, userId: null, storeId: null }, async (trx) =>
      trx
        .insertInto("subscription_state_transitions")
        .values({
          id: randomUUID(),
          tenant_id: b.orgId,
          subscription_id: created.body.id,
          from_status: "TRIALING",
          to_status: "ACTIVE",
          reason_code: "PAYMENT_VERIFIED",
          actor_type: "system",
          actor_id: null,
          occurred_at: new Date().toISOString(),
        })
        .execute(),
    );

    await expect(attempt).rejects.toThrow(/row-level security/i);
  });
});
