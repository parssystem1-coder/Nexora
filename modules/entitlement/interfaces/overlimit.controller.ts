import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError, buildValidationInput, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { OrganizationAccessGuard, createTenantResourceCounter } from "../../tenant/contracts/index.js";
import type { RequestWithTenantContext } from "../../tenant/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { createSubscriptionPlanVersionReader } from "../../subscription/contracts/index.js";
import { overlimitReadCapability } from "./overlimit-read.capability.js";
import { readOverLimitInputSchema } from "../application/read-over-limit.input.js";
import type { ReadOverLimitOutputDto } from "../application/read-over-limit.input.js";
import { ReadOverLimitService } from "../application/read-over-limit.service.js";
import { ResolveEntitlementService } from "../application/resolve-entitlement.service.js";
import {
  EntitlementRepositoryPg,
  EntitlementSourceRepositoryPg,
  OverLimitStateRepositoryPg,
} from "../infrastructure/entitlement.repository.pg.js";

/**
 * `GET /api/v1/organizations/{organizationId}/over-limit` — Phase 2 item 8.
 *
 * Its own file, like every other capability here — the one-controller-per-
 * capability convention every Phase 1 slice follows, and which the ADR-030
 * harness gives teeth by tracing error-code reachability per file.
 *
 * **It does declare `ENTITLEMENT_CONFLICT`**, because it calls the resolver
 * below to obtain the limits: ADR-008 rule 3's failure is genuinely reachable
 * from here. A first draft of this file argued the opposite and the harness
 * refuted it.
 *
 * A READ with `Idempotency: no`, so it composes only `runCapabilityAttempt`
 * (ADR-038 item 7) and opens its transaction the ordinary way.
 *
 * **Two cross-module reads, both through contracts** — `04` §1's rule, and the
 * shape item 7 handed over. `modules/tenant` counts what it owns; the tenant's
 * pinned plan version comes from `modules/subscription`. Neither is a foreign
 * key, which `npm run check:fk` would refuse.
 */
@Controller("api/v1/organizations/:organizationId/over-limit")
export class OverLimitController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Get()
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async read(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
  ): Promise<ReadOverLimitOutputDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new Error("OverLimitController.read invoked without a resolved TenantContext.");
    }
    const callerMembershipId = tenantContext.membershipId;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = readOverLimitInputSchema.safeParse(
      buildValidationInput(overlimitReadCapability.route, { organizationId }, undefined),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid over-limit request.", {
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
          for (const permission of overlimitReadCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
          }

          // The limits, from ADR-008's chain rather than read straight off
          // `plan_quota_policies`: a tenant override may raise or lower them,
          // and rule 5 forbids resolution being computed anywhere but the one
          // resolver. Item 7 composed the quota axis into it for this reason.
          const planVersionId = await createSubscriptionPlanVersionReader(trx).findPinnedPlanVersionId(
            tenantContext.tenantId,
          );
          const resolved = await new ResolveEntitlementService(
            new EntitlementRepositoryPg(trx),
            new EntitlementSourceRepositoryPg(trx),
            systemClock,
          ).execute({ tenantId: tenantContext.tenantId, planVersionId });

          const limits: Record<string, number> = {};
          for (const entry of resolved.entitlements) {
            if (entry.state === "LIMIT" && entry.limit !== null) limits[entry.featureKey] = entry.limit;
          }

          // The counts, from the module that owns each resource. `domains` is
          // deliberately absent — it has no table until Phase 4, and the service
          // reports it as not evaluable rather than counting zero.
          const counter = createTenantResourceCounter(trx);
          const counts: Record<string, number> = {
            members: await counter.countActiveMembers(tenantContext.tenantId),
            stores: await counter.countStores(tenantContext.tenantId),
          };

          return new ReadOverLimitService(new OverLimitStateRepositoryPg(trx), systemClock).execute({
            tenantId: tenantContext.tenantId,
            counts,
            limits,
          });
        }),
      (outcome) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          overlimitReadCapability.id,
          "over_limit",
          tenantContext.tenantId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
        ),
    );
  }
}
