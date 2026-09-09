import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
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
import { subscriptionReadCapability } from "./subscription-read.capability.js";
import { readSubscriptionInputSchema } from "../application/read-subscription.input.js";
import type { SubscriptionDto } from "../application/subscribe-to-plan.input.js";
import { ReadSubscriptionService } from "../application/read-subscription.service.js";
import { SubscriptionRepositoryPg } from "../infrastructure/subscription.repository.pg.js";

/**
 * `GET /api/v1/organizations/{organizationId}/subscription` — Phase 2 item 4.
 *
 * **A separate file from `plan.subscribe`, and not for tidiness.** Every Phase 1
 * capability has its own controller, and the ADR-030 harness is why that
 * convention has teeth: its `ERROR-CODE-UNDECLARED` rule traces reachability by
 * *file*, so two capabilities sharing one controller would each have to declare
 * the other's error codes. `subscription.read` cannot raise
 * `IDEMPOTENCY_CONFLICT`, and declaring that it can would be a false contract
 * published into `openapi.json`.
 *
 * A READ with `Idempotency: no` (`05` §4.2), so ADR-038 item 7 applies: it
 * composes only the outer function, exactly as all ten Phase 1 capabilities do.
 *
 * `servingNow` in the response is ADR-024 item 2's derived answer, computed on
 * every read. There is no `serving` column to go stale.
 */
@Controller("api/v1/organizations/:organizationId/subscription")
export class SubscriptionReadController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Get()
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async read(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
  ): Promise<SubscriptionDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new Error("SubscriptionController.read invoked without a resolved TenantContext.");
    }
    const callerMembershipId = tenantContext.membershipId;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = readSubscriptionInputSchema.safeParse(
      buildValidationInput(subscriptionReadCapability.route, { organizationId }, undefined),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid subscription request.", {
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
          for (const permission of subscriptionReadCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
          }

          return new ReadSubscriptionService(new SubscriptionRepositoryPg(trx), systemClock).execute({
            tenantId: tenantContext.tenantId,
          });
        }),
      (auditOutcome, result) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          subscriptionReadCapability.id,
          "subscription",
          result?.id ?? tenantContext.tenantId,
          auditOutcome,
          tenantContext.requestId,
          tenantContext.correlationId,
        ),
    );
  }
}
