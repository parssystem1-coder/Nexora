import { z } from "zod";
import { organizationScopeSchema } from "./organization-scope.input.js";
import { ROLE_KEYS } from "../../authorization/contracts/index.js";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * `organizationId` and `membershipId` come from the path (ADR-002: the
 * organization scope is never derived from the session, and the target
 * membership is always an explicit resource id, never inferred); `roleKey`
 * from the body. The path/body split is declared on the capability
 * definition's `route.pathParams`, not here.
 *
 * `roleKey` is a Zod enum over `ROLE_KEYS` — modules/authorization's own
 * closed catalog, not a free string — so an unknown role key fails as a
 * plain VALIDATION_ERROR at this boundary rather than reaching the database
 * at all. See DECISION_LOG.md "membership.role.assign: unknown role key maps
 * to VALIDATION_ERROR, not a new domain error".
 */
export const assignMembershipRoleInputSchema = organizationScopeSchema.extend({
  membershipId: z.string().uuid(),
  roleKey: z.enum(ROLE_KEYS),
});

export type AssignMembershipRoleInput = z.infer<typeof assignMembershipRoleInputSchema>;

/**
 * 05_API_CAPABILITY_CONTRACTS.md §1: timestamps cross a boundary as UTC
 * ISO-8601. Represents the grant created — "assign" adds one role to a
 * membership's set, it does not replace it (DECISION_LOG.md "membership.role
 * .assign: add-one semantics, not replace-the-set"), so the DTO names one
 * grant, not a roles array.
 */
export const membershipRoleOutputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  membershipId: z.string().uuid(),
  roleKey: z.enum(ROLE_KEYS),
  createdAt: z.string().datetime(),
});
