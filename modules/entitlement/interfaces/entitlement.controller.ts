import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError, buildValidationInput, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { OrganizationAccessGuard } from "../../tenant/contracts/index.js";
import type { RequestWithTenantContext } from "../../tenant/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { createSubscriptionPlanVersionReader } from "../../subscription/contracts/index.js";
import { entitlementResolveCapability } from "./entitlement-resolve.capability.js";
import { resolveEntitlementInputSchema } from "../application/resolve-entitlement.input.js";
import type { ResolveEntitlementOutputDto } from "../application/resolve-entitlement.input.js";
import { ResolveEntitlementService } from "../application/resolve-entitlement.service.js";
import { EntitlementRepositoryPg, EntitlementSourceRepositoryPg } from "../infrastructure/entitlement.repository.pg.js";

/**
 * `GET /api/v1/organizations/{organizationId}/entitlements` — Phase 2 item 6.
 *
 * A READ with `Idempotency: no` (`05` §4.2), so ADR-038 item 7 applies: it
 * composes only `runCapabilityAttempt` and opens its transaction the ordinary
 * way, exactly as all ten Phase 1 capabilities do.
 *
 * **The tenant's plan version is read through `modules/subscription`'s
 * contract**, not by querying `subscriptions` here. `04` §1 routes a
 * cross-module read through contracts, and `npm run check:fk` would fail the
 * build on the foreign key the alternative invites.
 */
@Controller("api/v1/organizations/:organizationId/entitlements")
export class EntitlementController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Get()
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async resolve(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Query() query: unknown,
  ): Promise<ResolveEntitlementOutputDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new Error("EntitlementController.resolve invoked without a resolved TenantContext.");
    }
    const callerMembershipId = tenantContext.membershipId;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = resolveEntitlementInputSchema.safeParse(
      buildValidationInput(entitlementResolveCapability.route, { organizationId }, query),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid entitlement query.", {
        issues: parsed.error.issues,
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withTenantContext(this.appDb, rlsContext, async (trx) => {
          const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
          for (const permission of entitlementResolveCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
          }

          const planVersionId = await createSubscriptionPlanVersionReader(trx).findPinnedPlanVersionId(
            tenantContext.tenantId,
          );

          return new ResolveEntitlementService(
            new EntitlementRepositoryPg(trx),
            new EntitlementSourceRepositoryPg(trx),
            systemClock,
          ).execute({
            tenantId: tenantContext.tenantId,
            planVersionId,
            featureKey: parsed.data.featureKey,
          });
        }),
      (outcome) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          entitlementResolveCapability.id,
          "entitlement",
          tenantContext.tenantId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
        ),
    );
  }
}
