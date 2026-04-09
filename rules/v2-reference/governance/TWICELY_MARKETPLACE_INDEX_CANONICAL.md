# TWICELY_MARKETPLACE_INDEX_CANONICAL.md
**Status:** LOCKED (v1.6)  
**Scope:** System index tying all marketplace canonicals into a single authoritative hierarchy.  
**Audience:** All engineers, product owners, operators, AI agents, and auditors.

---

## 1. Purpose (Read This First)

This document is the **single entry point** for understanding how Twicely works as a marketplace.

It defines:
- the canonical hierarchy
- dependency order
- system invariants
- change impact rules

If a behavior is not traceable through this index to a canonical, it **must not be implemented**.

---

## 2. Canonical Reading Order (Mandatory)

All contributors MUST read canonicals in the following order:

1. **Kernel & Platform Foundations**
   - Kernel + Module Enforcement
   - RBAC & Delegated Access
   - Seller Scopes & RBAC Mapping
   - Audit & Idempotency
   - Platform Health / SRE
   - Feature Flags / Rollouts

2. **Commerce Core**
   - Listings & Catalog
   - Product Variations
   - Search, Browse & Discovery
   - Orders & Fulfillment
   - Shipping & Returns Logistics
   - Returns / Refunds / Disputes

3. **Money & Control**
   - Monetization & Fees
   - Ledger & Reconciliation
   - Payouts & Holds
   - Seller Onboarding & Verification

4. **Experience & Safety**
   - Buyer Experience
   - Buyer Experience Plus
   - Buyer Protection
   - Seller Experience Plus
   - Ratings & Trust (feeds Search + enforcement)
   - Trust & Safety
   - Policy Library
   - Notifications

5. **Intelligence & Governance**
   - Analytics & Metrics
   - Data Retention & Privacy
   - Internationalization
   - Multi-Currency & Translations
   - Unified Platform Settings

6. **Platform Operations**
   - API Versioning & Developer Platform
   - Testing Requirements

No canonical may override a higher-layer canonical.

---

## 3. Canonical Inventory

| # | Canonical | File |
|---|-----------|------|
| 1 | Listings & Catalog | `TWICELY_LISTINGS_CATALOG_CANONICAL.md` |
| 2 | Search, Browse & Discovery | `TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md` |
| 3 | Orders & Fulfillment | `TWICELY_ORDERS_FULFILLMENT_CANONICAL.md` |
| 4 | Shipping & Returns Logistics | `TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md` |
| 5 | Returns / Refunds / Disputes | `TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md` |
| 6 | Buyer Experience | `TWICELY_BUYER_EXPERIENCE_CANONICAL.md` |
| 7 | Ratings & Trust | `TWICELY_RATINGS_TRUST_CANONICAL.md` |
| 8 | Trust & Safety | `TWICELY_TRUST_SAFETY_CANONICAL.md` |
| 9 | Policy Library | `TWICELY_POLICY_LIBRARY_CANONICAL.md` |
| 10 | Notifications | `TWICELY_NOTIFICATIONS_CANONICAL.md` |
| 11 | Monetization + Ledger + Payouts | `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md` |
| 12 | Analytics & Metrics | `TWICELY_ANALYTICS_METRICS_CANONICAL.md` |
| 13 | Feature Flags / Rollouts | `TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md` |
| 14 | Seller Onboarding & Verification | `TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md` |
| 15 | Data Retention & Privacy | `TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md` |
| 16 | Internationalization | `TWICELY_INTERNATIONALIZATION_CANONICAL.md` |
| 17 | Multi-Currency & Translations | `TWICELY_MULTI_CURRENCY_TRANSLATIONS_CANONICAL.md` |
| 18 | Product Variations | `TWICELY_PRODUCT_VARIATIONS_CANONICAL.md` |
| 19 | Buyer Experience Plus | `TWICELY_BUYER_EXPERIENCE_PLUS_CANONICAL.md` |
| 20 | Buyer Protection | `TWICELY_BUYER_PROTECTION_CANONICAL.md` |
| 21 | Seller Experience Plus | `TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md` |
| 22 | Unified Platform Settings | `TWICELY_V2_UNIFIED_PLATFORM_SETTINGS_CANONICAL.md` |
| 23 | Variations System | `TWICELY_V2_VARIATIONS_CANONICAL.md` |
| 24 | Seller Scopes & RBAC Mapping | `TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md` |
| 25 | API Versioning & Developer Platform | `TWICELY_API_VERSIONING_DEVELOPER_PLATFORM_CANONICAL.md` |
| 26 | Testing Requirements | `TWICELY_TESTING_REQUIREMENTS_CANONICAL.md` |

---

## 4. Dependency Graph (Authoritative)

```
Listings & Catalog
   ↓
Product Variations
   ↓
Search & Discovery  ← (Ratings & Trust hooks here)
   ↓
Orders & Fulfillment
   ↓
Shipping & Logistics
   ↓
Returns / Disputes
   ↓
Ledger & Payouts
   ↓
Seller Verification (payout gates)
   ↓
Buyer Experience + Buyer Protection
   ↓
Ratings & Trust
   ↓
Trust & Safety + Policy Library
   ↓
Notifications
   ↓
Analytics / Platform Health
```

