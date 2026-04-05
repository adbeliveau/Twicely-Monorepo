# TWICELY V3 — Page Registry
**Version:** v1.9
**Status:** LOCKED
**Date:** 2026-04-05
**Purpose:** Every route, every page, every role gate, every page state. This IS the sitemap. No page exists that isn't in this file.

**Governing documents:** Feature Lock-in §23 (URL structure), Actors & Security §5 (route protection), Platform Settings §17 (admin tabs), Helpdesk Canonical (helpdesk routes), Build Brief (phase mapping)

---

## CONVENTIONS

**Route syntax:** Next.js App Router. `[param]` = dynamic segment. `(group)` = route group (no URL impact).

**Role gates:** Who can access the page. Gates are enforced in middleware AND page-level checks.
- `PUBLIC` — no auth required
- `AUTH` — any authenticated user
- `SELLER` — authenticated + `isSeller === true`
- `BUSINESS_SELLER` — seller + `sellerType === 'BUSINESS'`
- `OWNER_ONLY` — seller owner (not delegated staff)
- `DELEGATE(scope)` — delegated staff with named scope
- `STAFF(role)` — platform staff with named role
- `ADMIN` — platform Admin or Super Admin

**Page states:** Every page must handle these states where applicable:
- `LOADING` — skeleton/spinner while data fetches
- `EMPTY` — no data yet (first-time user, no results)
- `POPULATED` — normal state with data
- `ERROR` — fetch failed, permission denied, or not found
- `FORBIDDEN` — authenticated but insufficient permissions (show upgrade CTA or access denied)

**Layout key:**
- `marketplace` — twicely.co public layout (header + footer + mobile bottom nav)
- `dashboard` — twicely.co authenticated layout (sidebar + header)
- `checkout` — minimal layout (logo + steps, no nav)
- `auth` — centered card layout
- `hub` — hub.twicely.co staff layout (sidebar + top bar)
- `helpdesk` — hub.twicely.co helpdesk layout (full-screen three-column)
- `storefront` — seller store layout (store header + nav)
- `policy` — simple layout (header + centered content)

---

## 1. PUBLIC PAGES (twicely.co)

No authentication required. Accessible to all visitors including guests.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 1 | `/` | Home \| Twicely | marketplace | PUBLIC | B1 | Featured listings, categories, trending, For You/Explore/Categories tabs |
| 1a | `/explore` | Explore \| Twicely | marketplace | PUBLIC | G3.9 | Discover new items: Trending Now, Staff Picks, Seasonal, Rising Sellers |
| 2 | `/s` | Search results for "{q}" \| Twicely | marketplace | PUBLIC | B1 | Typesense listings index, filters, sort |
| 2a | `/c` | Categories \| Twicely | marketplace | PUBLIC | B1 | All top-level categories grid |
| 3 | `/c/[slug]` | {Category Name} \| Twicely | marketplace | PUBLIC | B1 | Category tree, listings by category |
| 4 | `/c/[slug]/[subslug]` | {Subcategory} \| Twicely | marketplace | PUBLIC | B1 | Subcategory listings |
| 5 | `/i/[slug]` | {Listing Title} \| Twicely | marketplace | PUBLIC | B1 | listing, images, seller, offers, similar |
| 6 | `/st/[slug]` | {Store Name} \| Twicely Seller | storefront | PUBLIC | D1 | sellerProfile, listings, reviews |
| 7 | `/st/[slug]/about` | About {Store Name} \| Twicely | storefront | PUBLIC | D1 | Store description, policies, stats |
| 8 | `/st/[slug]/reviews` | {Store Name} Reviews \| Twicely | storefront | PUBLIC | D1 | reviews, averageRating |
| 9 | `/st/[slug]/c/[category]` | {Store} — {Category} \| Twicely | storefront | PUBLIC | D1 | Store category filtered listings |
| 9b | `/st/[slug]/p/[pageSlug]` | {Page Title} — {Store Name} \| Twicely | storefront | PUBLIC (Power+) | D1 | Custom Puck page for storefront |
| 10 | `/p/privacy` | Privacy Policy \| Twicely | policy | PUBLIC | G1 | Static/CMS content |
| 11 | `/p/terms` | Terms of Service \| Twicely | policy | PUBLIC | G1 | Static/CMS content |
| 12 | `/p/buyer-protection` | Buyer Protection \| Twicely | policy | PUBLIC | G1 | Static/CMS content |
| 13 | `/p/fees` | Selling Fees \| Twicely | policy | PUBLIC | G1 | feeSchedule data |
| 13a | `/p/cookies` | Cookie Policy \| Twicely | policy | PUBLIC | G8 | Cookie consent disclosure, opt-in/opt-out preferences |
| 13b | `/p/how-it-works` | How It Works \| Twicely | policy | PUBLIC | A | Static content |
| 13c | `/p/policies` | Policies \| Twicely | policy | PUBLIC | A | Static content |
| 13d | `/about` | About \| Twicely | marketplace | PUBLIC | A | Static content |
| 13e | `/p/[slug]` | {Influencer Name} \| Twicely | marketplace | PUBLIC | G3.2 | Influencer landing page with promo codes, profile data |
| 14 | `/h` | Help Center \| Twicely | marketplace | PUBLIC | E3 | kbCategories, featured articles |
| 15 | `/h/[category-slug]` | {KB Category} \| Help Center | marketplace | PUBLIC | E3 | kbArticles by category |
| 16 | `/h/[category-slug]/[article-slug]` | {Article Title} \| Help Center | marketplace | PUBLIC | E3 | kbArticle (audience-gated: ALL only for guests) |
| 16a | `/verify/[certNumber]` | Verify Certificate \| Twicely | marketplace | PUBLIC | D6 | Authentication certificate verification page |
| 16b | `/become-seller` | Become a Seller \| Twicely | marketplace | PUBLIC | G10.9 | 4-state CTA routing (guest/non-seller/PERSONAL/BUSINESS), TF bracket table, Store/Crosslister tier pricing |
| 16c | `/pricing` | Pricing — Twicely | marketing | PUBLIC | G10 | TF bracket tiers (10%/9%/8%), Store tier pricing toggle (monthly/annual), feature comparison table |

### 1.1 Public Page States

**Homepage (`/`)**
- LOADING: Skeleton grid (8 cards) + category pills skeleton
- POPULATED: Hero/banner, category grid, trending listings, recently listed, featured stores
- ERROR: "Something went wrong" with retry button

**Search (`/s`)**
- LOADING: Filter sidebar skeleton + listing grid skeleton
- EMPTY: "No results for '{q}'" + suggested searches + browse categories CTA
- POPULATED: Result count, filter sidebar, listing grid, pagination
- ERROR: "Search unavailable" with browse categories fallback

**Listing Detail (`/i/[slug]`)**
- LOADING: Image gallery skeleton + details skeleton
- POPULATED: Image gallery, title, price, condition, description, seller card, similar items, "Ask seller" CTA
- ERROR (404): "This listing doesn't exist or has been removed"
- ERROR (ENDED/SOLD): "This item is no longer available" + similar items

**Store (`/st/[slug]`)**
- LOADING: Store banner skeleton + listing grid skeleton
- POPULATED: Banner, logo, store name, stats bar, category tabs, listing grid
- ERROR (404): "This store doesn't exist"
- FORBIDDEN (vacation): Store vacation banner + vacation message, listings hidden

---

## 2. AUTH PAGES (twicely.co)

Authentication flow pages. Redirect to `/my` if already authenticated.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 17 | `/auth/login` | Log In \| Twicely | auth | PUBLIC (redirect if auth) | A3 | — |
| 18 | `/auth/signup` | Sign Up \| Twicely | auth | PUBLIC (redirect if auth) | A3 | — |
| 19 | `/auth/forgot-password` | Reset Password \| Twicely | auth | PUBLIC | A3 | — |
| 20 | `/auth/reset-password` | New Password \| Twicely | auth | PUBLIC (token-gated) | A3 | verification token |
| 21 | `/auth/verify-email` | Verify Email \| Twicely | auth | PUBLIC (token-gated) | A3 | verification token |
| 22 | `/auth/onboarding` | Welcome to Twicely | auth | AUTH | G1 | — |

### 2.1 Auth Page States

