import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
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
import { membershipRoleAssignCapability } from "./membership-role-assign.capability.js";
import { assignMembershipRoleInputSchema } from "../application/assign-membership-role.input.js";
import { AssignMembershipRoleService } from "../application/assign-membership-role.service.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import type { MembershipRoleDto } from "../contracts/index.js";

/**
 * `POST /api/v1/organizations/{organizationId}/memberships/{membershipId}/roles`
 * - 08_PHASE_1_BRIEF.md §3 slice 3. A separate controller from
 * `MembershipController`, not a second method on it: every capability so far
 * is one controller class with one method, and this keeps that 1:1 mapping
 * rather than growing an existing controller's guard/DI surface for an
 * unrelated capability.
 *
 * Mirrors `membership.invite`'s shape exactly - same guard pair, same
 * organization-scoped resolution, same audit placement:
 *
 *   steps 1-4, BEFORE any transaction - authenticate (SessionGuard), then
 *   resolve the caller's membership in the explicitly-supplied organization
 *   and build the TenantContext (OrganizationAccessGuard). The TARGET
 *   membership (path param `membershipId`) is a different resource entirely
 *   and is resolved inside step 7, not here - exactly how the golden path
 *   resolves the store ENTITY inside ReadStoreService while StoreAccessGuard
 *   only checks the caller's access to it.
 *
 *   steps 5-7, inside one APP_DB transaction opened by the single helper -
 *   assert the permission, then execute the application service (which also
 *   revokes the target user's sessions in the same transaction - see
 *   AssignMembershipRoleService).
 *
 *   step 8 - one durable audit event on AUDIT_DB covering the whole attempt,
 *   written after that transaction resolves and before this handler returns
 *   or re-throws, on both paths (ADR-034).
 *
 * The grant id is minted here rather than in the service so the audit event
 * has a stable `resource_id` on the failure path too, where no row was ever
 * written. The target membershipId and roleKey go in the audit metadata,
 * which is what makes a FAILURE row diagnosable - `resource_id` alone names
 * a grant that, on failure, was never created.
 *
 * `buildValidationInput` (`modules/capability/contracts/index.ts`) resolves
 * `organizationId` and `membershipId` against the path, rejecting rather
 * than silently overriding if the body names a different value for either -
 * see DECISION_LOG.md "A path parameter is authoritative; a differing body
 * value is rejected, not silently overridden". Before this, a body
 * `membershipId` silently won over the path's (the object literal spread the
 * body last), so the membership the URL named and the membership actually
 * granted a role could differ.
 */
@Controller("api/v1/organizations/:organizationId/memberships/:membershipId/roles")
export class MembershipRoleController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async assign(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Body() body: unknown,
  ): Promise<MembershipRoleDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("MembershipRoleController.assign invoked without a resolved TenantContext.");
    }
    const { membershipId: callerMembershipId } = tenantContext;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = assignMembershipRoleInputSchema.safeParse(
      buildValidationInput(membershipRoleAssignCapability.route, { organizationId, membershipId }, body),
    );
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid role assignment payload.", {
        issues: parsed.error.issues,
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };
    const grantId = randomUUID();

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withTenantContext(this.appDb, rlsContext, async (trx) => {
          // step 6 - permission authorization
          const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
          for (const permission of membershipRoleAssignCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
          }

          // step 7 - application service execution + domain mapping
          const service = new AssignMembershipRoleService(
            new MembershipRepositoryPg(trx),
            new RoleGrantRepositoryPg(trx),
            new SessionRevocationRepositoryPg(trx),
            systemClock,
          );
          return service.execute({
            grantId,
            tenantId: tenantContext.tenantId,
            targetMembershipId: parsed.data.membershipId,
            roleKey: parsed.data.roleKey,
          });
        }),
      (outcome) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          membershipRoleAssignCapability.id,
          "membership_role",
          grantId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
          { targetMembershipId: parsed.data.membershipId, roleKey: parsed.data.roleKey },
        ),
    );
  }
}
