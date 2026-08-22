import type { User } from "./user.entity.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
}
