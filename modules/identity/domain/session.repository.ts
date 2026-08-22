import type { Session } from "./session.entity.js";

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<Session | null>;
}
