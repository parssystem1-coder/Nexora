import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { withTenantContext } from "../../../platform/db/tenant-context.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import { CheckPermissionService, PermissionCheckRepositoryPg } from "../../authorization/contracts/index.js";
import { runCapabilityAttempt } from "../../capability/contracts/index.js";
import { AuditEvent } from "../../audit/contracts/index.js";
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
 * `runCapabilityAttempt` (`modules/capability/interfaces/capability-attempt.ts`)
 * is the outcome-tracking + audit-write + rethrow tail every one of Phase
 * 1's ten controllers shared byte-for-byte — extracted once, in
 * `PHASE_1_DEBT_CLOSURE.md` D-3, not deferred any further. **This is not
 * Phase 5's "capability registry and policy pipeline"** — that generalized
 * pipeline (resolving a `CapabilityDefinition`, choosing a guard chain,
 * choosing whether a transaction opens at all) remains Phase 5's scope,
 * deliberately; this extraction only pulled forward the one piece that was
 * already, provably, identical everywhere. What still lives here, not in
 * the shared helper, is exactly what differs by capability: which guards
 * ran, whether/how a transaction opens, and what the audit event's own
 * fields are — see DECISION_LOG.md 2026-08-30 for the full boundary
 * reasoning and what was deliberately left alone.
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

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      () =>
        withTenantContext(this.appDb, rlsContext, async (trx) => {
          // step 6 — permission authorization
          const permissions = new CheckPermissionService(new PermissionCheckRepositoryPg(trx));
          for (const permission of storeReadCapability.requiredPermissions) {
            await permissions.assert(tenantContext.tenantId, tenantContext.membershipId, permission);
          }

          // step 7 — application service execution + domain mapping
          return new ReadStoreService(new StoreRepositoryPg(trx)).execute({ storeId: tenantContext.storeId });
        }),
      (outcome) =>
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
  }
}
