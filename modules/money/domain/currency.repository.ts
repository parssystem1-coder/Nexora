import type { Currency } from "./currency.entity.js";

/**
 * Interface only — no implementation, no connection parameter. Concrete
 * implementations take their connection as a constructor argument so domain
 * never sees the query builder, mirroring the golden path's
 * StoreRepository/StoreRepositoryPg pair. See DECISION_LOG.md "How
 * repositories participate in a withTenantContext transaction".
 */
export interface CurrencyRepository {
  findByCode(code: string): Promise<Currency | null>;
  listActive(): Promise<Currency[]>;
}
