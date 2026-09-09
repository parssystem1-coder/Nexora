import { z } from "zod";

/**
 * `subscription.cancel` (`05` §4.2: tenant, HIGH_WRITE, idempotency **yes**).
 *
 * The organization is the whole input: Phase 2 has one subscription per
 * organization, so naming it in the path identifies the subscription without a
 * second id the caller would have to fetch first. When item 15 or a later phase
 * allows more than one, this gains a subscription id — an additive change to a
 * path that already carries the organization.
 */
export const cancelSubscriptionInputSchema = z.object({
  organizationId: z.string().uuid(),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionInputSchema>;

export { subscriptionOutputSchema } from "./subscribe-to-plan.input.js";
export type { SubscriptionDto } from "./subscribe-to-plan.input.js";
