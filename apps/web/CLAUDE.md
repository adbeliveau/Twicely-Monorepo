# CLAUDE.md — Twicely V3 Build Rules

**Read this entire file before writing ANY code. This is non-negotiable.**

You are building Twicely V3, a peer-to-peer resale marketplace with an integrated crosslister. The project has 25+ canonical specification documents. You must read the relevant ones before every task. Do not invent, improvise, or "improve" anything.

---

## READ FIRST — Every Single Task

Before writing any code, identify which canonical docs apply to your task and read them:

```
Spec files location: C:\Users\XPS-15\Projects\Twicely\read-me\
```

| If your task involves... | Read this file FIRST |
|---|---|
| Any pricing, fees, subscriptions, payouts | `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` |
| Database tables, columns, enums, relations | `TWICELY_V3_SCHEMA_v2_0_7.md` |
| Routes, pages, layouts, role gates | `TWICELY_V3_PAGE_REGISTRY.md` |
| Who can access what, CASL rules | `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` |
| Feature business rules for any domain | `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` |
| User model, seller types, subscriptions axes | `TWICELY_V3_USER_MODEL.md` |
| Crosslister, imports, connectors, scheduling | `TWICELY_V3_LISTER_CANONICAL.md` |
| Build order, what's done, what's next | `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` |
| UI copy for money/payout screens | `Twicely_Payments_UX_Legal_Microcopy_Pack.pdf` |
| Seller dashboard, hub layout, sidebar nav | `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` |
| Finance engine, ledger, reconciliation | `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` |
| Seller score, performance bands | `TWICELY_V3_SELLER_SCORE_CANONICAL.md` |
| Platform settings, admin config keys | `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` |
| Helpdesk, support cases, routing | `TWICELY_V3_HELPDESK_CANONICAL.md` |
| Buyer protection, claims | `TWICELY_V3_BUYER_PROTECTION_CANONICAL.md` |
| Affiliate program, trials, promos | `TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md` |
| Personalization, feeds, recommendations | `TWICELY_V3_PERSONALIZATION_CANONICAL.md` |
| Financial center, P&L, tax prep | `TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md` |
| Locked architectural decisions | `TWICELY_V3_DECISION_RATIONALE.md` |
| Testing standards | `TWICELY_V3_TESTING_STANDARDS.md` |
| Local pickup, QR escrow | `TWICELY_V3_LOCAL_CANONICAL.md` |

**If you skip reading the relevant spec, you WILL produce wrong code. Every time.**

---

## VOCABULARY — Get These Wrong and the PR Is Rejected

### Enum Names (v3.2 — Current)

```typescript
// Store tiers — 5 tiers
enum StoreTier { NONE = 'NONE', STARTER = 'STARTER', PRO = 'PRO', POWER = 'POWER', ENTERPRISE = 'ENTERPRISE' }

// Crosslister tiers — 4 tiers
enum ListerTier { NONE = 'NONE', FREE = 'FREE', LITE = 'LITE', PRO = 'PRO' }

// Performance bands — EARNED, never purchased (SUSPENDED is admin-only, never score-derived)
enum PerformanceBand { EMERGING = 'EMERGING', ESTABLISHED = 'ESTABLISHED', TOP_RATED = 'TOP_RATED', POWER_SELLER = 'POWER_SELLER', SUSPENDED = 'SUSPENDED' }

// Seller type
type SellerType = 'PERSONAL' | 'BUSINESS'
```

### BANNED Terms — Zero Occurrences Allowed

Search your output for these before committing. If ANY appear, fix them.

