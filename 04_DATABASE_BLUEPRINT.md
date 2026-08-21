# Database Blueprint

**Version:** 2.0
**Status:** Conceptual schema and ownership baseline. Exact columns are finalized per module during its slice, under ADR review.

---

## 1. Rules

- PostgreSQL is authoritative.
- Every tenant-owned table carries `tenant_id` unless explicitly platform-global.
- Store-owned data carries `store_id` when applicable.
- RLS is mandatory for tenant-owned data and must fail closed when context is absent.
- Every table has exactly one owning module. Cross-module reads go through contracts, never through a foreign repository.
- Foreign keys, unique constraints and indexes are part of the design, not cleanup work.
- Audit and ledger records are append-only or history-preserving.
- **Monetary columns are `bigint` minor units or `numeric` with explicit scale, plus a currency column. Floating-point money is prohibited and checked in CI (ADR-022).**
- **All timestamps are `timestamptz` stored in UTC (ADR-031).**
- Enumerated states are stored as text with a check constraint or a lookup table, never as a raw integer.

---

## 2. Platform Core Tables

### 2.1 Identity and tenancy

```text
users
credentials
sessions
identity_providers
organizations              -- includes billing_timezone, default_currency
memberships
roles
permissions
role_permissions
membership_roles
stores
store_memberships
```

### 2.2 Money and currency (new)

```text
currencies
  code                 -- ISO 4217, primary key
  minor_units          -- integer, e.g. 0 or 2
  display_unit_code    -- nullable, presentation unit
  display_divisor      -- nullable, integer
  symbol, name, is_active
```

No monetary amount exists without a reference to a row here.

### 2.3 Plans, pricing and subscription lifecycle

```text
plans
plan_versions
plan_features
prices
price_versions

subscriptions
  id, tenant_id, plan_version_id, price_version_id
  status, term_length, auto_renew
  current_period_id, trial_end, canceled_at
  reactivation_deadline

subscription_periods              -- new, append-only
  id, tenant_id, subscription_id
  plan_version_id, price_version_id
  period_start, period_end, grace_end
  invoice_id, status               -- SCHEDULED | CURRENT | ENDED | UNPAID

subscription_changes              -- new
  id, tenant_id, subscription_id
  direction                        -- UPGRADE | DOWNGRADE | LATERAL | TERM_CHANGE
  from_plan_version_id, to_plan_version_id
  from_price_version_id, to_price_version_id
  effective_at, applied_at
  status                           -- SCHEDULED | APPLIED | CANCELED | FAILED
  prorated_amount_minor, currency, invoice_id

subscription_state_transitions     -- new, append-only
  id, tenant_id, subscription_id
  from_status, to_status, reason_code, actor_type, actor_id, occurred_at

subscription_items
```

### 2.4 Entitlement, quota, usage

```text
entitlements
entitlement_sources
quota_policies
tenant_over_limit_states          -- new: resource, current_count, limit, entered_at
usage_ledger_entries
ai_credit_ledger_entries
ai_credit_reservations            -- new: reservation lifecycle per ADR-006
```

### 2.5 Billing and payment

```text
invoices                          -- references exact plan_version and price_version
invoice_lines
billing_payment_intents           -- new: platform-side payments
  id, tenant_id, invoice_id, provider, provider_authority
  amount_minor, currency, status, verified_at, verification_attempts
  idempotency_key, created_at, expires_at
billing_payment_events            -- new, append-only provider interaction log
billing_refunds
billing_provider_configs          -- platform-scoped credentials reference
```

### 2.6 Platform services

```text
idempotency_records
  UNIQUE (tenant_id, capability, idempotency_key)
approval_requests
audit_events
files
notifications
notification_deliveries
outbox_events
webhook_endpoints
webhook_deliveries
scheduled_job_runs                -- new: job name, window, status, started/finished, error
```

### 2.7 Domains and certificates (new, previously missing entirely)

```text
store_domains
  id, tenant_id, store_id
  hostname_ascii            -- canonical punycode, lowercase
  hostname_unicode
  type                      -- APEX | WWW | SUBDOMAIN | PLATFORM
  is_primary
  status                    -- PENDING | VERIFYING | VERIFIED | FAILED | DISABLED
  verification_method, verification_token
  verified_at, last_checked_at, failure_reason, claim_expires_at

store_domain_certificates
  id, tenant_id, store_domain_id
  provider, status
  issued_at, expires_at
  last_renewal_attempt_at, renewal_failure_count
  covers_wildcard, secret_ref     -- reference only, never key material

email_sending_domains             -- separate lifecycle from web domains
  id, tenant_id, store_id, hostname_ascii
  spf_status, dkim_status, dmarc_status, verified_at

reserved_subdomains               -- data, not code
  name
```

