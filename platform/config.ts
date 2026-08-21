/**
 * Phase 0 config loading (03_TECHNICAL_BLUEPRINT.md §4 item 5): read connection
 * settings from the environment, never hardcode them. Defaults match
 * docker-compose.yml so `docker compose up` + no .env still works locally.
 */

export interface DbConfig {
  connectionString: string;
}

const DEV_DEFAULT_DATABASE_URL = "postgresql://nexora:nexora_dev_only@localhost:5433/nexora";

export function loadDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    connectionString: env.DATABASE_URL ?? DEV_DEFAULT_DATABASE_URL,
  };
}

export function loadConformanceTestDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    connectionString: env.CONFORMANCE_TEST_DATABASE_URL ?? env.DATABASE_URL ?? DEV_DEFAULT_DATABASE_URL,
  };
}
