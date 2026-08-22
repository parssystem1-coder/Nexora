import { CapabilityError } from "../../capability/contracts/index.js";
import { AuditEvent, type AuditEventRepository } from "../../audit/contracts/index.js";
import type { StoreRepository } from "../domain/store.repository.js";
import type { StoreDto } from "../contracts/index.js";

export interface ReadStoreCommand {
  tenantId: string;
  userId: string;
  storeId: string;
  requestId: string;
  correlationId: string;
}

/** 08_PHASE_1_BRIEF.md §2 steps 7-8: application service execution + audit, in the caller's transaction. */
export class ReadStoreService {
  constructor(
    private readonly stores: StoreRepository,
    private readonly auditEvents: AuditEventRepository,
  ) {}

  async execute(command: ReadStoreCommand): Promise<StoreDto> {
    const store = await this.stores.findById(command.storeId);

    await this.auditEvents.record(
      new AuditEvent(
        command.tenantId,
        command.userId,
        "user",
        "store.read",
        "store",
        command.storeId,
        store ? "SUCCESS" : "FAILURE",
        command.requestId,
        command.correlationId,
      ),
    );

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
