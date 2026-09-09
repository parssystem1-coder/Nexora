import { Controller, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { loadIdempotencyRetentionDays } from "../../../platform/config.js";
import { CapabilityError, buildValidationInput, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { OrganizationAccessGuard } from "../../tenant/contracts/index.js";
import type { RequestWithTenantContext } from "../../tenant/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import {
  ClaimInProgressError,
  IdempotencyConflictError,
  withIdempotentCapability,
} from "../../idempotency/contracts/index.js";
import { subscriptionCancelCapability } from "./subscription-cancel.capability.js";
import { cancelSubscriptionInputSchema } from "../application/cancel-subscription.input.js";
import type { SubscriptionDto } from "../application/subscribe-to-plan.input.js";
import { CancelSubscriptionService } from "../application/cancel-subscription.service.js";
import { SubscriptionRepositoryPg } from "../infrastructure/subscription.repository.pg.js";
import { StateTransitionRepositoryPg } from "../infrastructure/state-transition.repository.pg.js";

/**
 * `POST /api/v1/organizations/{organizationId}/subscription/cancel` — Phase 2
 * item 5.
 *
 * Its own file, like every other capability here: the ADR-030 harness traces
 * error-code reachability by file, so sharing a controller would force each
 * capability to declare the other's codes.
 *
 * Composition is item 4's, unchanged — `runCapabilityAttempt` outermost,
 * `withIdempotentCapability` inside it owning the transaction (ADR-038 items 2
 * and 5). **The status change and the transition-log append happen in that one
 * transaction**, which is what makes the log trustworthy: a history that could
 * commit without the change it describes, or the reverse, would be worse than
 * no history.
 */
@Controller("api/v1/organizations/:organizationId/subscription")
export class SubscriptionCancelController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post("cancel")
  @HttpCode(200)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async cancel(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
  ): Promise<SubscriptionDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new Error("SubscriptionCancelController.cancel invoked without a resolved TenantContext.");
    }
    const callerMembershipId = tenantContext.membershipId;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = cancelSubscriptionInputSchema.safeParse(
      buildValidationInput(subscriptionCancelCapability.route, { organizationId }, undefined),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid cancellation request.", {
        issues: parsed.error.issues,
      });
    }

    const idempotencyKey = idempotencyKeyHeader?.trim();
    if (!idempotencyKey) {
      throw new CapabilityError("VALIDATION_ERROR", "An Idempotency-Key header is required for this capability.", {
        header: "Idempotency-Key",
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };
    const transitionId = randomUUID();

    const outcome = await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withIdempotentCapability(
          this.appDb,
          rlsContext,
          {
            capabilityId: subscriptionCancelCapability.id,
            idempotencyKey,
            requestPayload: parsed.data,
            actorType: "user",
            retentionDays: loadIdempotencyRetentionDays(),
            clock: systemClock,
          },
          async (trx) => {
            const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
            for (const permission of subscriptionCancelCapability.requiredPermissions) {
              await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
            }

            return new CancelSubscriptionService(
              new SubscriptionRepositoryPg(trx),
              new StateTransitionRepositoryPg(trx),
              systemClock,
            ).execute({
              transitionId,
              tenantId: tenantContext.tenantId,
              actorUserId: tenantContext.userId,
            });
          },
        ).catch((err: unknown) => {
          if (err instanceof IdempotencyConflictError) {
            throw new CapabilityError("IDEMPOTENCY_CONFLICT", err.message, { capability: err.capability });
          }
          if (err instanceof ClaimInProgressError) {
            throw new CapabilityError("CONFLICT", err.message, { retryAfterSeconds: err.retryAfterSeconds });
          }
          throw err;
        }),
      (auditOutcome, result) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          subscriptionCancelCapability.id,
          "subscription",
          result?.result.id ?? tenantContext.tenantId,
          auditOutcome,
          tenantContext.requestId,
          tenantContext.correlationId,
          result?.replayed === true ? { replay: true, idempotencyKey } : {},
        ),
    );

    return outcome.result;
  }
}
