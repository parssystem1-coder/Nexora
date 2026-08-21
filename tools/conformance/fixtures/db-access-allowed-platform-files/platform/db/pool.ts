import { Pool } from "pg";
export function createPool() {
  return new Pool();
}
