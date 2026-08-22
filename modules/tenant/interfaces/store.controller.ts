import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { RequirePermission, PermissionGuard } from "../../authorization/contracts/index.js";
import { createAuditEventRepository } from "../../audit/contracts/index.js";
import { StoreAccessGuard } from "./store-access.guard.js";
import type { RequestWithTenantContext } from "./store-access.guard.js";
import { StoreRepositoryPg } from "../infrastructure/store.repository.pg.js";
import { ReadStoreService } from "../application/read-store.service.js";
import type { StoreDto } from "../contracts/index.js";

const appDb = createDb(loadDbConfig());

/**
 * The golden path: GET /api/v1/stores/{storeId} (08_PHASE_1_BRIEF.md §2).
 * Thin — no business logic. Guards run steps 1-6 in @UseGuards() array
 * order; this handler opens the one transaction for steps 7-8.
 */
@Controller("api/v1/stores")
export class StoreController {
  @Get(":storeId")
  @UseGuards(SessionGuard, StoreAccessGuard, PermissionGuard)
  @RequirePermission("store.read")
  async read(@Req() request: RequestWithTenantContext): Promise<StoreDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("StoreController.read invoked without a resolved TenantContext.");
    }

    return withTenantContext(
      appDb,
      { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: tenantContext.storeId },
      (trx) => {
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
