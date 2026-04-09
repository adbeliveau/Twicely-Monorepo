# TWICELY V3 — PROJECT BRIEF & BUILD ORDER
**For:** New Claude project context
**Status:** ACTIVE — this is the execution plan
**Date:** 2026-02-15

---

## WHAT THIS IS

Twicely V3 is a ground-up rebuild of a peer-to-peer resale marketplace (eBay clone, better UX). V2 exists but had fatal architectural problems — strict:false hiding 321 TypeScript bugs, backend-first approach creating UI gaps, specification drift from AI implementations. V3 starts clean.

**Everything is documented.** 7 canonical documents totaling 6,732 lines define every feature, every pricing decision, every security rule, every domain. These docs ARE the product spec. If it's not in a doc, it doesn't exist. If code contradicts a doc, the code is wrong.

---

## THE 7 CANONICAL DOCUMENTS (Read-Only Law)

| Doc | Lines | What It Covers |
|-----|-------|---------------|
| `TWICELY_V3_PROJECT_INSTRUCTIONS.md` | 125 | Tech stack, rules, vocabulary, forbidden patterns |
| `TWICELY_V3_PROJECT_SUMMARY_AND_ROADMAP.md` | 281 | Strategy, flywheel, domain inventory, slice roadmap |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | 1,508 | CASL authorization, 7 actor types, delegation, 200+ security rules |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | 1,946 | 45 feature domains with complete business rules |
| `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` | 637 | Dual subscriptions, TF, insertion fees, boosting, bundles, AI credits |
| `TWICELY_V3_USER_MODEL.md` | 727 | Unified user model, 3 subscription axes, PerformanceBand, Drizzle sketch |
| `TWICELY_V3_LISTER_CANONICAL.md` | 1,508 | Crosslister architecture, scheduler, connectors, imports, dedupe |

**Rule:** Never modify these docs without explicit owner approval. They are the constitution.

---

## TECH STACK (Locked — No Substitutions)

| Layer | Technology | NOT This |
|-------|-----------|----------|
| Framework | Next.js 15 + TypeScript strict:true | — |
| ORM | Drizzle ORM | NOT Prisma |
| Auth | Better Auth | NOT NextAuth |
| Authorization | CASL | NOT custom RBAC |
| Database | PostgreSQL | — |
| Search | Typesense | NOT Meilisearch |
| File Storage | Cloudflare R2 | NOT MinIO, NOT S3 |
| Cache + Queues | Valkey + BullMQ | NOT Redis, NOT Bull |
| Real-Time | Centrifugo | NOT Soketi, NOT Pusher |
| UI | Tailwind + shadcn/ui | — |
| Email | React Email + Resend | — |
| Testing | Vitest (unit) + Playwright (E2E) | — |
| Monitoring | Grafana + Prometheus + Loki | — |
| Deployment | Coolify (self-hosted on Hetzner) | NOT Vercel |
| CI/CD | GitHub Actions | — |

**Closed decisions (was open, now locked):**

| Decision | Choice | Why |
|----------|--------|-----|
| Email | React Email + Resend | Best DX, great templates, reliable delivery, simple API. SES is cheaper at scale but Resend is better for building. Switch to SES later if needed. |
| Deployment | Coolify on Hetzner | Self-hosted gives full control, no vendor lock-in, cheaper at scale. Coolify is the best self-hosted PaaS (Docker-based, git push deploy, SSL, logs). Hetzner for price/performance. |
| CI/CD | GitHub Actions | Industry standard, free for private repos, tight GitHub integration. |
| Testing | Vitest + Playwright | Vitest is fastest for unit/integration. Playwright is most reliable for E2E. Both have excellent TS support. |
| KB Editor | **ON HOLD** | Knowledge Base is not in the first 10 slices. Decision deferred. Will evaluate Tiptap (via Novel) vs BlockNote when we reach KB slice. |

---

## VOCABULARY (Enforced — Get It Wrong And Everything Breaks)

| Term | Meaning | Context |
|------|---------|---------|
| `StoreTier` | Storefront subscription tier | NONE, STARTER, PRO, POWER, ENTERPRISE |
| `ListerTier` | Crosslister subscription tier | NONE, FREE, LITE, PRO |
| `PerformanceBand` | Earned seller quality level | STANDARD, RISING, TOP_RATED, POWER_SELLER |

