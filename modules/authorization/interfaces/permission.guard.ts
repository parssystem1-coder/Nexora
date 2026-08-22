import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { RequestWithTenantContext } from "../../tenant/contracts/index.js";
import { PermissionCheckRepositoryPg } from "../infrastructure/permission-check.repository.pg.js";
import { CheckPermissionService } from "../application/check-permission.service.js";
import { PERMISSION_KEY } from "./require-permission.decorator.js";

const appDb = createDb(loadDbConfig());

/**
 * 08_PHASE_1_BRIEF.md §2 step 6. Must run after StoreAccessGuard (needs
 * request.tenantContext). Reflector is instantiated directly, not
 * constructor-injected — esbuild (which tsx/vitest use to run this repo's
 * TypeScript) does not implement emitDecoratorMetadata, so NestJS's
 * type-based constructor DI silently resolves to undefined for any
 * implicitly-typed parameter. This is consistent with this repo's existing
 * pattern of avoiding the DI container for composition
 * (DECISION_LOG.md "How repositories participate in a withTenantContext
 * transaction..."), not a one-off workaround.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly reflector = new Reflector();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string | undefined>(PERMISSION_KEY, context.getHandler());
    if (!required) return true;

    const request = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new CapabilityError("TENANT_CONTEXT_REQUIRED", "PermissionGuard ran before TenantContext was established.");
    }

    await withTenantContext(
      appDb,
      { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: tenantContext.storeId },
      async (trx) => {
        const service = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
        await service.assert(tenantContext.tenantId, tenantContext.membershipId, required);
      },
    );
    return true;
  }
}
