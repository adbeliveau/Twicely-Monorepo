# TWICELY_ANALYTICS_METRICS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Marketplace metrics, event taxonomy, KPIs, dashboards, and data integrity rules.  
**Audience:** Product, growth, finance, ops, engineering, and AI agents.  
**Non-Goal:** BI vendor choice or specific dashboard tooling.

---

## 1. Purpose

This canonical defines:
- what we measure
- how we measure it
- how metrics are computed consistently

If a metric is not defined here, it must not be used for decisions.

---

## 2. Core Principles

1. **Single source of truth** for each metric
2. **Event-first analytics** (facts before aggregates)
3. **Idempotent ingestion**
4. **Privacy-respecting defaults**
5. **Metrics must reconcile** with commerce + ledger

---

## 3. Event Taxonomy (Canonical)

All events share these fields:

```ts
type AnalyticsEvent = {
  id: string;              // unique
  name: string;            // "listing.view"
  occurredAt: string;      // ISO
  actorUserId?: string;    // buyer/seller/staff
  sessionId?: string;
  anonymousId?: string;    // guest tracking
  entityType?: string;     // "listing" | "order" | ...
  entityId?: string;
  properties: Record<string, any>;
};
```

### 3.1 Required Core Events

**Discovery**
- `search.query`
- `search.result_impression`
- `listing.view`
- `listing.save`

**Conversion**
- `cart.add` (future if cart exists)
- `checkout.start`
- `checkout.complete`
- `payment.succeeded`
- `order.created`
- `order.paid`
- `order.shipped`
- `order.delivered`
- `order.completed`

**Post-purchase**
- `return.opened`
- `refund.issued`
- `dispute.opened`
- `review.submitted`

**Seller**
- `listing.created`
- `listing.activated`
- `listing.ended`
- `payout.sent`

**Platform**
- `webhook.received`
- `job.failed`
- `health.provider_run`

---

## 4. KPI Definitions (Authoritative)

### 4.1 Marketplace Health KPIs

- **GMV**: sum of order item subtotal + shipping (exclude tax), for PAID orders in period
- **Net Revenue**: sum of marketplace fees + promo fees + other platform fees in period
- **Orders**: count of orders reaching PAID in period
- **Active Listings**: count of ACTIVE listings at snapshot time
- **Sell-through Rate**: SOLD / (ACTIVE + SOLD) over period
- **AOV**: GMV / Orders
- **Refund Rate**: refunded orders / paid orders
- **Dispute Rate**: disputes opened / paid orders

### 4.2 Seller KPIs

- **Seller Revenue (Net)**: sum of SALE_CREDIT + fees + refunds (ledger)
- **Payout Success Rate**: successful payouts / payouts attempted
- **Time to Ship**: avg(PAID → SHIPPED)
- **Late Shipment Rate**: shipped after handling SLA

### 4.3 Discovery KPIs

- **Search CTR**: listing views / search result impressions
- **Conversion Rate**: checkout.complete / listing.view
- **Zero Result Rate**: searches with 0 results / total searches

---

## 5. Reconciliation Rules (Required)

Analytics must reconcile against:
- Orders table (counts and statuses)
- Ledger entries (fees and payouts)
- Refund records

If reconciliation fails beyond tolerance, dashboards must flag **DATA_DRIFT**.

---

## 6. Aggregation & Snapshots

### 6.1 Daily Snapshots
Compute:
- GMV daily
- Net revenue daily
- Orders daily
- Active listings daily
- Refund/dispute rates daily

### 6.2 Cohorts (v1)
- buyer cohort by first purchase month
- seller cohort by first sale month

---

## 7. Privacy & Data Policy

- No raw card/payment details
- Mask PII in analytics events by default
- Staff-only access for sensitive dashboards (finance)

---

## 8. RBAC

| Action | Permission |
|---|---|
| View marketplace KPIs | analytics.read |
| View finance KPIs | analytics.finance.read |
| Export raw events | analytics.export |
| Edit KPI definitions | admin only |

---

## 9. Final Rule

Metrics exist to **make decisions safely**.
If metrics do not reconcile to ledger + orders, they cannot be trusted.
