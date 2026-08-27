import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB } from "../../../platform/db/connections.js";
import { CapabilityError, resolvePathOrBodyValue } from "../../capability/contracts/index.js";
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
 * `organizationId` is read from the path parameter if present, falling back
 * to the request body otherwise — never from
 * `sessions.active_organization_id` (ADR-002: the tenant is not derived from
 * the token). Both a path segment and a body field are equally "an explicit
 * application-level input" under ADR-002; neither is derived from the
 * session. The fallback exists because `store.create` follows
 * `05_API_CAPABILITY_CONTRACTS.md` §6.1's worked contract literally
 * (`POST /api/v1/stores`, `organizationId` in the body), while
 * `membership.invite` and `membership.role.assign` both nest it in the path
 * — see DECISION_LOG.md "store.create: the route, and why it breaks the
 * organizationId-in-the-path pattern".
 *
 * The path value is authoritative and load-bearing — not merely preferred —
 * per `resolvePathOrBodyValue` (`modules/capability/interfaces/
 * path-body-conflict.ts`): if a route's path supplies `organizationId` AND
 * the body ALSO supplies a DIFFERENT value, the request is rejected with
 * `VALIDATION_ERROR` rather than silently using the path value and ignoring
 * the mismatch. See DECISION_LOG.md "A path parameter is authoritative; a
 * differing body value is rejected, not silently overridden" — an earlier
 * version of this comment called the ordering "unexercised in practice, not
 * load-bearing," which stopped being true the moment anything actually
 * inspected `request.body.organizationId` for a route where the path also
 * supplies it; nothing had, until this rule was written.
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

    const organizationIdCandidate = resolvePathOrBodyValue(
      "organizationId",
      request.params["organizationId"],
      request.body,
    );

    const parsed = organizationScopeSchema.safeParse({ organizationId: organizationIdCandidate });
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "organizationId must be a valid UUID.", {
        issues: parsed.error.issues,
      });
    }
    const { organizationId } = parsed.data;

    const access = await withTenantContext(this.db, { tenantId: null, userId: identity.userId, storeId: null }, (trx) =>
      new ResolveOrganizationAccessService(new MembershipRepositoryPg(trx)).execute(identity.userId, organizationId),
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
