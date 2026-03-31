# TWICELY V3 — Feature Lock-In: All Domains
**Version:** v2.0  
**Status:** LOCKED — all 46 domains complete, vocabulary updated for dual-subscription model  
**Date:** 2026-02-15  
**Scope:** 46 feature domains locked through architect-founder discussion. Crosslister, Helpdesk, and Knowledge Base have their own dedicated canonicals. This file covers all other domains.

> **Pricing/Fee Authority:** For ALL pricing, tiers, fees, and monetization details, defer to `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md`. This document covers feature behavior, not pricing numbers.

---

## 1. Offer System (Prepaid Offers)

### Core Rules
- Offers are prepaid. Buyer's card is **authorized** (hold) when offer is submitted. No charge until seller accepts.
- If seller accepts → capture immediately. Money moves.
- If seller declines → hold released. Buyer notified.
- If offer expires → hold released automatically.
- If buyer cancels (any time before seller responds) → hold released.
- First to act wins. Seller accepts before buyer cancels = captured. Buyer cancels before seller responds = released.

### Offer Timing
- Default expiry: **48 hours** (platform-configurable in admin settings).
- Seller can set per-listing expiry: 24, 48, or 72 hours.
- No minimum wait before buyer can cancel — buyer can cancel any time before acceptance.

### Offer Types
- **Best Offer** — buyer proposes a price on any offer-enabled listing.
- **Counter Offer** — seller counters with a different price. Buyer has same expiry window to accept/decline/counter back. Max 3 rounds of countering, then final accept/decline.
- **Auto-Accept Threshold** — seller sets a minimum they'll accept. Offers at or above auto-accept instantly. Configurable per listing.
- **Auto-Decline Threshold** — seller sets a floor. Offers below auto-decline instantly with a polite message. Configurable per listing.
- **Offer to Watchers** — seller broadcasts a private discounted price to all users watching the listing. Each watcher gets a notification with a "Buy Now at $X" button. Offer valid for 24 hours.
- **Bundle Offer** — buyer selects multiple items from same seller, proposes a bundle price. Seller accepts/declines/counters the bundle.

### Offers Don't Block Selling
- A listing with pending offers remains live and purchasable at full price.
- If another buyer purchases at full price while an offer is pending, all pending offers on that listing are auto-declined and holds released.
- Cart reservation is soft — does NOT prevent offers or purchases by others.

### Seller Can Edit Listing With Active Offers
- Seller can edit title, description, photos, shipping at any time.
- Price edit or condition edit on a listing with active offers → all offer-makers notified: "The seller has updated this listing. Review changes and confirm or cancel your offer."
- Offer-maker has 24 hours to confirm or cancel after notification. No response = offer stands as-is.

### Offer Visibility
- Listing page shows: "X offers received" (count only, not amounts — amounts are private between buyer and seller).
- Watcher count shown: "X people watching this item" (exact count).
- Together these create competitive urgency: "14 watching · 3 offers" pushes buyers to act.

### Data Model Additions
- `Offer` model: listingId, buyerId, sellerId, amountCents, status (PENDING/ACCEPTED/DECLINED/EXPIRED/CANCELLED/COUNTERED), paymentIntentId (Stripe auth hold), expiresAt, parentOfferId (for counter chains), type (BEST_OFFER/COUNTER/WATCHER_OFFER/BUNDLE)
- `OfferSettings` on Listing: offersEnabled, autoAcceptCents, autoDeclineCents, offerExpiryHours
- `WatcherOffer` model: listingId, sellerId, discountedPriceCents, expiresAt, watchers notified count

---

## 2. Promotions & Coupons

### Seller-Created Promotions
- **Seller Coupons**: fixed amount ($10 off) or percentage (15% off). Configurable: minimum order value, expiry date, usage limit (total uses or per-buyer), single use or multi-use.
- **Coupon Codes**: shareable alphanumeric codes for social media marketing. Seller creates code, shares link, buyer enters at checkout. Format: SELLER-CODE (e.g., VINTAGE-SPRING20).
- **Store-Wide Sales**: seller puts entire store on X% off. Visual "SALE" badge on all listings. Configurable start/end date.
- **Volume Discounts**: "Buy 2+ items from this seller, get 10% off." Configurable per seller: threshold count and discount percentage.
- **Flash Sales**: time-limited deals on specific listings with countdown timer visible on listing page. Seller sets: discounted price, start time, end time. Timer shows "2h 14m remaining." When timer hits zero, price reverts automatically. **Beta feature.**
- **Offer to Watchers**: (covered in Offers section above — cross-references here).

