# TWICELY WEBHOOKS + IDEMPOTENCY + LEDGER/RECONCILIATION SPEC - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines Twicely's **financial event ingestion** via webhooks, required idempotency guarantees, and the internal **ledger + reconciliation** system used for reporting, audits, and operational support.

This spec MUST align with:
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`
- `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

> NOTE: This document intentionally does **not** reference any external marketplace. It is purely Twicely's internal spec.

---

## 0. Objectives

1. Reliably process payment platform events (payments, transfers, refunds, disputes, account updates)
2. Guarantee **idempotent** processing (safe retries, no double-posting)
3. Maintain a **ledger** for internal reporting and traceability
4. Provide **reconciliation** tools to match internal records with payment platform truth
5. Enable secure operations (audits, finance dashboards, exports)

---

## 1. Source of Truth

- **Payment platform is the canonical source of truth** for money movement and balances.
- Twicely stores:
  - foreign IDs (pi_, ch_, tr_, re_, dp_, acct_, etc.)
  - derived state (OrderPayment status)
  - a ledger representation for reporting/reconciliation
  - an event ingestion log for traceability

Twicely must never "invent" a paid/refunded/disputed state without verifying via webhook or direct fetch.

---

## 2. Required Data Models

### 2.1 Webhook Event Log (Required)
Stores every received webhook event with processing metadata.

```ts
PaymentEventLog {
  id
  provider                // "stripe"
  providerEventId         // evt_...
  type                    // e.g. "payment_intent.succeeded"
  apiVersion?
  livemode                // boolean
  payloadJson             // raw payload (encrypted at rest if possible)
  signatureValid          // boolean
  receivedAt

  status                  // "received" | "processed" | "ignored" | "failed"
  processedAt?
  attemptCount            // integer
  lastErrorCode?
  lastErrorMessage?
  lastErrorAt?

  // Idempotency + correlation
  idempotencyKey          // computed stable key (see section 4)
  correlationIdsJson?     // { orderId, orderPaymentId, sellerId, buyerId, ... }
}
```

**Uniqueness constraints**
- Unique(provider, providerEventId)
- Unique(provider, idempotencyKey) (recommended)

### 2.2 Ledger Entry (Required)
A ledger is an internal accounting log of financial effects for reporting and reconciliation.

```ts
LedgerEntry {
  id
  provider                // "stripe"
  providerObjectType      // "payment_intent" | "charge" | "transfer" | "refund" | "dispute" | "payout" | "balance_txn"
  providerObjectId        // pi_/ch_/tr_/re_/dp_/po_/txn_

  sellerId?               // owner userId (when applicable)
  buyerId?
  orderId?
  orderPaymentId?

  type                    // "sale" | "fee" | "transfer" | "refund" | "dispute" | "payout" | "adjustment"
  direction               // "credit" | "debit"
  amount                  // integer minor units (cents)
  currency                // "usd"

  occurredAt              // timestamp from provider
  postedAt                // when Twicely posted it

  metadataJson?           // includes fee breakdown, dispute reason, etc.
}
```

**Uniqueness constraints**
- Unique(provider, providerObjectType, providerObjectId, type) OR
- Unique(provider, providerObjectId, type, amount, occurredAt) (choose one consistent strategy)

### 2.3 Reconciliation Snapshot (Recommended)
Tracks daily/periodic reconciliation progress.

```ts
ReconciliationRun {
  id
  provider                // "stripe"
  rangeStart
  rangeEnd
  status                  // "running" | "complete" | "failed"
  totalsJson              // expected vs actual
  mismatchesCount
  createdAt
  completedAt?
  lastErrorMessage?
}
```

### 2.4 Mismatch Record (Recommended)
Stores reconciliation issues.

```ts
ReconciliationMismatch {
  id
  reconciliationRunId
  providerObjectId
  mismatchType            // "missing_internal" | "missing_provider" | "amount" | "currency" | "status" | "mapping"
  expectedJson
  actualJson
  createdAt
  resolvedAt?
  resolvedByUserId?
  resolutionNote?
}
```

---

## 3. Required Webhook Event Types

Twicely must subscribe and support at least these event types:

