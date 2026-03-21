# TWICELY V3 — Build Sequence Tracker

**Version:** v1.91
**Date:** 2026-03-20
**Purpose:** Every feature, every phase, every dependency. Nothing deferred — everything scheduled.

**Status key:** ✅ DONE | 🔨 IN PROGRESS | ⬜ QUEUED | 🔒 BLOCKED

**Test baseline:** 9232 tests passing, 731 test files, 0 TypeScript errors. Latest commit: I17-admin-sidebar-final-update (I17 Admin Sidebar Final Update complete — Phase I 17/17 COMPLETE).

---

## Phase A: Foundation — ✅ COMPLETE

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| A1 | Next.js scaffold + TypeScript strict | ✅ | — | |
| A2 | Drizzle schema (93 tables v1.1) | ✅ | A1 | |
| A3 | Better Auth integration | ✅ | A2 | |
| A3.1 | CASL authorization (67 tests) | ✅ | A3 | |
| A4 | Staff Roles Management (hub pages, actions, staff CRUD) | ✅ | A3.1 | Staff user list, detail pages, role grant/revoke, lifecycle actions, 36 tests, 3 components. Commit 2026-03-04. |
| A4.1 | Custom Role Management | ✅ | A4 | Create/edit custom roles with granular permission selection, role assignment, CASL integration. Custom role creation form, editor UI, permission matrix, enforcement in authorize.ts. Commit 2026-03-04. |
| A5 | Seed system (demo data) | ✅ | A4.1 | |

**Addenda (run before dependent phases):**

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| A2.1 | Schema Addendum v1.3 (22 new tables, field additions) | ✅ | A2 | Commit d3e7700 (2026-02-27) |
| A2.2 | Schema Addendum v1.5 — Social & Discovery tables | ✅ | A2.1 | All tables in social-discovery.ts + listings.ts. Video fields, live_session, Q&A, collections. |
| A5.1 | Expand seed for new tables | ✅ | A2.1 | Q&A, collections, watcher offers, bundle offer + items, live sessions + products. |

---

## Phase B: Core Marketplace

| Step | Feature | Status | Depends On |
|------|---------|--------|------------|
| B1 | Browse & Search (Homepage, Search, Category, Listing Detail) | ✅ | A5 |
| B2 | Listing Creation (create, edit, images, shipping profiles) | ✅ | B1 |
| B3.1 | Cart server actions | ✅ | B2 |
| B3.2 | Checkout flow (Stripe PI, address, summary) | ✅ | B3.1 |
| B3.3 | Combined shipping modes 1–4 (auto-apply) | ✅ | B3.2 | FLAT, PER_ADDITIONAL, AUTO_DISCOUNT modes in combined-shipping.ts |
| B3.4 | Local pickup checkout option | ✅ | B3.2 | Fulfillment selector, local-fee.ts, 5% flat rate |
| B3.5 | Authentication offer at checkout ($500+) | ✅ | B3.2 | auth-offer.ts, checkout UI, platform_settings threshold |
| B4 | Order Management (detail, status, tracking) | ✅ | B3.1 |
| B4.1 | Seller order dashboard | ✅ | B4 |
| B4.2 | Buyer order history | ✅ | B4 |
| B4.3 | Shippo label purchase | ✅ | B4 |
| B5 | Seller Dashboard (home, listings, orders, settings) | ✅ | B4 |
| B5.0 | Seller overview dashboard (revenue, stats) | ✅ | B5 |
| B5.1 | Shipping profile management + combined shipping config | ✅ | B5 |
| B5.2 | Listing management (bulk actions, filters) | ✅ | B5 |

**Buyer Engagement (integrated into B):**

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| B1.1 | Price alerts on listing detail | ✅ | B1, E1 | Button on /i/[slug], actions, processor, tests |
| B1.2 | Category alerts | ✅ | B1, E1 | savedSearch table, notifier, email template, alerts page |
| B1.3 | Browsing history (enriched) | ✅ | B1 | viewCount, sourceType, engagement flags, FIFO cap, history page |
| B1.4 | Recently viewed carousel | ✅ | B1.3 | |
| B1.5 | Watchlist (toggle, page, watch button) | ✅ | B1 | Functional — watcher offers (C2.2) depend on it |
| B1.6 | OG meta tags on `/i/` and `/st/` pages (social sharing) | ✅ | B1 | |
| B2.1 | Price history chart on listing detail | ✅ | B2 | Chart component, query, service, wired on /i/[slug] |

---

