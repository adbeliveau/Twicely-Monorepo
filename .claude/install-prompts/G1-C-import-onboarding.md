# [G1-C] Import Onboarding — First-Time Crosslister Guide

**Phase & Step:** G1-C (Phase G: Polish & Launch)
**Feature Name:** Import Onboarding Guide
**One-line Summary:** Build a guided first-time experience for sellers connecting their first external platform and importing listings, emphasizing that imports are always free and require no subscription.
**Date:** 2026-03-09

## Canonical Sources

Read ALL of these before writing any code:

| Document | Why |
|----------|-----|
| `TWICELY_V3_LISTER_CANONICAL.md` §1, §2, §6, §27, §30 | Free import flywheel philosophy, import pipeline, forbidden patterns |
| `TWICELY_V3_PAGE_REGISTRY.md` §4 rows 56-59 | Crosslister routes, page states, empty states |
| `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` §3.2, §3.3 | Sidebar visibility rules, crosslister sub-group gating |
| `TWICELY_V3_USER_MODEL.md` §3, §4.2, §12 | Seller activation, ListerTier independence, free import flywheel |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` §13 | Onboarding flows (buyer/seller/admin) |
| `TWICELY_V3_DECISION_RATIONALE.md` #16, #17 | Imports go ACTIVE immediately, crosslister as supply engine |
| `TWICELY_V3_SCHEMA_v2_1_0.md` §1.10, crosslister tables | crosslisterAccount, importBatch, channelEnum |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | CASL rules for CrosslisterAccount, ImportBatch |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns |

---

## 1. PREREQUISITES

### Must Be Complete
- Phase F complete (all crosslister infrastructure built)
- G1-A (buyer onboarding) complete
- G1-B (seller onboarding wizard) complete

### Already Exists (DO NOT Recreate)
- **Pages:** `/my/selling/crosslist/page.tsx`, `/my/selling/crosslist/connect/page.tsx`, `/my/selling/crosslist/import/page.tsx`, `/my/selling/crosslist/import/issues/page.tsx`
- **Components:** `ConnectPlatformGrid`, `ConnectPlatformCta`, `ImportPageClient`, `ImportStartForm`, `ImportProgress`, `ImportSummary`, `ImportIssuesTable`, `PlatformCard`, `SessionAuthDialog`
- **Actions:** `connectPlatformAccount`, `authenticateSessionAccount`, `startImport`, `getImportBatchStatus`, `getImportIssues`, `retryImportRecord` (in `crosslister-accounts.ts` and `crosslister-import.ts`)
- **Queries:** `getConnectedAccounts`, `getImportBatches`, `getImportBatchById`, `getImportRecords` (in `queries/crosslister.ts`)
- **Channel registry:** `channel-registry.ts` with all 8 channel metadata entries (3 enabled at launch: eBay, Poshmark, Mercari)
- **Seller onboarding:** `/my/selling/onboarding/page.tsx` with activate/business wizard

### What This Step Adds
This step does NOT build new infrastructure. It adds **onboarding UX polish** to the existing crosslister pages:
1. An enhanced empty state on the crosslister dashboard (`/my/selling/crosslist`) when a seller has no connected accounts AND no ListerTier
2. A guided import onboarding banner shown once per seller on the crosslister dashboard after their first platform connection
3. A "Get started with Crosslister" card on the seller selling overview page (`/my/selling`) for sellers who haven't connected any platform yet
4. Unit tests for the new query and any logic

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### 2.1 New Query: `getImportOnboardingState`

**File:** `src/lib/queries/import-onboarding.ts`

This query gathers the onboarding state for a seller to determine which guide elements to show.

```typescript
interface ImportOnboardingState {
  hasConnectedAccounts: boolean;     // Any crosslisterAccount rows for this seller (any status)
  hasActiveAccounts: boolean;        // Any crosslisterAccount with status = 'ACTIVE'
  hasCompletedImport: boolean;       // Any importBatch with status = 'COMPLETED' or 'PARTIALLY_COMPLETED'
  connectedChannels: string[];       // List of channel names with ACTIVE accounts
  availableImportChannels: string[]; // ACTIVE accounts where firstImportCompletedAt IS NULL
  listerTier: string;               // Current ListerTier from sellerProfile
}
```

**Logic:**
- Query `crosslisterAccount` for this seller's connected accounts
- Query `importBatch` for any completed imports
- Query `sellerProfile` for `listerTier`
- Return the composed state object
- All queries parallelized with `Promise.all`
- Ownership via `userId` (mapped through sellerId on crosslisterAccount)

### 2.2 Enhanced Empty State: Crosslister Dashboard

**File:** Modify `src/app/(hub)/my/selling/crosslist/page.tsx`

**Current behavior:** When `accounts.length === 0`, shows `<ConnectPlatformCta />` (a basic "Connect your first platform" card).

**New behavior:** Replace the empty state with a richer onboarding guide component when the seller has zero connected accounts. The enhanced empty state has three sections:

**Section 1: Hero Banner**
- Headline: "Manage all your listings in one place"
- Subtext: "Import your existing inventory from eBay, Poshmark, and Mercari — completely free. No subscription required."
- Primary CTA button: "Connect a platform" -> `/my/selling/crosslist/connect`
- The word "free" should be visually emphasized (bold or accent color)

**Section 2: How It Works (3-step visual)**
A horizontal 3-step guide (stacks vertically on mobile):
- Step 1: "Connect your account" — "Link your eBay, Poshmark, or Mercari account securely via OAuth or login."
- Step 2: "Import your listings" — "Your existing listings are imported to Twicely instantly. Always free, always active."
- Step 3: "Sell everywhere" — "Manage and crosslist from one dashboard. Upgrade anytime for more features."

Each step has a step number (1, 2, 3) and an icon (Link, Download, Globe — from lucide-react).

**Section 3: Key Facts**
Three small info cards in a row (stack on mobile):
- "Always free" — "Your first import from each platform costs nothing. No hidden fees."
- "Go live instantly" — "Imported listings are active on Twicely immediately — no review queue."
- "No subscription needed" — "Import without any crosslister subscription. Upgrade later if you want to crosslist."

**When NOT to show:** If seller has at least one connected account (any status), show the existing populated view instead.

### 2.3 New Component: `CrosslisterOnboardingEmpty`

**File:** `src/components/crosslister/crosslister-onboarding-empty.tsx`

A `'use client'` component that renders the enhanced empty state described in 2.2. Props: none (it is a self-contained presentational component with a single Link CTA to `/my/selling/crosslist/connect`).

Must stay under 200 lines. Use `Card` from shadcn/ui for the info cards. Use `Button` for the CTA.

### 2.4 Post-Connection Import Guide Banner

**File:** `src/components/crosslister/import-guide-banner.tsx`

A dismissible banner shown on the crosslister dashboard (`/my/selling/crosslist`) ONLY when:
- Seller has at least one ACTIVE connected account
- Seller has NOT completed any import yet (no importBatch with COMPLETED/PARTIALLY_COMPLETED status)

**Banner content:**
- Icon: Download (lucide)
- Headline: "Ready to import your listings?"
- Body: "You've connected [Platform Name]. Import your existing listings to Twicely for free — they'll be active immediately."
- CTA button: "Start importing" -> `/my/selling/crosslist/import`
- Dismiss button (X) — dismissal stored in `localStorage` key `twicely:import-guide-dismissed`

**When to hide (any of these):**
- Seller has completed at least one import
- Seller has dismissed the banner (localStorage check)
- Seller has no ACTIVE connected accounts

Props:
```typescript
interface ImportGuideBannerProps {
  connectedChannels: string[];  // Display names of ACTIVE connected channels
  hasCompletedImport: boolean;
}
```

### 2.5 Selling Overview Crosslister CTA

**File:** Modify `src/app/(hub)/my/selling/page.tsx`

Add a "Get started with Crosslister" card to the seller selling overview page. This card is shown when:
- Seller has zero connected crosslister accounts
- Seller is an active seller (`isSeller === true`)

**Card content:**
- Icon: RefreshCw (lucide)
- Headline: "Import your listings from other platforms"
- Body: "Already selling on eBay, Poshmark, or Mercari? Import your inventory for free — no subscription required."
- CTA button: "Get started" -> `/my/selling/crosslist`
- Card should be visually distinct (e.g., border-dashed or subtle background) to stand out as an onboarding prompt

**When NOT to show:** If seller has any connected accounts (regardless of status), hide this card. Use the existing query infrastructure — call `getConnectedAccounts(userId)` and check `.length === 0`.

### 2.6 No New Server Actions Required

All the data needed for onboarding state can be fetched via existing queries in server components. No new `'use server'` actions are needed.

### 2.7 No New Database Tables or Columns

All onboarding state is derived from existing data:
- `crosslisterAccount` rows (presence + status + `firstImportCompletedAt`)
- `importBatch` rows (presence + status)
- `sellerProfile.listerTier`
- Banner dismissal is client-side only (localStorage)

### 2.8 No Schema Changes

Zero schema changes. Zero migrations.

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- Do NOT use "wallet", "withdraw", "Twicely Balance", "FVF", "SellerTier", "SubscriptionTier", "BASIC", "ELITE", "PLUS", "MAX", "PREMIUM"
- Do NOT say "subscription required" or imply importing costs money. Imports are ALWAYS free.
- Do NOT call it "Lister Free" — when describing the import as free, say "no subscription required" or "completely free"

### Forbidden Patterns
- Do NOT use `as any`, `@ts-ignore`, `@ts-expect-error`
- Do NOT hardcode channel lists — use the `CHANNEL_REGISTRY` or `getEnabledChannels()` from `channel-registry.ts` where channel data is needed
- Do NOT create new `'use server'` files with exported helpers (they become unintended server actions)
- Do NOT import Node.js modules (postgres, fs) in `'use client'` components
- Do NOT use `auth.api.getSession()` for auth — use `authorize()` from `@/lib/casl` in server components (per F6-FIX findings)
- Do NOT create pages not in the Page Registry — this step modifies existing pages only
- Do NOT gate import behind ListerTier — imports are free for ALL sellers regardless of tier
- Do NOT gate crosslister access behind BUSINESS status — any seller can use crosslister
- Do NOT say imported listings go to "draft" — they always go ACTIVE (Decision #16)
- Do NOT mention insertion fees in import context — imports are ALWAYS exempt (Lister Canonical §6.4)

### Route Rules
- All crosslister routes use `/my/selling/crosslist/*` prefix
- Do NOT use `/my/selling/crosslister/*` or `/crosslist/*`
- Do NOT create new routes — modify existing pages only

### File Size
- Every file must be under 300 lines
- The existing `crosslist/page.tsx` is 114 lines — modifications should keep it under 200

### Auth Pattern
- Use `authorize()` from `@/lib/casl` (not `auth.api.getSession()`)
- Derive `sellerId` as: `session.delegationId ? session.onBehalfOfSellerId! : session.userId`
- Ownership always via `userId`

**IMPORTANT NOTE ON EXISTING PAGE AUTH:** The existing `crosslist/page.tsx` uses `auth.api.getSession()` instead of `authorize()`. This was identified as a defect in F6-FIX. When modifying this page, switch to `authorize()`. However, this is a pre-existing issue — if fixing it causes scope creep, leave it and note it. The primary goal is the onboarding UX.

---

## 4. ACCEPTANCE CRITERIA

### Functional
1. **AC-1:** When a seller with zero connected accounts visits `/my/selling/crosslist`, they see the enhanced onboarding empty state with the 3-step guide, not just the basic `ConnectPlatformCta`
2. **AC-2:** The enhanced empty state CTA links to `/my/selling/crosslist/connect`
3. **AC-3:** When a seller with at least one connected account visits `/my/selling/crosslist`, they see the normal populated dashboard (platform cards, publish meter, projections)
4. **AC-4:** When a seller has an ACTIVE connected account but no completed imports, the import guide banner is shown on the crosslister dashboard
5. **AC-5:** When a seller has completed at least one import, the import guide banner is NOT shown
6. **AC-6:** When a seller dismisses the import guide banner, it stays dismissed across page loads (localStorage persistence)
7. **AC-7:** The seller selling overview page (`/my/selling`) shows a "Get started with Crosslister" CTA card when the seller has zero connected accounts
8. **AC-8:** The "Get started with Crosslister" card is NOT shown when the seller has any connected accounts
9. **AC-9:** All onboarding copy emphasizes that imports are free, require no subscription, and listings go active immediately

### Authorization
10. **AC-10:** Unauthenticated users visiting `/my/selling/crosslist` are redirected to `/auth/login`
11. **AC-11:** Non-seller users visiting `/my/selling/crosslist` are redirected to `/my/selling/onboarding`
12. **AC-12:** Delegated staff with `crosslister.read` scope can see the crosslister dashboard including onboarding state

### Vocabulary
13. **AC-13:** No banned terms appear anywhere in the new/modified code or UI copy
14. **AC-14:** The word "import" is used (not "sync" or "transfer") for the first-time listing pull
15. **AC-15:** No reference to insertion fees in import-related copy

### Data Integrity
16. **AC-16:** The `getImportOnboardingState` query uses only existing tables and columns — no schema changes
17. **AC-17:** All queries use `userId`-based ownership (via `sellerId` on crosslisterAccount)

### Technical
18. **AC-18:** All new files are under 300 lines
19. **AC-19:** Zero TypeScript errors (`pnpm typecheck` passes)
20. **AC-20:** Test count is >= BASELINE_TESTS (3621 per build tracker v1.32)
21. **AC-21:** No `as any`, `@ts-ignore`, or `@ts-expect-error` in any new/modified code

---

## 5. TEST REQUIREMENTS

### Unit Tests

**File:** `src/lib/queries/__tests__/import-onboarding.test.ts`

| Test | Description |
|------|-------------|
| 1 | `getImportOnboardingState` returns `hasConnectedAccounts: false` when seller has no crosslisterAccount rows |
| 2 | `getImportOnboardingState` returns `hasConnectedAccounts: true, hasActiveAccounts: true` when seller has an ACTIVE account |
| 3 | `getImportOnboardingState` returns `hasActiveAccounts: false` when seller only has REVOKED accounts |
| 4 | `getImportOnboardingState` returns `hasCompletedImport: true` when a COMPLETED importBatch exists |
| 5 | `getImportOnboardingState` returns `hasCompletedImport: true` when a PARTIALLY_COMPLETED importBatch exists |
| 6 | `getImportOnboardingState` returns `hasCompletedImport: false` when only CREATED/FETCHING batches exist |
| 7 | `getImportOnboardingState` returns correct `connectedChannels` list (display names from registry) |
| 8 | `getImportOnboardingState` returns correct `availableImportChannels` (ACTIVE accounts where firstImportCompletedAt IS NULL) |
| 9 | `getImportOnboardingState` returns correct `listerTier` from sellerProfile |
| 10 | `getImportOnboardingState` returns `listerTier: 'NONE'` when seller has no sellerProfile row |

**Test patterns:** Use `vi.mock` for `@/lib/db`. Create mock helpers (`selectChain`, `insertChain`) consistent with existing test patterns in the codebase. See `src/lib/actions/__tests__/crosslister-accounts.test.ts` for the mocking pattern.

### Component Tests (Optional but Recommended)

**File:** `src/components/crosslister/__tests__/crosslister-onboarding-empty.test.tsx`

| Test | Description |
|------|-------------|
| 1 | Renders the 3-step guide with correct step labels |
| 2 | CTA button links to `/my/selling/crosslist/connect` |
| 3 | Contains the text "free" (case-insensitive) |
| 4 | Does NOT contain any banned terms |

**File:** `src/components/crosslister/__tests__/import-guide-banner.test.tsx`

| Test | Description |
|------|-------------|
| 1 | Renders when `hasCompletedImport` is false and `connectedChannels` is non-empty |
| 2 | Does NOT render when `hasCompletedImport` is true |
| 3 | Does NOT render when `connectedChannels` is empty |
| 4 | Dismiss button hides the banner |
| 5 | CTA button links to `/my/selling/crosslist/import` |
| 6 | Displays connected channel name(s) in the body text |

---

## 6. FILE APPROVAL LIST

The installer must propose EXACTLY these files before coding:

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/lib/queries/import-onboarding.ts` | CREATE | Query to gather import onboarding state for a seller |
| 2 | `src/components/crosslister/crosslister-onboarding-empty.tsx` | CREATE | Enhanced empty state component with 3-step guide for first-time crosslister users |
| 3 | `src/components/crosslister/import-guide-banner.tsx` | CREATE | Dismissible banner prompting sellers to import after connecting a platform |
| 4 | `src/app/(hub)/my/selling/crosslist/page.tsx` | MODIFY | Replace basic empty state with enhanced onboarding component; add import guide banner |
| 5 | `src/app/(hub)/my/selling/page.tsx` | MODIFY | Add "Get started with Crosslister" CTA card for sellers with no connected accounts |
| 6 | `src/lib/queries/__tests__/import-onboarding.test.ts` | CREATE | Unit tests for getImportOnboardingState query (10 tests) |
| 7 | `src/components/crosslister/__tests__/crosslister-onboarding-empty.test.tsx` | CREATE | Component tests for the enhanced empty state (4 tests) |
| 8 | `src/components/crosslister/__tests__/import-guide-banner.test.tsx` | CREATE | Component tests for the import guide banner (6 tests) |

**Total: 4 new files, 2 modified files, 3 test files = 9 files**

---

## 7. VERIFICATION CHECKLIST

After implementation, the installer must run and paste RAW output for:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test run
pnpm test

# 3. Banned terms check (run from repo root)
./twicely-lint.sh

# 4. File size check
wc -l src/lib/queries/import-onboarding.ts src/components/crosslister/crosslister-onboarding-empty.tsx src/components/crosslister/import-guide-banner.tsx src/app/\(hub\)/my/selling/crosslist/page.tsx src/app/\(hub\)/my/selling/page.tsx
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 3621 passing (current baseline from build tracker v1.32)
- Banned terms: 0 occurrences
- All files under 300 lines

---

## 8. BUSINESS RULES SUMMARY (Quick Reference for Installer)

These are the non-negotiable import rules from the canonical docs. Every piece of onboarding copy must align with them:

| Rule | Source |
|------|--------|
| Imports are ALWAYS free — no charge, no insertion fees | Lister Canonical §6.1, Decision #16 |
| ONE free import per external marketplace per account | Lister Canonical §6.1 |
| Imported listings go ACTIVE on Twicely immediately (never draft) | Lister Canonical §6.1, §6.2, Decision #16 |
| No subscription required to import (free import is ungated) | Lister Canonical §1, §30, User Model §12 |
| Crosslister does NOT require Store subscription | User Model §4.2, CLAUDE.md |
| Crosslister does NOT require BUSINESS status | User Model §3, §4.2, CLAUDE.md |
| Any seller (PERSONAL or BUSINESS) can use crosslister | User Model §3 |
| Re-import (new items since first import) requires Lister Lite+ | Lister Canonical §6.1 |
| Launch platforms: eBay, Poshmark, Mercari only | Lister Canonical §27.2 |
| No insertion fees on imported listings ever | Lister Canonical §6.4, §30 |
| No per-order fee on Twicely sales | CLAUDE.md |
| No fees on off-platform sales | Decision #31, CLAUDE.md |

---

## 9. COPY GUIDELINES

All user-facing copy in this step must:

1. Use "import" not "sync", "transfer", or "migrate"
2. Say "free" clearly and prominently — this is the key selling point
3. Say "active immediately" or "go live instantly" — no review queue
4. Say "no subscription required" — distinguish from crosslisting which needs a tier
5. Name the three launch platforms: "eBay, Poshmark, and Mercari"
6. NOT mention insertion fees, listing limits, or any cost barrier
7. NOT imply the seller needs to do anything after importing (listings just work)
8. Keep copy concise — this is onboarding, not a feature page. Short sentences, action-oriented.

---

**END OF INSTALL PROMPT — G1-C Import Onboarding**
