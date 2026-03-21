# TWICELY V3 — Feature Lock-In Addendum v2.1

**Version:** v2.1 (addendum to v2.0)
**Date:** 2026-02-17
**Purpose:** Four new feature domains (§47–§50) and updates to existing domains. Apply to TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md.

**Total domains after update:** 50

---

## 47. Twicely.Local (In-Person Transactions)

### Core Concept
Local pickup and meetup transactions with buyer protection. Seller lists item as `SHIP_AND_LOCAL` or `LOCAL_ONLY`. Buyer selects local pickup at checkout. Payment held in escrow until QR-code confirmation at meetup.

### Fulfillment Types
- `SHIP_ONLY` — Default. Standard shipped transaction.
- `LOCAL_ONLY` — Item available only for local pickup. No shipping option.
- `SHIP_AND_LOCAL` — Buyer chooses at checkout. Both options available.

### Seller Configuration
- Seller sets `maxMeetupDistanceMiles` in seller settings (default: 25 miles)
- Seller sets pickup address or selects Safe Meetup Locations
- Buyer search filters: "Local Pickup Available" checkbox, radius slider (5–50 miles)
- Listings show "📍 Local Pickup Available" badge with distance from buyer

### Meetup Flow
1. Buyer selects "Local Pickup" at checkout → pays via Stripe (5% local fee + processing)
2. System generates unique `confirmationCode` (UUID for QR) + `offlineCode` (6-digit numeric fallback)
3. Buyer and seller coordinate meetup time via in-app messaging
4. Both parties check in at location (optional — not required, but enables safety features)
5. Buyer inspects item → scans seller's QR code (or enters 6-digit code) → funds released to seller
6. If buyer doesn't confirm within 48 hours of scheduled time → auto-escalation to support

### QR Escrow Release
- Seller shows QR code from their app → buyer scans with their app → confirmation modal appears → buyer taps "Confirm Receipt" → escrow releases
- Offline fallback: seller reads 6-digit code → buyer enters in app → same confirmation flow
- Offline-offline: if both parties have no signal, buyer enters offline code, app stores confirmation locally, syncs to server when connectivity returns (grace period: 2 hours)
- Each confirmation code is single-use. After use, it's invalidated immediately.

### Safe Meetup Locations
- Platform-curated list of verified safe meetup spots (police stations, retail stores, community centers)
- Suggested to both parties during meetup scheduling
- Listings near Safe Spots show "🏛️ Safe Meetup Spot Nearby" badge
- Staff manages locations in hub admin (`/cfg/safe-spots`)
- Community can suggest locations → staff reviews and approves

### No-Show Penalties
- If scheduled meetup happens and one party doesn't show:
  - No-show party charged $5 fee → paid to other party as compensation
  - Strike recorded on profile
  - 3 strikes within 90 days → local transactions suspended for 90 days
- No-show determination: if only one party checks in at location and other doesn't within 30 minutes → auto-cancel with no-show flag
- Platform setting: `commerce.local.noShowFeeCents: 500`
- Platform setting: `commerce.local.noShowStrikeLimit: 3`

### Cash Transactions
- Buyer can choose "Pay in Person (Cash)" at checkout → no escrow, no Stripe, no fee
- Cash transactions have **no buyer protection** — clearly disclosed:
  > "Cash payments are not covered by Twicely Buyer Protection. We recommend using in-app payment for all transactions."
- Cash orders still tracked for seller analytics and Financial Center
- Seller must manually mark cash order as complete

### Safety Features
- Safety timer: if check-in happens but confirmation doesn't within 30 minutes → both parties get push notification: "Is everything OK? Tap here if you need help."
- Emergency: support case auto-created if safety alert not dismissed within 15 minutes
- Location sharing: during active meetup, both parties can see each other's approximate location (opt-in, permission-based)

### Data Model
- `localTransaction` table (see Schema Addendum §3.6)
- `safeMeetupLocation` table (see Schema Addendum §3.7)
- `listing.fulfillmentType` enum
- `listing.localPickupRadiusMiles` integer
- `order.isLocalPickup` boolean
- `order.localTransactionId` FK

### Phase: D1 (design), G2 (build)

---

## 48. Authentication Program

### Core Concept
Multi-tier authentication system for luxury and high-value items. Twicely facilitates authentication through third-party partners — Twicely does NOT independently verify or guarantee authenticity.

### Three Tiers

**Tier 1: Verified Seller (FREE)**
- Seller completes identity verification (KYC) + provides proof of sourcing (receipts, invoices, authorized dealer documentation)
- Staff reviews credentials
- Badge: "✓ Verified Seller" on profile and all listings
- Does NOT authenticate individual items — it authenticates the seller's credentials
- Available at launch (Phase D)

