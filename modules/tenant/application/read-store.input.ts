import { z } from "zod";

export const readStoreInputSchema = z.object({
  storeId: z.string().uuid(),
});

export type ReadStoreInput = z.infer<typeof readStoreInputSchema>;
