# TWICELY V3 — User & Business Model (LOCKED)

**Version:** v1.3
**Status:** LOCKED — DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE
**Date:** 2026-02-25  
**Carries Forward From:** V2 `TWICELY_USER_MODEL_LOCKED.md` v1.1  
**Author:** Platform Architect  
**Purpose:** Define the canonical user, seller, business, staff, and subscription model for Twicely V3. This document is the single source of truth for identity, ownership, and tier logic across the entire platform.

---

## V2 Lessons (Why This Document Exists)

V2 spec was near-perfect. The architecture was sound. What failed was implementation:

1. **Claude Code couldn't translate specs to working code.** The user model was correct on paper but the implementation diverged — ownership checks were inconsistent, tier gating had holes, and the Personal → Business upgrade flow was never fully wired.
2. **Two separate tier concepts got conflated.** `SellerTier` (subscription) and `SellerBand` (performance/trust) were two different enums but code often checked the wrong one.
3. **Too many files defined the same rules.** The user model was spread across `TWICELY_USER_MODEL_LOCKED.md`, `TWICELY_V2_INSTALL_PHASE_1_RBAC_ROLES.md`, `TWICELY_V2_INSTALL_PHASE_24_SUBSCRIPTIONS_BILLING_TIERS.md`, and `TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`. When implementations diverged, nobody caught it.

**V3 fix:** ONE canonical document. Everything about user identity, seller capability, subscriptions, and performance is here. All other documents reference this one. Any deviation is a bug.

---

## 1. SINGLE ACCOUNT RULE (NON-NEGOTIABLE)

Twicely has **ONE account type:**

### `User`

There are:
- ❌ No buyer accounts
- ❌ No seller accounts
- ❌ No business accounts
- ❌ No staff accounts (staff are users with delegated access)
- ❌ No admin accounts (admins are users with platform roles)

Every person is a **User**. All other concepts are **capabilities or metadata layered onto the same user.**

This rule is absolute and applies to database schema, API design, UI language, and business logic.

---

## 2. BUYER IS NOT A ROLE

Buying is **default behavior.**

- Users are NOT marked as buyers
- No buyer flags
- No buyer roles
- No buyer table

If a user can authenticate, they can buy. Period.

### Buyer Quality Tier (Computed, Internal)

Sellers see a buyer quality signal derived from buyer behavior:

| Tier | Meaning |
|------|---------|
| GREEN | Good buyer — few returns, no disputes, pays promptly |
| YELLOW | Caution — elevated returns or disputes |
| RED | High risk — pattern of abuse, chargebacks, or fraud flags |

**Rules:**
- Computed from: return rate, dispute rate, chargeback rate, account age, order history
- Individual seller ratings of buyers are NOT publicly visible
- Buyer CANNOT see their own tier (only sellers see it as a signal)
- Tier is a recommendation, not a blocking mechanism (sellers can still sell to RED buyers)

---

## 3. SELLER IS A CAPABILITY, NOT AN ACCOUNT

A user becomes a seller **by action**, not by registration.

### Activation Rule
- First listing automatically enables selling
- There is NO "Become a Seller" registration flow
- Listing creation triggers: `user.isSeller = true`, `sellerProfile` created, `sellerType = PERSONAL`

### Seller Type (Personal vs Business)

| Type | Description | Store Eligible | Crosslister Eligible | Requirements |
|------|-------------|---------------|---------------------|--------------|
| **PERSONAL** | Individual seller, casual | ❌ No store subscription | ✅ Any lister tier | None beyond auth |
| **BUSINESS** | Registered business | ✅ Any store tier | ✅ Any lister tier | BusinessInfo record |

**Gate Rule:** Personal sellers CANNOT subscribe to a store (Store Starter+). They must upgrade to BUSINESS first. Business upgrade is FREE. Crosslister is available to ALL sellers regardless of type.

### Seller Profile (1:1 with User)

Every seller gets exactly one `SellerProfile` linked to their `User`:

