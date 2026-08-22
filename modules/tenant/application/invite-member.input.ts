import { z } from "zod";
import { organizationScopeSchema } from "./organization-scope.input.js";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * `organizationId` comes from the path and `email` from the body; the split
 * is declared on the capability definition's `route.pathParams`, not here,
 * so the schema stays a description of the logical input.
 *
 * The address is only trimmed, not lower-cased: case folding for lookup is
 * modules/identity's rule (`normalizeEmail`, applied by the repository that
 * queries `users.email_normalized`), and duplicating it here would be a
 * second place for it to drift.
 */
export const inviteMemberInputSchema = organizationScopeSchema.extend({
  email: z.string().trim().min(3).max(320).email(),
});

export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>;

/** 05_API_CAPABILITY_CONTRACTS.md §1: timestamps cross a boundary as UTC ISO-8601. */
export const membershipOutputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(["ACTIVE", "REVOKED"]),
  createdAt: z.string().datetime(),
});
