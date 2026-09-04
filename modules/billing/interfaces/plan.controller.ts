import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { APP_DB, AUDIT_DB } from "../../../platform/db/connections.js";
import { systemClock } from "../../../platform/clock.js";
import { SessionGuard } from "../../identity/contracts/index.js";
import type { RequestWithIdentity } from "../../identity/contracts/index.js";
import { CapabilityError, runCapabilityAttempt } from "../../capability/contracts/index.js";
import { AuditEvent, PLATFORM_TENANT_ID } from "../../audit/contracts/index.js";
import { planListCapability } from "./plan-list.capability.js";
import { listPlansInputSchema } from "../application/list-plans.input.js";
import type { ListPlansOutputDto } from "../application/list-plans.input.js";
import { ListPlansService } from "../application/list-plans.service.js";
import { PlanRepositoryPg } from "../infrastructure/plan.repository.pg.js";

type PlanListRequest = RequestWithIdentity & { requestId?: string; correlationId?: string };

/**
 * `GET /api/v1/plans` — Phase 2 item 1, the phase's reference slice
 * (`PHASE_2_BRIEF.md` §2). Mirrors the golden path's structure; where it
 * diverges, the reason is recorded rather than left to be inferred.
 *
 * Pipeline accounting, in the shape `auth.logout` established for a
 * capability with no tenant:
 *
 *   step 1 — `SessionGuard`, unchanged. See the capability definition for why
 *   this read is authenticated at all when nothing rules it so.
 *
 *   steps 2-4 — do not apply. `05` §4.2 scopes `plan.list` **global**: there
 *   is no organization or store to resolve and no resource id to accept. This
 *   is `PHASE_2_BRIEF.md` §2's second point — "the first capability whose
 *   guard chain cannot rely on `app.tenant_id` to constrain a result set" —
 *   and the constraint is genuinely absent rather than replaced by another:
 *   the catalogue is identical for every caller, so there is nothing to
 *   narrow it to.
 *
 *   step 5 — no transaction. All three tables are RLS-exempt
 *   (`PHASE_2_BRIEF.md` §5) and this is a read, so there is nothing for
 *   `withTenantContext` to establish. `platform/db/tenant-context.ts` remains
 *   the only place a transaction is ever opened in this codebase (ADR-030's
 *   singleton rule) — this capability simply never needs one, exactly as
 *   `auth.login` and `auth.logout` never did.
 *
 *   step 6 — no permission to assert; no membership exists to assert one
 *   against. See the capability definition.
 *
 *   step 7 — `ListPlansService`.
 *
 *   step 8 — one durable audit event on AUDIT_DB via `runCapabilityAttempt`,
 *   both outcomes, under ADR-035's platform sentinel tenant. `plan.list` is
 *   its fourth user and its first non-identity one: the sentinel exists for a
 *   capability with no tenant to attribute to, and a global catalogue read is
 *   precisely that.
 *
 *   steps 9-10 — unchanged: the stable error envelope via `CapabilityError`,
 *   and structured logging.
 *
 * `resource_id` on the audit event is the capability's own route rather than
 * a row id, because a collection read names no single resource. That is a
 * deliberate choice of the honest value available: `audit_events.resource_id`
 * is NOT NULL, and inventing a per-request uuid would fabricate an identifier
 * that refers to nothing and cannot be joined to anything.
 */
@Controller("api/v1/plans")
export class PlanController {
  constructor(
    @Inject(APP_DB) private readonly appDb: Kysely<Database>,
    @Inject(AUDIT_DB) private readonly auditDb: Kysely<Database>,
  ) {}

  @Get()
  @UseGuards(SessionGuard)
  async list(@Req() request: PlanListRequest, @Query() query: unknown): Promise<ListPlansOutputDto> {
    const identity = request.authenticatedIdentity;
    if (!identity) {
      // SessionGuard runs first and always populates this; a gap here is a wiring bug, not a client error.
      throw new Error("PlanController.list invoked without an authenticated identity.");
    }

    const requestId = request.requestId ?? "";
    const correlationId = request.correlationId ?? "";
    const rlsContext = { tenantId: PLATFORM_TENANT_ID, userId: null, storeId: null };

    return runCapabilityAttempt(
      this.auditDb,
      rlsContext,
      async () => {
        const parsed = listPlansInputSchema.safeParse(query ?? {});
        if (!parsed.success) {
          throw new CapabilityError("VALIDATION_ERROR", "Invalid plan list query.", {
            issues: parsed.error.issues,
          });
        }

        return new ListPlansService(new PlanRepositoryPg(this.appDb), systemClock).execute({
          limit: parsed.data.limit,
          cursor: parsed.data.cursor,
        });
      },
      (outcome) =>
        new AuditEvent(
          PLATFORM_TENANT_ID,
          identity.userId,
          "user",
          planListCapability.id,
          "plan_catalogue",
          planListCapability.route.path,
          outcome,
          requestId,
          correlationId,
        ),
    );
  }
}
