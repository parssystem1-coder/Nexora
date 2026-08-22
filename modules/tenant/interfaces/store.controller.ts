import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { AuditEvent, recordAuditEventDurable, type AuditOutcome } from "../../audit/contracts/index.js";
import { StoreAccessGuard } from "./store-access.guard.js";
import type { RequestWithStoreTenantContext } from "./store-access.guard.js";
import { storeReadCapability } from "./store-read.capability.js";
import { StoreRepositoryPg } from "../infrastructure/store.repository.pg.js";
import { ReadStoreService } from "../application/read-store.service.js";
import type { StoreDto } from "../contracts/index.js";

/**
 * The golden path: GET /api/v1/stores/{storeId} (08_PHASE_1_BRIEF.md §2).
 *
 * Pipeline ordering is normative:
 *
 *   steps 1-4, BEFORE any transaction — authenticate (SessionGuard), resolve
 *   membership + explicit storeId, store access check, build TenantContext
 *   (StoreAccessGuard). The brief places these ahead of step 5 deliberately:
 *   they are what establishes *which* tenant may be trusted, so they cannot
 *   already be running inside that tenant's context.
 *
 *   steps 5-7, inside one transaction on APP_DB opened here by the single
 *   helper — authorize permission, then execute the application service.
 *   One transaction, not two: a permission checked in a transaction that
 *   has already committed is a check against stale state (DECISION_LOG.md
 *   "Pipeline step 6 must share the transaction with steps 7-8").
 *
 *   step 8 — audit — is deliberately NOT inside that transaction. Per
 *   08_PHASE_1_BRIEF.md §2 step 8 (amended) and DECISION_LOG.md's
 *   audit-placement entry (option B), the event is written on AUDIT_DB, a
 *   connection independent of APP_DB, and that write completes *before*
 *   this handler returns or throws — i.e. before the APP_DB transaction's
 *   outcome is what the caller sees — so the record survives whichever way
 *   that transaction resolves. One audit event covers the whole step 6-7
 *   attempt: if permission authorization (step 6) fails, ReadStoreService
 *   (step 7) never even runs, so there is exactly one outcome to record,
 *   not two.
 *
 * The body is composition (build repositories bound to `trx`, run them in
 * order, record one outcome), not business logic: no branch here decides a
 * business outcome, only observes one already decided by step 6 or step 7.
 * Generalizing this wiring into a reusable policy pipeline is Phase 5's
 * "capability registry and policy pipeline", deliberately not built ahead of
 * having more than one capability to generalize from — see DECISION_LOG.md.
 */
@Controller("api/v1/stores")
export class StoreController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Get(":storeId")
  @UseGuards(SessionGuard, StoreAccessGuard)
  async read(@Req() request: RequestWithStoreTenantContext): Promise<StoreDto> {
    const tenantContext = request.tenantContext;
    if (!tenantContext) {
      // Guards run first and always populate this; a missing context here is a wiring bug, not a client error.
      throw new Error("StoreController.read invoked without a resolved TenantContext.");
    }

    const rlsContext = {
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      storeId: tenantContext.storeId,
    };

    let outcome: AuditOutcome = "SUCCESS";
    let result: StoreDto | undefined;
    let thrown: unknown;

    try {
      result = await withTenantContext(this.appDb, rlsContext, async (trx) => {
        // step 6 — permission authorization
        const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
        for (const permission of storeReadCapability.requiredPermissions) {
          await permissions.assert(tenantContext.tenantId, tenantContext.membershipId, permission);
        }

        // step 7 — application service execution + domain mapping
        return new ReadStoreService(new StoreRepositoryPg(trx)).execute({ storeId: tenantContext.storeId });
      });
    } catch (err) {
      outcome = "FAILURE";
      thrown = err;
    }

    // step 8 — durable audit, on the dedicated connection, before this
    // handler resolves either way (option B).
    await recordAuditEventDurable(
      this.auditDb,
      rlsContext,
      new AuditEvent(
        tenantContext.tenantId,
        tenantContext.userId,
        "user",
        storeReadCapability.id,
        "store",
        tenantContext.storeId,
        outcome,
        tenantContext.requestId,
        tenantContext.correlationId,
      ),
    );

    if (thrown) throw thrown;
    return result!;
  }
}
