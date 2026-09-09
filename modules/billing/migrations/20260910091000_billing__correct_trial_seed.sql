-- Discharges the 2026-09-05 ruling recorded against Phase 2 item 4: **a trial
-- is a state of a subscription, not a plan.**
--
-- Items 1 and 2 both recorded this as owed here. Item 1 seeded two plans —
-- `trial` and `standard` — because ruling ب-8 asked for a `plan_features` flag
-- separating a trial from a paid plan, and a flag on a plan version cannot see
-- subscription state. Item 1 said so at the time and left the resolution to
-- this item.
--
-- **The ruling resolves it in ADR-052's favour, and ADR-052 already said so.**
-- Its item 1 puts trial eligibility and duration on the plan version; its item
-- 2 says `plan.subscribe` "has two outcomes depending on the plan version it is
-- given: a trialling subscription when that version offers a trial ... an
-- `ACTIVE` one when it does not. **Both are the same capability, the same
-- transaction, the same audit event.**" One plan whose version offers a trial
-- is exactly that model. Two plans would have made conversion a `plan.change`,
-- which ADR-025 item 2 classifies as an upgrade requiring proration — a
-- mid-term proration computed against a period nobody paid for.
--
-- Three changes, and nothing referenced any of the rows removed: verified
-- before writing this that no `prices` row points at the trial plan version and
-- that no subscription exists at all, since this migration is the one that
-- precedes the table.

-- ---------------------------------------------------------------------------
-- 1. The `trial` plan and everything under it.
-- ---------------------------------------------------------------------------
-- Deleted in dependency order. `plan_versions` and `plan_features` are
-- append-only **for `nexora_app`** since 2026-09-05; a migration runs as
-- `nexora_migrate`, which still holds DELETE. That distinction is the whole
-- point of the REVOKE being role-scoped rather than a trigger: the schema owner
-- can correct a seed, and the application can never rewrite history.
DELETE FROM plan_features
 WHERE plan_version_id = '1a2b3c4d-0000-4000-8000-000000000001';

DELETE FROM plan_versions
 WHERE id = '1a2b3c4d-0000-4000-8000-000000000001';

DELETE FROM plans
 WHERE id = '0f5c9e34-0b1a-4a63-9d54-3b7a6e2f1c01';

-- ---------------------------------------------------------------------------
-- 2. Ruling ب-8's feature grant, which now grants nothing readable.
-- ---------------------------------------------------------------------------
-- With one plan, `storefront.attribution_free` cannot distinguish a trial from
-- a paid subscription — the two are the same plan version in different states.
-- **The mark is driven by serving state instead**: shown while a subscription
-- has never been paid for, hidden once it is `ACTIVE`. That input is the
-- subscription, and `modules/subscription/domain/serving-state.ts` is where a
-- storefront reads it (Phase 4).
--
-- Removed rather than left in place, because a grant nothing reads is worse
-- than no grant: the next reader has to work out whether it is load-bearing.
-- The amendment to ب-8 is recorded in `decisions/2026-09.md` under this date.
DELETE FROM plan_features
 WHERE plan_version_id = '1a2b3c4d-0000-4000-8000-000000000002'
   AND feature_key = 'storefront.attribution_free';

-- ---------------------------------------------------------------------------
-- 3. `standard` now offers the trial, because it is the only plan.
-- ---------------------------------------------------------------------------
-- **This is an UPDATE to a table described everywhere as immutable, and it is a
-- deliberate, bounded exception rather than an oversight.** The reasons, in the
-- order they matter:
--
--   * **Immutability protects a pin, and nothing is pinned.** ADR-025 item 6's
--     rule is that "a later edit to that plan must not retroactively alter the
--     change" — the harm is rewriting a version some subscription, invoice or
--     scheduled change already references. `subscriptions` does not exist until
--     the migration that runs immediately after this one, so the set of rows
--     that could be retroactively altered is empty and provably so.
--   * **It is the schema owner correcting its own seed**, not the application
--     role rewriting history. `nexora_app` cannot do this and still cannot
--     after this migration.
--   * **Publishing a version 2 instead would have been worse here.** Item 2's
--     `prices` rows reference version 1 by id, so a version 2 would need its own
--     price rows and the catalogue would carry two versions where one is
--     correct — churn that buys nothing while no consumer exists.
--
-- **Once item 4's tables carry a single row, this exception is closed.** From
-- then on a change to a plan version is a publish, which is ruling ح-2's
-- Phase 2.5 capability, and this migration is the last of its kind.
--
-- 14 days is ADR-052 as amended by ruling ب-7 on 2026-09-04, and is the value
-- item 1 already seeded onto the plan being removed.
UPDATE plan_versions
   SET trial_period_days = 14
 WHERE id = '1a2b3c4d-0000-4000-8000-000000000002';
