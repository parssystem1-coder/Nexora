/**
 * Grants a platform-defined role (roles.key) to a membership.
 *
 * A port rather than a direct table write from modules/tenant:
 * `membership_roles` is owned by modules/authorization
 * (04_DATABASE_BLUEPRINT.md), and no module may reach into another module's
 * internals — only its `contracts/` (ADR-030 dependency-direction rule).
 * organization.create needs this because an organization with no role-bearing
 * member is unusable: every later capability's permission check
 * (08_PHASE_1_BRIEF.md §2 step 6) reads membership_roles.
 */
export interface RoleGrantRepository {
  /** Throws if `roleKey` is not in the platform role catalog — that is a wiring bug, not a client error. */
  grantRoleByKey(tenantId: string, membershipId: string, roleKey: string): Promise<void>;
}
