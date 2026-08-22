/**
 * Phase 0 config loading (03_TECHNICAL_BLUEPRINT.md §4 item 5): read connection
 * settings from the environment, never hardcode them. Defaults match
 * docker-compose.yml + platform/db/init/001_roles.sql so `docker compose up`
 * + no .env still works locally.
 *
 * Two distinct roles, deliberately — see DECISION_LOG.md "RLS: FORCE ROW
 * LEVEL SECURITY or a non-owner app role":
 *   - nexora_migrate: owns the schema, runs migrations only.
 *   - nexora_app: NOSUPERUSER, NOBYPASSRLS, never an owner — the only role
 *     the running app, and its tests, are allowed to query through.
 */

export interface DbConfig {
  connectionString: string;
}

const DEV_DEFAULT_APP_DATABASE_URL = "postgresql://nexora_app:nexora_app_dev_only@localhost:5433/nexora";
const DEV_DEFAULT_MIGRATE_DATABASE_URL = "postgresql://nexora_migrate:nexora_migrate_dev_only@localhost:5433/nexora";

/** The app/runtime connection (nexora_app). */
export function loadDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    connectionString: env.DATABASE_URL ?? DEV_DEFAULT_APP_DATABASE_URL,
  };
}

/** The migration/schema-owner connection (nexora_migrate). Only migrate-cli.ts and schema-structure tooling use this. */
export function loadMigrateDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    connectionString: env.MIGRATE_DATABASE_URL ?? DEV_DEFAULT_MIGRATE_DATABASE_URL,
  };
}

/** Defaults to the app connection (nexora_app) — tests connect through the same role the running app does. */
export function loadConformanceTestDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  return {
    connectionString: env.CONFORMANCE_TEST_DATABASE_URL ?? env.DATABASE_URL ?? DEV_DEFAULT_APP_DATABASE_URL,
  };
}
