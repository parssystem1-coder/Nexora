import { z } from "zod";

/**
 * ADR-036 item 2's request shape: "two optional parameters — `limit`
 * (integer, capability-declared default and maximum) and `cursor` (opaque
 * string). Absent `cursor` means the first page." Both are declared here, in
 * the Zod schema, precisely so they reach the generated OpenAPI artifact
 * (ADR-033) — ADR-036's own verification list requires the artifact to
 * document `limit`, `cursor` and `nextCursor` for every paginated capability.
 *
 * They arrive as query parameters, so `limit` is coerced from its string
 * form. `z.coerce.number()` alone would accept `"abc"` as NaN, so the chain
 * pins integer-ness and the declared bounds after coercion.
 */
export const PLAN_LIST_DEFAULT_LIMIT = 50;
export const PLAN_LIST_MAX_LIMIT = 100;

export const listPlansInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(PLAN_LIST_MAX_LIMIT).default(PLAN_LIST_DEFAULT_LIMIT),
  cursor: z.string().min(1).optional(),
});

export type ListPlansInput = z.infer<typeof listPlansInputSchema>;

/**
 * ADR-036 item 3's response shape: `{ items, nextCursor }`, with `nextCursor`
 * null when no further page exists, and **no total count** — "a count
 * requires a second scan of the full result set, which defeats the reason
 * keyset was chosen."
 *
 * Item 4 is the one a later reader is most likely to erode: `plan.list` will
 * normally return every row with `nextCursor: null`, and that is "this
 * contract at its natural bound, not a second style". It is explicitly not
 * licence to reshape this into a bare array later on the grounds that the
 * collection is small.
 *
 * No money crosses this boundary. `PHASE_2_BRIEF.md` §2 puts prices in item 2
 * and keeps `MoneyDto` out of the reference slice deliberately.
 */
export const planOutputSchema = z.object({
  /** ADR-044: the machine key. The client maps it to display text. */
  key: z.string(),
  /** What `plan.subscribe` pins (ADR-025 item 6), so a client can pass it back. */
  planVersionId: z.string().uuid(),
  version: z.number().int(),
  /** ADR-052: 0 means this version offers no trial. */
  trialPeriodDays: z.number().int(),
  /** Feature keys this version grants (`PHASE_2_BRIEF.md` §4). */
  featureKeys: z.array(z.string()),
});

export const listPlansOutputSchema = z.object({
  items: z.array(planOutputSchema),
  nextCursor: z.string().nullable(),
});

export type PlanDto = z.infer<typeof planOutputSchema>;
export type ListPlansOutputDto = z.infer<typeof listPlansOutputSchema>;
