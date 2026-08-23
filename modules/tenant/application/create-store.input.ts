import { z } from "zod";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * Matches 05_API_CAPABILITY_CONTRACTS.md §6.1's worked example verbatim:
 * `{ organizationId, name, slug }`, all three in the body — see
 * DECISION_LOG.md "store.create: the route, and why it breaks the
 * organizationId-in-the-path pattern" for why this capability's route
 * differs from membership.invite's and membership.role.assign's.
 *
 * The slug rule mirrors `create-organization.input.ts`'s exactly (same
 * length bounds, same lowercase DNS-label-safe charset): a store slug is
 * expected to become a subdomain, same as an organization slug, so the two
 * must stay equally strict. Normalization (`.trim().toLowerCase()`) happens
 * here, in the schema, before `CreateStoreService` ever checks the slug
 * against `reserved_subdomains` — the reserved list is seeded in that same
 * normalized form, so the two cannot drift apart (DECISION_LOG.md).
 */
export const createStoreInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric segments separated by single hyphens."),
});

export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;
