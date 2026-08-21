// VIOLATION FIXTURE (FORBIDDEN-IMPORT-DOMAIN): domain must never import a DB driver.
import { Client } from "pg";

export class Thing {
  constructor(private readonly client: Client) {}
}
