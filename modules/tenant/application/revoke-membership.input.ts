import { z } from "zod";
import { organizationScopeSchema } from "./organization-scope.input.js";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * `organizationId` and `membershipId` both come from the path; there is no
 * body field at all, the same shape `organization.switch` has.
 */
export const revokeMembershipInputSchema = organizationScopeSchema.extend({
  membershipId: z.string().uuid(),
});

export type RevokeMembershipInput = z.infer<typeof revokeMembershipInputSchema>;
