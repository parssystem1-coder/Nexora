import { z } from "zod";

/**
 * ADR-033 item 1: the Zod schema is the single source of truth for this
 * capability's shape. `tools/openapi/generate.ts` reads exactly these
 * objects, so nothing describes the contract twice.
 *
 * The slug rule is 04_DATABASE_BLUEPRINT.md §5's "organization slug unique
 * within its namespace" plus a DNS-label-safe character set: organizations
 * are the namespace stores are created under, and a slug that cannot appear
 * in a hostname would have to be re-validated later under ADR-028's rules.
 * Rejecting a leading/trailing hyphen and enforcing 3-63 characters here
 * costs nothing and keeps that door open.
 *
 * `reserved_subdomains` is deliberately NOT consulted: 08_PHASE_1_BRIEF.md §5
 * and 04 §5 scope that rejection to *store* slug creation, and the table
 * itself belongs to the store.create slice.
 */
export const createOrganizationInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric segments separated by single hyphens."),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;

/** 05_API_CAPABILITY_CONTRACTS.md §1: timestamps cross a boundary as UTC ISO-8601. */
export const organizationOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  createdAt: z.string().datetime(),
});
