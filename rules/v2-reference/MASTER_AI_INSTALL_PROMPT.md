# TWICELY V2 — Master AI Install Prompt
**Version:** v2.1  
**Last Updated:** January 2026  
**Status:** LOCKED (Phases 0-44)

---

## OVERVIEW

This document guides AI agents through installing the complete Twicely V2 marketplace platform. Twicely is a peer-to-peer resale marketplace (similar to eBay, Poshmark, Depop, Mercari).

**Tech Stack:**
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Prisma ORM, PostgreSQL
- Payments: Stripe Connect (Express accounts)
- Auth: NextAuth.js

**Three User Interfaces:**
1. **Buyer Experience** — Public browse, search, checkout, order tracking
2. **Seller Hub** — Listings, orders, payouts, analytics (`/seller/*`)
3. **Corp Admin** — Platform operations, trust & safety, finance (`/corp/*`)

---

## FILE LOCATIONS

All specifications live in `/rules/` with this structure:

```
/rules/
├── canonicals/          # Domain specs (what it does)
├── locked/              # Immutable behaviors (cannot change)
├── governance/          # Meta-governance, freezes
├── architecture/        # High-level structure
├── health/              # Observability specs
├── modules/             # Module system
├── rbac/                # Access control
└── install-phases/      # Build instructions (0-44)
```

**Quick Reference:**
| Need... | Look in... |
|---------|------------|
| Domain rules | `/rules/canonicals/` |
| Immutable contracts | `/rules/locked/` |
| Build instructions | `/rules/install-phases/` |
| System governance | `/rules/governance/` |

---

## INSTALLATION PRINCIPLES

### 1. Backend-First Flow
Every phase follows: **Schema → Service → API → Health → UI → Doctor**

### 2. Phase Order Matters
Phases must be installed sequentially (0 → 44). Dependencies exist.

### 3. Doctor Checks Required
Every phase includes Doctor checks that verify correct installation.

### 4. Health Providers Required
Every domain needs a health provider with PASS/WARN/FAIL status.

### 5. Idempotency Required
All operations must be idempotent (safe to retry).

### 6. Audit Trails Required
All sensitive operations must emit audit events.

---

## PHASE REFERENCE (0-44)

### Phase 0: Bootstrap
**Backend:**
- Next.js 14 app structure
- Prisma setup with PostgreSQL
- Environment configuration
- Base layout components

**Doctor Checks:**
- Database connects
- Prisma client works
- Environment vars present

**UI:**
- `/` → Landing page shell

---

### Phase 1: RBAC & Roles
**Backend:**
- User, Role, Permission models
- Session management
- Role hierarchy (SUPER_ADMIN > CORP_ADMIN > CORP_SUPPORT > SELLER > BUYER)
- `requireRole()` middleware

**Doctor Checks:**
- Roles seeded correctly
- Permission checks work
- Session resolves user

**UI:**
- `/corp/users` → User management
- `/corp/roles` → Role management

**Canonical:** `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`

---

### Phase 2: Listings & Catalog
**Backend:**
- Listing, Category, ListingImage models
- Listing state machine (DRAFT → ACTIVE → SOLD → ENDED)
- Category tree with attributes
- Image upload handling

**Doctor Checks:**
- Listing CRUD works
- State transitions enforce rules
- Categories seeded

**UI:**
- `/seller/listings` → Seller's listings
- `/seller/listings/new` → Create listing
- `/corp/catalog/categories` → Category management

**Canonical:** `TWICELY_LISTINGS_CATALOG_CANONICAL.md`

---

### Phase 3: Orders, Shipping, and Bundle Builder
**Backend:**
- Cart with items, reservations, and applied bundles
- Seller bundles (SPECIFIC_ITEMS, CATEGORY, ANY_ITEMS types)
- Smart cart prompts (free shipping threshold, bundle suggestions)
- "Make Me a Deal" buyer-initiated negotiation
- Bundle request workflow with counter-offers
- Order creation with bundle discounts
- Multi-seller checkout with per-seller bundles
- Combined shipping calculation
- Cancellation system with bundle considerations
- **New Models:** SellerBundle, CartBundle, CartPrompt, BundleRequest, BundleSettings

