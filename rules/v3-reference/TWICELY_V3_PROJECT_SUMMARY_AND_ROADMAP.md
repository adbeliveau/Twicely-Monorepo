# TWICELY V3 — Project Summary & Implementation Roadmap
**Status:** ACTIVE  
**Version:** v2.0  
**Date:** 2026-02-15  
**Purpose:** Founding document for the V3 Claude Project. Read this FIRST before any other file.

---

## What Is Twicely?

Twicely is a peer-to-peer resale marketplace with an integrated crosslisting tool. It combines three products into one platform:

1. **Importer (acquisition):** Free one-time import from any major resale platform. Zero friction, zero cost. Every reseller who imports inventory adds supply to Twicely's marketplace. This is the user acquisition strategy.

2. **Marketplace (monetization):** Buyers browse and purchase secondhand goods. Sellers list items, fulfill orders, and get paid. Revenue from volume-based progressive TF (8-11%). eBay feature parity with better UX.

3. **Crosslister (retention):** Paid SaaS tool to manage and distribute listings across eBay, Poshmark, Mercari, Depop, and other platforms. Twicely is always the canonical hub — all listings exist on Twicely first, then get pushed outward.

**The flywheel:** Seller imports 400 eBay listings for free → all 400 go ACTIVE on Twicely → some sell on Twicely (TF revenue) → seller wants to push to Mercari too → subscribes to Crosslister ($9.99+/mo) → wants a storefront → subscribes to Store ($6.99+/mo). Supply → sales → upsell, all from one free import.

**Goal:** Full eBay feature parity with better UX, better seller tools, better trust systems, and a crosslisting tool that no other marketplace has.

**Domain:** twicely.co (marketplace) + hub.twicely.co (platform staff admin)

---

## What Is V3?

V3 is a **full ground-up rebuild**. V2 exists as a working prototype with 241 Prisma models, 106 pages, 45 install phases, and 93 specification files. V2 proved what needs to be built. V3 builds it right.

V3 is NOT an incremental upgrade. New codebase, new ORM, new auth, new architecture, new monetization model. V2 specs serve as reference — we know what every feature should do — but V3 code starts from an empty repo.

---

## Why Rebuild? V2's Lessons Learned

### Problem 1: Backend-First Left Massive UI Gaps
V2 built 45 phases of Schema → Service → API → Health → UI → Doctor. The UI step was always last and often incomplete.

**V3 fix:** UI-first. Every feature starts with the screen the user sees. Design → UI → API → Schema. If a page doesn't exist in Storybook, the feature doesn't exist.

### Problem 2: Horizontal Layers, Not Vertical Slices
V2 Phase 2 built ALL listings backend. Phase 5 built ALL search. But the buyer journey of "search → view → buy" spans phases 2, 3, 4, 5, and 16. Nothing worked end-to-end until dozens of phases were complete.

**V3 fix:** Vertical slices. Each build phase delivers a complete user flow from UI to database. "Buyer can search, view, and purchase" is one slice.

### Problem 3: 93 Scattered Spec Files
V2 had canonical docs, locked docs, install phases, addendums — often 3-4 files per feature with overlapping and contradictory information.

**V3 fix:** Single canonical spec per domain. One file defines everything. If it's not in that file, it doesn't exist.

### Problem 4: No Page Registry
106 pages existed with no master list. Pages were discovered by grepping, not by consulting a document.

**V3 fix:** Page registry is first-class. Every route, role gate, and page state documented before code is written.

### Problem 5: TypeScript strict:false Hid 321 Bugs
V2's packages/core had strict:false. When enabled, 321 bugs surfaced. 100 "as any" casts were hiding real type errors.

**V3 fix:** strict:true from day zero. Zero "as any" anywhere.

### Problem 6: Single Subscription Axis Was Too Rigid
V2 had one SubscriptionTier enum combining storefront, crosslisting, and fee discounts. This forced sellers into a rigid ladder where a crosslister-only user paid for store features they didn't want, and a Twicely-only seller paid for crosslisting they didn't use.

