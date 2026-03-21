# Install Prompt: I17 — Admin Sidebar Final Update

## 1. HEADER

- **Phase & Step**: `[I17]`
- **Feature Name**: Admin Sidebar Final Update
- **One-line Summary**: Update `admin-nav.ts` with all route groups and children added during I1-I16, and add corresponding icons to `admin-sidebar.tsx`'s ICON_MAP. Write a comprehensive test file validating every nav item points to an existing page.
- **Canonical Sources**:
  - `TWICELY_V3_PAGE_REGISTRY.md` — Section 8 (Hub routes), Section 11.3 (Hub Sidebar)
  - `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` — Hub sidebar structure
  - `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Role gates per page
  - `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` — I1-I16 build notes

---

## 2. PREREQUISITES

- **All of I1-I16 must be COMPLETE.** This step is the final cleanup.
- File `src/lib/hub/admin-nav.ts` must exist (it does — 363 lines currently).
- File `src/components/admin/admin-sidebar.tsx` must exist (it does — 186 lines currently).
- All hub pages listed below must exist in `src/app/(hub)/` (verified via glob).

---

## 3. SCOPE — EXACTLY WHAT TO BUILD

### 3.1 Changes to `src/lib/hub/admin-nav.ts`

The current file has these top-level nav groups:
- Dashboard, Analytics, Users, Affiliates, Transactions (collapsible), Finance (collapsible), Moderation (collapsible), Helpdesk, Knowledge Base, Listings, Categories, Subscriptions, Notifications, Data Management (collapsible), Feature Flags, Errors, Operations, Broadcasts, Search Admin, Roles, Staff, Audit Log, System Health (collapsible), Settings (collapsible), Crosslister (collapsible), Localization (collapsible), Compliance (collapsible), Providers (collapsible)

The following changes must be made. Changes are organized by nav group.

#### A. USERS GROUP — Convert to collapsible, add I2 children

**Current:** Two flat items (`users` at `/usr` and `affiliates` at `/usr/affiliates`).

**Target:** One collapsible `users` group with children:

```typescript
{
  key: 'users',
  label: 'Users',
  href: '/usr',
  icon: 'Users',
  roles: ['ADMIN', 'SUPPORT'],
  children: [
    { key: 'usr-overview', label: 'All Users', href: '/usr', icon: 'Users', roles: ['ADMIN', 'SUPPORT'] },
    { key: 'usr-sellers', label: 'Sellers', href: '/usr/sellers', icon: 'Store', roles: ['ADMIN', 'SUPPORT'] },
    { key: 'usr-verification', label: 'Verification Queue', href: '/usr/sellers/verification', icon: 'ShieldCheck', roles: ['ADMIN'] },
    { key: 'usr-affiliates', label: 'Affiliates', href: '/usr/affiliates', icon: 'UserPlus', roles: ['ADMIN', 'FINANCE'] },
  ],
},
```

**Remove** the standalone `affiliates` item (key `affiliates`, href `/usr/affiliates`). It is now a child of `users`.

**Pages verified:** `/usr` (exists), `/usr/sellers` (exists, I2), `/usr/sellers/verification` (exists, I2), `/usr/affiliates` (exists).

Note: `/usr/[id]` and `/usr/new` are detail/create pages — they do NOT need nav entries (reached via links).

#### B. FINANCE GROUP — Add I3 children

**Current children:** fin-overview, fin-ledger, fin-payouts, fin-recon, fin-adjustments, fin-costs, fin-promo-codes, fin-affiliate-payouts, fin-tax.

**Add these children** (after `fin-tax`):

```typescript
{ key: 'fin-chargebacks', label: 'Chargebacks', href: '/fin/chargebacks', icon: 'AlertTriangle', roles: ['ADMIN', 'FINANCE'] },
{ key: 'fin-holds', label: 'Reserve Holds', href: '/fin/holds', icon: 'Lock', roles: ['ADMIN', 'FINANCE'] },
{ key: 'fin-subscriptions', label: 'Subscriptions', href: '/fin/subscriptions', icon: 'Crown', roles: ['ADMIN', 'FINANCE'] },
```

**Pages verified:** `/fin/chargebacks` (exists, I3), `/fin/holds` (exists, I3), `/fin/subscriptions` (exists, I3).

Note: `/fin/chargebacks/[id]` and `/fin/payouts/[id]` are detail pages — no nav entries needed.

#### C. MODERATION GROUP — Add I5 children

**Current children:** mod-overview (Queue), mod-listings, mod-reviews, mod-messages, mod-disputes, mod-returns, mod-collections, mod-reports, mod-enforcement.

**Add these children** (insert after `mod-overview` for logical grouping):

```typescript
{ key: 'mod-queue', label: 'Unified Queue', href: '/mod/queue', icon: 'Layers', roles: ['ADMIN', 'MODERATION'] },
{ key: 'mod-pending', label: 'Pending Review', href: '/mod/listings/pending', icon: 'Clock', roles: ['ADMIN', 'MODERATION'] },
{ key: 'mod-suppressed', label: 'Suppressed', href: '/mod/listings/suppressed', icon: 'EyeOff', roles: ['ADMIN', 'MODERATION'] },
```

**Add this child** (after `mod-disputes`):

```typescript
{ key: 'mod-dispute-rules', label: 'Dispute Rules', href: '/mod/disputes/rules', icon: 'Scale', roles: ['ADMIN'] },
```

**Pages verified:** `/mod/queue` (exists, I5), `/mod/listings/pending` (exists, I5), `/mod/listings/suppressed` (exists, I5), `/mod/disputes/rules` (exists at `/mod/disputes/disputes/rules`, I5).

**IMPORTANT NOTE:** The dispute rules page is located at `src/app/(hub)/mod/disputes/disputes/rules/page.tsx` which maps to the URL `/mod/disputes/disputes/rules`. The nav item href should match the ACTUAL URL the filesystem produces. Verify the actual URL by checking the Next.js file-system routing. If it routes to `/mod/disputes/disputes/rules`, use that as the href. If the page was intended to be at `/mod/disputes/rules`, note the discrepancy and use the actual filesystem-derived URL.

#### D. ANALYTICS GROUP — Convert to collapsible, add I10 child

**Current:** Flat item `analytics` at `/analytics`.

**Target:** Collapsible group:

```typescript
{
  key: 'analytics',
  label: 'Analytics',
  href: '/analytics',
  icon: 'BarChart2',
  roles: ['ADMIN', 'FINANCE'],
  children: [
    { key: 'analytics-overview', label: 'Platform', href: '/analytics', icon: 'BarChart2', roles: ['ADMIN', 'FINANCE'] },
    { key: 'analytics-sellers', label: 'Sellers', href: '/analytics/sellers', icon: 'TrendingUp', roles: ['ADMIN', 'FINANCE'] },
  ],
},
```

**Pages verified:** `/analytics` (exists, enriched I10), `/analytics/sellers` (exists, I10).

#### E. ADD NEW TOP-LEVEL GROUP: Trust & Safety (I7)

Insert this group after the Moderation group:

```typescript
// ─── Trust & Safety ────────────────────────────────────────────────────
{
  key: 'trust-safety',
  label: 'Trust & Safety',
  href: '/trust',
  icon: 'ShieldCheck',
  roles: ['ADMIN', 'MODERATION', 'SUPPORT'],
  children: [
    { key: 'trust-overview', label: 'Trust Overview', href: '/trust', icon: 'ShieldCheck', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] },
    { key: 'trust-settings', label: 'Trust Settings', href: '/trust/settings', icon: 'Settings', roles: ['ADMIN'] },
    { key: 'risk-signals', label: 'Risk Signals', href: '/risk', icon: 'AlertTriangle', roles: ['ADMIN', 'MODERATION', 'SUPPORT'] },
    { key: 'security-events', label: 'Security', href: '/security', icon: 'Shield', roles: ['ADMIN', 'SRE'] },
  ],
},
```

**Pages verified:** `/trust` (exists, I7), `/trust/settings` (exists, I7), `/risk` (exists, I7), `/security` (exists, I7).

Note: `/trust/sellers/[id]` is a detail page — no nav entry needed (reached via links from trust overview).

#### F. ADD NEW TOP-LEVEL GROUP: Promotions (I9)

Insert after the Trust & Safety group:

```typescript
// ─── Promotions ────────────────────────────────────────────────────────
{
  key: 'promotions',
  label: 'Promotions',
  href: '/promotions',
  icon: 'Ticket',
  roles: ['ADMIN', 'FINANCE', 'MODERATION'],
},
```

**This is a flat item** (not collapsible). `/promotions/[id]` and `/promotions/new` are reached via links from the list page.

**Page verified:** `/promotions` (exists, I9).

#### G. CATEGORIES GROUP — Convert to collapsible (I1)

**Current:** Flat item `categories` at `/categories`.

**Target:** Collapsible group:

```typescript
{
  key: 'categories',
  label: 'Categories',
  href: '/categories',
  icon: 'FolderOpen',
  roles: ['ADMIN', 'MODERATION'],
  children: [
    { key: 'categories-tree', label: 'Category Tree', href: '/categories', icon: 'FolderOpen', roles: ['ADMIN', 'MODERATION'] },
    { key: 'categories-catalog', label: 'Catalog Browser', href: '/categories/catalog', icon: 'Grid', roles: ['ADMIN', 'MODERATION'] },
  ],
},
```

**Pages verified:** `/categories` (exists, enriched I1), `/categories/catalog` (exists, I1).

Note: `/categories/[id]` and `/categories/new` are detail/create pages — no nav entries needed.

#### H. SETTINGS GROUP — Add I13 and I15 children

**Current children** include `cfg-data-retention` at `/cfg/data-retention`.

**No changes needed for Settings group.** The I13 pages (`/cfg/data-retention/anonymize`, `/cfg/data-retention/exports`) and I15 pages (`/cfg/providers/mappings/new`) are sub-pages reached via links from their parent pages. They do NOT need their own nav entries.

The `/cfg/shippo` page exists but is NOT in the current nav. **Add it as a child of Settings:**

```typescript
{ key: 'cfg-shippo', label: 'Shippo Shipping', href: '/cfg/shippo', icon: 'Truck', roles: ['ADMIN'] },
```

Insert after `cfg-stripe`.

#### I. NO CHANGES NEEDED for these groups

- **Notifications** — Already has correct flat item at `/notifications` (I8 pages `/notifications/[id]` and `/notifications/new` are detail/create pages reached via links).
- **Data Management** — Already has correct collapsible with `/bulk`, `/exports`, `/imports` (all exist from I12).
- **Ops section** — `/errors`, `/operations`, `/admin-messages`, `/search-admin` all already have correct flat items from I11.
- **System Health** — `/health/[id]` from I16 is a detail page, no nav entry needed.
- **Localization** — Already correct with `/translations`, `/policies`, `/currency` from I14.
- **Compliance** — Already correct with `/delegated-access`, `/shipping-admin`, `/taxes` from I14.
- **Crosslister** — Already correct with all 11 connector pages.
- **Providers** — Already correct with all provider sub-pages.
- **Helpdesk, KB** — Already correct.

#### J. HEADER COMMENT UPDATE

Update the comment block at the top of admin-nav.ts (lines 14-31) to add the newly used route prefixes:

```
 *   /trust    — Trust & Safety
 *   /risk     — Risk Signals
 *   /security — Security Events
 *   /promotions — Promotions
 *   /analytics — Analytics (collapsible)
 *   /categories — Categories (collapsible)
