export type StoreStatus = "ACTIVE" | "SUSPENDED";

export class Store {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly status: StoreStatus,
    public readonly createdAt: Date,
  ) {}
}