**V3 fix:** Three independent subscription axes. StoreTier (storefront + tools), ListerTier (crosslister), and Automation add-on. Buy what you need, nothing more. See `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md`.

---

## V3 Tech Stack

| Layer | V2 | V3 | Why Change |
|-------|----|----|------------|
| Framework | Next.js 14 | **Next.js 15** | App Router maturity, Server Actions |
| Language | TypeScript (strict added late) | **TypeScript strict from day 1** | No hidden bugs |
| Styling | Tailwind + shadcn/ui | **Tailwind + shadcn/ui** | No change |
| ORM | Prisma | **Drizzle ORM** | SQL-first, better TS inference, no binary engine |
| Database | PostgreSQL | **PostgreSQL** | No change |
| Auth | NextAuth (custom) | **Better Auth** | Built-in 2FA, session management, social login |
| Authorization | Custom RBAC | **CASL** | Attribute-based, composable, frontend+backend |
| Payments | Stripe Connect | **Stripe Connect** | No change |
| Search | Meilisearch (planned) | **Typesense** | Single-index sorts, geo search, vector search, C++ |
| File Storage | MinIO (planned) | **Cloudflare R2** | S3-compatible, zero egress, global CDN |
| Cache + Queues | Valkey + BullMQ | **Valkey + BullMQ** | No change |
| Real-time | None (planned) | **Centrifugo** | Go WebSocket server, MIT, 1M+ connections |
| Email | SES (planned) | **React Email + Nodemailer** | Component-based, provider-agnostic |
| Monitoring | Custom Doctor | **Grafana + Prometheus + Loki** | Industry-standard observability |
| Page Builder | Puck | **Puck** | Storefronts, landing pages, marketing |
| KB Editor | Puck (wrong tool) | **TBD (Tiptap/Novel/BlockNote)** | Document editor, not page builder |
| Shipping | Shippo | **Shippo** | No change |
| AI | None | **Custom AI module** | FAST, IMAGE, GENERATE, REASON, BATCH |

---

## V3 Architecture Decisions (Locked)

