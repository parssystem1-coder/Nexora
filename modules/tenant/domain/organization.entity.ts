export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

/**
 * An organization IS the tenant — `tenantId` mirrors `id`, matching the
 * `tenant_id uuid GENERATED ALWAYS AS (id) STORED` column in
 * 20260822090200_tenant__create_organizations.sql. Both are carried so the
 * entity reads the same way as every other tenant-owned entity (Store,
 * Membership) rather than making callers know about the mirroring.
 */
export class Organization {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly status: OrganizationStatus,
    public readonly createdAt: Date,
  ) {}
}
