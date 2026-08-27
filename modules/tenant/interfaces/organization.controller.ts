import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { CapabilityError, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { RoleGrantRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { organizationCreateCapability } from "./organization-create.capability.js";
import { createOrganizationInputSchema } from "../application/create-organization.input.js";
import { CreateOrganizationService } from "../application/create-organization.service.js";
import { OrganizationRepositoryPg } from "../infrastructure/organization.repository.pg.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import type { OrganizationDto } from "../contracts/index.js";

type CreateRequest = RequestWithTenantContext & { requestId?: string; correlationId?: string };

/**
 * `POST /api/v1/organizations` - 08_PHASE_1_BRIEF.md §3 slice 1, mirroring
 * the golden path (`store.controller.ts`) step for step. Two steps differ,
 * and both differences are structural to a capability that *creates* the
 * tenant rather than acting inside one. They are recorded in DECISION_LOG.md
 * rather than resolved by inventing a second pipeline shape (AGENTS.md §2).
 *
 *   steps 2-4 have no guard. The golden path's StoreAccessGuard resolves an
 *   existing membership and an explicitly-supplied resource id, then builds
 *   the trusted TenantContext. Here there is no pre-existing membership to
 *   resolve and no resource to check access to: the tenant does not exist
 *   yet. What survives of those steps is input validation and minting the
 *   organization id - which is also the tenant id, so it must be known
 *   before the transaction opens, because it is what the RLS context is set
 *   to. A guard whose only act is `randomUUID()` would imply an access check
 *   that did not happen, so there isn't one.
 *
 *   step 6 has no permission to assert, for the same reason: the caller
 *   holds no membership until step 7 creates one, so `membership_roles` has
 *   nothing to read. The empty-list assertion below fails loudly if a
 *   permission is ever added to the capability definition, rather than
 *   letting an unenforceable requirement pass silently.
 *
 * Everything else is the golden path unchanged: authentication in a guard
 * before any transaction (step 1), one APP_DB transaction opened by the
 * single helper for step 7 (step 5), and one durable audit event on AUDIT_DB
 * covering the whole attempt, written after that transaction resolves and
 * before this handler returns or re-throws, on both paths (step 8, ADR-034).
 *
 * Unlike `store.read`, this capability's failure path is genuinely reachable
 * through the domain transaction - a duplicate slug rolls it back - so it is
 * the first slice that proves ADR-034's "the audit row survives a rolled-back
 * domain transaction" property end to end.
 */
@Controller("api/v1/organizations")
export class OrganizationController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SessionGuard)
  async create(@Req() request: CreateRequest, @Body() body: unknown): Promise<OrganizationDto> {
    const identity = request.authenticatedIdentity;
    if (!identity) {
      // SessionGuard runs first and always populates this; a missing identity here is a wiring bug, not a client error.
      throw new Error("OrganizationController.create invoked without an authenticated identity.");
    }

    if (organizationCreateCapability.requiredPermissions.length > 0) {
      throw new Error(
        "organization.create declares required permissions, but the caller holds no membership until this capability creates one, so no permission check is possible. Remove them or change the capability's scope.",
      );
    }

    const parsed = createOrganizationInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "Invalid organization payload.", {
        issues: parsed.error.issues,
      });
    }

    // The organization id IS the tenant id (organizations.tenant_id is
    // GENERATED ALWAYS AS (id)), so it has to exist before the transaction
    // that RLS is scoped to. Generated here, never read back with RETURNING.
    const organizationId = randomUUID();

    // step 4 - the trusted context. Built here rather than in a guard (see
    // the note above), and attached to the request before the transaction
    // opens so that pipeline step 10's log line carries a real tenantId even
    // when the attempt goes on to fail. storeId and membershipId are absent
    // by construction: there is no store, and the membership does not exist
    // until step 7 creates it.
    const tenantContext = {
      tenantId: organizationId,
      userId: identity.userId,
      requestId: request.requestId ?? "",
      correlationId: request.correlationId ?? "",
      actorType: "user" as const,
    };
    request.tenantContext = tenantContext;

    const rlsContext = { tenantId: organizationId, userId: identity.userId, storeId: null };

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withTenantContext(this.appDb, rlsContext, async (trx) => {
          // step 7 - application service execution + domain mapping
          const service = new CreateOrganizationService(
            new OrganizationRepositoryPg(trx),
            new MembershipRepositoryPg(trx),
            new RoleGrantRepositoryPg(trx),
            systemClock,
          );
          return service.execute({
            organizationId,
            creatorUserId: identity.userId,
            name: parsed.data.name,
            slug: parsed.data.slug,
          });
        }),
      (outcome) =>
        new AuditEvent(
          organizationId,
          identity.userId,
          "user",
          organizationCreateCapability.id,
          "organization",
          organizationId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
        ),
    );
  }
}
