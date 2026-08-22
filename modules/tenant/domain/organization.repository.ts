import type { Organization } from "./organization.entity.js";

/**
 * Raised when the globally-unique organization slug is already taken.
 *
 * The port surfaces this rather than exposing a `existsBySlug()` pre-check,
 * because under RLS a pre-check cannot see rows in other tenants: inside
 * organization.create's transaction `app.tenant_id` is the *new*
 * organization's id, so a SELECT for a colliding slug owned by someone else
 * returns zero rows and the check would wrongly pass. The unique index is
 * the only authority that sees the whole namespace, and it is also the only
 * one that is race-free. Application code maps this to the documented
 * `CONFLICT` code (05_API_CAPABILITY_CONTRACTS.md §7).
 */
export class OrganizationSlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Organization slug '${slug}' is already taken.`);
    this.name = "OrganizationSlugTakenError";
  }
}

export interface OrganizationRepository {
  /** Throws {@link OrganizationSlugTakenError} if the slug is already in use. */
  create(organization: Organization): Promise<void>;
}
