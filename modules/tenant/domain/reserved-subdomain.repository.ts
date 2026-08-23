/**
 * Checks a store slug against `reserved_subdomains`
 * (04_DATABASE_BLUEPRINT.md §5: "store slug unique within organization, and
 * rejected if present in `reserved_subdomains`").
 *
 * A repository read plus a domain-level branch in the caller, not a database
 * constraint: a Postgres CHECK constraint cannot reference another table,
 * and a trigger enforcing this would put authoritative business logic in
 * the database, which AGENTS.md §4 forbids outright. The read is cheap and
 * the rule (reject if reserved) is a single `if`, so a dedicated domain
 * service would be an abstraction this slice does not need — see
 * CreateStoreService.
 *
 * `slug` must already be normalized (trimmed, lowercased) by the caller
 * before this is queried — `reserved_subdomains.name` is seeded in that same
 * normalized form, so the comparison is a plain equality with nothing to
 * drift.
 */
export interface ReservedSubdomainRepository {
  isReserved(slug: string): Promise<boolean>;
}
