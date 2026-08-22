import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB } from "../../../platform/db/connections.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import { ResolveOrganizationAccessService } from "../application/resolve-organization-access.service.js";
import { organizationScopeSchema } from "../application/organization-scope.input.js";

/**
 * 08_PHASE_1_BRIEF.md §2 steps 2-4 for an organization-scoped capability -
 * the sibling of StoreAccessGuard, one level up. Resolves the caller's
 * membership in the explicitly-supplied organization, then builds the trusted
 * TenantContext. Must run after SessionGuard.
 *
 * `organizationId` is a path parameter, never `sessions.active_organization_id`
 * (ADR-002: the tenant is not derived from the token). That column is a UI
 * convenience recording which organization the user last looked at; treating
 * it as authority would mean a stale or attacker-influenced session value
 * decided which tenant a write landed in.
 *
 * Like StoreAccessGuard this runs in the bootstrap RLS phase - `app.user_id`
 * set, `app.tenant_id` still null - relying on the `memberships` self-access
 * clause (RISK_REGISTER.md R-003, DECISION_LOG.md "RLS bootstrap..."). It
 * copies that existing pattern on the same table rather than extending it to
 * a third one, which R-003 forbids without its own decision.
 *
 * A caller who is not an active member gets FORBIDDEN whether or not the
 * organization exists: the only table consulted is `memberships`, so a
 * non-member cannot tell an organization they may not touch from one that
 * was never created.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(@Inject(APP_DB) private readonly db: Kysely<Database>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithTenantContext & Request & { requestId?: string; correlationId?: string }>();
    const identity = request.authenticatedIdentity;
    if (!identity) {
      throw new CapabilityError(
        "AUTHENTICATION_REQUIRED",
        "OrganizationAccessGuard ran before SessionGuard established an identity.",
      );
    }

    const parsed = organizationScopeSchema.safeParse({ organizationId: request.params["organizationId"] });
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "organizationId must be a valid UUID.", {
        issues: parsed.error.issues,
      });
    }
    const { organizationId } = parsed.data;

    const access = await withTenantContext(
      this.db,
      { tenantId: null, userId: identity.userId, storeId: null },
      (trx) => new ResolveOrganizationAccessService(new MembershipRepositoryPg(trx)).execute(identity.userId, organizationId),
    );

    request.tenantContext = {
      tenantId: access.tenantId,
      userId: identity.userId,
      membershipId: access.membershipId,
      requestId: request.requestId ?? "",
      correlationId: request.correlationId ?? "",
      actorType: "user",
    };
    return true;
  }
}
