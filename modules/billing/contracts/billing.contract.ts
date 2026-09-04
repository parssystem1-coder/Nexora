/**
 * `modules/billing`'s public surface. Nothing outside this module may import
 * its `domain/`, `application/`, `infrastructure/` or `interfaces/` directly
 * (`03_TECHNICAL_BLUEPRINT.md` §2, enforced by DEP-DIRECTION-CROSS-MODULE).
 *
 * `04_DATABASE_BLUEPRINT.md` §1: cross-module reads go through contracts, and
 * there are no cross-module foreign keys. `plans`, `plan_versions` and
 * `plan_features` reference only each other.
 */
export type { PlanDto, ListPlansOutputDto } from "../application/list-plans.input.js";
