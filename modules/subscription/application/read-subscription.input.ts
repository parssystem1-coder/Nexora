import { z } from "zod";

/** `subscription.read` (`05` §4.2: tenant, READ, not idempotent). */
export const readSubscriptionInputSchema = z.object({
  organizationId: z.string().uuid(),
});

export type ReadSubscriptionInput = z.infer<typeof readSubscriptionInputSchema>;

export { subscriptionOutputSchema } from "./subscribe-to-plan.input.js";
export type { SubscriptionDto } from "./subscribe-to-plan.input.js";