```
SellerProfile {
  id
  userId              // === owner (1:1, unique)
  
  // Type
  sellerType           // PERSONAL | BUSINESS
  
  // Store Subscription (independent axis 1)
  storeTier            // NONE | STARTER | PRO | POWER | ENTERPRISE

  // Crosslister Subscription (independent axis 2)
  listerTier           // NONE | FREE | LITE | PRO
  
  // Automation Add-On (independent)
  hasAutomation        // boolean
  
  // Performance Band (independent axis 3 — computed, not purchased)
  performanceBand      // EMERGING | ESTABLISHED | TOP_RATED | POWER_SELLER
  
  // Status
  status               // ACTIVE | RESTRICTED | SUSPENDED
  payoutsEnabled       // boolean
  
  // Timestamps
  activatedAt          // When first listing created
  verifiedAt           // When identity verified (if required)
  
  // Stripe Connect
  stripeAccountId      // acct_...
}
```

---

## 4. THREE INDEPENDENT AXES (DO NOT CONFLATE)

V2 had two concepts (subscription + performance) that got confused. V3 has THREE independent axes plus an add-on. They never interact except where explicitly defined.

### 4.1 Store Subscription (Purchased — Twicely storefront + tools)

**What it is:** A paid monthly subscription for Twicely storefront, staff, analytics, and seller tools.
**Who controls it:** The seller, via their wallet.
**How it changes:** Seller subscribes/upgrades/downgrades via Stripe billing.
**Requires:** BUSINESS seller status (free upgrade).
**Enum name:** `StoreTier`

| Tier | Annual/mo | Monthly | Free Listings/Mo | Insertion Fee | Notes | Staff |
|------|----------|---------|-----------------|--------------|-------------|-------|
| **No Store (NONE)** | $0 | $0 | 100 | $0.35 | — | 0 |
| **Store Starter** | $6.99 | $12.00 | 250 | $0.25 | — | 0 |
| **Store Pro** | $29.99 | $39.99 | 2,000 | $0.10 | — | 5 |
| **Store Power** | $59.99 | $79.99 | 15,000 | $0.05 | — | 25 |
| **Store Enterprise** | Custom | Custom | Unlimited | Waived | Custom | Unlimited |

**Gate rule:** PERSONAL sellers CANNOT subscribe to a store. Must upgrade to BUSINESS first (free).
**Independence:** Store subscription does NOT require Crosslister. Crosslister does NOT require Store.