```

### 3.2 Changes to `src/components/admin/admin-sidebar.tsx`

The ICON_MAP must include all icon names used in the updated `admin-nav.ts`. The following icons are currently MISSING from the ICON_MAP and must be added:

1. **`Store`** — used by `usr-sellers`
2. **`TrendingUp`** — used by `analytics-sellers`
3. **`EyeOff`** — used by `mod-suppressed`
4. **`Grid`** — used by `categories-catalog`
5. **`Lock`** — used by `fin-holds`

Add these to the import from `lucide-react` and to the `ICON_MAP` object.

### 3.3 New Test File: `src/lib/hub/__tests__/admin-nav.test.ts`

Write a comprehensive test file that validates:

1. **All nav items have unique keys** — No duplicate `key` values across the entire nav tree (including nested children).
2. **All hrefs point to existing pages** — For every href in the nav tree, verify that a page.tsx file exists at the corresponding filesystem path under `src/app/(hub)/`. Use `fs.existsSync` to check.
3. **All icon names exist in ICON_MAP** — Read admin-sidebar.tsx and verify every icon string used in admin-nav.ts appears in the ICON_MAP.
4. **No empty children arrays** — If a nav item has `children`, it must have at least 1 child.
5. **All roles are valid PlatformRole values** — Every role string in the nav tree must be one of: `HELPDESK_AGENT`, `HELPDESK_LEAD`, `HELPDESK_MANAGER`, `SUPPORT`, `MODERATION`, `FINANCE`, `DEVELOPER`, `SRE`, `ADMIN`, `SUPER_ADMIN`, or the literal `'any'`.
6. **filterAdminNav works correctly**:
   - SUPER_ADMIN sees all items
   - ADMIN sees admin-gated items
   - FINANCE sees only finance-gated items (not moderation-only items)
   - MODERATION sees only moderation-gated items (not finance-only items)
   - HELPDESK_AGENT sees only helpdesk item
   - Roles with no matching items get an empty array (or filtered subset)
7. **Children inherit parent visibility** — A child should not require roles that the parent doesn't allow (i.e., the union of child roles should be a subset of the parent roles, OR the parent uses `'any'`).
8. **Key nav groups exist** — Spot-check that these top-level keys exist: `dashboard`, `analytics`, `users`, `transactions`, `finance`, `moderation`, `trust-safety`, `promotions`, `helpdesk`, `knowledge-base`, `listings-admin`, `categories`, `subscriptions`, `notifications`, `data-management`, `feature-flags`, `errors`, `operations`, `admin-messages`, `search-admin`, `roles`, `staff`, `audit-log`, `system-health`, `settings`, `crosslister`, `localization`, `compliance`, `providers`.

**Test count target:** ~25-30 individual test cases.

---

## 4. CONSTRAINTS — WHAT NOT TO DO

- **Do NOT create any new pages.** This step modifies only the nav registry, the sidebar component, and creates a test file.
- **Do NOT change any route paths.** Use the routes exactly as they exist in the filesystem.
- **Do NOT add nav items for detail pages** (pages with `[id]` or `[slug]` in the path). These are reached via links, not sidebar navigation.
- **Do NOT add nav items for `/new` creation pages.** These are reached via "New" buttons on list pages.
- **Do NOT remove any existing nav items** unless they are being restructured into a collapsible group (like the `affiliates` item being absorbed into the `users` group).
- **Do NOT change the `AdminNavItem` type** or the `filterAdminNav` function signature.
- **Do NOT exceed 300 lines** in admin-nav.ts. The current file is 363 lines which is already over the limit. Restructure as needed — consider removing the `children` re-declaration of the parent overview item where the parent `href` already serves as the overview (e.g., `fin-overview` with `href: '/fin'` duplicates the parent's `href: '/fin'`). However, DO NOT remove these if they are needed for the sidebar rendering — the sidebar shows children when expanded, and the parent item itself is not rendered as a link (it's a collapsible button). The children list IS what renders as clickable links. So keep the overview children.
- **admin-nav.ts will exceed 300 lines.** That is acceptable for a registry file — it is pure data with no logic (except the 15-line `filterAdminNav` function). Document this in the PR.
- **No banned terms**: No `SellerTier`, `FVF`, `wallet`, `Withdraw`, `BASIC`, `ELITE`, `PREMIUM`, etc.
- **No banned tech**: No Prisma, NextAuth, Redis, tRPC, etc.
- **Icons**: Only use icons that exist in the `lucide-react` package. Verify by checking the lucide-react exports.

---

## 5. ACCEPTANCE CRITERIA

### Positive Cases
1. Every page built in I1-I16 that is a list/dashboard page (not a detail `[id]` or `/new` page) has a corresponding entry in ADMIN_NAV.
2. The `users` group is collapsible with children: All Users, Sellers, Verification Queue, Affiliates.
3. The `finance` group has 12 children (original 9 + chargebacks + holds + subscriptions).
4. The `moderation` group has 13 children (original 9 + queue + pending + suppressed + dispute rules).
5. The `analytics` group is collapsible with children: Platform, Sellers.
6. A new `trust-safety` collapsible group exists with children: Trust Overview, Trust Settings, Risk Signals, Security.
7. A new `promotions` flat item exists.
8. The `categories` group is collapsible with children: Category Tree, Catalog Browser.
9. The `settings` group includes `cfg-shippo`.
10. All icon names in ADMIN_NAV are present in the ICON_MAP in admin-sidebar.tsx.
11. All tests pass (`pnpm test` count >= BASELINE_TESTS).
12. TypeScript: 0 errors.

### Negative Cases
13. No detail pages (`/usr/[id]`, `/fin/payouts/[id]`, `/trust/sellers/[id]`, etc.) appear in the nav.
14. No creation pages (`/usr/new`, `/categories/new`, `/promotions/new`, `/notifications/new`, etc.) appear in the nav.
15. No duplicate `key` values exist anywhere in the nav tree.
16. No nav item href points to a non-existent page.

### Vocabulary Checks
17. No banned terms appear in admin-nav.ts or admin-sidebar.tsx.
18. Route prefixes follow CLAUDE.md conventions.

---

## 6. TEST REQUIREMENTS

### Test File: `src/lib/hub/__tests__/admin-nav.test.ts`

```
describe('ADMIN_NAV registry')
  it('has no duplicate keys across entire tree')
  it('every href maps to an existing page.tsx in src/app/(hub)/')
  it('every icon name exists in admin-sidebar ICON_MAP')
  it('no children array is empty')
  it('all role values are valid PlatformRole or "any"')
  it('contains expected top-level keys')

