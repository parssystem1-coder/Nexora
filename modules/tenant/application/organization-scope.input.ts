import { z } from "zod";

/**
 * The explicit organization id every tenant-scoped capability takes as a path
 * parameter. ADR-002: the tenant is never derived from the session token, so
 * `sessions.active_organization_id` is a UI convenience and is deliberately
 * not consulted when deciding which tenant a request acts on.
 *
 * Shared by OrganizationAccessGuard (which validates it before resolving
 * membership) and by each org-scoped capability's own input schema, which
 * extends it - one definition, so the guard and the capability cannot
 * disagree about what a valid organization id looks like.
 */
export const organizationScopeSchema = z.object({
  organizationId: z.string().uuid(),
});

export type OrganizationScope = z.infer<typeof organizationScopeSchema>;
