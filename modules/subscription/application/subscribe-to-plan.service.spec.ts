import { describe, it, expect } from "vitest";
import { SubscribeToPlanService } from "./subscribe-to-plan.service.js";
import { TrialAlreadyUsedError } from "../domain/subscription.repository.js";
import type { CreateSubscriptionCommand, SubscriptionRepository } from "../domain/subscription.repository.js";
import type { Subscription, SubscriptionPeriod } from "../domain/subscription.entity.js";
import type { FindOfferingQuery, PlanOffering, PlanOfferingRepository } from "../../billing/contracts/index.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const clock: Clock = { now: () => NOW };

const TRIAL_OFFERING: PlanOffering = {
  planVersionId: "11111111-1111-4111-8111-111111111111",
  priceVersionId: "22222222-2222-4222-8222-222222222222",
  trialPeriodDays: 14,
  termLength: "1 year",
};

class FakeOfferings implements PlanOfferingRepository {
  public lastQuery: FindOfferingQuery | undefined;
  constructor(private readonly offering: PlanOffering | null) {}
  async findOffering(query: FindOfferingQuery): Promise<PlanOffering | null> {
    this.lastQuery = query;
    return this.offering;
  }
}

class FakeSubscriptions implements SubscriptionRepository {
  public created: CreateSubscriptionCommand | undefined;
  constructor(
    private readonly exists = false,
    private readonly throwOnCreate: Error | null = null,
  ) {}
  async create(command: CreateSubscriptionCommand): Promise<void> {
    if (this.throwOnCreate) throw this.throwOnCreate;
    this.created = command;
  }
  async findByTenant(): Promise<Subscription | null> {
    return null;
  }
  async existsForTenant(): Promise<boolean> {
    return this.exists;
  }
  async findPeriodById(): Promise<SubscriptionPeriod | null> {
    return null;
  }
}

const COMMAND = {
  subscriptionId: "33333333-3333-4333-8333-333333333333",
  periodId: "44444444-4444-4444-8444-444444444444",
  tenantId: "55555555-5555-4555-8555-555555555555",
  planVersionId: TRIAL_OFFERING.planVersionId,
  termMonths: 12,
};

function service(subs: SubscriptionRepository, offerings: PlanOfferingRepository) {
  return new SubscribeToPlanService(subs, offerings, clock);
}

/**
 * Use-case orchestration (`AGENTS.md` §8). What lives here rather than in the
 * database: which state a new subscription begins in, what the first period
 * covers, and which refusals happen before anything is written.
 */
describe("SubscribeToPlanService", () => {
  it("creates a TRIALING subscription on a plan version that offers a trial (ADR-052)", async () => {
    const subs = new FakeSubscriptions();

    const dto = await service(subs, new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    expect(dto.status).toBe("TRIALING");
    expect(dto.planVersionId).toBe(TRIAL_OFFERING.planVersionId);
    expect(dto.priceVersionId).toBe(TRIAL_OFFERING.priceVersionId);
    expect(dto.termLength).toBe("1 year");
    expect(subs.created?.subscription.status).toBe("TRIALING");
  });

  it("pins both versions on the subscription and on the first period (ADR-025 item 6, ADR-024 item 1)", async () => {
    const subs = new FakeSubscriptions();

    await service(subs, new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    for (const pinned of [subs.created!.subscription, subs.created!.firstPeriod]) {
      expect(pinned.planVersionId).toBe(TRIAL_OFFERING.planVersionId);
      expect(pinned.priceVersionId).toBe(TRIAL_OFFERING.priceVersionId);
    }
  });

  it("ends the trial exactly trial_period_days after now, from the injected clock", async () => {
    const subs = new FakeSubscriptions();

    const dto = await service(subs, new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    expect(dto.trialEndsAt).toBe(new Date("2026-09-24T00:00:00.000Z").toISOString());
    expect(subs.created?.firstPeriod.periodEnd.toISOString()).toBe(dto.trialEndsAt);
  });

  it("makes the first period CURRENT with no invoice, because a trial is not billed", async () => {
    const subs = new FakeSubscriptions();

    await service(subs, new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    expect(subs.created?.firstPeriod.status).toBe("CURRENT");
    expect(subs.created?.firstPeriod.invoiceId).toBeNull();
    expect(subs.created?.firstPeriod.graceEnd).toBeNull();
  });

  it("reports servingNow through ADR-024 item 2's function rather than a stored flag", async () => {
    const dto = await service(new FakeSubscriptions(), new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    expect(dto.servingNow).toBe(true);
  });

  it("carries no money: the amount is item 12's payment and item 13's invoice", async () => {
    const dto = await service(new FakeSubscriptions(), new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    // `priceVersionId` is a pinned identifier and must be here (ADR-025 item 6);
    // what must NOT be here is a monetary value. Asserting on the keys rather
    // than on the substring "price", which the id legitimately contains — the
    // first version of this test failed for exactly that reason.
    for (const forbidden of ["amount", "amountMinor", "currency", "minorUnits", "total", "price"]) {
      expect(Object.keys(dto)).not.toContain(forbidden);
    }
    expect(dto.priceVersionId).toBe(TRIAL_OFFERING.priceVersionId);
    expect(JSON.stringify(dto)).not.toContain("IRR");
  });

  it("resolves the offering as of the injected clock, so a future-dated version is not on offer", async () => {
    const offerings = new FakeOfferings(TRIAL_OFFERING);

    await service(new FakeSubscriptions(), offerings).execute(COMMAND);

    expect(offerings.lastQuery?.asOf).toEqual(NOW);
    expect(offerings.lastQuery?.termMonths).toBe(12);
  });

  it("refuses when no plan is on offer for that version and term", async () => {
    const attempt = service(new FakeSubscriptions(), new FakeOfferings(null)).execute(COMMAND);

    await expect(attempt).rejects.toThrow(expect.objectContaining({ code: "RESOURCE_NOT_FOUND" }));
  });

  it("refuses a second subscription for one organization", async () => {
    const attempt = service(new FakeSubscriptions(true), new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    await expect(attempt).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });

  /**
   * The one place this service does not follow ADR-052 item 2 literally, tested
   * so the deviation is visible rather than implicit. See the service's doc
   * comment and `decisions/2026-09.md` for the reasoning: an `ACTIVE`
   * subscription is a SERVING one, and creating one here would give a paid plan
   * away for free, because payment is item 12.
   */
  it("refuses a plan version that offers no trial, rather than granting a free ACTIVE subscription", async () => {
    const noTrial = new FakeOfferings({ ...TRIAL_OFFERING, trialPeriodDays: 0 });
    const subs = new FakeSubscriptions();

    const error = await service(subs, noTrial)
      .execute(COMMAND)
      .then(() => null)
      .catch((err: unknown) => err as CapabilityError);

    expect(error).toBeInstanceOf(CapabilityError);
    expect(error?.code).toBe("CONFLICT");
    expect(error?.details).toMatchObject({ reason: "PAYMENT_NOT_AVAILABLE" });
    // Nothing was written.
    expect(subs.created).toBeUndefined();
  });

  it("maps the one-trial-per-organization constraint to CONFLICT (ADR-052 item 3)", async () => {
    const subs = new FakeSubscriptions(false, new TrialAlreadyUsedError(COMMAND.tenantId));

    const attempt = service(subs, new FakeOfferings(TRIAL_OFFERING)).execute(COMMAND);

    await expect(attempt).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});
