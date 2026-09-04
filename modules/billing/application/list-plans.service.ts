import { CapabilityError } from "../../capability/contracts/index.js";
import { decodeCursor, encodeCursor, InvalidCursorError } from "../../../platform/pagination/cursor.js";
import type { Clock } from "../../../platform/clock.js";
import type { PlanRepository } from "../domain/plan.repository.js";
import type { ListPlansOutputDto } from "./list-plans.input.js";

/**
 * The capability id and sort order a `plan.list` cursor is bound to. Both are
 * checked on decode, so a cursor issued by another list capability — or by
 * this one under a different order, should one ever be offered — is rejected
 * rather than silently seeking into the wrong sequence (ADR-036 item 5).
 *
 * `key:asc` is a **total** order (ADR-036 item 6): `plans.key` is UNIQUE, so
 * no tiebreaker is appended. A non-total order is what makes keyset
 * pagination skip or duplicate rows at a page boundary.
 */
const CAPABILITY_ID = "plan.list";
const SORT_ORDER = "key:asc";

export interface ListPlansCommand {
  limit: number;
  cursor?: string | undefined;
}

/**
 * `PHASE_2_BRIEF.md` §2's reference-slice capability: a collection read of
 * platform-global reference data.
 *
 * It opens no transaction and takes no repository transaction handle, and
 * that is the same reasoning `auth.login` and `auth.logout` recorded rather
 * than a new one: every table it touches (`plans`, `plan_versions`,
 * `plan_features`) is RLS-exempt by `PHASE_2_BRIEF.md` §5, and this is a
 * read. `platform/db/tenant-context.ts` stays the only place a transaction is
 * ever opened in this codebase (ADR-030's singleton rule); this capability
 * simply never needs one.
 *
 * Consistency across the two statements the repository issues is therefore
 * not transactional. That is acceptable here and is worth stating rather than
 * leaving to be discovered: the only writer to these tables is a migration
 * (D2-11 — no capability creates or edits a plan in Phase 2), so there is no
 * concurrent mutation for a read to tear against. **The first thing that
 * publishes a plan version at runtime — ruling ح-2's Phase 2.5 capability —
 * is what changes that**, and it should revisit this comment rather than
 * assume it still holds.
 */
export class ListPlansService {
  constructor(
    private readonly plans: PlanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: ListPlansCommand): Promise<ListPlansOutputDto> {
    const afterKey = this.resolveAfterKey(command.cursor);

    const page = await this.plans.listByKey({
      limit: command.limit,
      ...(afterKey === undefined ? {} : { afterKey }),
      asOf: this.clock.now(),
    });

    const items = page.plans.map((plan) => ({
      key: plan.key,
      planVersionId: plan.currentVersion.id,
      version: plan.currentVersion.version,
      trialPeriodDays: plan.currentVersion.trialPeriodDays,
      featureKeys: [...plan.featureKeys],
    }));

    const last = items.at(-1);
    const nextCursor =
      page.hasMore && last
        ? encodeCursor({ capabilityId: CAPABILITY_ID, sortOrder: SORT_ORDER, sortKey: last.key })
        : null;

    return { items, nextCursor };
  }

  /**
   * ADR-036 item 8: a malformed cursor, or one issued for a different
   * capability or sort order, is `VALIDATION_ERROR` — "a client error ... the
   * same as any other bad input". No new error code is required and none was
   * requested of `05` §7.
   */
  private resolveAfterKey(cursor: string | undefined): string | undefined {
    if (cursor === undefined) return undefined;
    try {
      return decodeCursor(cursor, { capabilityId: CAPABILITY_ID, sortOrder: SORT_ORDER }).sortKey;
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw new CapabilityError("VALIDATION_ERROR", err.message, { field: "cursor" });
      }
      throw err;
    }
  }
}
