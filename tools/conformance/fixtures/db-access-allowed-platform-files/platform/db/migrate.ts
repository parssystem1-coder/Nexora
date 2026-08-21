import type { Client } from "pg";
export async function migrate(client: Client) {
  return client.query("SELECT 1");
}
