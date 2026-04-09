# TWICELY STRIPE CONNECT IMPLEMENTATION SPEC (ENDPOINTS + WEBHOOKS) - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document specifies Twicely's concrete **API endpoints**, **webhook handlers**, and **processing behaviors** for Stripe Connect.

It is implementation-oriented:
- Exact endpoint list
- Request/response shapes (high level, stable)
- Webhook routing + idempotency expectations
- Transfer timing policies
- Error codes and retry rules
- Admin tooling endpoints (minimal)

This spec MUST align with:
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`
- `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`

> NOTE: This document does **not** reference any external marketplace. It is purely Twicely's implementation spec.

---

## 0. Conventions

### 0.1 Authentication
All endpoints (except webhook) require an authenticated session.
- `actorUserId` resolved from session.
- If acting on behalf of an owner, enforce delegated access rules.

### 0.2 Ownership
Seller ownership always resolves to a userId.
- sellerId = owner userId

### 0.3 Currency + Amounts
All money amounts are integers in minor units (e.g., cents).

### 0.4 Error Format (Stable)
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": { "optional": "object" }
  }
}
```

### 0.5 Idempotency
- Client-initiated requests that create provider objects MUST accept an `Idempotency-Key` header (or generate one server-side).
- Webhook handling is idempotent by provider event id.

---

## 1. Seller Onboarding (Connect)

### 1.1 Create/Ensure Connected Account
**POST** `/api/payments/connect/account`

Creates (or returns existing) Stripe connected account for the authenticated user.

**Request**
```json
{
  "country": "US",
  "email": "optional",
  "businessType": "individual|company"
}
```

**Response**
```json
{
  "userId": "twi_u_...",
  "stripeAccountId": "acct_...",
  "status": "unverified|pending|verified|restricted",
  "chargesEnabled": false,
  "payoutsEnabled": false
}
```

**Behavior**
- If profile exists, return it (no new account).
- If not, create connected account with Stripe.
- Persist `SellerPaymentsProfile`.

**Errors**
- `CONNECT_ACCOUNT_CREATE_FAILED`
- `INVALID_COUNTRY`

---

### 1.2 Create Onboarding Link
**POST** `/api/payments/connect/onboarding-link`

Creates a Stripe onboarding link for the seller's connected account.

**Request**
```json
{
  "refreshUrl": "https://...",
  "returnUrl": "https://..."
}
```

**Response**
```json
{
  "url": "https://connect.stripe.com/..."
}
```

**Behavior**
- Requires `stripeAccountId`.
- Used by seller to complete onboarding.

**Errors**
- `CONNECT_ACCOUNT_NOT_FOUND`
- `ONBOARDING_LINK_CREATE_FAILED`

---

### 1.3 Create Login Link (Stripe Express Dashboard)
**POST** `/api/payments/connect/login-link`

**Response**
```json
{
  "url": "https://connect.stripe.com/express/..."
}
```

**Errors**
- `LOGIN_LINK_CREATE_FAILED`

---

### 1.4 Get Seller Payments Status
**GET** `/api/payments/connect/status`

**Response**
```json
{
  "stripeAccountId": "acct_...",
  "status": "unverified|pending|verified|restricted",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirementsDue": ["string", "..."]
}
```

**Behavior**
- May call Stripe to refresh status or return cached with staleness cap (e.g., 5 minutes).

---

## 2. Checkout / Payment Intent

### 2.1 Create Checkout PaymentIntent (Buyer)
**POST** `/api/checkout/payment-intent`

Creates an Order + OrderPayment + Stripe PaymentIntent.

**Request**
```json
{
  "items": [
    { "listingId": "lst_...", "quantity": 1 }
  ],
  "shippingAddressId": "addr_...",
  "shippingOptionId": "ship_opt_...",
  "buyerNote": "optional string"
}
```

**Response**
```json
{
  "orderId": "ord_...",
  "orderPaymentId": "op_...",
  "paymentIntentId": "pi_...",
  "clientSecret": "pi_..._secret_...",
  "amountTotal": 12345,
  "currency": "usd"
}
```

