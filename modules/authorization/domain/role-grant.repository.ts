import type { RoleKey } from "./role-key.vo.js";

/**
 * Raised when `roleKey` names no row in the platform role catalog.
 *
 * For `organization.create`'s hardcoded `"owner"` grant this would be a
 * wiring bug — the catalog is seeded by migration and `"owner"` always
 * exists. For `membership.role.assign` it is structurally unreachable
 * through the API: that capability's input schema restricts `roleKey` to
 * {@link RoleKey} via a Zod enum built from the same {@link ROLE_KEYS} this
 * repository checks against, so a value that fails this lookup already
 * failed validation first. Kept as a real, typed error rather than a bare
 * assertion so a corrupted catalog fails loudly instead of inserting a null
 * `role_id`.
 */
export class RoleNotInCatalogError extends Error {
  constructor(public readonly roleKey: string) {
    super(`Role '${roleKey}' is not in the platform role catalog.`);
    this.name = "RoleNotInCatalogError";
  }
}

/**
 * Raised when a membership already holds the role being granted.
 *
 * Surfaced by the port rather than a `SELECT` pre-check, for the same
 * race-freedom reason as `OrganizationSlugTakenError` /
 * `MembershipAlreadyExistsError`: `UNIQUE (membership_id, role_id)` on
 * `membership_roles` is the only authority two concurrent grants cannot both
 * pass. Application code maps this to the documented `CONFLICT` code
 * (05_API_CAPABILITY_CONTRACTS.md §7).
 */
export class RoleAlreadyGrantedError extends Error {
  constructor(
    public readonly membershipId: string,
    public readonly roleKey: string,
  ) {
    super(`Membership already holds the '${roleKey}' role.`);
    this.name = "RoleAlreadyGrantedError";
  }
}

/** The row this port writes, echoed back so a caller need not re-read it. */
export interface RoleGrant {
  id: string;
  tenantId: string;
  membershipId: string;
  roleKey: string;
  createdAt: Date;
}

export interface GrantRoleCommand {
  /**
   * Supplied by the caller, matching every other insert in this codebase
   * (organizations, memberships): the write always runs inside an
   * already-established tenant context here, so `.returning()` would in fact
   * satisfy `membership_roles`' RLS policy (unlike organizations' bootstrap
   * case) — but a client-side id keeps this port consistent with the rest of
   * the module rather than depending on that distinction holding forever.
   */
  id: string;
  tenantId: string;
  membershipId: string;
  roleKey: string;
  createdAt: Date;
}

/**
 * Grants a platform-defined role to a membership.
 *
 * `organization.create` (an internal, hardcoded `"owner"` grant) and
 * `membership.role.assign` (a client-supplied `roleKey`, Zod-validated
 * against the same catalog) are the two callers — see DECISION_LOG.md
 * "membership.role.assign: the RoleGrantRepository port shape" for why the
 * signature takes one command object with a caller-supplied id rather than
 * the three positional arguments this port started with, and why unknown-role
 * and duplicate-grant are both typed errors instead of a bare `Error` throw
 * and a leaked constraint-violation for the client-facing caller to map.
 */
export interface RoleGrantRepository {
  /**
   * Throws {@link RoleNotInCatalogError} if `roleKey` is not in the platform
   * catalog, or {@link RoleAlreadyGrantedError} on a duplicate
   * (membershipId, roleKey) pair.
   */
  grantRoleByKey(grant: GrantRoleCommand): Promise<RoleGrant>;

  /**
   * Added for `membership.revoke`'s "cannot revoke the organization's only
   * remaining owner" protection (DECISION_LOG.md 2026-08-24, decision 3) —
   * does the target membership currently hold `roleKey`, regardless of
   * whether other roles are also granted.
   */
  hasRole(membershipId: string, roleKey: string): Promise<boolean>;

  /**
   * Count of ACTIVE memberships in `tenantId` currently holding `roleKey` —
   * the other half of the same protection. Scoped to ACTIVE memberships
   * only: a REVOKED membership's `membership_roles` rows are deliberately
   * left in place (`MembershipRepository.revoke`'s own doc comment), so a
   * naive count over `membership_roles` alone would still count a former
   * owner who no longer effectively holds anything.
   */
  countActiveMembersWithRole(tenantId: string, roleKey: string): Promise<number>;
}

export type { RoleKey };