See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` for full feature matrix and rules.

### 4.2 Crosslister Subscription (Purchased — multi-platform distribution)

**What it is:** A paid subscription for crosslisting to external marketplaces.
**Who controls it:** The seller, via their wallet.
**How it changes:** Seller subscribes/upgrades/downgrades via Stripe billing.
**Requires:** Nothing (available to PERSONAL and BUSINESS sellers).
**Enum name:** `ListerTier`

| Tier | Annual/mo | Monthly | Publishes/Mo | Auto-Delist | Sync | AI Credits |
|------|----------|---------|-------------|------------|------|-----------|
| **Lister Free** | $0 | $0 | 25 | ❌ | ❌ | 0 |
| **Lister Lite** | $9.99 | $13.99 | 200 | ✅ | ❌ | 25 |
| **Lister Pro** | $29.99 | $39.99 | 2,000 | ✅ | ✅ | 200 |

**Gate rule:** NONE. Any seller (PERSONAL or BUSINESS) can subscribe.
**Independence:** Crosslister does NOT require Store. Store does NOT require Crosslister.

### 4.3 Automation Add-On (Purchased — makes listings sell)

**What it is:** A $9.99/month add-on that automates engagement across all connected platforms.  
**Requires:** Crosslister Lite or above.  
**Enum name:** Not an enum — boolean `hasAutomation` on seller profile.

Includes: auto-relist (all platforms), offer to likers/watchers (all platforms), smart price drops, stale listing refresh, and Poshmark sharing if connected. 2,000 actions/month.

### 4.4 Performance Band (Earned — NOT purchased)

**What it is:** A computed score reflecting seller quality, used for search ranking, trust signals, and TF bracket eligibility.
**Who controls it:** The platform — sellers earn it through behavior.
**How it changes:** Automatically recalculated from metrics (response time, ship time, return rate, cancellation rate, review scores).
**Enum name:** `PerformanceBand`

| Band | Badge Shown? | Search Multiplier | TF Benefit | Description |
|------|-------------|-------------------|-----------|-------------|
| **EMERGING** | ❌ No badge | 1.00 | None | New seller (< 10 orders) |
| **ESTABLISHED** | ❌ No badge | 1.00 | None | Meets baseline standards |
| **TOP_RATED** | ✅ Gold badge | 1.10 | — | Excellent metrics |
| **POWER_SELLER** | ✅ Diamond badge | 1.25 | — | Exceptional volume + quality |

**Critical rules:**
- Only TOP_RATED and POWER_SELLER show badges to buyers (no negative labels)
- New sellers start as EMERGING, graduate to ESTABLISHED at 10 completed orders
- TOP_RATED requires: ≥50 orders, ≥4.8 avg rating, <3% return rate, <2% cancel rate
- POWER_SELLER requires: ≥200 orders/quarter, all TOP_RATED metrics
- Band transitions trigger notifications but NOT automatic tier changes
- TF uses progressive volume brackets (Pricing Canonical v3.2 §2) — not per-tier or per-band discounts. Bands affect search ranking and badges only.

### DO NOT CONFLATE THESE

| | Store Tier | Lister Tier | Automation | Performance Band |
|---|---|---|---|---|
| Controlled by | Seller (purchase) | Seller (purchase) | Seller (purchase) | Platform (computed) |
| Changes via | Stripe billing | Stripe billing | Stripe billing | Metric recalculation |
| Affects | Storefront, staff, listings, payout frequency | Publish volume, sync, distribution | Auto-relist, offers, sharing | Search ranking, badges |
| Requires | BUSINESS status | Nothing | Lister Lite+ | Selling history |
| Enum values | NONE \| STARTER \| PRO \| POWER \| ENTERPRISE | NONE \| FREE \| LITE \| PRO | Boolean | EMERGING \| ESTABLISHED \| TOP_RATED \| POWER_SELLER |

A seller can have Store Pro + Lister Pro + Automation + TOP_RATED performance. Or no store + Lister Lite + no automation + ESTABLISHED performance. All four axes are independent.

---

## 5. OWNERSHIP RULE (CRITICAL)

**ALL ownership resolves to `userId`. Always.**

```
Listing.sellerId   = userId
Order.sellerId     = userId
Order.buyerId      = userId
Payout.ownerId     = userId
Storefront.ownerId = userId
```

### Forbidden

- ❌ businessId as owner
- ❌ storeId as owner
- ❌ staffId as owner
- ❌ sellerProfileId as owner (use userId directly)

This rule is never broken. Every resource traces to a User.

---

## 6. BUSINESS IS METADATA (NOT AN ACCOUNT)

A business is **tax + legal information attached to a user.**

```
BusinessInfo {
  id
  userId              // owner (1:1, unique)
  
  // Legal
  legalName            // Legal business name
  businessType         // SOLE_PROPRIETOR | LLC | CORPORATION | PARTNERSHIP
  
  // Tax
  taxId                // EIN or SSN (encrypted at rest)
  taxIdType            // SSN | EIN | ITIN
  
  // Contact
  businessAddress      // { street, city, state, zip, country }
  businessPhone        // Optional
  businessEmail        // Optional
  
  // Display
  displayBusinessName  // Shown to buyers (may differ from legalName)
  
  // Verification
  verifiedAt           // When verified by platform
  verifiedByStaffId    // Who verified (audit trail)
  
  // Timestamps
  createdAt
  updatedAt
}
```

### Business Upgrade Flow

1. Personal seller decides to open a store
2. System prompts: "Business account required for store subscription"
3. User provides business info (FREE — no charge)
4. `sellerProfile.sellerType` changes to `BUSINESS`
5. `BusinessInfo` record created
6. User can now subscribe to store (Store Starter+)

### Rules

- Same user, same listings, same payouts, same ownership
- BusinessInfo is **required** for store subscription (Store Starter+)
- BusinessInfo is NOT required to sell on Twicely without a store
- BusinessInfo is NOT required for crosslister subscription (any tier)
- Business does NOT own anything — the User owns everything
- `displayBusinessName` shown on listings and storefront for BUSINESS sellers
- BUSINESS seller can still operate without a store (no storefront, just business identity)

---

## 7. STOREFRONTS ARE BRANDING + FEATURES ONLY

Storefronts are a **presentation and billing layer.** They unlock at Store Starter+ subscription.

```
Storefront {
  id
  ownerId             // === userId (1:1, unique)
  
  // Identity
  slug                // unique URL slug: twicely.co/st/{slug}
  name                // Store display name
  
  // Branding
  bannerUrl           // 1200×300 banner image
  logoUrl             // 200×200 square logo
  accentColor         // From preset palette (12 colors)
  
  // Content
  announcement        // One-line announcement bar (optional)
  aboutHtml           // Rich text about section (2000 char limit)
  socialLinks         // { instagram, youtube, tiktok, etc. }
  
  // Features
  featuredListingIds  // Up to 6 pinned listings
  customCategories    // Seller-defined taxonomy (separate storefront_custom_category table in schema)
  
  // Vacation
  vacationMode        // boolean
  vacationMessage     // Custom message when on vacation
  
  // Status
  isPublished         // Draft vs live
  createdAt
  updatedAt
}
```

### Storefront Rules

- **Created when:** sellerType changes to BUSINESS (storefront record created, can be published when 3 gates met)
- **Deleted when:** Never (soft-disabled on downgrade to SELLER)
- **Custom pages (Puck):** Available at POWER+ only
- **Custom domain:** Available at ENTERPRISE only (future)

### Storefronts DO NOT:
- ❌ Own listings
- ❌ Own orders
- ❌ Receive payouts
- ❌ Have their own accounts

---

## 8. STAFF = DELEGATED ACCESS (NO OWNERSHIP)

Staff act **on behalf of** the owner. Staff are regular Users with a `DelegatedAccess` record.

```
DelegatedAccess {
  id
  ownerUserId          // The seller who grants access
  staffUserId          // The user who receives access
  
  // Permissions
  scopes               // Array of scope keys
  rolePreset           // MANAGER | FULFILLMENT | FINANCE | SUPPORT | READ_ONLY | CUSTOM
  
  // Status
  status               // PENDING | ACTIVE | REVOKED | EXPIRED
  invitedAt
  acceptedAt
  revokedAt
  expiresAt            // Optional expiry
  
  // Audit
  invitedByUserId      // Who sent the invitation (owner or manager)
}
```

### Delegation Scopes

| Scope Key | Grants Access To |
|-----------|-----------------|
| `dashboard.view` | Seller dashboard overview |
| `listings.view` | View listings |
| `listings.manage` | Create, edit, end listings |
| `orders.view` | View orders |
| `orders.manage` | Fulfill, cancel orders |
| `shipping.manage` | Create labels, mark shipped |
| `returns.respond` | Approve/reject returns |
| `messages.view` | Read conversations |
| `messages.send` | Reply to conversations |
| `finance.view` | View payouts, balance, ledger |
| `analytics.view` | View store analytics |
| `promotions.view` | View promotions |
| `promotions.manage` | Create/edit promotions |
| `settings.view` | View store settings |
| `settings.manage` | Edit store settings |
| `staff.manage` | Invite/revoke/edit other staff |

### Role Presets

| Preset | Scopes Included |
|--------|----------------|
| OWNER | All scopes (implicit, not stored as DelegatedAccess) |
| MANAGER | All except `staff.manage` |
| FULFILLMENT | `dashboard.view`, `orders.view`, `orders.manage`, `shipping.manage`, `messages.view`, `messages.send` |
| FINANCE | `dashboard.view`, `finance.view`, `orders.view`, `analytics.view` |
| SUPPORT | `dashboard.view`, `orders.view`, `returns.respond`, `messages.view`, `messages.send` |
| READ_ONLY | `dashboard.view`, `listings.view`, `orders.view`, `finance.view`, `analytics.view`, `messages.view`, `settings.view` |

### Staff Invariants

- Staff NEVER own resources
- Staff NEVER receive payouts
- Staff CANNOT grant scopes they don't have
- Staff CANNOT access data outside the delegating seller's scope
- Staff CANNOT modify owner identity, payout destination, or subscription tier
- All staff actions log: `{ actionByUserId, onBehalfOfUserId }`
- Staff count limited by subscription tier (see Section 4.1)

---

## 9. PLATFORM ROLES (SEPARATE CONTEXT)

Platform staff (Twicely employees) have roles completely separate from marketplace identity.

```
PlatformRole {
  id
  userId               // The employee's user account
  role                 // SUPPORT | ADMIN | SUPER_ADMIN
  grantedAt
  grantedByUserId      // Who granted this role
  revokedAt            // Null = active
}
```

| Role | Description | Can Also Buy/Sell? |
|------|-------------|-------------------|
| SUPPORT | Helpdesk agent, case management, read-only commerce data | Yes (separate context) |
| ADMIN | Full platform management, settings, moderation, user management | Yes (separate context) |
| SUPER_ADMIN | Everything + irreversible actions (delete user, wipe data, grant admin) | Yes (separate context) |

**Hard invariants:**
- Platform permissions NEVER leak into marketplace context
- Marketplace permissions NEVER leak into platform context
- A Twicely employee buying something uses their buyer identity, not their admin powers
- SUPER_ADMIN requires 2FA for all actions
- At least 1 SUPER_ADMIN must exist at all times

---

## 10. PERMISSION EVALUATION LOGIC

```
IF user owns resource → ALLOW
ELSE IF acting as staff AND permission granted → ALLOW
ELSE IF has platform role AND role permits → ALLOW
ELSE → DENY
```

No inheritance. No dual ownership. No ambiguity.

---

## 11. COMPLETE LIFECYCLE

```
1. Visitor arrives           → GUEST (anonymous, cookie session)
2. Signs up / logs in        → USER (authenticated, can buy immediately)
3. Imports from eBay (free)  → SELLER activated (isSeller=true, sellerType=PERSONAL)
                               Listings go ACTIVE on Twicely
