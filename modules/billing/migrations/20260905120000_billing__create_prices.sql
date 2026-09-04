-- Phase 2 item 2: price and price version.
--
-- **This item surfaces no capability, and that is correct rather than an
-- omission.** `PHASE_2_BRIEF.md` §3(a) names it first among seven such items —
-- "2 (price and price version), 3, 7, 10, 11, 17, 18 ... infrastructure, and
-- correct." So there is no controller, no route, no CapabilityDefinition and
-- no OpenAPI entry in this item: it ships schema, table types and the tests
-- that prove both, and a consumer arrives with item 4.
--
-- Platform-global, exempt from tenant_id/RLS by the same `PHASE_2_BRIEF.md` §5
-- clause item 1 quoted, which names all seven plan-and-price tables together:
-- "platform-authored reference data, identical for every tenant." A price is
-- what the platform charges anyone for a plan; there is no tenant whose rows
-- these are. Both conformance schema rules carry the two names on their
-- TENANT_EXEMPT list.

-- ---------------------------------------------------------------------------
-- prices — the identity of "what a plan version costs for one term length".
-- ---------------------------------------------------------------------------
-- **The term lives here, on the identity, not on the version, and that is the
-- one real modelling decision in this item.** Ruling ب-5 (2026-09-04) says
-- "each term length is its own price version", and ADR-047's amendment
-- recording it says "one-year and two-year are **two price rows**, not one
-- price and a percentage." Both are satisfied either way; what decides it is
-- what a *version sequence* has to mean.
--
-- A version sequence is a history of one thing changing value over time. If
-- the term sat on `price_versions`, then version 1 could be an annual amount
-- and version 2 a biennial one, and the sequence would no longer be a history
-- of anything — it would be two different offers sharing a counter. With the
-- term on the identity, "the annual price of the standard plan" is a thing
-- whose amount has a history, which is exactly what ADR-047 re-pins at
-- renewal: its verification list asks for "the current price version of **the
-- same term length**", and that phrase resolves to one row here rather than to
-- a filter.
--
-- **`interval`, joining ADR-024 item 1's vocabulary rather than inventing a
-- second one.** That item models `term_length` as "interval, e.g. 1 month, 1
-- year" on the subscription; a price for a term must speak the same type, or
-- every later join between them becomes a translation. It also satisfies
-- ADR-031 item 3, which prohibits `+365 days` for a term: `interval '1 year'`
-- is calendar arithmetic, `interval '365 days'` is day counting.
--
-- **Why `plan_version_id` and not `plan_id`.** Ruling ح-2 (2026-09-04) gives
-- Phase 2.5 an administration capability that publishes "a new plan version
-- **and** a new price version" — the two together. A price hanging off the
-- plan identity would let a price published against one version of a plan
-- silently apply to another, which is the retroactive alteration ADR-025 item
-- 6 forbids for a pinned change ("a later edit to that plan must not
-- retroactively alter the change"). The cost is that publishing a plan version
-- means publishing its prices too; that is the intended flow, not an accident.
--
-- No `deleted_at`: ADR-046 rules no soft-delete column in Phase 2, and no
-- Phase 2 query owes a soft-delete filter.
CREATE TABLE prices (
  id uuid PRIMARY KEY,
  plan_version_id uuid NOT NULL REFERENCES plan_versions(id),
  term_length interval NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prices_plan_version_id_term_length_key UNIQUE (plan_version_id, term_length),
  CONSTRAINT prices_term_length_positive CHECK (term_length > interval '0')
);

-- ---------------------------------------------------------------------------
-- price_versions — the immutable versioned amount and currency.
-- ---------------------------------------------------------------------------
-- ADR-022, in the four ways it binds this table:
--
--   item 1/2 — a monetary value is never a bare number and never a float.
--   `amount_minor` is `bigint` (minor units) and `currency_code` travels with
--   it; SCHEMA-FLOAT-MONEY-COLUMN enforces the type mechanically.
--   item 3 — minor units are per currency, read from `currencies`, never
--   hard-coded. **They are deliberately not stored here**: storing the
--   exponent beside the amount would create a second, staler source for a fact
--   the currency registry owns, and `Money` itself does not carry it either.
--   item 4/10 — display is not storage. **No Toman value and no divisor
--   appears in this table**; the presentation pair lives in `currencies` and is
--   applied only in an interface layer.
--   item 8 — every row stores currency alongside amount, both NOT NULL.
--
-- **There is deliberately no foreign key to `currencies`.** `PHASE_2_BRIEF.md`
-- §5 forbids cross-module foreign keys ("cross-module reads go through
-- contracts", `04` §1), and `currencies` belongs to `modules/money`. The
-- format is guarded by the same CHECK `currencies` uses on its own code
-- column; the *existence* of the currency is a `CurrencyRepository` question,
-- asked through that module's contract by whichever slice first writes a price
-- at runtime.
--
-- `version` is the price version's own ordinal, and is NOT an ADR-045
-- optimistic-concurrency token: that ruling names four tables — subscriptions,
-- subscription_changes, billing_payment_intents, tenant_over_limit_states —
-- and item 2's tables are not among them.
--
-- Supersession is by appending a row with a later `effective_from`, resolved
-- as the greatest one not in the future — ADR-055 part 5's rule for
-- `tax_rates`, reused here exactly as item 1 reused it for `plan_versions`,
-- rather than a third resolution rule.
CREATE TABLE price_versions (
  id uuid PRIMARY KEY,
  price_id uuid NOT NULL REFERENCES prices(id),
  version integer NOT NULL,
  -- Minor units. IRR has a zero minor-unit exponent, so this is a Rial figure.
  amount_minor bigint NOT NULL,
  -- ISO 4217 alpha-3, uppercase. See above for why this is not a foreign key.
  currency_code text NOT NULL,
  effective_from timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_versions_price_id_version_key UNIQUE (price_id, version),
  CONSTRAINT price_versions_version_positive CHECK (version >= 1),
  -- A price is not a credit note; a negative subscription price has no meaning
  -- and would reach an invoice as one. Corrections are ADR-056's document type.
  CONSTRAINT price_versions_amount_minor_non_negative CHECK (amount_minor >= 0),
  CONSTRAINT price_versions_currency_is_alpha3_upper CHECK (currency_code ~ '^[A-Z]{3}$')
);

CREATE INDEX price_versions_price_id_effective_from_idx
  ON price_versions (price_id, effective_from DESC, version DESC);

-- ---------------------------------------------------------------------------
-- Seed. Item 1 seeded the `trial` and `standard` plans; this gives `standard`
-- its prices.
-- ---------------------------------------------------------------------------
-- **THESE ARE PRE-LAUNCH VALUES, NOT A COMMITMENT.** Ruling ح-2 (2026-09-04)
-- gives Phase 2.5 an operator capability that *publishes* a new price version,
-- and ADR-047 then re-prices every subscriber at their own next renewal
-- invoice (T-30d), never retroactively. A seeded amount is therefore the
-- opening value of a series, and changing it later is an ordinary publish
-- rather than a migration or a renegotiation.
--
-- **Two rows, not one amount and a percentage** — ruling ب-5, whose two
-- reasons are ADR-047's and ADR-022's own rules: a percentage would have to be
-- reproduced years later to explain a charge, and every percentage carries a
-- rounding that ADR-022 item 2 forbids on money.
--
-- **The figures.** 60,000,000 IRR for one year, and 96,000,000 IRR for two —
-- ب-5's stored discount, 80% of twice the annual amount (0.8 x 120,000,000),
-- computed here once and stored, never at read time. The annual figure is the
-- maintainer's stated commercial value; the repository corroborates rather
-- than contradicts it, since ADR-055's worked tax example uses a 60,000,000
-- subtotal.
--
-- **No price for the `trial` plan, and that is the point of a trial.** A plan
-- with no purchasable price is what "free" means here. Seeding a zero-amount
-- row instead would put a monetary value into the ledger's vocabulary that
-- means "not for sale" rather than "costs nothing", and every later query
-- summing or comparing prices would have to know the difference.
INSERT INTO prices (id, plan_version_id, term_length) VALUES
  ('2b3c4d5e-0000-4000-8000-000000000001', '1a2b3c4d-0000-4000-8000-000000000002', interval '1 year'),
  ('2b3c4d5e-0000-4000-8000-000000000002', '1a2b3c4d-0000-4000-8000-000000000002', interval '2 years');

INSERT INTO price_versions (id, price_id, version, amount_minor, currency_code, effective_from) VALUES
  ('3c4d5e6f-0000-4000-8000-000000000001', '2b3c4d5e-0000-4000-8000-000000000001', 1, 60000000, 'IRR', '2026-01-01T00:00:00Z'),
  ('3c4d5e6f-0000-4000-8000-000000000002', '2b3c4d5e-0000-4000-8000-000000000002', 1, 96000000, 'IRR', '2026-01-01T00:00:00Z');
