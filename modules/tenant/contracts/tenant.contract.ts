/** 05_API_CAPABILITY_CONTRACTS.md §1: timestamps cross a boundary as UTC ISO-8601. */
export interface StoreDto {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

/**
 * An organization is the tenant, so there is no separate `organizationId`
 * field the way StoreDto has one - `id` is the tenant id.
 */
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}
