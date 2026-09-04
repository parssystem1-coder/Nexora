/**
 * The plan aggregate as `plan.list` reads it: a plan identity, the version of
 * it that is currently in force, and the feature keys that version grants.
 *
 * ADR-044's ruling item 1 is why there is no `name` here and no `description`:
 * "plans, plan_versions and plan_features carry a stable machine `key` only."
 * A client renders `key` through its own catalogue mapping. A display string
 * reaching this entity would be the first step back toward a locale column in
 * a platform-global table, which is exactly what that ruling closed.
 */
export class PlanVersion {
  constructor(
    public readonly id: string,
    public readonly version: number,
    /**
     * ADR-052: eligibility and duration in one non-negative integer. 0 means
     * this version offers no trial — an ordinary value, not a sentinel, so
     * that "offers no trial" is not a special case in any query.
     */
    public readonly trialPeriodDays: number,
    public readonly effectiveFrom: Date,
  ) {}

  /** ADR-052's eligibility half, expressed once rather than at each call site. */
  get offersTrial(): boolean {
    return this.trialPeriodDays > 0;
  }
}

export class Plan {
  constructor(
    public readonly id: string,
    /** The machine key. Never displayed as-is — see this file's doc comment. */
    public readonly key: string,
    public readonly currentVersion: PlanVersion,
    /**
     * Feature keys this version **grants**, per `PHASE_2_BRIEF.md` §4's own
     * description of `plan_features` ("features a plan version grants").
     * Sorted for a stable response; the set is small by construction.
     */
    public readonly featureKeys: readonly string[],
  ) {}
}