### Stacking Rules
- Only ONE coupon code per checkout.
- Volume discount + coupon code CAN stack (they're different mechanisms).
- Store-wide sale + coupon code CAN stack.
- Flash sale price + coupon code CANNOT stack (flash sale IS the discount).
- Promoted listing boost is separate from all discounts (it's an ad spend, not a price reduction).

### Admin Controls
- Platform admin can create platform-wide coupons (e.g., "WELCOME10" for new buyers — 10% off first purchase).
- Admin can disable any seller's promotions if abusive.
- All promotion usage tracked for analytics.

### Fee Handling
- Twicely fees calculated on the **final sale price after discounts**. If item is $100 and seller gives 20% coupon, Twicely fee is on $80. Seller chose to discount — the fee structure shouldn't punish them further.
- Exception: seller-initiated partial refunds post-sale → Twicely keeps original fees (locked decision from earlier discussion).

---

## 3. Cart & Multi-Seller Checkout

### Cart Behavior
- Cart reservation is **soft**. Adding an item to cart does NOT prevent others from purchasing it.
- If an item in cart sells to someone else → item marked "Sold" in cart, buyer notified, checkout proceeds with remaining items.
- Cart items persist for 7 days, then auto-removed with notification.

### Multi-Seller Checkout
- Buyer can have items from multiple sellers in one cart.
- At checkout, one Stripe PaymentIntent is created per seller (separate charges with Stripe Connect transfers).
- Each seller gets a separate Order record.
- Shipping calculated per seller (each seller ships their own items).

### Partial Checkout Failure
- If seller A's item becomes unavailable during checkout → remove from cart, notify buyer, continue checkout with sellers B and C.
- If payment fails for seller B but succeeds for A and C → orders A and C confirmed, buyer notified about B failure, no charge for B.
- Atomic per-seller: each seller's charge either fully succeeds or fully fails. No partial charges within a single seller's order.

### Cart UI
- Cart grouped by seller with subtotals per seller.
- Shipping cost shown per seller group.
- Platform fee shown as single line item at bottom (total across all sellers).
- "X people have this in their cart" NOT shown (creates false urgency without soft reservation backing it up). Watcher count + offer count is enough social proof.

---

## 4. Detailed Seller Ratings (DSR)

### Rating Categories
When a buyer leaves a review, they rate on 4 dimensions:

1. **Item as Described** — 1-5 stars. Did the listing accurately represent the item?
2. **Shipping Speed** — 1-5 stars. How quickly did the seller ship after payment?
3. **Communication** — 1-5 stars. Was the seller responsive and helpful?
4. **Packaging Quality** — 1-5 stars. Was the item well-packaged?

Plus an overall star rating (1-5) and optional text review.

### Review Rules
- Auto-prompt at 3 days post-delivery. Reminder at 7 days. Window closes at **30 days** post-delivery.
- One review per order per buyer. Can edit within 48 hours of submission.
- Review visible immediately (no approval queue unless flagged by automated content scan).
- Minimum purchase amount to leave review: $0 (all purchases eligible).
- Reviews include verified purchase badge automatically.

### Review Photos
- Buyer can upload up to 4 photos with their review.
- Photos show in a gallery on the review.
- Essential for "item not as described" evidence.

### Seller Response
- Seller can post ONE response per review. Visible publicly below the review.
- Response cannot be edited after 24 hours.
- No back-and-forth — one response only. If there's a dispute, it goes to helpdesk.

### Aggregate Display
- Seller storefront shows: overall average, plus average per DSR category.
- Listing page shows: seller's overall rating + number of reviews.
- Search results show: star rating badge.

---

## 5. Buyer Ratings

### Sellers Rate Buyers
After an order completes, the seller can rate the buyer on:

1. **Payment Promptness** — 1-5 stars (relevant for offers where buyer might delay).
2. **Communication** — 1-5 stars. Was the buyer reasonable and responsive?
3. **Return Behavior** — 1-5 stars. If a return happened, was it legitimate?

### Buyer Trust Signals (Decision #142)
- Seller ratings feed into buyer trust signals — factual data shown to sellers, not abstract tiers.
- What sellers see on offers: completed purchase count, member since, verified badge, return count (if > 0), dispute count (if > 0), "Bought from you before" (if repeat buyer).
- Platform-only actions (invisible to sellers):
  - Serial returner (>20% return rate): purchase rate limits, payment holds.
  - Chargeback abuser (>2 chargebacks in 90 days): account restricted.
  - Confirmed fraud: account suspended — cannot make offers at all.

### Privacy
- Individual seller ratings of buyers are NOT publicly visible.
- Sellers see factual signals (purchase count, returns, disputes) — not scores or tiers.
- Buyer can see their own purchase count and member-since date. Cannot see how return/dispute counts appear to sellers.

---

## 6. Seller Scoring Additions

### New Metrics (beyond V2 trust score)
- **Average Response Time**: how fast seller replies to messages. Displayed on storefront as "Usually responds within X hours."
- **Average Ship Time**: days from payment to tracking uploaded. Displayed as "Usually ships within X days."
- **Cancellation Rate**: % of orders cancelled by seller. Internal metric affecting trust score.
- **On-Time Shipping Rate**: % of orders shipped within the seller's stated handling time.

### Progression Visualization
- Seller dashboard shows progress bar toward next performance band.
- "You need X more sales and Y% higher shipping speed to reach TOP RATED."
- Specific, actionable — not vague "improve your performance."
- Performance bands are EARNED (not purchased): NEW → RISING → ESTABLISHED → TOP_RATED → POWER_SELLER. See `TWICELY_V3_USER_MODEL.md`.

### Public Seller Stats (on storefront)
- Member since [year]
- Total sales [count]
- Average ship time
- Average response time
- Overall rating + DSR breakdown
- Performance band badge (RISING, ESTABLISHED, TOP_RATED, POWER_SELLER)
- Store badge shown if seller has active Store subscription

---

## 7. Storefront Editor

### Structure (eBay structure, Shopify polish)
Seller customizes their store at `/my/selling/store`:

- **Store Banner**: upload image (1200×300 recommended), cropped to fit.
- **Store Logo**: upload square image (200×200), displayed in circle.
- **Accent Color**: pick from **preset palette** (12 colors curated by Twicely design team). Maintains brand consistency across the platform while giving sellers identity.
- **Store Name**: set during seller onboarding, editable (uniqueness enforced, confusable detection).
- **Announcement Bar**: one line of text displayed at top of store. For sales, vacation notices, custom messages. Optional.
- **About Section**: rich text (bold, italic, links — no custom HTML). 2000 character limit.
- **Featured Listings**: seller pins up to 6 listings displayed prominently at top of store.
- **Store Categories**: seller-defined categories to organize their inventory. Buyers can browse "Shoes," "Vintage Tees," etc. within this seller's store. Not platform categories — the seller's own taxonomy.
- **Social Links**: optional links to Instagram, YouTube, TikTok, etc. Displayed as icons.
- **Vacation Mode**: toggle on/off. When active: announcement bar auto-shows vacation message, listings remain visible but "Buy" and "Make Offer" buttons disabled, auto-reply on messages.

### Editing Experience
- Split view: controls on left, live preview on right (Shopify-style).
- Changes are saved as draft until seller clicks "Publish."
- Preview works on mobile viewport toggle (desktop/tablet/mobile preview).
- No code, no HTML, no CSS — purely structured inputs with instant visual feedback.

### Store URL
- `twicely.co/st/storename`
- Store-level search: `twicely.co/st/storename?q=nike`
- Store category: `twicely.co/st/storename/c/shoes`

---

## 8. Shipping Improvements

### Dual Mode
- **Twicely Labels**: buy discounted shipping labels through Shippo. Auto-populates tracking. Integrated into batch shipping flow.
- **Own Label**: seller enters carrier + tracking number manually. For sellers with their own UPS/FedEx/USPS accounts.

### Batch Shipping (Twicely Labels only)
- Select multiple orders → choose shipping preset → buy all labels → print all as one PDF → mark all shipped.
- Reduces 40 clicks to 4 for 10 orders.

### Shipping Presets
- Seller saves named presets: "USPS Priority Padded Flat Rate," "UPS Ground Small Box," etc.
- Preset includes: carrier, service, package type, weight range.
- One-click label purchase using preset.

### SKU / Custom ID on Labels
- Seller's internal SKU or listing ID printed on packing slip (not the shipping label itself — carrier labels have strict formats).
- Packing slip includes: order number, item title, SKU (if set), quantity, buyer's first name.
- Packing slip has Twicely branding + seller store name.

### Shipping Cost Calculator
- On listing form: enter weight + dimensions → see cost estimates across carriers/services.
- Suggests "Most sellers in [category] charge $X for shipping."

### Ship-By Deadline
- Default: 3 business days after payment (configurable in seller settings).
- Visible to seller on order card: "Ship by [date]" with color coding (green → yellow → red as deadline approaches).
- Late shipment affects seller scoring (on-time shipping rate metric).

---

## 9. Seller Analytics & Financial Tracking

### Analytics Dashboard (`/my/selling/analytics`)

**Sales Metrics:**
- Total sales: daily / weekly / monthly / yearly with comparison to previous period.
- Average sale price.
- Sell-through rate: % of listed items that sold.
- Average days to sell.
- Total orders and order count trend.

**Traffic Metrics:**
- Views per listing (total and unique).
- Views → watchers → offers → sales funnel visualization.
- Top performing listings (by views, by sales, by conversion rate).
- Traffic sources: search, browse, direct link, external (social media), crosslister platforms.

**Performance Metrics:**
- Average ship time.
- Average response time.
- Return rate.
- DSR averages per category.
- Trust score trend over time.

### Financial Tracking (`/my/selling/finances`)

**Revenue:**
- Revenue by period (daily/weekly/monthly/yearly).
- Revenue by platform (Twicely, eBay, Poshmark — from crosslister). **Beta: Twicely only. Cross-platform when crosslister ships.**
- Revenue by category.

**Fees:**
- Fees breakdown: Twicely TF (progressive: 8-11%), insertion fees, boosting fees, subscription fees (Store + Lister).
- Fees by platform (side-by-side comparison when crosslister ships).
- Effective fee rate (total fees / total revenue).
- See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` for complete fee structure.

**COGS & Profit (Beta):**
- Seller enters purchase cost per item on listing form (optional field: "What did you pay for this item?").
- Profit per item: sale price - COGS - fees - shipping cost = profit.
- Profit margin per item and aggregate.
- Monthly P&L statement: revenue - COGS - fees - shipping = net profit.
- Inventory value: unsold items × listed price.

**Tax:**
- Tax summary for period: total sales, total fees paid, net income for tax reporting.
- Downloadable tax report (CSV/PDF) for accountant.
- 1099-K threshold tracking: "You've earned $X this year. 1099-K is issued at $600."

**Payouts:**
- Payout history with status, amount, date, destination.
- Next payout estimate: amount and expected date.
- Downloadable payout statements.

---

## 10. Seller Adjustments (Partial Refunds)

### Mechanism
- Seller can issue a **Seller Adjustment** on any active or delivered order.
- Available from order detail page: "Issue Partial Refund" button.
- Seller enters: amount (cannot exceed order total minus any previous adjustments), reason (free text).
- Buyer notified immediately.
- Stripe partial refund issued to buyer's original payment method.

### Fee Handling
- **Twicely keeps fees on original sale price.** Seller adjustment does NOT recalculate platform fees.
- Rationale: prevents gaming (sell high, refund half to cut fees), keeps ledger simple, industry standard.
- Seller understands this: a $20 partial refund on a $100 order is still better than a full return where they lose everything.

### Ledger
- `ADJUSTMENT_DEBIT` against seller for the refund amount.
- No `REFUND_FEE_REVERSAL` posted.
- Adjustment recorded on order with timestamp, amount, reason, and who initiated.

### Limits
- Maximum 3 adjustments per order.
- Total adjustments cannot exceed original order amount.
- Only seller or admin can initiate (not buyer — buyer opens a return for that).

### Distinction from Returns
- Seller Adjustments: voluntary, seller-initiated, no return shipment, Twicely keeps fees.
- Formal Returns: buyer-initiated, goes through return reason bucketing, fee allocation follows fault rules per the Returns Fee Allocation Addendum.

---

## 11. Search & Discovery

### Saved Searches
- Buyer saves a search query + filters. Stored on account.
- Alert frequency: instant (push notification on new match), daily digest (email), weekly digest (email). Buyer chooses.
- Max 25 saved searches per account.
- Managed at `/my/buying/searches`.

### Autocomplete
- Search bar shows suggestions as user types.
- Sources: popular searches, category names, brand names, recent searches (per user).
- Debounced at 300ms, max 8 suggestions.

### Similar Items
- On listing detail page: "Similar Items" section.
- Algorithm: same category + similar price range + similar attributes (brand, size, condition).
- 6-12 items displayed in a scrollable row.
- Excludes same seller's items (that's "More from this seller" section, separate).

### More From This Seller
- On listing detail page: "More from [Store Name]" section.
- Shows 6 items from same seller, sorted by newest.
- Link to full store: "View all X items →"

### Recently Viewed
- Stored per account (logged in) or per session cookie (guest).
- On guest → signup, recently viewed merges into account.
- Displayed on homepage and in `/my/buying` dashboard widget.
- Max 50 items stored, FIFO.

### Trending Searches
- Anonymized, aggregated from search volume.
- Displayed on homepage: "Trending: Nike Dunks, Vintage Levi's, PS5, ..."
- Updated hourly.

### Search Features
- Spelling correction: "nikee jordans" → "Nike Jordans" (Typesense built-in typo tolerance).
- Category-aware filtering: search "size 10" in Shoes category → filters by shoe size attribute, not text match.
- Search within seller store: `twicely.co/st/storename?q=nike`
- Empty search state: show popular categories and trending items instead of blank page.

---

## 12. Social Features (Light Layer)

### Follow Sellers
- "Follow" button on seller storefront.
- Following creates a feed of new listings from followed sellers.
- Displayed at `/my/buying/following`.
- Notification option: "New listings from sellers you follow" (toggleable, default: daily digest).

### Watcher Count
- Every listing shows: "X watching" (exact number).
- Creates urgency without being manipulative.

### Activity Feed
- `/my` dashboard widget: "Sellers you follow listed 12 new items today."
- Lightweight — not a social media feed. Just new listing notifications from followed sellers.

### Share to Social
- "Share" button on every listing.
- Generates a link with Open Graph meta tags (image, title, price, Twicely branding).
- Share targets: copy link, Twitter/X, Facebook, Pinterest, iMessage.
- Seller's share link includes their store attribution.

### Seller Follower Count
- Visible on storefront: "X followers."
- Social proof for the seller, motivates building an audience.

### What We DON'T Do
- No "share to promote" algorithm (Poshmark's toxic model).
- No algorithmic feed based on social activity.
- No follower requirements for visibility.
- No gamification around social actions.
- Visibility is earned by being a good seller (trust score + relevance), not by social activity.

---

## 13. Onboarding Flows

### Buyer First-Run
- After email verification: welcome screen.
- "What are you interested in?" — select 3-5 categories. Seeds homepage recommendations and saved search suggestions.
- "Browse popular items" CTA → lands on homepage with personalized categories.
- Minimal, optional, fast. User can skip entirely.

### Seller First-Run
- After enabling selling: guided setup wizard.
- Step 1: Store name + store logo.
- Step 2: Shipping profile (default carrier, handling time, return policy).
- Step 3: Payout setup (Stripe Connect onboarding).
- Step 4: "Create your first listing" CTA with guided listing form (tooltips on each field).
- Progress bar shows completion. Can exit and resume later.
- Incomplete steps shown as reminders on seller dashboard.

### Admin Bootstrap
- First Super Admin created via seed script (Phase 0 decision).
- Admin first login: system health check runs automatically, shows status.
- Guided setup: configure platform settings (site name, fees, email provider keys, shipping provider keys) through the admin settings UI.
- No CLI required after initial seed — everything through hub.twicely.co.

---

## 14. Image Pipeline

### Upload Flow
1. Buyer/seller selects images (drag-and-drop or file picker).
2. Client-side: validate file type (JPEG, PNG, WebP), validate size (<20MB), validate dimensions (>200×200).
3. Upload to API endpoint.
4. Server-side: validate magic bytes (not just extension), reject SVG, check decompression bomb ratio.
5. Strip EXIF data (privacy — removes GPS, camera info).
6. Replace filename with UUID (path traversal prevention).
7. Store original in Cloudflare R2 (`originals/` bucket).
8. Queue background job (BullMQ) for processing.

### Processing Pipeline (BullMQ job)
1. Generate thumbnails:
   - `small`: 150×150 (search results, grid view)
   - `medium`: 400×400 (listing card)
   - `large`: 800×800 (listing detail)
   - `zoom`: 1200×1200 (zoom view on listing page)
2. Convert to WebP for all sizes (smaller file size, modern format).
3. Keep original format as fallback for older browsers.
4. ClamAV virus scan on original.
5. If scan fails → quarantine, don't serve, notify admin.
6. Store all variants in Cloudflare R2 (`processed/` bucket) with predictable key pattern: `{listingId}/{imageId}/{size}.webp`

### Serving
- Images served via CDN-friendly URLs.
- Signed URLs with 1-hour expiry (or CDN token auth).
- Lazy loading on listing grids.
- Placeholder blur hash generated during processing for instant page load feel.

### Listing Image Rules
- Maximum 12 images per listing.
- First image = cover photo (displayed in search results and cards).
- Drag-to-reorder in listing form.
- Crop and rotate tools in listing form.
- Minimum 1 image required to publish listing.

---

## 15. Real-Time Strategy (Centrifugo)

### Beta: Everything Real-Time

**Messages:**
- New message in conversation → instant delivery to recipient.
- Typing indicator ("Seller is typing...").
- Read receipts (sender sees "Read" status).

**Order Status:**
- Order status changes (PAID → PROCESSING → SHIPPED → IN_TRANSIT → DELIVERED) push to buyer in real-time.
- Buyer sees status update without page refresh.
- "Your item is out for delivery" notification.

**Notification Bell:**
- Unread count updates live.
- New notifications appear without refresh.

**Helpdesk (hub.twicely.co):**
- New case assignment pushes to agent.
- Case status changes visible to watching agents.
- New message in case pushes to assigned agent.

**Admin Dashboard (hub.twicely.co):**
- Live GMV counter.
- Live active users count.
- Provider health status updates.

**Cart:**
- If an item in your cart sells to someone else → real-time notification: "Item X just sold."

### Channel Architecture
- `private-user.{userId}` — personal notifications, order updates, messages.
- `private-conversation.{conversationId}` — message thread updates.
- `private-order.{orderId}` — order status changes.
- `private-case.{caseId}` — helpdesk case updates (staff only).
- `private-admin` — admin dashboard metrics (staff only).
- All channels require server-side authorization before subscription.

---

## 16. Error Pages

### Pages
- **404 Not Found**: "We couldn't find that page." Search bar + popular categories + link to homepage.
- **403 Forbidden**: "You don't have access to this page." If not logged in → "Log in to continue" button. If logged in → "This page requires different permissions."
- **500 Server Error**: "Something went wrong on our end." Support link + "Try again" button. No technical details exposed.
- **Maintenance Mode**: full-page takeover. "Twicely is undergoing maintenance. We'll be back shortly." Estimated return time if known. Triggered by admin feature flag.

### Empty States
Every list/grid page has a designed empty state instead of blank space:
- No orders yet → "Your orders will appear here. Start shopping!" + browse CTA.
- No listings yet → "Create your first listing!" + guided CTA.
- No messages → "No conversations yet. Messages about items you're buying or selling will appear here."
- No search results → "No items match your search. Try different keywords or browse categories."
- No reviews → "No reviews yet. Reviews appear after your first sale."
- No saved searches → "Save a search to get notified when new items match."

---

## 17. SEO

### Server-Side Rendering
- All public pages server-rendered (Next.js SSR/SSG).
- Listing pages: full SSR with meta tags populated from listing data.
- Category pages: SSR with category description + meta tags.
- Seller storefronts: SSR with store info + meta tags.

### Meta Tags (per page type)
- **Listing**: `<title>Item Title - $Price | Twicely</title>`, `<meta name="description" content="First 160 chars of description">`.
- **Category**: `<title>Category Name - Shop on Twicely</title>`.
- **Store**: `<title>Store Name | Twicely Seller</title>`.
- **Search**: `<title>Search results for "query" | Twicely</title>` (noindex to prevent thin content).

### Structured Data (JSON-LD)
- Listing pages: `Product` schema with name, description, image, price, availability, condition, seller, reviews.
- Seller storefronts: `Organization` schema.
- Breadcrumbs: `BreadcrumbList` schema on all pages.
- Search: `WebSite` schema with `SearchAction` on homepage.

### Sitemap
- Dynamic XML sitemap generated from: active listings, categories, seller storefronts.
- Sitemap index for large sites (split by category or date).
- Submitted to Google Search Console.
- Updated daily via cron job.

### Other
- Canonical URLs on all pages (prevent duplicate content).
- Open Graph tags for social sharing (og:title, og:description, og:image, og:price:amount).
- Twitter Card tags (twitter:card, twitter:title, twitter:image).
- `robots.txt`: allow public pages, disallow `/my/*`, `/api/*`, hub subdomain.
- Hreflang tags when internationalization ships (future).

---

## 18. Mobile Responsive Strategy

### Approach
- **Mobile-first design.** Every page designed for 375px width first, then enhanced for tablet and desktop.
- Tailwind breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px).

### Key Responsive Behaviors
- **Navigation**: desktop = sidebar (collapsible). Mobile = bottom tab bar (5 tabs: Home, Search, Sell, Messages, My).
- **Listing grid**: 2 columns on mobile, 3 on tablet, 4-5 on desktop.
- **Listing detail**: single column on mobile. Desktop = image gallery left, details right.
- **Storefront**: banner scales, grid adapts, store categories become horizontal scroll on mobile.
- **Seller dashboard** (`/my`): widgets stack single column on mobile. Sidebar collapses to hamburger.
- **Search**: full-screen search overlay on mobile with recent searches and suggestions.
- **Checkout**: single column flow on all devices (checkout should never be multi-column).
- **Hub (admin)**: responsive but optimized for desktop. Admin on mobile is possible but not the primary use case. Tables become card lists on small screens.

### Touch Targets
- Minimum tap target: 44×44px (Apple HIG / WCAG).
- Adequate spacing between interactive elements.
- Swipe gestures where natural (swipe to delete in lists, swipe between images).

---

## 19. Messaging System

### Conversation Model
- Every conversation has a **required `listingId`**. No free-form messaging between strangers.
- "Ask seller a question" button on listing page creates/opens conversation about that listing.
- When listing becomes an order, conversation gets `orderId` linked.
- Conversation continues through purchase and delivery.
- One conversation per buyer-seller-listing combination. Returning to same listing reopens existing thread.

### Conversation Lifecycle
| Phase | Status |
|-------|--------|
| Listing active, no purchase | Open |
| Listing sold to someone else | Open for 7 days, then read-only |
| Order placed → delivered | Open |
| Delivered → 30 days post-delivery | Open |
| 30 days post-delivery, no active dispute/return | Read-only |
| Active return or dispute exists | Open until resolved |
| Return/dispute resolved | Open for 7 days, then read-only |
| Listing expired/ended, no purchase | Open for 7 days, then read-only |

Read-only = both parties can see full history but cannot send new messages. If help needed after lock, open a helpdesk case.

### Features
- **Text messages**: plain text with basic formatting (bold, italic, links auto-detected).
- **Image sharing**: buyer/seller can send up to 4 images per message (damaged item photos, measurements, etc.).
- **Quick Replies (seller)**: saved canned responses. "Thanks for your purchase! Shipping within 24 hours." Seller manages their own quick reply library.
- **Auto-Messages**: system sends on behalf of seller at configurable triggers:
  - Order placed: "Thank you for your purchase! I'll ship within [handling time]."
  - Order shipped: "Your order has shipped! Tracking: [number]."
  - Order delivered: "Your order was delivered! Hope you love it."
  - Seller can customize templates or disable.
- **Read receipts**: sender sees "Read" when recipient opens the conversation. Not per-message, per-conversation (less intrusive).
- **Typing indicator**: "Seller is typing..." via Centrifugo.
- **Real-time delivery**: messages appear instantly via Centrifugo WebSocket.

### Safety
- **Off-platform transaction detection**: messages scanned for phone numbers, email addresses, external payment mentions ("Venmo," "CashApp," "PayPal," "wire transfer," "Zelle"). Detected content triggers a warning banner: "For your protection, complete transactions on Twicely." Message still sends but is flagged for moderation review.
- **Spam rate limit**: max 30 messages per hour per user. Identical content to 5+ different sellers = flagged.
- **Block user**: either party can block. Blocked user cannot message, purchase from, or make offers to the blocker.
- **Report message**: flag for moderation → creates helpdesk case (type: MODERATION).

### Admin Visibility
- Agents can view any conversation for dispute resolution (audited access — every view logged).
- Conversation history included in helpdesk case context panel.

---

## 20. Admin Global Search (hub.twicely.co)

### Behavior
- Single search bar at top of hub layout. Keyboard shortcut: `Cmd+K` / `Ctrl+K`.
- Type anything: user email, order number (ORD-...), case number (HD-...), listing ID, seller store name, listing title.
- Results grouped by entity type: Users, Orders, Cases, Listings, Sellers.
- Click result → navigate directly to entity detail page.
- Search queries logged (for admin audit trail).
- Recent searches shown on empty state.
- Debounced at 300ms, max 5 results per entity type.

---

## 21. Admin Settings (hub.twicely.co/cfg)

### Every Setting Has
- **Label**: plain English name.
- **Description**: one sentence explaining what it does.
- **Consequences**: what happens if you change it.
- **Default value**: and why it's the default.
- **"Learn more" link**: to KB article (when KB is built).

### Example
```
Auto-Complete Window
────────────────────────────────────────────
Orders automatically complete this many days after
delivery confirmation if the buyer hasn't filed a return.

Shorter = faster payouts for sellers.
Longer = more time for buyers to inspect items.

Default: 3 days
Affects: Payout timing, return eligibility window.

[3] days              [Save]
```

### Settings Groups (tabs on /cfg)
- **Commerce**: order auto-complete, cart expiry, offer defaults, return windows.
- **Fees & Pricing**: TF rates (progressive brackets), insertion fees, boosting rates, Store/Lister tier pricing.
- **Trust & Quality**: trust score weights, seller standard thresholds, new seller caps.
- **Shipping**: default handling time, supported carriers, label discounts.
- **Search & Discovery**: featured categories, trending algorithm weights, search tuning.
- **Integrations**: Stripe, Shippo, email provider, search provider, storage — all API keys managed here, stored encrypted. Connection health status shown per provider (green checkmark or red X with error).
- **Feature Flags**: toggle features on/off with audience targeting.
- **Privacy & Data Retention**: retention periods per data type, GDPR settings.
- **Notifications**: email templates, notification channel defaults, digest settings.

### Encrypted Config (No .env)
- Only TWO environment variables in production: database connection string + master encryption key.
- Everything else configured through this UI and stored encrypted in database.
- Every config change creates a new version with `effectiveAt` timestamp (effective-dated settings pattern from V2).
- Every config change logged as audit event.

---

## 22. Admin Quick Actions & Keyboard Shortcuts

### Quick Actions (on entity detail pages)
**User page:**
- Suspend / Unsuspend
- Warn (send warning message)
- Restrict selling / buying
- Hold payouts
- Reset password
- View as user (read-only impersonation of their dashboard)
- View orders / listings / cases

**Order page:**
- Issue refund (full or partial)
- Cancel order
- Override status (with reason — audited)
- Add internal note
- Escalate to helpdesk case
- View buyer / view seller

**Listing page:**
- Remove (takedown with reason)
- Flag for review
- Admin edit (override seller's listing — audited)
- View seller
- View in marketplace (opens twicely.co listing page)

**Helpdesk case page:**
- (Already covered in helpdesk spec — reassign, escalate, link order, merge, resolve)

### Keyboard Shortcuts (hub only)
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Global search |
| `G then D` | Go to dashboard |
| `G then U` | Go to users |
| `G then T` | Go to transactions |
| `G then H` | Go to helpdesk |
| `G then C` | Go to config |
| `G then A` | Go to audit log |
| `?` | Show keyboard shortcut overlay |

---

## 23. URL Structure (Final)

### twicely.co (Marketplace)

| URL | Page |
|-----|------|
| `/` | Homepage |
| `/s?q=nike` | Search results |
| `/c/electronics` | Category browse |
| `/c/electronics/phones` | Subcategory |
| `/i/nike-air-jordan-retro-abc123` | Listing (slug + short ID) |
| `/st/vintagefinds` | Seller store |
| `/st/vintagefinds/about` | Store about |
| `/st/vintagefinds/reviews` | Store reviews |
| `/st/vintagefinds/c/shoes` | Store category |
| `/st/vintagefinds?q=nike` | Store search |
| `/m` | Messages inbox |
| `/m/conv-abc123` | Conversation |
| `/my` | Dashboard (customizable widgets) |
| `/my/buying` | Buying overview |
| `/my/buying/orders` | Purchase history |
| `/my/buying/watchlist` | Watchlist |
| `/my/buying/offers` | Offers I've made |
| `/my/buying/reviews` | Reviews I've left |
| `/my/buying/searches` | Saved searches |
| `/my/buying/following` | Followed sellers |
| `/my/selling` | Selling overview |
| `/my/selling/listings` | My listings |
| `/my/selling/orders` | Orders to fulfill |
| `/my/selling/analytics` | Analytics dashboard |
| `/my/selling/finances` | Finances & payouts |
| `/my/selling/crosslist` | Crosslister |
| `/my/selling/store` | Store editor |
| `/my/selling/promotions` | Promotions & coupons |
| `/my/selling/staff` | Staff management (delegation) |
| `/my/settings` | Account settings |
| `/my/security` | Security & 2FA |
| `/my/notifications` | Notification preferences |
| `/my/support` | My helpdesk cases |
| `/h` | Help center (KB) |
| `/h/article-slug` | KB article |
| `/h/contact` | Submit helpdesk case |
| `/p/privacy` | Privacy policy |
| `/p/terms` | Terms of service |
| `/p/protection` | Buyer protection |
| `/p/fees` | Fee schedule |

### hub.twicely.co (Platform Staff Only)

| URL | Page |
|-----|------|
| `/d` | Dashboard |
| `/usr` | User management |
| `/usr/u-abc123` | User detail |
| `/tx` | Transactions overview |
| `/tx/orders` | All orders |
| `/tx/orders/o-abc123` | Order detail |
| `/tx/payments` | Payments |
| `/fin` | Finance overview |
| `/fin/ledger` | Ledger |
| `/fin/payouts` | Payouts |
| `/fin/recon` | Reconciliation |
| `/fin/costs` | Platform costs (absorbed returns) |
| `/mod` | Moderation overview |
| `/mod/cases` | Moderation cases |
| `/mod/reports` | Reports queue |
| `/mod/fraud` | Fraud detection |
| `/hd` | Helpdesk dashboard |
| `/hd/cases` | Case queue |
| `/hd/cases/hd-000123` | Case detail (agent workspace) |
| `/hd/moderation` | Moderation queue |
| `/hd/macros` | Macros |
| `/hd/teams` | Teams |
| `/hd/routing` | Routing rules |
| `/hd/sla` | SLA policies |
| `/hd/automation` | Automation rules |
| `/hd/reports` | Helpdesk reports |
| `/hd/settings` | Helpdesk settings |
| `/kb` | Knowledge base editor |
| `/kb/new` | New article |
| `/kb/art-abc123` | Edit article |
| `/cfg` | Platform config |
| `/cfg/commerce` | Commerce settings |
| `/cfg/fees` | Fees & pricing |
| `/cfg/trust` | Trust & quality |
| `/cfg/shipping` | Shipping settings |
| `/cfg/discovery` | Search & discovery |
| `/cfg/integrations` | Provider API keys |
| `/cfg/flags` | Feature flags |
| `/cfg/privacy` | Data retention |
| `/cfg/notifications` | Notification settings |
| `/roles` | Role management |
| `/roles/new` | Create role |
| `/audit` | Audit log |
| `/errors` | Silent error log |
| `/health` | System health |
| `/security` | Security events |

---

## 24. Listing Creation Experience

### Design Goal
Fastest listing creation in the resale industry. Under 3 minutes for an experienced seller.

### Listing Form Flow
1. **Category Selection**: type in search box → auto-suggests categories as you type. "Nike shoes" → suggests "Men's Athletic Shoes > Nike." No tree browsing required (but available as fallback). Category selection drives the rest of the form — fields, attributes, size systems all change based on category.

2. **Photos**: drag-and-drop zone at top of form. Upload up to 12 images. First image = cover photo. Drag-to-reorder. Crop and rotate tools inline (no external editor needed). Minimum 1 photo to publish. Square crop suggested but not required. Upload starts immediately (background), doesn't block form filling.

3. **Core Fields**: title (required, 80 char max), description (required, rich text with bold/italic/links, 5000 char max), condition (required, dropdown — see Section 29), price (required, cents precision).

4. **Category-Driven Dynamic Fields**: based on selected category, additional fields appear:
   - Shoes: size system (US/UK/EU selector), width, brand (searchable dropdown from catalog), style
   - Clothing: size (category-appropriate — S/M/L or numeric), brand, material, color
   - Electronics: brand, model, storage capacity, carrier (phones), condition notes
   - All categories: brand (searchable, allows custom), color (multi-select with swatches), tags (freeform, max 10)
   - Fields marked REQUIRED (red asterisk), RECOMMENDED (yellow asterisk with "improves search visibility" tooltip), or OPTIONAL

5. **Shipping**: select existing shipping preset (one click) or configure: weight, dimensions, shipping method, handling time. Cost calculator shows estimates as you fill in weight/dimensions. Free shipping toggle with "add to item price" suggestion.

6. **Pricing & Offers**: price input, original price (optional, shows "X% off" badge), offer settings (enable/disable, auto-accept threshold, auto-decline threshold, expiry window).

7. **COGS Field**: "What did you pay for this item?" (optional). Used for profit calculation in seller analytics. Not visible to buyers.

8. **Crosslist Toggles**: checkboxes for each connected platform (eBay, Poshmark, Mercari). Shows readiness status per platform: ✅ Ready, ⚠️ Needs Attention (click to see missing fields), ❌ Not Connected.

### Efficiency Features
- **List Similar**: button on any existing listing. Clones all fields, photos, attributes. Seller changes what's different. Saves 80% of time for similar inventory.
- **Draft Auto-Save**: every 30 seconds, form state saved to server. Seller can close browser, come back, resume. Drafts visible in listing management.
- **Bulk Listing via CSV**: upload CSV with predefined column format. System validates, shows preview with errors highlighted, seller fixes and confirms. Template CSV downloadable per category.
- **Quick Relist**: sold items show "Relist" button. One click recreates the listing with same details.

### Validation
- Real-time validation as user types (title length, price format, required fields).
- "Ready to Publish" indicator shows completion percentage.
- Cannot publish until all REQUIRED fields are filled + at least 1 photo uploaded + shipping configured.
- Warning (not blocking) if RECOMMENDED fields are empty: "Adding brand and size improves your listing's visibility in search."

### Admin Settings
- `listing.titleMaxLength`: 80 (default). Max characters for listing title.
- `listing.descriptionMaxLength`: 5000 (default). Max characters for description.
- `listing.maxImages`: 12 (default). Max images per listing.
- `listing.draftAutoSaveIntervalSeconds`: 30 (default). How often drafts auto-save.
- `listing.requireMinImages`: 1 (default). Minimum images to publish.

---

## 25. Buyer Protection

### Coverage
Every purchase on Twicely is covered by the Twicely Money-Back Guarantee. Coverage details are transparent and public at `/p/protection`.

### Claim Types & Windows

| Claim Type | Code | Window | Description |
|------------|------|--------|-------------|
| Item Not Received | INR | 30 days from estimated delivery | Item never arrived |
| Item Not As Described | INAD | 30 days from delivery | Item differs from listing |
| Item Damaged | DAMAGED | 30 days from delivery | Arrived damaged |
| Counterfeit | COUNTERFEIT | **60 days** from delivery | Item is not authentic |
| Buyer Remorse | REMORSE | Per seller's return policy | Changed mind (only if seller allows) |

Note: eBay uses 30 days for everything. Our 60-day counterfeit window is a differentiator — counterfeits sometimes aren't discovered until the buyer tries to get the item serviced, authenticated, or compared against a genuine product. 60 days is generous enough to catch these cases without being exploitable.

### Claim Workflow
1. Buyer clicks "I have a problem" on order detail page.
2. Selects claim type, describes issue, uploads evidence photos (required for INAD/DAMAGED/COUNTERFEIT).
3. Seller notified, has 3 business days to respond (accept, decline with evidence, or propose partial refund).
4. If seller doesn't respond within deadline → auto-escalated to Twicely.
5. Twicely reviews evidence and decides. Decision within 48 hours.
6. If buyer wins: refund issued. If return required, return label generated (who pays depends on fault — see Returns Fee Allocation Addendum).
7. Full timeline visible to buyer, seller, and staff.

### Protection Badge
- Every listing shows a "Buyer Protection" badge with coverage amount.
- Badge shows: "Protected up to $[amount]" based on category coverage limits.
- "Learn more" links to `/p/protection`.
- Displayed on: listing page, search results (icon only), cart, checkout.

### Seller Protection Score (0-100)
- Computed from: claim rate, resolution rate, response time, return rate, chargeback rate.
- Tiers: EXCELLENT (90-100), GOOD (70-89), FAIR (50-69), POOR (0-49).
- Visible to seller on their dashboard with actionable improvement suggestions.
- Affects automated claim resolution: EXCELLENT sellers get benefit of doubt in ambiguous cases. POOR sellers face lower evidence threshold for buyer claims.

### Seller Appeals
- Every resolution can be appealed within 30 days with new evidence.
- One appeal per claim.
- 48-hour review SLA for platform.
- If appeal succeeds: refund reversed (full or partial), seller score adjusted upward.

### Category Coverage Limits
- Admin-configurable per category.
- Default: full item price up to $5,000.
- High-value categories (jewelry, electronics) may have different limits.
- Coverage amount shown on protection badge.

### Public Transparency Page (`/p/protection`)
- Hero: "Shop with Confidence — Every Purchase Protected"
- Coverage types with icons and descriptions
- How it works (3 steps)
- Category coverage limits table
- Live stats: "X% of claims resolved, average Y days"
- FAQ section
- Fully server-rendered for SEO.

### Admin Settings
- `protection.defaultWindowDays`: 30 (default). Standard claim window.
- `protection.counterfeitWindowDays`: 60 (default). Extended window for counterfeit claims.
- `protection.sellerResponseDays`: 3 (default). Business days for seller to respond.
- `protection.platformReviewHours`: 48 (default). Hours for platform to review escalated claim.
- `protection.appealWindowDays`: 30 (default). Days after resolution to file appeal.
- `protection.defaultMaxCoverageCents`: 500000 (default, $5,000). Default max coverage per claim.
- `protection.autoApproveThresholdCents`: 2500 (default, $25). Claims under this amount auto-approved if seller doesn't respond.

---

## 26. Seller Delegation & Staff Management

### Purpose
Power sellers with employees need to grant specific access without sharing their account credentials. Available at `/my/selling/staff`.

### Delegation Model
- Seller (owner) invites staff members by email.
- Staff member creates their own Twicely account (or uses existing one).
- Seller grants specific permission scopes to each staff member.
- All actions by delegated staff are audited with `actorUserId` (staff) + `onBehalfOfUserId` (owner).

### Permission Scopes (Seller-Grantable)

| Scope | Description | Risk Level |
|-------|-------------|------------|
| `listings.view` | View seller's listings | Low |
| `listings.manage` | Create, edit, delete listings | Low |
| `orders.view` | View incoming orders | Low |
| `orders.manage` | Update order status, add tracking | Medium |
| `messages.view` | Read buyer messages | Low |
| `messages.reply` | Reply to buyer messages | Low |
| `analytics.view` | View seller analytics | Low |
| `finances.view` | View revenue, fees, payouts | Medium |
| `refunds.request` | Request refunds (creates pending request for owner approval) | Medium |
| `refunds.initiate` | Execute refunds without owner approval | **High** |
| `payouts.view` | View payout history and schedule | Medium |
| `payouts.manage` | Change payout settings and destination | **High** |
| `store.manage` | Edit storefront settings | Low |
| `promotions.manage` | Create/edit promotions and coupons | Medium |
| `crosslist.manage` | Manage crosslisting to external platforms | Medium |

### Security Rules
- **High-risk scopes** (refunds.initiate, payouts.manage): owner must have 2FA enabled to grant these.
- **Payout destination changes** by delegated staff: trigger 72-hour hold + email notification to owner + audit event with IP/device.
- Owner can revoke any staff member's access immediately.
- Staff members cannot grant access to others (only owner can delegate).
- Staff members cannot change the owner's account settings or security.
- Delegation is per-seller, not per-store (unified user model — one seller = one delegation set).

### UI
- `/my/selling/staff`: list of staff members with their scopes, last activity, status.
- "Invite Staff" button: enter email, select scopes, send invitation.
- Per-staff-member: edit scopes, view activity log, revoke access.
- Activity log shows: what the staff member did, when, and from what IP.

### Admin Settings
- `delegation.maxStaffPerSeller`: 10 (default). Maximum staff members per seller.
- `delegation.require2faForHighRisk`: true (default). Require owner 2FA for high-risk scope grants.
- `delegation.payoutChangeHoldHours`: 72 (default). Hold period after delegated payout destination change.

---

## 27. Notification Preferences

### User-Facing Notification Settings (`/my/notifications`)

Per-notification-type channel control. Each notification type has toggles for: In-App, Email, Push, SMS.

### Notification Priority Tiers

| Tier | Delivery | Examples |
|------|----------|---------|
| **Critical** | Real-time push + in-app immediately | Order received, item sold on another platform, payout sent, return requested, account security alert |
| **Important** | Within 1 hour (email + in-app) | Offer received, order shipped, review received, dispute opened |
| **Informational** | Daily digest (email) or in-app only | Price drop on watched item, new listing from followed seller, saved search match, promotion ending soon |

### Digest Settings
- Frequency: daily or weekly (buyer chooses).
- Digest time: configurable (default 9:00 AM in user's timezone).
- Digest groups informational notifications into one email.
- Unsubscribe link in every email (CAN-SPAM compliance).

### Quiet Hours
- User sets quiet hours (e.g., 10 PM – 8 AM).
- During quiet hours: no push notifications, no SMS. In-app and email still queue but don't trigger device alerts.
- Critical security alerts (suspicious login, password change) bypass quiet hours.

### Marketing Opt-In
- Marketing emails require explicit opt-in (checkbox during signup, unchecked by default).
- Separate from transactional notifications — transactional always sent regardless of marketing preference.
- One-click unsubscribe from marketing in every marketing email.

### Seller-Specific Notifications
Sellers get additional notification types with configurable thresholds:
- "Notify me when an item has been listed for more than X days without a sale" (stale inventory alert).
- "Notify me when my trust score changes" (score monitoring).
- "Daily sales summary" (opt-in).

### Admin Settings
- `notifications.emailEnabled`: true. Master switch for email channel.
- `notifications.pushEnabled`: true. Master switch for push channel.
- `notifications.smsEnabled`: false (default). Master switch for SMS.
- `notifications.maxEmailsPerDayPerUser`: 50. Rate limit.
- `notifications.maxPushPerDayPerUser`: 20. Rate limit.
- `notifications.maxSmsPerDayPerUser`: 5. Rate limit.
- `notifications.digestDefaultFrequency`: "daily". Default digest frequency.
- `notifications.digestDefaultTimeUtc`: "14:00". Default digest time (9 AM ET).
- `notifications.marketingOptInRequired`: true. Require explicit opt-in for marketing.

---

## 28. Search Filters

### Filter Types
Filters appear on search results page and category browse pages. Which filters show depends on the category — the CategoryAttributeSchema from the catalog system drives filter availability.

### Universal Filters (always available)
- **Price**: range slider with min/max text inputs. Steps: $0–$25, $25–$50, $50–$100, $100–$250, $250–$500, $500+, or custom range.
- **Condition**: multi-select checkboxes (see Section 29 for condition definitions).
- **Free Shipping**: toggle.
- **Seller Rating**: minimum star rating slider (1–5).
- **Listing Age**: newest first, ending soon (for time-limited promotions).
- **Location**: distance radius from buyer's location (10mi, 25mi, 50mi, 100mi, any). Uses buyer's saved address or browser geolocation.

### Category-Driven Filters
When browsing within a category, additional filters appear based on category attributes with `showInFilters: true`:
- **Brand**: multi-select with search within filter (type to find brand). Most popular brands shown first, then alphabetical.
- **Size**: category-appropriate size system. Shoes show shoe sizes (US 6, 6.5, 7...). Clothing shows S/M/L/XL or numeric (0, 2, 4...). Electronics don't show size.
- **Color**: color swatches (multi-select). Standard color set: Black, White, Red, Blue, Green, Yellow, Orange, Purple, Pink, Brown, Gray, Multi.
- **Material**: multi-select (Leather, Cotton, Denim, Polyester, Silk, Wool, etc.). Category-dependent.
- **Gender**: Men's, Women's, Unisex, Boys', Girls'.

### Filter Behavior
- Filters are AND logic between categories (price AND condition AND brand).
- Filters are OR logic within a category (brand: Nike OR Adidas).
- Filter selections reflected in URL params for shareability and bookmarking.
- "Clear all filters" button.
- Result count updates as filters are applied (without full page reload — client-side filtering with server validation).
- Mobile: filters in a slide-out drawer/bottom sheet. "Apply Filters" button to confirm.
- Empty filter state: "No items match these filters. Try removing some filters."

### Sort Options
- Relevance (default for search queries)
- Newest Listed
- Price: Low to High
- Price: High to Low
- Best Selling (highest conversion rate)
- Nearest (if location available)

---

## 29. Condition System

### Condition Definitions

| Condition | Code | Description |
|-----------|------|-------------|
| New with Tags | NWT | Brand new, original tags still attached, never worn or used |
| New without Tags | NWOT | Brand new, tags removed, never worn or used |
| Like New | LIKE_NEW | Worn/used once or twice, no visible signs of wear, no flaws |
| Very Good | VERY_GOOD | Light signs of wear, no significant flaws, fully functional |
| Good | GOOD | Visible wear, minor flaws that are disclosed in description |
| Acceptable | ACCEPTABLE | Significant wear or flaws, fully functional, all flaws disclosed |

### Rules
- Condition is REQUIRED on every listing.
- Seller must describe any flaws in listing description for Good and Acceptable conditions. The listing form shows a "Describe any flaws" text area that appears when Good or Acceptable is selected.
- Condition mismatch (item doesn't match listed condition) is grounds for INAD claim with automatic seller fault determination.
- Condition affects search ranking: NWT/NWOT listings get slight boost for "new" keyword searches.
- Condition is a universal filter on all category browse and search results.

### Condition-Specific Categories
Some categories may add conditions beyond the standard set:
- Electronics: "Refurbished" (certified refurbished by manufacturer or authorized refurbisher, with warranty info required).
- Parts: "For Parts / Not Working" (non-functional, sold as-is).
- These are admin-configurable per category and stored in the CategoryAttributeSchema.

### Admin Settings
- `condition.requireFlawDescription`: true (default). Require flaw description for Good/Acceptable.
- `condition.allowCategorySpecific`: true (default). Allow categories to add custom conditions.

---

## 30. Vacation Mode (Time Away)

### Three Modes (seller chooses)

| Mode | Listings | Purchases | Offers | Max Duration |
|------|----------|-----------|--------|-------------|
| **Pause Sales** | Hidden from search | Blocked | Blocked | 30 days |
| **Allow Sales (Delayed Shipping)** | Visible with "Away" banner | Allowed (buyer must accept delayed shipping before purchase) | **Blocked** | 15 days |
| **Custom** | Seller picks per behavior | Configurable | **Always blocked** | 30 days |

### Offers During Vacation
- **All offers are blocked in every vacation mode.** No new offers can be submitted. No counter-offers can be sent.
- Pending offers at vacation start: auto-declined with message "Seller is currently away. Your offer has been declined. You can resubmit when they return on [date]." Authorization holds released.
- This is better than eBay, which allows offers during vacation and creates confusion when sellers can't ship on time.

### "Allow Sales" Mode Detail
- All listings show a banner: "Seller is away until [return date]. Orders will ship after they return."
- Estimated delivery dates auto-adjusted to account for return date + handling time.
- **Buyer must explicitly acknowledge** delayed shipping before checkout: "This seller is currently away. Your order will ship after [date]. Estimated delivery: [date]. [✓] I understand shipping will be delayed."
- No checkbox = cannot complete purchase.
- Handling time countdown starts when seller returns, not when order is placed.

### Pause Sales Mode Detail
- Fixed-price listings hidden from search.
- Buyers who previously added items to cart or watchlist see: "Seller is away until [date]. This item is temporarily unavailable."
- Listings remain in seller's inventory, just not visible.

### Active Orders
- Orders placed BEFORE vacation starts must still be fulfilled normally.
- Seller sees warning when activating vacation: "You have X orders that need to ship before you leave."
- Vacation does not pause ship-by deadlines on pre-existing orders.

### Auto-Reply
- Configurable auto-reply message for new messages during vacation.
- Default: "Thanks for your message! I'm currently away until [return date]. I'll respond when I return."
- Seller can customize the message text.

### Storefront
- Storefront shows vacation banner with return date.
- Store remains browsable (even in Pause mode — listings visible on store page but can't be purchased, just watched).

### Admin Override
- Admin can force-deactivate vacation mode (e.g., if seller set a year-long vacation to avoid shipping).
- Vacation mode max durations enforced at platform level.

### Admin Settings
- `vacation.maxPauseDays`: 30 (default). Maximum days for Pause Sales mode.
- `vacation.maxAllowSalesDays`: 15 (default). Maximum days for Allow Sales mode.
- `vacation.autoDeclinePendingOffers`: true (default). Auto-decline pending offers when vacation starts.
- `vacation.requireBuyerAcknowledgment`: true (default). Require buyer to acknowledge delayed shipping.

---

## 31. Offer Edge Cases (Addendum to Section 1)

### Listing Deactivated/Deleted with Active Offers
- If seller deactivates, ends, or deletes a listing → all pending offers auto-declined, authorization holds released.
- Buyer notified: "This listing is no longer available. Your offer has been cancelled."

### Offer Spam Prevention
- Max 3 active offers per buyer per seller at any time.
- Max 10 active offers per buyer total across all sellers.
- Identical offer to same listing within 24 hours of a decline: blocked. "The seller has already declined a similar offer. Try a different amount."
- Rapid-fire offers (>5 in 60 seconds): rate limited.

### Offer History
- Buyer sees their full offer history at `/my/buying/offers`: all offers sent, status, outcome.
- Seller sees all offers received on their listings: amount, buyer trust signals (purchase count, member since, verified, returns/disputes if any), timestamp, status.
- Both parties see the counter-offer chain on a specific listing.
- Offer amounts are private between buyer and seller — other buyers cannot see what offers have been made, only that "X offers received."

### Bundle Offers
- Buyer selects 2+ items from same seller → "Make Bundle Offer" button.
- Buyer proposes a total price for the bundle.
- Seller sees individual item prices + proposed bundle discount.
- Seller accepts/declines/counters the bundle as a whole.
- If accepted: creates a single order with all items, one shipment, one transaction.
- Bundle offers count as 1 offer toward the per-seller limit.

---

## 32. Cart & Guest Behavior (Addendum to Section 3)

### Guest Browsing
- Guests can browse all listings, view seller stores, search, view categories.
- Signup wall triggers on: add to cart, watch item, message seller, make offer, save search.
- Guest session tracks: recently viewed items (stored in cookie, max 50 items FIFO).

### Session Merge on Signup
- When guest creates account or logs in: recently viewed items from cookie merge into account.
- If guest had items in a "soft cart" (future consideration): items transfer to account cart.
- Merge is one-time on first login of session.

### Cart UI
- Cart icon in navbar shows badge with item count.
- Cart drawer (slide-out panel on desktop) or full page on mobile.
- "Your cart is empty" state with "Browse popular items" CTA.

---

## 33. Admin User Detail Page (hub.twicely.co/usr/[userId])

### The Complete Story on One Page
Everything about a user visible in a single scrollable page with sections:

**Header:**
- Avatar, display name, email, account status badge (ACTIVE/SUSPENDED/RESTRICTED)
- Seller tier badge (if seller)
- Account age: "Member since [date]"
- Last login: "[date] from [city, country]"
- Action buttons: Suspend, Warn, Restrict, Hold Payouts, Reset Password, Impersonate (read-only view as user)

**Account Section:**
- Email (verified/unverified badge)
- Phone (if provided)
- 2FA status (enabled/disabled)
- Verification status (identity, address, tax)
- Seller profile status (ACTIVE/PENDING/DRAFT/SUSPENDED)
- Stripe Connect status (connected/pending/not started)

**Trust Section:**
- Trust score with trend sparkline (last 90 days)
- Seller protection score (if seller) with trend
- DSR averages per category
- Flags: serial returner, chargeback abuser, new account, etc.

**Orders Section (as buyer):**
- Recent 10 orders with status, amount, date
- Total orders count, total spend
- Return rate, dispute rate

**Orders Section (as seller):**
- Recent 10 orders with status, amount, date
- Total orders count, total revenue
- Average ship time, cancellation rate

**Listings Section (if seller):**
- Active listings count, total listings ever
- Average listing price
- Link to filtered listings view

**Support Section:**
- Open helpdesk cases
- Recent 5 resolved cases
- Open disputes/returns

**Messages Section:**
- Flagged messages count
- Recent flags with reasons

**Financial Section (if seller):**
- Current available balance
- Pending payouts
- Active payout holds with reasons
- Total fees paid to Twicely

**Related Accounts (Fraud Investigation):**
- Other accounts sharing: same IP addresses, same device fingerprints, same payment methods, same shipping addresses.
- Displayed as linked cards with account summaries.
- Critical for fraud ring detection.

**Audit Trail:**
- Full chronological audit log for this user (filtered from global audit).
- Searchable, filterable by action type.
- Shows both actions BY this user and actions ON this user by staff.

---

## 34. Accessibility (WCAG 2.1 AA Baseline)

### Requirements (Beta Blocker)
- **Color Contrast**: minimum 4.5:1 for normal text, 3:1 for large text. All Tailwind color combinations verified.
- **Keyboard Navigation**: every interactive element reachable via Tab. Logical tab order. No keyboard traps. Custom components (dropdowns, modals, date pickers) fully keyboard accessible.
- **Focus Indicators**: visible focus ring on all interactive elements. Never `outline: none` without replacement. Focus ring uses Tailwind's `ring` utilities.
- **Screen Reader Support**: all form inputs have associated `<label>`. All images have descriptive `alt` text (listing images: auto-generated from title + "photo X of Y"). ARIA labels on icon-only buttons. ARIA live regions for dynamic content (notification bell count, search results count).
- **Skip Navigation**: "Skip to main content" link as first focusable element on every page.
- **Error States**: errors indicated by icon + text, never by color alone. Form validation errors announced to screen readers via `aria-describedby`.
- **Touch Targets**: minimum 44×44px on all interactive elements (Apple HIG / WCAG).
- **Motion**: `prefers-reduced-motion` media query respected. Animations/transitions disabled when user has reduced motion preference.
- **Text Scaling**: UI remains functional at 200% browser zoom. No horizontal scrolling at 200% on desktop.

### Testing
- Automated: axe-core integrated into CI pipeline. Zero critical/serious violations allowed.
- Manual: keyboard-only navigation test on all pages during QA.
- Screen reader: VoiceOver (macOS/iOS) testing on key flows (search, listing detail, checkout, messaging).

### Admin Settings
- `accessibility.enforceMinContrast`: true. Prevents publishing themes/colors that fail contrast checks.

---

## 35. Rate Limiting

### Architecture
- **Valkey** (Redis fork) backed sliding window rate limiter.
- Rate limits enforced at API middleware layer (before route handler).
- Limits vary by actor type and endpoint category.

### Per-Actor-Type Defaults

| Actor Type | Search/Browse | Write (listings, messages) | Sensitive (login, checkout, payout) |
|------------|---------------|---------------------------|--------------------------------------|
| Guest | 60/min | N/A (must authenticate) | 10/min |
| Authenticated Buyer | 120/min | 30/min | 20/min |
| Authenticated Seller | 120/min | 60/min | 20/min |
| Delegated Staff | 120/min | 60/min | 10/min |
| Helpdesk Agent | 200/min | 100/min | 20/min |
| Admin | 300/min | 200/min | 50/min |
| API Consumer (future) | Per API key plan | Per API key plan | Per API key plan |

### Login-Specific
- 5 failed login attempts → account locked for 15 minutes.
- 10 failed attempts in 1 hour → account locked for 1 hour + email notification to account owner.
- 20 failed attempts in 24 hours → account locked until email verification.
- Failed attempt counter resets on successful login.

### Rate Limit Response
- HTTP 429 Too Many Requests.
- `Retry-After` header with seconds until reset.
- Response body: `{ "error": { "code": "RATE_LIMITED", "message": "Too many requests. Please try again in X seconds.", "retryAfter": 30 } }`

### Admin Settings
- `rateLimit.enabled`: true. Master switch.
- `rateLimit.guestSearchPerMinute`: 60. Guest search rate limit.
- `rateLimit.loginMaxAttempts`: 5. Failed login attempts before lockout.
- `rateLimit.loginLockoutMinutes`: 15. Lockout duration after max attempts.
- All rate limit settings configurable per endpoint group in admin UI. Every setting has description + consequences.

---

## 36. Product Variations

### Concept
A single listing can have multiple variations (size, color, style). Each variation has its own price, quantity, SKU, and photos. Variations are NOT separate listings — they live under one canonical listing.

### Variation Axes
- **Size**: category-driven size system (US shoe sizes, S/M/L/XL, numeric, etc.)
- **Color**: from standard color palette + custom colors
- **Style/Type**: category-dependent (e.g., Regular/Slim/Relaxed for jeans)
- Max 2 axes per listing (e.g., Size × Color). 3+ axes adds too much complexity for resale.

### Variation Data

| Field | Per-Variation | Per-Listing |
|-------|---------------|-------------|
| Price | ✅ (can differ per variant) | Base price shown in search |
| Quantity | ✅ (tracked per variant) | Total shown in search |
| SKU | ✅ (optional, seller-assigned) | N/A |
| Photos | ✅ (optional, variant-specific) | Main photos shared |
| Weight/Dimensions | ❌ (shared) | ✅ |
| Description | ❌ (shared) | ✅ |
| Condition | ❌ (shared) | ✅ |

### Pricing Display
- Search results show: lowest variant price ("From $29.99") or single price if all variants same.
- Listing detail: price updates as buyer selects options.
- If selected variant is out of stock: "This combination is unavailable. Try another size."

### Inventory Rules
- Variations count as ONE listing for insertion fee purposes (same as eBay).
- Variations count as ONE listing for active listing cap.
- Each variation has independent quantity tracking.
- Sale of one variation does NOT delist other variations (only if quantity = 1 for all variants would a sale end the listing).

### Crosslister Integration
- Variations map to platform-native variation systems where supported.
- eBay: multi-variation listing. Poshmark: size selection. Mercari: limited variation support.
- If target platform doesn't support variations: publish as separate listings (one per variant) with auto-linking back to canonical.

### Admin Settings
- `variations.maxAxes`: 2 (default). Maximum variation axes per listing.
- `variations.maxVariantsPerListing`: 50 (default). Maximum total combinations.
- `variations.allowDifferentPrices`: true (default). Allow per-variant pricing.

---

## 37. Data Retention & GDPR

### Data Classification

| Category | Retention | Deletion Method |
|----------|-----------|-----------------|
| Active user data | While account active | On request or account deletion |
| Order records | 7 years (legal/tax requirement) | Pseudonymization after account deletion |
| Financial transactions | 7 years (legal/tax requirement) | Pseudonymization after account deletion |
| Audit logs | 2 years | Auto-purge after retention period |
| Session data | 30 days after expiry | Auto-purge |
| Message content | While either party active | Pseudonymization on deletion |
| Listing data (active) | While listing active | On seller request or account deletion |
| Listing data (sold) | 7 years (ties to order/tax records) | Pseudonymization |
| Analytics/metrics | 2 years aggregated, 90 days granular | Auto-purge granular, keep aggregated |
| Images (R2) | While listing active + 30 days | Hard delete from R2 |

### Account Deletion Flow
1. User requests deletion at `/my/settings/privacy` → 30-day cooling off period.
2. During cooling off: account is DEACTIVATED (hidden from marketplace, login blocked, data preserved).
3. User can reactivate within 30 days by logging in.
4. After 30 days: irreversible deletion begins.
5. Deletion process:
   - User PII (name, email, phone, address) → hard deleted
   - Order records → pseudonymized (buyer/seller replaced with `deleted_user_[hash]`)
   - Messages → pseudonymized
   - Listings → removed from search, images deleted from R2
   - Financial records → pseudonymized, retained for tax compliance
   - Audit logs → retained with pseudonymized actor ID
6. Confirmation email sent (to email on file before deletion).

### GDPR Rights Implementation

| Right | Implementation |
|-------|---------------|
| Right to Access | `/my/settings/privacy` → "Download My Data" → JSON export within 48 hours |
| Right to Erasure | Account deletion flow (above) |
| Right to Rectification | User edits own data in settings |
| Right to Portability | Same as Access — JSON export |
| Right to Restrict Processing | Deactivation mode (data kept but not processed) |
| Right to Object (marketing) | Notification preferences → marketing opt-out |

### Pseudonymization
- Pseudonymized records retain structure for analytics and legal compliance but cannot be traced to a real person.
- Pseudonymization is one-way — no reverse mapping stored.
- Implementation: replace PII fields with `deleted_user_[SHA256(userId + salt)]`.

### Cookie Consent
- Cookie banner for EU/EEA visitors (detected by GeoIP).
- Categories: Strictly Necessary (always on), Functional (opt-in), Analytics (opt-in).
- Consent stored per user/session. Revocable at any time via `/p/cookies`.

### Admin Settings
- `privacy.deletionCoolOffDays`: 30 (default). Days before irreversible deletion.
- `privacy.dataExportMaxHours`: 48 (default). SLA for data export delivery.
- `privacy.orderRetentionYears`: 7 (default). Years to retain pseudonymized order data.
- `privacy.auditLogRetentionMonths`: 24 (default). Months to retain audit logs.
- `privacy.granularAnalyticsRetentionDays`: 90 (default). Days before granular analytics purge.

---

## 38. Feature Flags

### Architecture
Feature flags control rollout of new features, A/B tests, and kill switches. Self-hosted — no external dependency (no LaunchDarkly).

### Flag Types

| Type | Description | Example |
|------|-------------|---------|
| **Boolean** | On/off | `feature.newCheckoutFlow` |
| **Percentage** | Gradual rollout | `rollout.newSearch = 25%` (25% of users) |
| **User Targeting** | Specific users/segments | `beta.crosslister` → only sellers with `betaAccess: true` |
| **Platform** | Per-platform flags | `imports.ebay.enabled`, `crosslister.poshmark.enabled` |

### Flag Storage
- Flags stored in PostgreSQL `feature_flags` table.
- Cached in Valkey with 30-second TTL (fast reads, near-instant propagation on change).
- Client-side: flags fetched on page load via API, cached in React context.

### Evaluation Order
1. User-specific override (if exists) → use it
2. Segment targeting (if matches) → use it
3. Percentage rollout (if configured) → hash(userId + flagKey) determines bucket
4. Default value

### Flag Schema

```typescript
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),                    // e.g. 'feature.newCheckoutFlow'
  description: text('description').notNull(),        // Human-readable explanation
  flagType: flagTypeEnum('flag_type').notNull(),     // BOOLEAN, PERCENTAGE, TARGETED
  defaultValue: boolean('default_value').notNull().default(false),
  percentageValue: integer('percentage_value'),      // 0-100 for rollout
  targetingRules: jsonb('targeting_rules'),           // Segment rules
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Admin UI (`hub.twicely.co/cfg/flags`)
- List all flags with current state, type, description.
- Toggle flags on/off with one click.
- Percentage slider for gradual rollout.
- Targeting rule builder (select segment → apply).
- Audit log showing who changed what flag when.
- "Kill Switch" section: critical flags that can disable features instantly.

### Admin Settings
- `featureFlags.cacheSeconds`: 30 (default). Valkey cache TTL for flag values.
- `featureFlags.requireApprovalForProduction`: false (default). Require 2-person approval for production flag changes.

---

## 39. Audit Logging

### What Gets Logged

Every state-changing action in the system produces an immutable audit event:

| Category | Examples |
|----------|---------|
| Authentication | Login, logout, 2FA enable/disable, password change, session creation |
| User Management | Account creation, email change, profile update, role change, suspension |
| Listings | Create, edit, delete, publish, delist, price change, status change |
| Orders | Order placed, payment captured, shipped, delivered, cancelled |
| Financial | Refund issued, payout sent, payout hold placed, fee adjustment |
| Moderation | Listing flagged, listing removed, user warned, user restricted |
| Admin Actions | Settings changed, feature flag toggled, user impersonated |
| Delegation | Staff added/removed, scope changed, access revoked |
| Crosslister | Import started, publish queued, delist executed, account connected |

### Audit Event Schema

```typescript
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Who
  actorId: uuid('actor_id'),                           // User who performed action
  actorType: actorTypeEnum('actor_type').notNull(),     // USER, ADMIN, SYSTEM, STAFF_DELEGATED
  onBehalfOfId: uuid('on_behalf_of_id'),               // If delegated action
  
  // What
  action: text('action').notNull(),                     // e.g. 'listing.created', 'order.refunded'
  resourceType: text('resource_type').notNull(),        // e.g. 'Listing', 'Order', 'User'
  resourceId: uuid('resource_id'),                      // ID of affected resource
  
  // Details
  changes: jsonb('changes'),                            // Before/after values for updates
  metadata: jsonb('metadata'),                          // IP address, user agent, device fingerprint
  
  // When
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Immutability
- Audit events are INSERT-ONLY. No UPDATE or DELETE operations permitted.
- Database role for audit table has INSERT + SELECT only — no UPDATE/DELETE grants.
- Application code has no delete method for audit events.

### Retention
- 2 years retention.
- Auto-purge via scheduled job (BullMQ cron).
- Before purge: events older than 2 years archived to cold storage (R2 as compressed JSON).

### Access
- Admin: full audit log at `hub.twicely.co/audit` with search/filter.
- Seller: own audit trail visible at `/my/settings/security` (login history, account changes).
- Helpdesk: audit trail for specific users visible in case context.

### Admin Settings
- `audit.retentionMonths`: 24 (default). Months before auto-purge.
- `audit.archiveBeforePurge`: true (default). Archive to cold storage before deleting.
- `audit.logIpAddresses`: true (default). Include IP in audit metadata.

---

## 40. Background Jobs (BullMQ)

### Queue Architecture

All background work runs through BullMQ backed by Valkey.

| Queue | Purpose | Concurrency | Retry | Dead Letter |
|-------|---------|-------------|-------|-------------|
| `default` | General purpose (email, cleanup) | 10 | 3× exponential | Yes |
| `orders` | Order processing, payment capture | 5 | 3× exponential | Yes |
| `notifications` | Email, push, SMS delivery | 20 | 3× linear 60s | Yes |
| `analytics` | Metrics rollup, report generation | 5 | 2× | No (recomputable) |
| `imports` | Listing imports from external platforms | 10 | 3× exponential | Yes |
| `lister` | Crosslister scheduling (see Lister Canonical) | 50 | Varies by job type | Yes |
| `media` | Image processing, thumbnail generation, BG removal | 10 | 2× | Yes |
| `cleanup` | Data retention purge, session cleanup, cache warmup | 3 | 1× | No |
| `scheduled` | Cron-like recurring jobs | 5 | 1× | No |

### Recurring Jobs (Cron)

| Job | Schedule | Queue | Description |
|-----|----------|-------|-------------|
| Daily analytics rollup | 02:00 UTC | analytics | Aggregate daily metrics |
| Weekly digest generation | Sundays 08:00 UTC | notifications | Generate weekly digest emails |
| Session cleanup | Every 6 hours | cleanup | Purge expired sessions |
| Audit archive | Monthly 1st, 03:00 UTC | cleanup | Archive old audit events |
| Stale listing alert | Daily 10:00 UTC | notifications | Alert sellers about stale inventory |
| Payout processing | Daily 06:00 UTC | orders | Process pending payouts |
| Feature flag cache refresh | Every 30 seconds | default | Warm Valkey cache |
| Health check ping | Every 60 seconds | default | Platform health verification |

### Retry Strategies

| Strategy | Backoff | Use Case |
|----------|---------|----------|
| Exponential | 30s, 120s, 480s | External API calls (Stripe, platform connectors) |
| Linear | 60s, 60s, 60s | Notification delivery |
| Immediate | 0s, 0s, 0s | Idempotent recomputation (analytics) |

### Dead Letter Queue (DLQ)
- Failed jobs that exhaust retries move to DLQ.
- Admin dashboard at `hub.twicely.co/jobs` shows: pending, active, completed, failed, dead-lettered.
- Admin can: inspect payload, retry individually, retry all, delete.
- Alert triggered if DLQ depth exceeds 100 jobs.

### Monitoring
- Prometheus metrics per queue: throughput, latency, error rate, queue depth, DLQ depth.
- Grafana dashboard: "Background Jobs" with per-queue panels.
- Alert rules: queue depth > 1000, DLQ > 100, job latency p95 > 30s.

### Admin Settings
- `jobs.defaultConcurrency`: 10. Default worker concurrency.
- `jobs.dlqAlertThreshold`: 100. DLQ depth before alert fires.
- `jobs.maxRetries`: 3. Default max retries.

---

## 41. Monitoring & Observability

### Stack
- **Prometheus**: metrics collection (counters, gauges, histograms)
- **Grafana**: dashboards and alerting
- **Loki**: log aggregation and search

### Key Dashboards (Grafana)

| Dashboard | Panels |
|-----------|--------|
| **Platform Overview** | Active users, orders/hour, revenue today, error rate, p95 latency |
| **API Performance** | Request rate, latency by route, error rate by route, slow queries |
| **Orders & Payments** | Orders placed, payment success rate, refund rate, Stripe webhook latency |
| **Crosslister** | Publishes/hour, import throughput, emergency delist latency, connector health |
| **Background Jobs** | Queue depth, throughput, DLQ depth, job latency per queue |
| **Search** | Typesense query latency, index size, search conversion rate |
| **Infrastructure** | CPU, memory, disk, network, PostgreSQL connections, Valkey memory |

### Application Metrics (Prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests by route, method, status |
| `http_request_duration_seconds` | Histogram | Request latency by route |
| `orders_total` | Counter | Orders by status |
| `payments_total` | Counter | Payment attempts by outcome |
| `listings_active` | Gauge | Current active listing count |
| `users_active_daily` | Gauge | DAU count |
| `crosslister_publishes_total` | Counter | Publishes by platform, outcome |
| `crosslister_delist_latency_seconds` | Histogram | Emergency delist latency |
| `bullmq_queue_depth` | Gauge | Jobs pending per queue |
| `bullmq_job_duration_seconds` | Histogram | Job processing time per queue |
| `search_queries_total` | Counter | Search queries by type |
| `search_latency_seconds` | Histogram | Search response time |

### Alert Rules

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| High Error Rate | 5xx rate > 5% for 5 min | Critical | Slack + PagerDuty |
| Slow API | p95 latency > 2s for 10 min | Warning | Slack |
| Payment Failures | Payment failure rate > 10% for 5 min | Critical | Slack + PagerDuty |
| DLQ Growing | Any DLQ > 100 jobs | Warning | Slack |
| Database Connections | Pool > 80% utilized | Warning | Slack |
| Disk Space | Any volume > 85% | Warning | Slack |
| Crosslister Down | Any connector error rate > 50% for 10 min | Critical | Slack |

### Logging (Loki)
- Structured JSON logs from Next.js application.
- Log levels: DEBUG, INFO, WARN, ERROR.
- Production default: INFO and above.
- Every log line includes: timestamp, requestId, userId (if authenticated), route, level, message.
- Sensitive data (tokens, passwords, PII) NEVER logged.

### Admin Settings
- `monitoring.alertSlackWebhook`: Slack webhook URL for alerts.
- `monitoring.logLevel`: "INFO" (default). Minimum log level in production.
- `monitoring.metricsRetentionDays`: 90 (default). Prometheus retention period.

---

## 42. Returns & Disputes

### Return Reasons

| Reason | Code | Fault | Who Pays Return Shipping |
|--------|------|-------|--------------------------|
| Item Not As Described | INAD | Seller | Seller |
| Item Damaged in Transit | DAMAGED | Carrier/Platform | Platform (if Twicely label) or Seller |
| Item Not Received | INR | Seller/Carrier | N/A (no return needed) |
| Counterfeit | COUNTERFEIT | Seller | Seller |
| Changed Mind | REMORSE | Buyer | Buyer |
| Wrong Item Sent | WRONG_ITEM | Seller | Seller |

### Return Flow (RMA)
1. Buyer initiates return at `/my/buying/orders/[orderId]` → selects reason + evidence photos.
2. System creates Return Request (status: PENDING_SELLER).
3. Seller notified → 3 business days to: Accept, Decline (with evidence), or Propose Partial Refund.
4. If seller accepts → return label generated (who pays based on fault table above).
5. Buyer ships item back → tracking monitored.
6. Item received by seller → seller confirms condition → refund issued.
7. If seller declines and buyer disagrees → escalation to Twicely (see Disputes below).

### Return States
```
PENDING_SELLER → APPROVED → LABEL_GENERATED → SHIPPED → DELIVERED → 
  → REFUND_ISSUED (happy path)
  → CONDITION_DISPUTE (seller disputes returned item condition)

PENDING_SELLER → DECLINED → 
  → BUYER_ACCEPTS (case closed)
  → ESCALATED (buyer disagrees → dispute)

PENDING_SELLER → PARTIAL_OFFERED →
  → BUYER_ACCEPTS_PARTIAL (partial refund issued)
  → BUYER_DECLINES_PARTIAL → ESCALATED
```

### Dispute Escalation
- When buyer and seller can't agree, case escalates to Twicely helpdesk.
- Helpdesk agent reviews: listing photos, buyer evidence, seller evidence, order details, communication history.
- Decision within 48 hours.
- Outcomes: full refund, partial refund, no refund, return required.
- Both parties can appeal once within 30 days with new evidence.

### Fee Allocation on Returns (Fault-Based)

| Fault Type | TF Refund | Payment Processing | Return Shipping |
|-----------|-----------|-------------------|-----------------|
| Seller Fault (INAD, WRONG_ITEM) | Twicely refunds TF | Seller absorbs | Seller pays |
| Buyer Remorse (REMORSE) | Twicely keeps TF | Buyer absorbs | Buyer pays |
| Carrier/Platform Fault (DAMAGED with Twicely label) | Twicely refunds TF | Platform absorbs | Platform pays |
| Counterfeit | Twicely refunds TF | Seller absorbs | Seller pays + possible suspension |

### Admin Settings
- `returns.sellerResponseDays`: 3 (default). Business days for seller to respond.
- `returns.returnShipByDays`: 7 (default). Days buyer has to ship return after label generated.
- `returns.autoApproveUnderCents`: 1000 (default, $10). Auto-approve returns under this amount.
- `returns.maxReturnsPerBuyerPerMonth`: 10 (default). Flag serial returners above this.

---

## 43. Tax & Compliance

### Sales Tax Collection
- Twicely collects sales tax as marketplace facilitator in states where required.
- Tax calculated at checkout based on: buyer shipping address, item category, seller state.
- Tax rate sourced from third-party tax API (TaxJar or similar) — not hardcoded.
- Tax shown as separate line item at checkout: "Sales tax: $X.XX"
- Tax collected by Twicely and remitted to states — seller is NOT responsible for marketplace sales tax in facilitator states.

### 1099-K Reporting
- IRS requires 1099-K for sellers exceeding $600/year in gross sales (current threshold).
- Twicely collects tax info (SSN or EIN + legal name + address) from sellers approaching threshold.
- Collection triggered at $500 in sales (early warning) via in-app prompt.
- Seller must complete tax info before next payout if over $600.
- 1099-K generated annually, available for download at `/my/selling/tax` by January 31.
- Filed electronically with IRS.

### Tax Information Collection
- `/my/selling/tax`: seller enters SSN or EIN, legal name, address.
- Data encrypted at rest (AES-256-GCM), stored in separate database table with restricted access.
- Only accessible by: the seller, compliance admin role.
- Not visible to regular admin, helpdesk, or any other role.

### International Considerations (Future)
- VAT collection for EU sales: future phase, not beta.
- GST for Australian sales: future phase.
- Canadian GST/HST: future phase.
- Framework: tax rules stored as configurable per-jurisdiction records, not hardcoded.

### Admin Settings
- `tax.facilitatorEnabled`: true (default). Enable marketplace facilitator tax collection.
- `tax.1099kThresholdCents`: 60000 (default, $600). IRS reporting threshold.
- `tax.earlyWarningThresholdCents`: 50000 (default, $500). Prompt seller for tax info.
- `tax.taxApiProvider`: "taxjar" (default). Third-party tax rate provider.

---

## 44. Seller Standards & Enforcement

### Performance Metrics Tracked

| Metric | Measurement | Threshold (Warning) | Threshold (Restriction) |
|--------|-------------|--------------------|-----------------------|
| Shipping time | % orders shipped within handling time | < 90% | < 80% |
| Cancellation rate | % orders cancelled by seller | > 3% | > 5% |
| INAD rate | % orders with INAD claims | > 2% | > 4% |
| Response time | Median message response time | > 24 hours | > 48 hours |
| Return rate | % orders returned (seller fault) | > 5% | > 10% |
| Tracking upload rate | % orders with tracking uploaded on time | < 95% | < 85% |

Metrics calculated on rolling 90-day window with minimum 10 orders (below 10 orders: metrics not enforced).

### Enforcement Tiers

| Tier | Trigger | Actions |
|------|---------|---------|
| **Coaching** | 1 metric at warning level | In-app notification with improvement tips. No restrictions. |
| **Warning** | 2+ metrics at warning OR 1 at restriction | Email warning. 30-day improvement window. Seller dashboard shows warning banner. |
| **Restriction** | 2+ metrics at restriction level after warning period | Listing visibility reduced (pushed down in search). Boosting disabled. "Below Standard" badge visible to buyers. |
| **Suspension** | Continued restriction-level performance for 90+ days OR severe policy violation | Account suspended. Active listings hidden. Pending orders must still be fulfilled. Appeal available. |

### PerformanceBand Integration
- Seller standards directly feed the PerformanceBand calculation.
- STANDARD: meets minimum thresholds.
- RISING: above average on all metrics for 30+ days.
- TOP_RATED: top 10% on all metrics for 90+ days.
- POWER_SELLER: TOP_RATED + volume threshold (50+ orders/month).
- Sellers with active warnings cannot be TOP_RATED or POWER_SELLER.

### Policy Violations (Separate from Performance)

| Violation | Consequence |
|-----------|-------------|
| Counterfeit item (confirmed) | Listing removed + warning. 2nd offense: 30-day suspension. 3rd: permanent ban. |
| Prohibited item | Listing removed + warning. Repeated: escalating restrictions. |
| Shill bidding / fake reviews | Immediate suspension pending review. |
| Fee avoidance (off-platform transactions) | Warning → restriction → suspension. |
| Harassment in messages | Warning → messaging restricted → suspension. |

### Seller Dashboard
- `/my/selling/performance`: shows all metrics with trend lines, thresholds, and improvement suggestions.
- Green/yellow/red indicators per metric.
- "How to improve" expandable tips per metric.
- Historical performance graph (90-day rolling).

### Admin Settings
- `sellerStandards.evaluationWindowDays`: 90 (default). Rolling window for metric calculation.
- `sellerStandards.minimumOrders`: 10 (default). Minimum orders before enforcement.
- `sellerStandards.warningPeriodDays`: 30 (default). Days to improve after warning.
- `sellerStandards.restrictionToSuspensionDays`: 90 (default). Days before restriction escalates.
- All thresholds configurable per metric in admin UI.

---

## 45. Identity Verification (KYC)

### When Verification Is Required

| Trigger | Verification Level |
|---------|-------------------|
| Seller exceeds $600 in sales | Tax info collection (SSN/EIN) — see §43 |
| Seller applies for Store Pro+ | Enhanced ID verification |
| Seller requests payout increase above $10,000/month | Enhanced ID verification |
| Fraud flags triggered (linked accounts, chargeback patterns) | Enhanced ID verification |
| Seller in luxury/authentication-required categories | Category-specific verification |
| Admin manual request | Any level |

### Verification Levels

| Level | What's Collected | Method |
|-------|-----------------|--------|
| **Basic** | Email verified + phone verified | OTP via email and SMS |
| **Tax** | SSN/EIN + legal name + address | Self-reported, validated against IRS databases |
| **Enhanced** | Government-issued photo ID + selfie match | Third-party KYC provider (Stripe Identity or similar) |
| **Category** | Additional credentials per category | Authentication certificates, business licenses |

### Verification Flow
1. System determines required verification level based on triggers.
2. Seller prompted with clear explanation: "To continue selling in [category / at this volume], we need to verify your identity."
3. Seller submits required documents/information.
4. Automated verification (KYC provider) → result within minutes for most cases.
5. Manual review queue for edge cases (blurry photos, name mismatches).
6. Status: PENDING → VERIFIED or FAILED (with reason and retry option).

### Verification Status Effects

| Status | Impact |
|--------|--------|
| NOT_REQUIRED | No restrictions |
| PENDING | Payout hold until verified. Can continue selling. |
| VERIFIED | Full access. Badge shown on profile (optional). |
| FAILED | Payouts blocked. 30 days to retry. After 30 days: account restricted. |
| EXPIRED | Re-verification required (Enhanced expires after 2 years). |

### Privacy
- KYC documents processed by third-party provider — Twicely does NOT store raw ID images.
- Only verification status and metadata (verified date, provider, level) stored in Twicely database.
- Tax information (SSN/EIN) encrypted at rest in isolated table with restricted access.
- GDPR: verification data included in data export and deleted on account deletion.

### Admin Settings
- `kyc.provider`: "stripe_identity" (default). Third-party KYC provider.
- `kyc.enhancedThresholdCents`: 1000000 (default, $10,000). Monthly payout threshold triggering enhanced verification.
- `kyc.enhancedExpirationMonths`: 24 (default). Months before enhanced verification expires.
- `kyc.failedRetryDays`: 30 (default). Days to retry after failed verification.
- `kyc.autoVerifyBasic`: true (default). Auto-verify basic level (email + phone) without manual review.

---

## 46. Crosslister UX Integration

### Design Principle
The crosslister is not a separate app. It's woven into the existing seller experience — sidebar, listing form, orders page. Zero friction means the seller never thinks "now I'm using the crosslister." They're just selling, and it happens to work across platforms.

### Sidebar Status Widget

**Visibility rule:** Widget renders ONLY if seller has any ListerTier other than NONE. No subscription = no widget, no Crosslister menu item. Clean sidebar.

**Structure:** Nested under the Crosslister sidebar menu item. Collapsible via chevron — collapsed hides detail but Crosslister menu item stays visible.

**Widget contents (when expanded):**
- Per-platform row: status dot (green/amber/red) + platform icon + platform name + active listing count
- Green = connected and healthy. Amber = re-auth needed OR import in progress. Red = error state.
- If an import is running: progress bar with "67 / 142" counter. Bar color matches status (amber during import, green on completion).
- Queue summary: "5 publishing · 12 queued" — tells seller the system is working without clicking into anything.

**Real-time updates:** Widget updates via Centrifugo. Import progress, queue depth, and platform status changes push to the sidebar without page refresh.

### Listing Form: Crosslist Toggles

**Subscription gating — two states:**

**State 1: Has ListerTier subscription (LITE+)**
- Section appears after all standard fields, before the Publish button.
- Header: "⚡ Also list on" with ListerTier badge (e.g., "Lister Pro").
- One row per connected platform. Each row shows:
  - Checkbox (checked by default if platform is ready)
  - Platform icon + name
  - Readiness indicator: "✓ Ready to list" (green) or "⚠ Missing: [field]" (amber) with inline "Add now" link
- Platforms with missing required fields: checkbox disabled, amber border. Seller must fill missing fields before that platform is selectable.
- Below toggles: publish usage meter in mono font ("67 / 400 publishes used this month").
- Publish button text reflects selection: "Publish to Twicely + 2 platforms" (dynamic count).

**State 2: No ListerTier subscription (NONE)**
- Section appears in same position but grayed out with locked appearance.
- Platform icons visible but faded (opacity ~35%).
- One-line upsell: "List on eBay, Poshmark, Mercari and more → Crosslister from $9.99/mo" with link to subscription page.
- Publish button: "Publish to Twicely" only.
- Never fully hidden — passive discovery. Seller sees what exists, isn't annoyed by it.

### Unified Orders Page

**All orders in one table** — Twicely orders and external platform orders (detected via crosslister sale detection) in a single view.

**Platform identification:**
- Platform chip on every order row: colored pill with platform icon + name (e.g., teal "Twicely", red "eBay", purple "Poshmark", cyan "Mercari").
- Filter chips above table: "All | Twicely | eBay | Poshmark | Mercari" — toggle to view one platform or all.

**Shipping integration — Print Label:**
- "Print Label" button appears on ALL orders with status "Needs Shipping" regardless of platform.
- Label generated via Twicely's shipping integration (Shippo). Seller buys and prints label without leaving Twicely.
- Works for Twicely orders and external platform orders identically — same button, same flow.

**Shipping integration — Push Tracking:**
- "Push Tracking" button appears on external platform orders WHERE the platform API supports tracking updates.
- eBay: ✓ supported (Tier A API). Tracking number pushed automatically after label purchase, or manually via button.
- Mercari: ✓ supported (Tier B API). Same flow.
- Poshmark: ✗ not supported via API (Tier C). Button does NOT appear. Instead: "View on Poshmark ↗" link. Seller adds tracking on Poshmark directly.
- Depop, Etsy, etc.: per-platform support determined by connector tier. If API supports it, button appears. If not, link out.

**External order limitations — honest UX:**
- External orders are read-only in Twicely for actions we can't perform: refunds, buyer messaging, case management.
- Order detail page for external orders shows: order data (item, price, buyer, tracking) + clear notice: "This order was placed on [Platform]. Refunds, messages, and disputes are managed on [Platform]." + direct link to the order on the external platform.
- Twicely orders get full control (refund, message, dispute, etc.). External orders get visibility + shipping + link out.

### Cross-Platform Price Editing

**Where it lives:** Crosslister command center (`/my/selling/crosslist`), NOT the main listing edit page.

**How it works:** Listing table in command center shows per-platform price columns. Seller clicks a price → inline edit → saves → queues SYNC job to update the external platform. The canonical Twicely price is a separate column and only changes if seller explicitly edits it.

**Separation of concerns:** The main listing edit page (`/my/selling/listings/[id]/edit`) edits the canonical Twicely listing. Platform-specific overrides (price, title, description) live exclusively on the crosslister command center. This prevents confusion about "which price is the real price."

### Profit Margin Calculator (Command Center)

**Location:** Crosslister command center, visible when editing a listing's cross-platform pricing.

**How it works:** When seller sets or edits a price, a panel shows projected net profit per platform:

| Platform | Fee | You Keep | Margin |
|----------|-----|----------|--------|
| Twicely | $8.90 (10%) | $80.10 | 90% |
| eBay | $12.90 (14.5%) | $76.10 | 85.5% |
| Poshmark | $17.80 (20%) | $71.20 | 80% |
| Mercari | $8.90 (10%) | $80.10 | 90% |

- "Suggest prices" button: calculates per-platform prices that equalize net profit across all platforms. Seller can accept per platform or ignore.
- Fee data sourced from admin-maintained static fee table per platform. Updated quarterly by Twicely staff. NOT real-time API calls, NOT machine learning.
- Disclaimer: "Fees are approximate. Verify current rates on each platform."

### Admin Settings
- `crosslisterUx.showLockedPreview`: true (default). Show locked crosslist section to non-subscribers.
- `crosslisterUx.sidebarWidgetEnabled`: true (default). Enable sidebar status widget.
- `crosslisterUx.pushTrackingEnabled`: true (default). Enable Push Tracking for supported platforms.
- `crosslisterUx.profitCalculatorEnabled`: true (default). Enable profit margin calculator.
- `crosslisterUx.feeTableLastUpdated`: date. Last time platform fee table was updated by admin.

---

## Architecture Notes

### One App, Subdomain Routing
- Single Next.js application, single deployment.
- Middleware inspects hostname: `hub.twicely.co` → corp/helpdesk routes. `twicely.co` → marketplace routes.
- Separate cookies per subdomain (different origin).
- Separate CSP headers per subdomain.
- Separate rate limits per subdomain.

### Dashboard Customization (`/my`)
- Widget-based dashboard. Each widget is a React component fetching its own data.
- Layout stored as JSON on user record: `[{widgetId, position, size}]`.
- Sidebar with pinnable links, collapsible to icons.
- Smart defaults based on buying/selling activity. User can customize via drag-and-drop edit mode.
- Widget sizes: small (1/3), medium (1/2), large (full width).

---

**END OF FEATURE LOCK-IN DOCUMENT**
**46 domains locked. Crosslister, Helpdesk, and Knowledge Base have dedicated canonicals.**
**Vocabulary: StoreTier (storefront), ListerTier (crosslister), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**
