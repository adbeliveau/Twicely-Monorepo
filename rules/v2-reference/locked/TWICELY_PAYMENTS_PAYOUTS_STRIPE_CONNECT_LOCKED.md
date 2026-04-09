# TWICELY PAYMENTS & PAYOUTS SPEC (STRIPE CONNECT, EBAY-MIRRORED) - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines Twicely's payments + payouts architecture using **Stripe Connect** while preserving the **eBay-mirrored ownership and delegated access model**:

- **One real owner (User)**
- Listings/Orders/Payouts are owned by `userId`
- Businesses are metadata (tax/legal), not owners
- Staff can act only via **delegated permissions**
- Payout changes are high-risk and require additional security + audit

This spec MUST align with:
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

---

## 0. Goals (What this system must achieve)

1. **Collect buyer payment** reliably
2. **Route funds to seller** (via Stripe Connect)
3. **Take Twicely fees** (platform commission, service fees)
4. **Handle refunds/chargebacks** safely
5. Provide **traceability** (audit + reconciliation)
6. Support **delegated operations** without transferring ownership

---

## 1. Core Principles (Non-Negotiable)

1. **Seller is always a User**
   - A "seller account" is a Stripe Connected Account tied to a User.
2. **Payout destination is owned by the seller (User)**
   - Staff never own or control payout destination unless explicitly granted.
3. **Platform does not hold ambiguous money**
   - Every transaction must be reconcilable to Stripe objects.
4. **High-risk operations require extra controls**
   - Payout setup/changes and refunds have stricter permissions and logging.
5. **Single source of truth for financial state**
   - Stripe is the payment source of truth; Twicely records are ledger/audit.

---

## 2. Stripe Connect Model (Recommended)

### Connect Type
Use **Stripe Connect with separate charges and transfers** OR **destination charges** depending on your compliance needs.
Baseline recommendation for marketplaces: **Separate charges and transfers** (more control and clearer platform fee handling).

> If you later need tax/VAT marketplace facilitator flows, this model stays compatible.

### Entities Mapping

- **Twicely Platform Stripe Account**: the platform
- **Seller Connected Account**: one per `User` who sells
- **PaymentIntent / Charge**: buyer payment
- **Transfer**: movement to seller connected account
- **Application Fee**: Twicely fee (if using destination charges) OR captured as retained amount (if separate charges/transfers)

---

## 3. Required Twicely Records (Minimum)

### Seller Payments Profile (Connect linkage)
```ts
SellerPaymentsProfile {
  userId                     // owner userId (seller)
  stripeAccountId            // acct_...
  status                     // "unverified" | "pending" | "verified" | "restricted"
  payoutsEnabled             // boolean
  chargesEnabled             // boolean
  requirementsDueJson        // Stripe requirements snapshot
  defaultCurrency            // e.g., "usd"
  country                    // e.g., "US"
  createdAt
  updatedAt
}
```

### Order Payment (per order)
```ts
OrderPayment {
  id
  orderId
  buyerId
  sellerId                   // owner userId
  currency
  amountSubtotal
  amountShipping
  amountTax
  amountTotal

  twicelyFeeAmount
  processingFeeAmount        // Stripe fees (estimated/actual)
  sellerNetAmount

  stripePaymentIntentId      // pi_...
  stripeChargeId?            // ch_...
  stripeTransferId?          // tr_...
  stripeRefundIdsJson?       // list of re_...

  status                     // "requires_payment" | "paid" | "refunded" | "partial_refund" | "chargeback" | "failed"
  createdAt
  updatedAt
}
```

### Payout Ledger (optional but recommended)
Stripe will handle payouts, but Twicely should maintain a ledger for reporting and reconciliation.

```ts
PayoutLedgerEntry {
  id
  sellerId                   // owner userId
  orderId?
  type                       // "sale" | "fee" | "refund" | "chargeback" | "adjustment"
  amount                     // signed (+/-)
  currency
  stripeObjectId             // pi_/ch_/tr_/re_/po_
  occurredAt
  createdAt
}
```

### Audit Event (required)
Reuse the audit rules from RBAC spec.

---

## 4. Money Flow (Canonical)

### A) Checkout (Buyer pays)
1. Buyer checks out
2. Twicely creates:
   - `Order`
   - `OrderPayment` (status = requires_payment)
3. Twicely creates Stripe `PaymentIntent` for amountTotal
4. Payment succeeds -> `OrderPayment.status = paid`

### B) Seller gets paid (Connect transfer)
After payment success:
- Twicely calculates:
  - Twicely fee
  - seller net
- Twicely creates Stripe `Transfer` to seller connected account for seller net

**Important:** The seller's payout schedule is controlled in Stripe for that connected account.

### C) Twicely keeps fee
Twicely keeps the fee in the platform account (retained funds) and records it in `PayoutLedgerEntry` as a fee.

---

## 5. Fee Model (Baseline)

