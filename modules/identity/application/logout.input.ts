import { z } from "zod";

/**
 * ADR-033 item 1. `auth.logout` takes no meaningful input at all — the
 * session it ends is the one `SessionGuard` already resolved from the
 * cookie, never a client-supplied id (a client naming a DIFFERENT session
 * would make this capability something else entirely, and ADR-002's "never
 * derive from the token alone, but also never let the token alone name
 * someone else's resource" cuts the other way here: there is nothing for
 * the client to name). `.passthrough()` rather than `.strict()`: an empty or
 * absent JSON body is the expected shape, but there is nothing worth
 * rejecting a request over if a client sends stray fields — this capability
 * ignores its body entirely, so failing on unrecognized-but-harmless input
 * would be validating a contract that was never meant to be load-bearing.
 */
export const logoutInputSchema = z.object({}).passthrough();

/**
 * `{}` — logout has nothing more to report than "it happened." `.strict()`
 * here (unlike the input schema) because this is the shape the platform
 * itself produces, not one it has to tolerate variation in.
 */
export const logoutOutputSchema = z.object({}).strict();

export type LogoutOutputDto = z.infer<typeof logoutOutputSchema>;
