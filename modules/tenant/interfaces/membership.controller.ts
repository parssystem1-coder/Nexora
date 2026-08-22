import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { SessionGuard, UserRepositoryPg } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent, recordAuditEventDurable, type AuditOutcome } from "../../audit/contracts/index.js";
import { OrganizationAccessGuard } from "./organization-access.guard.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { membershipInviteCapability } from "./membership-invite.capability.js";
import { inviteMemberInputSchema } from "../application/invite-member.input.js";
import { InviteMemberService } from "../application/invite-member.service.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import type { MembershipDto } from "../contracts/index.js";

/**
 * `POST /api/v1/organizations/{organizationId}/memberships` -
 * 08_PHASE_1_BRIEF.md §3 slice 2. Unlike `organization.create`, this one
 * mirrors the golden path with no structural divergence at all: the tenant
 * already exists, so steps 2-4 have real work (OrganizationAccessGuard) and
 * step 6 has a real permission to assert.
 *
 *   steps 1-4, BEFORE any transaction - authenticate (SessionGuard), then
 *   resolve the caller's membership in the explicitly-supplied organization
 *   and build the TenantContext (OrganizationAccessGuard). Same reason the
 *   golden path puts these ahead of step 5: they establish which tenant may
 *   be trusted, so they cannot already run inside that tenant's context.
 *
 *   steps 5-7, inside one APP_DB transaction opened by the single helper -
 *   assert the permission, then execute the application service. One
 *   transaction, not two, so the permission is not checked against state a
 *   committed transaction has already released.
 *
 *   step 8 - one durable audit event on AUDIT_DB covering the whole attempt,
 *   written after that transaction resolves and before this handler returns
 *   or re-throws, on both paths (ADR-034).
 *
 * The membership id is minted here rather than in the service so the audit
 * event has a stable `resource_id` on the failure path too, where no row was
 * ever written. The invitee's email goes in the audit metadata, which is what
 * makes a FAILURE row diagnosable at all - `resource_id` alone cannot say who
 * the attempt was about.
 */
@Controller("api/v1/organizations/:organizationId/memberships")
export class MembershipController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async invite(
    @Req() request: RequestWithTenantContext,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ): Promise<MembershipDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("MembershipController.invite invoked without a resolved TenantContext.");
    }
    const { membershipId: callerMembershipId } = tenantContext;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = inviteMemberInputSchema.safeParse({
      organizationId,
      ...(typeof body === "object" && body !== null ? body : {}),
    });
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid invitation payload.", {
        issues: parsed.error.issues,
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };
    const newMembershipId = randomUUID();

    let outcome: AuditOutcome = "SUCCESS";
    let result: MembershipDto | undefined;
    let thrown: unknown;

    try {
      result = await withTenantContext(this.appDb, rlsContext, async (trx) => {
        // step 6 - permission authorization
        const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
        for (const permission of membershipInviteCapability.requiredPermissions) {
          await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
        }

        // step 7 - application service execution + domain mapping
        const service = new InviteMemberService(
          new UserRepositoryPg(trx),
          new MembershipRepositoryPg(trx),
          systemClock,
        );
        return service.execute({
          membershipId: newMembershipId,
          tenantId: tenantContext.tenantId,
          email: parsed.data.email,
        });
      });
    } catch (err) {
      outcome = "FAILURE";
      thrown = err;
    }

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034).
    await recordAuditEventDurable(
      this.auditDb,
      rlsContext,
      new AuditEvent(
        tenantContext.tenantId,
        tenantContext.userId,
        "user",
        membershipInviteCapability.id,
        "membership",
        newMembershipId,
        outcome,
        tenantContext.requestId,
        tenantContext.correlationId,
        { inviteeEmail: parsed.data.email },
      ),
    );

    if (thrown) throw thrown;
    return result!;
  }
}
