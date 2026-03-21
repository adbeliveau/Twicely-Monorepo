# F4 Decision Rationale Entries — Append to TWICELY_V3_DECISION_RATIONALE.md

---

## 98. Publish Credit Rollover: New Table (Option A)

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** F4-S1

### The Problem

The Lister Canonical and Pricing Canonical specify rollover credits (60-day, FIFO, max 3× monthly) but the schema doc has no tracking mechanism. The `lister_subscription` table has no rollover columns. Three options: (A) new `publish_credit_ledger` table, (B) rollover columns on `lister_subscription`, (C) JSONB credit buckets.

### The Decision

Option A — new `publish_credit_ledger` table. FIFO expiry with multiple concurrent credit buckets (monthly + overage + bonus) requires row-per-bucket modeling. A JSONB column can't do `SELECT ... FOR UPDATE` on individual buckets for concurrent consumption. Columns on `lister_subscription` can't represent multiple expiry windows.

Column uses `userId` (not `sellerId` or `sellerProfileId`) per User Model §5 ownership rule. Nullable `listerSubscriptionId` FK for MONTHLY credits; OVERAGE credits may be purchased without referencing a specific subscription row.

---

## 99. Standardize on `xlister.publishes.*` Platform Settings Keys

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** F4-S1

### The Problem

Duplicate platform settings: `xlister.publishes.FREE/LITE/PRO` (Pricing Canonical §6.4) and `crosslister.publishLimit.free/lite/pro` (seed-crosslister.ts). The publish-meter reads from `crosslister.publishLimit.*`.

### The Decision

Standardize on `xlister.publishes.*` per Pricing Canonical. Deprecate `crosslister.publishLimit.*` keys by marking them `(DEPRECATED)` in seed labels. All new code reads `xlister.publishes.*`. Existing `crosslister.publishLimit.*` rows remain for backward compatibility but are never read by application code after F4-S1.

---

## 100. Overage Pack Webhook: New `checkout-webhooks.ts` Handler

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** F4-S3

### The Problem

Existing webhook infrastructure (`subscription-webhooks.ts`) handles `customer.subscription.*` events only. Overage packs are one-time `checkout.session.completed` events using `mode: 'payment'`.

### The Decision

New `checkout-webhooks.ts` handler for `checkout.session.completed` events where `session.mode === 'payment'`. Routes by `session.metadata.type`: `overage_pack` → add credits, future types (authentication, insertion fee) follow same pattern. Subscription checkout sessions (`mode === 'subscription'`) are handled by the existing subscription webhook handler. Idempotency via ledger entry key `overage:{checkout.session.id}`.

---

## 101. FREE Tier Has No `lister_subscription` Row

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** F4-S2

### The Problem

FREE lister tier is $0 with no Stripe product. On first import auto-activation (NONE → FREE), should a `lister_subscription` row be created? On downgrade from LITE → FREE (Stripe subscription canceled), what happens to the row?

### The Decision

No `lister_subscription` row for FREE tier. FREE is represented solely by `sellerProfile.listerTier = 'FREE'`. On first import: only `sellerProfile` update, no subscription row. On downgrade from LITE/PRO → FREE: Stripe subscription cancels, `lister_subscription.status = 'CANCELED'` (row stays for history), `sellerProfile.listerTier = 'FREE'`. The canceled row is historical — the absence of an ACTIVE/TRIALING `lister_subscription` row combined with `listerTier = 'FREE'` is the canonical state. `isPaidListerTier` returns false for FREE, blocking checkout creation.

---

## 102. FIFO Order: Soonest-to-Expire First

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** F4-S1

### The Problem

The original F4 prompt used inconsistent language: "oldest credits consumed first" vs `ORDER BY expiresAt ASC`. These produce different results when credits are created at different times with different expiry windows (e.g., a 60-day monthly credit vs a period-end overage credit).

### The Decision

FIFO means soonest-to-expire first: `ORDER BY expiresAt ASC`. An overage credit expiring at period end is consumed before a monthly credit with 45 days remaining. This minimizes waste (credits closest to expiry get used first).
