# TWICELY V3 — Finance Engine Canonical

**Version:** v1.0
**Status:** LOCKED — single source of truth for ledger architecture, posting rules, balance derivation, payouts, reconciliation, and financial system design
**Date:** 2026-02-15
**Vocabulary:** StoreTier (storefront subscription), ListerTier (crosslister subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.

> **Law:** If it isn't in this file, it isn't real. If it conflicts with this file, this file wins for finance engine concerns.
> **Pricing Authority:** For fee rates, tier pricing, TF percentages, insertion fees, boosting, bundles — defer to `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md`. This document defines HOW money flows, not WHAT to charge.
> **RBAC Authority:** For actor types, CASL permissions, delegation scopes — defer to `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md`. This document defines finance-specific permission requirements.
> **UI Authority:** For seller analytics page specs, dashboard widgets — defer to `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` §9. This document defines the data layer those UIs consume.

---

## 1. PURPOSE

The Finance Engine is Twicely's financial system of record. It is not accounting software. It is not Stripe. It is not a BI tool.

It is the authoritative layer that:
- Tracks every cent that enters, moves within, or leaves the platform
- Derives seller balances from an immutable ledger
- Controls payout eligibility and execution
- Reconciles platform state with Stripe state
- Powers seller financial dashboards
- Powers corporate financial dashboards
- Enables audit reconstruction at any point in time
- Supports future accounting exports

**What the Finance Engine is NOT:**
- It is not the fee calculator (Pricing Canonical v3.2 owns fee rates)
- It is not the subscription billing system (Stripe owns recurring billing)
- It is not an ERP or general ledger (it's marketplace-specific)
- It is not a BI tool (BI reads from it, never writes)

---

## 2. NON-NEGOTIABLE PRINCIPLES

1. **Ledger is append-only.** No UPDATE or DELETE on ledger entries. Ever. Enforced at database level with a trigger that rejects mutations.
2. **No historical mutation.** Past entries are never changed. Corrections are new reversal entries that reference the original.
3. **All corrections via reversal entries.** Every reversal links back to the original via `reversalOfEntryId`. The reversal negates the original amount.
4. **Every payout traceable.** From payout → batch → ledger entries → orders → Stripe transfers. Full chain.
5. **Seller balances derivable from ledger.** `SellerBalance` is a cache. Delete it, replay the ledger, get the same numbers. If cache and ledger disagree, ledger wins.
6. **Stripe events correlate 1:1 with ledger entries.** Every Stripe webhook that moves money produces exactly one set of ledger entries with a `stripeEventId` correlation.
7. **All admin financial actions audit logged.** Manual adjustments, payout holds, reserve changes, fee overrides — all produce audit events per Actors Security §6.3.
8. **Financial reporting is deterministic.** Same inputs → same outputs. No floating point. All money in signed integer cents.
9. **No hidden fee calculations.** Every fee on every order can be explained by: seller's calendar-month GMV → progressive bracket lookup → marginal rate → amount (minimum $0.50). The formula is transparent.
10. **Rebuild-from-scratch mode.** Drop all caches, materialized views, and derived tables. Replay the ledger from entry #1. All balances, statements, and reports regenerate identically.

---

## 3. ARCHITECTURE

### 3.1 Five Layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 5: BI (future — read-only, admin-only)       │
│  Apache Superset / Redash — NOT authoritative        │
├─────────────────────────────────────────────────────┤
│  LAYER 4: Native Twicely UI                          │
│  Seller: /my/selling/finances/*                       │
│  Admin:  hub.twicely.co/fin/*                        │
├─────────────────────────────────────────────────────┤
│  LAYER 3: Reporting Views                            │
│  Materialized views for dashboards, statements,      │
│  period summaries. Refreshed on schedule.            │
├─────────────────────────────────────────────────────┤
│  LAYER 2: Balance Cache                              │
│  SellerBalance table — derived, rebuildable,         │
│  updated on every ledger post.                       │
├─────────────────────────────────────────────────────┤
│  LAYER 1: Ledger (PostgreSQL)                        │
│  Append-only. Immutable. System of record.           │
│  Every financial event = ledger entries.              │
└─────────────────────────────────────────────────────┘
```

### 3.2 System of Record

PostgreSQL is the system of record. The ledger table is the single source of financial truth. Everything above Layer 1 is derived and rebuildable.

### 3.3 Tech Stack Integration

| Component | Technology | Role in Finance |
|-----------|-----------|-----------------|
| Database | PostgreSQL + Drizzle ORM | Ledger, balances, statements, fee schedules |
| Payments | Stripe Connect | Payment capture, transfers, payouts, refunds |
| Cache | Valkey | Balance cache hot path, rate limiting |
| Job Queue | BullMQ | Payout batch processing, statement generation, reconciliation |
| Real-Time | Centrifugo | Balance updates, payout status notifications |
| Monitoring | Grafana + Prometheus | Financial health dashboards, reconciliation alerts |

---

## 4. LEDGER

### 4.1 LedgerEntry Schema

```typescript
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  // === ORDER LIFECYCLE ===
  'ORDER_PAYMENT_CAPTURED',        // Buyer payment captured by Stripe
  'ORDER_TF_FEE',                 // Platform Transaction Fee
  'ORDER_BOOST_FEE',               // Promoted listing attribution fee
  'ORDER_STRIPE_PROCESSING_FEE',   // Stripe's cut (pass-through, tracked for transparency)

  // === REFUNDS & ADJUSTMENTS ===
  'REFUND_FULL',                   // Full refund to buyer
  'REFUND_PARTIAL',                // Partial refund to buyer
  'SELLER_ADJUSTMENT',             // Seller-initiated partial refund (Twicely keeps fees)
  'REFUND_TF_REVERSAL',           // TF returned on full refund
  'REFUND_BOOST_REVERSAL',         // Boost fee returned on refund of attributed sale
  'REFUND_STRIPE_REVERSAL',        // Stripe processing fee reversal

  // === CHARGEBACKS ===
  'CHARGEBACK_DEBIT',              // Chargeback against seller
  'CHARGEBACK_REVERSAL',           // Chargeback reversed (seller won dispute)
  'CHARGEBACK_FEE',                // Stripe chargeback fee ($15)

  // === SHIPPING ===
  'SHIPPING_LABEL_PURCHASE',       // Seller buys label via Shippo
  'SHIPPING_LABEL_REFUND',         // Unused label refunded

  // === SUBSCRIPTIONS ===
  'STORE_SUBSCRIPTION_CHARGE',     // StoreTier monthly/annual charge
  'LISTER_SUBSCRIPTION_CHARGE',    // ListerTier monthly/annual charge
  'AUTOMATION_ADDON_CHARGE',       // Automation add-on charge
  'BUNDLE_SUBSCRIPTION_CHARGE',    // Bundle (Store + Lister) charge
  'SUBSCRIPTION_REFUND',           // Prorated subscription refund on downgrade

  // === OVERAGES ===
  'OVERAGE_PACK_PURCHASE',         // +500 publishes, AI credits, BG removals, or actions

  // === INSERTION FEES ===
  'INSERTION_FEE',                 // Fee for listing beyond monthly free allowance

  // === PAYOUTS ===
  'PAYOUT_SENT',                   // Funds transferred to seller's bank
  'PAYOUT_FAILED',                 // Payout failed — funds returned to available
  'PAYOUT_REVERSAL',               // Payout clawed back (rare — fraud cases)

  // === RESERVES ===
  'RESERVE_HOLD',                  // Funds moved to reserved (risk hold)
  'RESERVE_RELEASE',               // Reserved funds released to available

  // === ADMIN ===
  'MANUAL_CREDIT',                 // Admin credits seller (goodwill, error correction)
  'MANUAL_DEBIT',                  // Admin debits seller (policy violation recovery)
]);

export const ledgerEntryStatusEnum = pgEnum('ledger_entry_status', [
  'PENDING',   // Funds not yet settled (e.g., payment authorized but hold period active)
  'POSTED',    // Funds settled and affecting balances
  'REVERSED',  // Entry has been reversed by a subsequent entry
]);

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  postedAt: timestamp('posted_at'),                        // When entry transitions to POSTED

  // Classification
  status: ledgerEntryStatusEnum('status').notNull().default('PENDING'),
  type: ledgerEntryTypeEnum('type').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),

  // Money (signed integer cents — positive = credit to seller, negative = debit from seller)
  amountCents: integer('amount_cents').notNull(),

  // Ownership (ALL ownership resolves to userId per User Model §5)
  userId: uuid('user_id').references(() => users.id),      // The seller. Null for platform-only entries.

  // Context references (nullable — not every entry relates to all of these)
  orderId: uuid('order_id').references(() => orders.id),
  listingId: uuid('listing_id').references(() => listings.id),
  channel: channelEnum('channel'),                          // TWICELY, EBAY, POSHMARK, etc. Null = Twicely.

  // Reference linking (what triggered this entry)
  referenceType: varchar('reference_type', { length: 50 }).notNull(),  // 'order', 'refund', 'payout', 'subscription', 'adjustment', 'chargeback', 'shipping_label', 'insertion_fee', 'overage'
  referenceId: uuid('reference_id').notNull(),              // ID of the triggering record

  // Reversal chain
  reversalOfEntryId: uuid('reversal_of_entry_id').references(() => ledgerEntries.id),

  // Stripe correlation
  stripeEventId: varchar('stripe_event_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),

  // Idempotency
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),

  // Human-readable
  memo: text('memo'),
  metadata: jsonb('metadata').default('{}'),

  // Audit
  createdByUserId: uuid('created_by_user_id').references(() => users.id),  // For manual entries — who created it
  reasonCode: varchar('reason_code', { length: 50 }),                       // For manual entries — required
}, (table) => ({
  // Performance indexes
  idxUserIdCreatedAt: index().on(table.userId, table.createdAt),
  idxOrderId: index().on(table.orderId),
  idxType: index().on(table.type),
  idxStripeEventId: index().on(table.stripeEventId),
  idxIdempotencyKey: unique().on(table.idempotencyKey),
  idxReferenceTypeId: index().on(table.referenceType, table.referenceId),
  idxStatus: index().on(table.status),
}));
```

### 4.2 Immutability Enforcement

The ledger table has a PostgreSQL trigger that rejects UPDATE and DELETE:

```sql
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable. Use reversal entries for corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_immutability
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
```

This is beta blocker #9 from Actors Security §18.

### 4.3 Sign Convention

All `amountCents` values are from the **seller's perspective**:
- **Positive** = money flowing TO the seller (payment captured, reserve released, manual credit)
- **Negative** = money flowing FROM the seller (fees, refunds, payout sent, reserve hold, manual debit)

Platform revenue entries (TF, boost fees, subscription charges) are negative from the seller's perspective because they reduce the seller's balance.

### 4.4 Idempotency

Every ledger entry has a unique `idempotencyKey`. The key format:

| Event Type | Key Format |
|-----------|------------|
| Order payment | `order:{orderId}:captured` |
| TF fee | `order:{orderId}:tf` |
| Boost fee | `order:{orderId}:boost` |
| Stripe processing | `order:{orderId}:stripe_fee` |
| Full refund | `refund:{refundId}:full` |
| Partial refund | `refund:{refundId}:partial` |
| Seller adjustment | `adjustment:{adjustmentId}` |
| TF reversal | `refund:{refundId}:tf_reversal` |
| Chargeback | `chargeback:{disputeId}:debit` |
| Shipping label | `shipping_label:{labelId}` |
| Store subscription | `sub:store:{invoiceId}` |
| Lister subscription | `sub:lister:{invoiceId}` |
| Automation addon | `sub:automation:{invoiceId}` |
| Bundle subscription | `sub:bundle:{invoiceId}` |
| Overage pack | `overage:{purchaseId}` |
| Insertion fee | `insertion:{listingId}:{yearMonth}` |
| Payout | `payout:{payoutId}` |
| Reserve hold | `reserve:hold:{holdId}` |
| Reserve release | `reserve:release:{holdId}` |
| Manual adjustment | `manual:{adjustmentId}` |

Duplicate `idempotencyKey` inserts are silently ignored (ON CONFLICT DO NOTHING). This makes all posting operations safe to retry.

---

## 5. POSTING RULES

Every financial event produces a deterministic set of ledger entries. No event can partially post — all entries for an event are written in a single database transaction.

### 5.1 Order Captured (Twicely Marketplace Sale)

When a buyer purchases an item on Twicely and Stripe confirms payment capture:

```
Event: payment_intent.succeeded (Stripe webhook)

Entries:
  1. ORDER_PAYMENT_CAPTURED     +{itemPrice + shippingCharge}  (seller receives sale proceeds)
  2. ORDER_TF_FEE              -{tfAmount}                    (platform takes TF)
  3. ORDER_BOOST_FEE            -{boostAmount}                  (if boosted + attributed, else skip)
  4. ORDER_STRIPE_PROCESSING_FEE -{stripeAmount}                (pass-through, not platform revenue)

TF Calculation (Progressive Brackets — per Pricing Canonical v3.2 §2):
  currentMonthGmv = SUM(completed order amounts this calendar month for seller)
  orderAmount = itemPrice + shippingCharge

  Apply marginal rates to orderAmount based on where it falls in the bracket scale:
    Bracket 1: $0–$499 GMV         → 10.0%
    Bracket 2: $500–$1,999         → 11.0%
    Bracket 3: $2,000–$4,999       → 10.5%
    Bracket 4: $5,000–$9,999       → 10.0%
    Bracket 5: $10,000–$24,999     → 9.5%
    Bracket 6: $25,000–$49,999     → 9.0%
    Bracket 7: $50,000–$99,999     → 8.5%
    Bracket 8: $100,000+           → 8.0%

  Each dollar of the order is taxed at the marginal rate for the bracket it falls in
  (like income tax brackets). The effective rate declines as GMV grows.

  tfAmount = MAX(calculated_tf, minimumTfCents)  // minimum $0.50 per order
  minimumTfCents = platformSettings['commerce.tf.minimumCents']  // default: 50

  All bracket thresholds and rates are admin-configurable via platform settings.
  Calendar month resets on the 1st. Returns reduce current month's GMV.
  Local sales (5% flat) do NOT count toward monthly GMV.

Boost Calculation:
  If listing.boostPercentage > 0 AND sale is within 7-day attribution window:
    boostAmount = floor((itemPrice + shippingCharge) * listing.boostPercentage)
  Else:
    No boost entry

All entries: status = PENDING (transitions to POSTED after release window)
```

**Release window:** Orders stay PENDING for a configurable hold period (default: 3 days after delivery confirmed, or 7 days after tracking shows delivered). This protects against immediate returns. Admin-configurable via `finance.releaseHoldDays`.

### 5.2 Full Refund

When a buyer receives a full refund (return approved, item not received, etc.):

```
Event: charge.refunded (Stripe webhook)

Entries:
  1. REFUND_FULL                -{originalPaymentAmount}     (seller pays back full amount)
  2. REFUND_TF_REVERSAL        +{originalTfAmount}          (platform returns TF to seller)
  3. REFUND_BOOST_REVERSAL      +{originalBoostAmount}       (if original sale was boosted)
  4. REFUND_STRIPE_REVERSAL     +{originalStripeAmount}      (Stripe fee reversed)

Net effect on seller: loses the sale, but gets fees back.
Net effect on platform: loses TF revenue on this sale.

All entries link to original order via orderId.
All entries reference the Refund record via referenceType='refund', referenceId={refundId}.
```

### 5.3 Seller Adjustment (Partial Refund — Seller-Initiated)

Per Feature Lock-in §10: Seller-initiated partial refund. **Twicely keeps original fees.**

```
Event: Seller creates adjustment via /my/selling/orders/{orderId}

Entries:
  1. SELLER_ADJUSTMENT          -{adjustmentAmount}          (seller pays buyer partial refund)

NO fee reversal entries. Twicely keeps TF and boost fees on original sale.
This is a LOCKED decision — see Feature Lock-in §10 and Pricing Canonical v3.2.

Limits:
  - Max 3 adjustments per order
  - Total adjustments cannot exceed original order amount
  - Only seller or admin can initiate
```

### 5.4 Buyer-Initiated Partial Refund (Return — Fault-Based)

When a buyer's return is approved and the return involves partial refund:

```
Event: Return approved with partial refund

Entries:
  1. REFUND_PARTIAL             -{partialRefundAmount}
  2. REFUND_TF_REVERSAL        +{prorated TF on refunded portion}  (only if buyer-fault return)

Fee allocation follows fault rules:
  - Seller fault (INAD, DAMAGED): seller absorbs fees on refunded portion. No TF reversal.
  - Buyer fault (REMORSE): platform returns prorated TF. Buyer pays return shipping.
  - Platform fault (system error): platform absorbs. Full fee reversal on refunded portion.

See Feature Lock-in §40 for complete return fault allocation rules.
```

### 5.5 Chargeback

When Stripe notifies of a chargeback:

```
Event: charge.dispute.created (Stripe webhook)

Entries:
  1. CHARGEBACK_DEBIT           -{disputedAmount}            (funds removed from seller)
  2. CHARGEBACK_FEE             -{1500}                      ($15 Stripe chargeback fee)

If seller wins dispute (charge.dispute.closed, status=won):
  3. CHARGEBACK_REVERSAL        +{disputedAmount}            (funds returned to seller)
  (Chargeback fee is NOT reversed — Stripe keeps it regardless)

If seller's available balance is insufficient:
  Debit comes from reserved balance first, then available.
  If both insufficient: seller balance goes negative. Negative balance blocks payouts.
```

### 5.6 Shipping Label Purchase

When a seller purchases a shipping label through Shippo:

```
Event: Label purchased via /my/selling/orders/{orderId}/ship

Entries:
  1. SHIPPING_LABEL_PURCHASE    -{labelCostCents}            (deducted from seller balance)

If label is voided (unused within void window):
  2. SHIPPING_LABEL_REFUND      +{labelCostCents}            (returned to seller balance)
```

### 5.7 Subscription Charges

When Stripe processes a subscription invoice:

```
Event: invoice.paid (Stripe webhook)

Store subscription:
  1. STORE_SUBSCRIPTION_CHARGE  -{invoiceAmountCents}

Lister subscription:
  1. LISTER_SUBSCRIPTION_CHARGE -{invoiceAmountCents}

Automation add-on:
  1. AUTOMATION_ADDON_CHARGE    -{invoiceAmountCents}

Bundle:
  1. BUNDLE_SUBSCRIPTION_CHARGE -{invoiceAmountCents}

Subscription charges are NOT deducted from seller marketplace balance.
They are charged to the seller's payment method on file via Stripe.
Ledger entries exist for tracking/reporting only — amountCents reflects
the charge amount, but it doesn't reduce availableCents.

metadata includes: { billingType: 'subscription', subscriptionAxis: 'store'|'lister'|'automation'|'bundle', tier: 'STARTER'|'PRO'|'POWER'|etc., billingPeriod: 'monthly'|'annual' }
```

### 5.8 Insertion Fee

When a seller creates a listing beyond their monthly free allowance:

```
Event: Listing created, monthly count exceeds StoreTier allowance

Entries:
  1. INSERTION_FEE              -{insertionFeeCents}         (per Monetization §6)

Insertion fee rates by StoreTier: NONE $0.35, Starter $0.25, Pro $0.10, Power $0.05, Enterprise $0.
Imported listings are ALWAYS exempt — no insertion fee entry created for imports.
```

### 5.9 Overage Pack Purchase

When a seller buys an overage pack:

```
Event: Seller purchases overage pack via UI

Entries:
  1. OVERAGE_PACK_PURCHASE      -{900}                       (uniform $9 per pack)

metadata includes: { packType: 'publishes'|'ai_credits'|'bg_removals'|'automation_actions', quantity: 500|1000 }
```

### 5.10 Payout

When funds are transferred to the seller's bank account:

```
Event: Payout batch executes

Entries:
  1. PAYOUT_SENT                -{payoutAmountCents}         (funds leave platform)

If payout fails (bank rejection, etc.):
  2. PAYOUT_FAILED              +{payoutAmountCents}         (funds returned to available)

Payout entry references PayoutBatch and Payout records.
```

### 5.11 Reserve Hold / Release

When the platform holds funds for risk management:

```
Event: Admin or automated risk system places hold

Entries:
  1. RESERVE_HOLD               -{holdAmountCents}           (moved from available to reserved)

When hold is released:
  2. RESERVE_RELEASE            +{holdAmountCents}           (moved from reserved to available)

Reserve holds require: reason code, admin userId (if manual), expiry date.
Automated holds trigger on: high chargeback rate, new seller large payout, suspicious activity.
```

### 5.12 Manual Adjustment

Admin-initiated credit or debit:

```
Event: Finance admin creates adjustment via hub.twicely.co/fin/adjustments

Entries:
  1. MANUAL_CREDIT              +{adjustmentCents}           (goodwill, error correction)
  — OR —
  1. MANUAL_DEBIT               -{adjustmentCents}           (policy violation recovery)

Requirements:
  - Requires ADMIN or SUPER_ADMIN platform role
  - Requires 2FA verification per Actors Security §6.1
  - reasonCode is REQUIRED (not nullable for manual entries)
  - memo must describe the justification
  - Audit event severity: HIGH
  - createdByUserId recorded
```

---

## 6. SELLER BALANCE

### 6.1 Balance Buckets

Every seller has three balance buckets, all derived from ledger entries:

| Bucket | What's In It | Affected By |
|--------|-------------|-------------|
| **Pending** | Funds from orders not yet released (within hold period) | ORDER_PAYMENT_CAPTURED (adds), release timer (moves to available) |
| **Available** | Funds eligible for payout | Released orders, refund reversals, reserve releases |
| **Reserved** | Funds held for risk/dispute | RESERVE_HOLD (adds from available), RESERVE_RELEASE (returns to available) |

**Payout eligibility = Available balance only.** Pending and Reserved funds cannot be paid out.

### 6.2 SellerBalance Schema

```typescript
export const sellerBalances = pgTable('seller_balances', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  pendingCents: integer('pending_cents').notNull().default(0),
  availableCents: integer('available_cents').notNull().default(0),
  reservedCents: integer('reserved_cents').notNull().default(0),
  lastLedgerEntryId: uuid('last_ledger_entry_id').references(() => ledgerEntries.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**This is a cache.** It is updated transactionally with every ledger post. If it ever disagrees with a full ledger replay, the replay wins and the cache is rebuilt.

### 6.3 Balance Derivation Formula

```
pendingCents = SUM(amountCents) WHERE userId = X AND status = 'PENDING'
                                  AND type IN (order payment types)

availableCents = SUM(amountCents) WHERE userId = X AND status = 'POSTED'
                                   AND type NOT IN (reserve types, payout types)
                 MINUS reservedCents
                 MINUS SUM(payouts sent)

reservedCents = SUM(RESERVE_HOLD) - SUM(RESERVE_RELEASE) WHERE userId = X
```

In practice, the cache is maintained incrementally — each new ledger entry adjusts the appropriate bucket atomically.

### 6.4 Pending → Available Transition

Orders transition from PENDING to POSTED (and funds from pending to available) when:

1. Delivery confirmed AND hold period elapsed (default: 3 days post-delivery), OR
2. Tracking shows delivered AND extended hold period elapsed (default: 7 days), OR
3. Admin manually releases (with audit event)

A BullMQ scheduled job (`finance:release-pending`) runs every hour, checking for entries eligible for release.

### 6.5 Negative Balance

A seller's `availableCents` can go negative in edge cases (chargeback on already-paid-out funds). When negative:
- All payouts blocked until balance is positive
- Seller dashboard shows clear notification: "Your balance is -${amount} due to {reason}. Future sales will offset this balance."
- After 90 days negative with no resolution: escalate to admin for manual recovery

---

## 7. FEE SCHEDULE VERSIONING

### 7.1 FeeSchedule Schema

```typescript
export const feeSchedules = pgTable('fee_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  version: integer('version').notNull(),
  effectiveAt: timestamp('effective_at').notNull(),
  isActive: boolean('is_active').notNull().default(false),

  // Fee rates — progressive volume brackets (per Pricing Canonical v3.2 §2)
  rules: jsonb('rules').notNull(),
  // {
  //   tf: {
  //     brackets: [
  //       { maxCents: 49900,   rate: 1000 },  // $0–$499: 10.0%
  //       { maxCents: 199900,  rate: 1100 },  // $500–$1,999: 11.0%
  //       { maxCents: 499900,  rate: 1050 },  // $2,000–$4,999: 10.5%
  //       { maxCents: 999900,  rate: 1000 },  // $5,000–$9,999: 10.0%
  //       { maxCents: 2499900, rate: 950 },   // $10,000–$24,999: 9.5%
  //       { maxCents: 4999900, rate: 900 },   // $25,000–$49,999: 9.0%
  //       { maxCents: 9999900, rate: 850 },   // $50,000–$99,999: 8.5%
  //       { maxCents: null,    rate: 800 },   // $100,000+: 8.0%
  //     ],
  //     minimumCents: 50,                     // $0.50 minimum TF per order
  //     gmvWindowType: 'calendar_month'
  //   },
  //   insertionFees: { NONE: 35, STARTER: 25, PRO: 10, POWER: 5, ENTERPRISE: 0 },
  //   freeListings: { NONE: 100, STARTER: 250, PRO: 2000, POWER: 15000, ENTERPRISE: 100000 },
  //   boostRange: { min: 100, max: 800 },
  //   stripeProcessingBps: 290, stripeFixedCents: 30
  // }

  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  memo: text('memo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 7.2 Rules

- Fee schedules are effective-dated. A new version with a future `effectiveAt` activates automatically.
- Only ONE schedule is `isActive` at any time. Activation is handled by a cron job that checks `effectiveAt`.
- Orders are charged based on the fee schedule active **at the time of purchase**. Retroactive fee changes never apply to existing orders.
- Fee schedule changes require ADMIN + 2FA. Audit severity: HIGH.
- Per Pricing Canonical v3.2 §18: "No retroactive changes to past orders."

---

## 8. PAYOUTS

### 8.1 Payout Eligibility

A seller is eligible for payout when ALL of the following are true:

| Gate | Requirement | Source |
|------|-------------|--------|
| Account active | `sellerProfile.status = 'ACTIVE'` | User Model §3 |
| Payouts enabled | `sellerProfile.payoutsEnabled = true` | User Model §3 |
| Stripe connected | `sellerProfile.stripeAccountId` is set and verified | — |
| Positive available | `sellerBalance.availableCents > 0` | §6 above |
| No active holds | No unresolved RESERVE_HOLD entries | §5.11 |
| No payout destination change hold | 72hr hold after destination change has elapsed | Actors Security §18 (beta blocker #10) |
| Email verified | User's email is verified | Actors Security §1.4 |
| Minimum payout | `availableCents >= minimumPayoutCents` for seller's StoreTier (NONE: $15, Starter: $10, Pro: $1, Power: $1, Enterprise: $0 — per Pricing Canonical §5.1) | Per-tier keys in Platform Settings |

If any gate fails, the payout is blocked and the seller sees which gate(s) are failing with specific instructions to resolve.

### 8.2 PayoutBatch Schema

```typescript
export const payoutBatchStatusEnum = pgEnum('payout_batch_status', [
  'CREATED',       // Batch assembled, not yet processing
  'PROCESSING',    // Stripe transfers in progress
  'COMPLETED',     // All transfers succeeded
  'PARTIAL',       // Some succeeded, some failed
  'FAILED',        // All transfers failed
]);

export const payoutBatches = pgTable('payout_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  status: payoutBatchStatusEnum('status').notNull().default('CREATED'),
  totalSellers: integer('total_sellers').notNull().default(0),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  triggeredByUserId: uuid('triggered_by_user_id').references(() => users.id),  // Admin who triggered, or null for auto
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
```

### 8.3 Payout Schema

```typescript
export const payoutStatusEnum = pgEnum('payout_status', [
  'PENDING',       // In batch, not yet sent to Stripe
  'PROCESSING',    // Stripe transfer initiated
  'SENT',          // Stripe confirmed transfer
  'PAID',          // Funds arrived at seller's bank (Stripe payout.paid webhook)
  'FAILED',        // Transfer failed (bad account, insufficient platform balance, etc.)
  'CANCELLED',     // Admin cancelled before processing
]);

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  payoutBatchId: uuid('payout_batch_id').references(() => payoutBatches.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: payoutStatusEnum('status').notNull().default('PENDING'),
  amountCents: integer('amount_cents').notNull(),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  stripePayoutId: varchar('stripe_payout_id', { length: 255 }),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
  paidAt: timestamp('paid_at'),
  failedAt: timestamp('failed_at'),
});
```

### 8.4 Payout Frequency by Store Tier

Per Pricing Canonical v3.2 §5.1:

| Store Tier | Payout Method | Auto-Payout | Instant Available | Instant Fee |
|-----------|--------------|------------|-------------------|-------------|
| Free (NONE) | Manual request only | ❌ | ❌ | — |
| Starter | Manual + auto | Weekly (Fri) | ✅ ($10 min, $250 max) | $2.50 |
| Pro | Manual + auto | Weekly (Fri) | ✅ ($1 min, $250 max) | $2.50 |
| Power | Manual + auto | Daily M-F ($1/payout fee) | ✅ ($1 min, $250 max) | $2.50 |
| Enterprise | Manual + auto | Daily (free) | ✅ (free, negotiated max) | Negotiated |

**Execution methods:**

| Method | Frequency | Trigger |
|--------|-----------|---------|
| **Automatic (weekly)** | Fridays | BullMQ job at `payout.weeklyTime` (default: 06:00 UTC) for Starter/Pro sellers |
| **Automatic (daily)** | M-F | BullMQ job at `payout.dailyTime` (default: 06:00 UTC) for Power/Enterprise sellers |
| **On-demand** | Seller-initiated | Seller clicks "Request Payout" — subject to rate limit (1 per 24hrs) |
| **Instant** | Seller-initiated | Immediate transfer, $2.50 fee, Starter+ only |
| **Manual batch** | Admin-initiated | Admin triggers via hub.twicely.co/fin/payouts for specific sellers |

### 8.5 Payout Processing Flow

```
1. Assemble batch
   - Query all sellers where availableCents >= minimumPayoutCents
   - Verify all payout gates per §8.1
   - Create PayoutBatch + Payout records

2. Process transfers
   - For each Payout in batch:
     a. Create Stripe Transfer to seller's Connected Account
     b. On success: status → SENT, create PAYOUT_SENT ledger entry
     c. On failure: status → FAILED, create no ledger entry, log failureReason
   - Update batch: successCount, failureCount, status

3. Webhook confirmation
   - transfer.paid → Payout status → PAID, update paidAt
   - transfer.failed → Payout status → FAILED, create PAYOUT_FAILED ledger entry (returns funds to available)

4. Notification
   - Seller notified via Centrifugo + email on payout sent/paid/failed
```

### 8.6 Payout Dashboard

**Seller view** (`/my/selling/finances/payouts`):
- Next payout estimate: amount + expected date
- Payout history: date, amount, status, destination (masked account)
- Pending release: orders in hold period with expected release dates
- Blocked payout: which gate(s) are failing + how to fix

**Admin view** (`hub.twicely.co/fin/payouts`):
- Batch history with drill-down
- Failed payouts queue with retry capability
- Individual seller payout holds with reason
- Total platform liability (sum of all seller available balances)

---

## 9. SELLER STATEMENTS

### 9.1 SellerStatement Schema

```typescript
export const sellerStatements = pgTable('seller_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  periodType: varchar('period_type', { length: 10 }).notNull(),  // 'MONTHLY' | 'ANNUAL'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),

  // Summary
  openingBalanceCents: integer('opening_balance_cents').notNull(),
  closingBalanceCents: integer('closing_balance_cents').notNull(),

  // Breakdown (denormalized for fast access)
  totals: jsonb('totals').notNull(),
  // {
  //   grossSales: 450000,
  //   refunds: -25000,
  //   netSales: 425000,
  //   tfFees: -42500,
  //   boostFees: -5000,
  //   stripeFees: -13350,
  //   shippingLabelCosts: -8400,
  //   subscriptionCharges: -2999,
  //   insertionFees: -500,
  //   adjustments: -1000,
  //   payoutsSent: -340000,
  //   netChange: 11251
  // }

  // Downloadable files
  pdfFileKey: varchar('pdf_file_key', { length: 500 }),   // Cloudflare R2 key
  csvFileKey: varchar('csv_file_key', { length: 500 }),   // Cloudflare R2 key

  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 9.2 Statement Generation

- **Monthly statements** generated on the 1st of each month for the previous month. BullMQ scheduled job.
- **Annual statements** generated on January 2nd for the previous year.
- Statements are generated for every seller with at least one ledger entry in the period.
- PDF and CSV stored in Cloudflare R2, accessible via signed URLs.
- Seller accesses at `/my/selling/finances/statements`.

### 9.3 Tax Summary

Per Feature Lock-in §9, the seller sees:
- Total sales for period
- Total fees paid
- Net income for tax reporting
- 1099-K threshold tracking: "You've earned $X this year. 1099-K is issued at $600."
- Downloadable tax report (CSV/PDF)

The annual statement serves as the tax-ready document.

---

## 10. STRIPE RECONCILIATION

### 10.1 Why Reconciliation Exists

Stripe is the payment processor. The Twicely ledger is the system of record. These two systems must agree. When they don't, it's a bug or a fraud indicator.

### 10.2 Reconciliation Process

A daily BullMQ job (`finance:reconcile`) runs at a configurable time (default: 4:00 AM UTC):

```
1. Pull all Stripe events from the last 48 hours (overlap ensures no gaps)
2. For each Stripe event:
   a. Look up corresponding ledger entry by stripeEventId
   b. If found: verify amounts match
   c. If not found: flag as UNMATCHED_STRIPE_EVENT
3. For each ledger entry with stripeEventId in the last 48 hours:
   a. Verify the corresponding Stripe event exists
   b. If not found: flag as ORPHANED_LEDGER_ENTRY
4. Compare totals:
   a. Sum of Stripe transfers out = Sum of PAYOUT_SENT entries
   b. Sum of Stripe charges = Sum of ORDER_PAYMENT_CAPTURED entries
   c. Differences flagged as BALANCE_DISCREPANCY
5. Generate reconciliation report
```

### 10.3 Reconciliation Report Schema

```typescript
export const reconciliationReports = pgTable('reconciliation_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  status: varchar('status', { length: 20 }).notNull(),  // 'CLEAN' | 'DISCREPANCIES' | 'FAILED'
  totalStripeEvents: integer('total_stripe_events').notNull(),
  totalLedgerEntries: integer('total_ledger_entries').notNull(),
  matchedCount: integer('matched_count').notNull(),
  unmatchedStripeEvents: integer('unmatched_stripe_events').notNull().default(0),
  orphanedLedgerEntries: integer('orphaned_ledger_entries').notNull().default(0),
  balanceDiscrepancyCents: integer('balance_discrepancy_cents').notNull().default(0),
  details: jsonb('details').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### 10.4 Discrepancy Handling

| Discrepancy Type | Severity | Action |
|-----------------|----------|--------|
| Unmatched Stripe event | HIGH | Auto-create ledger entries if event type is recognized. Alert admin if not. |
| Orphaned ledger entry | CRITICAL | Admin review required. May indicate webhook failure or manual tampering. |
| Balance discrepancy < $1 | LOW | Log and auto-resolve on next reconciliation (rounding). |
| Balance discrepancy ≥ $1 | HIGH | Admin alert. Manual resolution required via hub.twicely.co/fin/reconciliation. |

### 10.5 Admin Reconciliation Console

Route: `hub.twicely.co/fin/reconciliation`

- Daily reconciliation status (green/yellow/red)
- Drill-down into discrepancies
- Manual resolution queue: admin can link Stripe events to ledger entries, create corrective entries
- Historical reconciliation reports
- Stripe balance vs platform liability comparison

---

## 11. ADMIN FINANCE CONSOLE

Route prefix: `hub.twicely.co/fin/*`

### 11.1 Overview (`/fin`)

| Metric | Description |
|--------|-------------|
| Platform Revenue (period) | Sum of TF + boost + insertion + subscription charges |
| Seller Liability | Sum of all seller available + pending balances (what we owe sellers) |
| Stripe Balance | Current Stripe account balance |
| Reconciliation Status | Last reconciliation result |
| Dispute Rate | Chargebacks / orders (last 30 days) |
| Refund Rate | Refunds / orders (last 30 days) |
| GMV | Gross Merchandise Value (total sale prices, pre-fees) |
| Net Revenue | Platform revenue minus refunded fees |

Charts: Revenue over time, fee breakdown by type, GMV trend, liability trend.

### 11.2 Payouts (`/fin/payouts`)

See §8.6 above.

### 11.3 Reconciliation (`/fin/reconciliation`)

See §10.5 above.

### 11.4 Risk (`/fin/risk`)

| Feature | Description |
|---------|-------------|
| Chargeback ratio by seller | Sellers above threshold flagged |
| Refund spike detection | Alert when refund rate exceeds 2× rolling average |
| Reserve management | View/create/release reserves per seller |
| Negative balance sellers | Queue of sellers with negative available balance |
| New seller large payout hold | Auto-hold on first payout above threshold for new sellers |
| Velocity alerts | Unusual transaction patterns (many small orders, rapid listing+sell cycles) |

### 11.5 Adjustments (`/fin/adjustments`)

- Create manual credit/debit with required reason code and memo
- Adjustment history with search/filter
- All adjustments audit logged at HIGH severity
- Requires ADMIN + 2FA

### 11.6 Fee Schedule Management (`/fin/fees`)

- View current active fee schedule
- Create new version with future effective date
- Preview impact: "This change would affect X active sellers, estimated revenue change: ±$Y/month"
- Activation is automatic at `effectiveAt` timestamp
- Requires ADMIN + 2FA. Audit severity: HIGH.

---

## 12. SELLER FINANCE ROUTES

Route prefix: `/my/selling/finances/*`

These routes consume data from the ledger. The UI specs are defined in Feature Lock-in §9. This section defines the data contracts those UIs need.

### 12.1 Overview (`/my/selling/finances`)

| Data Point | Derivation |
|-----------|------------|
| Gross Sales | SUM(ORDER_PAYMENT_CAPTURED) for period |
| Net Sales | Gross Sales + SUM(REFUND_FULL + REFUND_PARTIAL + SELLER_ADJUSTMENT) |
| Total Fees | SUM(ORDER_TF_FEE + ORDER_BOOST_FEE + ORDER_STRIPE_PROCESSING_FEE) |
| Shipping Spend | SUM(SHIPPING_LABEL_PURCHASE + SHIPPING_LABEL_REFUND) |
| Available Balance | sellerBalance.availableCents |
| Pending Balance | sellerBalance.pendingCents |
| Reserved Balance | sellerBalance.reservedCents |
| Next Payout ETA | Next auto-payout date + estimated amount |

### 12.2 Transactions (`/my/selling/finances/transactions`)

Paginated, filterable ledger explorer. Seller sees only their own entries.

Filters: date range, entry type, order ID, channel, min/max amount.
Export: CSV download of filtered results.

### 12.3 Payouts (`/my/selling/finances/payouts`)

See §8.6 seller view.

### 12.4 Statements (`/my/selling/finances/statements`)

Monthly and annual statement downloads. PDF and CSV.

### 12.5 Cross-Platform Revenue (`/my/selling/finances/platforms`)

**Ships when crosslister ships (Phase F).** Before that, this page shows Twicely-only data.

When crosslister is active:
- Revenue by platform (Twicely, eBay, Poshmark, Mercari, etc.)
- Fees by platform (side-by-side comparison)
- Sell-through rate by platform
- Average days to sell by platform
- Best-performing platform per category

Note: Off-platform sales tracked via crosslister sale detection (Lister Canonical §12). No fees charged on off-platform sales — data is informational only.

---

## 13. CASL PERMISSIONS (Finance-Specific)

All finance permissions operate within the existing 6 actor types from Actors Security Canonical.

| Subject | Actor | read | create | update | delete |
|---------|-------|------|--------|--------|--------|
| LedgerEntry | Seller | Own entries | — | — | — |
| LedgerEntry | Platform Agent (SUPPORT) | Any seller | — | — | — |
| LedgerEntry | Platform Admin | All | Manual adj. | — | — |
| SellerBalance | Seller | Own | — | — | — |
| SellerBalance | Platform Agent | Any seller | — | — | — |
| Payout | Seller | Own | Request own | — | — |
| Payout | Platform Agent | Any seller | — | — | — |
| Payout | Platform Admin | All | Create batch | Cancel pending | — |
| PayoutBatch | Platform Admin | All | Trigger | — | — |
| SellerStatement | Seller | Own | — | — | — |
| SellerStatement | Platform Admin | All | Regenerate | — | — |
| FeeSchedule | Platform Admin | All | New version | — | — |
| ReconciliationReport | Platform Admin | All | Trigger | — | — |
| ManualAdjustment | Platform Admin | All | Create (2FA) | — | — |
| Reserve | Platform Admin | All | Hold/Release | — | — |

**Hard rules:**
- No actor can UPDATE or DELETE ledger entries (immutable)
- Seller Staff with `finances.view` scope can read seller's finance data but not request payouts
- Seller Staff with `payouts.manage` scope can request payouts (HIGH risk scope — owner must have 2FA to grant)
- Platform Agent (FINANCE) can view but not modify
- Manual adjustments require ADMIN + 2FA + reason code

---

## 14. REAL-TIME EVENTS (Centrifugo)

| Channel | Event | Trigger |
|---------|-------|---------|
| `private-user.{userId}` | `finance.balance_updated` | Any ledger entry posted for this seller |
| `private-user.{userId}` | `finance.payout_sent` | Payout initiated |
| `private-user.{userId}` | `finance.payout_paid` | Payout confirmed at bank |
| `private-user.{userId}` | `finance.payout_failed` | Payout failed |
| `private-user.{userId}` | `finance.hold_placed` | Reserve hold placed |
| `private-user.{userId}` | `finance.hold_released` | Reserve hold released |
| `private-admin.finance` | `finance.reconciliation_complete` | Daily reconciliation finished |
| `private-admin.finance` | `finance.discrepancy_detected` | Reconciliation found mismatch |
| `private-admin.finance` | `finance.batch_complete` | Payout batch finished |
| `private-admin.finance` | `finance.risk_alert` | Chargeback/refund spike detected |

---

## 15. REBUILD MODE

The finance engine must support complete reconstruction from the ledger.

### 15.1 Rebuild Process

```
1. DROP all materialized views
2. TRUNCATE seller_balances (cache only — no data loss)
3. TRUNCATE seller_statements (regenerated)
4. Replay ALL ledger entries in chronological order:
   For each entry:
     - Apply to seller balance buckets
     - Track pending → posted transitions
5. Regenerate all statements for all periods
6. Run reconciliation against Stripe
7. Compare rebuilt balances against Stripe Connect account balances
8. Report discrepancies
```

### 15.2 When to Rebuild

- After a suspected data corruption event
- After a major migration
- Annual audit compliance
- On-demand by SUPER_ADMIN (2FA required, audit severity: CRITICAL)

### 15.3 Rebuild Safety

- Rebuild runs in a separate database transaction
- Existing balances are preserved until rebuild completes successfully
- If rebuild produces different balances, discrepancies are reported but NOT auto-applied
- Admin reviews discrepancies and approves resolution

---

## 16. ADMIN SETTINGS

All finance settings are admin-configurable via `hub.twicely.co/cfg/commerce` or `/cfg/fees`:

| Setting | Default | Description |
|---------|---------|-------------|
| `finance.releaseHoldDays` | 3 | Days after delivery confirmation before funds release |
| `finance.releaseHoldDaysNoTracking` | 7 | Days after tracking shows delivered (no explicit confirmation) |
| `finance.weeklyPayoutDay` | 5 | Day of week for weekly auto-payout (5=Friday) |
| `finance.weeklyPayoutTime` | `06:00 UTC` | When weekly auto-payout batch runs |
| `finance.dailyPayoutTime` | `06:00 UTC` | When daily auto-payout batch runs |
| `finance.minimumPayoutNoneCents` | 1500 | Minimum payout for Free (NONE) tier ($15) |
| `finance.minimumPayoutStarterCents` | 1000 | Minimum payout for Starter tier ($10) |
| `finance.minimumPayoutProCents` | 100 | Minimum payout for Pro tier ($1) |
| `finance.minimumPayoutPowerCents` | 100 | Minimum payout for Power tier ($1) |
| `finance.minimumPayoutEnterpriseCents` | 0 | Minimum payout for Enterprise tier ($0) |
| `finance.instantPayoutFeeCents` | 250 | Flat fee for instant payout ($2.50) |
| `finance.dailyPayoutFeeCents` | 100 | Fee per daily auto-payout ($1.00, Power tier only) |
| `finance.instantPayoutMaxCents` | 25000 | Maximum instant payout amount ($250) |
| `finance.onDemandPayoutCooldownHours` | 24 | Hours between seller-initiated payout requests |
| `finance.reconciliationTime` | `04:00 UTC` | When daily reconciliation runs |
| `finance.reconciliationLookbackHours` | 48 | How far back reconciliation checks |
| `finance.newSellerPayoutHoldDays` | 7 | Extra hold for sellers with < 5 completed orders |
| `finance.newSellerPayoutHoldThresholdCents` | 50000 | Threshold ($500) above which new seller hold activates |
| `finance.negativeBalanceEscalationDays` | 90 | Days before negative balance escalates to admin |
| `finance.chargebackRateAlertThreshold` | 0.01 | 1% chargeback rate triggers alert |
| `finance.refundSpikeMultiplier` | 2.0 | Refund rate 2× rolling average triggers alert |

---

## 17. PHASED BUILD INTEGRATION

This document's features map to the Build Brief phases:

| Build Phase | Finance Features |
|-------------|-----------------|
| **Phase A (Foundation)** | LedgerEntry table, SellerBalance table, FeeSchedule table in schema |
| **Phase B3 (Cart & Checkout)** | ORDER_PAYMENT_CAPTURED posting, TF calculation, Stripe webhook handling |
| **Phase B4 (Order Management)** | Pending → Posted transition logic |
| **Phase C3 (Stripe Connect)** | Full payout pipeline, PayoutBatch, Payout tables, seller payout dashboard |
| **Phase C4 (Returns & Disputes)** | Refund posting rules, chargeback handling, fault-based fee allocation |
| **Phase D3 (Store Subscriptions)** | Subscription charge ledger entries |
| **Phase D4 (Seller Analytics)** | Seller finance dashboard data layer, statement generation |
| **Phase E3 (Admin Dashboard)** | Admin finance console, reconciliation, risk dashboard |
| **Phase F4 (Lister Subscriptions)** | Lister subscription charges, cross-platform revenue tracking |

No phantom features. Each finance capability ships inside the vertical slice that needs it.

---

## 18. FORBIDDEN PATTERNS

❌ UPDATE or DELETE on ledger_entries (immutable — database trigger enforces)
❌ Floating point for money (integer cents only)
❌ Calculating fees in the frontend (server-side only, from FeeSchedule)
❌ Hardcoding fee rates in code (must use FeeSchedule with effective dates)
❌ Retroactive fee changes on past orders
❌ Paying out pending or reserved funds
❌ Skipping payout eligibility gates
❌ Manual adjustments without reason code
❌ Manual adjustments without 2FA
❌ Subscription charges reducing marketplace seller balance (they're separate Stripe charges)
❌ Insertion fees on imported listings
❌ Per-order fees (killed — Pricing Canonical v3.2)
❌ Fees on off-platform sales (crosslister sales are subscription-funded)
❌ Using `storeId` as ownership key (always `userId` per User Model §5)
❌ Using `SellerTier` or `SubscriptionTier` vocabulary
❌ BI tools writing to the ledger
❌ Trusting client-submitted fee calculations

---

## 19. ACCEPTANCE TESTS

These must all pass before the finance engine is considered complete:

| # | Test | Criteria |
|---|------|----------|
| 1 | Order creates correct ledger entries | Capture → 3-4 entries (payment, TF, boost if applicable, Stripe fee) |
| 2 | TF calculated correctly per progressive brackets | Seller at $1,500 GMV → next order charged at 11.0% marginal rate. Minimum $0.50 enforced. |
| 3 | Full refund reverses all fees | Seller gets TF + boost back, net zero on the order |
| 4 | Seller adjustment keeps platform fees | Partial refund posts, no fee reversal entries |
| 5 | Ledger is immutable | UPDATE/DELETE on ledger_entries raises exception |
| 6 | Balance derivation matches cache | Full replay produces identical sellerBalance values |
| 7 | Payout gates all enforced | Missing any gate blocks payout with specific error |
| 8 | Payout batch processes correctly | N sellers with available balance → N Stripe transfers → N ledger entries |
| 9 | Failed payout returns funds | PAYOUT_FAILED entry credits back to available |
| 10 | Reconciliation detects mismatches | Inject fake Stripe event → flagged as unmatched |
| 11 | Idempotent posting | Same event processed twice → only one set of ledger entries |
| 12 | Negative balance blocks payout | Chargeback exceeds balance → payout blocked, seller notified |
| 13 | Fee schedule versioning works | New schedule with future date → auto-activates at effective time |
| 14 | Reserve hold/release cycle | Hold reduces available, release restores it |
| 15 | Statement generation accurate | Monthly statement totals match sum of ledger entries for period |
| 16 | Insertion fees exempt for imports | 600 imported items → $0 insertion fees |
| 17 | Boost fee refunded on return | Boosted sale returned → boost fee reversed |

---

## 20. FUTURE EXTENSIONS (Not In V3 Scope)

These are acknowledged as future needs but are NOT built in V3:

- Multi-currency support (V3 is USD-only)
- Tax withholding engine (V3 tracks for reporting, doesn't withhold)
- External accounting sync (QuickBooks/Xero export)
- AI-powered fraud anomaly detection
- Dynamic fee experimentation (A/B testing fee rates)
- Automated reserve scoring (ML-based risk assessment)
- Seller COGS import (beyond the optional per-item field in Feature Lock-in §24)

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-15 | Initial V3 lock. Ledger architecture, 26 entry types, posting rules for all financial events, SellerBalance derivation (pending/available/reserved), payout batching with eligibility gates, fee schedule versioning, Stripe reconciliation engine, admin finance console, seller finance routes, CASL permissions, rebuild mode, real-time events, 17 acceptance tests, phase mapping to Build Brief. |
| 1.1 | 2026-02-25 | **v3.2 alignment:** TF calculation rewritten from category-based to progressive volume brackets (8 brackets, 8–11%, marginal). FeeSchedule rules JSON updated. Insertion fees corrected to v3.2 values (NONE $0.35, Starter $0.25, Pro $0.10, Power $0.05). FVF variable names eliminated. All stale tier names (Basic/Elite) removed. |
| 1.2 | 2026-02-26 | **Full payout alignment:** Payout frequency rewritten from single "Daily" to tier-specific matrix (Free: manual only, Starter/Pro: Weekly Fri, Power: Daily M-F $1/payout, Enterprise: Daily free). Payout minimums per-tier ($15/$10/$1/$1/$0). Instant payout $2.50 flat fee. Seller finance routes corrected from `/my/finances/*` to `/my/selling/finances/*` (Financial Center product owns `/my/finances/*`). Admin settings updated with per-tier payout keys matching Pricing Canonical §5.4. |

---

**This document is the single source of truth for Twicely V3 financial system architecture.**
**Vocabulary: StoreTier (storefront subscription), ListerTier (crosslister subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**