4. Sells items on Twicely    → Pays progressive TF. Performance tracked.
5. Wants crosslister         → Subscribes to Lister Lite+ (no business upgrade needed)
6. Wants a store             → Prompted: "Business account required" (FREE)
7. Provides business info    → sellerType=BUSINESS, BusinessInfo created
8. Subscribes to store       → storeTier=STARTER+, Storefront created
9. Adds automation           → hasAutomation=true, auto-relist/offers active
10. Invites staff            → DelegatedAccess created for team members
11. Achieves TOP_RATED       → Gold badge, search boost (earned, not purchased)
```

### Valid Combinations (Store Subscription)

| sellerType | storeTier | Valid? | Description |
|------------|-----------|--------|-------------|
| PERSONAL | NONE | ✅ | Free seller, no store |
| PERSONAL | STARTER+ | ❌ | **NOT ALLOWED** — must upgrade to BUSINESS first |
| BUSINESS | NONE | ✅ | Business selling without store |
| BUSINESS | STARTER | ✅ | Business with entry-level store |
| BUSINESS | PRO | ✅ | Business with growing business store |
| BUSINESS | POWER | ✅ | Business with high-volume store |
| BUSINESS | ENTERPRISE | ✅ | Business with enterprise store |

### Valid Combinations (Crosslister Subscription)

| sellerType | listerTier | Valid? | Description |
|------------|-----------|--------|-------------|
| PERSONAL | Any tier | ✅ | **ALL tiers available** — no business requirement |
| BUSINESS | Any tier | ✅ | All tiers available |

### Product Independence

| Combination | Valid? | Example Seller |
|------------|--------|---------------|
| Store only, no Crosslister | ✅ | Twicely-only seller with storefront |
| Crosslister only, no Store | ✅ | Multi-platform seller, no Twicely storefront |
| Both Store + Crosslister | ✅ | Full-service seller (bundles available) |
| Neither Store nor Crosslister | ✅ | Casual seller, free tier only |
| Automation without Crosslister | ❌ | Automation requires Lister Lite+ |
| Automation with Crosslister | ✅ | Any Lister Lite+ subscriber |

At no point:
- Is a new account created
- Is ownership transferred
- Is identity split

---

## 12. CROSSLISTER INTEGRATION (LOCKED)

Crosslister is a core Twicely product for managing listings across external platforms (eBay, Poshmark, Mercari, Depop, etc.).

**Status:** Architecture locked. Pricing locked. See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` for full tier details.

