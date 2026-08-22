-- currencies is platform-global reference data and is exempt from
-- tenant_id/RLS: 08_PHASE_1_BRIEF.md §5 names it explicitly in the exemption
-- list, alongside users, sessions and reserved_subdomains. An ISO 4217
-- currency is defined by the standard, not per tenant.
--
-- This table exists because of ADR-022 item 3: "Minor units are per currency,
-- read from a currency table, never hard-coded to 2. Currencies with zero
-- minor units are first-class, not an exception."
CREATE TABLE currencies (
  code text PRIMARY KEY,
  name text NOT NULL,
  -- The minor-unit exponent. 0 is first-class (IRR, JPY) and 3 exists (KWD),
  -- so 2 is not a safe default anywhere in the platform.
  minor_units smallint NOT NULL,
  -- ADR-022 item 4, "display is not storage": the presentation unit, its
  -- divisor and its symbol are configuration and live here, never as a
  -- literal in business code. They are deliberately NOT exposed on the domain
  -- Currency entity, so domain and application code cannot see a presentation
  -- unit at all. NULL means the currency is presented in its own storage unit.
  presentation_code text,
  presentation_divisor bigint,
  presentation_symbol text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT currencies_code_is_alpha3_upper CHECK (code ~ '^[A-Z]{3}$'),
  CONSTRAINT currencies_minor_units_range CHECK (minor_units >= 0 AND minor_units <= 4),
  CONSTRAINT currencies_presentation_pair_complete CHECK (
    (presentation_code IS NULL AND presentation_divisor IS NULL)
    OR (presentation_code IS NOT NULL AND presentation_divisor IS NOT NULL)
  ),
  CONSTRAINT currencies_presentation_divisor_positive CHECK (
    presentation_divisor IS NULL OR presentation_divisor > 0
  )
);

-- Phase 1 seed. Deliberately small and deliberately spread across minor-unit
-- exponents 0, 2 and 3 so that no caller can pass by assuming 2, and so the
-- ADR-022 verification item "a currency with zero minor units round-trips
-- without a rounding change" has real data to run against. See DECISION_LOG.md
-- "Which currencies to seed in Phase 1".
--
-- IRR carries the presentation pair because it is the platform's home-market
-- case (ADR-023's Iranian PSP profile): amounts are stored in rial and shown
-- in toman, a factor of 10 that must never appear as a literal in code.
INSERT INTO currencies (code, name, minor_units, presentation_code, presentation_divisor, presentation_symbol) VALUES
  ('IRR', 'Iranian rial',  0, 'IRT', 10,   E'تومان'),
  ('USD', 'US dollar',     2, NULL,  NULL, '$'),
  ('EUR', 'Euro',          2, NULL,  NULL, E'€'),
  ('JPY', 'Japanese yen',  0, NULL,  NULL, E'¥'),
  ('KWD', 'Kuwaiti dinar', 3, NULL,  NULL, E'د.ك');
