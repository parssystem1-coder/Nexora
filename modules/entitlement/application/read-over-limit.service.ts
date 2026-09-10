import type { Clock } from "../../../platform/clock.js";
import { QUOTA_RESOURCES, RESOURCE_OWNING_MODULE } from "../domain/quota-resource.js";
import type { QuotaResource } from "../domain/quota-resource.js";
import { evaluateResource } from "../domain/over-limit.js";
import type { OverLimitStateRepository } from "../domain/entitlement.repository.js";
import type { ReadOverLimitOutputDto } from "./read-over-limit.input.js";

/**
 * How many of each resource the tenant currently holds, or `null` where no
 * module can say. **`null` and `0` are opposite answers** and the caller must
 * keep them apart — see `over-limit.ts`.
 */
export type ResourceCounts = Readonly<Partial<Record<QuotaResource, number>>>;

/** The limits ADR-008's chain resolved, by resource. Absent means no limit resolved. */
export type ResolvedLimits = Readonly<Partial<Record<QuotaResource, number>>>;

export interface ReadOverLimitCommand {
  tenantId: string;
  counts: ResourceCounts;
  limits: ResolvedLimits;
}

/**
 * `overlimit.read` — Phase 2 item 8.
 *
 * ## It evaluates live, and does not depend on the table being populated
 *
 * **ADR-045 names this table's two writers and neither exists.** Its Tier 1 row
 * reads *"the usage recorder and the over-limit evaluator both write it"*, and
 * the usage recorder is item 9. ADR-026's own entry cause is a downgrade — its
 * title is *Over-Limit Policy and Data Preservation on Downgrade*, and its
 * Problem is a tenant "holding 500 products [who] moves to a plan that permits
 * 50" — which is item 15's `plan.change`. **Nothing in Phase 2 writes a row
 * here**, and that is recorded as owed rather than worked around.
 *
 * **A read path that trusted the table would therefore report "not over limit"
 * for every tenant, forever, and look correct.** That is precisely the
 * silent-success failure `AGENTS.md` §8's second rule exists to catch, so this
 * service counts and resolves on every call and consults the table for one
 * thing only: `entered_at`, the single fact a live evaluation cannot recompute.
 *
 * ## What it does not do
 *
 * **It enforces nothing.** ADR-026 item 3 rules that "quota enforcement is at
 * creation time only", so refusing a write is the business of whichever
 * capability does the writing — and item 6's `blockedOperations` below is a
 * *report* of what ADR-026 item 1's table already says, not a mechanism.
 * ADR-026 item 6 is explicit that "over-limit is a visible state, **not an error
 * condition**".
 */
export class ReadOverLimitService {
  constructor(
    private readonly states: OverLimitStateRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ReadOverLimitCommand): Promise<ReadOverLimitOutputDto> {
    const evaluatedAt = this.clock.now();
    const enteredAt = await this.states.findEnteredAtByResource(command.tenantId);

    const resources = QUOTA_RESOURCES.map((resource) => {
      const evaluation = evaluateResource({
        resource,
        // A resource whose owning module is null cannot be counted at all —
        // `domains` until Phase 4. Passing `null` rather than `0` is the whole
        // point: see `RESOURCE_OWNING_MODULE`.
        currentCount: RESOURCE_OWNING_MODULE[resource] === null ? null : (command.counts[resource] ?? null),
        limit: command.limits[resource] ?? null,
      });

      const over = evaluation.state === "OVER_LIMIT";

      return {
        resource: evaluation.resource,
        state: evaluation.state,
        currentCount: evaluation.currentCount,
        limit: evaluation.limit,
        reason: evaluation.reason,
        // ADR-026 item 1's table, reported rather than enforced: "create new of
        // that resource — blocked"; retained, readable, exportable, updatable
        // and deletable by the tenant's own choice. So exactly one operation is
        // blocked, and naming it is ADR-026 item 4's requirement.
        blockedOperations: over ? [`${resource}.create`] : [],
        // ADR-026 item 5: "The tenant may upgrade, or reduce their own usage.
        // The platform must never reduce it for them."
        resolution: over ? (["upgrade", "reduce"] as const).slice() : [],
        enteredAt: enteredAt.get(resource)?.toISOString() ?? null,
      };
    });

    return {
      organizationId: command.tenantId,
      evaluatedAt: evaluatedAt.toISOString(),
      // Never true on the strength of a NOT_EVALUABLE: an unknown is not a
      // breach, and reporting one as a breach is the mirror of the zero-count
      // lie this item exists to avoid.
      anyOverLimit: resources.some((r) => r.state === "OVER_LIMIT"),
      resources,
    };
  }
}
