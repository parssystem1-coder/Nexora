import { z } from "zod";

/**
 * `overlimit.read` (`05` §4.2: tenant, READ, not idempotent), assigned to item 8
 * by `PHASE_2_BRIEF.md` §3(a) — EXPLICIT there.
 *
 * **ADR-036 does not apply**, decided rather than assumed and for the same
 * reason item 6 gave for `entitlement.resolve`. ADR-036 governs a *collection*:
 * `{ items, nextCursor }`, a keyset seek through a sequence, and item 6 of that
 * ADR requires "the sort key must be unique or be made unique by appending a
 * tiebreaker". **This response is a complete answer over a closed vocabulary of
 * three** — ruling ب-4's list — so it has no sequence to seek through and no
 * page boundary to be correct at. Its size is fixed by a ruling, not by tenant
 * data.
 */
export const readOverLimitInputSchema = z.object({
  organizationId: z.string().uuid(),
});

export type ReadOverLimitInput = z.infer<typeof readOverLimitInputSchema>;

/**
 * **Three states, not two, which is why this is not a boolean per resource.**
 *
 * ADR-026 item 4 requires the tenant be told "which resource, the current count,
 * the new limit, exactly which operations are now blocked, and how to resolve
 * it", and calls a generic message insufficient. `blockedOperations` and
 * `resolution` carry the last two; the first three are the fields beside them.
 *
 * **ADR-042 governs the audience.** These are machine-readable keys, not
 * sentences: that ADR ruled no localization work is owed in Phase 2, and a
 * tenant-facing string built here would be an interface concern rendered in the
 * wrong layer — the same reasoning ADR-044 applies to plan names.
 */
export const resourceOverLimitSchema = z.object({
  resource: z.enum(["members", "stores", "domains"]),
  state: z.enum(["WITHIN_LIMIT", "OVER_LIMIT", "NOT_EVALUABLE"]),
  /** Null when not evaluable — never zero, which would read as "none used". */
  currentCount: z.number().int().nullable(),
  limit: z.number().int().nullable(),
  /** Set only when `state` is `NOT_EVALUABLE`. */
  reason: z.enum(["NO_COUNTABLE_SOURCE", "NO_LIMIT_RESOLVED"]).nullable(),
  /** ADR-026 item 4. Empty unless over limit; ADR-026 item 1 blocks creation only. */
  blockedOperations: z.array(z.string()),
  /** ADR-026 item 5's two paths, as keys rather than prose. */
  resolution: z.array(z.enum(["upgrade", "reduce"])),
  /** ADR-026's `entered_at`, when something has recorded a crossing. Null otherwise. */
  enteredAt: z.string().datetime().nullable(),
});

export const readOverLimitOutputSchema = z.object({
  organizationId: z.string().uuid(),
  evaluatedAt: z.string().datetime(),
  /** True when any resource is `OVER_LIMIT`. Never true on the strength of a `NOT_EVALUABLE`. */
  anyOverLimit: z.boolean(),
  resources: z.array(resourceOverLimitSchema),
});

export type ReadOverLimitOutputDto = z.infer<typeof readOverLimitOutputSchema>;