### Payments
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.succeeded` (optional but useful)
- `charge.refunded`

### Transfers (Connect)
- `transfer.created`
- `transfer.reversed`

### Refunds
- `refund.created`
- `refund.updated` (optional)

### Disputes
- `charge.dispute.created`
- `charge.dispute.closed`

### Connected Account Updates
- `account.updated`

### Payouts & Balance (Recommended for reconciliation)
- `payout.paid`
- `payout.failed`
- `balance.available` (optional)
- `balance_transaction.*` (or fetch via API during reconciliation)

> If you add additional providers later, mirror this structure under `provider`.

---

## 4. Idempotency (Canonical)

Webhook processing must be safe to retry and safe to run concurrently.

### 4.1 Idempotency Key (Required)
Compute a stable key per event that uniquely represents the financial effect.

Recommended:
```text
idempotencyKey = provider + ":" + providerEventId
```

Additionally, for ledger posting, compute a stable key per object-effect:
```text
ledgerKey = provider + ":" + providerObjectType + ":" + providerObjectId + ":" + type
```

### 4.2 Processing Rules
- Insert into `PaymentEventLog` first (upsert by providerEventId).
- If `status == processed`, return 200 immediately (no-op).
- Process in a DB transaction:
  1) Validate signature
  2) Resolve internal mappings (OrderPayment, sellerId, orderId)
  3) Apply state transitions (OrderPayment)
  4) Post ledger entries (upsert by ledgerKey)
  5) Mark event processed

### 4.3 Concurrency Controls
Use one of:
- DB row lock on PaymentEventLog row
- Advisory lock on `providerEventId`
- Queue with single-consumer per event key

Minimum requirement: prevent double ledger posting.

---

## 5. Mapping & Correlation (How Twicely links events to orders)

### 5.1 Required correlations
Twicely must store provider IDs on OrderPayment:
- `stripePaymentIntentId`
- `stripeChargeId` (when available)
- `stripeTransferId` (when applicable)
- `stripeRefundIds[]` (optional)

### 5.2 Mapping algorithm
When a webhook arrives:
1. Extract provider object IDs from payload (pi_/ch_/tr_/re_/dp_/acct_)
2. Attempt to find `OrderPayment` in this order:
   - match by `stripePaymentIntentId`
   - match by `stripeChargeId`
   - match by `stripeTransferId`
   - match by refund ID in `stripeRefundIds`
3. If found:
   - attach correlations to PaymentEventLog.correlationIdsJson
4. If not found:
   - mark event `ignored` with reason OR `failed` if it should never happen
   - create a ReconciliationMismatch if in-scope for reconciliation

---

## 6. State Machine Updates (OrderPayment)

### 6.1 Canonical transitions
- `requires_payment` -> `paid` on `payment_intent.succeeded`
- `requires_payment` -> `failed` on `payment_intent.payment_failed`
- `paid` -> `partial_refund` on partial refund
- `paid` -> `refunded` on full refund
- any -> `chargeback` on dispute created
- `chargeback` -> `paid/refunded` on dispute closed (depending on outcome)

All updates must be idempotent:
- Applying the same transition twice must not change totals incorrectly.

---

## 7. Ledger Posting Rules (What entries get created)

### 7.1 Sale posting
On successful payment:
- `LedgerEntry(type="sale", direction="credit", amount=amountTotal)`
- `LedgerEntry(type="fee", direction="debit", amount=twicelyFeeAmount)` (or separate fee line items)
- `LedgerEntry(type="transfer", direction="debit", amount=sellerNetAmount)` if transfer happens immediately

> If transfers are delayed/held, post transfer only when `transfer.created` arrives.

### 7.2 Refund posting
On refund:
- `LedgerEntry(type="refund", direction="debit", amount=refundAmount)`
- If transfer was made:
  - post reversal/adjustment entry keyed to the transfer reversal

### 7.3 Dispute posting
On dispute created:
- `LedgerEntry(type="dispute", direction="debit", amount=disputedAmount)`
On dispute closed:
- Post an `adjustment` credit/debit depending on outcome.

### 7.4 Payout posting (optional but recommended)
On payout paid/failed:
- `LedgerEntry(type="payout", direction="debit", amount=payoutAmount)` (seller side)
- Include payout destination metadata if allowed.

---

## 8. Reconciliation (Required)

Reconciliation ensures Twicely's ledger matches provider reality.

### 8.1 Frequency
- Minimum: daily
- Recommended: hourly for high volume, plus daily closeout

### 8.2 Reconciliation Method
For a given time range:
1. Fetch provider balance transactions (or equivalent)
2. For each provider object:
   - Ensure a corresponding ledger entry exists
   - Ensure amounts/currency match
   - Ensure mapped OrderPayment exists where expected
3. Compute totals:
   - gross sales
   - fees
   - transfers
   - refunds
   - disputes
4. Store `ReconciliationRun` summary + mismatches

### 8.3 Mismatch Handling
Mismatch types:
- Missing internal record
- Missing provider object (rare; indicates deletion/incorrect ID)
- Amount mismatch
- Currency mismatch
- Status mismatch
- Mapping mismatch (object exists but not linked to an OrderPayment)

Resolution:
- Finance/admin can mark resolved with note
- Some can auto-heal (e.g., missing ledger entry can be backfilled)

---

## 9. Webhook Endpoint Requirements (Hard Requirements)

- Signature verification required for all events.
- Return **200 quickly** after enqueueing or logging (avoid provider retries due to timeouts).
- All processing must be idempotent.
- Store raw payload (securely).
- Never trust client-side "payment success" state.

### Error policy
- If signature invalid -> 400 (do not process)
- If temporary failure -> 500 (provider will retry)
- If event irrelevant -> 200 but status=ignored

---

## 10. Operational Tooling (Recommended)

### Finance/Admin dashboard should provide:
- Event log viewer (filter by type, status, date)
- OrderPayment drill-down (show provider IDs + status history)
- Ledger explorer (filter by seller/order/type/date)
- Reconciliation runs history
- Mismatch inbox with resolution actions
- Export (CSV/JSON) for accounting

---

## 11. Security & Privacy

- Encrypt webhook payload storage if feasible.
- Restrict finance tooling to platform RBAC.
- Redact sensitive fields in logs (never store full PAN, etc.).
- Apply retention policy:
  - Keep raw events X days (e.g., 90-180)
  - Keep ledger + reconciliation summaries longer for audits

---

## 12. Acceptance Checklist

- [ ] Webhook endpoint validates signature.
- [ ] Every provider event is logged exactly once (unique providerEventId).
- [ ] Processing is safe under retries (idempotent).
- [ ] Ledger entries are upserted by stable ledgerKey (no doubles).
- [ ] OrderPayment state transitions are idempotent.
- [ ] Reconciliation can detect and record mismatches.
- [ ] Admin tooling can review and resolve mismatches.
- [ ] Exports match provider totals within acceptable tolerance.

---

## VERSION
- **v1.0 - Webhooks + idempotency + ledger/reconciliation baseline**
- Date locked: 2026-01-17
