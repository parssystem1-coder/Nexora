import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { PlanOfferingRepository } from "../domain/plan-offering.repository.js";
import { PlanOfferingRepositoryPg } from "../infrastructure/plan-offering.repository.pg.js";

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

/**
 * Factory, mirroring `modules/money`'s `createCurrencyRepository` and
 * `modules/audit`'s `createAuditEventRepository`: it lets another module bind
 * this module's repository to a connection it already holds — the transaction
 * its own capability opened — without importing the concrete PG class, which
 * `DEP-DIRECTION-CROSS-MODULE` forbids.
 *
 * `modules/subscription` is its first caller. It needs a plan version and its
 * price for a term in order to pin both (ADR-025 item 6), and `04` §1 routes
 * that read through here rather than through a query or a foreign key.
 */
export function createPlanOfferingRepository(conn: Kysely<Database> | Transaction<Database>): PlanOfferingRepository {
  return new PlanOfferingRepositoryPg(conn);
}
