/**
 * The closed set of platform-defined role keys. Phase 1 does not support
 * tenant-custom roles (DECISION_LOG.md "roles/permissions/role_permissions
 * are platform-global...", seeded once by
 * 20260822090600_authorization__create_permission_catalog.sql), so this list
 * is not read from the database — it IS the catalog, mirrored here so a
 * client-supplied role key can be validated at the Zod boundary rather than
 * only discovered missing after a query.
 *
 * Adding a fourth role is a schema change (a new migration seeding it) and a
 * one-line change here, done together — never independently, or this list
 * and the `roles` table silently disagree.
 */
export const ROLE_KEYS = ["owner", "admin", "member"] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
