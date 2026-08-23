import { randomUUID } from "node:crypto";
import type { Clock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { Store } from "../domain/store.entity.js";
import { StoreSlugTakenError } from "../domain/store.repository.js";
import type { StoreRepository } from "../domain/store.repository.js";
import { StoreMembership } from "../domain/store-membership.entity.js";
import type { StoreMembershipRepository } from "../domain/store-membership.repository.js";
import type { ReservedSubdomainRepository } from "../domain/reserved-subdomain.repository.js";
import type { StoreDto } from "../contracts/tenant.contract.js";

export interface CreateStoreCommand {
  /** Minted by the caller before the transaction, so the audit event has a stable resource id on both paths. */
  storeId: string;
  tenantId: string;
  creatorUserId: string;
  name: string;
  /** Already normalized (trim + lowercase) by createStoreInputSchema. */
  slug: string;
}

/**
 * 08_PHASE_1_BRIEF.md §3 slice 4, pipeline step 7.
 *
 * Creating the store also makes its creator the store's first
 * `store_membership` row, in the same transaction. Not scope creep: 08 §5 is
 * explicit that "`store_memberships` is checked for every store-scoped
 * read; organization membership alone is not sufficient," so a store
 * created without one would deny its own creator `store.read` on the store
 * they just made — the golden path would be unreachable. This is
 * `organization.create`'s decision 1 in the same shape one level down: that
 * slice wires in an ACTIVE membership + owner role; this one wires in a
 * store membership (there is no per-store role catalog to grant into).
 *
 * Slug rejection order matches the two distinct failure modes 05 §7 gives
 * separate codes for: `reserved_subdomains` is checked FIRST
 * (`DOMAIN_RESERVED`, a platform-reserved word — never reaches the unique
 * index) and the `UNIQUE (tenant_id, slug)` constraint is what catches an
 * ordinary duplicate (`CONFLICT`, via `StoreSlugTakenError`). The reserved
 * check is a repository read plus this `if`, not a database constraint — a
 * CHECK constraint cannot reference another table, and a trigger would put
 * authoritative business logic in the database (AGENTS.md §4). Adding a word
 * to `reserved_subdomains` later does not retroactively invalidate a store
 * already using it; this slice does not attempt that.
 */
export class CreateStoreService {
  constructor(
    private readonly stores: StoreRepository,
    private readonly storeMemberships: StoreMembershipRepository,
    private readonly reservedSubdomains: ReservedSubdomainRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateStoreCommand): Promise<StoreDto> {
    if (await this.reservedSubdomains.isReserved(command.slug)) {
      throw new CapabilityError("DOMAIN_RESERVED", "That slug is reserved and cannot be used for a store.", {
        slug: command.slug,
      });
    }

    const createdAt = this.clock.now();
    const store = new Store(command.storeId, command.tenantId, command.name, command.slug, "ACTIVE", createdAt);

    try {
      await this.stores.create(store);
    } catch (err) {
      if (err instanceof StoreSlugTakenError) {
        throw new CapabilityError("CONFLICT", "That store slug is already taken in this organization.", {
          slug: command.slug,
        });
      }
      throw err;
    }

    const storeMembership = new StoreMembership(randomUUID(), command.tenantId, store.id, command.creatorUserId);
    await this.storeMemberships.create(storeMembership);

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
