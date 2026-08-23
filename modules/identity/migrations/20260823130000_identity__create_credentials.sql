-- credentials holds ONE password credential per platform user
-- (UNIQUE (user_id) below) — Phase 1 has no multi-credential model.
-- identity_providers (08_PHASE_1_BRIEF.md §4's scope list) is the separate
-- table for a separate concern, external SSO, and is NOT created here: this
-- slice (auth.login, password-based) does not need it, and
-- AGENTS.md §4 forbids building ahead of a genuine need.
--
-- Exempt from tenant_id/RLS, per the SAME reasoning `users` and `sessions`
-- already carry: a platform user's password belongs to the person, not to
-- any one of the organizations they hold membership in, and RLS here would
-- be circular for the same reason it would be on `sessions` — verifying a
-- credential is part of the step that establishes which tenant is trusted
-- in the first place, before any tenant context can exist. This changes
-- 08_PHASE_1_BRIEF.md §5's exemption list (which did not previously name
-- `credentials`), recorded as a decision rather than taken on implementer
-- authority — see DECISION_LOG.md "credentials: joining the identity
-- exemption, not carrying tenant_id" — and 08 §5 and
-- .claude/skills/new-slice/SKILL.md Step 4 are updated in the same commit
-- so the code and the normative documents cannot disagree
-- (PHASE_1_GATE_REVIEW_2026-08-22.md Finding 2 was exactly this failure
-- mode).
--
-- password_hash is an Argon2id PHC-format string (algorithm, cost
-- parameters and salt embedded in the one column) — never a raw password,
-- never returned by any API, never written to a log line.
CREATE TABLE credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX credentials_user_id_key ON credentials (user_id);
