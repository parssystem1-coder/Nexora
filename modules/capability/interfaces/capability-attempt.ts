import { Logger } from "@nestjs/common";
import type { Kysely } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { RlsContext } from "../../../platform/db/tenant-context.js";
import { AuditEvent, recordAuditEventDurable } from "../../audit/contracts/index.js";
import type { AuditOutcome } from "../../audit/contracts/index.js";

const logger = new Logger("CapabilityAttempt");

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
 * `DECISION_LOG.md` 2026-08-31 ("Closing Phase 1 debt D-3") for why the
 * line is here and not further in.
 *
 * R-009 FIX (`RISK_REGISTER.md`, `DECISION_LOG.md` 2026-08-31 "R-009
 * fixed"): the audit write below is wrapped in its own `try/catch` and its
 * failure is deliberately swallowed-and-logged, never rethrown. Before this
 * fix, a throwing audit write propagated unguarded, which meant a
 * capability whose domain work had already genuinely succeeded could still
 * report a failure to its caller — the exact defect R-009 tracked, now
 * fixed in the one place it can be fixed once instead of ten. The decision,
 * deliberate rather than an implementation detail (ADR-034 is silent on
 * what should happen when its own step 8 write fails):
 *   - the domain outcome — `thrown` if the work threw, `result` if it
 *     didn't — is what the caller sees, regardless of whether the audit
 *     write itself succeeded. A client must never see a failure for an
 *     operation that actually committed, which is worse than a rare,
 *     logged gap in the audit trail.
 *   - the audit write's own failure is logged (`Logger`, matching
 *     `HttpExceptionFilter`'s own convention) with enough of the built
 *     event's fields to find the request, and swallowed — never allowed to
 *     override or mask the domain outcome, including a domain FAILURE:
 *     the original domain error is still what gets rethrown, not the
 *     audit-write error.
 *   - this is an extension of ADR-034's own "Accepted residual cost" (a
 *     crash between the domain transaction resolving and the audit write
 *     completing can leave a committed effect with no audit record) to
 *     cover the write itself throwing, not just a crash before it starts.
 *     Closing that gap fully would mean putting the audit row in the
 *     domain transaction, which ADR-034 already rejected for losing every
 *     failure audit — the identical trade-off, not a new one.
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
  // handler resolves either way (ADR-034). Its own failure must not
  // override the domain outcome above — see this function's doc comment,
  // "R-009 FIX".
  const event = buildEvent(outcome, result);
  try {
    await recordAuditEventDurable(auditDb, rlsContext, event);
  } catch (auditError) {
    logger.error(
      `Audit write failed for capability '${event.capability}' (outcome=${event.outcome}, resourceType=${event.resourceType}, resourceId=${event.resourceId}, requestId=${event.requestId}, correlationId=${event.correlationId}) — the domain outcome is still what the caller sees, per R-009's fix.`,
      auditError instanceof Error ? auditError.stack : String(auditError),
    );
  }

  // `thrown` is a faithful passthrough of whatever `work()` itself threw, not
  // a new value being thrown here — this codebase's own convention is to
  // only ever throw real Error subclasses (CapabilityError, etc.), but
  // TypeScript types a catch clause's binding as `unknown`, which is exactly
  // what flows into `thrown`, so the rule cannot see that convention holds.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (thrown) throw thrown;
  return result!;
}
