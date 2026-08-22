import { CapabilityError } from "../../capability/contracts/index.js";
import type { StoreRepository } from "../domain/store.repository.js";
import type { StoreDto } from "../contracts/index.js";

export interface ReadStoreCommand {
  storeId: string;
}

/**
 * 08_PHASE_1_BRIEF.md §2 step 7: application service execution + domain
 * mapping. Does not write an audit event — that is step 8, which (per option
 * B, DECISION_LOG.md) must run on a connection independent of this service's
 * caller's transaction and must fire whether permission authorization
 * (step 6, which runs before this service is even constructed) or this
 * step's own lookup fails. A single use case cannot see both, so the
 * caller (StoreController) owns the durable audit write for the whole
 * step 6-7 span, not this file. See DECISION_LOG.md "Pipeline step 6 must
 * share the transaction with steps 7-8" and its audit-placement follow-up.
 */
export class ReadStoreService {
  constructor(private readonly stores: StoreRepository) {}

  async execute(command: ReadStoreCommand): Promise<StoreDto> {
    const store = await this.stores.findById(command.storeId);
    if (!store) {
      throw new CapabilityError("RESOURCE_NOT_FOUND", "Store not found.");
    }

    return {
      id: store.id,
      organizationId: store.tenantId,
      name: store.name,
      slug: store.slug,
      status: store.status,
      createdAt: store.createdAt.toISOString(),
    };
  }
}
