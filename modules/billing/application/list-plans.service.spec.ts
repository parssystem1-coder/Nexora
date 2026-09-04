import { describe, it, expect } from "vitest";
import { ListPlansService } from "./list-plans.service.js";
import { Plan, PlanVersion } from "../domain/plan.entity.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { encodeCursor } from "../../../platform/pagination/cursor.js";
import type { Clock } from "../../../platform/clock.js";
import type { ListPlansQuery, PlanPage, PlanRepository } from "../domain/plan.repository.js";

const FIXED_NOW = new Date("2026-09-05T00:00:00.000Z");
const clock: Clock = { now: () => FIXED_NOW };

class FakePlanRepository implements PlanRepository {
  public lastQuery: ListPlansQuery | undefined;

  constructor(private readonly page: PlanPage) {}

  async listByKey(query: ListPlansQuery): Promise<PlanPage> {
    this.lastQuery = query;
    return this.page;
  }
}

function plan(key: string, trialPeriodDays = 0, featureKeys: string[] = []): Plan {
  return new Plan(
    `id-${key}`,
    key,
    new PlanVersion(`version-${key}`, 1, trialPeriodDays, new Date("2026-01-01T00:00:00.000Z")),
    featureKeys,
  );
}

/**
 * Use-case orchestration, per `AGENTS.md` §8. The rules proved here are
 * ADR-036's response shape and cursor handling, and ADR-052's trial column
 * reaching the DTO — all of which live in this service, not in the database.
 */
describe("ListPlansService", () => {
  it("returns ADR-036's shape with a null nextCursor when the whole collection fits in one page", async () => {
    const repo = new FakePlanRepository({ plans: [plan("standard"), plan("trial", 14)], hasMore: false });

    const result = await new ListPlansService(repo, clock).execute({ limit: 50 });

    expect(result.nextCursor).toBeNull();
    expect(result.items.map((i) => i.key)).toEqual(["standard", "trial"]);
    // ADR-036 item 3: no total count is returned.
    expect(result).not.toHaveProperty("total");
  });

  it("issues a cursor naming the last item of the page when more rows exist", async () => {
    const repo = new FakePlanRepository({ plans: [plan("a"), plan("b")], hasMore: true });

    const result = await new ListPlansService(repo, clock).execute({ limit: 2 });

    expect(result.nextCursor).not.toBeNull();
    // Feeding it back seeks strictly past the last key delivered.
    const second = new FakePlanRepository({ plans: [], hasMore: false });
    await new ListPlansService(second, clock).execute({ limit: 2, cursor: result.nextCursor! });
    expect(second.lastQuery?.afterKey).toBe("b");
  });

  it("passes the injected clock's time as asOf rather than reading the wall clock", async () => {
    const repo = new FakePlanRepository({ plans: [], hasMore: false });

    await new ListPlansService(repo, clock).execute({ limit: 50 });

    expect(repo.lastQuery?.asOf).toEqual(FIXED_NOW);
  });

  it("carries ADR-052's trial duration through to the DTO, with 0 for a version offering none", async () => {
    const repo = new FakePlanRepository({ plans: [plan("standard", 0), plan("trial", 14)], hasMore: false });

    const result = await new ListPlansService(repo, clock).execute({ limit: 50 });

    expect(result.items.map((i) => i.trialPeriodDays)).toEqual([0, 14]);
  });

  it("returns the feature keys a plan version grants", async () => {
    const repo = new FakePlanRepository({
      plans: [plan("standard", 0, ["billing.all_payment_gateways", "storefront.attribution_free"])],
      hasMore: false,
    });

    const result = await new ListPlansService(repo, clock).execute({ limit: 50 });

    expect(result.items[0]?.featureKeys).toEqual(["billing.all_payment_gateways", "storefront.attribution_free"]);
  });

  it("raises ADR-036 item 8's VALIDATION_ERROR for a malformed cursor", async () => {
    const repo = new FakePlanRepository({ plans: [], hasMore: false });

    await expect(
      new ListPlansService(repo, clock).execute({ limit: 50, cursor: "!!!not-a-cursor!!!" }),
    ).rejects.toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });

  it("raises VALIDATION_ERROR for a well-formed cursor issued to a different capability", async () => {
    const repo = new FakePlanRepository({ plans: [], hasMore: false });
    const foreign = encodeCursor({ capabilityId: "invoice.list", sortOrder: "key:asc", sortKey: "x" });

    const error = await new ListPlansService(repo, clock)
      .execute({ limit: 50, cursor: foreign })
      .then(() => null)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(CapabilityError);
    expect((error as CapabilityError).code).toBe("VALIDATION_ERROR");
  });

  it("does not seek past anything when no cursor is supplied", async () => {
    const repo = new FakePlanRepository({ plans: [], hasMore: false });

    await new ListPlansService(repo, clock).execute({ limit: 50 });

    expect(repo.lastQuery?.afterKey).toBeUndefined();
  });
});