**Tier 2: AI Authentication ($19.99)**
- Powered by Entrupy or equivalent AI authentication partner
- Seller or buyer requests authentication → item photos analyzed by AI
- Results: AUTHENTICATED, INCONCLUSIVE, or COUNTERFEIT
- Badge: "🔒 AI Authenticated" on listing
- Deferred until Entrupy volume pricing negotiated (Phase G or post-launch)

**Tier 3: Expert Human Authentication ($39.99–$69.99)**
- Item shipped to expert authentication partner
- Physical inspection by trained authenticator
- Results: AUTHENTICATED or COUNTERFEIT (no inconclusive — experts commit)
- Badge: "🏆 Expert Authenticated" + certificate
- Available at launch with partner network

### Cost Split Model
See Monetization Addendum §4C for complete pricing. Summary:
- Buyer-initiated: $19.99 at checkout. If authentic → split 50/50. If counterfeit → seller pays all.
- Seller-initiated: full fee upfront. Badge applied if authentic.
- Settlement: deducted from THIS transaction payout, never deferred.

### External Authentication Policy
- Twicely NEVER recognizes external authentication (StockX, The RealReal, etc.) for badges
- Sellers can mention external auth in descriptions and upload photos of tags/certificates
- Listing page shows disclaimer: "This seller references authentication from a third party. Twicely cannot verify external authentication claims."
- Buyer is nudged toward Twicely authentication: "[Request Twicely Authentication — $9.99]"

### Certificate System
- Every Twicely authentication creates a unique certificate: `TW-AUTH-XXXXX`
- Certificate is tied to specific `listingId` + `authenticationRequestId`
- Certificate does NOT transfer to new listings. Relist = re-authenticate required for badge.
- Public verification URL: `twicely.co/verify/TW-AUTH-XXXXX`
  - Shows: authentication date, listing thumbnail, authenticator, status (VALID/EXPIRED/TRANSFERRED/REVOKED)
  - If listing sold and relisted: "This certificate was issued for a previous listing."

### Photo Fingerprinting (Anti-Fraud)
- Authenticator takes standardized photos (specific angles, serial numbers, stitching, hardware)
- Each photo gets perceptual hash (pHash) — same technology as crosslister dedupe
- Hash set stored as item's visual fingerprint
- If someone relists with same certificate number, system compares photos against stored fingerprint
- Photo mismatch → certificate rejected, listing flagged for review

### Buyer Declination Record
- If buyer is offered authentication at checkout and declines:
  - `order.authenticationOffered = true`
  - `order.authenticationDeclined = true`
  - `order.authenticationDeclinedAt = timestamp`
- Does NOT void buyer protection — but provides evidence in disputes
- Recorded for legal protection in chargeback scenarios

### Data Model
- `authenticationRequest` table (see Schema Addendum §3.9)
- `authenticatorPartner` table (see Schema Addendum §3.10)
- `listing.authenticationStatus` enum
- `listing.authenticationRequestId` FK

### Platform Settings
```
trust.authentication.offerThresholdCents: 50000    # Show auth option on $500+ items
trust.authentication.buyerFeeCents: 1999
trust.authentication.sellerFeeCents: 1999
trust.authentication.expertFeeCents: 3999
trust.authentication.expertHighValueFeeCents: 6999
trust.authentication.mandatoryAboveCents: null      # null = never mandatory
```

### Legal Disclaimers (Required on Every Auth Badge/Certificate)
> "Authentication services are provided by independent third-party partners. Twicely facilitates the authentication process but does not independently verify item authenticity. Results represent the opinion of the authenticating party. Twicely is not liable for authentication errors. See our Authentication Terms for full details."

### Phase: Tier 1 at D1, Tier 3 at D2, Tier 2 deferred to G or post-launch

---

## 49. Financial Center

### Core Concept
Full resale business bookkeeping tool — not just marketplace reporting. Sellers run their entire resale business finances from Twicely: auto-populated sales data + manual expense tracking + receipt scanning + mileage logging + P&L generation.

### Auto-Populated Data (Zero Setup)
- Twicely marketplace sales: revenue, TF, Stripe fees, shipping costs — all automatic
- Crosslister-detected off-platform sales: eBay fees, Poshmark fees, Mercari fees — auto-populated from sale detection
- Subscription charges: automatically logged as business expenses
- Shipping label purchases: automatically logged
- Authentication fees: automatically logged