**Integration with user model:**
- `listerTier` field on SellerProfile (NONE/FREE/LITE/PRO)
- `hasAutomation` boolean on SellerProfile for automation add-on
- Available to ALL sellers (PERSONAL or BUSINESS) — no gate
- External platform connections stored in `crosslister_accounts` per seller
- Import records tracked in `import_records` per (userId, platform) pair

**Ownership rules (unchanged):**
- Crosslisted listings are still owned by userId
- External sales sync back to Twicely orders
- All financial tracking flows through the Twicely ledger
- Crosslister does not change the user model — it extends selling capability

**Free import flywheel:**
- Every seller gets one free import per external marketplace
- Imported listings go ACTIVE on Twicely immediately
- Imports are exempt from insertion fees
- Re-import (new items since first import) requires Lister Lite+

See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` Section 3 for crosslister tiers and Section 11 for import rules.

---

## 13. DRIZZLE SCHEMA SKETCH (V3)

This is the canonical structure. Actual column types, indexes, and relations will be defined in `TWICELY_V3_SCHEMA.md`. This section establishes the shape.

```typescript
// === ENUMS ===

export const sellerTypeEnum = pgEnum('seller_type', ['PERSONAL', 'BUSINESS']);

// Store Subscription (Twicely storefront + tools)
export const storeTierEnum = pgEnum('store_tier', [
  'NONE',        // No store subscription — free seller
  'STARTER',     // $6.99/mo (annual) / $12.00/mo — basic storefront
  'PRO',         // $29.99/mo (annual) / $39.99/mo — growing business
  'POWER',       // $59.99/mo (annual) / $79.99/mo — high volume
  'ENTERPRISE',  // Custom — enterprise
]);

