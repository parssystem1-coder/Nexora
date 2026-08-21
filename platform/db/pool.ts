import { Pool } from "pg";
import type { DbConfig } from "../config.js";

export function createPool(config: DbConfig): Pool {
  return new Pool({ connectionString: config.connectionString });
}
