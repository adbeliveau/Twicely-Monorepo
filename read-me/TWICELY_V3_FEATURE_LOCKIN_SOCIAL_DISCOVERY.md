# Feature Lock-in §51 — Social & Discovery

**Status:** LOCKED
**Date:** 2026-02-21
**Philosophy:** Social enhances discovery, never gates visibility. No Poshmark sharing tax.
**Reference:** Decision Rationale §55, §56

Apply to `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` as §51.

---

## 51. Social & Discovery

### Core Principle
Social features are **optional discovery tools** for buyers and **passive distribution** for sellers. No social activity ever affects search ranking, seller score, or listing visibility. The seller score system (Seller Score Canonical) and boosting system (Feature Lock-in §13) handle visibility — social is a separate layer.

### Follow System

**Mechanics:**
- Any logged-in user can follow any seller via button on storefront (`/st/{slug}`) or listing detail (`/i/{slug}`)
- Follow creates a record in the `follow` table (Schema §16.1, already exists)
- Following is one-way — no follow-back requirement, no mutual follow concept
- Unfollow available at any time
- Follow count displayed publicly on storefront: "X followers"

**What following does for the BUYER:**
- Followed sellers' new listings appear in the buyer's feed (`/my/feed`)
- Optional notification: "New from [Seller]: [Item Title]" (configurable in notification preferences)
- Followed sellers appear in "Sellers You Follow" section on explore page

**What following does NOT do for the SELLER:**
- Does NOT affect search ranking or search multiplier
- Does NOT affect seller score
- Does NOT unlock any features or tiers
- Does NOT count toward any performance metric
- Seller sees follower count on their dashboard — informational only

### Feed (`/my/feed`)

**Location:** `/my/feed` — accessible from main navigation for logged-in users

**Content (in order of priority):**
1. New listings from followed sellers (last 7 days, sorted by `activatedAt DESC`)
2. Price drops on watchlisted items
3. New matches for saved searches
4. Personalization-suggested listings (from interest tags + behavioral learning — see Personalization Canonical)

**UI:**
- Infinite scroll, card-based layout (image, title, price, seller name + badge, time listed)
- Filter chips: "All", "Following", "Price Drops", "Saved Searches"
- Empty state (no follows, no watchlist): show personalized suggestions + prompt to follow sellers or save searches
- Mobile: full-width cards. Desktop: 2-3 column grid.

**Technical:**
- Query: `SELECT FROM listing WHERE sellerId IN (SELECT followedId FROM follow WHERE followerId = :userId) AND activatedAt > NOW() - 7 days ORDER BY activatedAt DESC`
- Paginated, cached per user, invalidated on new listing from followed seller
- No real-time push — refreshes on page load. Centrifugo notification for "new listing from followed seller" is separate.

### Social Sharing (External)

**Mechanics:**
- Share button on every listing page and storefront page
- Triggers native OS share sheet via `navigator.share()` API on mobile
- Desktop: copy-link button + direct share icons (Twitter/X, Facebook, WhatsApp, Pinterest)
- No internal sharing mechanics — sharing is ALWAYS to external platforms

**Open Graph Metadata (on every `/i/` and `/st/` page):**
```
og:title       — Item title or Store name
og:description — Price + condition + seller badge (listings) or follower count + item count (stores)
og:image       — Primary listing image or store banner (1200×630 optimized)
og:url         — Canonical URL
og:type        — product (listings) or profile (stores)
og:site_name   — Twicely
```

**Generated Share Image (optional enhancement):**
- API endpoint: `/api/og/listing/[id]` and `/api/og/store/[slug]`
- Returns branded card image: item photo + price + Twicely logo + seller badge
- Used as `og:image` fallback when primary image isn't 1200×630
- Generated via `@vercel/og` or `satori` (runs on server, no external dependency)

**Platform-specific:**
- Pinterest: include `product:price:amount` and `product:price:currency` meta tags for rich pins
- Twitter/X: `twitter:card = summary_large_image`

### Video on Listings

**Spec:**
- 1 video per listing, optional
- Duration: 15-60 seconds (enforced on upload)
- Max file size: 100MB
- Formats: MP4 (H.264), MOV, WebM
- Storage: Cloudflare R2 (same bucket as images, different prefix)
- Displayed on listing detail page ABOVE the photo gallery as hero content
- Autoplay muted on listing page load, unmute on tap
- Thumbnail: first frame extracted on upload, stored as image

**Mobile recording:**
- In-app camera access during listing creation
- Record directly or upload from gallery
- Basic trim tool (set start/end point) — no filters, no editing
- Phase: schema + upload in next schema addendum, mobile recording UX in G1

**Schema addition:**
```
listing.videoUrl       text (nullable)
listing.videoThumbUrl  text (nullable)
listing.videoDuration  integer (nullable, seconds)
```

