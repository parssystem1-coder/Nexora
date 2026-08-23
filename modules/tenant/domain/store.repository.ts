import type { Store } from "./store.entity.js";

/**
 * Raised when the slug is already taken within this organization.
 *
 * Surfaced by the port rather than a `SELECT` pre-check, for the same
 * race-freedom reason as `OrganizationSlugTakenError`: `UNIQUE (tenant_id,
 * slug)` on `stores` is the only authority two concurrent creates cannot
 * both pass. Unlike `organization.create`'s bootstrap case, a pre-check here
 * *would* be visible under RLS (the caller's tenant context is already the
 * right one) — it would just be wrong under concurrency, the same reasoning
 * `MembershipAlreadyExistsError` and `RoleAlreadyGrantedError` already
 * record. Application code maps this to the documented `CONFLICT` code
 * (05_API_CAPABILITY_CONTRACTS.md §7) — distinct from a slug rejected for
 * being in `reserved_subdomains`, which is `DOMAIN_RESERVED` and never
 * reaches this far.
 */
export class StoreSlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Store slug '${slug}' is already taken in this organization.`);
    this.name = "StoreSlugTakenError";
  }
}

export interface StoreRepository {
  findById(id: string): Promise<Store | null>;

  /**
   * Added for store.create. Id and createdAt are supplied by the caller,
   * matching every other insert in this codebase — `stores`' RLS policy has
   * no bootstrap concern (store.create always runs inside an
   * already-established organization's tenant context, unlike
   * organization.create), so `.returning()` would in fact be safe here, but
   * a client-side id keeps this port consistent with the rest of the module
   * rather than depending on that distinction holding forever.
   *
   * Throws {@link StoreSlugTakenError} on a duplicate (tenant, slug) pair.
   */
  create(store: Store): Promise<void>;
}