### Manual Entry Features
- **Expense Tracking**: unlimited manual expense entries (Lite+)
  - 16 preset categories: Shipping Supplies, Packaging, Equipment, Software/Subscriptions, Mileage, Storage/Rent, Sourcing Trips, Photography, Authentication, Platform Fees, Postage, Returns/Losses, Marketing, Office Supplies, Professional Services, Other
  - Custom vendor, description, date fields
- **Receipt Scanning** (Plus+): upload photo → AI extracts amount, vendor, date, category
  - Uses AI credit system (1 credit per scan)
  - Manual correction if AI misreads
- **Recurring Expenses** (Lite+): set monthly/weekly/annual recurring charges
  - Storage unit, software subscriptions, rent — auto-logged each period
  - Start/end dates configurable
- **Mileage Tracker** (Plus+): log trips with description, distance, date
  - IRS standard mileage rate auto-applied ($0.70/mile in 2026)
  - Deduction auto-calculated: miles × rate
  - Trip history with totals per period

### Reports (Tier-Gated)

| Report | Lite | Plus | Pro |
|--------|------|------|-----|
| P&L Statement | ✅ | ✅ | ✅ |
| Revenue by platform | ✅ | ✅ | ✅ |
| Expense by category | ✅ | ✅ | ✅ |
| Balance Sheet | ❌ | ❌ | ✅ |
| Cash Flow Statement | ❌ | ❌ | ✅ |
| Inventory Aging | ❌ | ❌ | ✅ |
| Tax Prep Package | ❌ | ✅ | ✅ |
| Cross-Platform Breakdown | ❌ | ❌ | ✅ |
| Custom Report Builder | ❌ | ❌ | Enterprise |

### Export Formats
- CSV (all tiers including FREE for basic data)
- PDF reports (Lite+)
- QuickBooks sync (Pro+)
- Xero sync (Pro+)

### History Retention
- FREE: 30 days rolling
- Lite: 1 year
- Plus: 3 years
- Pro: 7 years
- Enterprise: 10 years

### P&L Example (What the Report Looks Like)
```
═══ PROFIT & LOSS — January 2026 ═══

Revenue
  Twicely Sales:              $4,280  ← auto
  eBay Sales:                 $1,890  ← auto (crosslister)
  Poshmark Sales:             $620    ← auto (crosslister)
  Local Sales:                $340    ← auto
                              ──────
Gross Revenue:                $7,130

COGS
  Inventory Purchased:       -$2,840  ← from listing COGS field
                              ──────
Gross Profit:                 $4,290

Platform Fees
  Twicely TF:                -$428   ← auto
  Twicely Stripe:             -$128   ← auto
  eBay Fees:                  -$274   ← auto (crosslister)
  Poshmark Fees:              -$124   ← auto (crosslister)
                              ──────
Net After Fees:               $3,336

Operating Expenses
  Shipping Supplies:          -$89    ← manual entry
  Packaging:                  -$45    ← manual entry
  Storage Unit:              -$149    ← recurring
  Mileage (342mi × $0.70):   -$239   ← mileage tracker
  Photography Equipment:      -$30    ← manual entry
  Twicely Subscription:       -$50    ← auto
  Software (Lightroom):       -$13    ← recurring
                              ──────
Total Expenses:               -$615

═══ NET PROFIT:               $2,721 ═══
```

### UI Location
- Main navigation: `/my/finances` (seller dashboard)
- Dashboard widget: revenue/expenses/profit summary card
- Hub admin: `/fin/reports` for platform-wide financial analytics

### Data Model
- `financeSubscription` table (Schema Addendum §3.1)
- `expense` table (Schema Addendum §3.2)
- `mileageEntry` table (Schema Addendum §3.3)
- `financialReport` table (Schema Addendum §3.4)
- `accountingIntegration` table (Schema Addendum §3.5)
- `sellerProfile.financeTier` field

### Phase: D3 (basic dashboard + P&L), E2 (receipt scanning + mileage), G1 (QuickBooks/Xero sync)

---

## 50. Combined Shipping

### Core Concept
Five shipping modes for multi-item orders from the same seller. First four auto-apply at checkout. Fifth is a seller-quoted escrow flow with a 48-hour penalty for non-response.

### Five Modes

| Mode | How It Works | Seller Config | Approval Needed |
|------|-------------|---------------|-----------------|
| **Individual** (default) | Each item ships separately, full price | Nothing | No |
| **Flat Fee** | One flat shipping price for any bundle | Set flat amount | No |
| **Per-Additional** | First item full price, +$X per additional | Set additional amount | No |
| **Auto-Discount %** | X% off total shipping for multi-item | Set discount % (10–75%) | No |
| **Seller-Quoted** | Seller quotes actual cost after purchase | Enable quoted mode | Yes |

