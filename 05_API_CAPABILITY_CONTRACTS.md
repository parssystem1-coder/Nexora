# API and Capability Contracts

**Version:** 2.0

---

## 1. Contract Rules

- Public API prefix: `/api/v1`.
- All external writes validate tenant and store scope server-side.
- Stable machine-readable errors: `code`, `message`, `details`, `requestId`.
- Pagination, filtering and sorting are explicit per endpoint.
- Writes that can be retried accept `Idempotency-Key` or an application-level equivalent.
- REST, Admin UI, Storefront, AI, MCP, Automation and Plugins converge on the same Application Service.
- **Money crosses a boundary as a string amount plus currency, never as a JSON number.**
- **Timestamps cross a boundary as UTC ISO-8601 with an offset. Calendar rendering is client-side or interface-side only.**
- OpenAPI and JSON Schema artifacts are **generated from code** and committed. A hand-written schema that drifts from the handler is a defect.

---

## 2. Trusted Context

```ts
type TenantContext = {
  tenantId: string;
  userId: string;
  requestId: string;
  correlationId: string;
  storeId?: string;
  actorType: 'user' | 'service' | 'system' | 'plugin' | 'agent';
};

// Anonymous storefront reads use a reduced, read-only context.
// It is produced only by verified host resolution (ADR-028) and
// can never be upgraded to a TenantContext.
type StorefrontContext = {
  tenantId: string;
  storeId: string;
  requestId: string;
  readonly: true;
};
```

---

## 3. Money and Time Shapes

```ts
type MoneyDto = {
  amount: string;      // integer string, minor units
  currency: string;    // ISO 4217
  minorUnits: number;  // echo of the currency's scale, for safe client rendering
};

type PeriodDto = {
  start: string;       // UTC ISO-8601, inclusive
  end: string;         // UTC ISO-8601, exclusive
};
```

Half-open periods everywhere (ADR-031).

---

## 4. Core Capabilities

### 4.1 Identity and tenancy

| Capability | Scope | Risk | Idempotency |
|---|---|---:|---:|
| `auth.login` | global | LOW_WRITE | no |
| `auth.logout` | user | LOW_WRITE | no |
| `auth.logout_all` | user | MEDIUM_WRITE | yes |
| `organization.create` | user | MEDIUM_WRITE | yes |
| `organization.switch` | user | READ | no |
| `membership.invite` | tenant | MEDIUM_WRITE | yes |
| `membership.revoke` | tenant | HIGH_WRITE | yes |
| `membership.role.assign` | tenant | HIGH_WRITE | yes |
| `store.create` | tenant | MEDIUM_WRITE | yes |
| `store.read` | store | READ | no |
| `store.update` | store | MEDIUM_WRITE | yes |

### 4.2 Commercial lifecycle (expanded in 2.0)

| Capability | Scope | Risk | Idempotency |
|---|---|---:|---:|
| `plan.list` | global | READ | no |
| `plan.subscribe` | tenant | HIGH_WRITE | yes |
| `plan.change.preview` | tenant | READ | no |
| `plan.change` | tenant | HIGH_WRITE | yes |
| `plan.change.cancel_scheduled` | tenant | MEDIUM_WRITE | yes |
| `subscription.read` | tenant | READ | no |
| `subscription.renew` | tenant | HIGH_WRITE | yes |
| `subscription.cancel` | tenant | HIGH_WRITE | yes |
| `subscription.reactivate` | tenant | HIGH_WRITE | yes |
| `entitlement.resolve` | tenant | READ | no |
| `overlimit.read` | tenant | READ | no |
| `usage.record` | tenant | LOW_WRITE | yes |
| `invoice.list` | tenant | READ | no |
| `billing.payment.initiate` | tenant | HIGH_WRITE | yes |
| `billing.payment.verify` | tenant | HIGH_WRITE | yes |

`plan.change.preview` is mandatory. A customer must be able to see the exact prorated amount, the effective date and the unchanged expiry date **before** paying.

### 4.3 Commerce

| Capability | Scope | Risk | Idempotency |
|---|---|---:|---:|
| `product.create` | store | MEDIUM_WRITE | yes |
| `product.update` | store | MEDIUM_WRITE | yes |
| `product.delete` | store | HIGH_WRITE | yes |
| `inventory.adjust` | store | HIGH_WRITE | yes |
| `cart.create` | store | LOW_WRITE | yes |
| `checkout.start` | store | MEDIUM_WRITE | yes |
| `order.create` | store | MEDIUM_WRITE | yes |
| `order.cancel` | store | HIGH_WRITE | yes |
| `commerce.payment.initiate` | store | HIGH_WRITE | yes |
| `commerce.payment.verify` | store | HIGH_WRITE | yes |
| `commerce.refund.create` | store | HIGH_WRITE | yes |

### 4.4 Domains (new in 2.0)

| Capability | Scope | Risk | Idempotency |
|---|---|---:|---:|
| `domain.add` | store | MEDIUM_WRITE | yes |
| `domain.verify` | store | MEDIUM_WRITE | yes |
| `domain.set_primary` | store | MEDIUM_WRITE | yes |
| `domain.remove` | store | HIGH_WRITE | yes |
| `domain.certificate.read` | store | READ | no |
| `domain.list` | store | READ | no |

### 4.5 Platform

