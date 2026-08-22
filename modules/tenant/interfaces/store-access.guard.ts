import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB } from "../../../platform/db/connections.js";
import { CapabilityError } from "../../capability/contracts/index.js";
import type { RequestWithIdentity } from "../../identity/contracts/index.js";
import { StoreMembershipRepositoryPg } from "../infrastructure/store-membership.repository.pg.js";
import { MembershipRepositoryPg } from "../infrastructure/membership.repository.pg.js";
import { ResolveStoreAccessService } from "../application/resolve-store-access.service.js";
import { readStoreInputSchema } from "../application/read-store.input.js";

export interface TenantContext {
  tenantId: string;
  userId: string;
  storeId: string;
  membershipId: string;
  requestId: string;
  correlationId: string;
  actorType: "user";
}

export type RequestWithTenantContext = RequestWithIdentity & { tenantContext?: TenantContext };

/**
 * 08_PHASE_1_BRIEF.md §2 steps 2-4: resolve organization membership, check
 * store access (ADR-002 — storeId is always an explicit path input, never
 * derived from the token), build the trusted TenantContext. Must run after
 * SessionGuard. Uses the bootstrap RLS phase — app.user_id set, app.tenant_id
 * still null — see DECISION_LOG.md "RLS bootstrap...". `db` is injected via
 * the explicit APP_DB token — see platform/db/connections.ts.
 */
@Injectable()
export class StoreAccessGuard implements CanActivate {
  constructor(@Inject(APP_DB) private readonly db: Kysely<Database>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenantContext & Request & { requestId?: string; correlationId?: string }>();
    const identity = request.authenticatedIdentity;
    if (!identity) {
      throw new CapabilityError("AUTHENTICATION_REQUIRED", "StoreAccessGuard ran before SessionGuard established an identity.");
    }

    const parsed = readStoreInputSchema.safeParse({ storeId: request.params["storeId"] });
    if (!parsed.success) {
      throw new CapabilityError("VALIDATION_ERROR", "storeId must be a valid UUID.", {
        issues: parsed.error.issues,
      });
    }
    const { storeId } = parsed.data;

    const access = await withTenantContext(this.db, { tenantId: null, userId: identity.userId, storeId: null }, (trx) => {
      const service = new ResolveStoreAccessService(new StoreMembershipRepositoryPg(trx), new MembershipRepositoryPg(trx));
      return service.execute(identity.userId, storeId);
    });

    request.tenantContext = {
      tenantId: access.tenantId,
      userId: identity.userId,
      storeId: access.storeId,
      membershipId: access.membershipId,
      requestId: request.requestId ?? "",
      correlationId: request.correlationId ?? "",
      actorType: "user",
    };
    return true;
  }
}
