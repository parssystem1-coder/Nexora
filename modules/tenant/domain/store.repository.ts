import type { Store } from "./store.entity.js";

export interface StoreRepository {
  findById(id: string): Promise<Store | null>;
}