**Behavior (Hard Requirements)**
- Validate listing availability and lock inventory **atomically**.
- Create `Order` state: `created` -> `awaiting_payment`.
- Create `OrderPayment` with provider IDs.
- Create PaymentIntent with metadata linking:
  - `orderId`, `orderPaymentId`, `sellerId`, `buyerId`
- Idempotent: if same idempotency key reused, return same PI/order.

**Errors**
- `LISTING_NOT_AVAILABLE`
- `INVENTORY_LOCK_FAILED`
- `PAYMENT_INTENT_CREATE_FAILED`

---

### 2.2 Confirm Payment (Client-Side)
Client confirms using Stripe client SDK.
Twicely must NOT mark paid from client confirmation response.

Paid state comes from webhook.

---

### 2.3 Get Order Payment Status (Polling)
**GET** `/api/orders/{orderId}/payment-status`

**Response**
```json
{
  "orderId": "ord_...",
  "orderStatus": "awaiting_payment|paid|cancelled",
  "paymentStatus": "requires_payment|paid|failed|refunded|partial_refund|chargeback"
}
```

---

## 3. Transfers (Seller Net)

### 3.1 Transfer Timing Policy (Config)
Twicely supports two modes:

- **Immediate Transfer** (default for verified sellers)
  - Create transfer after payment confirmed (webhook).
- **Held Transfer**
  - Delay transfer until:
    - seller connected account verified AND
    - optional risk window elapsed OR
    - order fulfilled/delivered (policy choice)

This is a configuration decision:
```ts
TransferPolicy {
  mode: "immediate" | "held"
  holdUntil: "seller_verified" | "fulfilled" | "delivered" | "days_after_paid"
  holdDays?: number
}
```

Transfers MUST be created server-side only (never client-side).

---

## 4. Refunds / Disputes

### 4.1 Request Refund (Seller/Staff)
Creates a pending refund request record (optional workflow) OR directly initiates refund if permission allows.

**POST** `/api/orders/{orderId}/refunds`

**Request**
```json
{
  "amount": 5000,
  "reasonCode": "ITEM_NOT_AS_DESCRIBED|SHIPPING_ISSUE|OTHER",
  "note": "optional"
}
```

**Response**
```json
{
  "refundRequestId": "rr_...",
  "status": "pending|initiated"
}
```

**Permissions**
- Owner: allowed
- Delegated staff:
  - `refunds.request` to create pending
  - `refunds.initiate` to initiate immediately
- Platform staff: allowed with reasonCode

**Errors**
- `REFUND_NOT_ALLOWED`
- `REFUND_AMOUNT_INVALID`

---

### 4.2 Initiate Refund (Server)
If initiated:
- Create Stripe refund against the charge / payment intent.
- If transfer already created:
  - create transfer reversal or ledger adjustment.
- Update `OrderPayment` only after webhook confirmation.

---

## 5. Webhook Endpoint (Stripe)

### 5.1 Webhook URL
**POST** `/api/webhooks/stripe`

No auth. Requires Stripe signature validation.

**Behavior**
- Validate signature with webhook secret.
- Insert PaymentEventLog (upsert by event id).
- Acknowledge quickly (200) after durable logging OR enqueue.
- Process idempotently (see webhooks spec).

**Response**
- Always 200 for valid signatures, even if ignored
- 400 for invalid signature
- 500 for transient processing failures (to trigger retry)

---

## 6. Webhook Event Handling (Required Routes)

Each handler must:
- Be idempotent
- Resolve correlation to `OrderPayment` using stored provider IDs and/or metadata
- Apply state transitions
- Post ledger entries
- Write audit events where applicable

### 6.1 `payment_intent.succeeded`
**Actions**
- Resolve `OrderPayment` by `pi_...`
- Set `OrderPayment.status = paid` (idempotent)
- Set `Order.state = paid` and `paidAt`
- Transition listing:
  - `active -> sold` (system)
- Depending on transfer policy:
  - Create transfer now OR schedule hold
- Post ledger entries:
  - sale, fee, transfer (if created)
- Mark event processed

