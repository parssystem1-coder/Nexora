-- 20260822090800_audit__create_audit_events.sql's own comment says
-- "actor_user_id is nullable for non-user actors (service/system/plugin/agent)"
-- - but auth.login has written actor_type = 'user' with actor_user_id = NULL
-- since its first commit, for an unknown-email attempt where no user was
-- ever resolved. That row's VALUE is correct: the actor really is a human
-- being attempting to authenticate, not the system or a service acting on
-- its own - reclassifying it as a non-'user' actor_type to satisfy the old
-- comment would misrepresent the category of who did this to make the
-- comment true instead of the other way around. The documented MEANING was
-- the incomplete half, so this corrects that, not the code that has been
-- correct all along.
--
-- Migrations are forward-only (ADR-021 item 8) - the original file's `--`
-- comment is left as a historical artifact of what was believed true when it
-- was written, not edited in place. The corrected, current meaning is set as
-- a real, live, queryable PostgreSQL column comment instead: one place this
-- lives, superseding the stale prose rather than duplicating an explanation
-- in a second doc file. See DECISION_LOG.md 2026-08-24, correction (b).
COMMENT ON COLUMN audit_events.actor_user_id IS
  'Nullable for two distinct reasons: (1) a non-user actor (service, system, plugin, agent - actor_type != ''user''), or (2) a user-attributed attempt (actor_type = ''user'') whose identity could not be resolved, e.g. auth.login with an unknown email (ADR-035). actor_type always states the category of who acted; actor_user_id additionally names WHICH user only when one was identified. NULL never means "the actor category is unknown."';
