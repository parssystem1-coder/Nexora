import { randomUUID } from "node:crypto";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { Clock } from "../../../platform/clock.js";
import { EntitlementConflictError, resolveEntitlement } from "../domain/resolve-entitlement.js";
import type { EntitlementGrant } from "../domain/resolve-entitlement.js";
import type { EntitlementRepository, EntitlementSourceRepository } from "../domain/entitlement.repository.js";
import type { ResolveEntitlementOutputDto } from "./resolve-entitlement.input.js";

export interface ResolveEntitlementCommand {
  tenantId: string;
  /** The plan version the tenant's subscription pins, or null when they have none. */
  planVersionId: string | null;
  featureKey?: string | undefined;
}

/**
 * `entitlement.resolve` — Phase 2 item 6.
 *
 * ## There is no cache, and that is ruled rather than deferred by omission
 *
 * `PHASE_2_BRIEF.md` §5: "**No cache in Phase 2 (D2-4). Resolve per request.**
 * This is a deferral with a condition, not an omission: revisit when a measured
 * p95 on `entitlement.resolve` exceeds a stated budget." The budget itself is
 * owed, and §5 says why none is invented — ADR-010's Admin API target is a
 * whole-request budget, not a per-resolution one.
 *
 * **ADR-008 permits a cache; it does not require one.** Its Consequence reads
 * "effective entitlement **may** be cached but must be invalidated on
 * subscription change, plan version migration, add-on change, override change
 * and term boundary crossing." With no cache those triggers are vacuous, which
 * is honest rather than unmet. **ADR-019's 2026-09-03 amendment bounds a cache
 * if one exists** — 60 seconds at the origin, whose "mechanism" column names
 * `subscription.deprovision` and whose ceiling is "the cache's own TTL" — and
 * resolving per request satisfies that bound trivially, because the staleness is
 * zero.
 *
 * So this service reads the database on every call, deliberately.
 *
 * ## What it writes, on a READ
 *
 * One `entitlement_sources` row per resolution: ADR-008's explainability record,
 * append-only. That makes a `READ` capability a writer, which is unusual enough
 * to state — but it is the same shape ADR-034 already gives every capability,
 * which writes one audit row per attempt. The two records are different: the
 * audit event says *a resolution was attempted*, this says *what was resolved
 * and from which rungs*.
 */
export class ResolveEntitlementService {
  constructor(
    private readonly entitlements: EntitlementRepository,
    private readonly sources: EntitlementSourceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ResolveEntitlementCommand): Promise<ResolveEntitlementOutputDto> {
    const evaluatedAt = this.clock.now();

    // A tenant with no subscription has no plan version, so the PLAN_VERSION
    // rung is empty and every feature falls to PLATFORM_DEFAULT — which denies.
    // That is correct rather than an edge case: entitlement follows the
    // subscription, and ADR-024 item 2's serving state is the other half of it.
    const planGrants = command.planVersionId ? await this.entitlements.listPlanEntitlements(command.planVersionId) : [];
    const overrides = await this.entitlements.listTenantOverrides(command.tenantId);

    const byFeature = new Map<string, EntitlementGrant[]>();
    const add = (featureKey: string, grant: EntitlementGrant) => {
      const existing = byFeature.get(featureKey);
      if (existing) existing.push(grant);
      else byFeature.set(featureKey, [grant]);
    };

    for (const plan of planGrants) {
      add(plan.featureKey, { source: "PLAN_VERSION", state: plan.state, limit: plan.limit });
    }
    for (const override of overrides) {
      add(override.featureKey, {
        source: override.overrideType === "ABSOLUTE" ? "TENANT_OVERRIDE_ABSOLUTE" : "TENANT_OVERRIDE_DELTA",
        state: override.state,
        limit: override.limit,
      });
    }

    // D2-7: the ADD_ON rung exists in the chain and always resolves empty. No
    // grant is contributed here, and that is the ruling rather than a gap — the
    // rung is in `PRECEDENCE_ORDER` so adding add-ons later is an insertion.
    //
    // POLICY_CONSTRAINT likewise contributes nothing: no policy-constraint
    // construct exists in Phase 2, and inventing one to fill the rung would be
    // the "documentation, not architecture" failure in reverse.

    const featureKeys = command.featureKey ? [command.featureKey] : [...byFeature.keys()].sort();

    const entitlements = featureKeys.map((featureKey) => {
      try {
        return resolveEntitlement(featureKey, byFeature.get(featureKey) ?? []);
      } catch (err) {
        if (err instanceof EntitlementConflictError) {
          // ADR-008 rule 3: "otherwise resolution fails closed with
          // `ENTITLEMENT_CONFLICT`." Fails closed means the request is refused,
          // not that the feature quietly resolves to DENY — a caller that got a
          // DENY could not tell a decision from a defect.
          throw new CapabilityError("ENTITLEMENT_CONFLICT", err.message, { featureKey });
        }
        throw err;
      }
    });

    for (const resolved of entitlements) {
      await this.sources.record({
        id: randomUUID(),
        tenantId: command.tenantId,
        featureKey: resolved.featureKey,
        state: resolved.state,
        limit: resolved.limit,
        resolvedFrom: resolved.resolvedFrom,
        evaluatedAt,
      });
    }

    return {
      organizationId: command.tenantId,
      evaluatedAt: evaluatedAt.toISOString(),
      entitlements: entitlements.map((e) => ({
        featureKey: e.featureKey,
        state: e.state,
        limit: e.limit,
        resolvedFrom: [...e.resolvedFrom],
      })),
    };
  }
}
