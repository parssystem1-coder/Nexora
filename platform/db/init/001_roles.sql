-- Bootstrap roles for the Nexora dev/test PostgreSQL instance. Runs once, on
-- first container init (mounted at /docker-entrypoint-initdb.d/), as the
-- POSTGRES_USER superuser. Mirrors ADR-021 ("the application database role
-- cannot bypass RLS") and the empirically-confirmed fact that a table's
-- owning role bypasses RLS by default: migrations run as nexora_migrate
-- (owns the schema and every table); the running app and its tests connect
-- only as nexora_app (NOSUPERUSER, NOBYPASSRLS, never an owner). See
-- DECISION_LOG.md "RLS: FORCE ROW LEVEL SECURITY or a non-owner app role".
--
-- The local, non-Docker verification this scaffold was proven against ran
-- the equivalent statements by hand against a native PostgreSQL install —
-- see REPOSITORY_AUDIT_REPORT.md.

CREATE ROLE nexora_migrate LOGIN PASSWORD 'nexora_migrate_dev_only';
CREATE ROLE nexora_app LOGIN PASSWORD 'nexora_app_dev_only' NOSUPERUSER NOBYPASSRLS;

ALTER DATABASE nexora OWNER TO nexora_migrate;
GRANT ALL ON SCHEMA public TO nexora_migrate;
GRANT USAGE ON SCHEMA public TO nexora_app;

-- Applies to every table/sequence nexora_migrate creates from now on,
-- including tables created long after this script runs — no per-migration
-- GRANT needed.
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexora_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nexora_app;