// Crosslister Subscription (multi-platform distribution)
export const listerTierEnum = pgEnum('lister_tier', [
  'NONE',        // No crosslister subscription
  'FREE',        // $0 — 25 publishes/mo, funnel tier
  'LITE',        // $9.99/mo (annual) / $13.99/mo — 200 publishes
  'PRO',         // $29.99/mo (annual) / $39.99/mo — 2,000 publishes, full sync
]);

export const performanceBandEnum = pgEnum('performance_band', [
  'EMERGING',      // New seller (< 10 orders) — no badge
  'ESTABLISHED',   // Meets baseline — no badge
  'TOP_RATED',     // Excellent metrics — gold badge
  'POWER_SELLER',  // Exceptional volume + quality — diamond badge
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING', 'PENDING'
]);

export const businessTypeEnum = pgEnum('business_type', [
  'SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP'
]);

export const platformRoleEnum = pgEnum('platform_role', [
  'SUPPORT', 'ADMIN', 'SUPER_ADMIN'
]);

export const delegationStatusEnum = pgEnum('delegation_status', [
  'PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'
]);

export const buyerQualityTierEnum = pgEnum('buyer_quality_tier', [
  'GREEN', 'YELLOW', 'RED'
]);

// Category buckets (retained from v2 for listing categorization — NOT used for TF calculation in v3.2.
// Progressive volume brackets replaced category-based rates. See Pricing Canonical v3.2 §2.)
export const feeBucketEnum = pgEnum('fee_bucket', [
  'ELECTRONICS',
  'APPAREL_ACCESSORIES',
  'HOME_GENERAL',
  'COLLECTIBLES_LUXURY',
]);

// === TABLES ===
// (Shapes only — full definitions in TWICELY_V3_SCHEMA.md)

// User table adapts to Better Auth requirements
// Better Auth manages: id, email, emailVerified, name, image, sessions, accounts
// We extend with marketplace fields