**Use cases:**
- Try-on videos (apparel)
- Condition walkthrough (electronics, collectibles)
- Detail shots that photos can't capture (material texture, mechanism function)
- Unboxing / authentication evidence

### Public Q&A on Listings

**Mechanics (Amazon-style, NOT Poshmark comments):**
- Buyer asks a question on any listing → appears as "Question" on listing page
- Seller answers → answer appears below question, visible to ALL potential buyers
- One question creates one Q&A pair — no back-and-forth threads
- Seller can pin up to 3 "best" Q&A pairs to top of section
- Questions visible to all buyers; reduces repeat inquiries

**Moderation:**
- Automated scan for phone numbers, emails, external payment mentions (same as messages)
- Flagged questions hidden until reviewed
- Seller can report/hide inappropriate questions
- Questions do NOT count as "messages" for response time metrics

**Schema:**
```
listing_question:
  id               text PK
  listingId        text FK → listing
  askerId          text FK → user
  questionText     text (500 char max)
  answerText       text (nullable, 1000 char max)
  answeredAt       timestamp (nullable)
  answeredBy       text FK → user (nullable — seller or staff delegate)
  isPinned         boolean default false
  isHidden         boolean default false
  createdAt        timestamp
  updatedAt        timestamp
```

**Display:**
- Section on listing detail page below description, above reviews
- Header: "Questions & Answers (X)"
- Pinned Q&As first, then by recency
- Unanswered questions shown to seller with "Answer" button
- Buyer sees "Ask a Question" button → inline form, no page navigation
- If seller hasn't answered: "Waiting for seller's answer" label

**Notifications:**
- Seller notified on new question (in-app + email based on preferences)
- Asker notified when seller answers
- No notification to other buyers when a Q&A is posted

### Bundle Negotiation from Seller Store

**Flow:**
1. Buyer browses seller's store (`/st/{slug}`)
2. Buyer selects 2+ items → "Request Bundle Price" button appears
3. System creates a **bundle offer** — private thread between buyer and this seller
4. Seller sees bundle request in their offers dashboard with items listed
5. Seller proposes a combined price (must be ≤ sum of individual prices)
6. Buyer accepts → single checkout, single payment, single shipment
7. Buyer declines → items return to normal availability
8. Seller declines → buyer notified, items unchanged

**Rules:**
- Minimum 2 items, maximum 10 items per bundle
- All items must be from the same seller
- Bundle price creates a single Stripe authorization hold (like offers)
- TF calculated on the BUNDLE price (not individual item prices)
- Combined shipping applies per seller's shipping mode (Feature Lock-in §50)
- Bundle offer expires in 48 hours if seller doesn't respond
- Seller can counter with a different price (single round — no back-and-forth haggling)
- Platform settings: `offers.bundleMinItems: 2`, `offers.bundleMaxItems: 10`, `offers.bundleExpiryHours: 48`

**Schema:**
- Uses existing `offer` table with `offerType: 'BUNDLE'`
- New junction: `offer_bundle_item` (offerId FK, listingId FK)
- Bundle offers reference multiple listings instead of one

**Phase:** C2 (alongside regular offers — same infrastructure)

### Explore / Discovery Feed (`/explore`)

**Location:** `/explore` — linked from main navigation, prominent on homepage

**Sections:**
1. **Trending** — listings with highest view/watchlist/offer velocity in last 48 hours
2. **New Arrivals** — most recent listings matching buyer's interest tags (Personalization Canonical)
3. **Staff Picks** — editorially curated collections by Twicely staff (admin tool at `hub.twicely.co/mod/collections`)
4. **From Sellers You Follow** — if logged in with follows, latest from followed sellers
5. **Price Drops** — listings with recent price reductions matching buyer's browsing history
6. **Categories For You** — personalization-suggested category cards based on interest tags

**Curation tools (hub admin):**
- Staff creates "collections" with title, description, cover image, and manually-selected listings
- Collections have `startDate` and `endDate` for seasonal/themed content
- Collections appear in Explore and can be linked from homepage
- Admin route: `hub.twicely.co/mod/collections`

**Technical:**
- Trending: materialized view refreshed every 15 minutes via BullMQ job
- Personalization sections: computed from interest tags + browsingHistory (Personalization Canonical)
- Staff picks: stored in `curated_collection` + `curated_collection_item` tables
- No infinite algorithmic feed — discrete sections with "See More" links to search results

**Phase:** G3

### Visual Grid Default Store View

**Change to Feature Lock-in §7 (Storefront Editor):**
- Default store layout: **photo grid** (Depop-style) — square thumbnails in 3-column grid (mobile) or 4-5 column (desktop)
- Toggle available: grid view ↔ list view (eBay-style with title, price, details)
- Seller chooses default via storefront editor, buyer can switch
- Grid view uses listing primary image, cropped to square, with price overlay at bottom-left
- Hover (desktop): shows title + condition + shipping info
- This makes stores feel like Instagram profiles — visual brand identity

