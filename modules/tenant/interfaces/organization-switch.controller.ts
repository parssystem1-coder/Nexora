import { Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { SessionGuard, SessionRepositoryPg } from "../../identity/contracts/index.js";
import { runCapabilityAttempt } from "../../capability/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
import { OrganizationAccessGuard } from "./organization-access.guard.js";
import type { RequestWithTenantContext } from "./tenant-context.js";
import { organizationSwitchCapability } from "./organization-switch.capability.js";
import { SwitchOrganizationService } from "../application/switch-organization.service.js";
import type { SwitchOrganizationOutput } from "../application/switch-organization.input.js";

/**
 * `POST /api/v1/organizations/{organizationId}/switch` — 08_PHASE_1_BRIEF.md
 * §3 slice 6, the last of the six.
 *
 * Pipeline accounting (DECISION_LOG.md 2026-08-24):
 *
 *   steps 1-4, before any transaction — `SessionGuard` then
 *   `OrganizationAccessGuard`, unchanged from `membership.invite`/
 *   `membership.role.assign`: authenticate, then resolve the caller's ACTIVE
 *   membership in the explicitly-supplied `organizationId` (ADR-002 — never
 *   `sessions.active_organization_id`, which is what this capability is
 *   about to WRITE, not read). A non-member or revoked member gets
 *   FORBIDDEN here, before any of this handler's own code runs.
 *
 *   step 5 does not apply: `sessions` is RLS-exempt (the identity cluster
 *   exemption), so no transaction is opened, the same reasoning `auth.login`
 *   and `auth.logout` already established. `OrganizationAccessGuard` does
 *   open its own transaction internally, but only to resolve membership —
 *   it commits and closes before this handler runs, so nothing here inherits
 *   or relies on it.
 *
 *   step 6 does not apply: `requiredPermissions: []` — see the capability
 *   definition for why (every ACTIVE member may switch, regardless of role).
 *
 *   step 7 is `SwitchOrganizationService`.
 *
 *   step 8 — one durable audit event on AUDIT_DB, both outcomes, under the
 *   REAL organization's tenant id, not ADR-035's platform sentinel
 *   (decision 4): unlike `auth.login`/`auth.logout`, a real tenant is known
 *   here — the very organization `OrganizationAccessGuard` just verified
 *   membership in — so there is a real tenant to attribute the event to,
 *   and it is readable through the ordinary `withTenantContext(db,
 *   { tenantId: organizationId, ... })` any other tenant-scoped audit row
 *   uses, not the sentinel's special-cased platform read.
 *
 * `TenantContext.tenantId` is used for exactly one thing here — naming the
 * audit event's tenant — not to open an RLS transaction the domain write
 * does not need. Reusing `OrganizationAccessGuard` anyway, rather than
 * hand-rolling a narrower "is this caller an active member" check, avoids
 * duplicating `ResolveOrganizationAccessService`'s FORBIDDEN-for-both-
 * non-member-and-revoked enumeration-avoidance behavior a second time.
 */
@Controller("api/v1/organizations/:organizationId/switch")
export class OrganizationSwitchController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(SessionGuard, OrganizationAccessGuard)
  async switchOrganization(@Req() request: RequestWithTenantContext): Promise<SwitchOrganizationOutput> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("OrganizationSwitchController.switchOrganization invoked without a resolved TenantContext.");
    }
    const identity = request.authenticatedIdentity!;
    const rlsContext = { tenantId: tenantContext.tenantId, userId: tenantContext.userId, storeId: null };

    // step 8 - durable audit, on the dedicated connection, before this
    // handler resolves either way (ADR-034), under the REAL organization's
    // tenant id (ADR-035 decision 4 — this capability has one, unlike
    // auth.login/auth.logout).
    await runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        new SwitchOrganizationService(new SessionRepositoryPg(this.appDb)).execute({
          sessionId: identity.sessionId,
          organizationId: tenantContext.tenantId,
        }),
      (outcome) =>
        new AuditEvent(
          tenantContext.tenantId,
          tenantContext.userId,
          "user",
          organizationSwitchCapability.id,
          "session",
          identity.sessionId,
          outcome,
          tenantContext.requestId,
          tenantContext.correlationId,
          { organizationId: tenantContext.tenantId },
        ),
    );

    return { activeOrganizationId: tenantContext.tenantId };
  }
}
