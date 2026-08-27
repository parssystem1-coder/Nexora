import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { RlsContext } from "../../../platform/db/tenant-context.js";
import { AuditEvent, recordAuditEventDurable } from "../../audit/contracts/index.js";
import type { AuditOutcome } from "../../audit/contracts/index.js";

/**
 * `PHASE_1_DEBT_CLOSURE.md` D-3: the composition every one of Phase 1's ten
 * controllers repeated by hand — run the capability's own work, track
 * whether it succeeded, write exactly one audit event covering the attempt
 * unconditionally (ADR-034), then resolve the same way the work itself did.
 * Extracted here once real duplication existed to extract from (ten
 * capabilities, not the golden path alone) and R-009 gave a correctness
 * reason to have exactly one copy, not just a tidiness one.
 *
 * What is genuinely identical across all ten controllers, and therefore
 * lives here: the SHAPE of "try the work, remember outcome and the thrown
 * error if any, write one audit event, then rethrow or return." What is
 * NOT identical, and therefore stays a parameter or stays in the
 * controller rather than becoming a branch in here: whether `work` opens a
 * transaction at all (`auth.login`/`auth.logout`/`auth.logout_all` do not —
 * see their own controllers) or which one (every other capability opens
 * its own via `withTenantContext`); which guard chain ran before this
 * point; which tenant id the audit event is attributed to (a capability's
 * real tenant, or ADR-035's platform sentinel); and what the audit event's
 * `resourceType`/`resourceId`/`metadata` actually are, which is exactly
 * why `buildEvent` receives the outcome and result rather than this
 * function trying to derive them generically. A capability whose shape does
 * not fit this — none currently exist, but `AGENTS.md` §2's own rule
 * applies here too — should stay hand-rolled rather than be forced in.
 *
 * SCOPE CEILING, recorded so the boundary is explicit rather than
 * discovered by someone reading past it: this is not Phase 5's "capability
 * registry and policy pipeline" (`store.controller.ts`'s own doc comment
 * names that as deferred work). It does not know what a capability IS,
 * does not resolve guards, does not read a `CapabilityDefinition`, and does
 * not choose a transaction strategy. It is the minimal, genuinely-identical
 * tail every controller already had, pulled into one place. See
 * `DECISION_LOG.md` 2026-08-30 ("D-3: the line between this extraction and
 * Phase 5") for why the line is here and not further in.
 */
export async function runCapabilityAttempt<T>(
  auditDb: Kysely<Database>,
  rlsContext: RlsContext,
  work: () => Promise<T>,
  buildEvent: (outcome: AuditOutcome, result: T | undefined) => AuditEvent,
): Promise<T> {
  let outcome: AuditOutcome = "SUCCESS";
  let result: T | undefined;
  let thrown: unknown;

  try {
    result = await work();
  } catch (err) {
    outcome = "FAILURE";
    thrown = err;
  }

  // step 8 - durable audit, on the dedicated connection, before this
  // handler resolves either way (ADR-034).
  await recordAuditEventDurable(auditDb, rlsContext, buildEvent(outcome, result));

  if (thrown) throw thrown;
  return result!;
}
