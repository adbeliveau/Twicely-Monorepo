# TWICELY V2 â€” FREEZE 0-44 (FORMAL LOCK)
**Status:** LOCKED (v1.7)  
**Marketplace Version:** V2  
**Scope:** Phases 0-44 + Operational Glue  
**Authority:** Canonicals are law. No deviation permitted.

> Place this file in: `/rules/TWICELY_V2_FREEZE_0_44_LOCKED.md`

---

## 1) What Is Frozen

The following are frozen and MUST NOT change without a version bump:

- Phase order **0-44** (extended from 0-43)
- Operational Glue Canonical (items 1-5)
- Corporate Admin + Seller Hub separation
- Ledger-first money model (platform collects, platform pays)
- Backend-first install discipline
- `/rules` + `/rules/canonicals` layout

**v1.7 Update (2026-01-23):**
- Fixed canonical count: 23 â†’ 24
- Added Seller Scopes & RBAC Mapping canonical to inventory
- Fixed UTF-8 encoding throughout

---

## 2) Phase Inventory (0-44)

### Foundation (Phases 0-10)
| Phase | Name | Purpose |
|-------|------|---------|
| 0 | Bootstrap | DB, env, Prisma, auth |
| 1 | RBAC & Roles | Platform roles, delegated access |
| 2 | Listings & Catalog | Product catalog, categories |
| 3 | Orders & Shipping | Order lifecycle, shipments |
| 4 | Payments & Ledger | Stripe, webhooks, ledger, payouts |
| 5 | Search & Discovery | Elasticsearch/Algolia, filters |
| 6 | Trust & Ratings | Trust scores, reviews |
| 7 | Notifications | Email, push, in-app |
| 8 | Analytics & Metrics | Events, dashboards |
| 9 | Feature Flags | Rollouts, kill switches |
| 10 | System Health | Providers, Doctor, SRE console |

### Operations (Phases 11-20)
| Phase | Name | Purpose |
|-------|------|---------|
| 11 | Data Retention | GDPR, export, purge |
| 12 | Internationalization | i18n, regions |
| 13 | Seller Onboarding | Verification, KYC |
| 14 | Returns & Disputes | Case management |
| 15 | Corp Nav & Settings | Admin UI framework |
| 16 | Buyer Experience | Reviews, wishlist |
| 17 | Search Ranking | ML signals, personalization |
| 18 | Finance Reconciliation | Reports, discrepancies |
| 19 | Audit & Observability | Logs, tracing |
| 20 | **PRODUCTION GATE** | All systems must pass |

### Growth (Phases 21-28)
| Phase | Name | Purpose |
|-------|------|---------|
| 21 | Messaging | Buyer-seller chat |
| 22 | Promotions & Coupons | Discounts, campaigns |
| 23 | Seller Analytics | Performance dashboards |
| 24 | Subscriptions | Tier billing |
| 25 | Promotions Automation | Scheduled campaigns |
| 26 | Trust Insights | Performance alerts |
| 27 | Messaging Enhancements | Keywords, attachments |
| 28 | Disputes Automation | Auto-resolution |

### Advanced (Phases 29-39)
| Phase | Name | Purpose |
|-------|------|---------|
| 29 | Seller Hub Expanded | Vacation, bulk tools |
| 30 | Support Console | Ticket routing |
| 31 | Taxes & Compliance | Tax calculation |
| 32 | Identity Verification | Enhanced KYC |
| 33 | Chargebacks | Dispute evidence |
| 34 | Shipping Labels | Rate shopping, labels |
| 35 | Catalog Normalization | Product matching |
| 36 | Promoted Listings | CPC/CPM ads |
| 37 | Seller Standards | Performance tiers |
| 38 | Buyer Protection | Claims, guarantees |
| 39 | SEO & Public Browse | Sitemap, meta |

### Enhanced (Phases 40-44)
| Phase | Name | Purpose |
|-------|------|---------|
| 40 | International Enhanced | Multi-currency, duties |
| 41 | Variations Complete | Full variant system |
| 42 | Seller Experience Plus | Block lists, bulk ops |
| 43 | Buyer Experience Plus | Price alerts, recommendations |
| 44 | Listing Variations | Variation types and values |

---

## 3) Canonical Inventory Rule

All canonicals MUST be listed in the Marketplace Index.

### Required Canonicals (26 total)

```ts
export const REQUIRED_CANONICALS = [
  "TWICELY_LISTINGS_CATALOG_CANONICAL.md",
  "TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md",
  "TWICELY_ORDERS_FULFILLMENT_CANONICAL.md",
  "TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md",
  "TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md",
  "TWICELY_BUYER_EXPERIENCE_CANONICAL.md",
  "TWICELY_RATINGS_TRUST_CANONICAL.md",
  "TWICELY_TRUST_SAFETY_CANONICAL.md",
  "TWICELY_POLICY_LIBRARY_CANONICAL.md",
  "TWICELY_NOTIFICATIONS_CANONICAL.md",
  "TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md",
  "TWICELY_ANALYTICS_METRICS_CANONICAL.md",
  "TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md",
  "TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md",
  "TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md",
  "TWICELY_INTERNATIONALIZATION_CANONICAL.md",
  "TWICELY_MULTI_CURRENCY_TRANSLATIONS_CANONICAL.md",
  "TWICELY_PRODUCT_VARIATIONS_CANONICAL.md",
  "TWICELY_BUYER_EXPERIENCE_PLUS_CANONICAL.md",
  "TWICELY_BUYER_PROTECTION_CANONICAL.md",
  "TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md",
  "TWICELY_V2_UNIFIED_PLATFORM_SETTINGS_CANONICAL.md",
  "TWICELY_V2_VARIATIONS_CANONICAL.md",
  "TWICELY_SELLER_SCOPES_RBAC_MAPPING_CANONICAL.md",
  "TWICELY_API_VERSIONING_DEVELOPER_PLATFORM_CANONICAL.md",
  "TWICELY_TESTING_REQUIREMENTS_CANONICAL.md",
] as const;
```