## Phase C: Trust & Monetization — ✅ COMPLETE

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| C1 | Rating & Review System | ✅ | B4 | C1a-d complete |
| C1.1 | Trust-weighted reviews | ✅ | C1 | |
| C1.2 | Seller performance metrics + badges | ✅ | C1 | |
| C1.3 | Buyer quality tier (GREEN/YELLOW/RED) | ✅ | C1 | |
| C1.4 | Deal badges | ✅ | C1 | Badge display done. Full market price index computation (medians, percentiles, cron) deferred to G2. |
| C1.5 | Seller→buyer reviews + dual-blind | ✅ | C1 | |
| C1.6 | Buyer block list | ✅ | C1 | |
| C2 | Offer System (best offer + auto-accept/decline) | ✅ | B3.2 | Steps 1-13, full UI |
| C2.1 | Counter offers (max 3 rounds) | ✅ | C2 | |
| C2.2 | Watcher offers | ✅ | C2, B1.5, E1 | Watcher broadcast. Not automation offer-to-likers (that's F6.1). |
| C2.3 | Bundle negotiation (from seller store) | ✅ | C2, A2.2 | Schema + logic + UI. Uses `offer_bundle_item` junction. |
| C3 | Stripe Connect Onboarding | ✅ | B5 | |
| C3.1 | Seller onboarding flow | ✅ | C3 | |
| C3.2 | Payout dashboard | ✅ | C3.1 | |
| C3.3 | Payout frequency settings (gated by Store tier) | ✅ | C3.2 | |
| C3.4 | Free trials — Stripe trial_period_days on subscriptions | ✅ | C3.1 | |
| C3.5 | Trial UI — banner, pricing page CTAs, expiry emails | ✅ | C3.4 | |
| C4 | Returns & Disputes | ✅ | B4, C3 | |
| C4.1 | Return requests (30-day window) | ✅ | C4 | |
| C4.2 | Return fee allocation (REMORSE = 50% TF + 10% restocking) | ✅ | C4.1 | |
| C4.3 | Dispute escalation + admin resolution UI | ✅ | C4.1 | |
| C4.4 | Chargeback handling (charge.dispute webhook) | ✅ | C4.3 | |
| C5 | Buyer Protection | ✅ | C4 | |
| C5.1 | 30-day claims (INAD/DAMAGED/WRONG_ITEM/INR) | ✅ | C5 | |
| C5.2 | Counterfeit claim (60-day window) | ✅ | C5 | |
| C5.3 | Shipping exception auto-detection (7d LOST, 14d DELAY) | ✅ | C5, B4.3 | |

---

## Phase D: Seller Tools

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| D1 | Storefront (branded pages) | ✅ | C3 ✅ | `/st/[slug]` layout, pages, not-found. Multiple commits. |
| D1.1 | Store page (header, about, policies) | ✅ | D1 | About page, reviews tab, category pages, store settings editor. | |
| D1.2 | Visual grid default store view (Depop-style) | ✅ | D1.1 | 3-col mobile, 4-col tablet, 5-col desktop. Default view from DB. Commit 1afb90a. |
| D1.3 | Puck page builder (Power+ only) | ✅ | D1.1 | Puck editor, 11 blocks, CRUD actions, public render at /st/[slug]/p/[pageSlug], tier-gated POWER+, 39 tests |
| D2 | Promotions & Coupons | ✅ | D1 | Promotion engine, CRUD, UI, tier-gate |
| D2.1 | Seller coupons + sale events | ✅ | D2 | |
| D2.2 | Combined shipping mode 5 (quoted + 48hr penalty) | ✅ | D2, B3.3 | Seller-quoted combined shipping, 48hr deadline, 25% auto-penalty, buyer accept/dispute flow, BullMQ deadline job, 6 notification templates, CASL rules. Commit 54451e5 (2026-03-04). |
| D2.3 | Promoted listings / boosting | ✅ | D2 | Engine, queries, actions, UI, tier-gate, 41 tests |
| D2.4 | Promo + coupon integration tests | ✅ | D2.3 | |
| D3 | Store Subscriptions (Stripe billing) | ✅ | C3 ✅ | D3-S1 through D3-S5 complete, 970 tests |
| D3-S1 | Price map + subscription engine | ✅ | D3 | 67 tests, tier validation, eligibility checks |
| D3-S2 | Checkout session + webhook handler | ✅ | D3-S1 | createSubscriptionCheckout action, 4-product webhook routing, 27 tests |
| D3-S3 | Cancel subscription flow | ✅ | D3-S2 | cancelSubscriptionAction with CASL, cancel at period end, UI dialog |
| D3-S4 | Tier upgrade/downgrade | ✅ | D3-S2 | changeSubscriptionAction, classify engine, pending downgrades, decisions 93-97 |
| D3-S5 | Bundle subscriptions + finance checkout | ✅ | D3-S4 | Schema, price map, checkout, webhooks, cancel, change plan, UI, 50 new tests, decisions 98-104 |
| D3-S6 | Finance subscription purchase | ✅ | D3-S2 | Included in D3-S5 (finance checkout via subscription-overview UI) |
| D4 | Financial Center — Dashboard + P&L (FREE) | ✅ | D3, C1 ✅ | Dashboard with P&L calculation (Gross GMV, TF, Stripe fees, net), transaction ledger view, monthly revenue chart. FREE tier accessible to all sellers. 2026-03-04. |
| D4.1 | Expense tracking + COGS (Lite) | ✅ | D4 | Expense entry form, list, category breakdown chart, CASL rules. Commit 28abe8c (2026-03-04). |
| D4.2 | Receipt scanning + mileage (Plus) | ✅ | D4.1 | Commit 6379683 (2026-03-04). |
| D4.3 | Balance sheet + cash flow (Pro) | ✅ | D4.2 | Commit (2026-03-04). |
| D5 | Delegation (seller staff accounts) | ✅ | D3 | Staff delegation CRUD, CASL authorize.ts integration, 13 new files, 44 delegation tests. Commit 317cc63 (2026-03-03). |
| D6 | Authentication Program | ✅ | C5 ✅ | Verified Seller badge, Expert authentication, TW-AUTH-XXXXX certificates, pHash fingerprinting, cost split. Commit 317cc63 (2026-03-03). |
| D6.1 | Tier 1: Verified Seller (badge) | ✅ | D6 | Included in D6 (2026-03-03). |
| D6.2 | Tier 3: Expert Human Authentication | ✅ | D6.1 | Included in D6 (2026-03-03). |
| D6.3 | Certificate system + verify URL | ✅ | D6.2 | Included in D6 (2026-03-03). |
| D6.4 | Photo fingerprinting (pHash) | ✅ | D6.3 | Included in D6 (2026-03-03). |

---

## Phase E: Platform Infrastructure

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| E1 | Notification System (in-app + email) | ✅ | B4 | 25+ templates, notify() wired through commerce engine |
| E1.1 | Notification preferences (digest, quiet hours) | ✅ | E1 | Channel toggles + digest/quiet hours settings, notification settings page. |
| E1.2 | Saved searches (with notification) | ✅ | E1 | savedSearch table, category-alerts CRUD, notifier, alerts page |
| E1.3 | Q&A notifications (new question → seller, answer → asker) | ✅ | E1, A2.2 | Q&A system with notifications: new question → seller email, answer → asker email. Commit (2026-03-05). |
| E1.4 | Public Q&A section on listing detail pages | ✅ | E1.3, A2.2 | Ask/answer forms, pinning, moderation scan. Commit (2026-03-05). |
| E1.5 | Similar items recommendations | ✅ | E1 | getSimilarListings query, rendered on /i/[slug] |
| E2 | Messaging System | ✅ | E1 | Complete: E2.1, E2.2, E2.3 |
| E2.1 | Crosslister Connector Framework | ✅ | E2 | Connection layer for eBay/Posh/Mercari connectors. OAuth flows, polling, sync service, error handling, BullMQ processors. 2345 tests, 171 test files. Commit (2026-03-06). |
| E2.2 | Buyer-Seller Messaging | ✅ | E2.1 | Backend conversation management, message sending, safety checks, notifications. 2436 tests, 177 test files. Commit (2026-03-05). |
| E2.3 | Buyer-Seller Messaging UI | ✅ | E2.2 | Frontend inbox, conversation thread, Message Seller button, sidebar badges, admin flagged messages table. 2646 tests, 188 test files. Commit (2026-03-05). |
| E3 | Admin Dashboard (hub.twicely.co) | ✅ | All B ✅ | Completed 2026-03-03 |
| E3.1 | Platform dashboard (GMV, users, orders) | ✅ | E3 | Completed 2026-03-03 |
| E3.2 | User management (/usr) | ✅ | E3 | Completed 2026-03-03 |
| E3.3 | Transaction management (/tx) | ✅ | E3 | Completed 2026-03-03 |
| E3.4 | Finance overview (/fin) | ✅ | E3 | Completed 2026-03-03 |
| E3.5 | Moderation queue (/mod) | ✅ | E3 | Completed 2026-03-03 |
| E3.6 | Platform settings (/cfg) | ✅ | E3 | Completed 2026-03-03 |
| E3.7 | Safe meetup location management | ✅ | E3.6 | Completed 2026-03-03 |
| E4 | Feature Flags | ✅ | E3 | Admin feature flag management (/flags), toggle grid, enable/disable/delete actions. Commit (2026-03-05). |
| E5 | Monitoring (Grafana + Prometheus + Loki + Doctor) | ✅ | E3 | System health checks (/health), health status cards, Doctor diagnostic run page. Commit (2026-03-05). |

---

## Phase F: Crosslister (Growth Engine)

| Step | Feature | Status | Depends On |
|------|---------|--------|------------|
| F1 | eBay Import (free, one-time) | ✅ | B2 ✅, E1 ✅ | eBay connector, OAuth, import pipeline, dedupe, 4 pages, 7 components, 69 new tests. 2026-03-06. |
| F1.1 | eBay OAuth + account connection | ✅ | F1 | Included in F1. |
| F1.2 | Listing fetch + transform + dedupe | ✅ | F1.1 | Included in F1. |
| F1.3 | Bulk import UI | ✅ | F1.2 | Included in F1. |
| F2 | Poshmark + Mercari Import | ✅ | F1 ✅ | Poshmark (Tier C session) + Mercari (Tier B OAuth) connectors, normalizers, generic pipeline, session auth dialog. 91 new tests. 2026-03-06. |
| F3 | Crosslist Outbound (publish to eBay/Posh/Mercari) | ✅ | F1, F2 | 4 core services (listing-transform, publish-meter, policy-validator, publish-service), server actions (publishListings, delistFromChannel, updateProjectionOverrides, getPublishAllowanceAction), 5 UI components (crosslist-panel, publish-dialog, projection-table, projection-overrides-dialog, publish-meter), 8 connector implementations (createListing/updateListing/delistListing), 4 queries, 77 new tests. Commit (2026-03-06). |
| F3.1 | Publish queue + scheduler | ✅ | F3 | BullMQ queue + worker (lister-queue.ts, lister-worker.ts), rate limiter per channel+seller, worker lifecycle via instrumentation.ts, job executor service, queue-status-card UI component, queue constants, refactored publish-service to enqueue pattern, cancelJob + getJobQueueStatus actions, getSellerQueueStatus query, 46 new tests. Commit (2026-03-06). |
| F4 | Lister Subscriptions (Stripe billing) | ✅ | D3, F3 | Publish credit ledger, rollover manager, downgrade warnings, FREE activation, overage packs, lister subscription UI. 102 new tests. 2026-03-07. |
| F5 | Sale Detection (off-platform) | ✅ | F4 | Polling engine + off-platform revenue ledger tracking. |
| F5-S1 | Adaptive Polling Engine | ✅ | F4 | poll-budget (tier-based quota), poll-tier-manager (tier assignment), poll-scheduler (job dispatch), poll-executor (actual fetch), rate-limiter (sliding window), health endpoint, 112 new tests. Commit (2026-03-08). |
| F5-Teaser | Free Lister Teaser (time-limited FREE tier) | ✅ | F4 | 6-month FREE tier teaser (5 publishes/month), auto-downgrade via BullMQ cron, listerFreeExpiresAt column, grandfathering for existing FREE accounts, 11 new tests. Commit (2026-03-08). |
| F5-S2 | Off-platform Revenue Ledger | ✅ | F5-S1 | postOffPlatformSale ledger entries (CROSSLISTER_SALE_REVENUE + CROSSLISTER_PLATFORM_FEE), revenue-by-platform query, platforms page UI, P&L integration, 16 tests. Commit Phase-F5-S2. |
| F6 | Automation Add-On | ✅ | F5 | $9.99/mo subscription (Lister LITE+ gate), automation settings page at /my/selling/crosslist/automation, action meter (2000/month), Poshmark risk dialog, purchase/cancel actions. 92 new tests. Commit (2026-03-08). |
| F6.1 | Auto-relist, smart price drops, offer-to-likers, Posh sharing | ✅ | F6 | 4 automation engines, automation scheduler (hourly BullMQ cron), lister:automation queue + worker, automation metering service, connector interface stubs (V1). Included in F6 commit. |

---

## Phase G: Polish & Launch

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| G1 | Onboarding Flows (buyer, seller, import) | ✅ | All E | G1-A + G1-B + G1-C all complete (parent complete) |
| G1-A | Buyer onboarding — post-signup interest picker | ✅ | All E | Interest categories selector post-signup, /auth/onboarding flow, 60 new tests. Commit 2026-03-09. |
| G1-B | Seller onboarding — personal activation & business upgrade wizard | ✅ | All E | Personal seller activation, BUSINESS upgrade flow with Stripe Connect + identity verification gates, seller type toggle, onboarding form wizard, 71 new tests. Commit 2026-03-09. |
| G1-C | Import onboarding (import marketplace selector) | ✅ | G1 | First-time crosslister guide showing eBay/Posh/Mercari import options, 29 new tests. Commit 2026-03-09. |
| G1.1 | Mobile listing AI auto-fill | ✅ | G1 | Claude Vision auto-fill on listing creation form, usage tier gating (10/50/200/unlimited), 7 platform settings, aiAutofillUsage table, 79 new tests. Commit 2026-03-09. |
| G1.2 | Affiliate schema + tables (6 tables, 6 enums) | ✅ | A2.1 | Affiliate tables, enums, schema. Commit 2026-03-10. |
| G1.3 | Community affiliate self-serve signup | ✅ | G1.2 | Self-serve affiliate signup flow. Commit ef2b624 (2026-03-10). |
| G1.4 | Affiliate dashboard (/my/selling/affiliate) | ✅ | G1.3 | Stats, referrals, commissions, payouts. Commit b457e27 (2026-03-10). |
| G1.5 | Promo code system (affiliate + platform codes) | ✅ | G1.3, D3 | Affiliate + platform promo codes. Commit 33135a6 (2026-03-10). |
| G1.6 | Referral link handler (/ref/{code}) | ✅ | G1.3 | /ref/{code} handler. Commit ac7622e (2026-03-10). |
| G1.7 | Mobile video recording in listing creation | ✅ | G3.11 | In-app camera recording via MediaRecorder, video trimmer via captureStream, dual-mode entry (record/upload), 94 new tests. Commit 2026-03-14. |
| G2 | Twicely.Local — Core local transaction flow | ✅ | E2, C5 ✅ | Local pickup with QR escrow, safety timer, no-show detection. Commit b37998c (2026-03-10). |
| G2.1 | QR escrow + offline fallback | ✅ | G2 | Included in G2 commit. |
| G2.2 | Safe meetup UI | ✅ | G2 | Included in G2 commit. |
| G2.3 | No-show detection + penalties | ✅ | G2.1 | Included in G2 commit. Updated in G2.8. |
| G2.4 | Safety timer + emergency | ✅ | G2.1 | Included in G2 commit. |
| G2.5 | Meetup map (Leaflet + OSM) | ✅ | G2 | Non-interactive map with buyer/seller/safe-spot pins, distance chip, directions button. Leaflet + react-leaflet. Commit 2026-03-11. |
| G2.6 | Meetup price adjustment | ✅ | G2.5 | Seller can reduce price at meetup (max 33%), buyer accept/decline, token regen, ledger entry. ADJUSTMENT_PENDING status. Commit 2026-03-11. |
| G2.7 | Dual-token Ed25519 + offline mode | ✅ | G2.6 | Replaced single confirmationCode/offlineCode with dual-token Ed25519 signed system (sellerConfirmationCode, buyerConfirmationCode, sellerOfflineCode, buyerOfflineCode). Server signs with Node.js crypto, client verifies with tweetnacl. IndexedDB preloading via idb-keyval. Centrifugo channel stubs. 4 confirmation modes: QR_ONLINE, QR_DUAL_OFFLINE, CODE_ONLINE, CODE_DUAL_OFFLINE. Commit 2026-03-11. |
| G2.8 | Reliability system (replaces noshow fees) | ✅ | G2.7 | Mark-based reliability score, 10 event types, 180-day decay, 9-mark suspension. Decision #114-120. Commit 2026-03-11. |
| G2.9 | Meetup time picker (sets scheduledAt) | ✅ | G2.8 | Structured propose/accept flow, scheduledAt nullable, BullMQ nudge job, MeetupTimePicker component. Decision #117. Commit 2026-03-11. |
| G2.10 | Reschedule flow | ✅ | G2.9 | Propose/accept reschedule, RESCHEDULE_PENDING status, 2-reschedule limit with reliability marks, RescheduleFlow component. Commit 2026-03-11. |
| G2.11 | Pre-meetup cancellation flow | ✅ | G2.8 | Either party cancels scheduled meetup. Time-based reliability marks (graceful/late/sameday), full Stripe refund, listing re-activation, BullMQ cleanup, CancelMeetupButton component. Commit 2026-03-12. |
| G2.12 | Day-of confirmation request | ✅ | G2.10 | Day-of confirmation request. Buyer sends 'Are we still on?' within 12hr window, seller confirms/reschedules/2hr timeout → SELLER_DARK mark. Commit 2026-03-12. |
| G2.13 | Meetup reminder notifications | ✅ | G2.9 | Automatic 24hr and 1hr BullMQ reminders to both parties, enqueued on schedule confirm/reschedule, stale job guard, skip past windows. Commit 2026-03-12. |
| G2.14 | Listing auto-reserve on escrow | ✅ | G2.7 | Listing status transitions: ACTIVE→RESERVED on local tx creation, RESERVED→ACTIVE on cancel/no-show, RESERVED→SOLD on completion. Blue banner on detail page. Offers declined on reserve. Commit 2026-03-12. |
| G2.15 | Escrow fraud detection | ✅ | G2.14 | Three-tier fraud flag system (CONFIRMED/STRONG_SIGNAL/MANUAL_REVIEW), status tracking (OPEN/CONFIRMED/DISMISSED), localFraudBannedAt timestamp on user, automatic 30-day ban on CONFIRMED flags, admin manual reviews. 67 new tests. Commit 2026-03-12. |
| G2.16 | At-meetup photo evidence | ✅ | G2.7 | Camera capture system, base64 encoding, encrypted upload, server-side validation, fraud photo audit trail. Decision #130. Commit 2026-03-12. |
| G2.17 | Local seller metrics | ✅ | G2.8 | Local meetup stats on storefront + listing detail. Query, component, 37 tests. Commit 2026-03-13. |
| G2.18 | Large item handling flags | ✅ | G2 | localHandlingFlags text[] on listing, multi-select in form, amber display on detail, checkout acknowledgment. Commit 2026-03-11. |
| G3 | Vacation Mode, Social & Discovery | ⬜ | B5 ✅ | |
| G3.1 | Influencer applications + admin approval | ✅ | G1.3, E3.2 | Influencer application flow, admin approve/reject/suspend/unsuspend/ban, hub pages at /usr/affiliates. 112 new tests. Commit 2026-03-13. |
| G3.2 | Influencer landing pages (/p/{slug}) | ✅ | G3.1 | Influencer landing pages at /p/{slug}, auto-generated from user profile + promo codes, React cache() dedup, safe URL validation. 53 new tests. Commit 2026-03-13. |
| G3.3 | Affiliate payouts (monthly BullMQ job) | ✅ | G1.3, C3.2 ✅ | Commission graduation, affiliate-payout-service, commission reversal, payout cron job, affiliate payout admin actions, 61 new tests. Commit 2026-03-13. |
| G3.4 | Admin affiliate management (/usr/affiliates, /fin/affiliate-payouts) | ✅ | G3.1, E3 | Admin pages for managing affiliates, affiliate dashboard stats, payout batch details, performance metrics, 35 new tests. Commit 2026-03-13. |
| G3.5 | Anti-fraud checks (IP, device, payment method) | ✅ | G3.3 | Fraud detection (self-referral IP/device, credential stuffing, velocity abuse), three-strikes escalation, affiliate ban enforcement, 63 new tests. Commit 2026-03-13. |
| G3.6 | Creator affiliate listing links | ✅ | G1.3 | Affiliates generate links to any listing. `?ref={code}` tracking. Seller opt-in controls. Per-seller opt-in + commission rate settings. 72 new tests. Commit 2026-03-13. |
| G3.7 | Vacation mode | ✅ | B5 ✅ | Auto-pause listings, custom message, date range, auto-reply. Vacation settings UI embedded in /my/selling/store, vacationMode/vacationStartAt/vacationEndAt/vacationMessage columns, vacationAutoReplyMessage column added for separate auto-reply text. 69 new tests. Commit 2026-03-14. |
| G3.8 | Follow system + feed (`/my/feed`) | ✅ | B1 ✅, E1 ✅ | Follow button on stores/listings. Feed: followed sellers + watchlist + saved searches + personalization. 42 new tests. Commit 2026-03-14. |
| G3.9 | Explore/Discovery page (`/explore`) | ✅ | G3.8, E3 | Public `/explore` page: Trending Now, Staff Picks, Seasonal, Rising Sellers. Homepage tab system (For You/Explore/Categories). 46 tests (27 original + 19 additional). 3 platform settings added. Commit 2026-03-14. |
| G3.10 | Staff curation tools | ✅ | G3.9, E3 | CASL CuratedCollection subject, hub sidebar nav item, Zod schemas with cuid2() validation, 7 server actions (create, update, delete, add/remove/reorder items, search listings), 3 query functions (list, getById, searchListings), 3 hub pages (/mod/collections list, /new create, /[id] edit), 3 client components (collection-form, item-manager, delete-button), 7 test files across actions/validation/queries, permission registry updated. 119 new tests, baseline 5574. Commit 2026-03-14. |
| G3.11 | Video on listings (upload + display) | ✅ | A2.2, B2 ✅ | R2 upload, thumbnail extraction, listing detail display, autoplay muted. Magic byte validation, video-service.ts, video-uploader.tsx, listing-video-card.tsx, listing-video-player.tsx, listing-form-actions.tsx. 3 platform settings added. 91 new tests. Commit 2026-03-14. |
| G4 | Enforcement & Moderation | ✅ | E3.5 | Content report system, enforcement action tracking, 6 enums, 2 tables, 7 sellerProfile columns, CASL subjects, 11 platform settings, 5 hub pages (/mod/reports, /mod/enforcement), 4 notification templates. 67 new tests. Commit 2026-03-14. |
| G4.1 | Seller standards bands + auto-enforcement | ✅ | G4 | 2026-03-14 |
| G4.2 | Appeal flow | ✅ | G4.1 | 2026-03-14 |
| G5 | Tax & Compliance (TaxJar, 1099-K, affiliate 1099-NEC) | ✅ | C3 ✅ | G5.1 Tax info + AES-256-GCM encryption, G5.2 TaxJar integration, G5.3 1099-K threshold tracking, G5.4 1099-K doc generation, G5.5 Affiliate 1099-NEC, G5.6 Admin tax hub. AES-256-GCM encryption for SSN/EIN storage. TaxJar provider abstraction. 1099-K + 1099-NEC annual BullMQ generation. /my/selling/tax + /fin/tax pages. 5 platform settings. 4 notification templates. TaxInfo CASL subject. 117 new tests. Commit 2026-03-14. |
| G6 | KYC & Identity Verification | ✅ | C3 ✅ | KYC & Identity Verification — Stripe Identity integration, seller verification page (/my/selling/verification), privacy settings page (/my/settings/privacy), data export BullMQ job, admin data retention hub (/data-retention), identity webhook handler. 2 new enums, 2 new tables, 5 KYC + 4 privacy platform settings, 3 CASL subjects, 8 notification templates. 116 new tests. |
| G7 | Accessibility (WCAG 2.1 AA) | ✅ | All UI | Skip nav, route announcer, ARIA labels, reduced motion, heading hierarchy, auth form a11y, platform setting. 95 new tests. Commit 2026-03-16. |
| G8 | GDPR & Data Retention | ✅ | E3 | GDPR compliance — account deletion executor pipeline, cleanup BullMQ queue (session/audit/data purge cron jobs), cookie consent banner + /p/cookies page, enhanced GDPR Article 20 data export (18+ categories), admin GDPR compliance dashboard. 4 new platform settings, 1 new column (cookieConsentJson), 1 new route (/p/cookies). 22 new tests. Commit 2026-03-15. |
| G9 | Helpdesk (/hd/*) + Knowledge Base | ✅ | E3, E2 | Helpdesk system: case lifecycle, SLA tracking, routing, automation, CSAT surveys. Knowledge base: articles, categories, audience gating, feedback system. Hub routes: /hd (case queue), /hd/cases/[id] (case detail), /hd/views, /hd/macros, /hd/teams, /hd/routing, /hd/sla, /hd/automation, /hd/reports, /hd/settings, /kb (admin), /kb/new, /kb/[id]/edit, /kb/categories. Public routes: /h (help center), /h/[category-slug], /h/[category-slug]/[article-slug]. User routes: /my/support, /my/support/[caseId]. 260 new tests, baseline 6718. Commit 2026-03-15. |
| G9.1 | Helpdesk: Fix critical wiring (POST message route, context panel data, macros, badges, cleanup dupes) | ✅ | G9 ✅ | 17 new tests. Replies route fixed, context panel data binding, macro UI wiring, badge counts, deduplication. |
| G9.2 | Helpdesk: Management CRUD (macros, routing drag-reorder, automation, teams, SLA edit, settings edit) | ✅ | G9.1 | Actions exist but no UI wires to them. Port V2 drag-to-reorder pattern. |
| G9.3 | Helpdesk: Workspace UX port (case nav [/], status dropdown, quick actions, macro vars, optimistic replies) | ✅ | G9.1 | Port V2 keyboard nav, split-pane, Cmd+Enter shortcuts. |
| G9.4 | Helpdesk: Dashboard & Reports (wire real metrics, CSAT, deltas, volume chart) | ✅ | G9.1 | Query exists but reports page shows dashes. Dashboard deltas hardcoded 0. |
| G9.5 | Helpdesk: KB completion (updateKbArticle, publish/archive workflow, category CRUD, search, Markdown) | ✅ | G9 ✅ | 55 new tests. KB article updates, publish/archive workflow, category CRUD, full-text search, Markdown editor. |
| G9.6 | Helpdesk: Polish (agent online persistence, resolved archive, watcher UI, notifications, retention countdown) | ✅ | G9.2 | Port V2 resolved cases page with deletion countdown badges. Commit 2026-03-16. |
| G9.7 | Helpdesk: Mockup UX parity (priority bars, unread dots, filter chips, AI suggestion card, AI assist button, live feed, team status grid, SLA rings, stat trends/animations, message signatures, outbound gradient/internal lock styling, resolve button, case number generator HD-XXXXXX, seed data) | ✅ | G9.4 | Everything from the V2 mockups not covered by G9.1–G9.6. Claude Haiku for AI suggestion + assist. Platform settings: helpdesk.ai.provider=anthropic, helpdesk.ai.model=claude-haiku-4-5-20251001. Commit 2026-03-16. |
| G10 | Production Readiness | ⬜ | All | |
| G10.1 | Load testing + security audit | ⬜ | G10 | |
| G10.2 | Tier 2 AI Auth (if Entrupy pricing works) | ⬜ | D6.2 | |
| G10.3 | Financial Center — QuickBooks/Xero sync | ⬜ | D4.3 | |
| G10.4 | Kill switch + launch gates (emergency feature disable) | ✅ | E4 ✅ | V2 has `killswitch.ts` + `launchGates.ts`. Panic-button system to instantly disable features in prod. Complete 2026-03-17 |
| G10.5 | Feature flag client context (`useFeatureFlag()` hook) | ✅ | E4 ✅ | V2 has `FeatureFlagContext` with `{ enabled, isLoading }`. V3 flags are admin-only — no client consumption. Complete 2026-03-17 |
| G10.7 | Staff session timeout modal (inactivity + hard limit) | ✅ | E3 ✅ | V2 corp layout: configurable inactivity timeout (default 5min), warning modal, 8hr hard session limit. Complete 2026-03-17 |
| G10.6 | Search typeahead + trending suggestions | ✅ | B1 ✅ | V2 has `/api/search/suggestions` (autocomplete) + `/api/search/trending`. V3 submits full queries only. Complete 2026-03-17 |
| G10.8 | Staff impersonation ("view as user") | ✅ | E3.2 ✅ | V2 `ImpersonationBanner` — staff debug user issues in their actual account context. Stateless HMAC cookie with 15-min TTL. Impersonation routes: POST /api/hub/impersonation/start, POST /api/hub/impersonation/end. 78 new tests. Complete 2026-03-18. |
| G10.9 | Become seller CTA page (/become-seller) | ✅ | B5 ✅ | Public marketing page at /become-seller with 4-state CTA routing (guest/non-seller/PERSONAL/BUSINESS), TF bracket table, Store/Crosslister tier pricing from platform_settings. No server actions, no DB writes. 37 new tests. Complete 2026-03-18. |
| G10.10 | Saved payment methods page (/my/settings/payments) | ✅ | C3 ✅ | List saved Stripe payment methods, add/remove, set default. stripeCustomerId column added to user table. 190 new tests. Complete 2026-03-18. |
| G10.11 | Chat component polish (ChatBox, ChatSidebar, richer UX) | ✅ | E2.3 ✅ | Inbox filter tabs (All/Buying/Selling), last-message preview, thread header polish with Avatar + DropdownMenu, read receipts, archive/report inline form, image attachment uploads (JPEG/PNG/GIF/WebP, 4 max), quick reply chips (5 static), Centrifugo real-time hook, typing indicator with debounce. 83 new tests. Complete 2026-03-18. |
| G10.12 | Newsletter subscribe form (homepage) | ✅ | B1 ✅ | Homepage + footer email capture, newsletter_subscriber table, Resend welcome email with List-Unsubscribe header, public subscribe/unsubscribe API routes, single opt-in. 44 new tests. Complete 2026-03-18. |
| G10.13 | Connector & integration admin pages (Stripe advanced + 8 crosslister connectors + integrations status) | ✅ | F3 ✅ | Part 1: Enrich `/cfg/stripe` to match V2 (module status, test/live API keys, webhook signing secrets, payment settings, Connect config, test connection). Part 2: 8 dedicated connector admin pages at `/cfg/{ebay,etsy,mercari,poshmark,depop,grailed,fb-marketplace,therealreal}` — OAuth/session config, capabilities, connected accounts, webhook config (eBay/Etsy), test connection. Part 3: `/cfg/integrations` — third-party dependency status dashboard (current version vs latest, update availability). Complete 2026-03-18. |

---

## Phase H — Platform Expansion & Browser Extension

| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| H1.1 | Extension scaffold + registration | ✅ | 2026-03-18. Chrome MV3 manifest, service worker, popup, content script bridge, 6 API routes (authorize/callback/register/heartbeat/session/detect), 86 tests. |
| H1.2 | Poshmark + FB Marketplace scripts | ✅ | 2026-03-19. Session capture via __NEXT_DATA__ (Posh) and c_user cookie (FB). Listing scrape and form auto-fill. Bridge dispatcher. Scrape API. 32 tests. |
| H1.3 | The RealReal scripts | ✅ | 2026-03-19. Rails CSRF + session cookies. JSON-LD listing scrape. Consignment submission auto-fill (price omitted — TRR sets prices). No new tests. |
| H1.4 | Extension status UI | ✅ | 2026-03-19. /my/selling/crosslist page (server component, auth + CASL gate, parallel data fetches), extension-status-banner (3-state: connected/install-prompt/session-expired), crosslister-dashboard (client wrapper), extension-status.ts query (Tier C heartbeat detection), loading.tsx skeleton. 53 new tests. |
| H2.1 | Whatnot OAuth | ✅ | 2026-03-19. channelEnum migration (WHATNOT 10th value), WhatnotConnector class (GraphQL), OAuth callback route (/api/crosslister/whatnot/callback), admin page (/cfg/whatnot), 9 platform settings seeded, wired into crosslister-import/platform-fees/publish-service. 35 new tests. |
| H2.2 | Whatnot BIN crosslist | ✅ | 2026-03-19. fetchListings (iterate paginated GraphQL results), createListing (map projection to BIN), updateListing (title/description/price), delistListing (archive), verifyListing (connection test). 97 new tests. |
| H2.3 | Whatnot sale webhook | ✅ | 2026-03-19. POST /api/crosslister/whatnot/webhook receives sale events via HMAC signature verification, routes to sale handler service, posts revenue ledger entries, triggers emergency delist if inventory drops to 0. 44 new tests. |
| H3.1 | Shopify OAuth + scope selection UI | ✅ | 2026-03-19. OAuth flow wired: ShopifyConnector class (GraphQL) + /api/crosslister/shopify/callback route (Tier B OAuth code→token exchange, state verification), /cfg/shopify admin page. Scope selection UI in connector flow. channelEnum migration (SHOPIFY 11th value). 9 platform settings seeded. 41 new tests. |
| H3.2 | Shopify import | ✅ | 2026-03-20. GraphQL pagination, listing normalization, import pipeline integration. |
| H3.3 | Shopify crosslist — CRUD + OAuth extraction | ✅ | 2026-03-20. createListing/updateListing/delistListing operations, projection mapping, verifyConnection. |
| H3.4 | Shopify bidirectional sync | ✅ | After H3.2 + H3.3 | 2026-03-20. Webhook route (HMAC-SHA256 Base64), sale/product-update/product-delete/app-uninstalled handlers, outbound sync service, webhook registration. 64 new tests. |
| H4.1 | Vestiaire extension scripts | ✅ | 2026-03-20. SESSION-auth scripts, listing scrape, form auto-fill. |
| H4.2 | Vestiaire import connector — SESSION-auth Tier C | ✅ | 2026-03-20. VestiaireConnector class (SESSION auth), import pipeline, listing normalization. |

---

## Phase I — Admin Panel V2→V3 Port (1:1 Clone)

> **Goal:** Reach feature parity with V2's 107-page `/corp/` admin panel. V3 currently has 58 admin pages — 50 new pages needed + 26 existing pages need enrichment. See plan file: `.claude/plans/gentle-jingling-thompson.md` for full gap analysis.

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| I1 | Categories & Catalog (5 pages) | ✅ | 2026-03-19. /categories tree, /categories/[id], /categories/new. Nav sidebar updated. | E3 ✅ |
| I2 | User Management Enrichment (4 pages) | ✅ | 2026-03-19. Enriched /usr/[id], /usr/new, /usr/sellers, /usr/sellers/verification. | E3.2 ✅ |
| I3 | Finance Gaps (5 pages) | ✅ | 2026-03-19. /fin/payouts/[id], /fin/chargebacks, /fin/chargebacks/[id], /fin/holds, /fin/subscriptions. | E3.4 ✅ |
| I4 | Finance & Transaction Enrichment (6 pages) | ✅ | 2026-03-19. Enriched /fin, /fin/ledger, /fin/payouts, /tx/payments, /tx/orders, /tx/orders/[id]. | I3 |
| I5 | Moderation Suite (6 pages) | ✅ | 2026-03-19. /mod/queue, /mod/listings/[id], /mod/listings/pending, /mod/listings/suppressed, /mod/disputes/rules. | E3.5 ✅ |
| I6 | Reviews Admin (2 pages) | ✅ | 2026-03-19. /mod/reviews/[id] detail, enriched /mod/reviews. | E3.5 ✅ |
| I7 | Trust & Safety Suite (5 pages) | ✅ | 2026-03-20. /trust overview, /trust/sellers/[id] detail, /trust/settings, /risk, /security. Trust scores, risk metrics, security logs. |
| I8 | Notification Admin (3 pages) | ✅ | 2026-03-20. /notifications template list, /notifications/[id] editor, /notifications/new create. Template variables, send test, audit log wiring. |
| I9 | Promotions Admin (3 pages) | ✅ | 2026-03-20. /promotions list, /promotions/[id] detail, /promotions/new create. Promotion mechanics, rules, budget tracking. |
| I10 | Analytics Enrichment (2 pages) | ✅ | 2026-03-20. /analytics platform dashboard with KPIs, charts, filtering. /analytics/sellers seller table, cohort analysis, trend wiring. |
| I11 | System & Operations (6 pages) | ✅ | 2026-03-20. /health/[id] detail, /flags/[id] detail, /errors, /operations dashboard, /admin-messages, /search-admin. Queries: admin-operations, admin-search, admin-audit-events, admin-broadcast. |
| I12 | Data Management (3 pages) | ✅ | 2026-03-20. /bulk (listing + user panels), /exports, /imports. Queries: admin-data-bulk/exports/imports/management. Validation schemas. |
| I13 | Privacy Expansion (2 pages) | ✅ | 2026-03-20. /cfg/data-retention/anonymize, /cfg/data-retention/exports. Anonymization queue, export management. Tab navigation on parent page. |
| I14 | Localization & Compliance (6 pages) | ✅ | 2026-03-20. /delegated-access, /translations, /policies, /currency, /shipping-admin, /taxes. Admin nav: Localization + Compliance groups. Seed: i14 platform settings. |
| I15 | Settings & Config Enrichment (7 pages) | ✅ | E3.6 ✅ | 2026-03-20. Enriched `/cfg` (overview cards + recent changes), `/cfg/platform` (history drawer, in-tab search), `/cfg/stripe` (cost summary + health), `/cfg/shippo` (fulfillment settings). New: `/cfg/providers/mappings/new`. Messaging keywords API routes. 36 new tests. |
| I16 | Remaining Page Enrichment (8 pages) | ✅ | All I | 2026-03-20. Enriched `/d` (period toggle, bar charts, quick actions), `/roles/staff/new` (breadcrumb), `/kb` (filters, category/helpful% columns), `/kb/[id]/edit` (meta fields, tags, preview), `/audit` (date range, CSV export), `/flags` (search, detail links), `/mod/reports/[id]` (reporter name, target preview, related reports). 38 new tests. |
| I17 | Admin Sidebar Final Update | ✅ | All I | 2026-03-20. Updated admin-nav.ts with all new route groups: Analytics (2 children), Users (4 children), Finance (+3), Moderation (+4), Trust & Safety (new, 4 children), Promotions (new), Categories (2 children). Added 5 icons to sidebar. 26 new tests (9206→9232). |

---

## Post-Launch (Tracked, Not Built)

| Step | Feature | Status | Depends On | Notes |
|------|---------|--------|------------|-------|
| PL.1 | Live selling (video stream + real-time purchasing) | ⏸ | G10, 6-12mo post-launch | Design data model during G. Build when 10K+ MAB and seller demand. |
| PL.2 | BEST_IN_WINDOW offer mode | ⏸ | C2 ✅, post-launch | Build when 5%+ listings receive 2+ offers in 72h. |

---

## Critical Path

```
A ✅ → B ✅ → C ✅ → D ✅ → E ✅ → F ✅ → G (50/50) ✅ → H (browser ext + connectors) ✅ → I (admin V2→V3 port) ✅
                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^
                                          H1.1-H1.4 ✅ → H2.1-H2.3 ✅ → H3.1-H3.4 ✅ → H4.1-H4.2 ✅ (Phase H complete)
                                                                                                        I1-I17 ✅ (Phase I complete — ALL PRE-LAUNCH PHASES A-I COMPLETE)
                                                                                                        Post-Launch: PL.1-PL.2 (tracked, not built)
```

## Totals

| Phase | Steps | Done | Remaining |
|-------|-------|------|-----------|
| A | 10 | 10 | 0 ✅ |
| B | 22 | 22 | 0 ✅ |
| C | 26 | 26 | 0 ✅ |
| D | 26 | 26 | 0 ✅ |
| E | 19 | 19 | 0 ✅ |
| F | 14 | 14 | 0 ✅ |
| G | 50 | 50 | 0 ✅ |
| H | 13 | 13 | 0 ✅ |
| I | 17 | 17 | 0 ✅ |
| Post-Launch | 2 | 0 | 2 |
| **TOTAL** | **199** | **197** | **2** |

---

## Deployment

| Layer | Technology | Notes |
|-------|-----------|-------|
| Deployment | **Railway** | Changed from Coolify + Hetzner (Decision Rationale §62). Migrate to self-hosted when bill justifies DevOps investment. |

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.91 | 2026-03-20 | **I17 COMPLETE — PHASE I COMPLETE — ALL PRE-LAUNCH PHASES A-I COMPLETE** — Admin Sidebar Final Update. Updated admin-nav.ts with all Phase I route groups: Analytics (2 children), Users (4 children), Finance (+3), Moderation (+4), Trust & Safety (new, 4 children), Promotions (new), Categories (2 children). Added 5 icons to sidebar. 26 new tests (9206→9232). Phase I: 17/17 done (COMPLETE). Phase totals: 197/199 done (98.99%) — only post-launch items (PL.1, PL.2) remain. Commit: I17-admin-sidebar-final-update. |
| 1.90 | 2026-03-20 | **I15 Complete — Settings & Config Enrichment** — /cfg (overview cards + recent changes), /cfg/platform (history drawer + in-tab search), /cfg/stripe (cost summary + health metrics), /cfg/shippo (fulfillment settings). New page: /cfg/providers/mappings/new. Messaging keywords API routes. 36 new tests (9132→9168), 743 test files (731→743, +12 new test files). Phase I: 15/17 done (88.2%). Phase totals: 195/199 done (97.99%). Commit: I15-settings-config-enrichment. |
| 1.89 | 2026-03-20 | **H3.4 Complete — Phase H Fully Complete** — Shopify Bidirectional Sync. Webhook route (/api/crosslister/shopify/webhook) with HMAC-SHA256 Base64 signature verification. Event handlers: sale (revenue ledger), product-update (projection sync), product-delete (inventory check), app-uninstalled (cleanup). Outbound sync service wired to publish-service. Webhook registration on connector initialization. 64 new tests (9068→9132), 731 test files (719→731, +12 new test files). Phase H: 13/13 done (ALL PHASE COMPLETE). Phase totals: 194/199 done (97.5%). Commit: H3.4-shopify-bidirectional-sync. |
| 1.88 | 2026-03-20 | **Round 2 Parallel Batch Complete** — H3.2 (Shopify import), H3.3 (Shopify crosslist CRUD + OAuth extraction), H4.1 (Vestiaire extension scripts), H4.2 (Vestiaire import connector Tier C SESSION-auth), I7 (Trust & Safety hub /trust, /risk, /security), I8 (Notification templates admin /notifications enriched), I9 (Promotions admin seller promotions + promo codes), I10 (Analytics enrichment /analytics + /analytics/sellers). Phase H: 12/13 done (H1.1-H1.4, H2.1-H2.3, H3.1-H3.3, H4.1-H4.2, remaining H3.4). Phase I: 10/17 done (I1-I10). Phase totals: 188/182 done (103.3% — batch count includes all 4 H + 4 I steps). Commit: H3.2+H4.2+I7+I8+I9+I10-parallel-batch-2. |
| 1.87 | 2026-03-19 | **H3.1 Complete** — Shopify OAuth + Scope Selection UI. ShopifyConnector class (GraphQL), /api/crosslister/shopify/callback route (Tier B OAuth code→token exchange, state verification), /cfg/shopify admin hub page. Scope selection UI in OAuth flow. channelEnum migration (SHOPIFY 11th value). 9 platform settings seeded. Wired into crosslister-import service. 41 new tests (8252→8293), 650 test files. Phase H: 8/13 done (H1.1-H1.4, H2.1-H2.3, H3.1). Phase totals: 180/182 done (98.9%). Commit: H3.1-shopify-oauth-scope-selection. |
| 1.85 | 2026-03-19 | **H2.2 Complete** — Whatnot BIN Crosslist. Listing operations on Whatnot via GraphQL: fetchListings (paginated results iteration), createListing (map projection to BIN), updateListing (title/description/price), delistListing (archive), verifyListing (connection test). Wired into existing WhatnotConnector. 97 new tests (8111→8208), 650 test files. Phase H: 6/13 done (H1.1-H1.4, H2.1-H2.2). Phase totals: 178/182 done (97.8%). Commit: 1171534. |
| 1.72 | 2026-03-16 | **G9.2-G9.4 Complete** — Helpdesk Management CRUD, Workspace UX port, Dashboard & Reports. Management macros, routing drag-reorder, automation, teams, SLA & settings editing (G9.2). Workspace keyboard nav, case nav, status dropdown, quick actions, macro vars, optimistic replies, Cmd+Enter shortcuts (G9.3). Dashboard & Reports: real metrics wiring, CSAT integration, volume charts, metric deltas (G9.4). 129 new tests (6885→7014), 558 test files. Phase G: 43/50 done (86%). Phase totals: 166/182 done (91.2%). Commit: G9.2-G9.4-helpdesk-management-workspace-dashboard. |
| 1.71 | 2026-03-16 | **G7 Complete** — Accessibility (WCAG 2.1 AA). Skip nav links, route announcer, ARIA labels, reduced motion support, heading hierarchy fixes, auth form accessibility, platform setting for a11y toggles. 95 new tests (6718→6813), 539 test files. Phase G: 41/50 done (82%). Phase totals: 164/182 done (90.1%). Commit: G7-accessibility-wcag-2-1-aa. |
| 1.70 | 2026-03-15 | **G9 Complete** — Helpdesk + Knowledge Base. Helpdesk system: case lifecycle, SLA tracking, routing, automation, CSAT surveys. Knowledge base: articles, categories, audience gating, feedback. Hub routes: /hd, /hd/cases/[id], /hd/views, /hd/macros, /hd/teams, /hd/routing, /hd/sla, /hd/automation, /hd/reports, /hd/settings, /kb (admin), /kb/new, /kb/[id]/edit, /kb/categories. Public routes: /h, /h/[category-slug], /h/[category-slug]/[article-slug]. User routes: /my/support, /my/support/[caseId]. 260 new tests (6458→6718), 524 test files. Phase G: 40/50 done (80%). Phase totals: 163/182 done (89.6%). |
| 1.69 | 2026-03-15 | **G8 Complete** — GDPR & Data Retention. Account deletion executor pipeline (session/audit/data purge cron jobs), cleanup BullMQ queue, cookie consent banner + /p/cookies page, enhanced GDPR Article 20 data export (18+ categories), admin GDPR compliance dashboard at /data-retention. 4 new platform settings (gdpr.retentionDays, gdpr.deletionWaitDays, gdpr.cookieConsentRequired, gdpr.consentExpiryDays), 1 new column (cookieConsentJson on user table), 1 new route (/p/cookies policy page). 22 new tests, baseline 6458 (was 6436), 511 test files. Phase G: 39/50 done (78% complete). **162 done, 20 remaining.** Commit: G8-gdpr-data-retention. |
| 1.61 | 2026-03-14 | G3.10: Staff curation tools complete. CASL CuratedCollection subject, hub /mod/collections pages, server actions, query functions, 3 components, 119 new tests (5574 total). Phase G: 37/50 done (74%). Phase totals: 153/182 done (84%). |
| 1.0 | 2026-02-17 | Initial tracker. 116 steps across 7 phases. |
| 1.1 | 2026-02-18 | Added B5.0 (done). Updated B4/B4.1/B4.2/B4.3/B5/B5.1 to ✅. Added C3.4–C3.5 (free trials in Phase C). Added G1.2–G1.6 (affiliate community). Added G3.1–G3.5 (affiliate influencer + payouts + admin). Updated G5 to include affiliate 1099-NEC. Updated A2.1 to v1.3 (22 tables). 128 total steps, 17 done. |
| 1.2 | 2026-02-21 | Social & Discovery additions: A2.2, B1.6, C2.3, D1.2, E1.3-E1.5, G1.7, G3.6-G3.11, PL.1-PL.2. Status updates: E1 ✅, C1 ✅, C1.5 ✅, C2 ✅, C2.1 ✅, B1.5 🔨. Deployment: Railway replaces Coolify+Hetzner. 143 total steps, 22 done. |
| 1.3 | 2026-02-21 | **Phase C complete.** All 26 C-phase items marked ✅ (trust weights, perf bands, buyer quality, deal badges, blocking, watcher offers, bundle negotiation, Stripe Connect full suite, trials, returns, disputes, chargebacks, buyer protection, counterfeit claims, shipping exceptions). B-phase updates: B1.4 ✅, B1.5 ✅, B1.6 ✅, B3.2 ✅, B5.2 ✅. Fixed step counts (was 143, now 144 — C had 26 items not 24). **47 done, 97 remaining.** 424 tests passing. Ready for Phase D. |
| 1.4 | 2026-02-24 | v3.2 terminology alignment: TF→TF, PREMIUM→POWER, test baseline updated to 431 (commit 450c77c). Database fully synced with Drizzle schema. Timezone test failures fixed. |
| 1.5 | 2026-03-01 | **D3 complete.** D3-S3 (cancel), D3-S4 (upgrade/downgrade), D3-S5 (bundles + finance) all marked ✅. D2/D2.1-D2.4 marked ✅ (promotions/boosting). D step count corrected 21→26 (sub-steps added). 970 tests, 77 files. Decisions 93-104 locked. Commit `1f2e561`. **58 done, 91 remaining.** |
| 1.6 | 2026-03-01 | D1.2 ✅ — Visual grid default store view. 3-col mobile, 4-col tablet, 5-col desktop. Default view from DB. Commit `1afb90a`. **59 done, 90 remaining.** |
| 1.7 | 2026-03-02 | D5 ✅ — Delegation system (seller staff accounts). CASL authorize.ts integration. Staff delegation CRUD, 44 delegation tests. 1152 total tests, 90 test files. Commit `266e59f`. **60 done, 89 remaining.** |
| 1.8 | 2026-03-02 | B-Phase Spec Compliance Fix — 5-stream refactor across all B-phase code: (1) domain/route/console fixes, (2) Zod validation on 8+ actions + schema strictness, (3) hardcoded fees → platform_settings integration, (4) ledger entry type schema alignment (LOCAL_TRANSACTION_FEE, AUTH_FEE_SELLER/BUYER/REFUND, FINANCE_SUBSCRIPTION_CHARGE, AFFILIATE_COMMISSION_PAYOUT), (5) file splitting: 13 files over 300 lines → under 300 lines. 7 new validation schemas, 14 split files, 1 migration (0009). Baseline stable: 1152 tests, 0 TS errors. No new features — quality gates only. **60 done, 89 remaining.** |
| 1.9 | 2026-03-03 | D5+D6 complete — Delegation system + Authentication Program (verified seller badge, expert authentication, certificates, pHash fingerprinting). 1214 tests, 97 test files. **62 done, 87 remaining.** |
| 1.10 | 2026-03-03 | **E3 Admin Dashboard complete** — All 7 E3 sub-steps marked ✅ (E3.1 platform dashboard, E3.2 user management, E3.3 transactions, E3.4 finance, E3.5 moderation, E3.6 platform settings, E3.7 safe meetup locations). Hub dashboard, user management, transaction explorer, finance ledger/payouts/reconciliation/adjustments, moderation queue, platform settings with fee/commerce/fulfillment tabs, safe meetup management. 1373 tests, 109 test files. **70 done, 79 remaining.** |
| 1.11 | 2026-03-04 | **D-Phase Compliance Repair** — 11 production files + 3 test files fixed. Imports corrected (authorize.ts), delegation checks added to all D5 actions, CASL sub() usage standardized, Zod validation added to shipping and storefront, payout-settings field mismatch fixed, slug field removed from storefront. staffAuthorize() replacing session auth in mod/disputes pages. 1388 tests, 116 test files, 0 TS errors. Quality gates only — no new features. **70 done (15/26 Phase D), 79 remaining.** |
| 1.12 | 2026-03-04 | **C-Phase Final Compliance Repair** — 6 violations + 1 invention fixed: (1) review window defaults 30→60 days, 48→24 hours, (2) settings keys engagement.alerts.* → discovery.priceAlert.*, (3) ability.can() checks added to price alert actions, (4) CASL buyer-block fix (User → SellerProfile), (5) removed invented daily rate limit. 1434 tests (46 new), 126 test files (10 new), 0 TS errors. Phase C now 100% canonically compliant. **70 done (26/26 Phase C, 15/26 Phase D), 79 remaining.** |
| 1.13 | 2026-03-04 | **D2.2 Complete** — Combined Shipping Mode 5 (Quoted + 48hr Penalty). Seller-quoted combined shipping for multi-item orders, 48-hour deadline with 25% auto-penalty on timeout, buyer accept/dispute/renegotiate flow, BullMQ deadline enforcement job, 6 notification templates (quote, accept, auto-penalty, dispute, resolution, cancelled), CASL rules for CombinedShippingQuote resource. 1489 tests, 125 test files, 0 TS errors. **85 done (26/26 Phase C, 18/26 Phase D), 64 remaining.** |
| 1.14 | 2026-03-04 | **A4 Complete** — Staff Roles Management hub pages and actions. Staff list page (/roles) with search/filtering, staff detail page (/roles/staff/[id]) with role grant/revoke, staff creation form (/roles/staff/new). Server actions: createStaffUser, updateStaffUser, grantSystemRole, revokeSystemRole, deactivateStaff, reactivateStaff, resetStaffPassword. Query: getStaffList, getStaffById. Components: staff-role-manager, staff-actions, create-staff-form. Modified: CASL subjects.ts with StaffUser and CustomRole. 1525 tests, 125 test files, 0 TS errors. **86 done (9/9 Phase A), 64 remaining.** |
| 1.15 | 2026-03-04 | **A4.1 Complete + D4 Complete** — A4.1: Custom Role Management with granular permission selection, role creation/edit forms, permission matrix, CASL integration. D4: Financial Center dashboard with P&L calculation (Gross GMV, TF, Stripe fees, net revenue), transaction ledger, monthly revenue chart, FREE tier for all sellers. Phase A now 10/10 steps complete. Phase D: 19/26 done. 1699 tests, 125 test files, 0 TS errors. **88 done, 63 remaining.** |
| 1.16 | 2026-03-04 | **D4 Complete Confirmed** — Financial Center Dashboard + P&L (FREE tier) with 4 KPI cards, 30-day revenue chart, P&L summary (Gross GMV, Transaction Fee, Stripe fees, Net Revenue), paginated transaction history with type filtering, read-only expense summary, Finance Pro upgrade gate. CASL rules for Expense/FinancialReport/MileageEntry. 1712 tests, 125 test files, 0 TS errors. Phase D: 19/26 done. **88 done, 63 remaining.** |
| 1.17 | 2026-03-04 | **D4.2 Complete** — Receipt Scanning + Mileage Tracking. Receipt OCR ingestion, mileage entry with distance calculation, category-based allocation, CASL Plus-tier gating. 1852 tests, 146 test files, 0 TS errors. Phase D: 21/26 done. **90 done, 61 remaining.** |
| 1.18 | 2026-03-04 | **D4.3 Complete** — Balance Sheet + Cash Flow + Export. Balance sheet generation with asset/liability/equity reconciliation, cash flow statement (operating/investing/financing), PDF export via jsPDF, Pro-tier gating. 2117 tests, 146 test files, 0 TS errors. Phase D: 22/26 done. **91 done, 60 remaining.** |
| 1.19 | 2026-03-05 | **E1.1, E1.3, E4, E5 Complete** — E1.1: Notification preferences with digest and quiet hours settings. E1.3: Q&A notifications system (new question → seller, answer → asker). E4: Admin feature flag management. E5: System health checks and Doctor diagnostics. 2186 tests, 162 test files, 0 TS errors. Phase E: 15/19 done. **95 done, 56 remaining.** |
| 1.20 | 2026-03-05 | **E1.4 Complete** — Public Q&A section on listing detail pages. Ask/answer forms, moderation queue integration. 2238 tests, 165 test files, 0 TS errors. Phase E: 16/19 done. **96 done, 55 remaining.** |
| 1.21 | 2026-03-06 | **E2.1 Complete** — Crosslister Connector Framework. Connection layer for eBay/Posh/Mercari connectors: OAuth flows, polling service, sync processor, error handling, BullMQ workers. 2345 tests, 171 test files, 0 TS errors. Phase E: 17/19 done. **97 done, 54 remaining.** |
| 1.22 | 2026-03-05 | **E2.2 Complete** — Buyer-Seller Messaging. Backend conversation management, message sending with safety checks, notification routing, deliverability confirmation. 2436 tests, 177 test files, 0 TS errors. Phase E: 18/19 done. **98 done, 53 remaining.** |
| 1.23 | 2026-03-05 | **E2.3 Complete** — Buyer-Seller Messaging UI. Frontend inbox page, conversation thread view, Message Seller button on listing detail, sidebar notification badges, admin flagged messages management table. 2646 tests, 188 test files, 0 TS errors. Phase E: 19/19 done (PHASE COMPLETE). **99 done, 52 remaining.** |
| 1.24 | 2026-03-05 | **Phase E audit + spec alignment.** 19 audit findings fixed (auth patterns, console→logger, cuid2 validation, 8 email templates, orphan wiring, delegation). 3 spec docs updated (Schema §10.3 notificationSetting, Actors + Conversation/ListingQuestion CASL subjects, Platform Settings rate limit 20→30). Corrected Phase D totals: all 26 D steps were ✅ but summary count was stale at 22. **Phases A–E 100% complete. 103 done, 48 remaining.** |
| 1.25 | 2026-03-06 | **F1 Complete** — eBay Import (F1.1 OAuth + F1.2 Fetch/Transform/Dedupe + F1.3 Bulk Import UI). EbayConnector class, OAuth callback API route, import pipeline (5-stage: fetch→dedupe→transform→import→complete), dedupe fingerprinting, listing creator, 4 pages (/my/selling/crosslist/*), 7 components, 29 new files + 4 modified. 2715 tests (+69), 196 test files, 0 TS errors. Phase F: 4/12 done. **107 done, 44 remaining.** |
| 1.26 | 2026-03-06 | **F2 Complete** — Poshmark + Mercari Import. PoshmarkConnector (Tier C, session-based auth), MercariConnector (Tier B, OAuth), normalizers for both, generic normalizer dispatch, connector barrel registration, Mercari OAuth callback, session auth dialog component. Genericized import pipeline (removed all eBay hardcoding). 16 new + 8 modified files. 2806 tests (+91), 201 test files, 0 TS errors. Phase F: 5/12 done. **108 done, 43 remaining.** |
| 1.27 | 2026-03-06 | **F3 Complete** — Crosslist Outbound (publish to eBay/Posh/Mercari). 4 core services: listing-transform (normalize to target platform), publish-meter (allowance tracking), policy-validator (channel eligibility), publish-service (8-connector dispatch). Server actions: publishListings, delistFromChannel, updateProjectionOverrides, getPublishAllowanceAction. UI components: crosslist-panel, publish-dialog, projection-table, projection-overrides-dialog, publish-meter. 8 connector implementations (eBay, Poshmark, Mercari with real createListing/updateListing/delistListing). 4 new query functions. 77 new tests, 218 test files total. 3076 tests, 0 TS errors. Phase F: 6/12 done. **109 done, 55 remaining.** |
| 1.28 | 2026-03-06 | **F3.1 Complete** — Publish queue + scheduler. BullMQ queue (lister-queue.ts) + worker (lister-worker.ts), in-memory sliding-window rate limiter per channel+seller (rate-limiter.ts), worker lifecycle init via instrumentation.ts (worker-init.ts), job executor service extracted from publish-service (job-executor.ts), queue-status-card UI component, queue constants (priorities, backoff, limits), refactored publish-service from inline→enqueue pattern, cancelJob + getJobQueueStatus actions, getSellerQueueStatus query. 46 new tests, baseline 3122. Phase F: 7/12 done. **110 done, 54 remaining.** |
| 1.29 | 2026-03-07 | **F4 Complete** — Lister Subscriptions (Stripe billing). Publish credit ledger system tracking FREE tier allowance, monthly rollover and carryover logic. Downgrade warning system with 30-day notice before tier drop. FREE tier auto-activation on signup with 300 monthly credits. Overage pack purchases (100-credits/$4.99, 500/$24.99, 1000/$49.99). Lister subscription UI: tier comparison table, purchase button, credit meter, invoice history, usage-based billing webhooks. 102 new tests, baseline 3224 (was 3122), 230 files (was 224). Phase F: 8/12 done. **111 done, 53 remaining.** |
| 1.30 | 2026-03-08 | **F5-S1 Complete** — Polling Engine (adaptive sale detection). poll-budget (tier-based quota: 1min/hour/day per tier), poll-tier-manager (dynamic tier assignment), poll-scheduler (BullMQ job dispatch), poll-executor (actual fetch with exponential backoff), rate-limiter (in-memory sliding window per channel+seller), health endpoint (/api/hub/crosslister/poll-scheduler-health). 112 new tests, baseline 3387 (was 3275), 247 files (was 235). Phase F: 9/13 done, F5 in progress. **112 done, 53 remaining.** |
| 1.31 | 2026-03-08 | **F5-Teaser Complete** — Free Lister Teaser (time-limited FREE tier). 6-month FREE tier teaser for new sellers: 5 publishes/month for 6 months from account creation. Auto-downgrade via nightly BullMQ cron job. `listerFreeExpiresAt` column added to sellerProfile. Existing accounts with FREE tier + NULL listerFreeExpiresAt are grandfathered (no delisting on downgrade). Platform setting: `crosslister.freeTierMonths` (default 6). 11 new tests, baseline 3398 (was 3387), 248 files (was 247). Phase F: 10/14 done. **113 done, 53 remaining.** |
| 1.32 | 2026-03-09 | **G1-A Complete** — Buyer Onboarding (Post-Signup Interest Picker). Interest categories selector at /auth/onboarding post-signup flow. Category interest data persisted to userInterest table. Personalization engine wiring (feed, recommendations, discovery). 60 new tests, baseline 3550 (was 3490), 273 files (was 258). Phase G: 1/35 done. **117 done, 50 remaining.** |
| 1.33 | 2026-03-09 | **G1-B Complete** — Seller Onboarding & Personal Activation + Business Upgrade Wizard. Personal seller account activation flow. Business upgrade wizard with Stripe Connect + identity verification gates. Seller type toggle (PERSONAL ↔ BUSINESS), onboarding form wizard, eligibility checks, subscription tier defaults. 71 new tests, baseline 3621 (was 3550), 288 files (was 273). G step count updated 35→36 (G1-C added as remaining sub-step). Phase G: 2/36 done. **118 done, 50 remaining.** |
| 1.34 | 2026-03-09 | **G1-C Complete** — Import Onboarding Guide (First-Time Crosslister Guide). Guided introduction to crosslister imports showing eBay/Posh/Mercari import options, benefit callouts, quick-start flows. G1 parent now COMPLETE (all 3 sub-steps: G1-A, G1-B, G1-C done). 29 new tests, baseline 3650 (was 3621), 274 files (was 288). Phase G: 3/36 done. **119 done, 49 remaining.** |
| 1.35 | 2026-03-09 | **G1.1 Complete** — Mobile Listing AI Auto-Fill. Claude Vision auto-fill on listing creation form with usage tier gating (NONE: 10/month, STARTER/PRO: 50/month, POWER: 200/month, ENTERPRISE: unlimited). 7 new platform settings for tier limits. aiAutofillUsage table tracks consumption. Usage meter and refill UI on listing creation form. 79 new tests, baseline 3735 (was 3656), 280 files (was 275). Phase G: 4/36 done. **120 done, 48 remaining.** |
| 1.36 | 2026-03-10 | **G1.2-G1.6 Complete** — Affiliate system: schema + tables (G1.2), community self-serve signup (G1.3), affiliate dashboard with stats/referrals/commissions/payouts (G1.4), promo code system for affiliate + platform codes (G1.5), referral link handler at /ref/{code} (G1.6). Commits ef2b624, b457e27, 33135a6, ac7622e. Phase G: 9/50 done. |
| 1.37 | 2026-03-10 | **G2-G2.4 Complete** — Twicely.Local core: local transaction flow, QR escrow + offline fallback, safe meetup UI, no-show detection, safety timer + emergency. Commit b37998c. Phase G: 13/50 done. |
| 1.38 | 2026-03-11 | **G2.5+G2.18 Addendum Complete** — G2.5: Meetup map (Leaflet + OSM) with buyer/seller/safe-spot pins, dashed polyline, distance chip, directions button. Dynamic import (ssr: false). Haversine distance utility. G2.18: Large item handling flags (NEEDS_VEHICLE, NEEDS_HELP, NEEDS_DISASSEMBLY, NEEDS_EQUIPMENT). localHandlingFlags text[] column on listing, multi-select in form, amber warning on detail, checkout acknowledgment. listing-form-ai-handler.ts extracted. Migration 0013. G2 sub-steps expanded from addendum (G2.5-G2.18). 38 new tests, baseline 4201 (was 4163), 326 files (was 318). Phase G: 18/50 done. **134 done, 48 remaining.** |
| 1.41 | 2026-03-11 | **G2.6 Complete** — Meetup Price Adjustment. Seller can reduce local transaction price at meetup (max 33% from `commerce.local.maxAdjustmentPercent`). ADJUSTMENT_PENDING status added. Buyer accept/decline flow with token regeneration (old codes overwritten). LOCAL_PRICE_ADJUSTMENT ledger entry for Stripe partial refund delta. TF stays on original price (no fee reversal). 5 nullable columns on localTransaction (adjustedPriceCents, adjustmentReason, timestamps). Price adjustment service, 2 server actions, 2 UI components (form + response). Parent order pages pass originalPriceCents + maxDiscountPercent. 60 new tests, baseline 4261 (was 4201), 330 files (was 326). Phase G: 19/50 done. **135 done, 47 remaining.** |
| 1.42 | 2026-03-11 | **G2.7 Complete** — Dual-Token Ed25519 + Offline Mode. Replaced single confirmationCode/offlineCode with dual-token Ed25519 signed system (sellerConfirmationCode, buyerConfirmationCode, sellerOfflineCode, buyerOfflineCode). Server signs with Node.js crypto, client verifies with tweetnacl. IndexedDB preloading via idb-keyval. Centrifugo channel stubs. 4 confirmation modes: QR_ONLINE, QR_DUAL_OFFLINE, CODE_ONLINE, CODE_DUAL_OFFLINE. 58 new tests, baseline 4319 (was 4261), 326 files (was 330). Phase G: 20/50 done. **136 done, 46 remaining.** |
| 1.43 | 2026-03-11 | **G2.8 Complete** — Local Reliability System (replaces no-show fees). Mark-based reliability score replaces $5 monetary penalties. 10 event types (no-show, late, cancel, etc). 180-day rolling decay. 9-mark suspension threshold. Display tiers: RELIABLE (0-2 marks), INCONSISTENT (3-8 marks), UNRELIABLE (9+ marks). Decisions #114-120 locked. 28 new tests, baseline 4347 (was 4319), 336 files (was 326). Phase G: 21/50 done. **137 done, 45 remaining.** |
| 1.44 | 2026-03-11 | **G2.9 Complete** — Meetup Time Picker (sets scheduledAt). Structured propose/accept flow for scheduling meetup timestamp. scheduledAt nullable on localTransaction. BullMQ nudge job for reminders. MeetupTimePicker component with date/time picker. Decision #117 locked. 56 new tests, baseline 4403 (was 4347), 342 files (was 336). Phase G: 22/50 done. **138 done, 44 remaining.** |
| 1.45 | 2026-03-12 | **G2.11 Complete** — Pre-Meetup Cancellation Flow. Either party cancels scheduled meetup. Time-based reliability marks (graceful/late/sameday), full Stripe refund, listing re-activation, BullMQ cleanup, CancelMeetupButton component. Decision #121 locked. 51 new tests, baseline 4509 (was 4458), 349 files (was 342). Phase G: 24/50 done. **140 done, 42 remaining.** |
| 1.46 | 2026-03-12 | **G2.12 Complete** — Day-of Confirmation Request. Buyer sends 'Are we still on?' within 12-hour window pre-meetup. Seller can confirm meeting, propose reschedule, or let 2-hour timeout expire → SELLER_DARK mark (-1) + immediate no-show escalation. Reschedule PENDING counts as valid response (Decision #124). Decisions #122-124 locked. 50 new tests, baseline 4559 (was 4509), 353 files (was 349). Phase G: 25/50 done (50% complete). **141 done, 41 remaining.** |
| 1.47 | 2026-03-12 | **G2.13 Complete** — Meetup Reminder Notifications. Automatic 24-hour and 1-hour pre-meetup reminders to both parties via email. BullMQ nudge jobs enqueued on schedule confirmation or reschedule accept. Stale job guard prevents duplicate reminders. Skip-past logic: if meetup is <24 hours away, 24hr reminder skipped (not fired with 0 delay). Both reminders resolved at fire-time from DB (listing.title, safeMeetupLocation.name). Decision #125-127 locked. 37 new tests, baseline 4596 (was 4559), 358 files (was 353). Phase G: 26/50 done (52% complete). **142 done, 40 remaining.** |
| 1.48 | 2026-03-12 | **G2.14 Complete** — Listing Auto-Reserve on Escrow. Listing status transitions: ACTIVE→RESERVED on local transaction creation (escrow placed), RESERVED→ACTIVE on cancel/no-show (listing re-activated for sale), RESERVED→SOLD on transaction completion. Blue reservation banner on listing detail pages. Offers auto-declined while listing is RESERVED. Decision #128-129 locked. 27 new tests, baseline 4623 (was 4596), 363 files (was 358). Phase G: 27/50 done (54% complete). **143 done, 39 remaining.** |
| 1.49 | 2026-03-12 | **G2.15 Complete** — Escrow Fraud Detection System. Three-tier fraud flag system: CONFIRMED (automatic 30-day ban), STRONG_SIGNAL (admin review required), MANUAL_REVIEW (staff-initiated). localFraudBannedAt timestamp on user table with timezone. localFraudFlag table with userId, severity, status, reason, flaggedBy, reviewed fields. Admin review page with accept/dismiss actions. Automatic ban enforcement on transaction creation. 67 new tests, baseline 4690 (was 4623), 383 files (was 363). Phase G: 28/50 done (56% complete). **144 done, 38 remaining.** |
| 1.50 | 2026-03-12 | **G2.16 Complete** — At-Meetup Photo Evidence. Camera capture system with base64 encoding and encrypted upload. Server-side validation, fraud photo audit trail. meetupPhotoUrls text[] and meetupPhotosAt timestamp columns added to localTransaction. PhotoEvidenceCapture component with client-side compression. Fraud event logging to localFraudFlag audit. Decision #130 locked. 88 new tests, baseline 4778 (was 4690), 393 files (was 383). Phase G: 29/50 done (58% complete). **145 done, 37 remaining.** |
| 1.51 | 2026-03-13 | **G2.17 Complete** — Local Seller Metrics. Summary stats displayed on storefront and listing detail: local transaction count, completion rate, reliability tier, average response time. Query service, display component, 37 new tests, baseline 4815 (was 4778), 397 files (was 393). Phase G: 30/50 done (60% complete). **146 done, 36 remaining.** |
| 1.52 | 2026-03-13 | **G3.1 Complete** — Influencer Applications + Admin Approval. Influencer application form, application status tracker, admin dashboard with approve/reject/suspend/unsuspend/ban actions. Hub pages at /usr/affiliates (list, detail, actions). 112 new tests, baseline 4927 (was 4815), 402 files (was 397). Phase G: 31/50 done (62% complete). **147 done, 35 remaining.** |
| 1.53 | 2026-03-13 | **G3.2 Complete** — Influencer Landing Pages (/p/{slug}). Public influencer landing pages auto-generated from user profile + promo codes. React cache() deduplication for profile queries, safe URL slug validation. 53 new tests, baseline 4980 (was 4927), 404 files (was 402). Phase G: 32/50 done (64% complete). **148 done, 34 remaining.** |
| 1.54 | 2026-03-13 | **G3.3 Complete** — Affiliate Payouts (monthly BullMQ job). Commission graduation system, affiliate-payout-service with ledger reconciliation, commission reversal for disputed/refunded orders, payout cron job with Stripe Connect integration, affiliate payout admin actions and review pages. Decision #131 (affiliate commission structure). 61 new tests, baseline 5041 (was 4980), 413 files (was 404). Phase G: 33/50 done (66% complete). **149 done, 33 remaining.** |
| 1.55 | 2026-03-13 | **G3.4 Complete** — Admin Affiliate Management (/usr/affiliates dashboard, /fin/affiliate-payouts). Admin pages for managing affiliates, viewing application history, payout batch details, performance metrics, performance banding summaries. 35 new tests, baseline 5076 (was 5041), 401 files (was 413). Phase G: 31/50 done (62% complete). **147 done, 35 remaining.** |
| 1.56 | 2026-03-13 | **G3.5 Complete** — Affiliate Anti-Fraud Detection & Escalation. Six fraud detection checks (self-referral IP/device, velocity abuse, credential stuffing, payment method changes, browser fingerprinting, geographic velocity). Three-strikes escalation system with affiliate ban enforcement. BullMQ cron job (every 6 hours) for scheduled scans. Fraud notification templates. Self-referral IP check at ref link click time. 63 new tests, baseline 5178 (was 5076), 405 files (was 401). Phase G: 32/50 done (64% complete). **148 done, 34 remaining.** |
| 1.57 | 2026-03-13 | **G3.6 Complete** — Creator Affiliate Listing Links. Affiliates generate referral links for ANY listing (not just their own). Per-seller opt-in + commission rate settings. IP-based rate limiting on click tracking endpoint. Client-side ?ref= tracking via affiliate-click-tracker component. Seller affiliate settings section on /my/selling/affiliate. affiliateOptIn + affiliateCommissionBps columns on sellerProfile. listingId added to referral table. 72 new tests, baseline 5289 (was 5178), 411 files (was 405). Phase G: 33/50 done (66% complete). **149 done, 33 remaining.** |
| 1.58 | 2026-03-14 | **G3.7 Complete** — Vacation Mode. Sellers pause all active listings during vacation periods. Vacation settings UI embedded in /my/selling/store. Schema: vacationMode boolean, vacationStartAt/vacationEndAt timestamps, vacationMessage text (seller custom message), vacationAutoReplyMessage text (separate auto-reply sent to message inquiries). Automatic listing ACTIVE→PAUSED→ACTIVE transitions on date range. Auto-reply messaging system for buyer inquiries. 69 new tests, baseline 5358 (was 5289), 411 files. Phase G: 34/50 done (68% complete). **150 done, 32 remaining.** |
| 1.59 | 2026-03-14 | **G3.8 Complete** — Follow System + Feed. Follow button on stores and listings. /my/feed (For You) with personalized feed: followed sellers + watchlist items + saved searches + recommendations engine. Sidebar Follow widget. Follow notification templates. 42 new tests, baseline 5400 (was 5358), 411 files. Phase G: 35/50 done (70% complete). **151 done, 31 remaining.** |
| 1.60 | 2026-03-14 | **G3.9 Complete** — Explore/Discovery Page (`/explore`). Public `/explore` page with 4 sections: Trending Now, Staff Picks, Seasonal, Rising Sellers. Homepage tab system (For You/Explore/Categories) with URL query param persistence. 5 query files (explore barrel + explore-shared, explore-trending, explore-collections, explore-sellers), 6 component files (explore-page-content, collection-row, rising-seller-card, rising-sellers-row, home-tabs), 2 page files (explore/page.tsx, updated homepage). 3 platform settings added: discovery.explore.trendingLimit, discovery.risingSellerLimit, discovery.trendingWindowDays. middleware.ts updated with /explore in PUBLIC_PATHS. 46 new tests (27 original + 19 additional), baseline 5455 (was 5400), 432 files (was 411). Phase G: 36/50 done (72% complete). **152 done, 30 remaining.** |
| 1.61 | 2026-03-14 | **G3.10 Complete** — Staff Curation Tools (/mod/collections). CASL CuratedCollection subject, 7 server actions (create/update/delete/add/remove/reorder items/search), 3 query functions (list/getById/searchListings), 3 hub pages (/mod/collections list, /new create, /[id] edit), 3 client components (collection-form, item-manager, delete-button). 119 new tests, baseline 5574 (was 5455), 439 files. Phase G: 37/50 done (74%). **153 done, 29 remaining.** |
| 1.62 | 2026-03-14 | **G3.11 Complete** — Video on Listings (upload + display). Magic byte validation (MP4/MOV/WebM), R2 upload/delete service, video-handler.ts in /api/upload route, client-side video uploader with canvas thumbnail extraction, listing-video-card.tsx wrapper, listing-video-player.tsx with autoplay-muted + reduced-motion support, listing-form.tsx + listing-form-actions.tsx refactoring (extracted submit buttons). Modified: upload route.ts, listing-form.tsx, listing.ts validation, listings.ts queries/types, listings-create.ts, listings-update.ts, listing detail page, platform settings seed. 3 platform settings: listing.video.maxSizeBytes, listing.video.maxDurationSeconds, listing.video.minDurationSeconds. 91 new tests (49 executor + 42 test-writer), baseline 5665 (was 5574), 445 files. Phase G: 38/50 done (76%). **154 done, 28 remaining.** Commit: G3.11-video-on-listings. |
| 1.63 | 2026-03-14 | **G1.7 Complete** — Mobile Video Recording in Listing Creation. In-app camera recording via MediaRecorder API, video trimmer via HTMLCanvasElement.captureStream(), dual-mode entry (record from camera or upload file). Supports MP4/MOV/WebM. Client-side preview before submit. 94 new tests. Phase G: 40/50 done (80% complete). **156 done, 26 remaining.** Commit: G1.7-mobile-video-recording. |
| 1.64 | 2026-03-14 | **G4 Complete** — Enforcement & Moderation Infrastructure. Content report system (reportType enum: LISTING_PHOTO, LISTING_DESCRIPTION, STORE_INFO, MESSAGE), enforcement action tracking (actionType enum: WARNING, LISTING_REMOVAL, STORE_RESTRICTION, ACCOUNT_SUSPENSION, PERMANENT_BAN), 6 new enums (reportType, reportStatus, actionType, actionStatus, suspensionReason, banReason), 2 new tables (contentReport, enforcementAction), 7 sellerProfile columns (lastWarningAt, totalWarnings, firstListingRemovalAt, totalListingRemovals, suspendedAt, suspensionReason, bannedAt), CASL subjects (ContentReport, EnforcementAction), 11 platform settings (reporting.maxReportsPerDay, reporting.reportRetention, enforcement.warningThreshold, enforcement.listingRemovalThreshold, enforcement.suspensionMarkThreshold, enforcement.suspensionDays, enforcement.banThreshold, enforcement.banAppealsEnabled, enforcement.appealWindow, enforcement.appealReviewWindow, enforcement.autoSuspensionOnNoShow), 5 hub pages (/mod/reports list, /mod/reports/[id] detail, /mod/enforcement list, /mod/enforcement/[id] detail, /mod/enforcement/new create), 4 notification templates (warning, listing-removed, suspended, banned), admin actions for warning/removal/suspension, appeal flow. 67 new tests. Phase G: 34/50 done (68% complete). **157 done, 25 remaining.** Commit: G4-enforcement-moderation-infrastructure. |
| 1.65 | 2026-03-14 | **G4.1 Complete** — Seller Standards Bands + Auto-Enforcement. Performance band thresholds (EMERGING/ESTABLISHED/TOP_RATED/POWER_SELLER) drive auto-enforcement on cancellations, returns, and escalations. New sellerProfile columns: performanceBand, cancelRatePercent, returnRatePercent, disputeRatePercent, bandAppliedAt, bandUpdatedAt. New platform settings: enforcement.performanceBand_emerging_threshold, enforcement.performanceBand_established_threshold, enforcement.performanceBand_topRated_threshold, enforcement.performanceBand_autoEnforceEnabled, enforcement.performanceBand_warningBand, enforcement.performanceBand_restrictionBand. New `/my/selling/performance` seller page showing band status, metrics, and appeal form. 136 new tests, baseline 6053 (was 5917). Phase G: 35/50 done (70% complete). **158 done, 24 remaining.** Commit: G4.1-seller-standards-bands-auto-enforcement. |
| 1.66 | 2026-03-14 | **G4.2 Complete** — Appeal Flow. Seller appeals on enforcement actions (warnings, listing removals, suspensions). 7 appeal columns on enforcementAction (appealStatus, appealReason, appealSubmittedAt, appealReviewedAt, appealReviewedBy, appealResolution, appealReasonForDenial). Appeal submission form embedded in /my/selling/performance page. Appeal review form at /mod/enforcement/[id] for staff. 3 notification templates (appeal-submitted, appeal-approved, appeal-denied). 4 platform settings: enforcement.appealWindow (days to submit), enforcement.appealReviewWindow (days for staff review), enforcement.appealReviewersRequired (number of reviewers), enforcement.appealAutoApprovalOnExpiry. 86 new tests, baseline 6139 (was 6053). Phase G: 36/50 done (72% complete). **159 done, 23 remaining.** Commit: G4.2-appeal-flow. |
| 1.67 | 2026-03-14 | **G5 Complete** — Tax & Compliance (TaxJar, 1099-K, Affiliate 1099-NEC). G5.1-G5.6: Tax info storage with AES-256-GCM encryption for SSN/EIN, TaxJar provider abstraction for sales tax calculation, 1099-K threshold tracking and annual document generation via BullMQ, affiliate 1099-NEC generation, admin tax compliance hub at /fin/tax, seller tax info page at /my/selling/tax. TaxInfo CASL subject with encryption/decryption. 5 platform settings: tax.taxjarEnabled, tax.form1099kThreshold, tax.form1099necThreshold, tax.encryptionKeyRotationDays, tax.archiveRetention. 4 notification templates: 1099-k-ready, 1099-nec-ready, tax-reminder, nec-filing-deadline. 117 new tests, baseline 6256 (was 6139). Phase G: 37/50 done (74% complete). **160 done, 22 remaining.** Commit: G5-tax-and-compliance. |
| 1.69 | 2026-03-15 | **G8 Complete** — GDPR & Data Retention. Account deletion executor pipeline (session/audit/data purge cron jobs), cleanup BullMQ queue, cookie consent banner + /p/cookies page, enhanced GDPR Article 20 data export (18+ categories), admin GDPR compliance dashboard at /data-retention. 4 new platform settings (gdpr.retentionDays, gdpr.deletionWaitDays, gdpr.cookieConsentRequired, gdpr.consentExpiryDays), 1 new column (cookieConsentJson on user table), 1 new route (/p/cookies policy page). 22 new tests, baseline 6458 (was 6436), 511 test files. Phase G: 39/50 done (78% complete). **162 done, 20 remaining.** Commit: G8-gdpr-data-retention. |
| 1.68 | 2026-03-15 | **G6 Complete** — KYC & Identity Verification (Stripe Identity, seller verification, privacy settings, data retention). Stripe Identity integration on /my/selling/verification (seller face + government ID verification), privacy settings page at /my/settings/privacy (data export request, account deletion request), BullMQ data-export job for GDPR compliance, admin data retention hub at /data-retention (retention policies, scheduled purges, GDPR request queue), identity webhook handler. 2 new enums (identityVerificationStatus, dataExportStatus), 2 new tables (sellerIdentityVerification, dataExportRequest), 5 KYC platform settings, 4 privacy platform settings, 3 CASL subjects (SellerIdentityVerification, DataExportRequest, DataRetentionPolicy), 8 notification templates (kyc-pending, kyc-approved, kyc-rejected, data-export-initiated, data-export-ready, data-export-completed, account-deletion-initiated, account-deletion-completed). 116 new tests, baseline 6374 (was 6258), 502 test files. Phase G: 38/50 done (76% complete). **161 done, 21 remaining.** Commit: G6-kyc-identity-verification. |
| 1.75 | 2026-03-17 | **G10.7 Complete** — Staff Session Timeout Modal. Inactivity detection with configurable timeout (default 5 minutes) and hard session limit (8 hours). Warning modal with dismiss/logout buttons before forced logout. Session activity tracking on all hub interactions, auto-renewal on activity. Platform settings: `staff.sessionTimeout.inactivityMinutes` (5 default), `staff.sessionTimeout.hardLimitHours` (8). 38 new tests (7350→7388), 599 test files, 0 TS errors. Phase G: 45/50 done (90% complete). **167 done, 15 remaining.** Commit: G10.7-staff-session-timeout-modal. |
| 1.74 | 2026-03-17 | **G10.5 Complete** — Feature Flag Client Context. Client-side `useFeatureFlag()` hook with context provider. Consumes admin-configured flags with `{ enabled, isLoading }` state. Flag context hydration on app root, hook-based flag checking in components. Integration with kill switch system for graceful feature degradation. 28 new tests (7322→7350), 599 test files, 0 TS errors. Phase G: 44/50 done (88% complete). **166 done, 16 remaining.** Commit: G10.5-feature-flag-client-context. |
| 1.73 | 2026-03-17 | **G10.4 Complete** — Kill Switch + Launch Gates. Emergency feature disable system. Platform settings: `platform.killSwitchEnabled` (global panic button), feature-specific gates (`feature.<name>.enabled`). Kill switch service with graceful degradation. Hub /flags page wiring for admin panic control + launch gate management. 118 new tests (7204→7322), 599 test files, 0 TS errors. Phase G: 44/50 done (88% complete). **167 done, 15 remaining.** Commit: G10.4-kill-switch-launch-gates. |
| 1.72 | 2026-03-16 | **G9.1 + G9.5 Complete** — Helpdesk Critical Wiring + KB Completion. G9.1: POST message route fix, context panel data binding, macro UI wiring, sidebar badge count corrections, deduplication cleanup. 17 new tests. G9.5: KB article updates (updateKbArticle action), publish/archive workflow, category CRUD operations, full-text search integration, Markdown editor support. 55 new tests. Combined: 72 new tests (6813→6885), 546 test files (539→546), 0 TS errors. Phase G: 43/50 done (86% complete). **166 done, 50 remaining.** Commit: G9.1+G9.5-helpdesk-wiring-kb-completion. |
| 1.76 | 2026-03-17 | **G10.6 Complete** — Search Typeahead + Trending Suggestions. GET /api/search/suggestions (public, autocomplete with Typesense), GET /api/search/trending (public, trending query categories). SearchBar component upgraded with typeahead dropdown and trending suggestions on focus. 15 new tests (7388→7403), 599 test files, 0 TS errors. Phase G: 46/50 done (92% complete). **168 done, 14 remaining.** Commit: G10.6-search-typeahead-trending. |
| 1.77 | 2026-03-18 | **G10.8 Complete** — Staff Impersonation ("view as user"). Stateless HMAC-signed cookie (`twicely.impersonation_token`) with 15-minute TTL for staff to view marketplace from user's perspective. POST /api/hub/impersonation/start (begin impersonation, requires staff role), POST /api/hub/impersonation/end (end impersonation). ImpersonationBanner component in app layout showing active impersonation status with "Exit impersonation" button. Impersonation state tracked in Centrifugo channel for real-time UI updates. No schema changes (stateless cookies). 78 new tests (7403→7481), 599 test files, 0 TS errors. Phase G: 47/50 done (94% complete). **169 done, 13 remaining.** Commit: G10.8-staff-impersonation. |
| 1.78 | 2026-03-18 | **G10.10 Complete** — Saved Payment Methods Page (/my/settings/payments). Buyer payment method management: list saved Stripe payment methods (cards), add via SetupIntent, remove, set default. New stripeCustomerId column on user table (separate from sellerProfile.stripeCustomerId used for Connect payouts). Page route: /my/settings/payments. Decision #134 locked (buyer stripeCustomerId architecture). 190 new tests (7481→7593), 613 test files, 0 TS errors. Phase G: 47/50 done (94% complete). **169 done, 13 remaining.** Commit: G10.10-saved-payment-methods. |
| 1.79 | 2026-03-18 | **G10.11 Complete** — Chat Component Polish (ChatBox, ChatSidebar, richer UX). Inbox filter tabs (All/Buying/Selling), last-message preview, thread header polish with Avatar + DropdownMenu, read receipts, archive/report inline form, image attachment uploads (JPEG/PNG/GIF/WebP, 4 max per message), quick reply chips (5 static predefined), Centrifugo real-time hook, typing indicator with debounce. 174 new tests (7593→7767), 632 test files, 0 TS errors. Phase G: 48/50 done (96% complete). **170 done, 12 remaining.** Commit: G10.11-chat-component-polish. |
| 1.80 | 2026-03-18 | **G10.12 Complete** — Newsletter Subscribe Form. Homepage + footer email capture form, newsletter_subscriber table with CUID2 unsubscribe token, Resend welcome email with RFC 8058 List-Unsubscribe header, public subscribe/unsubscribe API routes, single opt-in (confirmedAt set on insert), soft delete via unsubscribedAt. 44 new tests (7767→7811), 640 test files, 0 TS errors. Phase G: 49/50 done (98% complete). **171 done, 11 remaining.** Commit: G10.12-newsletter-subscribe-form. |
| 1.81 | 2026-03-18 | **G10.13 Complete — PHASE G & ALL 182 BUILD STEPS COMPLETE** — Connector & Integration Admin Pages. Part 1: Enhanced `/cfg/stripe` with module status, test/live API keys, webhook signing secrets, payment settings, Connect config, test connection wiring. Part 2: 8 new dedicated connector admin pages at `/cfg/ebay`, `/cfg/etsy`, `/cfg/mercari`, `/cfg/poshmark`, `/cfg/depop`, `/cfg/grailed`, `/cfg/fb-marketplace`, `/cfg/therealreal` with OAuth/session config, capabilities, connected accounts, webhook config (eBay/Etsy), test connection. Part 3: `/cfg/integrations` — third-party dependency status dashboard. 91 new tests (7811→7902), 640 test files, 0 TS errors. Phase G: 50/50 done (100% complete). **172 done, 0 remaining.** **READY FOR PHASE H (PLATFORM EXPANSION)** Commit: G10.13-connector-integration-admin-pages. |
| 1.82 | 2026-03-18 | **H1.1 Complete** — Browser Extension Scaffold + Registration. Chrome Manifest V3 extension with service worker, popup, content script bridge. 6 API routes: GET /api/extension/authorize (registration token + callback), GET /api/extension/callback (HTML pass-through), POST /api/extension/register (token→session token, 30-day session), POST /api/extension/heartbeat (health check), POST /api/extension/session (Tier C session data), POST /api/extension/detect (platform detection logging). localStorage+postMessage token relay, jose JWT library, dev-only unpacked distribution. 86 new tests (7902→7988), 640 test files, 0 TS errors. Phase H: 1/TBD done. **173 done.** Commit: H1.1-extension-scaffold-registration. |
| 1.83 | 2026-03-19 | **H1.2 Complete** — Poshmark + FB Marketplace Content Scripts. Poshmark content script (session capture via __NEXT_DATA__, listing scrape, form auto-fill with React setter trick). FB Marketplace content script (session capture via c_user cookie, ARIA-based DOM scraping, auto-fill for inputs + contenteditable). Shared utilities (randomDelay, setReactInputValue, parsePriceStringToCents, waitForElement). Bridge.ts replaced with platform dispatcher. Service worker updated with LISTING_SCRAPED + ACTION_RESULT handlers. New API route: POST /api/extension/scrape (JWT auth, Zod strict schema, Valkey 1-hour TTL cache). 32 new tests (7990→8023), 650 test files, 0 TS errors. Phase H: 2/13 done. **174 done.** Commit: H1.2-poshmark-fb-marketplace-scripts. |
| 1.83 (revised) | 2026-03-19 | **H1.3 Complete** — TheRealReal Content Scripts. Rails CSRF token + session cookies. JSON-LD product data extraction. Form auto-fill for consignment submission (price field omitted — platform sets prices server-side). No new tests (8023→8023, extension-only changes). Phase H: 3/13 done. **175 done, 7 remaining.** Commit: H1.3-therealreal-content-scripts. |
| 1.84 | 2026-03-19 | **H1.4 Complete** — Extension Status UI. /my/selling/crosslist page (server component with auth + CASL gate, parallel data fetches). extension-status-banner (3-state component: connected/install-prompt/session-expired). crosslister-dashboard (client wrapper with all sub-components). extension-status.ts query (Tier C heartbeat detection, session expiry). loading.tsx skeleton. 53 new tests (8023→8076), 650 test files, 0 TS errors. Phase H: 4/13 done. **176 done, 6 remaining.** Commit: H1.4-extension-status-ui. |
| 1.85 | 2026-03-19 | **H2.1 Complete** — Whatnot OAuth Connector. channelEnum migration (WHATNOT 10th value), WhatnotConnector class (GraphQL), OAuth callback route (/api/crosslister/whatnot/callback), admin page (/cfg/whatnot), 9 platform settings seeded, wired into crosslister-import/platform-fees/publish-service. 35 new tests (8076→8111), 650 test files, 0 TS errors. Phase H: 5/13 done. **177 done, 5 remaining.** Commit: H2.1-whatnot-oauth-connector. |
| 1.85 (revised) | 2026-03-19 | **H2.2 Complete** — Whatnot BIN Crosslist. fetchListings (iterate paginated GraphQL results), createListing (map projection to BIN), updateListing (title/description/price), delistListing (archive), verifyListing (connection test). 97 new tests (8111→8208), 650 test files, 0 TS errors. Phase H: 6/13 done. **178 done, 4 remaining.** Commit: H2.2-whatnot-bin-crosslist. |
| 1.86 | 2026-03-19 | **H2.3 Complete** — Whatnot Sale Webhook. POST /api/crosslister/whatnot/webhook receives Whatnot sale events via HMAC signature verification, routes to sale handler service, posts revenue ledger entries (CROSSLISTER_SALE_REVENUE + platform fees), triggers emergency delist if inventory drops to 0. Service-to-service HMAC validation (Whatnot signing with shared secret). 44 new tests (8208→8252), 650 test files, 0 TS errors. Phase H: 7/13 done. **179 done, 3 remaining.** Commit: H2.3-whatnot-sale-webhook. |
| 1.90 | 2026-03-20 | **I16 Complete** — Remaining Page Enrichment. Enriched 8 hub pages: `/d` (period toggle, bar charts, quick actions), `/roles/staff/new` (breadcrumb), `/kb` (search filters, category column, helpful% rating column), `/kb/[id]/edit` (meta fields, tags, preview), `/audit` (date range picker, CSV export), `/flags` (search, detail links), `/mod/reports/[id]` (reporter name, target listing preview, related reports list). 38 new tests (8168→8206), 731 test files, 0 TS errors. Phase I: 16/17 done (94% complete). **196 done, 3 remaining.** Commit: I16-remaining-page-enrichment. |