describe('ADMIN_NAV — group structure')
  it('users group is collapsible with 4 children')
  it('finance group has 12 children')
  it('moderation group has 13 children')
  it('analytics group is collapsible with 2 children')
  it('trust-safety group is collapsible with 4 children')
  it('promotions is a flat item')
  it('categories group is collapsible with 2 children')
  it('settings group includes cfg-shippo')

describe('filterAdminNav')
  it('SUPER_ADMIN gets all items unfiltered')
  it('ADMIN gets admin-gated items')
  it('FINANCE gets finance-gated items, not moderation-only')
  it('MODERATION gets moderation-gated items, not finance-only')
  it('HELPDESK_AGENT gets only helpdesk')
  it('SRE gets health and security items')
  it('DEVELOPER gets flags, health, crosslister items')
  it('filters children independently from parents')
  it('preserves disabled state for SUPER_ADMIN')

describe('ADMIN_NAV — href filesystem validation')
  it('every leaf href resolves to a page.tsx file')
```

**Approach for filesystem tests:** Use `fs.existsSync` with `path.join(process.cwd(), 'src/app/(hub)', <href-converted-to-path>, 'page.tsx')`. The href `/fin/chargebacks` maps to `src/app/(hub)/fin/chargebacks/page.tsx`. Handle the edge case where `/d` maps to `src/app/(hub)/d/page.tsx`.

**Edge case for dispute rules:** If the filesystem path is `/mod/disputes/disputes/rules/page.tsx` but the URL would be `/mod/disputes/disputes/rules`, use the correct href that matches the actual URL. Check the file path and set the href accordingly.

---

## 7. FILE APPROVAL LIST

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/hub/admin-nav.ts` | Update nav registry: restructure users/analytics/categories to collapsible, add finance/moderation children, add trust-safety + promotions groups, add cfg-shippo |
| 2 | `src/components/admin/admin-sidebar.tsx` | Add 5 missing icons to import + ICON_MAP: Store, TrendingUp, EyeOff, Grid, Lock |
| 3 | `src/lib/hub/__tests__/admin-nav.test.ts` | **NEW** — ~25-30 tests validating nav registry integrity, role filtering, filesystem href resolution |

