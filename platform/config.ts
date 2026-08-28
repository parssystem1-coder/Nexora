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

/**
 * Express's own `trust proxy` setting (applied in `create-app.ts`), read as
 * config rather than left as an unexamined framework default —
 * RISK_REGISTER.md R-012. No deployment topology exists yet (no proxy, no
 * load balancer), so the safe default when `TRUST_PROXY` is unset is
 * `false`: trust nothing, the resolved client IP (via
 * `platform/http/client-ip.ts`) is the raw socket peer address. This is deliberately NOT the same
 * question `01_ARCHITECTURE_BASELINE_RFC.md`'s Host-header rule (ADR-028)
 * answers for a different header, but it is the same shape of problem —
 * both are "an attacker-controlled input must not be trusted without an
 * explicit, deliberate resolution step."
 *
 * When a real proxy/load balancer is placed in front of this API, whoever
 * does it sets `TRUST_PROXY` deliberately to whatever Express's own
 * `trust proxy` setting accepts for that topology (a hop count, a specific
 * trusted proxy IP/CIDR list, or `true` to trust every proxy — which is
 * only correct if EVERY hop between the client and this process is one
 * this platform controls, and is a real, named danger otherwise: it makes
 * `X-Forwarded-For` fully client-controlled, and RISK_REGISTER.md R-005's
 * per-IP login throttle becomes trivially bypassable with a random header
 * per request). This loader does not attempt to guess or block that choice
 * — the topology is unknown, and pretending otherwise would be worse than
 * leaving the decision to whoever actually deploys this — it only supplies
 * the safe default when nothing has decided yet.
 */
export function loadTrustProxyConfig(env: NodeJS.ProcessEnv = process.env): boolean | number | string {
  const raw = env.TRUST_PROXY;
  if (raw === undefined) return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNumber = Number(raw);
  return Number.isInteger(asNumber) ? asNumber : raw;
}
