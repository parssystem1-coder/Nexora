import type { RequestWithIdentity } from "../../identity/contracts/index.js";

/**
 * 05_API_CAPABILITY_CONTRACTS.md §2's trusted context, verbatim: `storeId` is
 * optional there because not every capability is store-scoped.
 *
 * This was originally declared inline in `store-access.guard.ts` with
 * `storeId` required, which is correct for `store.read` but not expressible
 * for a capability that has no store — `organization.create` is the first
 * one. Splitting it here keeps the golden path's compile-time guarantee
 * intact (see {@link StoreTenantContext}, which the store guard still
 * produces) while letting a non-store capability build a context that is
 * trusted in exactly the same way and is read by the same structured-logging
 * middleware (08_PHASE_1_BRIEF.md §2 step 10, which requires `tenantId` on
 * every request's log line, not only store-scoped ones).
 *
 * `membershipId` is a Nexora addition, carried so a later permission check
 * does not re-resolve the membership across a module boundary. It is
 * optional for the same reason `storeId` is: a capability that creates the
 * tenant has no membership until it makes one.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  requestId: string;
  correlationId: string;
  actorType: "user";
  storeId?: string;
  membershipId?: string;
}

/** The context a store-scoped capability runs under: both optional fields are resolved and guaranteed. */
export interface StoreTenantContext extends TenantContext {
  storeId: string;
  membershipId: string;
}

export type RequestWithTenantContext = RequestWithIdentity & { tenantContext?: TenantContext };

export type RequestWithStoreTenantContext = RequestWithIdentity & { tenantContext?: StoreTenantContext };