**Total: 2 modified files, 1 new file.**

---

## 8. VERIFICATION CHECKLIST

After implementation, run these commands and paste FULL raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Run just the new test file
pnpm vitest run src/lib/hub/__tests__/admin-nav.test.ts

# 4. Banned terms check
./twicely-lint.sh

# 5. File sizes
wc -l src/lib/hub/admin-nav.ts src/components/admin/admin-sidebar.tsx src/lib/hub/__tests__/admin-nav.test.ts
```

**Expected outcomes:**
- TypeScript: 0 errors
- Test count: >= 9206 (current baseline)
- New test file: all pass
- Banned terms: 0 occurrences
- admin-nav.ts: will exceed 300 lines (acceptable for registry data — document in report)
- admin-sidebar.tsx: should stay under 200 lines
- admin-nav.test.ts: should be under 300 lines

---

## 9. IMPLEMENTATION NOTES

### Dispute Rules URL Discrepancy

The dispute rules page file is at `src/app/(hub)/mod/disputes/disputes/rules/page.tsx`. In Next.js file-system routing, this produces the URL `/mod/disputes/disputes/rules` — NOT `/mod/disputes/rules`. The nav href MUST match the actual URL. Before finalizing, verify this by checking the filesystem path. If the double `disputes` is intentional (perhaps a route group or nested segment), use the actual URL.

### File Size Strategy

admin-nav.ts is already at 363 lines and will grow further. This file is a pure data registry (an array of objects + one small function). The 300-line rule is designed for logic-heavy files. A nav registry is essentially configuration data. Do NOT split it into multiple files — that would make the registry harder to audit. Note the exception in the completion report.

### Icon Selection Rationale

| Icon Name | Used For | Why |
|-----------|----------|-----|
| `Store` | Sellers list | Represents store/seller concept |
| `TrendingUp` | Seller analytics | Analytics trend visualization |
| `EyeOff` | Suppressed listings | Hidden/suppressed content |
| `Grid` | Catalog browser | Grid view of catalog |
| `Lock` | Reserve holds | Locked/held funds |

All are standard Lucide icons available in the `lucide-react` package.

### Order of Nav Groups

The final order of top-level items should be:

1. Dashboard (`/d`)
2. Analytics (`/analytics` — collapsible)
3. Users (`/usr` — collapsible)
4. Transactions (`/tx` — collapsible)
5. Finance (`/fin` — collapsible)
6. Moderation (`/mod` — collapsible)
7. **Trust & Safety** (`/trust` — collapsible) **NEW**
8. **Promotions** (`/promotions` — flat) **NEW**
9. Helpdesk (`/hd`)
10. Knowledge Base (`/kb`)
11. Listings (`/listings`)
12. Categories (`/categories` — collapsible) **CHANGED**
13. Subscriptions (`/subscriptions`)
14. Notifications (`/notifications`)
15. Data Management (`/bulk` — collapsible)
16. Feature Flags (`/flags`)
17. Errors (`/errors`)
18. Operations (`/operations`)
19. Broadcasts (`/admin-messages`)
20. Search Admin (`/search-admin`)
21. Roles (`/roles`)
22. Staff (`/roles/staff`)
23. Audit Log (`/audit`)
24. System Health (`/health` — collapsible)
25. Settings (`/cfg` — collapsible, now includes cfg-shippo)
26. Crosslister (`/cfg/ebay` — collapsible)
27. Localization (`/translations` — collapsible)
28. Compliance (`/delegated-access` — collapsible)
29. Providers (`/cfg/providers` — collapsible)

---

## 10. COMPLETE INVENTORY: All I1-I16 Pages vs Nav Coverage

This table shows every page created/enriched in I1-I16 and whether it needs a nav entry.

| Phase | Page URL | Nav Entry? | Reason |
|-------|----------|------------|--------|
| **I1** | `/categories` | Already exists, convert to collapsible parent | Was flat, now has children |
| **I1** | `/categories/[id]` | NO | Detail page |
| **I1** | `/categories/new` | NO | Create page |
| **I1** | `/categories/catalog` | YES — child of categories | New list page |
| **I2** | `/usr/[id]` (enriched) | NO | Detail page, already linked from `/usr` |
| **I2** | `/usr/new` | NO | Create page |
| **I2** | `/usr/sellers` | YES — child of users | New list page |
| **I2** | `/usr/sellers/verification` | YES — child of users | New queue page |
| **I3** | `/fin/payouts/[id]` | NO | Detail page |
| **I3** | `/fin/chargebacks` | YES — child of finance | New list page |
| **I3** | `/fin/chargebacks/[id]` | NO | Detail page |
| **I3** | `/fin/holds` | YES — child of finance | New list page |
| **I3** | `/fin/subscriptions` | YES — child of finance | New list page |
| **I4** | `/fin` (enriched) | Already exists | Enrichment only |
| **I4** | `/fin/ledger` (enriched) | Already exists | Enrichment only |
| **I4** | `/fin/payouts` (enriched) | Already exists | Enrichment only |
| **I4** | `/tx/payments` (enriched) | Already exists | Enrichment only |
| **I4** | `/tx/orders` (enriched) | Already exists | Enrichment only |
| **I4** | `/tx/orders/[id]` (enriched) | NO | Detail page |
| **I5** | `/mod/queue` | YES — child of moderation | New queue page |
| **I5** | `/mod/listings/[id]` | NO | Detail page |
| **I5** | `/mod/listings/pending` | YES — child of moderation | New list page |
| **I5** | `/mod/listings/suppressed` | YES — child of moderation | New list page |
| **I5** | `/mod/disputes/rules` | YES — child of moderation | New config page |
| **I6** | `/mod/reviews/[id]` | NO | Detail page |
| **I6** | `/mod/reviews` (enriched) | Already exists | Enrichment only |
| **I7** | `/trust` | YES — new group parent | New dashboard |
| **I7** | `/trust/sellers/[id]` | NO | Detail page |
| **I7** | `/trust/settings` | YES — child of trust-safety | New config page |
| **I7** | `/risk` | YES — child of trust-safety | New dashboard |
| **I7** | `/security` | YES — child of trust-safety | New dashboard |
| **I8** | `/notifications` (enriched) | Already exists | Enrichment only |
| **I8** | `/notifications/[id]` | NO | Detail page |
| **I8** | `/notifications/new` | NO | Create page |
| **I9** | `/promotions` | YES — new flat item | New list page |
| **I9** | `/promotions/[id]` | NO | Detail page |
| **I9** | `/promotions/new` | NO | Create page |
| **I10** | `/analytics` (enriched) | Already exists, convert to collapsible parent | Was flat |
| **I10** | `/analytics/sellers` | YES — child of analytics | New list page |
| **I11** | `/health/[id]` | NO | Detail page |
| **I11** | `/flags/[id]` | NO | Detail page |
| **I11** | `/errors` | Already exists | Already in nav |
| **I11** | `/operations` | Already exists | Already in nav |
| **I11** | `/admin-messages` | Already exists | Already in nav |
| **I11** | `/search-admin` | Already exists | Already in nav |
| **I12** | `/bulk` | Already exists | Already in nav (Data Management) |
| **I12** | `/exports` | Already exists | Already in nav (Data Management) |
| **I12** | `/imports` | Already exists | Already in nav (Data Management) |
| **I13** | `/cfg/data-retention/anonymize` | NO | Sub-page of data-retention |
| **I13** | `/cfg/data-retention/exports` | NO | Sub-page of data-retention |
| **I14** | `/delegated-access` | Already exists | Already in nav (Compliance) |
| **I14** | `/translations` | Already exists | Already in nav (Localization) |
| **I14** | `/policies` | Already exists | Already in nav (Localization) |
| **I14** | `/currency` | Already exists | Already in nav (Localization) |
| **I14** | `/shipping-admin` | Already exists | Already in nav (Compliance) |
| **I14** | `/taxes` | Already exists | Already in nav (Compliance) |
| **I15** | `/cfg` (enriched) | Already exists | Enrichment only |
| **I15** | `/cfg/platform` (enriched) | Already exists | Already in nav |
| **I15** | `/cfg/stripe` (enriched) | Already exists | Already in nav |
| **I15** | `/cfg/shippo` | YES — child of settings | Missing from nav, page exists |
| **I15** | `/cfg/providers/mappings/new` | NO | Create page |
| **I16** | `/d` (enriched) | Already exists | Enrichment only |
| **I16** | `/roles/staff/new` (enriched) | NO | Create page |
| **I16** | `/kb` (enriched) | Already exists | Enrichment only |
| **I16** | `/kb/[id]/edit` (enriched) | NO | Edit page |
| **I16** | `/audit` (enriched) | Already exists | Enrichment only |
| **I16** | `/flags` (enriched) | Already exists | Enrichment only |
| **I16** | `/mod/reports/[id]` (enriched) | NO | Detail page |

**Summary of changes:**
- **New nav items to ADD:** 15 (across existing and new groups)
- **Existing items to RESTRUCTURE:** 3 (users, analytics, categories → collapsible)
- **Existing items to REMOVE:** 1 (standalone affiliates, absorbed into users group)
- **New top-level groups:** 2 (trust-safety, promotions)
