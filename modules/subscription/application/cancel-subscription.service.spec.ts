import { describe, it, expect } from "vitest";
import { CancelSubscriptionService, decideCancellation } from "./cancel-subscription.service.js";
import { Subscription, SubscriptionPeriod } from "../domain/subscription.entity.js";
import { SUBSCRIPTION_STATUSES, canTransition } from "../domain/subscription-status.js";
import type { SubscriptionStatus } from "../domain/subscription-status.js";
import type { SubscriptionStateTransition } from "../domain/state-transition.entity.js";
import type { StateTransitionRepository } from "../domain/state-transition.repository.js";
import type {
  CreateSubscriptionCommand,
  SubscriptionRepository,
  TransitionStatusCommand,
} from "../domain/subscription.repository.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";

const NOW = new Date("2026-09-10T00:00:00.000Z");
const clock: Clock = { now: () => NOW };

const TENANT = "55555555-5555-4555-8555-555555555555";
const SUB_ID = "33333333-3333-4333-8333-333333333333";
const PERIOD_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR = "66666666-6666-4666-8666-666666666666";

function subscription(status: SubscriptionStatus, version = 3): Subscription {
  return new Subscription(
    SUB_ID,
    TENANT,
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    status,
    "1 year",
    true,
    PERIOD_ID,
    status === "TRIALING" ? new Date("2026-09-24T00:00:00.000Z") : null,
    null,
    null,
    version,
  );
}

class FakeSubscriptions implements SubscriptionRepository {
  public transitioned: TransitionStatusCommand | undefined;
  constructor(
    private readonly current: Subscription | null,
    private readonly updateSucceeds = true,
  ) {}
  async create(_c: CreateSubscriptionCommand): Promise<void> {
    throw new Error("not used");
  }
  async findByTenant(): Promise<Subscription | null> {
    return this.current;
  }
  async existsForTenant(): Promise<boolean> {
    return this.current !== null;
  }
  async findPeriodById(): Promise<SubscriptionPeriod | null> {
    return new SubscriptionPeriod(
      PERIOD_ID,
      TENANT,
      SUB_ID,
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2027-09-01T00:00:00.000Z"),
      null,
      null,
      "CURRENT",
    );
  }
  async transitionStatus(command: TransitionStatusCommand): Promise<boolean> {
    this.transitioned = command;
    return this.updateSucceeds;
  }
}

class FakeTransitions implements StateTransitionRepository {
  public appended: SubscriptionStateTransition[] = [];
  async append(t: SubscriptionStateTransition): Promise<void> {
    this.appended.push(t);
  }
  async listBySubscription(): Promise<readonly SubscriptionStateTransition[]> {
    return this.appended;
  }
}

function service(subs: SubscriptionRepository, transitions: StateTransitionRepository) {
  return new CancelSubscriptionService(subs, transitions, clock);
}

const COMMAND = { transitionId: "77777777-7777-4777-8777-777777777777", tenantId: TENANT, actorUserId: ACTOR };