**FORBIDDEN:** Never use `SellerTier` or `SubscriptionTier` anywhere — not in code, not in comments, not in types, not in database columns. These terms are ambiguous and were the source of V2 confusion.

---

## HOW WE BUILD (Read This Twice)

### Philosophy: UI-First Vertical Slices

V2 failed because it built backend-first in horizontal layers (all models → all APIs → all pages). This created 241 Prisma models with no UI to use them, 184 API routes nobody tested end-to-end, and massive integration debt.

**V3 builds vertically.** Each slice is a complete user journey from button click to database write and back. One slice = one feature a user can actually use. Every slice ships working UI + API + database + tests.

### The Rules

1. **Read the canonical docs BEFORE writing code.** Every slice starts by reading the relevant sections of the 7 docs. Don't assume. Don't improvise. The answers are in the docs.

2. **One slice at a time. Linear. No skipping.** Don't start Slice 3 until Slice 2 passes all tests. No "I'll come back to this later." Later never comes.

3. **TypeScript strict:true from line one.** Zero `as any`. Zero `@ts-ignore`. Zero `@ts-expect-error`. If the types don't work, the design is wrong — fix the design, not the types.

4. **Every slice ends with passing tests.** Unit tests for business logic (Vitest). E2E test for the user flow (Playwright). If it doesn't have a test, it doesn't exist.

5. **Small files.** No file over 300 lines. If it's longer, split it. Components, hooks, utils, server actions — each in its own file.

6. **No premature abstraction.** Build it concrete first. Abstract only when you see the THIRD instance of duplication. Two is a coincidence, three is a pattern.

7. **Audit behavior, not structure.** After each slice: does the UI work? Can a user complete the flow? Does the test pass? Don't care if the folder structure is pretty — care if it WORKS.

---

## BUILD ORDER (Linear — This Is The Sequence)

### Phase A: Foundation (No UI Yet)

These create the scaffolding everything else sits on. Do them in order. Each one is small.

| Step | What | Output | Est. Size |
|------|------|--------|-----------|
| **A1** | Project scaffold | Next.js 15 + Drizzle + Better Auth + CASL + Tailwind + shadcn setup. TypeScript strict:true. Folder structure. | ~20 files |
| **A2** | Database schema | Complete Drizzle schema for ALL tables. Derive from User Model + Feature Lockin + Lister + Monetization docs. Migrations run clean. | 1 large schema file, split by domain |
| **A3** | Auth + user creation | Better Auth configured. Email/password signup. Email verification. Login. Logout. Session management. User record created in DB. | ~15 files |
| **A4** | CASL setup | Ability factory from Actors & Security doc. All 7 actor types. Permission checks on server + client. Middleware guard on API routes. | ~10 files |
| **A5** | Seed script | Demo data: 3 buyers, 3 sellers (PERSONAL + BUSINESS), 1 admin, 50 listings across 5 categories, 10 orders in various states. Idempotent (run twice = same result). | 1 seed file |

**Checkpoint A:** You can sign up, log in, and the seed data is in the DB. CASL blocks unauthorized access. Run `drizzle-kit push`, run seed, verify in DB GUI. Don't proceed until this works.

---

### Phase B: Core Marketplace (The First Real Slices)

Each slice is a complete vertical: UI → API → DB → Test.

| Slice | User Story | Pages | Key Canonical Refs |
|-------|-----------|-------|-------------------|
| **B1: Browse & Search** | "As a buyer, I can browse listings and search by keyword" | Home, `/search`, `/c/[category]`, Listing detail `/l/[slug]` | Feature Lockin §11, §17, §28 |
| **B2: Listing Creation** | "As a seller, I can create a listing with photos and publish it" | `/my/selling/new`, `/my/selling/listings` | Feature Lockin §24, §29. Image Pipeline §14 |
| **B3: Cart & Checkout** | "As a buyer, I can add items to cart and purchase" | `/cart`, `/checkout`, Order confirmation | Feature Lockin §3, §32. Monetization (TF calc) |
| **B4: Order Management** | "As a seller, I see incoming orders and mark shipped. As a buyer, I see order status." | `/my/selling/orders`, `/my/buying/orders`, `/my/buying/orders/[id]` | Feature Lockin §8 (shipping) |
| **B5: Seller Dashboard** | "As a seller, I see my stats, listings, orders in one place" | `/my/selling` dashboard | Feature Lockin §9 |

