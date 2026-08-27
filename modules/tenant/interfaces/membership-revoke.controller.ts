import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError, buildValidationInput, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { SessionGuard, SessionRevocationRepositoryPg } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg, RoleGrantRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { OrganizationAccessGuard } from "./organization-access.guard.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { membershipRevokeCapability } from "./membership-revoke.capability.js";
import { revokeMembershipInputSchema } from "../application/revoke-membership.input.js";
import { RevokeMembershipService } from "../application/revoke-membership.service.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import type { MembershipDto } from "../contracts/index.js";

/**
 * `POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/revoke`
 * — the seventh capability, not one of 08_PHASE_1_BRIEF.md §3's six-slice
 * list (DECISION_LOG.md 2026-08-24). Mirrors `MembershipRoleController`'s
 * shape exactly — same guard pair, same organization-scoped resolution, same
 * audit placement:
 *
 *   steps 1-4, before any transaction — authenticate (SessionGuard), then
 *   resolve the caller's membership in the explicitly-supplied organization
 *   and build the TenantContext (OrganizationAccessGuard). The TARGET
 *   membership (path param `membershipId`) is a different resource entirely
 *   and is resolved inside step 7, not here.
 *
 *   steps 5-7, inside one APP_DB transaction opened by the single helper —
 *   assert the permission, then execute the application service (which also
 *   revokes the target user's sessions in the same transaction — see
 *   RevokeMembershipService).
 *
 *   step 8 — one durable audit event on AUDIT_DB covering the whole attempt,
 *   written after that transaction resolves and before this handler returns
 *   or re-throws, on both paths (ADR-034), under the REAL organization
 *   tenant — this capability always has one, unlike `auth.login`/`auth.logout`.
 *
 * No id is minted here the way `membership.invite`/`membership.role.assign`
 * mint one for a row that might never get created: revocation acts on an
 * EXISTING membership whose id is already known from the path, so that path
 * value is the audit `resource_id` on both the success and failure paths
 * with nothing to invent.
 */
@Controller("api/v1/organizations/:organizationId/memberships/:membershipId/revoke")
export class MembershipRevokeController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async revoke(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ): Promise<MembershipDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("MembershipRevokeController.revoke invoked without a resolved TenantContext.");
    }
    const { membershipId: callerMembershipId } = tenantContext;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = revokeMembershipInputSchema.safeParse(
      buildValidationInput(membershipRevokeCapability.route, { organizationId, membershipId }, body),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid revocation request.", {
        issues: parsed.error.issues,
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withTenantContext(this.appDb, rlsContext, async (trx) => {
          // step 6 - permission authorization
          const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
          for (const permission of membershipRevokeCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
          }

          // step 7 - application service execution + domain mapping
          const service = new RevokeMembershipService(
            new MembershipRepositoryPg(trx),
            new RoleGrantRepositoryPg(trx),
            new SessionRevocationRepositoryPg(trx),
            systemClock,
          );
          return service.execute({
            tenantId: tenantContext.tenantId,
            targetMembershipId: parsed.data.membershipId,
          });
        }),
      (outcome) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          membershipRevokeCapability.id,
          "membership",
          parsed.data.membershipId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
        ),
    );
  }
}