**Doctor Checks:**
- Order creation works
- State transitions enforce rules
- Shipping rates return
- Bundle create/apply works
- Bundle request workflow complete

**UI:**
- `/seller/orders` → Seller's orders
- `/seller/bundles` → Bundle management
- `/corp/orders` → All orders
- `/corp/settings/bundles` → Bundle settings admin

**Canonical:** `TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`

---

### Phase 4: Payments, Webhooks, Ledger & Payouts
**Backend:**
- Payment, PaymentIntent, Payout, LedgerEntry models
- Stripe Connect integration (Express accounts)
- Webhook handler with idempotency
- Ledger entry creation (immutable)
- Payout execution with gates

**Doctor Checks:**
- Payment intent creates
- Webhook idempotency works
- Ledger entries immutable
- Payout gates enforce

**UI:**
- `/corp/finance/payments` → Payment list
- `/corp/finance/payouts` → Payout queue
- `/corp/finance/ledger` → Ledger explorer
- `/seller/payouts` → Seller payout history

**Canonicals:** 
- `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`
- `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`
- `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

---

### Phase 5: Search & Discovery
**Backend:**
- SearchIndex model with eligibility flag
- Eligibility computer (active listing + active seller + not flagged)
- Trust multiplier integration for ranking
- Full-text search with filters

**Doctor Checks:**
- Index builds correctly
- Eligibility gates work
- Search returns ranked results
- Trust multiplier applied

**UI:**
- `/search` → Search results page
- `/browse/[category]` → Category browse
- `/corp/search/index` → Index health

**Canonical:** `TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`

---

### Phase 6: Trust, Policy & Ratings
**Backend:**
- TrustScore, Rating, Review models
- Trust score computation with decay
- Trust bands (A/B/C/D) with multipliers
- Policy versioning and enforcement
- TrustEvent idempotency

**Doctor Checks:**
- Trust score computes
- Decay applies correctly
- Bands map to multipliers
- Policy effective dates work

**UI:**
- `/corp/trust/scores` → Trust score dashboard
- `/corp/trust/policy` → Policy management
- `/seller/performance` → Seller trust view

**Canonical:** `TWICELY_RATINGS_TRUST_CANONICAL.md`

---

### Phase 7: Notifications Pipeline
**Backend:**
- NotificationTemplate, NotificationPreference, NotificationLog models
- Template rendering with variables
- Channel routing (email, push, in-app)
- Delivery worker with retry
- Preference checking

**Doctor Checks:**
- Template renders correctly
- Preferences respected
- Delivery logged
- Retry works

**UI:**
- `/corp/notifications/templates` → Template management
- `/settings/notifications` → User preferences

**Canonical:** `TWICELY_NOTIFICATIONS_CANONICAL.md`

---

### Phase 8: Analytics & Metrics
**Backend:**
- AnalyticsEvent, MetricDefinition, MetricSnapshot models
- Event emission with idempotency (eventKey unique)
- Daily snapshot computation
- Core metrics: GMV, orders, AOV, new users, active listings

**Doctor Checks:**
- Event emit idempotent
- Snapshots compute
- Metrics seeded
- No duplicate events

**UI:**
- `/corp/analytics` → Platform dashboard
- `/seller/analytics` → Seller dashboard

**Canonical:** `TWICELY_ANALYTICS_METRICS_CANONICAL.md`

---

### Phase 9: Feature Flags & Rollouts
**Backend:**
- FeatureFlag, FeatureFlagOverride, FeatureFlagAudit models
- Evaluation precedence: Override → Deny → Allow → Time → Tier → Percentage → Global
- Kill switches (6 canonical: checkout, payouts, listing_activation, search, payments, user_registration)
- Percentage rollout with deterministic bucketing (SHA-256)

**Doctor Checks:**
- Kill switches exist
- Precedence correct
- Percentage stable for same seed
- Time windows work

**UI:**
- `/corp/platform/flags` → Flag management

**Canonical:** `TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md`

---

### Phase 10: System Health, SRE, Modules & Doctor UI
**Backend:**
- HealthProvider interface (id, label, run())
- Health registry with all providers
- Doctor script runner
- Module installation system

**Doctor Checks:**
- All providers registered
- Health endpoint returns
- Doctor script runs
- Module guards work

**UI:**
- `/corp/system/health` → Health dashboard
- `/corp/system/doctor` → Doctor results
- `/corp/system/modules` → Module management

**Canonical:** `TWICELY_SRE_PLATFORM_HEALTH_CONSOLE_LOCKED.md`

---

### Phase 11: Data Retention & Privacy
**Backend:**
- RetentionPolicy (versioned, effective-dated)
- RetentionJobRun for tracking
- DataExportRequest workflow
- User anonymization (preserves orders/ledger/audit)
- Protected tables: Order, LedgerEntry, AuditEvent, Payment, Payout (7-year retention)

**Doctor Checks:**
- Policy active
- Export workflow works
- Anonymization preserves orders
- Protected tables not purged

**UI:**
- `/corp/privacy/exports` → Export queue
- `/corp/privacy/retention` → Policy management

**Canonical:** `TWICELY_DATA_RETENTION_PRIVACY_CANONICAL.md`

---

### Phase 12: Internationalization
**Backend:**
- Region, SupportedCurrency, SupportedLocale models
- Money helpers (formatMoney, parseToCents, assertSameCurrency)
- Time helpers (UTC storage, locale display)
- Locale detection from headers
- Currency enforcement (no mixed currency)

**Doctor Checks:**
- US region active
- USD currency configured
- Money formatting works
- Mixed currency throws

**UI:**
- `/corp/settings/regions` → Region management

**Canonical:** `TWICELY_INTERNATIONALIZATION_CANONICAL.md`

---

### Phase 13: Seller Onboarding & Verification
**Backend:**
- SellerProfile, SellerVerification, PayoutDestination models
- Onboarding steps (STARTED → BUSINESS_INFO → TAX_INFO → IDENTITY → PAYOUT → COMPLETED)
- Verification workflow (submit → review → approve/reject)
- Payout gates: destination must be verified

**Doctor Checks:**
- Profile creation works
- Verification workflow works
- Destination saved unverified
- Payout blocked until verified
- Payout passes after verification

**UI:**
- `/seller/onboarding` → Onboarding wizard
- `/seller/settings/payouts` → Payout setup
- `/corp/sellers/verification` → Verification queue

**Canonical:** `TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md`

---

### Phase 14: Returns, Disputes & Case Management
**Backend:**
- ReturnRequest, DisputeCase, CaseNote models
- Return workflow (requested → approved/denied → shipped → received → refunded)
- Dispute escalation
- Case assignment

**Doctor Checks:**
- Return creation works
- Dispute escalation works
- Case assignment tracks

**UI:**
- `/corp/cases` → Case queue
- `/corp/cases/[id]` → Case detail
- Buyer return request flow

**Canonical:** `TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md`

---

### Phase 15: Corp Navigation, Menus & Settings Registry
**Backend:**
- NavItem, SettingsSection models
- Menu registry by role
- Settings organization

**Doctor Checks:**
- Nav items render by role
- Settings sections load

**UI:**
- Corp sidebar navigation
- `/corp/settings` → Settings hub

---

### Phase 16: Buyer Experience & Reviews
**Backend:**
- Review, ReviewVote models
- Review submission after order complete
- Review moderation
- Helpful voting

**Doctor Checks:**
- Review submission works
- Moderation workflow works
- Votes record

**UI:**
- Product detail with reviews
- Review submission form
- `/corp/reviews` → Review moderation

**Canonical:** `TWICELY_BUYER_EXPERIENCE_CANONICAL.md`

---

### Phase 17: Search Ranking Pipeline
**Backend:**
- RankingSignal, RankingModel models
- Signal computation (trust, recency, engagement, conversion)
- Model weighting
- A/B testing hooks

**Doctor Checks:**
- Signals compute
- Model applies weights
- Results rank correctly

**UI:**
- `/corp/search/ranking` → Ranking configuration

---

### Phase 18: Finance Reconciliation & Reporting
**Backend:**
- ReconciliationRun, ReconciliationDiscrepancy models
- Stripe → Ledger reconciliation
- Discrepancy flagging
- Financial reports

**Doctor Checks:**
- Reconciliation runs
- Discrepancies detected
- Reports generate

**UI:**
- `/corp/finance/reconciliation` → Recon dashboard
- `/corp/finance/reports` → Financial reports

---

### Phase 19: Audit Logs & Observability
**Backend:**
- AuditEvent model (immutable)
- Event types catalog
- Log aggregation
- Trace correlation

**Doctor Checks:**
- Audit events log
- Events immutable
- Search works

**UI:**
- `/corp/system/audit` → Audit log viewer

---

### Phase 20: Production Readiness Checklist
**Backend:**
- Readiness check endpoints
- Dependency health verification
- Configuration validation

**Doctor Checks:**
- All systems pass health
- Environment configured
- Secrets present

**UI:**
- `/corp/system/readiness` → Readiness dashboard

---

### Phase 21: Messaging & Notifications
**Backend:**
- Conversation, Message models
- Real-time messaging
- Message notifications
- Attachment handling

**Doctor Checks:**
- Conversation creates
- Messages deliver
- Notifications send

**UI:**
- `/messages` → Message inbox
- `/messages/[id]` → Conversation view

---

### Phase 22: Promotions & Coupons
**Backend:**
- Promotion, Coupon, CouponRedemption models
- Discount calculation
- Usage limits
- Validity periods

**Doctor Checks:**
- Coupon creation works
- Redemption applies discount
- Usage limits enforce

**UI:**
- `/corp/promotions` → Promotion management
- Checkout coupon entry

---

### Phase 23: Seller Analytics
**Backend:**
- SellerMetric, SellerReport models
- Seller-specific metrics
- Performance reports
- Trend analysis

**Doctor Checks:**
- Metrics compute for seller
- Reports generate
- Trends calculate

**UI:**
- `/seller/analytics` → Seller analytics dashboard
- `/seller/reports` → Downloadable reports

---

### Phase 24: Subscriptions & Billing Tiers
**Backend:**
- SellerTier enum (SELLER|STARTER|BASIC|PRO|ELITE|ENTERPRISE) — eBay-exact 6 tiers
- SellerSubscription model with tier, billing, status
- SellerStorefront model (STORE tiers only — STARTER+)
- Tier feature matrix and listing caps
- Billing integration via Stripe
- Upgrade/downgrade with prorated billing
- **SELLER tier** = casual seller ($0/mo, no store subscription, no storefront)
- **STORE tiers** (STARTER+) = paid subscription with storefront

**Doctor Checks:**
- Plan creation works
- Subscription activates
- Benefits apply per tier
- Listing caps enforced
- SELLER tier has no storefront
- Personal sellers cannot subscribe to STORE tiers

**UI:**
- `/seller/subscription` → Subscription management
- `/corp/subscriptions` → Plan management

**Canonical:** `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`

---

### Phase 25: Promotions Automation
**Backend:**
- PromotionRule, AutomatedPromotion models
- Rule engine
- Scheduling
- Performance tracking

**Doctor Checks:**
- Rules trigger correctly
- Scheduling works
- Performance tracks

**UI:**
- `/corp/promotions/automation` → Automation rules

---

### Phase 26: Trust & Performance Insights
**Backend:**
- TrustInsight, PerformanceAlert models
- Insight generation
- Alert triggers
- Recommendations

**Doctor Checks:**
- Insights generate
- Alerts trigger
- Recommendations show

**UI:**
- `/seller/insights` → Seller insights
- `/corp/trust/insights` → Platform insights

---

### Phase 27: Messaging Enhancements
**Backend:**
- MessageTemplate, QuickReply models
- Saved responses
- Auto-responders
- Message analytics

**Doctor Checks:**
- Templates save
- Quick replies work
- Analytics track

**UI:**
- `/seller/messages/templates` → Message templates

---

### Phase 28: Disputes Automation
**Backend:**
- DisputeRule, AutoResolution models
- Auto-resolution rules
- Escalation triggers
- Resolution tracking

**Doctor Checks:**
- Rules match correctly
- Auto-resolution works
- Escalation triggers

**UI:**
- `/corp/cases/automation` → Dispute automation

---

### Phase 29: Seller Hub
**Backend:**
- Seller session context
- Seller-scoped API routes (`/api/seller/*`)
- Seller dashboard aggregation
- Seller-safe state machine subset

**Doctor Checks:**
- Seller session resolves
- API routes enforce scope
- Dashboard data returns

**UI:**
- `/seller/dashboard` → Seller overview
- `/seller/listings` → Seller's listings
- `/seller/orders` → Seller's orders

**Canonical:** `TWICELY_SELLER_HUB_HIGH_LEVEL_ARCHITECTURE_CANONICAL.md`

---

### Phase 30: Customer Support Console
**Backend:**
- SupportCase, SupportNote, SupportMacro models
- Case queue and assignment
- Resolution workflows
- Macros for common responses

**Doctor Checks:**
- Case creation works
- Assignment tracks
- Resolution updates case

**UI:**
- `/corp/support` → Case queue
- `/corp/support/[id]` → Case detail

---

### Phase 31: Taxes & Compliance
**Backend:**
- TaxConfiguration, TaxCalculation, TaxReport models
- Tax provider integration
- Compliance document storage
- Tax reporting

**Doctor Checks:**
- Tax calculation works
- Configuration persists
- Reports generate

**UI:**
- `/corp/settings/taxes` → Tax configuration
- `/corp/finance/tax-reports` → Tax reports

---

### Phase 32: Identity Verification & Risk
**Backend:**
- IdentityVerification, RiskAssessment, RiskSignal models
- Verification provider integration
- Risk scoring
- Fraud detection signals

**Doctor Checks:**
- Verification submission works
- Risk score computed
- Signals aggregate

**UI:**
- `/corp/users/[id]/verification` → Verification status
- `/corp/risk` → Risk dashboard

---

### Phase 33: Chargebacks & Claims
**Backend:**
- ChargebackCase, ChargebackEvidence, ChargebackResponse models
- Chargeback webhook handling
- Evidence submission workflow
- Response deadline tracking

**Doctor Checks:**
- Webhook creates case
- Evidence uploads
- Response submits

**UI:**
- `/corp/finance/chargebacks` → Chargeback queue
- `/corp/finance/chargebacks/[id]` → Case detail

---

### Phase 34: Shipping Labels
**Backend:**
- ShippingLabel, LabelPurchase, CarrierRate models
- Label provider integration
- Rate shopping
- Tracking sync

**Doctor Checks:**
- Rate fetch works
- Label purchase works
- Tracking syncs

**UI:**
- `/seller/orders/[id]/ship` → Label purchase
- `/corp/shipping/labels` → Label management

---

### Phase 35: Catalog Normalization
**Backend:**
- ProductCatalog, CatalogMapping, ProductVariant models
- Normalization rules
- Deduplication
- Canonical product matching

**Doctor Checks:**
- Normalization runs
- Mappings created
- Dedup works

**UI:**
- `/corp/catalog` → Catalog management
- `/corp/catalog/duplicates` → Duplicate resolution

---

### Phase 36: Promoted Listings
**Backend:**
- PromotedListing, PromotionBudget, PromotionImpression models
- Ad serving
- Budget tracking
- Attribution tracking

**Doctor Checks:**
- Promotion creation works
- Budget tracks
- Attribution records

**UI:**
- `/seller/promotions` → Seller promo management
- `/corp/promotions/promoted` → Corp overview

---

### Phase 37: Seller Standards
**Backend:**
- SellerStandard, StandardViolation, StandardTier models
- Standards computation
- Violation detection
- Enforcement triggers

**Doctor Checks:**
- Standards computed
- Violations detected
- Enforcement applied

**UI:**
- `/seller/performance/standards` → Seller standards
- `/corp/trust/standards` → Standards management

---

### Phase 38: Buyer Protection Plus
**Backend:**
- Category-specific coverage limits
- Seller protection scores (0-100 with EXCELLENT/GOOD/FAIR/POOR tiers)
- Seller appeal workflow with evidence
- Dispute timeline with event tracking
- Protection badges on listings
- Public /protection transparency page
- Auto-approval based on category and seller score
- Refund reversal on successful appeals
- **New Models:** CategoryCoverageLimit, SellerProtectionScore, SellerAppeal, DisputeTimelineEvent, ProtectionSettings

**Doctor Checks:**
- Claim creation works
- Resolution workflow works
- Coverage computed
- Appeal workflow complete
- Protection score updates

**UI:**
- `/corp/settings/protection` → Protection settings admin
- `/corp/protection/appeals-queue` → Appeals review
- `/corp/protection/category-limits` → Category coverage
- Buyer claim submission
- Public /protection page

**Canonical:** `TWICELY_BUYER_PROTECTION_CANONICAL.md`

---

### Phase 39: SEO & Public Browse
**Backend:**
- SEOMetadata, SitemapEntry, CanonicalUrl models
- Structured data generation (JSON-LD)
- Sitemap generation
- Canonical URL management

**Doctor Checks:**
- Metadata generates
- Sitemap builds
- Canonicals resolve

**UI:**
- `/corp/seo` → SEO management
- Public browse pages with SEO

---

### Phase 40: International Enhanced
**Backend:**
- ExchangeRate, ExchangeRateHistory models
- Multi-currency price display
- Currency conversion service
- Locale-aware formatting
- Translation models and workflow

**Doctor Checks:**
- Exchange rates update
- Currency conversion accurate
- Translations load

**UI:**
- `/corp/settings/currencies` → Currency management
- `/corp/settings/exchange-rates` → Rate configuration
- Multi-currency display throughout

**Canonical:** `TWICELY_MULTI_CURRENCY_TRANSLATIONS_CANONICAL.md`

---

### Phase 41: Variations Complete
**Backend:**
- ListingVariation, VariationOption models
- Variation inventory tracking
- Variation-aware cart and checkout
- SKU generation

**Doctor Checks:**
- Variation creation works
- Inventory tracks per-variation
- Cart handles variations

**UI:**
- Variation builder in listing editor
- Variation selector on listing page
- Variation-aware order display

**Canonical:** `TWICELY_PRODUCT_VARIATIONS_CANONICAL.md`

---

### Phase 42: Seller Experience Plus
**Backend:**
- BuyerBlock, BuyerBlockAttempt models
- BulkListingJob model (import/export/bulk updates)
- VacationModeSchedule model (enhanced scheduling)
- Block enforcement middleware

**Doctor Checks:**
- Block buyer works
- Block enforcement triggers
- Bulk jobs process
- Vacation mode activates/deactivates

**UI:**
- `/seller/settings/blocked-buyers` → Block list management
- `/seller/tools/bulk` → Bulk listing tools
- `/seller/settings/vacation` → Vacation scheduler

**Canonical:** `TWICELY_SELLER_EXPERIENCE_PLUS_CANONICAL.md`

---

### Phase 43: Buyer Experience Plus (Price Alerts Plus)
**Backend:**
- Price history tracking with graphs
- Market price index by category/product
- Deal badges (GREAT_DEAL, GOOD_DEAL, PRICE_DROP, LOWEST_PRICE, BELOW_MARKET)
- Enhanced price alerts (BELOW_PRICE, PERCENT_DROP, BELOW_MARKET, ANY_DROP)
- Category alerts for new listing matches
- Email digests (daily/weekly) for alerts
- Deal-sensitive recommendations
- **New Models:** ListingPriceHistory, MarketPriceIndex, CategoryAlert, AlertDigest, PriceAlertSettings

**Doctor Checks:**
- Price alert creation works
- Alert triggers on price drop
- Price history records
- Deal badges compute
- Category alerts match
- Digests generate

**UI:**
- Price alert button on listings
- Price history graph on listing detail
- Deal badges on search results
- Category alert management
- `/corp/settings/price-alerts` → Price alert settings admin

**Canonical:** `TWICELY_BUYER_EXPERIENCE_PLUS_CANONICAL.md`

---

### Phase 44: Listing Variations
**Backend:**
- Complete variation system from Phase 41
- Multi-dimensional variations (size × color × style)
- Parent/child listing relationships
- Variation-specific pricing, quantity, SKU
- Variation images and attributes

**Doctor Checks:**
- Multi-dimension variations work
- Parent/child links correct
- Variation-specific data persists
- Search indexes variations

**UI:**
- Variation matrix builder
- Bulk variation editing
- Variation-aware listing display

**Canonical:** `TWICELY_V2_VARIATIONS_CANONICAL.md`

---

## SUBSCRIPTION SYSTEM

### Tiers (eBay-Exact — 6 Tiers)

| Tier | Monthly | Free Listings | Insertion Fee | FVF | Storefront |
|------|---------|---------------|---------------|-----|------------|
| **SELLER** | $0 | 250 | $0.35 | 13.25% | No |
| STARTER | $4.95 | 250 | $0.30 | 12.35% | Yes |
| BASIC | $21.95 | 1,000 | $0.25 | 11.5% | Yes |
| PRO | $59.95 | 10,000 | $0.15 | 10.25% | Yes |
| ELITE | $299.95 | 25,000 | $0.05 | 9.15% | Yes |
| ENTERPRISE | $2,999.95 | 100,000 | $0.05 | Custom | Yes |

### Key Points
- **SELLER tier** = casual seller (no subscription, no storefront)
- **STORE tiers** (STARTER+) = paid subscription with storefront
- Personal sellers can only use SELLER tier
- Business upgrade (free) required before subscribing to store
- `ensureSellerProfile()` creates profile at SELLER tier
- `subscribeToStore()` upgrades BUSINESS sellers to STARTER+

### Tier Enum (Prisma)

```prisma
enum SellerTier {
  SELLER      // $0/mo     — Casual seller (no store)
  STARTER     // $4.95/mo  — Entry level store
  BASIC       // $21.95/mo — Small business store
  PRO         // $59.95/mo — Growing business store
  ELITE       // $299.95/mo — High volume store
  ENTERPRISE  // $2,999.95/mo — Enterprise store
}
```

### Tier Features

```typescript
const TIER_FEATURES = {
  SELLER: { storefront: false, analytics: "basic", staff: 0, freeListings: 250, insertionFee: 35, fvfBps: 1325 },
  STARTER: { storefront: true, analytics: "basic", staff: 0, freeListings: 250, insertionFee: 30, fvfBps: 1235 },
  BASIC: { storefront: true, analytics: "advanced", staff: 2, bulkTools: true, promotedListings: true, freeListings: 1000, insertionFee: 25, fvfBps: 1150 },
  PRO: { storefront: true, analytics: "advanced", staff: 5, salesEvents: true, prioritySupport: true, freeListings: 10000, insertionFee: 15, fvfBps: 1025 },
  ELITE: { storefront: true, analytics: "advanced", staff: 15, dedicatedRep: true, customPages: true, freeListings: 25000, insertionFee: 5, fvfBps: 915 },
  ENTERPRISE: { storefront: true, analytics: "advanced", staff: 100, customFees: true, apiRateLimit: "10x", freeListings: 100000, insertionFee: 5, fvfBps: 800 },
};
```

### Personal vs Business Seller

```
PERSONAL SELLER (SELLER tier only)
├── 250 free listings/month
├── $0.35 insertion fee after
├── 13.25% FVF
├── ✗ Cannot subscribe to store
└── Must upgrade to BUSINESS first (free)

BUSINESS SELLER (SELLER or STORE tier)
├── Same fees as Personal at SELLER tier
├── Business name shown to buyers
├── ✓ Can subscribe to store (STARTER+)
└── Store unlocks lower fees + storefront
```

| Seller Type | Store Tier | Valid? | Description |
|-------------|------------|--------|-------------|
| PERSONAL | SELLER | ✓ | Casual individual seller |
| PERSONAL | STARTER+ | ✗ | **NOT ALLOWED** — must upgrade to Business first |
| BUSINESS | SELLER | ✓ | Business selling casually |
| BUSINESS | STARTER+ | ✓ | Business with store subscription |

---

## CRITICAL RULES

### Money
- All amounts in **cents** (integers)
- Currency stored with amount
- No mixed-currency operations
- Ledger entries immutable

### State Machines
- Follow transitions in `TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`
- No skipping states
- All transitions logged

### RBAC
- Use `requireRole()` middleware
- Scope data to user's permissions
- Seller routes only see seller's data

### Payout Gates
Must pass ALL before payout:
1. `SellerProfile.status = SELLER_ACTIVE`
2. `SellerProfile.payoutsStatus = PAYOUTS_ENABLED`
3. `PayoutDestination.isVerified = true`
4. Kill switch `payouts_execute` not active

### Search Eligibility
Listing appears in search only if:
1. `Listing.status = ACTIVE`
2. `SearchIndex.isEligible = true`
3. Seller not suspended

### Trust Multipliers
| Band | Score | Multiplier |
|------|-------|------------|
| A | 4.8+ | 1.2x |
| B | 4.5-4.79 | 1.0x |
| C | 4.0-4.49 | 0.85x |
| D | <4.0 | 0.7x |
| New | <10 orders | Cap-only (no penalty) |

---

## HEALTH PROVIDER PATTERN

Every domain needs:

```typescript
export const domainHealthProvider: HealthProvider = {
  id: "domain",
  label: "Domain Name",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;
    
    // Add checks...
    checks.push({
      id: "domain.check_name",
      label: "Check description",
      status: HEALTH_STATUS.PASS,
      message: "Details",
    });
    
    return {
      providerId: this.id,
      status,
      summary: "Domain healthy",
      checks,
    };
  },
};
```

---

## DOCTOR CHECK PATTERN

Every phase needs integration tests:

```typescript
async function runPhaseNDoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Feature works
  const testResult = await doSomething();
  results.push({
    id: "phase.feature_works",
    label: "Feature works correctly",
    status: testResult ? "PASS" : "FAIL",
    message: testResult ? "Working" : "Failed",
  });
  
  // Cleanup test data...
  
  return results;
}
```

---

## INSTALLATION COMMAND

To install a phase:

```bash
# 1. Run migration
npx prisma migrate dev --name phase_N_name

# 2. Run seeders
npx ts-node scripts/seed-phase-N.ts

# 3. Verify health
curl http://localhost:3000/api/health

# 4. Run Doctor
npx ts-node scripts/twicely-doctor.ts --phase=N
```

---

## COMPLETION CHECKLIST

For each phase, verify:

- [ ] Prisma schema added and migrated
- [ ] Services implemented
- [ ] API routes created
- [ ] Health provider registered
- [ ] Doctor checks passing
- [ ] UI components built
- [ ] Audit events emitting
- [ ] Tests written

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial master prompt (phases 0-39) |
| 2.0 | 2026-01-20 | Extended to phases 0-43, added Plus features |
| 2.1 | 2026-01-23 | **6-Tier Fix**: Added SELLER tier, extended to Phase 44, fixed UTF-8 |

---

## END OF MASTER INSTALL PROMPT