// users — Better Auth base + marketplace extensions
// seller_profiles — 1:1 with users (created on first listing)
// business_info — 1:1 with users (created on BUSINESS upgrade)
// store_subscriptions — 1:1 with seller_profiles (Store tier billing via Stripe)
// lister_subscriptions — 1:1 with seller_profiles (Crosslister tier billing via Stripe)
// storefronts — 1:1 with users (created at Store Starter+)
// delegated_access — many per seller (staff invitations)
// platform_roles — many per user (Twicely employee roles)
// seller_performance_snapshots — periodic computation of PerformanceBand
// crosslister_accounts — per seller per external platform (auth/session)
// crosslister_items — per listing per platform (channel projection)
// import_records — tracks one-time imports per marketplace per user
```

---

## 14. WHAT IS EXPLICITLY FORBIDDEN

❌ Separate buyer table  
❌ Separate seller table  
❌ Separate business account table  
❌ Business-owned listings  
❌ Store-owned listings  
❌ Staff-owned payouts  
❌ Account switching (one user = one identity)  
❌ Dual ownership  
❌ sellerProfileId as foreign key for ownership (use userId)  
❌ Conflating storeTier with performanceBand  
❌ Conflating storeTier with listerTier  
❌ Requiring Store subscription to use Crosslister  
❌ Requiring Crosslister subscription to use Store  
❌ Using `SellerTier` or `SubscriptionTier` as enum name (V2 names — ambiguous, replaced by `StoreTier` + `ListerTier`)  
❌ Hardcoding fee rates in code (must use effective-dated settings)  
❌ Allowing PERSONAL sellers to subscribe to store (STARTER+)  
❌ Gating crosslister behind BUSINESS status  
❌ Charging insertion fees on imported listings  
❌ Charging per-order fees on Twicely sales  
❌ Charging fees on off-platform sales  

---

## 15. IMPLEMENTATION NOTES FOR CLAUDE CODE

These are the specific things that went wrong in V2 implementation. Do not repeat them.

### 15.1 Ownership Checks
Every service function that touches a seller resource MUST verify `resource.sellerId === session.userId` (or delegation check). V2 had endpoints where this check was missing, allowing cross-seller data access.

### 15.2 Tier Gating
When checking "can this seller do X?", always specify WHICH axis you're checking:
- Storefront feature access? → Check `storeTier`
- Crosslister feature access? → Check `listerTier`
- Automation access? → Check `hasAutomation`
- Search ranking? → Check `performanceBand`
- Badge display? → Check `performanceBand`
- TF calculation? → Check seller's calendar-month GMV against progressive brackets (Pricing Canonical v3.2 §2). NOT per-tier or per-band.
- Publish limit? → Check `listerTier`
- Listing creation limit? → Check `storeTier`
- Staff access? → Check `storeTier` (Store staff) or `listerTier` (Lister team seats)

V2 had code that checked `sellerTier` (subscription) when it meant to check performance band, and vice versa. V3 has THREE purchased axes (storeTier, listerTier, hasAutomation) and one earned axis (performanceBand). Never confuse them.

### 15.3 Personal → Business Gate
The upgrade flow must be tested end-to-end:
1. PERSONAL seller clicks "Subscribe to Store"
2. System blocks and redirects to Business Upgrade form
3. User fills form → BusinessInfo created → sellerType = BUSINESS
4. User is redirected BACK to subscription selection
5. User subscribes → tier changes

V2 had the form but the redirect-back step was broken, leaving users stranded after business upgrade.

### 15.4 TypeScript Strict Mode
All of this must work with `strict: true` from day one. No `as any` casts on user/seller types. If the type system complains, the code is wrong — fix the code, not the types.

### 15.5 Audit Trail
Every ownership change, tier change, staff permission change, and business upgrade MUST emit an audit event. V2 had audit logging defined but not consistently wired. In V3, the service function should not return success unless the audit event was written.

---

## 16. REFERENCED BY

This document is referenced by:
- `TWICELY_V3_SCHEMA.md` (table definitions)
- `TWICELY_V3_PHASE_0_ACTORS_PERMISSIONS.md` (CASL abilities)
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` (domain rules)
- `TWICELY_V3_SECURITY_AUDIT_COMPLETE.md` (security gates)
- All vertical slice install prompts that touch user/seller/business logic

---

## 17. ENFORCEMENT RULE

Any code, migration, or feature that violates this document:
- Is considered a bug
- Must be reverted
- Requires an explicit version bump to change

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-15 | Initial V3 lock. Carries forward V2 v1.1 model with Drizzle schema sketch, Better Auth integration, explicit SubscriptionTier/PerformanceBand separation, crosslister TBD. |
| 1.1 | 2026-02-15 | **MAJOR:** Replaced single SubscriptionTier with three independent axes: StoreTier (storefront), ListerTier (crosslister), hasAutomation (add-on). Added PerformanceBand as fourth axis. Updated Drizzle enums, SellerProfile shape, valid combinations, forbidden list, implementation notes. References TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md for all pricing. |
| 1.2 | 2026-02-24 | **Pricing Canonical v3.2 alignment:** StoreTier simplified (removed BASIC/ELITE, added POWER). ListerTier simplified (removed PLUS/POWER/MAX/ENTERPRISE, kept FREE/LITE/PRO). PerformanceBand reworked (EMERGING/ESTABLISHED/TOP_RATED/POWER_SELLER replaces 5-band system). TF→TF terminology. References TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md. |
| 1.3 | 2026-02-25 | **Deep alignment pass:** Lister Pro AI Credits 150→200. TF discount references removed (progressive brackets, no tier/band discounts). DelegatedAccess PENDING status added. Schema sketch comments updated to v3.2 prices/limits. Storefront URL `/st/` prefix. customCategories separate table note. Stale doc name references fixed. |
