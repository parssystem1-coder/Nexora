import { z } from "zod";
import { organizationScopeSchema } from "./organization-scope.input.js";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * Nothing beyond `organizationId` — unlike `membership.invite`'s `email` or
 * `membership.role.assign`'s `roleKey`, this capability has no body field at
 * all, so there is nothing to `.extend()`. Kept as its own named export
 * rather than importing `organizationScopeSchema` directly at the call
 * sites, so a future field never has to rename the capability's own schema.
 */
export const switchOrganizationInputSchema = organizationScopeSchema;

export type SwitchOrganizationInput = z.infer<typeof switchOrganizationInputSchema>;

/**
 * Confirms which organization is now active on the caller's session — a
 * client acting on the response alone (rather than re-reading its own
 * request) needs to know the switch actually took effect, not merely that
 * the request returned 200.
 */
export const switchOrganizationOutputSchema = z.object({
  activeOrganizationId: z.string().uuid(),
});

export type SwitchOrganizationOutput = z.infer<typeof switchOrganizationOutputSchema>;