### Dependency Rules
- Listings cannot depend on Orders
- Search cannot override Listing eligibility
- Search must apply Trust gating + multiplier through Ratings & Trust canonical
- Orders cannot bypass Ledger
- Payouts cannot ignore Disputes or Holds
- Trust & Safety can override visibility, not accounting
- Notifications observe events; they never drive state
- Analytics must reconcile to Orders + Ledger

---

## 5. System Invariants (Non-Negotiable)

1. **Single-owner model**
   - Every listing, order, and payout has exactly one owner user

2. **State machines are authoritative**
   - No state mutation outside defined transitions

3. **Ledger is the source of financial truth**
   - No derived balances without ledger reconciliation

4. **Eligibility before ranking**
   - Discovery never sees invalid inventory

5. **Audit before authority**
   - Every override requires an audit event

6. **Effective-dated configuration**
   - Fee, trust, and policy changes never rewrite history

---

## 6. Change Impact Rules

Any proposed change MUST declare impact on:

| Change Area | Required Review |
|-------------|-----------------|
| Listing fields | Listings + Search |
| Ranking logic | Search + Ratings & Trust + Trust |
| Trust thresholds/decay | Ratings & Trust + Search |
| Order states | Orders + Ledger |
| Shipping SLAs | Orders + Shipping + Trust |
| Refund logic | Returns + Ledger |
| Fees | Monetization + Payouts |
| Notifications | Notifications + Platform Health |
| Analytics KPIs | Analytics + Ledger + Orders |

If impact is unclear, the change is rejected.

---

## 7. AI & Automation Rules

AI systems:
- may suggest
- may assist
- may not override canonicals

AI-generated code MUST:
- cite the canonical it implements
- fail if canonical constraints are violated

---

## 8. Versioning Rules

- Canonicals are versioned
- Changes require:
  - new version
  - migration plan
  - backward compatibility note
- Old versions remain readable

---

## 9. Enforcement

Violations of this index result in:
- rejected PRs
- disabled features
- rolled-back releases

This index supersedes:
- individual preferences
- undocumented practices
- "temporary" shortcuts

---

## 10. Subscription Tiers

Twicely supports 6 subscription tiers (eBay-exact):

| Tier | Monthly | Listings | FVF |
|------|---------|----------|-----|
| SELLER | $0 | 250 | 13.25% |
| STARTER | $4.95 | 250 | 12.35% |
| BASIC | $21.95 | 1,000 | 11.5% |
| PRO | $59.95 | 10,000 | 10.25% |
| ELITE | $299.95 | 25,000 | 9.15% |
| ENTERPRISE | $2,999.95 | 100,000 | Custom |

**Key Points:**
- SELLER tier for casual sellers (no store subscription)
- STARTER+ tiers include store subscription
- All store tiers get a branded storefront

---

## 11. Market Price Index

### Purpose

The Market Price Index provides fair market pricing data for categories and products, enabling:
- Deal badge computation (identifying true bargains)
- BELOW_MARKET price alerts
- Seller pricing guidance
- Platform pricing analytics

### Index Scope Types

| Scope | Description | Refresh |
|-------|-------------|---------|
| Category | Prices for all items in a category | Daily (top 100), Weekly (others) |
| Product | Prices for a specific catalog product | Daily (high volume), Weekly (low) |
| Attribute Hash | Brand + Condition + Category combo | On-demand, 7-day cache |

### Index Data Points

| Field | Description |
|-------|-------------|
| medianPriceCents | 50th percentile |
| averagePriceCents | Mean price |
| minPriceCents | Lowest sale |
| maxPriceCents | Highest sale |
| p10PriceCents | 10th percentile (great deal threshold) |
| p25PriceCents | 25th percentile (good deal threshold) |
| p75PriceCents | 75th percentile |
| p90PriceCents | 90th percentile |
| sampleSize | Number of sales in calculation |
| confidence | HIGH (≥50), MEDIUM (≥20), LOW (<20) |

### Computation Rules

1. Based on **sold listings** in last 90 days
2. Minimum 10 sales for any index
3. Outliers removed (>3 standard deviations)
4. Recomputed on schedule (not real-time)
5. Cached until validUntil date

### Integration Points

| System | Integration |
|--------|-------------|
| Listings | Market index lookup for deal badges |
| Price Alerts | BELOW_MARKET alert triggering |
| Search | Filter by "deals only" |
| Seller Tools | Suggested pricing guidance |

---

## 12. Final Rule (Read Twice)

**Twicely is a system, not a feature set.**

If something cannot be explained by pointing to:
1. this index, and
2. the referenced canonical,

it does not belong in production.

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial index |
| 1.1 | 2026-01-15 | Added dependency graph |
| 1.2 | 2026-01-21 | Added eBay-exact subscription tiers |
| 1.3 | 2026-01-22 | Added Market Price Index section for Phase 43 |
| 1.4 | 2026-01-22 | Added canonicals 17-23, fixed duplicate section numbers, fixed UTF-8 encoding |
| 1.5 | 2026-01-23 | **Canonical Count Fix**: Added #24 Seller Scopes & RBAC Mapping, fixed UTF-8 |
| 1.6 | 2026-01-23 | Added API Versioning (#25) and Testing Requirements (#26) canonicals |
