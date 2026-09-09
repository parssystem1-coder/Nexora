import { z } from "zod";

/**
 * `entitlement.resolve` (`05` §4.2: tenant, READ, not idempotent).
 *
 * **ADR-036's pagination contract does not apply**, and that was read rather
 * than assumed. ADR-036 governs a *collection* — its shape is
 * `{ items, nextCursor }` and its whole subject is seeking through a sequence
 * with a total order. This response is one tenant's effective entitlements: a
 * complete answer to a single question, not a page of a sequence, and it has no
 * meaningful sort key to seek on. Item 1's own contract note applies in
 * reverse — that ADR exists so a client written against one list capability
 * works against all of them, and shaping a non-collection as a collection would
 * dilute the guarantee rather than extend it.
 */
export const resolveEntitlementInputSchema = z.object({
  organizationId: z.string().uuid(),
  /** Optional: resolve one feature rather than all of them. */
  featureKey: z
    .string()
    .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/)
    .optional(),
});

export type ResolveEntitlementInput = z.infer<typeof resolveEntitlementInputSchema>;

/**
 * ADR-008's Explainability shape: "the entitlement engine must expose the final
 * resolved entitlement and, where required, the resolution source for audit and
 * debugging: `feature, state, limit, resolvedFrom[], evaluatedAt`."
 *
 * `resolvedFrom` is returned on every entry rather than "where required",
 * because the caller cannot know in advance which denial they will need
 * explained — and a denial a tenant can understand is the difference between a
 * support ticket and a self-serve upgrade.
 */
export const resolvedEntitlementSchema = z.object({
  featureKey: z.string(),
  state: z.enum(["ALLOW", "DENY", "LIMIT"]),
  limit: z.number().int().nullable(),
  resolvedFrom: z.array(z.string()),
});

export const resolveEntitlementOutputSchema = z.object({
  organizationId: z.string().uuid(),
  /** UTC ISO-8601, `05` §1. ADR-008's `evaluatedAt`. */
  evaluatedAt: z.string().datetime(),
  entitlements: z.array(resolvedEntitlementSchema),
});

export type ResolveEntitlementOutputDto = z.infer<typeof resolveEntitlementOutputSchema>;