| ❌ BANNED | ✅ CORRECT | Why |
|---|---|---|
| `SellerTier` | `StoreTier` or `ListerTier` | V2 name — ambiguous, killed V2 |
| `SubscriptionTier` | `StoreTier` or `ListerTier` | V2 name — ambiguous |
| `FVF` / `fvf` / `Final Value Fee` | `TF` / `tf` / `Transaction Fee` | Renamed in v3.2 (Decision #75) |
| `BASIC` (as StoreTier) | `STARTER` or `PRO` | Removed in v3.2 (Decision #76) |
| `ELITE` (as StoreTier) | `POWER` | Removed in v3.2 (Decision #76) |
| `PLUS` (as ListerTier) | `LITE` or `PRO` | Removed in v3.2 (Decision #77) |
| `MAX` (as ListerTier) | `PRO` | Removed in v3.2 (Decision #77) |
| `PREMIUM` (any context) | `POWER` | Renamed |
| `STANDARD` (as PerformanceBand) | `EMERGING` | Renamed in v3.2 |
| `RISING` (as PerformanceBand) | `ESTABLISHED` | Renamed in v3.2 |
| `Twicely Balance` | `Available for payout` | Legal/UX requirement (Decision #85) |
| `wallet` (in seller UI) | `payout` | Not a custodial wallet |
| `Withdraw` (in seller UI) | `Request payout` | UX Language Pack |
| `FinanceTier` (as enum) | Derived from subscription state | Not a real enum |

### Route Prefixes — Hardcoded, Non-Negotiable

| Prefix | Domain | Example |
|---|---|---|
| `/i/` | Item/listing pages | `/i/nike-air-jordan-abc123` |
| `/st/` | Store pages | `/st/vintagefinds` |
| `/s` | Search | `/s?q=nike` |
| `/c/` | Categories | `/c/electronics` |
| `/m` → redirects to `/my/messages` | Messages | `/my/messages/conv-abc123` |
| `/my` | User hub (all dashboard) | `/my/selling/orders` |
| `/h` | Help center | `/h/article-slug` |
| `/p/` | Policy pages | `/p/protection` |
| `/cart` | Cart | `/cart` |
| `/checkout` | Checkout | `/checkout` |
| `/auth/` | Auth pages | `/auth/login` |
| `/pricing` | Public pricing page | `/pricing` |

**Hub (hub.twicely.co) routes:**

| Prefix | Domain |
|---|---|
| `/d` | Dashboard |
| `/usr` | User management |
| `/tx` | Transactions |
| `/fin` | Finance |
| `/mod` | Moderation |
| `/hd` | Helpdesk |
| `/kb` | Knowledge base |
| `/cfg` | Platform config |
| `/roles` | Staff roles |
| `/audit` | Audit log |
| `/health` | System health |
| `/flags` | Feature flags |
| `/analytics` | Analytics dashboard |
| `/listings` | Platform-wide listing management |
| `/subscriptions` | Subscription management |
| `/notifications` | Notification management |

**WRONG routes that will be rejected:**

| ❌ WRONG | ✅ CORRECT |
|---|---|
| `/l/` or `/listing/` or `/listings/` | `/i/` |
| `/s/` (with trailing slash for stores) | `/st/` |
| `/store/` or `/shop/` | `/st/` |
| `/search` | `/s` |
| `/dashboard` | `/my` |
| `/admin` | `hub.twicely.co/d` |
| `/settings` | `/my/settings` |

---

## TECH STACK — Locked, No Substitutions

| Layer | Use This | NEVER This |
|---|---|---|
| Framework | Next.js 15 + TypeScript `strict: true` | — |
| ORM | Drizzle ORM | ❌ Prisma |
| Auth | Better Auth | ❌ NextAuth / Auth.js |
| Authorization | CASL | ❌ Custom RBAC |
| Database | PostgreSQL | — |
| Search | Typesense | ❌ Meilisearch |
| File Storage | Cloudflare R2 | ❌ MinIO, ❌ S3 direct |
| Cache + Queues | Valkey + BullMQ | ❌ Redis, ❌ Bull |
| Real-Time | Centrifugo | ❌ Soketi, ❌ Pusher |
| UI | Tailwind + shadcn/ui | — |
| Email | React Email + Resend | ❌ SES, ❌ Nodemailer |
| Testing | Vitest (unit) + Playwright (E2E) | — |
| Monitoring | Grafana + Prometheus + Loki | — |
| Deployment | Railway | ❌ Vercel, ❌ Coolify (changed Decision #62) |
| CI/CD | GitHub Actions | — |
| Shipping | Shippo | — |
| Page Builder | Puck (storefronts only, Power+ tier) | — |
| State Management | React context + server state | ❌ Zustand, ❌ Redux |
| API | Next.js API routes + server actions | ❌ tRPC |

---

## TYPESCRIPT RULES — Zero Exceptions

```
strict: true — always on, never disabled
```

| Rule | Enforcement |
|---|---|
| `as any` | **ZERO** occurrences. Fix the type. |
| `as unknown as T` | **ZERO** occurrences. Fix the type. |
| `@ts-ignore` | **ZERO** occurrences. Fix the error. |
| `@ts-expect-error` | **ZERO** occurrences. Fix the error. |
| Implicit `any` | Not allowed — all parameters and returns explicitly typed |
| Parallel type definitions | Not allowed — Drizzle schemas generate the types |

**If the types don't work, the design is wrong. Fix the design, not the types.**

---

## CODE RULES

| Rule | Limit |
|---|---|
| Maximum file length | **300 lines**. Split if longer. |
| Premature abstraction | Build concrete first. Abstract on the THIRD duplication only. |
| Money values | **Integer cents only**. Never floats. Never dollars as numbers. |
| Fee calculations | **Server-side only** from `platform_settings` table. Never hardcode rates. Never calculate in frontend. |
| Ownership key | **Always `userId`**. Never `storeId`, never `businessId`, never `sellerProfileId`, never `staffId`. |
| Input validation | **Zod schemas** on every API input. Strict mode — unknown keys rejected. |
| Request body spreading | **Never** spread request body into DB update. Explicit field mapping only. |
| `role`, `status`, `ownerUserId` | **Never settable from client**. Server-only fields. |

---

## FEE SYSTEM — Transaction Fee (v3.2)

Progressive brackets, NOT category-based. Marginal rates like income tax.

| Bracket | Monthly Twicely GMV | Marginal TF Rate |
|---|---|---|
| 1 | $0 – $499 | 10.0% |
| 2 | $500 – $1,999 | 11.0% |
| 3 | $2,000 – $4,999 | 10.5% |
| 4 | $5,000 – $9,999 | 10.0% |
| 5 | $10,000 – $24,999 | 9.5% |
| 6 | $25,000 – $49,999 | 9.0% |
| 7 | $50,000 – $99,999 | 8.5% |
| 8 | $100,000+ | 8.0% |

- Minimum TF: $0.50/order
- Calendar month reset (not rolling 30-day)
- All rates read from `platform_settings` — NEVER hardcoded
- Seller dashboard shows **effective rate** (always decreasing), never marginal rate
- Stripe fee (2.9% + $0.30) shown as **separate line item** — not included in TF
- Local sales: same progressive TF brackets as shipped orders, does NOT count toward monthly GMV (Decision #118)

---

## SUBSCRIPTION AXES — Independent, Never Coupled

Three independent subscription axes. None requires any other:

| Axis | Enum | Tiers | Requires |
|---|---|---|---|
| Store | `StoreTier` | NONE / STARTER / PRO / POWER / ENTERPRISE | BUSINESS seller status |
| Crosslister | `ListerTier` | NONE / FREE / LITE / PRO | Nothing — any seller |
| Automation | Add-on | $9.99/mo | Any Store tier (including NONE) |

Plus standalone: Finance Pro ($9.99/mo), Bundles (Store + Crosslister combos).

**Rules:**
- Crosslister does NOT require Store subscription
- Crosslister does NOT require BUSINESS status
- Store DOES require BUSINESS status (three gates: BUSINESS type + Stripe Connect + identity verification)
- Imports are ALWAYS free, ALWAYS go ACTIVE immediately, ALWAYS exempt from insertion fees
- No per-order fee on Twicely sales (TF covers it)
- No fees on off-platform sales (crosslister sales are subscription-funded)

---

## PAYOUT UX LANGUAGE — Legal Requirement

These are not suggestions. The UX Language Pack is a legal compliance document.

| ❌ NEVER say | ✅ ALWAYS say |
|---|---|
| "Twicely Balance" | "Available for payout" |
| "Your balance" | "Available for payout" |
| "Withdraw" | "Request payout" |
| "Wallet" | "Payout" or "Earnings" |
| "Deposit to Twicely" | "Funds held in escrow" |
| "Twicely wallet" | (no equivalent — don't reference) |
| "Funds in your Twicely account" | "Funds available for payout via Stripe" |
| "Sale price" (on transaction rows) | "Gross sale" |
| "FVF" or "Commission" | "Twicely fees" |
| "Stripe fee" | "Payment processing fee" |
| "Net payout" | "Net earnings" |
| "Withdrawal initiated" | "Your payout was initiated through Stripe" |
| "Funds deposited" | "Your payout was sent to your bank account" |
| "Balance updated" | "Your available-for-payout amount changed" |

---

## ESCROW & PAYOUT RULES

| Rule | Value | Setting Key |
|---|---|---|
| Escrow hold after delivery | 72 hours | `commerce.escrow.holdHours` |
| Buyer protection claim window | 30 days from delivery | — |
| Minimum payout | $15.00 | `commerce.payout.minimumCents: 1500` |
| Instant payout fee | $2.50 | `commerce.payout.instantFeeCents: 250` |
| Daily auto-payout | POWER+ tier only | — |
| Weekly auto-payout | BUSINESS sellers only | — |
| PERSONAL sellers | Manual payout only | — |

---

## OWNERSHIP MODEL

**Every resource traces to `userId`. Always.**

```
Listing.sellerId     = userId (NOT storeId, NOT sellerProfileId)
Order.sellerId       = userId
Order.buyerId        = userId
Payout.ownerId       = userId
Storefront.ownerId   = userId
```

A store is a presentation layer. A business is tax metadata. Neither owns anything.

---

## AUTHORIZATION (CASL)

- Default deny: if no CASL rule matches, action is FORBIDDEN
- Every API route has middleware CASL check — no route can skip
- Every server component checks `ability.can()` before data fetch
- Resource conditions checked against actual DB data, not just role
- Client-side CASL is for UI gating ONLY — server always re-verifies
- Use CUID2 for all IDs (non-sequential, non-guessable)
- Never expose internal IDs in error messages: "Not found", never "You don't have access to order X"
- Seller staff can only access their delegating seller's data
- `sellerId` and `delegationId` derived from session, NEVER from request body

---

## DATABASE RULES

- Ledger entries are **immutable** — no UPDATE, no DELETE (DB trigger enforces)
- All monetary columns: integer cents (`priceCents`, `tfAmountCents`, etc.)
- All rate columns: integer basis points (1000 = 10.00%)
- All settings stored in `platform_settings` table with: key, value, type, category, label, editable
- Schema source of truth: `TWICELY_V3_SCHEMA_v2_0_7.md`
- Current table count: 144 tables (75 enums)
- No table exists that isn't in the schema doc. If you need a new table, ASK.

---

## TESTING BASELINE — UPDATE THIS AFTER EVERY PASS

<!-- =============================================
     OWNER: Update these numbers after every
     successful pass. Claude Code reads these
     as the minimum thresholds. Stale numbers
     let it silently drop tests.
     ============================================= -->

```
BASELINE_TESTS=9232
BASELINE_FILES=731
BASELINE_TS_ERRORS=0
LAST_COMMIT=Seller-activation-and-registry-app
LAST_UPDATED=2026-04-06 (Feature Registry app (apps/registry/) created: Vite + React SPA with Dashboard, Feature Board, Canvas (React Flow), Code Map, Search, Tasks views. MCP server with 7 Claude Code integration tools. Feature manifest system with 221 features, 190 routes, 310 tables. Seller activation route GET /api/seller/activate added. Fixes: ensureSellerProfile now sets status=ACTIVE + sellerType=PERSONAL, seller-dashboard.ts uses Drizzle lt() instead of raw sql, notification-bell.tsx suppressHydrationWarning added. Hub sidebar "Start Selling" links to /api/seller/activate. Seller dashboard CTAs for 0 listings.)
```

**Status:** ALL PRE-LAUNCH PHASES COMPLETE (A-I: 197/199 done, 98.99%). Phase H fully complete (13/13 done). Phase I fully complete (17/17 done) — I17 updated admin-nav.ts with all route groups (Analytics, Trust & Safety, Promotions, Finance, Moderation, Users, Categories). 26 new tests (9206→9232). Only post-launch items remain (PL.1 Live selling, PL.2 Best-in-Window offer mode).

**Rules:**
- Test count must be **>=** `BASELINE_TESTS`. It can go UP, never DOWN.
- After a successful pass, the owner updates `BASELINE_TESTS` to the new count.
- If you see your test count is LOWER than `BASELINE_TESTS`, you broke something. STOP.
- TypeScript errors must always be 0. No exceptions.

**After every task, run the linter script:**

```bash
./twicely-lint.sh
```

This runs all verification checks in one shot. Paste the FULL raw output in your report. Do not summarize, do not paraphrase, do not omit sections.

---

## FILE APPROVAL PROTOCOL

Before writing ANY code for a feature:

1. List every file you will create or modify
2. Show file path + one-line description
3. **STOP and wait for approval**
4. Only after approval: start writing code

This prevents 50 files appearing at once with half of them wrong.

---

## THE "NO INVENTION" RULE

Implement EXACTLY what the specs say. Do not:

- ❌ Add fields that aren't in the schema doc
- ❌ Create API routes that aren't in the page registry
- ❌ Invent UI patterns that aren't in the feature lock-in
- ❌ Add "improvements" or "nice-to-haves" not in specs
- ❌ Rename anything from the specs (field names, enum values, route paths)
- ❌ Create tables not in the schema doc
- ❌ Create pages not in the page registry
- ❌ "Fix" business logic that seems wrong to you (ASK instead)

If something is missing from the specs, say: **"This isn't specified — should we add it?"** and STOP.

---

## WHAT IS EXPLICITLY FORBIDDEN

These patterns are forbidden in ALL code. If you write any of them, the task fails.

### Code Patterns
- ❌ `as any` — fix the type
- ❌ `as unknown as T` — fix the type
- ❌ `@ts-ignore` / `@ts-expect-error` — fix the error
- ❌ Floating point for money — integer cents only
- ❌ Hardcoded fee rates — read from `platform_settings`
- ❌ Fee calculations in frontend — server-side only
- ❌ Spreading request body into DB updates — explicit field mapping
- ❌ `storeId` as ownership key — always `userId`
- ❌ Files over 300 lines
- ❌ `console.log` left in production code

### Technology
- ❌ Prisma — use Drizzle
- ❌ NextAuth / Auth.js — use Better Auth
- ❌ Redis — use Valkey
- ❌ Bull (without BullMQ) — use BullMQ
- ❌ Zustand / Redux — use React context + server state
- ❌ tRPC — use Next.js API routes + server actions
- ❌ Meilisearch — use Typesense
- ❌ MinIO — use Cloudflare R2
- ❌ Soketi / Pusher — use Centrifugo
- ❌ Nodemailer / SES — use React Email + Resend

### Business Logic
- ❌ Per-order fee on Twicely sales (TF covers it)
- ❌ Fees on off-platform sales
- ❌ Insertion fees on imported listings (imports always free)
- ❌ Auctions or bidding (fixed price + offers only)
- ❌ Releasing funds before delivery confirmation + escrow hold
- ❌ Auto-payout for NONE (Free) tier sellers
- ❌ Daily auto-payout for tiers below POWER
- ❌ Retroactive fee changes on past orders
- ❌ Manual adjustments without reason code
- ❌ Paying out pending or reserved funds
- ❌ Removing organic search results to make room for promoted (30% max cap)
- ❌ Charging boost fees on returned/refunded orders

---

## BUILD SEQUENCE — Current State

```
Phase A ✅ → B ✅ → C ✅ → D ✅ → E ✅ → F ✅ → G1 ✅ → G1.1-G1.6 ✅ → G1.7 ✅ → G2-G2.17 ✅ → G2.18 ✅ → G3.1 ✅ → G3.2 ✅ → G3.3 ✅ → G3.4 ✅ → G3.5 ✅ → G3.6 ✅ → G3.7 ✅ → G3.8 ✅ → G3.9 ✅ → G3.10 ✅ → G3.11 ✅ → G4 ✅ → G4.1 ✅ → G4.2 ✅ → G5 ✅ → G6 ✅ → G7 ✅ → G8 ✅ → G9.1 ✅ → G9.2 ✅ → G9.3 ✅ → G9.4 ✅ → G9.5 ✅ → G9.6 ✅ → G9.7 ✅ → G10.4 ✅ → G10.5 ✅ → G10.7 ✅ → G10.6 ✅ → G10.8 ✅ → G10.9 ✅ → G10.10 ✅ → G10.11 ✅ → G10.12 ✅ → G10.13 ✅ → H1.1 ✅ → H1.2 ✅ → H1.3 ✅ → H1.4 ✅ → H2.1 ✅ → H2.2 ✅ → H2.3 ✅ → H3.1 ✅ → H3.2 ✅ → H3.3 ✅ → H3.4 ✅ → H4.1 ✅ → H4.2 ✅ → I (remaining)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ^^^^
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                YOU ARE HERE
```

| Phase | Steps | Done | Remaining |
|---|---|---|---|
| A | 10 | 10 | 0 ✅ |
| B | 22 | 22 | 0 ✅ |
| C | 26 | 26 | 0 ✅ |
| D | 26 | 26 | 0 ✅ |
| E | 19 | 19 | 0 ✅ |
| F | 14 | 14 | 0 ✅ |
| G | 50 | 50 | 0 ✅ |
| H | 13 | 13 | 0 ✅ |
| I | 17 | 14 | 3 |
| **TOTAL** | **199** | **194** | **5** |

---

## DEPLOYMENT

| Property | Value |
|---|---|
| Platform | **Railway** (Decision #62) |
| Domain | `twicely.co` (marketplace) + `hub.twicely.co` (staff admin) |
| Subdomain routing | Single Next.js app with middleware |
| Previous plan | Coolify + Hetzner (changed — migrate to self-hosted when bill justifies DevOps) |

---

## COMMIT MESSAGE FORMAT

```
[PHASE.STEP] Brief description

- What was added/changed
- Files created: X
- Tests: Y passing (was Z)
- TypeScript: 0 errors
```

Example:
```
[D1] Basic store profile page

- Store profile SSR page at /st/[slug]
- Store header, listings grid, tabs
- Server queries: getStoreBySlug, getStoreListings
- Files created: 6
- Tests: 1009 passing (was 970)
- TypeScript: 0 errors
```

---

## WHEN YOU'RE DONE WITH A TASK

Run ALL of these checks and report the RAW output. Do not skip any.

1. **Files created/modified** — full list with line counts
2. **TypeScript check** — paste full `pnpm typecheck` output
3. **Test count** — paste full `pnpm test` summary line (must be >= BASELINE_TESTS, must not decrease)
4. **Banned terms grep** — paste full output of banned terms check
5. **Route prefix check** — paste full output of wrong routes check
6. **File size check** — paste output of files over 300 lines check
7. **What you built** — 2-3 sentence summary of the user-visible outcome

### IF ANY CHECK FAILS: STOP AND REPORT

**Do NOT attempt to fix failures yourself.** Report exactly what failed and ask how to proceed.

Why: Your "fixes" for failing checks are often worse than the original problem. Common bad fixes you must NEVER do:

- ❌ Deleting or skipping a failing test to make the count "pass"
- ❌ Adding `as any` or `@ts-ignore` to silence TypeScript errors
- ❌ Changing test assertions to match wrong behavior instead of fixing the code
- ❌ Commenting out broken code
- ❌ Removing a check from the verification list
- ❌ Lowering the test baseline number
- ❌ Saying "fixed" without showing what changed and why

**If TypeScript fails:** paste the errors. Stop. Ask.
**If tests fail:** paste the failure output. Stop. Ask.
**If test count decreased:** list which tests are missing. Stop. Ask.
**If banned terms found:** list the occurrences. Stop. Ask.
**If files over 300 lines:** list them with line counts. Stop. Ask.

The owner will tell you how to fix it. Your job is accurate reporting, not self-correction.
