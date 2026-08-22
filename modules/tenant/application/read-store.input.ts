import { z } from "zod";

export const readStoreInputSchema = z.object({
  storeId: z.string().uuid(),
});

export type ReadStoreInput = z.infer<typeof readStoreInputSchema>;

/**
 * Added for ADR-033: the response shape as Zod, so the committed OpenAPI
 * artifact is generated from the same object the code uses rather than
 * hand-written alongside it. Must stay in step with StoreDto
 * (modules/tenant/contracts/tenant.contract.ts) - `storeDtoMatchesSchema` in
 * tools/openapi/openapi.spec.ts pins that they agree.
 */
export const storeOutputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  createdAt: z.string().datetime(),
});
