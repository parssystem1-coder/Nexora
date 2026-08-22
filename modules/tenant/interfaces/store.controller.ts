import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { createAuditEventRepository } from "../../audit/contracts/index.js";
import { StoreAccessGuard } from "./store-access.guard.js";
import type { RequestWithTenantContext } from "./store-access.guard.js";
import { storeReadCapability } from "./store-read.capability.js";
import { StoreRepositoryPg } from "../infrastructure/store.repository.pg.js";
import { ReadStoreService } from "../application/read-store.service.js";
import type { StoreDto } from "../contracts/index.js";

const appDb = createDb(loadDbConfig());

/**
 * The golden path: GET /api/v1/stores/{storeId} (08_PHASE_1_BRIEF.md §2).
 *
 * Pipeline ordering is normative (08 §2 steps 1-8, restated as a linear chain
 * in 03_TECHNICAL_BLUEPRINT.md §3.1):
 *
 *   steps 1-4, BEFORE any transaction — authenticate (SessionGuard), resolve
 *   membership + explicit storeId, store access check, build TenantContext
 *   (StoreAccessGuard). The brief places these ahead of step 5 deliberately:
 *   they are what establishes *which* tenant may be trusted, so they cannot
 *   already be running inside that tenant's context.
 *
 *   steps 5-8, INSIDE one transaction opened here by the single helper —
 *   authorize permission, execute the application service, write the audit
 *   event. One transaction, not three: a permission checked in a transaction
 *   that has already committed is a check against stale state, and an audit
 *   row that can commit while the read it describes rolls back is not an
 *   audit trail. See DECISION_LOG.md "Pipeline step 6 must share the
 *   transaction with steps 7-8".
 *
 * The body is composition (build repositories bound to `trx`, run them in
 * order), not business logic: no branch here decides a business outcome.
 * Generalizing this wiring into a reusable policy pipeline is Phase 5's
 * "capability registry and policy pipeline", deliberately not built ahead of
 * having more than one capability to generalize from.
 */
@Controller("api/v1/stores")
export class StoreController {
  @Get(":storeId")
  @UseGuards(SessionGuard, StoreAccessGuard)
  async read(@Req() request: RequestWithTenantContext): Promise<StoreDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("StoreController.read invoked without a resolved TenantContext.");
    }

    return withTenantContext(
      appDb,
      { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: tenantContext.storeId },
      async (trx) => {
        // step 6 — permission authorization, inside the transaction
        const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
        for (const permission of storeReadCapability.requiredPermissions) {
          await permissions.assert(tenantContext.tenantId, tenantContext.membershipId, permission);
        }

        // steps 7-8 — application service execution + audit, same transaction
        const service = new ReadStoreService(new StoreRepositoryPg(trx), createAuditEventRepository(trx));
        return service.execute({
          tenantId: tenantContext.tenantId,
          userId: tenantContext.userId,
          storeId: tenantContext.storeId,
          requestId: tenantContext.requestId,
          correlationId: tenantContext.correlationId,
        });
      },
    );
  }
}