### Seller Configuration UI (`/my/selling/settings/shipping`)
```
Combined Shipping
─────────────────
How do you want to handle multi-item orders?

○ Individual shipping (each item ships separately)
○ Flat combined fee: $[____] for any bundle
○ Per additional item: +$[____] per extra item
○ Auto-discount: [__]% off total shipping
○ I'll quote shipping after each order (48-hour window)

ℹ️ If you choose "quote after order" and don't respond
   within 48 hours, buyer automatically gets 25% off shipping.
```

### Mode 5: Seller-Quoted Flow with 48-Hour Penalty

**Timeline:**
```
Hour 0:   Buyer purchases → Stripe auth hold at MAX shipping (sum of individual rates)
Hour 0-48: Seller quotes actual combined shipping cost
           → Buyer notified: "Seller quoted $X for combined shipping (saves $Y)"
           → Buyer accepts → charge adjusted, order proceeds
           → Buyer disputes → support case opened
Hour 48:  ⚠️ Seller missed deadline
           → Buyer auto-receives 25% discount off MAX shipping
           → Seller notified: "You missed the window. Buyer received 25% shipping discount."
Hour 48+: Seller can STILL quote lower than penalty price
           → Buyer pays lower of: seller quote OR penalty-discounted price
Hour 72:  Standard late shipment penalties apply if not shipped
```

**Math example:**
```
3 items purchased, individual shipping totals: $24.97
Auth hold placed: $24.97 (max ceiling)

Scenario A — Seller quotes within 48 hours:
  Seller quotes: $12.50
  Buyer pays: $12.50 (saves $12.47)

Scenario B — Seller misses 48-hour window:
  Auto-discount: 25% off max = $24.97 × 0.75 = $18.73
  Seller can still quote lower (e.g., $12.50)
  Buyer pays: lower of seller quote or $18.73

Scenario C — Seller never quotes, ships within 72 hours:
  Buyer pays: $18.73 (25% discount auto-applied)
  Seller ships with individual packaging
```

### Data Model
- `shippingProfile` fields: `combinedShippingMode`, `flatCombinedCents`, `additionalItemCents`, `autoDiscountPercent`, `autoDiscountMinItems`
- `combinedShippingQuote` table (Schema Addendum §3.8)
- `order.combinedShippingQuoteId` FK

### Platform Settings
```
commerce.shipping.combinedQuoteDeadlineHours: 48
commerce.shipping.combinedPenaltyDiscountPercent: 25
commerce.shipping.autoDiscountMinPercent: 10
commerce.shipping.autoDiscountMaxPercent: 75
```

### Phase: B3 (basic modes 1-4 at checkout), D2 (mode 5 quoted flow)

---

## Updates to Existing Domains

### §6 Shipping — Add Shipment Exception States

Add to shipment_status enum:
- `LOST` — carrier lost the package. Triggers automatic buyer protection claim.
- `DAMAGED_IN_TRANSIT` — carrier damaged the package. Buyer can file claim with photos.
- `RETURN_TO_SENDER` — undeliverable, returning to sender. Seller notified to expect return.

Auto-detection: webhook from Shippo triggers status update. BullMQ job creates support case for LOST and DAMAGED_IN_TRANSIT events.

### §3 Cart & Checkout — Add Authentication Offer

At checkout for items above `trust.authentication.offerThresholdCents` ($500):
- Show authentication option: "Want this item authenticated? [Request Authentication — $9.99]"
- Buyer selects Yes → auth fee added to total, item routes through authenticator
- Buyer selects No → `order.authenticationDeclined = true`, standard flow continues
- Both choices are recorded and non-reversible after checkout completes

### §3 Cart & Checkout — Add Local Pickup Option

If listing has `fulfillmentType = SHIP_AND_LOCAL`:
- Checkout shows: "How do you want to receive this item?"
  - ○ Ship to my address ($X.XX shipping)
  - ○ Local pickup (no shipping fee, 5% local fee)
- Selection determines order type and fee structure

### §42 Returns & Disputes — Add Return Fee Allocation

Every return now assigns a `returnReasonBucket`:
- `SELLER_FAULT`: INAD, DAMAGED, WRONG_ITEM, COUNTERFEIT → seller pays return shipping + full refund
- `BUYER_REMORSE`: REMORSE → buyer pays return shipping + restocking fee (up to 15%)
- `PLATFORM_CARRIER_FAULT`: LOST, DAMAGED_IN_TRANSIT → platform absorbs, files carrier claim
- `EDGE_CONDITIONAL`: partial refund scenarios → negotiated or escalated

Payout breakdown tracked per return: `refundItemCents`, `refundShippingCents`, `refundTaxCents`, `restockingFeeCents`, `feeAllocationJson`.
