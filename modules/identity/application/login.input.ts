import { z } from "zod";

/**
 * ADR-033 item 1: the single source of truth for this capability's shape.
 * 05_API_CAPABILITY_CONTRACTS.md gives auth.login no worked example, so
 * this is the first definition of it.
 *
 * No password COMPLEXITY policy is enforced here, despite ADR-029 item 2
 * requiring one: a policy applies at credential CREATION time (setting or
 * changing a password), not at verification time — you do not reject a
 * login attempt because the password the user already has on file happens
 * to be weak. This slice has no credential-creation capability (test
 * seeding creates credentials directly); the policy belongs with whichever
 * future capability adds one. The length cap here is purely defensive,
 * against an unreasonably large input reaching the hasher.
 */
export const loginInputSchema = z.object({
  email: z.string().trim().min(3).max(320).email(),
  password: z.string().min(1).max(512),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * `activeOrganizationId` is always `null` on a fresh login (DECISION_LOG.md
 * "auth.login: what active_organization_id starts as") but is still part of
 * the documented shape, since a client legitimately wants to know current
 * session state and a later slice (organization.switch) changes it.
 */
export const loginOutputSchema = z.object({
  userId: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  activeOrganizationId: z.string().uuid().nullable(),
  sessionExpiresAt: z.string().datetime(),
});

export type LoginOutputDto = z.infer<typeof loginOutputSchema>;