### Fee components
- `twicelyFeeAmount` (platform commission, configurable)
- `processingFeeAmount` (Stripe fee, tracked)
- Optional:
  - `boostFeeAmount` (seller-paid boosting)
  - `promotionFeeAmount`

### Fee configuration
Fees should be configuration-driven:
- by category (optional)
- by seller tier (optional)
- by subscription tier (optional)

**But fees must always be materialized onto the OrderPayment at purchase time** for audit.

---

## 6. Refunds & Disputes (Chargebacks)

### Refund types
- Full refund
- Partial refund
- Shipping-only refund

### Refund rules
- Refunds should be initiated by:
  - Owner (seller) OR
  - Delegated staff with explicit permission
  - Platform support/admin (platform RBAC)

### Handling refunds with transfers
If you already transferred to seller:
- Prefer Stripe's recommended approach:
  - Issue refund from the original charge
  - Create a **reversal** for the transfer (or a negative transfer)
  - Record both in ledger

### Chargebacks
- Mark `OrderPayment.status = chargeback`
- Lock seller's available balance rules (optional risk controls)
- Audit the action and store Stripe dispute ids

---

## 7. Delegated Access (Payments-sensitive)

### Delegated permissions (payments)
These are high risk:

- `payouts.view`
- `payouts.manage` (high risk)
- `refunds.request`
- `refunds.initiate` (high risk)

### Default policy
- Staff can **view** payouts only if granted
- Staff can **request** refunds (creates a pending request)
- Staff cannot **initiate** refunds unless explicitly granted
- Staff cannot **change payout destination** unless explicitly granted AND owner has 2FA enabled

### Required security for high-risk permissions
- Owner must have 2FA enabled to grant:
  - `payouts.manage`
  - `refunds.initiate`
- For payout destination change:
  - Require re-auth / step-up verification
  - Email notification to owner
  - Audit event with IP + device + diff summary

---

## 8. Seller Onboarding (Connect)

### When onboarding happens
- Automatically when user attempts first listing OR first sale
- Or explicitly when user clicks "Set up payouts"

### Steps
1. Create Stripe connected account `acct_...`
2. Redirect seller to Stripe Connect onboarding
3. Store `stripeAccountId`
4. Periodically sync account status:
   - `payoutsEnabled`
   - `chargesEnabled`
   - `requirements_due`

### Seller cannot receive transfers unless
- `payoutsEnabled = true`
- account not restricted

If not enabled:
- Hold transfers (do not transfer yet) OR
- Put order in "payout pending" state until completed

(Exact hold behavior is a product choice; the system must support both.)

---

## 9. "Who owns the money?" Rules

- Buyer payment is collected by Twicely platform account.
- Seller receives their net via transfer to their connected account.
- Stripe handles payout schedule to bank/debit card depending on connected account settings.

### Twicely records are always keyed by:
- `sellerId = userId` (owner)

Never:
- businessId
- storeId

---

## 10. Reconciliation (Required)

Twicely must support:
- Daily sync of Stripe balance transactions
- Matching Stripe objects to `OrderPayment` and ledger entries
- A "finance dashboard" view for admins:
  - total volume
  - fees collected
  - transfers
  - refunds
  - disputes

### Source of truth
- Stripe is the canonical financial source of truth.
- Twicely DB is an audit + reporting mirror.

---

## 11. Security + Compliance Baseline

- Store only Stripe IDs, never raw card data.
- Use Stripe webhooks to confirm:
  - payment_intent.succeeded
  - charge.refunded
  - dispute.created/closed
  - transfer.created/reversed
  - account.updated
- Webhook processing must be idempotent.
- All webhook events must be logged (at least event id + type + timestamp).
- High-risk operations require:
  - step-up auth
  - owner notifications
  - audit trail

---

## 12. API Requirements (Hard Requirements)

### Buyer checkout endpoints must:
- Create Order + OrderPayment
- Create PaymentIntent
- Confirm success via webhook
- Return consistent status

### Seller payout endpoints must:
- Never trust sellerId from client without verifying ownership/delegation
- Enforce delegated permissions
- Write audit events

### Admin finance endpoints must:
- Be platform RBAC protected
- Provide exports (CSV/JSON) for accounting

---

## 13. Acceptance Checklist

- [ ] Each seller has exactly one Stripe connected account per userId.
- [ ] Listing/Order/Payment/Payout ownership always keys to seller userId.
- [ ] Transfers are created only after payment is confirmed.
- [ ] Refunds reverse transfers or record adjustments correctly.
- [ ] Chargebacks are captured and reflected in seller balance.
- [ ] Delegated staff cannot manage payouts unless explicitly granted + 2FA.
- [ ] Webhooks are idempotent and reconcile to internal records.
- [ ] Every privileged action is audited with actor + onBehalfOf.

---

## VERSION
- **v1.0 - Stripe Connect aligned to eBay-style ownership + delegation**
- Date locked: 2026-01-17
