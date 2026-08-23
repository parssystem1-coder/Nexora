import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent, recordAuditEventDurable, type AuditOutcome } from "../../audit/contracts/index.js";
import { OrganizationAccessGuard } from "./organization-access.guard.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { storeCreateCapability } from "./store-create.capability.js";
import { createStoreInputSchema } from "../application/create-store.input.js";
import { CreateStoreService } from "../application/create-store.service.js";
import { StoreRepositoryPg } from "../infrastructure/store.repository.pg.js";
import { StoreMembershipRepositoryPg } from "../infrastructure/store-membership.repository.pg.js";
import { ReservedSubdomainRepositoryPg } from "../infrastructure/reserved-subdomain.repository.pg.js";
import type { StoreDto } from "../contracts/index.js";

/**
 * `POST /api/v1/stores` - 08_PHASE_1_BRIEF.md §3 slice 4. A separate
 * controller from `StoreController` (the golden path's `store.read`), not a
 * second method on it, for the same reason `MembershipRoleController` is
 * separate from `MembershipController`: one controller class per capability.
 * Both controllers share the `api/v1/stores` base path — NestJS resolves
 * this fine because `GET :storeId` and `POST` (no path segment) never
 * collide.
 *
 * Route shape is 05_API_CAPABILITY_CONTRACTS.md §6.1's worked example,
 * literally: `organizationId` arrives in the BODY, not the path, unlike
 * `membership.invite`/`membership.role.assign`. `OrganizationAccessGuard`
 * was extended to read it from either location — see that guard's own
 * comment and DECISION_LOG.md.
 *
 * Pipeline, mirroring slice 3 (`membership.role.assign`) exactly:
 *
 *   steps 1-4, BEFORE any transaction - authenticate (SessionGuard), then
 *   resolve the caller's membership in the (body-supplied) organization and
 *   build the TenantContext (OrganizationAccessGuard).
 *
 *   steps 5-7, inside one APP_DB transaction opened by the single helper -
 *   assert the permission, then execute the application service (which also
 *   creates the creator's `store_membership` row in the same transaction -
 *   see CreateStoreService).
 *
 *   step 8 - one durable audit event on AUDIT_DB covering the whole attempt,
 *   written after that transaction resolves and before this handler returns
 *   or re-throws, on both paths (ADR-034).
 *
 * The store id is minted here rather than in the service so the audit event
 * has a stable `resource_id` on the failure path too, where no row was ever
 * written. The attempted slug goes in the audit metadata, which is what
 * makes a FAILURE row diagnosable - `resource_id` alone names a store that,
 * on failure, was never created.
 *
 * `storeScoped: false` on the capability definition holds here structurally,
 * not just declaratively: `rlsContext.storeId` stays `null` throughout,
 * because this operation creates a store rather than acting inside one.
 */
@Controller("api/v1/stores")
export class StoreCreateController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async create(@Req() request: RequestWithTenantContext, @Body() body: unknown): Promise<StoreDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("StoreCreateController.create invoked without a resolved TenantContext.");
    }
    const { membershipId: callerMembershipId } = tenantContext;
    if (!callerMembershipId) {
      throw new Error("OrganizationAccessGuard resolved a TenantContext without a membershipId.");
    }

    const parsed = createStoreInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid store payload.", {
        issues: parsed.error.issues,
      });
    }

    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };
    const storeId = randomUUID();

    let outcome: AuditOutcome = "SUCCESS";
    let result: StoreDto | undefined;
    let thrown: unknown;

    try {
      result = await withTenantContext(this.appDb, rlsContext, async (trx) => {
        // step 6 - permission authorization
        const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
        for (const permission of storeCreateCapability.requiredPermissions) {
          await permissions.assert(tenantContext.tenantId, callerMembershipId, permission);
        }

        // step 7 - application service execution + domain mapping
        const service = new CreateStoreService(
          new StoreRepositoryPg(trx),
          new StoreMembershipRepositoryPg(trx),
          new ReservedSubdomainRepositoryPg(trx),
          systemClock,
        );
        return service.execute({
          storeId,
          tenantId: tenantContext.tenantId,
          creatorUserId: tenantContext.userId,
          name: parsed.data.name,
          slug: parsed.data.slug,
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
        storeCreateCapability.id,
        "store",
        storeId,
        outcome,
        tenantContext.requestId,
        tenantContext.correlationId,
        { slug: parsed.data.slug },
      ),
    );

    if (thrown) throw thrown;
    return result!;
  }
}