**Login**
- DEFAULT: Email + password form, "Sign up" link, "Forgot password?" link, social OAuth buttons
- ERROR: Invalid credentials message (generic — don't reveal if email exists)
- LOCKED: "Too many attempts. Try again in {minutes} minutes."

**Signup**
- DEFAULT: Name, email, password form + terms checkbox
- ERROR: Validation errors (email taken, password too weak)
- SUCCESS: Redirect to verify-email interstitial

---

## 3. BUYER PAGES (twicely.co/my/buying)

Authenticated users. These pages show the buying side of the marketplace.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 23 | `/my` | Dashboard \| Twicely | dashboard | AUTH | B1 | Customizable widgets (orders, watchlist, listings, messages) |
| 24 | `/my/buying` | Buying Overview \| Twicely | dashboard | AUTH | B4 | Recent orders, active offers, watchlist summary |
| 25 | `/my/buying/orders` | My Purchases \| Twicely | dashboard | AUTH | B4 | orders (as buyer), paginated, filterable by status |
| 26 | `/my/buying/orders/[id]` | Order {orderNumber} \| Twicely | dashboard | AUTH + own order | B4 | order, orderItems, shipment, tracking, seller info |
| 27 | `/my/buying/orders/[id]/return` | Request Return \| Twicely | dashboard | AUTH + own order + within window | C4 | order, return reason form, evidence upload |
| 28 | `/my/buying/orders/[id]/dispute` | Open Dispute \| Twicely | dashboard | AUTH + own order + eligible | C4 | order, returnRequest (if exists), dispute form |
| 29 | `/my/buying/orders/[id]/review` | Leave Review \| Twicely | dashboard | AUTH + own order + completed | C1 | order, review form (1-5 stars, 4 dimensions, photos) |
| 29a | `/my/returns/[id]` | Return Detail \| Twicely | dashboard | AUTH + own return | C4 | Return status, timeline, evidence, messages |
| 29b | `/my/disputes/[id]` | Dispute Detail \| Twicely | dashboard | AUTH + own dispute | C4 | Dispute status, evidence, resolution |
| 30 | `/my/buying/watchlist` | Watchlist \| Twicely | dashboard | AUTH | B1 | watchlistItems + listings, price drop indicators |
| 31 | `/my/buying/offers` | My Offers \| Twicely | dashboard | AUTH | C2 | listingOffers (as buyer), status filters |
| 32 | `/my/buying/reviews` | My Reviews \| Twicely | dashboard | AUTH | C1 | reviews (as reviewer), edit/delete options |
| 33 | `/my/buying/searches` | Saved Searches \| Twicely | dashboard | AUTH | B1 | savedSearches, toggle notifications |
| 34 | `/my/buying/following` | Following \| Twicely | dashboard | AUTH | D1 | follows + seller cards, new listings badge |
| 34a | `/my/buying/alerts` | Price Alerts \| Twicely | dashboard | AUTH | G3.6 | Price alert rules, triggered notifications |
| 34b | `/my/buying/history` | Browsing History \| Twicely | dashboard | AUTH | G3.8 | Recently viewed items, history-based recommendations |
| 35 | `/my/feed` | For You — Feed \| Twicely | dashboard | AUTH | G3.8 | Personalized feed: followed sellers + watchlist + saved searches + recommendations |

### 3.1 Cart & Checkout

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 36 | `/cart` | Cart \| Twicely | marketplace | AUTH | B3 | cart, cartItems, availability checks |
| 37 | `/checkout` | Checkout \| Twicely | checkout | AUTH + cart not empty | B3 | cart, addresses, shipping options, Stripe Elements |
| 38 | `/checkout/confirmation/[orderId]` | Order Confirmed \| Twicely | checkout | AUTH + own order | B3 | order summary, estimated delivery |

### 3.2 Buyer Page States

**My Purchases (`/my/buying/orders`)**
- LOADING: Table skeleton (5 rows)
- EMPTY: "You haven't bought anything yet" + browse CTA
- POPULATED: Order table (order #, item thumbnail, date, status badge, total), filters (All/Active/Completed/Returned), pagination
- ERROR: Retry button

**Order Detail (`/my/buying/orders/[id]`)**
- LOADING: Order summary skeleton + timeline skeleton
- POPULATED: Order header (status badge, date), item list, shipping tracker (progress bar), payment summary, seller info, action buttons (Return/Dispute/Review based on state)
- ERROR (404): "Order not found"
- FORBIDDEN: "You don't have access to this order"

**Cart (`/cart`)**
- LOADING: Cart skeleton
- EMPTY: "Your cart is empty" + continue shopping CTA
- POPULATED: Items grouped by seller, quantity controls, remove button, subtotal, "Checkout" CTA
- STALE: Items with `isAvailable: false` shown with unavailable badge and reason

**Checkout (`/checkout`)**
- Step 1: Shipping address (saved addresses + add new)
- Step 2: Shipping method per seller group
- Step 3: Payment (Stripe Elements) + order summary
- ERROR: Payment failed — show error, keep on payment step
- PROCESSING: "Processing your order..." spinner (no back button)

---

## 4. SELLER PAGES (twicely.co/my/selling)

Requires authenticated user with `isSeller === true`. Non-sellers see an "Enable selling" CTA.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 39 | `/my/selling` | Selling Overview \| Twicely | dashboard | SELLER | B2 | Summary stats (revenue, orders, active listings), quick actions |
| 40 | `/my/selling/listings` | My Listings \| Twicely | dashboard | SELLER or DELEGATE(listings.view) | B2 | listings (owned), filterable by status, batch actions |
| 41 | `/my/selling/listings/new` | Create Listing \| Twicely | dashboard | SELLER or DELEGATE(listings.manage) | B2 | Category picker, listing form, image upload |
| 42 | `/my/selling/listings/[id]/edit` | Edit Listing \| Twicely | dashboard | SELLER (own) or DELEGATE(listings.manage) | B2 | listing + images, edit form |
| 43 | `/my/selling/listings/bulk` | Bulk Upload \| Twicely | dashboard | SELLER or DELEGATE(listings.manage) | B2 | CSV upload, validation preview, batch create |
| 44 | `/my/selling/orders` | Seller Orders \| Twicely | dashboard | SELLER or DELEGATE(orders.view) | B4 | orders (as seller), status filters, "Awaiting Shipment" priority view |
| 45 | `/my/selling/orders/[id]` | Order {orderNumber} \| Twicely | dashboard | SELLER (own) or DELEGATE(orders.view) | B4 | order detail, buyer info, ship action, print label |
| 46 | `/my/selling/orders/[id]/ship` | Ship Order \| Twicely | dashboard | SELLER (own) or DELEGATE(orders.manage) | B4 | Shippo label purchase or manual tracking entry |
| 46a | `/my/selling/orders/[id]/review` | Review Buyer \| Twicely | dashboard | SELLER (own) or DELEGATE(orders.manage) | C1 | Seller reviews buyer after completed order |
| 47 | `/my/selling/offers` | Incoming Offers \| Twicely | dashboard | SELLER or DELEGATE(orders.view) | C2 | listingOffers (as seller), accept/decline/counter |
| 48 | `/my/selling/returns` | Return Requests \| Twicely | dashboard | SELLER or DELEGATE(returns.respond) | C4 | returnRequests (as seller), respond actions |
| 49 | `/my/selling/returns/[id]` | Return {id} \| Twicely | dashboard | SELLER (own) or DELEGATE(returns.respond) | C4 | Return detail, approve/decline/partial, evidence |
| 50 | `/my/selling/analytics` | Analytics \| Twicely | dashboard | SELLER or DELEGATE(analytics.view) | D4 | Charts: revenue, views, conversion, top items |
| 51 | `/my/selling/finances` | Finances \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | C3 | sellerBalance, recent transactions, payout status |
| 52 | `/my/selling/finances/transactions` | Transactions \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | C3 | ledgerEntries (own), filterable, CSV export |
| 53 | `/my/selling/finances/payouts` | Payouts \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | C3 | payouts (own), request payout button |
| 54 | `/my/selling/finances/statements` | Statements \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | C3 | Monthly/annual statements, PDF/CSV download |
| 55 | `/my/selling/finances/platforms` | Platform Revenue \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | F4 | Cross-platform revenue comparison |
| 56 | `/my/selling/finances/expenses` | Expenses \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | D4.1 | Expense entry form, category breakdown, list with filtering |
| 56b | `/my/selling/finances/mileage` | Mileage Tracking \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | D4.2 | Mileage entry form, distance calculation, category allocation, list with filtering |
| 56c | `/my/selling/finances/reports` | Financial Reports \| Twicely | dashboard | SELLER or DELEGATE(finances.view) | D4 | P&L, tax prep, exportable reports |
| 56d | `/my/selling/finances/settings` | Finance Settings \| Twicely | dashboard | SELLER or DELEGATE(finances.manage) | D4 | Payout preferences, tax settings, accounting integrations |
| 57 | `/my/selling/crosslist` | Crosslister \| Twicely | dashboard | SELLER or DELEGATE(crosslister.read) | F1 | Connected accounts, publish counts, job status |
| 58 | `/my/selling/crosslist/connect` | Connect Platform \| Twicely | dashboard | SELLER or DELEGATE(crosslister.manage) | F1 | Platform picker, OAuth flow |
| 59 | `/my/selling/crosslist/import` | Import Listings \| Twicely | dashboard | SELLER or DELEGATE(crosslister.import) | F1 | Import progress, real-time via Centrifugo |
| 60 | `/my/selling/crosslist/import/issues` | Import Issues \| Twicely | dashboard | SELLER or DELEGATE(crosslister.import) | F1 | Failed import records with fix instructions |
| 61 | `/my/selling/crosslist/automation` | Automation \| Twicely | dashboard | SELLER or DELEGATE(crosslister.manage) | F5 | automationSetting form (auto-relist, offers, price drops, sharing) |
| 62 | `/my/selling/store` | Store Settings \| Twicely | dashboard | BUSINESS_SELLER or DELEGATE(settings.manage) | D1 | Store name, slug, description, logo, banner, return policy |
| 63 | `/my/selling/store/editor` | Store Page Editor \| Twicely | dashboard | BUSINESS_SELLER (Power+) or DELEGATE(settings.manage) | D1 | Puck page builder for custom storefront pages |
| 63b | `/my/selling/store/editor/[pageId]` | Edit Page \| Twicely | dashboard | BUSINESS_SELLER (Power+) or DELEGATE(settings.manage) | D1 | Puck editor for individual custom storefront page |
| 64 | `/my/selling/promotions` | Promotions \| Twicely | dashboard | SELLER or DELEGATE(promotions.view) | D2 | promotions list, create/edit/end |
| 65 | `/my/selling/promotions/new` | Create Promotion \| Twicely | dashboard | SELLER or DELEGATE(promotions.manage) | D2 | Promotion form (type, scope, discount, dates) |
| 66 | `/my/selling/promotions/[id]` | Edit Promotion \| Twicely | dashboard | SELLER (own) or DELEGATE(promotions.manage) | D2 | Promotion edit form |
| 67 | `/my/selling/promoted` | Promoted Listings \| Twicely | dashboard | SELLER or DELEGATE(promotions.manage) | D2 | promotedListings, performance stats, boost controls |
| 68 | `/my/selling/staff` | Staff Management \| Twicely | dashboard | OWNER_ONLY | D5 | delegatedAccess list, invite, revoke, edit scopes |
| 69 | `/my/selling/staff/invite` | Invite Staff \| Twicely | dashboard | OWNER_ONLY | D5 | Invite form: email, scopes checklist |
| 70 | `/my/selling/subscription` | Subscription \| Twicely | dashboard | OWNER_ONLY | D3 | Current tiers (Store + Lister + Automation), upgrade/downgrade, billing |
| 71 | `/my/selling/shipping` | Shipping Profiles \| Twicely | dashboard | SELLER or DELEGATE(shipping.manage) | B4 | shippingProfiles, create/edit/delete |
| 72 | `/my/selling/onboarding` | Seller Setup \| Twicely | dashboard | AUTH (becoming seller) | G1 | Step-by-step: profile → payment → first listing |
| 73 | `/my/selling/verification` | Verification \| Twicely | dashboard | OWNER_ONLY | G6 | Stripe Identity integration, KYC status, government ID verification |
| 73a | `/my/selling/performance` | Performance \| Twicely | dashboard | SELLER or DELEGATE(analytics.view) | G4.1 | Performance band status, cancel/return/dispute rates, band appeal form |
| 73b | `/my/selling/tax` | Tax Information \| Twicely | dashboard | SELLER or DELEGATE(finances.manage) | G5 | SSN/EIN storage with encryption, tax form history, 1099-K/1099-NEC document download |
| 73c | `/my/selling/affiliate` | Affiliate Program \| Twicely | dashboard | SELLER | G1.4 | Affiliate overview, promo code, referral stats summary |
| 73d | `/my/selling/affiliate/referrals` | Referrals \| Twicely | dashboard | SELLER | G1.4 | Referral list, per-referral status, conversion tracking |
| 73e | `/my/selling/affiliate/payouts` | Affiliate Payouts \| Twicely | dashboard | SELLER | G1.4 | Commission history, payout status, pending earnings |
| 73f | `/my/selling/authentication` | Authentication \| Twicely | dashboard | SELLER | D6 | AI/expert authentication requests, pending/completed history, cert numbers |
| 73g | `/my/selling/finances/integrations` | Accounting Integrations \| Twicely | dashboard | SELLER or DELEGATE(finances.manage) | D4 | QuickBooks/Xero connection, sync status, OAuth flow |
| 73h | `/my/selling/settings/local` | Local Pickup Settings \| Twicely | dashboard | SELLER or DELEGATE(settings.manage) | E3 | Max meetup distance (miles), platform radius defaults |

### 4.1 Seller Page States

**My Listings (`/my/selling/listings`)**
- LOADING: Table skeleton
- EMPTY: "You don't have any listings yet" + "Create your first listing" CTA + "Import from another platform" CTA
- POPULATED: Listing table (thumbnail, title, price, status, views, watchers, date), batch action toolbar (pause, end, boost, delete), status tabs (All/Active/Draft/Paused/Sold/Ended)
- FORBIDDEN (non-seller): "Start selling on Twicely" + enable selling CTA

**Create Listing (`/my/selling/listings/new`)**
- Step 1: Category selection (search + tree browse)
- Step 2: Photos (drag & drop, reorder, crop, background remove at tier threshold)
- Step 3: Item details (title, description, condition, brand, attributes per category)
- Step 4: Pricing (price, original price, COGS, allow offers + auto-accept/decline thresholds)
- Step 5: Shipping (profile or manual, dimensions, free shipping toggle)
- Step 6: Review & publish
- AUTO-SAVE: Draft saved every 30 seconds
- ERROR: Validation errors shown inline per field

**Seller Orders (`/my/selling/orders`)**
- LOADING: Table skeleton
- EMPTY: "No orders yet — share your listings to get sales"
- POPULATED: Orders table with priority: "Awaiting Shipment" (orange badge, ship-by countdown), "In Transit", "Delivered", "Completed". Quick-ship button in row.
- LATE WARNING: Orders past handling time shown with red "LATE" badge

**Crosslister (`/my/selling/crosslist`)**
- LOADING: Connection cards skeleton
- EMPTY (no tier): "Manage your listings across platforms" + tier comparison + subscribe CTA
- EMPTY (has tier, no connections): "Connect your first platform" + platform picker
- POPULATED: Connected platform cards (status badge, listing count, last sync), "Import" button per platform, publish meter (used/limit), job queue status
- ERROR (auth expired): Platform card shows "Reauthentication required" + reconnect button

---

## 5. ACCOUNT SETTINGS (twicely.co/my/settings)

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 74 | `/my/settings` | Account Settings \| Twicely | dashboard | AUTH | A3 | User profile form |
| 75 | `/my/settings/addresses` | Addresses \| Twicely | dashboard | AUTH | B3 | addresses list, add/edit/delete, set default |
| 76 | `/my/settings/security` | Security \| Twicely | dashboard | AUTH | A3 | Change password, 2FA setup, active sessions |
| 77 | `/my/settings/notifications` | Notifications \| Twicely | dashboard | AUTH | E1 | notificationPreferences grid (template × channel) |
| 78 | `/my/settings/payments` | Payment Methods \| Twicely | dashboard | AUTH | G10.10 | Saved Stripe payment methods: list cards, add via SetupIntent, remove, set default |
| 79 | `/my/settings/privacy` | Privacy \| Twicely | dashboard | AUTH | G6 | Data export request, account deletion request |

---

## 6. MESSAGING (twicely.co/my/messages)

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 79 | `/my/messages` | Messages \| Twicely | dashboard | AUTH | E2 | conversations list, unread badges |
| 80 | `/my/messages/[conversationId]` | {Subject} — Message \| Twicely | dashboard | AUTH + own conversation | E2 | conversation + messages, real-time via Centrifugo |

> **Note:** `/m` and `/m/:id` are permanent redirects to the canonical paths above (configured in `next.config.ts`).

### 6.1 Messaging Page States

**Inbox (`/my/messages`)**
- LOADING: Conversation list skeleton
- EMPTY: "No messages yet. Start a conversation from any listing page."
- POPULATED: Conversation list (avatar, name, last message preview, timestamp, unread dot), listing thumbnail per conversation

**Conversation (`/m/[conversationId]`)**
- LOADING: Message thread skeleton
- POPULATED: Message bubbles (sender aligned left/right), listing card at top, compose area at bottom, attachment support
- READ-ONLY: "This conversation is closed" (listing ended, user blocked)

---

## 7. USER SUPPORT (twicely.co/my/support)

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 81 | `/my/support` | My Support Cases \| Twicely | dashboard | AUTH | E3 | helpdeskCases (as requester), status filters |
| 82 | `/my/support/[caseId]` | Case {caseNumber} \| Twicely | dashboard | AUTH + own case | E3 | case messages + events (non-internal only), reply form |
| 83 | `/h/contact` | Contact Support \| Twicely | marketplace | AUTH | E3 | New case form: type, subject, description, attachments, optional order/listing link |

---

## 8. HUB — PLATFORM ADMIN (hub.twicely.co)

All hub pages require platform staff authentication. Hub uses its own auth flow (staffUser + staffSession).

### 8.1 Hub Auth

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 84 | `/login` | Hub Login \| Twicely | auth | PUBLIC (staff login) | A3 | Staff email + password + MFA |

### 8.2 Hub Dashboard

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 85 | `/d` | Dashboard \| Twicely Hub | hub | STAFF(any) | E3 ✅ | KPI cards (orders today, revenue, open cases, active listings), charts |

### 8.3 User Management

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 86 | `/usr` | Users \| Twicely Hub | hub | STAFF(ADMIN, SUPPORT) | E3 ✅ | User table (name, email, type, status, joined), search + filters |
| 87 | `/usr/[id]` | User Detail \| Twicely Hub | hub | STAFF(ADMIN, SUPPORT) | E3 ✅ | Full user profile, orders, listings, cases, balance, actions toolbar |
| 87a | `/usr/affiliates` | Influencers \| Twicely Hub | hub | STAFF(ADMIN) | G3.1 | Influencer applications list, status filters, approve/reject/suspend actions |
| 87b | `/usr/affiliates/[id]` | Influencer Detail \| Twicely Hub | hub | STAFF(ADMIN) | G3.1 | Influencer profile, application status, approve/reject/suspend/unsuspend/ban actions |
| 87c | `/usr/[id]/edit` | Edit User \| Twicely Hub | hub | STAFF(ADMIN) | E3 | Admin user edit form (name, email, status, roles) |
| 87d | `/usr/new` | Create User \| Twicely Hub | hub | STAFF(ADMIN) | E3 | Create new user account, sends password-reset email |
| 87e | `/usr/sellers` | Sellers \| Twicely Hub | hub | STAFF(ADMIN, SUPPORT) | E3 | Seller list filterable by tier/band/status, links to user detail |
| 87f | `/usr/sellers/verification` | Verification Queue \| Twicely Hub | hub | STAFF(ADMIN) | G6 | Sellers pending KYC/identity verification or enforcement review |

**User Detail Tabs:**
- Overview: account info, seller status, trust scores, subscription tiers
- Orders: purchase + sale history
- Listings: all listings with status
- Cases: support cases filed
- Finance: seller balance, payout history, ledger entries
- Activity: recent actions (login, listing created, order placed)
- Notes: internal staff notes (not visible to user)

**User Detail Actions:**
- Suspend / Unsuspend
- Warn (send warning notification)
- Restrict selling / buying
- Hold payouts
- Reset password
- View as user (read-only dashboard preview)

### 8.4 Transactions

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 88 | `/tx` | Transactions \| Twicely Hub | hub | STAFF(ADMIN, SUPPORT, FINANCE) | E3 ✅ | Overview: order volume, payment volume, refund rate |
| 89 | `/tx/orders` | All Orders \| Twicely Hub | hub | STAFF(ADMIN, SUPPORT, FINANCE) | E3 ✅ | Order table, search by order #, buyer, seller, status filter |
| 90 | `/tx/orders/[id]` | Order {orderNumber} \| Hub | hub | STAFF(ADMIN, SUPPORT, FINANCE) | E3 ✅ | Full order detail: items, payment, shipping, returns, disputes, ledger entries, timeline |
| 91 | `/tx/payments` | Payments \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | Payment intents, capture status, refund history |

**Order Detail Actions (admin):**
- Issue refund (full or partial)
- Cancel order (with reason — audited)
- Override status (with reason — audited, 2FA for critical overrides)
- Add internal note
- Escalate to helpdesk case
- View buyer / View seller (links to user detail)

### 8.5 Finance

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 92 | `/fin` | Finance \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | Revenue dashboard: GMV, fees collected, payouts sent, platform take rate |
| 93 | `/fin/ledger` | Ledger \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | Ledger explorer: all entries, filterable by type/seller/order/date |
| 94 | `/fin/payouts` | Payouts \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | Payout batches, individual payouts, trigger manual batch (2FA) |
| 95 | `/fin/recon` | Reconciliation \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | reconciliationReports, discrepancy viewer, trigger manual recon |
| 96 | `/fin/adjustments` | Adjustments \| Twicely Hub | hub | ADMIN | E3 ✅ | manualAdjustments, create new (2FA required) |
| 97 | `/fin/costs` | Platform Costs \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 ✅ | Absorbed costs: platform-paid return shipping, goodwill credits |
| 97b | `/fin/promo-codes` | Promo Code Management \| Twicely Hub | hub | STAFF(ADMIN) | G1.5 ✅ | Platform + affiliate promo codes, create/edit/deactivate |
| 97c | `/fin/affiliate-payouts` | Affiliate Payouts \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | G3.4 ✅ | Affiliate payout batches, monthly commission details, payout status, performance metrics, reversal audit trail |
| 97d | `/fin/tax` | Tax Compliance \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | G5 ✅ | 1099-K/1099-NEC document generation status, threshold tracking, seller tax compliance dashboard, TaxJar integration status |
| 97e | `/fin/chargebacks` | Chargebacks \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 | Stripe dispute ledger entries, stats (30d), filter by status/date |
| 97f | `/fin/chargebacks/[id]` | Chargeback Detail \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 | Dispute ledger entries, timeline, linked order/seller, reversal status |
| 97g | `/fin/holds` | Reserve Holds \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 | Active escrow holds and releases, filter active/released/all |
| 97h | `/fin/payouts/[id]` | Payout Detail \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | E3 | Payout info, seller, batch, Stripe correlation, related ledger entries |
| 97i | `/fin/subscriptions` | Subscriptions \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | D3 | Subscription metrics by axis (Store/Lister/Finance/Automation), recent changes |

### 8.6 Moderation

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 98 | `/mod` | Moderation \| Twicely Hub | hub | STAFF(ADMIN, MODERATION) | E3 ✅ | Queue overview: flagged listings, reported messages, review flags |
| 99 | `/mod/listings` | Flagged Listings \| Hub | hub | STAFF(ADMIN, MODERATION) | E3 ✅ | Flagged/reported listings with report details, action: remove/clear/warn |
| 100 | `/mod/messages` | Flagged Messages \| Hub | hub | STAFF(ADMIN, MODERATION) | E3 ✅ | Flagged conversations, message context, action: warn/block |
| 101 | `/mod/reviews` | Flagged Reviews \| Hub | hub | STAFF(ADMIN, MODERATION) | E3 ✅ | Flagged reviews with reason, action: remove/approve |
| 101a | `/mod/collections` | Curated Collections \| Hub | hub | STAFF(ADMIN, MODERATION) | G3.10 ✅ | List of curated collections for Explore page, search/filter by status |
| 101b | `/mod/collections/new` | New Collection \| Hub | hub | STAFF(ADMIN, MODERATION) | G3.10 ✅ | Create curated collection form (name, description, visible toggle, items selector) |
| 101c | `/mod/collections/[id]` | Edit Collection \| Hub | hub | STAFF(ADMIN, MODERATION) | G3.10 ✅ | Edit curated collection (name, description, visibility), manage items (add/remove/reorder), delete action |
| 101d | `/mod/reports` | Content Reports \| Hub | hub | STAFF(ADMIN, MODERATION) | G4 ✅ | Content report queue, search/filter by type/status, report details with severity, flag/dismiss actions |
| 101e | `/mod/reports/[id]` | Report {id} \| Hub | hub | STAFF(ADMIN, MODERATION) | G4 ✅ | Report detail page, full context (photo/description/message), claim for review, resolve/dismiss actions |
| 101f | `/mod/enforcement` | Enforcement Actions \| Hub | hub | STAFF(ADMIN, MODERATION) | G4 ✅ | Active enforcement actions (warnings, removals, suspensions, bans), search by user/reason, status filters |
| 101g | `/mod/enforcement/[id]` | Enforcement {id} \| Hub | hub | STAFF(ADMIN, MODERATION) | G4 ✅ | Enforcement action detail, reason/evidence/duration, appeal review (if enabled), status update actions |
| 101h | `/mod/enforcement/new` | New Enforcement Action \| Hub | hub | STAFF(ADMIN, MODERATION) | G4 ✅ | Create enforcement action form (user search, action type, reason, duration, escalation notes) |
| 101i | `/mod/disputes/[id]` | Dispute Detail \| Hub | hub | STAFF(ADMIN, SUPPORT) | C4 | Dispute claim type, buyer/seller, evidence photos, resolution form, linked return request |
| 101j | `/mod/disputes/rules` | Dispute Resolution Rules \| Hub | hub | STAFF(ADMIN) | C4 | Claim windows, seller response hours, auto-approve settings, chargeback fee config |
| 101k | `/mod/listings/[id]` | Listing Detail \| Hub | hub | STAFF(ADMIN, MODERATION) | B2 | Listing images/details, enforcement state, seller context, moderation actions |
| 101l | `/mod/listings/pending` | Listings Pending Review \| Hub | hub | STAFF(ADMIN, MODERATION) | B2 | Flagged listings with no content report, awaiting first review |
| 101m | `/mod/listings/suppressed` | Suppressed Listings \| Hub | hub | STAFF(ADMIN, MODERATION) | B2 | Listings hidden from search but not deleted, unsuppress action |
| 101n | `/mod/queue` | Moderation Queue \| Hub | hub | STAFF(ADMIN, MODERATION) | E3 | Unified prioritised queue: flagged listings + reports + flagged reviews, stats |
| 101o | `/mod/reviews/[id]` | Review Detail \| Hub | hub | STAFF(ADMIN, MODERATION) | C1 | Review content, DSR scores, seller response, report history, approve/remove actions |

### 8.7 Helpdesk (hub.twicely.co/hd)

Reference: Helpdesk Canonical. Full-screen app, separate from main hub layout.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 102 | `/hd` | Helpdesk \| Twicely Hub | helpdesk | STAFF(HELPDESK_AGENT+) | E3 | Case queue: list view with saved view tabs |
| 102a | `/hd/cases` | All Cases \| Hub | helpdesk | STAFF(HELPDESK_AGENT+) | G9 | Full case list with filtering, sorting, bulk actions |
| 102b | `/hd/resolved` | Resolved Cases \| Hub | helpdesk | STAFF(HELPDESK_AGENT+) | G9 | Resolved/closed case archive with filters and retention info |
| 103 | `/hd/cases/[id]` | Case {caseNumber} \| Hub | helpdesk | STAFF(HELPDESK_AGENT+) | E3 | Three-column: properties / conversation / context |
| 104 | `/hd/views` | Saved Views \| Hub | helpdesk | STAFF(HELPDESK_AGENT+) | E3 | Manage saved views (personal + shared) |
| 105 | `/hd/macros` | Macros \| Hub | helpdesk | STAFF(HELPDESK_LEAD+) | E3 | Macro library: create/edit/delete, usage stats |
| 106 | `/hd/teams` | Teams \| Hub | helpdesk | STAFF(HELPDESK_MANAGER) | E3 | helpdeskTeams + members, availability, case limits |
| 107 | `/hd/routing` | Routing Rules \| Hub | helpdesk | STAFF(HELPDESK_MANAGER) | E3 | helpdeskRoutingRules, drag-to-reorder, condition builder |
| 108 | `/hd/sla` | SLA Policies \| Hub | helpdesk | STAFF(HELPDESK_MANAGER) | E3 | helpdeskSlaPolicies per priority, business hours config |
| 109 | `/hd/automation` | Automation \| Hub | helpdesk | STAFF(HELPDESK_MANAGER) | E3 | helpdeskAutomationRules, trigger/condition/action builder |
| 110 | `/hd/reports` | Reports \| Hub | helpdesk | STAFF(HELPDESK_LEAD+) | E3 | Dashboards: volume, SLA compliance, agent performance, CSAT |
| 111 | `/hd/settings` | Helpdesk Settings \| Hub | helpdesk | STAFF(HELPDESK_MANAGER) + ADMIN | E3 | Business hours, auto-close, CSAT, email config, case templates |

**Helpdesk Case Detail (`/hd/cases/[id]`) — Three-Column Layout:**

Left column (case properties):
- Status dropdown, priority dropdown, type, channel
- Assigned agent + team dropdowns
- SLA countdown timer (color-coded: green → yellow → red)
- Tags (add/remove)
- Commerce links (order, listing, seller — clickable)

Center column (conversation thread):
- Messages + events interleaved chronologically
- Compose area: Reply / Internal Note / Macro tabs
- Collision detection: "Sarah is also viewing" / "Sarah is typing a reply"
- KB article insertion button

Right column (context panel):
- Auto-loads based on commerce links
- Requester card (name, email, order count, case history)
- Order details (if linked)
- Listing details (if linked)
- Seller performance (if seller-related)
- Return/dispute data (if linked)
- Related cases
- Suggested KB articles

### 8.8 Knowledge Base Admin (hub.twicely.co/kb)

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 112 | `/kb` | Knowledge Base \| Hub | hub | STAFF(HELPDESK_LEAD+, ADMIN) | E3 | Article list: title, category, status, audience, views, helpful%, updated |
| 113 | `/kb/new` | New Article \| Hub | hub | STAFF(HELPDESK_LEAD+, ADMIN) | E3 | TBD editor + sidebar (category, audience, tags, SEO) |
| 114 | `/kb/[id]/edit` | Edit Article \| Hub | hub | STAFF(HELPDESK_LEAD+, ADMIN) | E3 | Article editor with version history |
| 115 | `/kb/categories` | KB Categories \| Hub | hub | STAFF(HELPDESK_MANAGER, ADMIN) | E3 | Category tree management, drag-to-reorder |

### 8.9 Admin Configuration (hub.twicely.co/cfg)

Reference: Platform Settings Canonical §17.

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 116 | `/cfg` | Settings \| Twicely Hub | hub | ADMIN | E3 ✅ | Tab-based settings UI |
| 116c1 | `/cfg/stripe` | Stripe Configuration \| Twicely Hub | hub | ADMIN | G10.13 ✅ | Module status, test/live API keys, webhook signing secrets, payment settings, Stripe Connect config, test connection |
| 116c2 | `/cfg/ebay` | eBay Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth config, capabilities, connected accounts, webhook config, test connection |
| 116c3 | `/cfg/etsy` | Etsy Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth config, capabilities, connected accounts, webhook config, test connection |
| 116c4 | `/cfg/mercari` | Mercari Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth/session config, capabilities, connected accounts, test connection |
| 116c5 | `/cfg/poshmark` | Poshmark Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | Session config, capabilities, connected accounts, test connection |
| 116c6 | `/cfg/depop` | Depop Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth/session config, capabilities, connected accounts, test connection |
| 116c7 | `/cfg/grailed` | Grailed Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth/session config, capabilities, connected accounts, test connection |
| 116c8 | `/cfg/fb-marketplace` | Facebook Marketplace Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth config, capabilities, connected accounts, test connection |
| 116c9 | `/cfg/therealreal` | The RealReal Connector \| Twicely Hub | hub | ADMIN | G10.13 ✅ | OAuth/API config, capabilities, connected accounts, test connection |
| 116c10 | `/cfg/integrations` | Third-Party Integrations \| Twicely Hub | hub | ADMIN | G10.13 ✅ | Dependency status dashboard, version checks, update availability |
| 116m | `/cfg/monetization` | Monetization \| Twicely Hub | hub | ADMIN | G1.4 | TF bracket schedule, payout settings, subscription pricing config |
| 116n | `/cfg/data-retention/anonymize` | Anonymization Queue \| Twicely Hub | hub | ADMIN | G6 | Users pending data deletion/anonymization, pending/processed counts |
| 116o | `/cfg/data-retention/exports` | Data Export Requests \| Twicely Hub | hub | ADMIN | G6 | GDPR data portability requests, SLA monitoring, status table |
| 116p | `/cfg/environment` | Environment Settings \| Twicely Hub | hub | ADMIN | A1 | API keys, secrets, environment-related platform settings by category |
| 116q | `/cfg/infrastructure` | Infrastructure \| Twicely Hub | hub | ADMIN | A1 | Valkey/Typesense/Centrifugo connection settings, restart-required notice |
| 116r | `/cfg/jobs` | Jobs & Scheduler \| Twicely Hub | hub | ADMIN | A1 | Cron job schedules (orders, returns, shipping, health, vacation, score recalc), scheduler tick interval |
| 116s | `/cfg/meetup-locations` | Safe Meetup Locations \| Twicely Hub | hub | ADMIN | E3 | Create/manage safe meetup locations for local sales, filter by type/city/state |
| 116t | `/cfg/messaging/keywords` | Banned Keywords \| Twicely Hub | hub | ADMIN | E2 | Auto-flagging/blocking keyword management for messaging |
| 116u | `/cfg/modules` | Modules \| Twicely Hub | hub | ADMIN | E3 | Enable/disable platform modules, module stats (total/enabled/disabled) |
| 116v | `/cfg/platform` | Platform Config \| Twicely Hub | hub | ADMIN | E3 | All platform settings organized by category in tabs |
| 116w | `/cfg/providers` | Providers \| Twicely Hub | hub | ADMIN | E3 | Provider health overview, quick links to adapters/instances/mappings/health logs |
| 116x | `/cfg/providers/adapters` | Provider Adapters \| Twicely Hub | hub | ADMIN | E3 | Registered service adapters by service type, create instance action |
| 116y | `/cfg/providers/health` | Health Logs \| Twicely Hub | hub | ADMIN | E3 | Provider health check history, latency, error messages |
| 116z | `/cfg/providers/instances` | Provider Instances \| Twicely Hub | hub | ADMIN | E3 | Active provider instances, health status, configure links |
| 116z1 | `/cfg/providers/instances/[id]` | Configure Instance \| Twicely Hub | hub | ADMIN | E3 | Instance config form, secret masks, health card |
| 116z2 | `/cfg/providers/instances/new` | New Instance \| Twicely Hub | hub | ADMIN | E3 | Create new provider instance from selected adapter |
| 116z3 | `/cfg/providers/mappings` | Usage Mappings \| Twicely Hub | hub | ADMIN | E3 | Service routing: primary + fallback provider instance per usage key |
| 116z4 | `/cfg/providers/mappings/new` | New Usage Mapping \| Twicely Hub | hub | ADMIN | E3 | Create usage mapping: usage key, primary/fallback instances, auto-failover |
| 116z5 | `/cfg/shippo` | Shippo Settings \| Twicely Hub | hub | ADMIN | B4 | Shippo API key, fulfillment settings, webhook config |
| 116z6 | `/cfg/trust` | Trust & Safety Settings \| Twicely Hub | hub | ADMIN | C1 | Review moderation toggle, seller response toggle |
| 116z7 | `/cfg/vestiaire` | Vestiaire Collective Settings \| Twicely Hub | hub | ADMIN | F1 | Session config, capabilities, crosslister settings for Vestiaire Collective |

**Settings Tabs (query param `?tab=`):**

| # | Tab Key | Tab Label | Gate | Build Phase | Key Data |
|---|---------|-----------|------|-------------|----------|
| 116a | `environment` | Environment | ADMIN | A1 | environmentSecrets (encrypted API keys) |
| 116b | `integrations` | Integrations | STAFF(ADMIN, SRE) | E4 | Provider adapters, instances, usage mappings, health |
| 116c | `fees` | Fees & Pricing | ADMIN | D3 ✅ | feeSchedules, insertion fees, boost rates, tier pricing |
| 116d | `commerce` | Commerce | ADMIN | B3 ✅ | Auto-complete window, cart expiry, offer defaults |
| 116e | `fulfillment` | Fulfillment | ADMIN | B4 ✅ | Handling time, carriers, label settings |
| 116f | `trust` | Trust & Quality | ADMIN | C1 ✅ | Trust score weights, band thresholds, new seller caps |
| 116g | `discovery` | Discovery | ADMIN | B1 ✅ | Featured categories, trending weights, search tuning |
| 116h | `comms` | Communications | ADMIN | E1 ✅ | Email templates, notification defaults, digest settings |
| 116i | `payments` | Payments | ADMIN | C3 ✅ | Payout schedule, hold periods, minimum payout |
| 116j | `privacy` | Privacy | ADMIN | G6 | Retention periods, GDPR settings |
| 116k | `meetup-locations` | Safe Meetup Locations | ADMIN | E3 ✅ | Create/edit safe meetup locations for local sales |

### 8.10 Other Hub Pages

| # | Path | Title | Layout | Gate | Build Phase | Key Data |
|---|------|-------|--------|------|-------------|----------|
| 117 | `/roles` | Staff Roles \| Hub | hub | ADMIN | A4 | staffUserRoles, create/revoke roles |
| 118 | `/roles/staff/[id]` | Staff Detail \| Hub | hub | ADMIN | A4 | Staff user detail, roles, activity |
| 119 | `/audit` | Audit Log \| Hub | hub | STAFF(any) | E4 | auditEvents, filterable by actor/action/subject/severity/date |
| 120 | `/health` | System Health \| Hub | hub | STAFF(ADMIN, DEVELOPER, SRE) | E4 | Service health checks, queue depths, error rates |
| 121 | `/health/doctor` | Doctor Checks \| Hub | hub | STAFF(ADMIN, DEVELOPER, SRE) | E4 | Per-module health verification (DB, Typesense, Valkey, Centrifugo, Stripe, Shippo) |
| 122 | `/flags` | Feature Flags \| Hub | hub | STAFF(ADMIN, DEVELOPER) | E4 | featureFlags, toggle, percentage, targeting |
| 123 | `/categories` | Categories \| Hub | hub | ADMIN | B1 ✅ | Category tree, add/edit/reorder, attribute schemas |
| 124 | `/notifications` | Notifications \| Hub | hub | ADMIN | E1 ✅ | notificationTemplates, channel defaults |
| 125 | `/subscriptions` | Subscriptions \| Hub | hub | ADMIN | D3 ✅ | StoreTier + ListerTier pricing, active subscriber counts |
| 126 | `/analytics` | Platform Analytics \| Hub | hub | STAFF(ADMIN, FINANCE) | D4 | GMV, take rate, user growth, cohort retention |
| 127 | `/listings` | Listing Admin \| Hub | hub | STAFF(ADMIN, MODERATION) | B2 ✅ | All listings, search, bulk actions (remove, flag) |
| 128 | `/mod/disputes` | Disputes \| Hub | hub | STAFF(ADMIN, SUPPORT) | C4 ✅ | disputes queue, resolve actions |
| 129 | `/mod/returns` | Returns \| Hub | hub | STAFF(ADMIN, SUPPORT) | C4 ✅ | returnRequests queue, admin override actions |
| 130 | `/cfg/data-retention` | Data Retention \| Hub | hub | ADMIN | G6 | Retention policies, scheduled purges, GDPR request queue |
| 131 | `/admin-messages` | Admin Messages \| Twicely Hub | hub | STAFF(ADMIN) | E1 | Broadcast messages across the platform, manage broadcast.* settings |
| 132 | `/analytics/sellers` | Seller Analytics \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | D4 | Seller GMV, orders, cancel rate, return rate, rating by seller; filter by band/tier |
| 133 | `/bulk` | Bulk Operations \| Twicely Hub | hub | STAFF(ADMIN, MODERATION) | E3 | Batch status changes across multiple listings or users |
| 134 | `/categories/[id]` | Category Detail \| Twicely Hub | hub | STAFF(ADMIN, MODERATION) | B1 | Category info, subcategories, attribute schemas, edit form |
| 135 | `/categories/catalog` | Catalog Browser \| Twicely Hub | hub | STAFF(ADMIN, MODERATION) | B1 | All categories table filterable by status/feeBucket/depth/search |
| 136 | `/categories/new` | New Category \| Twicely Hub | hub | STAFF(ADMIN) | B1 | Create root or subcategory form |
| 137 | `/currency` | Currency \| Twicely Hub | hub | STAFF(ADMIN) | E3 | Platform currency configuration (currently USD only, multi-currency roadmap) |
| 138 | `/delegated-access` | Delegated Access \| Twicely Hub | hub | STAFF(ADMIN) | D5 | Platform-wide staff delegation oversight, KPIs, all delegations table |
| 139 | `/errors` | Error Log \| Twicely Hub | hub | STAFF(any) | E4 | High/critical severity audit events, filter by severity/subject |
| 140 | `/exports` | Data Exports \| Twicely Hub | hub | STAFF(ADMIN) | G6 | GDPR data export requests, SLA monitoring, status table |
| 141 | `/flags/[id]` | Feature Flag Detail \| Twicely Hub | hub | STAFF(ADMIN, DEVELOPER) | E4 | Flag metadata (key/type/rollout%), audit history |
| 142 | `/health/[id]` | Provider Instance Detail \| Twicely Hub | hub | STAFF(ADMIN, DEVELOPER, SRE) | E4 | Instance health details, health check history (last 50) |
| 143 | `/imports` | Import Batches \| Twicely Hub | hub | STAFF(ADMIN, MODERATION) | F1 | Crosslister import batches, stats, health metrics (avg completion, success rate) |
| 144 | `/maintenance` | Maintenance \| Twicely | minimal | PUBLIC | A | Static maintenance page shown during downtime |
| 145 | `/notifications/[id]` | Edit Template \| Twicely Hub | hub | STAFF(ADMIN) | E1 | Edit notification template (channels, subject, body, HTML, category) |
| 146 | `/notifications/new` | New Template \| Twicely Hub | hub | STAFF(ADMIN) | E1 | Create new notification template |
| 147 | `/operations` | Platform Operations \| Twicely Hub | hub | STAFF(ADMIN, DEVELOPER, SRE) | E4 | Live platform health summary: providers, kill switches, critical events 24h, enabled flags |
| 148 | `/policies` | Policy Versions \| Twicely Hub | hub | STAFF(ADMIN) | G1 | View current versions and effective dates for ToS/Privacy/Seller Agreement/Refund policies |
| 149 | `/promotions` | Promotions \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | D2 | Seller promotions + platform/affiliate promo codes, overview stats, tabbed view |
| 150 | `/promotions/[id]` | Promotion Detail \| Twicely Hub | hub | STAFF(ADMIN, FINANCE) | D2 | Promotion or promo code detail, activate/deactivate actions |
| 151 | `/promotions/new` | Create Promo Code \| Twicely Hub | hub | STAFF(ADMIN) | D2 | Create new platform promo code form |
| 152 | `/risk` | Risk Signals \| Twicely Hub | hub | STAFF(ADMIN, MODERATION, SUPPORT) | C4 | Fraud detection KPIs, fraud pattern reference, risk signal table |
| 153 | `/roles/custom/[id]` | Edit Role \| Twicely Hub | hub | STAFF(ADMIN) | A4 | Custom role edit form, permission toggle grid, staff list |
| 154 | `/roles/custom/new` | Create Role \| Twicely Hub | hub | STAFF(ADMIN) | A4 | Create new custom role (SUPER_ADMIN only) |
| 155 | `/roles/staff` | Employees \| Twicely Hub | hub | STAFF(ADMIN) | A4 | Staff user list with roles, avatar, invite/manage actions |
| 156 | `/roles/staff/new` | Add Staff \| Twicely Hub | hub | STAFF(ADMIN) | A4 | Create new staff user with system roles |
| 157 | `/roles/system/[code]` | Role Details \| Twicely Hub | hub | STAFF(ADMIN) | A4 | System role permission grid (read-only), all permission pairs |
| 158 | `/search-admin` | Search Admin \| Twicely Hub | hub | STAFF(ADMIN, DEVELOPER) | E4 | Typesense collection status, rebuild index action |
| 159 | `/security` | Security Events \| Twicely Hub | hub | STAFF(ADMIN, SRE) | E4 | Security event KPIs, event log (failed logins, session revocations, 2FA changes, payout dest changes) |
| 160 | `/shipping-admin` | Shipping Admin \| Twicely Hub | hub | STAFF(ADMIN) | B4 | Platform shipping settings (handling days, carriers, label settings) |
| 161 | `/taxes` | Tax Rules \| Twicely Hub | hub | STAFF(ADMIN) | G5 | Platform tax configuration and rules |
| 162 | `/translations` | Translations \| Twicely Hub | hub | STAFF(ADMIN) | G1 | i18n platform settings (i18n.* prefix), locale/currency/timezone config |
| 163 | `/trust` | Trust & Safety \| Twicely Hub | hub | STAFF(ADMIN, MODERATION, SUPPORT) | C1 | Trust overview KPIs (band distribution, score stats), recent band transitions |
| 164 | `/trust/sellers` | Sellers \| Trust & Safety \| Hub | hub | STAFF(ADMIN, MODERATION, SUPPORT) | C1 | Seller trust list filterable by band, links to trust profile |
| 165 | `/trust/sellers/[id]` | Seller Trust Profile \| Hub | hub | STAFF(ADMIN, MODERATION, SUPPORT) | C1 | Trust score history, band override form, revoke override action |
| 166 | `/trust/settings` | Trust Score Configuration \| Hub | hub | STAFF(ADMIN) | C1 | Band thresholds, event weights, decay config, volume caps |

---

## 9. API ROUTES — Browser Extension & Platform APIs

| # | Path | Method | Purpose | Build Phase | Notes |
|---|------|--------|---------|-------------|-------|
| A1 | `/api/extension/authorize` | GET | Browser extension registration token generation | H1.1 ✅ | Generates registration token, redirects to callback URL |
| A2 | `/api/extension/callback` | GET | HTML page passing token to extension | H1.1 ✅ | Receives token in query param, passes via postMessage to extension |
| A3 | `/api/extension/register` | POST | Exchange registration token for 30-day session token | H1.1 ✅ | Token→session token, jose JWT library, 30-day TTL |
| A4 | `/api/extension/heartbeat` | POST | Extension health check | H1.1 ✅ | No payload, returns 200 if service is healthy |
| A5 | `/api/extension/session` | POST | Receive Tier C session data from extension | H1.1 ✅ | Extension sends session state to server for sync |
| A6 | `/api/extension/detect` | POST | Log platform detection events from extension | H1.1 ✅ | Extension logs when user visits supported platforms (eBay, Posh, etc.) |
| A7 | `/api/extension/scrape` | POST | Scrape listing data from Poshmark & FB Marketplace | H1.2 ✅ | JWT auth, platform dispatcher routes to handler, Valkey 1-hour TTL cache |
| C1 | `/api/crosslister/whatnot/callback` | GET | Whatnot OAuth callback receiver | H2.1 ✅ | Tier B OAuth: code→access/refresh token exchange, state verification, user session linkage |
| C2 | `/cfg/whatnot` | Hub Page | Whatnot Connector Configuration | H2.1 ✅ | OAuth config, capabilities, connected accounts, test connection, platform settings |
| C3 | `/api/crosslister/whatnot/webhook` | POST | Whatnot sale event webhook receiver | H2.3 ✅ | HMAC signature verification, sale handler service, revenue ledger entries, emergency delist on inventory drop |
| C4 | `/api/crosslister/shopify/callback` | GET | Shopify OAuth callback receiver | H3.1 ✅ | Tier B OAuth: code→access token exchange, state verification, scope confirmation, user session linkage |
| C5 | `/cfg/shopify` | Hub Page | Shopify Connector Configuration | H3.1 ✅ | OAuth config, capabilities, connected accounts, scope selection UI, test connection, platform settings |

---

## 10. PAGE INVENTORY

### 10.1 By Domain

| Domain | Pages | Route Prefix |
|--------|-------|-------------|
| Public / Browse | 17 | `/`, `/explore`, `/s`, `/c`, `/i`, `/st`, `/p`, `/h` |
| Auth | 6 | `/auth/*` |
| Buyer | 16 | `/my/buying/*`, `/my/feed`, `/cart`, `/checkout` |
| Seller | 39 | `/my/selling/*` |
| Account Settings | 5 | `/my/settings/*` |
| Messaging | 2 | `/m/*` |
| User Support | 3 | `/my/support/*`, `/h/contact` |
| Maintenance | 1 | `/maintenance` |
| Hub Dashboard | 1 | `/d` |
| Hub Users | 8 | `/usr/*` |
| Hub Transactions | 4 | `/tx/*` |
| Hub Finance | 12 | `/fin/*` |
| Hub Moderation | 18 | `/mod/*` |
| Hub Helpdesk | 10 | `/hd/*` |
| Hub KB Admin | 4 | `/kb/*` |
| Hub Config | 33 (+11 tabs) | `/cfg/*` (all cfg sub-pages including providers, data-retention, messaging, etc.) |
| Hub Other | 36 | `/roles`, `/audit`, `/health`, `/flags`, `/trust`, `/analytics`, `/promotions`, `/risk`, `/security`, `/operations`, etc. |
| **Total** | **~219 pages** | |

### 10.2 By Build Phase

| Phase | Pages | Description |
|-------|-------|-------------|
| A (Foundation) | ~11 | Auth pages, hub login, CASL setup, staff roles, environment/infra settings |
| B (Core Marketplace) | ~30 | Browse, search, listing CRUD, cart, checkout, orders, shipping profiles, categories, mod listing detail |
| C (Trust & Monetization) | ~18 | Reviews, offers, Stripe Connect, returns, disputes, seller finances, trust, risk |
| D (Seller Tools) | ~21 | Storefront, promotions, boosting, subscriptions, analytics, delegation, accounting integrations |
| E (Platform Infra) | ~60 | Messaging, notifications, full hub admin, helpdesk, KB, audit, health, config, providers, moderation queue, bulk ops |
| F (Crosslister) | ~9 | Connect, import, crosslist, automation, platform revenue, imports, vestiaire |
| G (Polish & Launch) | ~20 | Onboarding, verification, policies, privacy, data retention, accessibility, GDPR exports, translations, currency |

---

## 11. MOBILE NAVIGATION

Reference: Feature Lock-in §18.

### 11.1 Bottom Tab Bar (mobile, < 768px)

| Tab | Icon | Route | Badge |
|-----|------|-------|-------|
| Home | 🏠 | `/` | — |
| Search | 🔍 | `/s` | — |
| Sell | ➕ | `/my/selling/listings/new` | — |
| Messages | 💬 | `/m` | Unread count |
| My | 👤 | `/my` | — |

### 11.2 Dashboard Sidebar (desktop, ≥ 768px)

**Buying section:**
- Overview → `/my/buying`
- Orders → `/my/buying/orders`
- Watchlist → `/my/buying/watchlist`
- Offers → `/my/buying/offers`
- Reviews → `/my/buying/reviews`
- Saved Searches → `/my/buying/searches`
- Following → `/my/buying/following`
- Feed → `/my/feed`

**Selling section (visible only if isSeller):**
- Overview → `/my/selling`
- Listings → `/my/selling/listings`
- Orders → `/my/selling/orders`
- Offers → `/my/selling/offers`
- Returns → `/my/selling/returns`
- Analytics → `/my/selling/analytics`
- Finances → `/my/selling/finances`
  - Sub: Transactions → `/my/selling/finances/transactions`
  - Sub: Payouts → `/my/selling/finances/payouts`
  - Sub: Statements → `/my/selling/finances/statements`
  - Sub: Expenses → `/my/selling/finances/expenses`
  - Sub: Mileage → `/my/selling/finances/mileage`
- Crosslister → `/my/selling/crosslist`
- Store → `/my/selling/store`
- Promotions → `/my/selling/promotions`
- Staff → `/my/selling/staff`

**Account section:**
- Settings → `/my/settings`
- Security → `/my/settings/security`
- Messages → `/m`
- Support → `/my/support`
- Subscription → `/my/selling/subscription`

### 11.3 Hub Sidebar

- Dashboard → `/d`
- Users → `/usr`
- Transactions → `/tx`
- Finance → `/fin`
- Moderation → `/mod`
- Helpdesk → `/hd` (opens helpdesk layout)
- Knowledge Base → `/kb`
- Listings → `/listings`
- Disputes → `/mod/disputes`
- Returns → `/mod/returns`
- Analytics → `/analytics`
- Subscriptions → `/subscriptions`
- Categories → `/categories`
- Notifications → `/notifications`
- Feature Flags → `/flags`
- Settings → `/cfg`
- Roles → `/roles`
- Audit Log → `/audit`
- System Health → `/health`
- Data Retention → `/cfg/data-retention`

---

## 12. SEO & META

Reference: Feature Lock-in §17.

### 12.1 Title Patterns

| Page Type | Pattern |
|-----------|---------|
| Homepage | `Twicely — Buy & Sell Secondhand` |
| Search | `Search results for "{q}" \| Twicely` |
| Category | `{Category Name} \| Twicely` |
| Listing | `{Listing Title} — ${price} \| Twicely` |
| Store | `{Store Name} \| Twicely Seller` |
| Help | `{Article Title} \| Twicely Help Center` |
| Dashboard pages | `{Page Title} \| Twicely` (noindex) |
| Hub pages | `{Page Title} \| Twicely Hub` (noindex, nofollow) |

### 12.2 Indexing Rules

| Page Type | Indexable | Canonical |
|-----------|-----------|-----------|
| Homepage | ✅ | `https://twicely.co/` |
| Category | ✅ | `https://twicely.co/c/{slug}` |
| Listing (ACTIVE) | ✅ | `https://twicely.co/i/{slug}` |
| Listing (SOLD/ENDED) | ❌ noindex | — |
| Store | ✅ | `https://twicely.co/st/{slug}` |
| Search results | ❌ noindex | — |
| KB articles (PUBLISHED, ALL) | ✅ | `https://twicely.co/h/{category}/{slug}` |
| All `/my/*` pages | ❌ noindex | — |
| All hub pages | ❌ noindex, nofollow | — |
| Auth pages | ❌ noindex | — |

### 11.3 Structured Data (JSON-LD)

| Page | Schema Type |
|------|-------------|
| Homepage | `WebSite` with `SearchAction` |
| Listing | `Product` (name, description, image, price, availability, condition, seller, reviews) |
| Store | `Organization` |
| All pages with breadcrumbs | `BreadcrumbList` |
| KB articles | `Article` |

### 11.4 robots.txt

```
User-agent: *
Allow: /
Disallow: /my/
Disallow: /auth/
Disallow: /api/
Disallow: /m/
Disallow: /cart
Disallow: /checkout
```

hub.twicely.co/robots.txt:
```
User-agent: *
Disallow: /
```

### 11.5 Sitemap

Dynamic XML sitemap generated by cron (daily):
- `sitemap-categories.xml` — all active categories
- `sitemap-listings.xml` — all ACTIVE listings (paginated, 50k per file)
- `sitemap-stores.xml` — all seller storefronts
- `sitemap-help.xml` — all published KB articles
- `sitemap-index.xml` — sitemap of sitemaps

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 2.3 | 2026-03-19 | H3.1: Shopify OAuth + Scope Selection UI. Added 2 new routes: GET /api/crosslister/shopify/callback (Tier B OAuth code→token exchange, state verification, scope confirmation) and /cfg/shopify (hub connector config page). Total API routes: 10 (was 8). Total pages: ~152 (was ~151). |
| 2.2 | 2026-03-19 | H2.1: Whatnot OAuth Connector. Added 2 new routes: GET /api/crosslister/whatnot/callback (Tier B OAuth code→token exchange, state verification) and /cfg/whatnot (hub connector config page). Total API routes: 8 (was 7). Total pages: ~151 (no change). |
| 2.1 | 2026-03-19 | H1.2: Poshmark + FB Marketplace Content Scripts. Added new API route: POST /api/extension/scrape (JWT auth, platform dispatcher, Valkey 1-hour TTL cache). Total API routes: 7 (was 6). Total pages: ~150 (no change). |
| 2.0 | 2026-03-18 | H1.1: Browser Extension Scaffold + Registration. New section 9 (API Routes) added with 6 routes (/api/extension/authorize, /api/extension/callback, /api/extension/register, /api/extension/heartbeat, /api/extension/session, /api/extension/detect). Section numbers updated: "10. MOBILE NAVIGATION" → "11", "11. SEO & META" → "12". Total pages: ~150 (142 + ~8 in Phase H). |
| 1.9 | 2026-03-15 | G9: Helpdesk + Knowledge Base complete. All routes already documented (established in E3). Hub helpdesk: 10 routes (/hd, /hd/cases/[id], /hd/views, /hd/macros, /hd/teams, /hd/routing, /hd/sla, /hd/automation, /hd/reports, /hd/settings). Hub KB admin: 4 routes (/kb, /kb/new, /kb/[id]/edit, /kb/categories). Public KB: 3 routes (/h, /h/[category-slug], /h/[category-slug]/[article-slug]). User support: 3 routes (/my/support, /my/support/[caseId], /h/contact). Total pages: ~142 (no change). |
| 1.8 | 2026-03-15 | G8: Added `/p/cookies` route (Cookie Policy page with consent disclosure, opt-in/opt-out preferences). Total public pages: 18 (17 → 18), total pages: ~142 (141 → 142). |
| 1.7 | 2026-03-15 | G6: Updated `/my/selling/verification` phase from G4 → G6 (now includes Stripe Identity integration, KYC status, government ID verification). Routes already present: `/my/settings/privacy` (data export/deletion requests) and `/data-retention` (admin hub). No route additions needed. |
| 1.6 | 2026-03-14 | G5: Added `/my/selling/tax` (seller tax information page) and `/fin/tax` (admin tax compliance hub). Updated seller pages count (36, no change), updated hub finance count (6 → 7), updated total pages (~140 → ~141). |
| 1.5 | 2026-03-14 | G4.1: Added `/my/selling/performance` route (performance band status, metrics, appeal form). Updated seller pages count (35 → 36), updated total pages (~139 → ~140). |
| 1.4 | 2026-03-14 | G4: Added `/mod/reports` (list), `/mod/reports/[id]` (detail), `/mod/enforcement` (list), `/mod/enforcement/[id]` (detail), `/mod/enforcement/new` (create) routes for enforcement & moderation infrastructure. Updated Hub Moderation count (7 → 10), updated total pages (~134 → ~139). |
| 1.3 | 2026-03-14 | G3.10: Added `/mod/collections` (list), `/mod/collections/new` (create), `/mod/collections/[id]` (edit) routes for curated collection management. Updated Hub Moderation count (4 → 7), updated total pages (~131 → ~134). |
| 1.2 | 2026-03-14 | G3.9: Added `/explore` route (Explore/Discovery page). Updated public domain count (16 → 17), updated total pages (~130 → ~131). |
| 1.1 | 2026-03-14 | G3.8: Added `/my/feed` route (personalized feed). Updated all row numbers accordingly (16 → 35 buyer page, 15 → 16 buyer domains, ~128 → ~130 pages total). |
| 1.0 | 2026-02-15 | Initial registry. 128 pages, 16 domains, 7 build phases, mobile nav, SEO rules. |

---

**Vocabulary: StoreTier (storefront subscription), ListerTier (crosslister subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**

**END OF PAGE REGISTRY — TWICELY_V3_PAGE_REGISTRY.md**
