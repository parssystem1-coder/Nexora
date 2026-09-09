import { Body, Controller, Headers, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
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
import { createPlanOfferingRepository } from "../../billing/contracts/index.js";
import {
  ClaimInProgressError,
  IdempotencyConflictError,
  withIdempotentCapability,
} from "../../idempotency/contracts/index.js";
import { planSubscribeCapability } from "./plan-subscribe.capability.js";
import { subscribeToPlanInputSchema } from "../application/subscribe-to-plan.input.js";
import type { SubscriptionDto } from "../application/subscribe-to-plan.input.js";
import { SubscribeToPlanService } from "../application/subscribe-to-plan.service.js";
import { SubscriptionRepositoryPg } from "../infrastructure/subscription.repository.pg.js";

/**
 * `POST /api/v1/organizations/{organizationId}/subscription` — Phase 2 item 4,
 * and **the first place ADR-038's composition actually runs.**
 *
 * Its own file, separate from `subscription.read`: the ADR-030 harness traces
 * error-code reachability by file, so a shared controller would force each
 * capability to declare the other's codes. Every Phase 1 capability already
 * follows the one-controller-per-capability convention for its own reasons.
 *
 * `plan.subscribe` nests exactly as ADR-038 item 2 draws it:
 *
 *     runCapabilityAttempt(            <- audits every attempt, fresh or replayed
 *       withIdempotentCapability(      <- owns the transaction; claim + write together
 *         domain work
 *       )
 *     )
 *
 * The order is normative, not stylistic (ADR-038 item 3): a replay is a real
 * second authenticated, authorized request, so ADR-034 item 5 says it is
 * audited. With the wrapper outermost a replay would short-circuit before the
 * audit tail ran, and a retry storm would leave no trace in the record built to
 * explain what happened.
 *
 * **Nothing was added inside `runCapabilityAttempt`** (ADR-038 item 1), and it
 * still knows nothing about transactions — the wrapper beneath it opens one via
 * `withTenantContext`, which keeps that helper at the scope ceiling its own doc
 * comment declares.
 *
 * `subscription.read` opens its transaction the ordinary way: it is a READ with
 * `Idempotency: no` (`05` §4.2), so ADR-038 item 7 applies — "a non-idempotent
 * capability composes only the outer function, exactly as all ten Phase 1
 * capabilities do today."
 */
@Controller("api/v1/organizations/:organizationId/subscription")
export class PlanSubscribeController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async subscribe(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Headers("idempotency-key") idempotencyKeyHeader: string | undefined,
    @Body() body: unknown,
  ): Promise<SubscriptionDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      throw new Error("PlanSubscribeController.subscribe invoked without a resolved TenantContext.");
    }
    const callerMembershipId = tenantContext.membershipId;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = subscribeToPlanInputSchema.safeParse(
      buildValidationInput(planSubscribeCapability.route, { organizationId }, body),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid subscription payload.", {
        issues: parsed.error.issues,
      });
    }

    // `05` §1: "writes that can be retried accept `Idempotency-Key` or an
    // application-level equivalent." The header is required rather than
    // defaulted to a fresh uuid: a generated key makes every request unique,
    // which is a silent way of declaring the capability idempotent while
    // guaranteeing it never replays.
    const idempotencyKey = idempotencyKeyHeader?.trim();
    if (!idempotencyKey) {
      throw new CapabilityError("VALIDATION_ERROR", "An Idempotency-Key header is required for this capability.", {
        header: "Idempotency-Key",
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };
    const subscriptionId = randomUUID();
    const periodId = randomUUID();

    const outcome = await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withIdempotentCapability(
          this.appDb,
          rlsContext,
          {
            capabilityId: planSubscribeCapability.id,
            idempotencyKey,
            requestPayload: parsed.data,
            actorType: "user",
            retentionDays: loadIdempotencyRetentionDays(),
            clock: systemClock,
          },
          async (trx) => {
            // step 6 — permission authorization, inside the same transaction as
            // the write, so it is not checked against state a committed
            // transaction has already released.
            const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
            for (const permission of planSubscribeCapability.requiredPermissions) {
              await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
            }

            // step 7 — application service. The plan and its price are read
            // through `billing`'s contract, never by querying its tables and
            // never by a foreign key (`04` §1, enforced by `npm run check:fk`).
            const service = new SubscribeToPlanService(
              new SubscriptionRepositoryPg(trx),
              createPlanOfferingRepository(trx),
              systemClock,
            );
            return service.execute({
              subscriptionId,
              periodId,
              tenantId: tenantContext.tenantId,
              planVersionId: parsed.data.planVersionId,
              termMonths: parsed.data.termMonths,
            });
          },
        ).catch((err: unknown) => {
          // ADR-009's refusals reach HTTP as `05` §7 codes. Mapped here rather
          // than in the wrapper because the wrapper is shared platform
          // machinery and `modules/idempotency/domain` may not import the
          // capability module at all.
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
          planSubscribeCapability.id,
          "subscription",
          result?.result.id ?? subscriptionId,
          auditOutcome,
          tenantContext.requestId,
          tenantContext.correlationId,
          // ADR-038 item 4's replay marker. Without it the trail shows two
          // successful creations of one subscription and cannot say that only
          // one happened.
          result?.replayed === true ? { replay: true, idempotencyKey } : {},
        ),
    );

    return outcome.result;
  }
}