**Phase:** D1 (storefront build)

### Creator Affiliate Extension

**Extension to existing affiliate spec (G1.2-G3.5):**

The existing affiliate system covers: community self-serve signup, promo codes, referral links for new user acquisition, influencer applications, payout jobs.

**New capability:** Approved affiliates can generate a trackable link to **any specific listing** on Twicely (not just referral signup links).

**Flow:**
1. Approved affiliate browses Twicely, finds a listing they want to promote
2. Clicks "Get Affiliate Link" (visible only to approved affiliates when logged in)
3. System generates `twicely.co/i/{slug}?ref={affiliateCode}`
4. Affiliate shares link on TikTok, Instagram, YouTube, blog, wherever
5. Buyer clicks link → cookie set (7-day attribution window, matching boosting)
6. Buyer purchases → affiliate earns commission

**Commission structure:**
- Default: 3% of sale price (configurable per affiliate tier in Platform Settings)
- Paid by seller (deducted from payout, same line as TF and auth fee — settles in THIS transaction)
- Seller opt-in: sellers can enable/disable affiliate commission on their listings
- Platform setting: `affiliate.defaultCommissionPercent: 3`, `affiliate.attributionWindowDays: 7`

**Seller controls:**
- Seller Settings → Affiliate: "Allow affiliates to earn commission on my listings" (default: ON)
- Seller can set custom commission rate (2-10%) to attract more affiliate promotion
- Seller dashboard shows: "Sales from affiliates: X this month, $Y commission paid"

**Why sellers opt in:** An affiliate with 200K followers promoting your $200 jacket costs you $6 commission but drives a sale that might never have happened. It's like boosting but someone else does the marketing.

**Anti-fraud (already spec'd in G3.5):** Self-referral detection, IP/device fingerprinting, payment method matching. Affiliate can't buy their own promoted items.

### Live Selling (Post-Launch — 6-12 Months)

**NOT built in V3. Design data model during Phase G for future implementation.**

**What it is:** Seller goes live, shows items one by one, buyers purchase in real-time stream. Whatnot model.

**Requirements when built:**
- Video streaming infrastructure (WebRTC or HLS)
- Real-time purchasing during stream (product queue, "Add to Cart" overlay)
- Chat moderation (real-time content scanning)
- Stream recording + replay
- Scheduled streams with notifications to followers
- Revenue model: standard TF on live sales (no extra fee)

**Schema to design during G (not build):**
```
live_session:
  id, sellerId, title, description, scheduledAt, startedAt, endedAt,
  status (SCHEDULED/LIVE/ENDED/CANCELLED), viewerCount, replayUrl

live_session_product:
  id, sessionId, listingId, displayOrder, featuredAt, soldAt
```

**Trigger to build:** Marketplace reaching 10K+ monthly active buyers AND seller demand signal from storefront analytics.

---

### Admin Settings (§51)

```
social.followNotificationsEnabled: true
social.feedRefreshIntervalMinutes: 15
social.trendingWindowHours: 48
social.trendingRefreshMinutes: 15
social.maxPinnedQA: 3
social.questionMaxLength: 500
social.answerMaxLength: 1000
social.videoMaxDurationSeconds: 60
social.videoMinDurationSeconds: 15
social.videoMaxSizeMB: 100
social.videoAllowedFormats: ["mp4", "mov", "webm"]
social.bundleMinItems: 2
social.bundleMaxItems: 10
social.bundleOfferExpiryHours: 48
social.exploreStaffPicksEnabled: true
social.defaultStoreLayout: "grid"
affiliate.listingLinkEnabled: true
affiliate.defaultCommissionPercent: 3
affiliate.maxCommissionPercent: 10
affiliate.attributionWindowDays: 7
affiliate.sellerOptInDefault: true
```

### Phase Summary

| Feature | Schema | UI/Logic | Phase |
|---------|--------|----------|-------|
| Follow system | Exists (§16.1) | Follow button + feed page | G3 |
| Feed (`/my/feed`) | Exists (follow, watchlist, savedSearch) | Feed page + notification integration | G3 |
| Social sharing | None needed | OG tags + share button | B1 update (trivial) |
| Video on listings | Next schema addendum | Upload + display + mobile recording | Addendum, G1 |
| Public Q&A | Next schema addendum | Listing detail section + notifications | Addendum, E1 |
| Bundle negotiation | offer_bundle_item junction | Store UI + offer thread | C2 |
| Explore/Discovery | curated_collection tables | Explore page + admin curation | G3 |
| Visual grid store | None | Storefront default layout | D1 |
| Creator affiliate links | Extends existing affiliate tables | Affiliate link generator + seller controls | G1/G3 (extends existing) |
| Live selling | Design only in G | Post-launch build | Post-launch (6-12 mo) |