**Checkpoint B:** A buyer can find a listing, buy it, and the seller can ship it. This is the minimum viable marketplace. Full E2E test: search → listing → cart → checkout → order → ship → delivered. If this flow doesn't work end-to-end, STOP and fix it.

---

### Phase C: Trust & Monetization

| Slice | User Story | Pages | Key Canonical Refs |
|-------|-----------|-------|-------------------|
| **C1: Ratings & Reviews** | "After delivery, buyer rates seller. Seller rates buyer." | Review form, seller profile ratings | Feature Lockin §4, §5, §6 |
| **C2: Offer System** | "Buyer makes prepaid offer. Seller accepts/declines/counters." | Offer modal, `/my/buying/offers`, `/my/selling/offers` | Feature Lockin §1, §31 |
| **C3: Stripe Connect** | "Seller connects Stripe. Payouts flow after sales." | `/my/selling/payouts`, Stripe onboarding | Monetization §5, §7 |
| **C4: Returns & Disputes** | "Buyer requests return. Fault-based fee allocation." | `/my/buying/orders/[id]` return flow | Feature Lockin §42, Monetization (fee refund rules) |
| **C5: Buyer Protection** | "Protection badge on listings. Claim workflow." | `/p/protection`, claim flow on order page | Feature Lockin §25 |

**Checkpoint C:** Money flows. Sellers get paid. Buyers are protected. Disputes resolve. The marketplace has trust.

---

### Phase D: Seller Tools

| Slice | User Story | Pages | Key Canonical Refs |
|-------|-----------|-------|-------------------|
| **D1: Storefront** | "Seller customizes their store page" | `/s/[username]`, `/my/selling/store` editor | Feature Lockin §7 |
| **D2: Promotions** | "Seller creates coupons and sales" | `/my/selling/promotions` | Feature Lockin §2 |
| **D3: Store Subscriptions** | "Seller subscribes to a Store tier via Stripe" | `/my/selling/subscription`, upgrade flow | Monetization §2, User Model §4.1 |
| **D4: Seller Analytics** | "Seller sees P&L, COGS, revenue breakdown" | `/my/selling/analytics` | Feature Lockin §9 |
| **D5: Delegation** | "Seller invites staff with scoped permissions" | `/my/selling/staff` | Feature Lockin §26, Actors Security (delegation) |

**Checkpoint D:** Sellers have a professional toolkit. Stores look good. Subscriptions work. Staff access works.

---

### Phase E: Platform Infrastructure

| Slice | User Story | Pages | Key Canonical Refs |
|-------|-----------|-------|-------------------|
| **E1: Notifications** | "Users get email + push for orders, offers, messages" | `/my/notifications`, preference settings | Feature Lockin §27 |
| **E2: Messaging** | "Buyer messages seller about a listing" | `/my/messages`, per-listing threads | Feature Lockin §19 |
| **E3: Admin Dashboard** | "Platform staff manage users, listings, disputes" | `hub.twicely.co/*` | Feature Lockin §20, §21, §22, §33, §36, §37, §38 |
| **E4: Feature Flags** | "Admin toggles features on/off, gradual rollout" | `hub.twicely.co/cfg/flags` | Feature Lockin §38 |
| **E5: Monitoring** | "Grafana dashboards, alerts, log aggregation" | External (Grafana) | Feature Lockin §41 |

**Checkpoint E:** Platform is operationally ready. Admin can manage everything. Monitoring catches problems. Notifications keep users engaged.

---

### Phase F: Crosslister (The Growth Engine)

| Slice | User Story | Pages | Key Canonical Refs |
|-------|-----------|-------|-------------------|
| **F1: Import from eBay** | "Seller imports their eBay listings to Twicely for free" | Import wizard, progress tracker | Lister Canonical §6 |
| **F2: Import from Poshmark + Mercari** | "Same flow, additional platforms" | Same wizard, new connectors | Lister Canonical §6, §9 |
| **F3: Crosslist to External** | "Seller pushes Twicely listings to eBay/Posh/Mercari" | `/my/selling/crosslist`, publish flow | Lister Canonical §7, §8 |
| **F4: Lister Subscriptions** | "Seller subscribes to Lister tier, publish metering" | Subscription flow, usage meters | Monetization §3, User Model §4.2 |
| **F5: Sale Detection & Delists** | "Sale on eBay → auto-delist on Poshmark + Mercari" | Real-time notifications | Lister Canonical §12 |
| **F6: Automation Add-On** | "Auto-relist, offers to likers, smart price drops" | `/my/selling/crosslist/automation` | Lister Canonical §17, Feature Lockin §16 (Poshmark modes) |

