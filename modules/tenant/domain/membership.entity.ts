export type MembershipStatus = "ACTIVE" | "REVOKED";

export class Membership {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly status: MembershipStatus,
    public readonly createdAt: Date,
  ) {}

  get isActive(): boolean {
    return this.status === "ACTIVE";
  }
}
