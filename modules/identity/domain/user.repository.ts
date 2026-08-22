import type { User } from "./user.entity.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;

  /**
   * Added for membership.invite, which identifies the invitee by email
   * address. Implementations normalize with normalizeEmail() before
   * querying, so callers pass the address as supplied.
   */
  findByEmail(email: string): Promise<User | null>;
}