### Enforcement Function

```ts
export function assertAllCanonicalsPresent(
  expected: string[],
  discovered: string[]
) {
  const missing = expected.filter(e => !discovered.includes(e));
  if (missing.length) {
    throw new Error(`MISSING_CANONICALS:${missing.join(",")}`);
  }
}
```

Installers MUST STOP if any canonical is missing.

---

## 4) Version Lock

```ts
export const V2_FREEZE = {
  marketplace: "v2",
  phases: { min: 0, max: 44 },
  glue: true,
  canonicals: 26,  // Updated from 24
  lockedAt: "2026-01-24T00:00:00Z",
  version: "1.10",
  tiers: ["SELLER", "STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"],
  sellerTypes: ["PERSONAL", "BUSINESS"],
  businessTypes: ["SOLE_PROPRIETOR", "LLC", "CORPORATION", "PARTNERSHIP", "NONPROFIT", "OTHER"],
  taxIdTypes: ["SSN", "EIN", "ITIN"],
};
```

---

## 5) Locked Models

### User Model
- Defined in Phase 1
- Single identity for all users (buyers + sellers)
- Seller capability activated via `isSeller` flag
- Seller type tracked via `sellerType` (PERSONAL or BUSINESS)

### SellerType Enum (Personal vs Business)
```prisma
enum SellerType {
  PERSONAL    // Individual seller - SELLER tier only, cannot subscribe to store
  BUSINESS    // Registered business - can use any tier (SELLER through ENTERPRISE)
}
```
- **PERSONAL** = individual seller, limited to casual selling (SELLER tier)
- **BUSINESS** = verified business, can subscribe to store (STARTER+)
- Business upgrade is FREE (requires name, type, address)
- Store subscription requires BUSINESS seller type

### BusinessType Enum (Alignment Patch)
```prisma
enum BusinessType {
  SOLE_PROPRIETOR
  LLC
  CORPORATION
  PARTNERSHIP
  NONPROFIT
  OTHER
}
```

### TaxIdType Enum (Alignment Patch)
```prisma
enum TaxIdType {
  SSN           // Social Security Number (individuals)
  EIN           // Employer Identification Number (businesses)
  ITIN          // Individual Taxpayer Identification Number
}
```

### BusinessInfo Model (Alignment Patch)
- Defined in Phase 1
- One BusinessInfo per User (optional)
- Required for store subscription (STARTER+)
- Stores: legalName, businessType, taxId, taxIdType, address, verifiedAt

### SellerTier Enum (eBay-Exact + Casual Seller)
```prisma
enum SellerTier {
  SELLER      // $0/mo     - 250 free, $0.35 insertion fee (casual seller)
  STARTER     // $4.95/mo  - 250 listings, $0.30 insertion fee
  BASIC       // $21.95/mo - 1,000 listings, $0.25 insertion fee
  PRO         // $59.95/mo - 10,000 listings, $0.15 insertion fee
  ELITE       // $299.95/mo - 25,000 listings, $0.05 insertion fee
  ENTERPRISE  // $2,999.95/mo - 100,000 listings, $0.05 insertion fee
}
```
- **SELLER tier** = casual seller (no subscription, pays insertion fees over 250)
- STORE tiers (STARTER+) match eBay store tiers exactly
- Insertion fees apply when exceeding free monthly allowance

### SellerStorefront Model
- Defined in Phase 24
- STORE tiers (STARTER+) get storefront
- SELLER tier (casual sellers) have no storefront
- Features vary by tier

---

## 6) Non-Negotiables

- No Studio
- No Crosslisting
- No AI modules
- No direct DB writes outside Prisma
- No side effects without idempotency
- **SELLER tier is casual seller (free), not a store subscription**
- **PERSONAL sellers cannot subscribe to store (STARTER+)**
- **Business upgrade is FREE but required before store subscription**

---

## 7) Minimal Operations Runbook

### Emergency Actions

```ts
process.env.PLATFORM_DISABLED = "true"; // pause checkout & payouts
```

### Recovery Checklist
- Re-run Doctor
- Re-run reconciliation
- Rebuild search index
- Verify ledger parity

---

## 8) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial freeze (phases 0-39, canonicals 1-16) |
| 1.1 | 2026-01-19 | Extended to phases 40-43, added canonicals 17-20 |
| 1.2 | 2026-01-21 | Added eBay-exact tier enum, locked User/Storefront models |
| 1.3 | 2026-01-21 | Casual Seller Patch: Added SELLER tier, insertion fees, per-order fees |
| 1.4 | 2026-01-21 | Personal/Business Seller Patch: Added SellerType enum, business gate for store |
| 1.5 | 2026-01-21 | Alignment Patch: Added BusinessInfo model, BusinessType enum, TaxIdType enum |
| 1.6 | 2026-01-22 | Extended to Phase 44 (Listing Variations), updated canonical count to 23 |
| 1.7 | 2026-01-23 | **Canonical Count Fix**: 23 â†’ 24, added Seller Scopes RBAC canonical, fixed UTF-8 |
| 1.8 | 2026-01-23 | **BusinessType Enum Alignment**: added NONPROFIT, OTHER to match schema.prisma |
| 1.9 | 2026-01-23 | Added API Versioning and Testing Requirements canonicals (24 â†’ 26) |

---

# END FREEZE
| 1.10 | 2026-01-24 | **AI Install Audit Fix**: Added explicit canonical list, LedgerEntryType enum to schema, unified scopes terminology, added SRE role, standardized canceled spelling |
