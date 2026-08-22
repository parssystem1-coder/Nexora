import { Client } from "pg";
import { join } from "node:path";
import { loadMigrateDbConfig } from "../config.js";
import { discoverModuleMigrations } from "./discover-migrations.js";
import { migrate } from "./migrate.js";

async function main() {
  const config = loadMigrateDbConfig();
  const client = new Client({ connectionString: config.connectionString });
  await client.connect();

  try {
    const files = discoverModuleMigrations(join(process.cwd(), "modules"));
    if (files.length === 0) {
      console.log("No migrations found under modules/*/migrations/. Nothing to do.");
      return;
    }

    const result = await migrate(client, "public", files);
    console.log(`Applied ${result.applied.length}, already up to date: ${result.skipped.length}.`);
    for (const id of result.applied) console.log(`  + ${id}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