**Checkpoint F:** The flywheel spins. Import → sell on Twicely → crosslist → auto-delist on sale. This is Twicely's competitive moat.

---

### Phase G: Polish & Launch

| Slice | What |
|-------|------|
| **G1** | Onboarding flows (buyer first-run, seller wizard, import wizard) |
| **G2** | Vacation mode, social features (follow, watch, share) |
| **G3** | Seller standards & enforcement, PerformanceBand calculation |
| **G4** | Tax compliance (marketplace facilitator, 1099-K) |
| **G5** | Identity verification (KYC for high-value sellers) |
| **G6** | Accessibility audit (WCAG 2.1 AA), performance audit, SEO |
| **G7** | Data retention & GDPR (deletion flow, pseudonymization, cookie consent) |
| **G8** | Production readiness (backups, disaster recovery, security hardening) |

**Checkpoint G:** Ship it.

---

## WHAT TO BUILD FIRST IN THIS PROJECT

Before ANY slices, create two foundational documents:

### Document 1: `TWICELY_V3_SCHEMA.md`
- Complete Drizzle schema for every table across all 45 domains
- Derive from: User Model (has Drizzle sketches), Lister Canonical (has Drizzle sketches), Feature Lockin (has data requirements per domain), Monetization (has Stripe product IDs and metering fields)
- Every table, every column, every relation, every enum, every index
- This IS the database. No table exists that isn't in this file.

### Document 2: `TWICELY_V3_PAGE_REGISTRY.md`
- Every route in the app (Feature Lockin §23 has the URL structure)
- For each route: path, page title, role gate (who can see it), layout, page states (loading, empty, error, populated), key data dependencies
- This IS the sitemap. No page exists that isn't in this file.

Once those two exist → start Phase A (scaffold + schema + auth + CASL + seed).

---

## THINGS THAT WILL TEMPT YOU — DON'T DO THEM

❌ **Don't build a component library first.** Components emerge from building real pages. Build the page, extract the pattern later.

❌ **Don't set up monitoring before you have an app to monitor.** Monitoring is Phase E. You need something running first.

❌ **Don't build the admin panel before the marketplace.** Admin exists to manage a marketplace. Build the marketplace first.

❌ **Don't build the crosslister before checkout works.** The crosslister imports listings into a marketplace. The marketplace has to work first.

❌ **Don't abstract database queries into a "repository pattern" on day one.** Use Drizzle directly in server actions. Abstract when you see repetition.

❌ **Don't create 47 empty page files "for later."** Create pages when you build the slice that needs them.

❌ **Don't "improve" the canonical specs.** If something seems wrong, ask the owner. Don't silently "fix" pricing, permissions, or business rules. This is how V2 drifted.

---

## V2 LESSONS (Burned Into Our Brain)

These are real mistakes from V2 that cost weeks to fix:

1. **strict:false hid 321 TypeScript bugs.** V3 is strict:true from line one. Zero exceptions.
2. **"as any" casts masked real type errors.** 100+ found during V2 audit. Every single one was hiding a real bug.
3. **Backend-first left UI broken.** 184 API routes, but half the pages didn't load. Build UI first, API serves the UI.
4. **241 Prisma models with no tests.** Models existed but nobody verified they worked together. V3: every slice has tests.
5. **Specification drift.** AI implementations added unauthorized "improvements" — extra fields, different state names, creative interpretations. V3: canonical docs are law. Character-for-character.

---

## ON HOLD (Don't Touch Until Owner Says Go)

| Item | Why |
|------|-----|
| Knowledge Base | Editor decision deferred. Not in first 10 slices. |
| Helpdesk Canonical | V2 reference doc exists. Write V3 version when reaching E3 (admin). |
| API versioning / developer platform | Post-launch feature. Not relevant until external developers need access. |
| International / multi-currency | Post-launch. US-only for beta. |
| Product catalog normalization | Post-launch optimization. Manual categories work for beta. |

---

**This document is the execution plan. Follow the build order. Read the canonicals. Ship vertical slices. Don't get creative.**