| Capability | Scope | Risk | Idempotency |
|---|---|---:|---:|
| `approval.create` | tenant/store | HIGH_WRITE | yes |
| `approval.respond` | tenant/store | HIGH_WRITE | yes |
| `tenant.export` | tenant | MEDIUM_WRITE | yes |
| `tenant.deletion.request` | tenant | HIGH_WRITE | yes |
| `tenant.deletion.cancel` | tenant | HIGH_WRITE | yes |

---

## 5. Capability Definition Shape

```ts
type CapabilityDefinition = {
  id: string;
  version: string;
  inputSchema: unknown;
  outputSchema: unknown;
  requiredPermissions: string[];
  requiredEntitlements?: string[];
  quota?: { resource: string; units: number };
  risk: 'READ' | 'LOW_WRITE' | 'MEDIUM_WRITE' | 'HIGH_WRITE';
  approval: 'none' | 'policy' | 'platform';
  idempotent: boolean;
  audit: boolean;
  requiresServingSubscription: boolean;   // new, ADR-024
  storeScoped: boolean;                   // new, ADR-002
  emitsEvents?: string[];                 // new, outbox contract
};
```

---

## 6. Example Contracts

### 6.1 Create Store

`POST /api/v1/stores` with authentication and `Idempotency-Key`.

```json
{ "organizationId": "org_123", "name": "Main Store", "slug": "main-store" }
```

The server derives tenant scope from authenticated membership, rejects unauthorized organization IDs, and rejects a slug present in `reserved_subdomains`.

### 6.2 Preview a plan change

`POST /api/v1/subscription/plan-change/preview`

```json
{ "targetPlanVersionId": "plv_pro_v2" }
```

Response:

```json
{
  "direction": "UPGRADE",
  "effectiveAt": "2026-08-22T00:00:00Z",
  "periodEndUnchanged": "2027-03-01T00:00:00Z",
  "unusedCredit": { "amount": "420000", "currency": "IRR", "minorUnits": 0 },
  "newCharge":    { "amount": "980000", "currency": "IRR", "minorUnits": 0 },
  "amountDue":    { "amount": "560000", "currency": "IRR", "minorUnits": 0 },
  "entitlementDiff": {
    "gained": ["ai.assistant", "white_label"],
    "limitsIncreased": [{ "resource": "products", "from": 50, "to": 5000 }]
  }
}
```

### 6.3 Initiate a payment (redirect-and-verify, ADR-023)

`POST /api/v1/billing/payments`

```json
{ "invoiceId": "inv_991", "provider": "provider_a", "returnUrl": "https://..." }
```

Response:

```json
{
  "paymentIntentId": "pi_77",
  "status": "PENDING",
  "redirectUrl": "https://gateway.example/pay/AUTH123",
  "amount": { "amount": "560000", "currency": "IRR", "minorUnits": 0 },
  "expiresAt": "2026-08-22T00:30:00Z"
}
```

The callback endpoint accepts the provider's return, then **always** performs a server-side verify before any state change. A callback alone never marks a payment paid.

### 6.4 Add a domain

`POST /api/v1/stores/{storeId}/domains`

```json
{ "hostname": "فروشگاه.example", "type": "APEX" }
```

Response returns the canonical punycode hostname, the verification method, the token, and the exact DNS record to create. The unicode form is echoed for display only.

---

## 7. Error Codes

```text
AUTHENTICATION_REQUIRED
SESSION_INVALIDATED
FORBIDDEN
TENANT_CONTEXT_REQUIRED
STORE_ACCESS_DENIED
RATE_LIMITED
ENTITLEMENT_REQUIRED
ENTITLEMENT_CONFLICT
QUOTA_EXCEEDED
IDEMPOTENCY_CONFLICT
APPROVAL_REQUIRED
APPROVAL_EXPIRED
VALIDATION_ERROR
RESOURCE_NOT_FOUND
CONFLICT
CONCURRENCY_CONFLICT
INTERNAL_ERROR

-- added in 2.0
SUBSCRIPTION_REQUIRED
SUBSCRIPTION_EXPIRED
SUBSCRIPTION_IN_GRACE
SUBSCRIPTION_NOT_SERVING
PLAN_CHANGE_NOT_ALLOWED
PLAN_CHANGE_PAYMENT_REQUIRED
PLAN_CHANGE_ALREADY_SCHEDULED
PLAN_CHANGE_INCOMPARABLE
OVER_LIMIT
CURRENCY_MISMATCH
PAYMENT_VERIFICATION_FAILED
PAYMENT_AMOUNT_MISMATCH
PAYMENT_PENDING_VERIFICATION
PROVIDER_CAPABILITY_UNSUPPORTED
DOMAIN_ALREADY_CLAIMED
DOMAIN_VERIFICATION_FAILED
DOMAIN_RESERVED
DOMAIN_LIMIT_REACHED
CERTIFICATE_NOT_READY
HOST_NOT_RESOLVED
```

`QUOTA_EXCEEDED` and `OVER_LIMIT` must include, in `details`: `resource`, `current`, `limit`, and `resolution` (`upgrade` or `reduce`). A bare limit error is not an acceptable contract.

`CONCURRENCY_CONFLICT` is RETRYABLE — unlike `CONFLICT`, which means the request permanently conflicts with existing state until the client changes something, `CONCURRENCY_CONFLICT` means a database-level deadlock or serialization failure aborted this specific attempt, and resubmitting the identical request is the expected client behavior. A client must not treat the two the same way.

---

## 8. Versioning

Breaking contract changes require `/api/v2` or a new capability major version. Additive fields must be backward-compatible and documented. Generated schema artifacts are committed on every contract change, and a CI check fails when generated output differs from the committed artifact.
