export class StoreMembership {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly storeId: string,
    public readonly userId: string,
  ) {}
}