- **One Next.js app, subdomain routing.** `hub.twicely.co` → admin. `twicely.co` → marketplace. Single deployment.
- **Unified user model.** Buyers and sellers are the same account. Three independent subscription axes (StoreTier + ListerTier + Automation).
- **Importer-first strategy.** Free one-time import per marketplace. Listings go ACTIVE immediately. Imports always exempt from insertion fees.
- **CASL authorization everywhere.** 7 actor types: Guest, Buyer, Seller, Delegated Staff, Platform Staff, Admin, Super Admin.
- **Volume-based progressive TF.** 8-11% progressive brackets based on monthly GMV. No per-order fee.
- **No fees on off-platform sales.** Crosslister revenue comes from subscriptions, not per-sale fees.
- **Crosslister available to all sellers.** No BUSINESS requirement. Store requires BUSINESS (free upgrade).
- **Boosting with 7-day attribution.** 1-8% seller-controlled. 30% max promoted in search. Refunded on returns.
- **Prepaid offers.** Card authorized (hold) on submission. Capture on accept. Release on decline/expire/cancel.
- **30-day uniform buyer protection window** across all claim types.
- **No auctions.** Fixed price + offers only.
- **No Poshmark share-to-promote.** Visibility earned by seller quality + boosting, not social activity.
- **Helpdesk at /hd/*.** Full-screen app, separate from Corp admin.
- **Storefront = eBay structure + Shopify polish.** Puck for custom pages at Power+ tier.

---

## The 48 Locked Feature Domains

All feature decisions are in `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` (45 domains) plus 3 dedicated canonicals. Inventory:

**Commerce (10):**
1. Offer System — prepaid, auth holds, counters, auto-accept/decline, bundle offers
2. Promotions & Coupons — seller coupons, store sales, volume discounts, flash sales
3. Cart & Multi-Seller Checkout — soft reservation, per-seller PaymentIntents
4. Shipping — dual mode, batch ship, presets, cost calculator
5. Seller Adjustments — partial refunds, Twicely keeps fees
6. Seller Analytics — P&L, COGS, tax summary, cross-platform revenue
7. Crosslister — canonical hub model, tiered subscriptions, scheduler *(dedicated canonical)*
8. Listing Creation UX — under 3 minutes, smart category, draft auto-save, CSV bulk
9. Product Variations — size/color axes, variant-level pricing/quantity/SKU
10. Condition System — 6-tier (NWT through Acceptable), flaw disclosure required

**Trust & Ratings (5):**
11. Detailed Seller Ratings — 4 dimensions + overall + review photos
12. Buyer Ratings — 3 dimensions, internal trust score
13. Seller Scoring — response time, ship time, cancellation rate
14. Buyer Protection — 30/60 day windows, 5 claim types, seller protection score
15. Seller Standards & Enforcement — performance tracking, warnings, restrictions, suspension

**Experience (10):**
16. Storefront Editor — banner, logo, colors, categories, vacation mode
17. Search & Discovery — saved searches, autocomplete, trending
18. Search Filters — universal + category-driven, AND/OR logic, URL-reflected
19. Social Features — follow sellers, watchers, share to social
20. Onboarding Flows — buyer first-run, seller wizard, import wizard
21. Messaging System — per-listing threads, lifecycle rules, safety scanning
22. Notification Preferences — per-channel controls, priority tiers, quiet hours, digests
23. Vacation Mode — 3 modes, offers always blocked, buyer acknowledgment
24. Offer Edge Cases — deactivation handling, spam prevention, bundle offers
25. Cart & Guest Behavior — guest browsing, signup walls, session merge

**Platform Infrastructure (10):**
26. Image Pipeline — R2 upload, Sharp processing, responsive variants
27. Data Retention & GDPR — pseudonymization, deletion workflows, cookie consent
28. Feature Flags — self-hosted, boolean/percentage/targeted, Valkey-cached
29. Audit Logging — immutable events, 2-year retention, cold storage archive
30. Real-Time — Centrifugo channels, presence, history/recovery
31. Rate Limiting — Valkey sliding window, per-actor-type, login lockout
32. Background Jobs — BullMQ queues, retry strategies, DLQ, cron jobs
33. Monitoring — Grafana dashboards, Prometheus metrics, Loki logs, alert rules
34. Accessibility — WCAG 2.1 AA, keyboard nav, screen reader, axe-core CI
35. Error Pages & SEO — 404/403/500, structured data, sitemaps, Open Graph

**Admin & Operations (8):**
36. Corp Admin Dashboard — global search, quick actions, keyboard shortcuts
37. Admin Settings — plain English descriptions, categorized, full-text search
38. Admin User Detail Page — complete story on one page, related accounts, audit trail
39. Seller Delegation & Staff Management — scoped permissions, 2FA for high-risk, audit
40. Returns & Disputes — RMA workflow, fault-based fee allocation, escalation
41. Tax & Compliance — marketplace facilitator, 1099-K, encrypted tax info
42. Identity Verification — KYC triggers, 3 verification levels, third-party provider
43. Mobile Responsive — responsive-first, touch targets, bottom sheet patterns

**Dedicated Canonicals (3):**
44. Crosslister — `TWICELY_V3_LISTER_CANONICAL.md`
45. Helpdesk — `TWICELY_V3_HELPDESK_CANONICAL.md` (to be written)
46. Knowledge Base — `TWICELY_V3_KB_CANONICAL.md` (to be written)

---

## V3 Implementation Strategy

### Build Order

The first vertical slices focus on the import → marketplace → crosslister funnel:

**Slice 1: "Anyone can browse and view listings"**
- Homepage with search, categories, featured items
- Search results with filters, sort, pagination (Typesense)
- Listing detail page
- Schema: users, listings, categories, images
- Seeded demo data for development

**Slice 2: "Seller can import from eBay"**
- Connect eBay account (OAuth)
- Import flow: progress UI, validation, "Import Issues" queue
- Imported listings go ACTIVE on Twicely
- Import record tracking (one-time per marketplace)
- Schema: crosslister_accounts, import_records, channel_projections

**Slice 3: "Seller can create and manage a listing"**
- Listing creation form (photos, title, description, price, category, condition)
- My listings page with status filters
- Edit listing, end listing
- Insertion fee tracking (monthly allowance)
- Schema: listing state machine

**Slice 4: "Buyer can purchase an item"**
- Add to cart, checkout, payment (Stripe)
- Order confirmation
- Seller sees order, ships, provides tracking
- Buyer receives, order completes
- TF calculation (progressive volume brackets)
- Schema: orders, payments, shipping

**Slice 5: "Seller can crosslist to external platforms"**
- Crosslister dashboard (publish count, connected platforms)
- Push listing to eBay/Poshmark/Mercari
- Publish metering per ListerTier
- Schema: channel_projections, publish_records

**Slice 6: "Messaging and real-time"**
- Per-listing message threads
- Real-time via Centrifugo
- Order status real-time updates

### The Rule: No Phantom Features

Backend-only work (webhooks, cron jobs) is built as part of the slice that needs it. Stripe webhooks are built in the checkout slice, not a separate "payments phase."

### Completeness Checks

Every slice, before done:
1. ✅ All pages render in all states (Storybook)
2. ✅ All API routes return correct data
3. ✅ All CASL permissions enforced
4. ✅ All state machine transitions tested
5. ✅ Playwright E2E for happy path
6. ✅ TypeScript strict passes with zero errors
7. ✅ Mobile responsive (375px)

---

## V3 Documents

### ✅ COMPLETED

| # | Document | Purpose |
|---|----------|---------|
| 1 | `TWICELY_V3_PROJECT_SUMMARY_AND_ROADMAP.md` | This file — read-first orientation |
| 2 | `TWICELY_V3_PROJECT_INSTRUCTIONS.md` | Claude Project custom instructions |
| 3 | `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` | ALL pricing, fees, tiers, bundles, credits, import rules |
| 4 | `TWICELY_V3_USER_MODEL.md` | Unified user model, three subscription axes, Drizzle sketch |
| 5 | `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | CASL authorization, 7 actors, delegation, 200+ security requirements |
| 6 | `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | All 45 domains with complete business rules |

| 7 | `TWICELY_V3_LISTER_CANONICAL.md` | Crosslister technical architecture | ✅ DONE |
| 8 | `TWICELY_V3_BUILD_BRIEF.md` | Build order, closed decisions, execution rules | ✅ DONE |

### 🔲 NEEDED

| # | Document | Purpose | Priority |
|---|----------|---------|----------|
| 9 | `TWICELY_V3_SCHEMA.md` | Complete Drizzle schema for all domains | **CRITICAL — build first** |
| 10 | `TWICELY_V3_PAGE_REGISTRY.md` | Every route, role gate, page states | **CRITICAL — build second** |
| 11 | `TWICELY_V3_STATE_MACHINES.md` | All state machines in one file | HIGH |
| 12 | `TWICELY_V3_API_SURFACE.md` | Every API route, auth, shapes | HIGH |
| 13 | `TWICELY_V3_SLICE_[N]_*.md` | Install prompts per vertical slice | Created as we go |
| 14 | `TWICELY_V3_COMPONENT_LIBRARY.md` | Shared UI components, design tokens | MEDIUM |
| 15 | `TWICELY_V3_PROVIDER_SYSTEM.md` | Adapter interfaces for external services | MEDIUM |
| 16 | `TWICELY_V3_ENUMS_AND_CONSTANTS.md` | All enums, status codes, error codes | MEDIUM |

---

## Open Decisions

| Decision | Choice | Status |
|----------|--------|--------|
| KB editor | ON HOLD — not in first 10 slices | **DEFERRED** |
| Email provider | React Email + Resend | **CLOSED** |
| Deployment | Coolify on Hetzner (self-hosted) | **CLOSED** |
| CI/CD | GitHub Actions | **CLOSED** |
| Testing framework | Vitest (unit) + Playwright (E2E) | **CLOSED** |

---

**END OF PROJECT SUMMARY**