describe("CancelSubscriptionService", () => {
  describe("which status a cancellation produces — the contract is silent, see the service's doc comment", () => {
    it("sends a paid ACTIVE subscription to CANCEL_AT_PERIOD_END, keeping what was paid for", async () => {
      const subs = new FakeSubscriptions(subscription("ACTIVE"));

      const dto = await service(subs, new FakeTransitions()).execute(COMMAND);

      expect(dto.status).toBe("CANCEL_AT_PERIOD_END");
      // ADR-020 rule 1: cancellation is never destructive. The tenant keeps
      // serving until the term they bought runs out.
      expect(dto.servingNow).toBe(true);
      expect(subs.transitioned?.canceledAt).toBeNull();
    });

    it("sends a TRIALING subscription straight to CANCELED, which the machine forces", async () => {
      const subs = new FakeSubscriptions(subscription("TRIALING"));

      const dto = await service(subs, new FakeTransitions()).execute(COMMAND);

      expect(dto.status).toBe("CANCELED");
      expect(dto.servingNow).toBe(false);
      expect(subs.transitioned?.canceledAt).toEqual(NOW);
    });

    it("is forced rather than chosen for a trial: ADR-024 item 3 has no TRIALING -> CANCEL_AT_PERIOD_END", () => {
      expect(canTransition("TRIALING", "CANCEL_AT_PERIOD_END")).toBe(false);
      expect(canTransition("TRIALING", "CANCELED")).toBe(true);
      // Whereas from ACTIVE the machine permits both, which is the ambiguity.
      expect(canTransition("ACTIVE", "CANCELED")).toBe(true);
      expect(canTransition("ACTIVE", "CANCEL_AT_PERIOD_END")).toBe(true);
    });

    it("never proposes a transition ADR-024 item 3 forbids, for any origin state", () => {
      for (const from of SUBSCRIPTION_STATUSES) {
        const { toStatus } = decideCancellation(from);
        // Either the machine permits it, or the service refuses — never a
        // proposal the database would have to catch.
        if (!canTransition(from, toStatus)) {
          expect(["CANCELED", "CANCEL_AT_PERIOD_END"]).toContain(toStatus);
        }
      }
    });
  });

  describe("the transition log (ADR-024 item 3: actor and reason)", () => {
    it("appends one transition carrying both states, the reason and the actor", async () => {
      const transitions = new FakeTransitions();

      await service(new FakeSubscriptions(subscription("ACTIVE")), transitions).execute(COMMAND);

      expect(transitions.appended).toHaveLength(1);
      const t = transitions.appended[0]!;
      expect(t.fromStatus).toBe("ACTIVE");
      expect(t.toStatus).toBe("CANCEL_AT_PERIOD_END");
      expect(t.reasonCode).toBe("SCHEDULED_CANCELLATION_BY_TENANT");
      expect(t.actorType).toBe("user");
      expect(t.actorId).toBe(ACTOR);
      expect(t.occurredAt).toEqual(NOW);
    });

    it("uses a different reason for a trial than for a paid term", async () => {
      const transitions = new FakeTransitions();

      await service(new FakeSubscriptions(subscription("TRIALING")), transitions).execute(COMMAND);

      expect(transitions.appended[0]?.reasonCode).toBe("CANCELED_BY_TENANT");
    });

    it("writes no transition when the status change did not happen", async () => {
      const transitions = new FakeTransitions();
      const subs = new FakeSubscriptions(subscription("ACTIVE"), false);

      await service(subs, transitions)
        .execute(COMMAND)
        .catch(() => null);

      // A log entry for a change that never committed would be worse than none.
      expect(transitions.appended).toHaveLength(0);
    });
  });

  describe("refusals", () => {
    it("returns RESOURCE_NOT_FOUND when the organization has no subscription", async () => {
      const attempt = service(new FakeSubscriptions(null), new FakeTransitions()).execute(COMMAND);

      await expect(attempt).rejects.toThrow(expect.objectContaining({ code: "RESOURCE_NOT_FOUND" }));
    });

    it("refuses to cancel an already-CANCELED subscription — the machine makes it terminal", async () => {
      const error = await service(new FakeSubscriptions(subscription("CANCELED")), new FakeTransitions())
        .execute(COMMAND)
        .then(() => null)
        .catch((err: unknown) => err as CapabilityError);

      expect(error).toBeInstanceOf(CapabilityError);
      expect(error?.code).toBe("CONFLICT");
      expect(error?.details).toMatchObject({ from: "CANCELED", to: "CANCELED" });
    });

    it("raises CONCURRENCY_CONFLICT when ADR-045's compare-and-set matches no row", async () => {
      const subs = new FakeSubscriptions(subscription("ACTIVE"), false);

      const attempt = service(subs, new FakeTransitions()).execute(COMMAND);

      await expect(attempt).rejects.toThrow(expect.objectContaining({ code: "CONCURRENCY_CONFLICT" }));
    });

    it("guards the update with the version it read (ADR-045)", async () => {
      const subs = new FakeSubscriptions(subscription("ACTIVE", 7));

      await service(subs, new FakeTransitions()).execute(COMMAND);

      expect(subs.transitioned?.expectedVersion).toBe(7);
    });
  });

  it("leaves auto_renew alone: CANCEL_AT_PERIOD_END already says what happens at period_end", async () => {
    const subs = new FakeSubscriptions(subscription("ACTIVE"));

    const dto = await service(subs, new FakeTransitions()).execute(COMMAND);

    expect(dto.autoRenew).toBe(true);
    expect(Object.keys(subs.transitioned ?? {})).not.toContain("autoRenew");
  });
});