---

## 3. Commerce Tables

```text
products
product_variants
categories
product_categories
brands
attributes
attribute_values
product_attribute_values
product_prices                    -- amount_minor + currency, never a float
inventory_items
inventory_balances
inventory_reservations
customers                         -- store-scoped identity, never a platform user
customer_sessions                 -- separate from platform sessions
carts
cart_items
orders
order_items
order_state_transitions
coupons
shipping_methods
shipping_rates
tax_rules
commerce_payment_intents          -- shopper pays the store
commerce_payment_events
commerce_refunds
store_payment_provider_configs    -- store-scoped, encrypted credential reference
```

**Commerce payment tables must never be reused for SaaS subscription billing, and the two provider config tables must never be readable from the same context.**

---

## 4. Storefront Read Model (new)

```text
storefront_product_view
storefront_category_view
storefront_navigation_view
storefront_store_config_view
```

Rules: projected from domain events through the outbox; carries `tenant_id` and `store_id`; under RLS like any other tenant table; fully rebuildable by a documented command; contains no business rule, only precomputed results; never the source for inventory availability at checkout.

---

## 5. Required Constraints

- organization slug unique within its namespace
- store slug unique within organization, and rejected if present in `reserved_subdomains`
- membership unique on (user, organization)
- store membership unique on (user, store)
- product SKU unique within store where SKU is used
- idempotency identity unique on (tenant_id, capability, idempotency_key)
- **verified hostname unique platform-wide: `UNIQUE (hostname_ascii) WHERE status = 'VERIFIED'`**
- **at most one primary domain per store: partial unique on (store_id) where `is_primary`**
- exactly one `CURRENT` period per subscription: partial unique on (subscription_id) where `status = 'CURRENT'`
- subscription periods for a subscription must not overlap, enforced by an exclusion constraint on the period range
- at most one `SCHEDULED` subscription change per subscription
- every monetary column has a companion currency column, and both are non-null together
- ledger references idempotent where an operation can be retried
- order state transitions validated by domain rules and recorded append-only

---

## 6. RLS Context

The API must set trusted transaction-local context before any query:

```sql
select set_config('app.tenant_id', :tenantId, true);
select set_config('app.user_id',   :userId,   true);
select set_config('app.store_id',  :storeId,  true);
```

Rules:

- policies must **fail closed** when `app.tenant_id` is absent, empty or malformed
- store-scoped tables additionally constrain on `app.store_id` where the operation is store-scoped
- a schema conformance test asserts every tenant-owned table has both a `tenant_id` column and an enabled policy
- the application connects as a role that **cannot** bypass RLS; migration and maintenance roles are separate and are never used by the application

---

## 7. Migration Rules

- migrations are plain reviewed SQL, forward-only, committed with the owning module
- destructive migrations require an ADR or explicit approval
- data backfills are idempotent and observable
- indexes on large tables are created without blocking production where supported
- tenant isolation tests run against real PostgreSQL, never only mocks
- a migration that adds a tenant-owned table must add its RLS policy in the same migration, or CI fails

---

## 8. Indexing Baseline

Every tenant-owned table indexes `tenant_id` as the leading column of its primary access path. Additionally required:

```text
store_domains (hostname_ascii)                     -- host resolution, hot path
subscription_periods (period_end) where status in ('CURRENT','SCHEDULED')
subscriptions (status)                             -- lifecycle job sweeps
billing_payment_intents (status, created_at)       -- reconciliation sweep
store_domain_certificates (expires_at)             -- renewal sweep
usage_ledger_entries (tenant_id, feature, period)
idempotency_records (expires_at)                   -- pruning
outbox_events (dispatched_at) where dispatched_at is null
storefront_product_view (store_id, slug)
```

---

## 9. Deferred Schema

Do not create CRM, SEO, marketplace, RAG, multi-region, channel or financial-services tables in Phase 1. Preserve contracts and ownership, not speculative tables.
