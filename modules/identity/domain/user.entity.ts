export type UserStatus = "ACTIVE" | "SUSPENDED";

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    public readonly status: UserStatus,
  ) {}

  get isActive(): boolean {
    return this.status === "ACTIVE";
  }
}
