import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { SubscriptionRepositoryPg } from "../infrastructure/subscription.repository.pg.js";

/**
 * What another module may ask this one about a subscription, without importing
 * its entity, its repository or its tables.
 *
 * `modules/entitlement` is the first caller: ADR-008's PLAN_VERSION rung needs
 * the version the tenant's subscription pins, and `04` §1 routes that read
 * through a contract rather than a query or a foreign key — the constraint
 * `npm run check:fk` would fail the build on.
 *
 * **One field, not the aggregate.** A caller that needs the whole subscription
 * has `subscription.read`; this exists so the entitlement resolver does not have
 * to take a dependency on a shape it does not use.
 */
export interface SubscriptionPlanVersionReader {
  /** The pinned `plan_version_id`, or null when the organization has no subscription. */
  findPinnedPlanVersionId(tenantId: string): Promise<string | null>;
}

/**
 * Factory, mirroring `modules/money`'s `createCurrencyRepository` and
 * `modules/billing`'s `createPlanOfferingRepository`: it binds this module's
 * repository to a connection the caller already holds — the transaction its own
 * capability opened — without exposing the concrete class, which
 * `DEP-DIRECTION-CROSS-MODULE` forbids.
 */
export function createSubscriptionPlanVersionReader(
  conn: Kysely<Database> | Transaction<Database>,
): SubscriptionPlanVersionReader {
  const subscriptions = new SubscriptionRepositoryPg(conn);
  return {
    async findPinnedPlanVersionId(tenantId: string): Promise<string | null> {
      const subscription = await subscriptions.findByTenant(tenantId);
      return subscription?.planVersionId ?? null;
    },
  };
}
