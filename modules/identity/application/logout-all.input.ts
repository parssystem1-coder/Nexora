import { z } from "zod";

/** Same reasoning as `logout.input.ts` — no meaningful input, tolerant of stray fields. */
export const logoutAllInputSchema = z.object({}).passthrough();

/**
 * Unlike `auth.logout`, this reports how many sessions ended — the caller
 * has no other way to know how many devices that was, and it is the one
 * piece of information this capability's own effect makes available that
 * "it happened" alone does not.
 */
export const logoutAllOutputSchema = z
  .object({
    sessionsRevoked: z.number().int().nonnegative(),
  })
  .strict();

export type LogoutAllOutputDto = z.infer<typeof logoutAllOutputSchema>;