### 6.2 `payment_intent.payment_failed`
**Actions**
- Set `OrderPayment.status = failed`
- Release inventory lock
- Set order state to cancelled (or awaiting_payment with timeout policy)
- Ledger: optional "failed attempt" entry (usually not)
- Mark processed

### 6.3 `charge.refunded` / `refund.created`
**Actions**
- Determine refund amount
- Update `OrderPayment.status`:
  - partial_refund vs refunded
- Update order state:
  - refunded/partial_refunded + close if terminal
- Reverse transfer or post adjustment entry
- Ledger: refund + reversal/adjustment entries
- Mark processed

### 6.4 `transfer.created`
**Actions**
- Link `stripeTransferId` to OrderPayment (if metadata matches)
- Ledger: transfer entry
- Mark processed

### 6.5 `transfer.reversed`
**Actions**
- Ledger: adjustment/debit entry
- Update internal payout indicators if tracked
- Mark processed

### 6.6 `charge.dispute.created`
**Actions**
- Set `OrderPayment.status = chargeback`
- Set order state to `disputed`
- Ledger: dispute debit
- Mark processed

### 6.7 `charge.dispute.closed`
**Actions**
- Update `OrderPayment.status` based on outcome
- Ledger: adjustment credit/debit
- Mark processed

### 6.8 `account.updated`
**Actions**
- Update `SellerPaymentsProfile` fields:
  - chargesEnabled, payoutsEnabled, requirementsDue
- If holds exist due to verification:
  - evaluate releasing holds / creating queued transfers
- Mark processed

### 6.9 `payout.paid` / `payout.failed` (recommended)
**Actions**
- Record payout ledger entries (if you track)
- Useful for reconciliation
- Mark processed

---

## 7. Admin / Finance Endpoints (Minimal)

These endpoints are platform RBAC protected.

### 7.1 List Webhook Events
**GET** `/api/admin/finance/webhooks?status=failed&type=...&from=...&to=...`

### 7.2 Retry Webhook Processing
**POST** `/api/admin/finance/webhooks/{eventId}/retry`

Behavior:
- increments attemptCount
- reprocesses idempotently
- returns updated status

### 7.3 Ledger Search
**GET** `/api/admin/finance/ledger?orderId=...&sellerId=...&type=...&from=...&to=...`

### 7.4 Reconciliation Runs
**GET** `/api/admin/finance/reconciliation/runs`
**POST** `/api/admin/finance/reconciliation/run` (start a new run for a range)

### 7.5 Mismatch Inbox
**GET** `/api/admin/finance/reconciliation/mismatches?status=open`
**POST** `/api/admin/finance/reconciliation/mismatches/{id}/resolve`

---

## 8. Security Requirements (Hard Requirements)

- Webhook signature verification required.
- Webhook handler must be idempotent.
- All high-risk actions (payout destination change, refund initiation) require:
  - step-up auth
  - audit logging
  - owner notification
- Never store card details.
- Rate-limit sensitive endpoints:
  - onboarding link creation
  - refund initiation
  - payout management

---

## 9. Timeouts & Retries

### Webhook
- If processing cannot complete quickly:
  - log then enqueue
  - return 200
- If a true transient failure occurs:
  - return 500 to trigger provider retry
- Maintain a dead-letter mechanism:
  - events that fail N times remain `failed` and appear in admin console

### Client
- Buyer UI should poll `/payment-status` after confirmation until `paid` or timeout.
- Do not display "Paid" until server confirms.

---

## 10. Acceptance Checklist

- [ ] Seller Connect onboarding works end-to-end.
- [ ] Connected account status sync updates `SellerPaymentsProfile`.
- [ ] Checkout creates Order + PaymentIntent with correlation metadata.
- [ ] Paid status comes only from webhooks.
- [ ] Listing transitions to sold only after paid.
- [ ] Transfers follow TransferPolicy and are not double-created.
- [ ] Refund/dispute handling updates states via webhooks and posts ledger entries.
- [ ] Webhook handler is idempotent under retries.
- [ ] Admin tools can view failed events and retry safely.
- [ ] Reconciliation can be run and mismatches resolved.

---

## VERSION
- **v1.0 - Stripe Connect endpoints + webhook handlers baseline**
- Date locked: 2026-01-17
