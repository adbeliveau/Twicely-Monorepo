# TWICELY V3 — Unified User Hub ("My Hub") Canonical

**Version:** v1.0
**Status:** LOCKED
**Date:** 2026-02-20
**Carries Forward From:** V2 `TWICELY_UNIFIED_USER_HUB_CANONICAL.md` v1.0
**Scope:** User-facing hub UI architecture, navigation, capability-based visibility, route structure, layout shell
**Audience:** Frontend, backend, AI installers
**Aligns with:** `TWICELY_V3_USER_MODEL.md`, `TWICELY_V3_PAGE_REGISTRY.md`, `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md`

---

## 0. Core Decision

There is **ONE user-facing hub** called **"My Hub."**

| Property | Value |
|----------|-------|
| URL root | `/my` |
| Display name | **My Hub** |
| Sidebar header | "My Hub" |
| Nav link text (from marketplace) | "My Hub" |
| Breadcrumb root | My Hub |

| ❌ Wrong | ✅ Correct (This Canonical) |
|----------|----------------------------|
| Separate buyer and seller dashboards | One hub, capability-gated sidebar sections |
| Clicking a sidebar item opens a new page | Content swaps inside the shell; sidebar persists |
| Crosslister as top-level sidebar section | Crosslister nests under Selling |
| Messages at `/m` (outside hub) | Messages at `/my/messages` (inside hub shell) |

**Why:** Twicely uses a unified user model (`TWICELY_V3_USER_MODEL.md`). Seller is a capability, not an account type. The UI must reflect this — one hub, sections appear as capabilities are activated. Everything lives inside the persistent shell. Nothing navigates away from `/my/*`.

**What this does NOT change:**
- Backend organization (server actions, lib structure) — unaffected
- Corp Admin stays at `hub.twicely.co` — completely separate shell (do NOT call it "Hub" in user-facing copy; that name belongs to the admin platform)
- Helpdesk stays at `hub.twicely.co/hd/*` — completely separate shell
- Public marketplace pages (`/`, `/s`, `/i/*`, `/c/*`, `/st/*`) — separate layout

---

## 1. Architecture: Persistent Shell

The hub is a **persistent shell** powered by Next.js nested layouts. The sidebar and topbar never unmount. Route changes swap the content panel only.

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR (user avatar, notifications bell, search, theme)     │
├────────────┬─────────────────────────────────────────────────┤
│            │                                                 │
│  SIDEBAR   │              CONTENT AREA                       │
│            │                                                 │
│  My Hub    │  (swaps on route change)                        │
│  ────────  │                                                 │
│  Dashboard │  /my              → Dashboard                   │
│            │  /my/buying/orders → Purchase history            │
│  Shopping  │  /my/selling/orders → Orders to ship            │
│   Purchases│  /my/messages     → Conversations               │
│   Offers   │  /my/settings     → Account settings            │
│   Watchlist│                                                 │
│   ...      │  URL updates for bookmarking/sharing/back.      │
│            │  Shell stays. No full page reload.              │
│  Selling   │                                                 │
│   Listings │                                                 │
│   Orders   │                                                 │
│   ...      │                                                 │
│            │                                                 │
│  Settings  │                                                 │
│  Help      │                                                 │
│            │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│  MOBILE: Bottom nav (Dashboard, Purchases, Sell, Messages,   │
│  Profile) — sidebar hidden behind hamburger                  │
└──────────────────────────────────────────────────────────────┘
```

**Implementation:** Single `layout.tsx` at `src/app/(marketplace)/my/layout.tsx`. All `/my/*` routes are children. The layout renders sidebar + topbar and passes `{children}` to the content area. Next.js handles client-side navigation without unmounting the layout.

---

## 2. Route Structure

All user-facing hub routes live under `/my`.

```
src/app/(marketplace)/my/
├── layout.tsx                         # Persistent shell (sidebar + topbar + content)
├── page.tsx                           # Dashboard (configurable buyer-first or seller-first)
│
├── buying/                            # ALWAYS VISIBLE
│   ├── orders/
│   │   ├── page.tsx                   # My purchases
│   │   └── [id]/
│   │       ├── page.tsx               # Purchase detail (tracking, receipt)
│   │       ├── return/page.tsx        # Request return
│   │       ├── dispute/page.tsx       # Open dispute
│   │       └── review/page.tsx        # Leave review (buyer→seller)
│   ├── offers/page.tsx                # Offers I've sent
│   ├── watchlist/page.tsx             # Saved listings
│   ├── searches/page.tsx              # Saved searches + alerts
│   ├── reviews/page.tsx               # Reviews I've left
│   └── following/page.tsx             # Following sellers
│
├── selling/                           # IF isSeller
│   ├── page.tsx                       # Seller overview (KPIs, action items)
│   ├── listings/
│   │   ├── page.tsx                   # All listings (active, draft, ended)
│   │   ├── new/page.tsx               # Create listing
│   │   ├── [id]/edit/page.tsx         # Edit listing
│   │   └── bulk/page.tsx              # Bulk upload (CSV)
│   ├── orders/
│   │   ├── page.tsx                   # Orders to fulfill
│   │   └── [id]/
│   │       ├── page.tsx               # Order detail (ship, track, buyer info)
│   │       ├── ship/page.tsx          # Ship order (Shippo label or manual)
│   │       └── review/page.tsx        # Rate buyer (seller→buyer)
│   ├── offers/page.tsx                # Incoming offers (accept/decline/counter)
│   ├── returns/
│   │   ├── page.tsx                   # Return requests received
│   │   └── [id]/page.tsx              # Return detail (approve/deny/evidence)
│   ├── shipping/page.tsx              # Shipping profiles
│   ├── promotions/
│   │   ├── page.tsx                   # Promotions list
│   │   ├── new/page.tsx               # Create promotion
│   │   └── [id]/page.tsx              # Edit promotion
│   ├── promoted/page.tsx              # Promoted listings + boost controls
│   ├── crosslist/                     # IF ListerTier !== NONE
│   │   ├── page.tsx                   # Crosslister dashboard
│   │   ├── connect/page.tsx           # Connect platform (OAuth)
│   │   ├── import/
│   │   │   ├── page.tsx               # Import progress (real-time via Centrifugo)
│   │   │   └── issues/page.tsx        # Import issues (failed records)
│   │   └── automation/page.tsx        # Auto-relist, price drops, Posh sharing
│   ├── store/                         # IF hasStore (BUSINESS + StoreTier !== NONE)
│   │   ├── page.tsx                   # Store settings (name, logo, banner, about)
│   │   └── editor/page.tsx            # Puck page builder (Power+ tier)
│   ├── staff/
│   │   ├── page.tsx                   # Staff management (invite, scopes, revoke)
│   │   └── invite/page.tsx            # Invite staff form
│   ├── finances/
│   │   ├── page.tsx                   # Finance overview (balance, pending, holds)
│   │   ├── transactions/page.tsx      # Ledger entries (filterable, CSV export)
│   │   ├── payouts/page.tsx           # Payout history + request payout
│   │   ├── statements/page.tsx        # Monthly/annual statements (PDF/CSV)
│   │   └── platforms/page.tsx         # Cross-platform revenue comparison (Phase F)
│   ├── analytics/page.tsx             # Sales trends, conversion, top items
│   ├── performance/page.tsx           # Seller metrics, trust indicators
│   ├── subscription/page.tsx          # Store + Lister + Automation tiers
│   ├── verification/page.tsx          # KYC status, document upload
│   └── onboarding/page.tsx            # Seller setup wizard (first-time)
│
├── messages/                          # ALWAYS VISIBLE (moved from /m into hub shell)
│   ├── page.tsx                       # Conversations list (inbox)
│   └── [conversationId]/
│       └── page.tsx                   # Conversation thread (real-time via Centrifugo)
│
├── settings/                          # ALWAYS VISIBLE
│   ├── page.tsx                       # Account settings (profile, avatar, bio)
│   ├── addresses/page.tsx             # Shipping + billing addresses
│   ├── security/page.tsx              # Password, 2FA, active sessions
│   ├── notifications/page.tsx         # Notification preferences (template × channel)
│   └── privacy/page.tsx               # Data export request, account deletion
│
└── support/                           # ALWAYS VISIBLE
    ├── page.tsx                       # My support cases
    └── [caseId]/page.tsx              # Case detail + reply

# Outside the hub shell but linked from sidebar:
# /h          → Help Center (public, marketplace layout)
# /h/contact  → Contact Support (auth required, marketplace layout)
```

### Route Changes from Page Registry v1.0

| Change | Old | New | Reason |
|--------|-----|-----|--------|
| Messages route | `/m`, `/m/[conversationId]` | `/my/messages`, `/my/messages/[conversationId]` | Inside hub shell |
| Buying overview | `/my/buying` (standalone page) | Redirect to `/my` | Dashboard IS the overview |

**Redirects to add:**
- `/m` → `/my/messages` (308 permanent)
- `/m/[id]` → `/my/messages/[id]` (308 permanent)
- `/my/buying` → `/my` (308 permanent)

---

## 3. Sidebar Navigation

### 3.1 Capability Model

```typescript
type UserCapabilities = {
  // Identity
  isSeller: boolean;                // SellerProfile exists + status === ACTIVE
  sellerType: 'PERSONAL' | 'BUSINESS';

  // Store Subscription (axis 1)
  storeTier: StoreTier | null;      // NONE | STARTER | PRO | POWER | ENTERPRISE
  hasStore: boolean;                // storeTier !== NONE && sellerType === BUSINESS

  // Crosslister Subscription (axis 2)
  listerTier: ListerTier | null;    // NONE | FREE | LITE | PRO
  hasCrosslister: boolean;          // listerTier !== NONE

  // Automation Add-On
  hasAutomation: boolean;           // Requires Lister LITE+

  // Performance Band (axis 3 — earned, not purchased)
  performanceBand: PerformanceBand | null;

  // Delegation (staff acting on behalf)
  isStaff: boolean;                 // Acting via DelegatedAccess
  delegatedScopes: string[];        // What staff can do
};
```

### 3.2 Visibility Gates

| Gate | Condition | What Appears |
|------|-----------|-------------|
| `ALWAYS` | Authenticated | Dashboard, Shopping, Messages, Settings, Help |
| `IS_SELLER` | `isSeller === true` | Selling section (Listings, Orders, Offers, Returns, Shipping, Promotions, Finance, Analytics, Subscription) |
| `HAS_CROSSLISTER` | `listerTier !== NONE` | Crosslister sub-group within Selling (Platforms, Import, Automation) |
| `HAS_STORE` | `storeTier !== NONE && sellerType === BUSINESS` | Store sub-group within Selling (Branding, Page Builder, Staff) |

### 3.3 Sidebar Layout

```
MY HUB                                  ← header (always)

── DASHBOARD ──                          ← /my (always, default view)

── SHOPPING ──                           ← ALWAYS
  Purchases                              ← /my/buying/orders
  Offers Sent                            ← /my/buying/offers
  Watchlist                              ← /my/buying/watchlist
  Saved Searches                         ← /my/buying/searches
  My Reviews                             ← /my/buying/reviews
  Following                              ← /my/buying/following

── SELLING ──                            ← IF isSeller
  Listings                               ← /my/selling/listings
  Orders                                 ← /my/selling/orders          [badge: awaiting shipment]
  Offers Received                        ← /my/selling/offers          [badge: pending offers]
  Returns                                ← /my/selling/returns         [badge: open returns]
  Shipping Profiles                      ← /my/selling/shipping
  Promotions                             ← /my/selling/promotions

  ── CROSSLISTER ──                      ← IF ListerTier !== NONE (sub-group divider)
    Platforms                            ← /my/selling/crosslist/connect
    Import                               ← /my/selling/crosslist/import
    Automation                           ← /my/selling/crosslist/automation

  ── STORE ──                            ← IF hasStore (sub-group divider)
    Branding                             ← /my/selling/store
    Page Builder                         ← /my/selling/store/editor
    Staff                                ← /my/selling/staff

  ── FINANCE ──                          ← sub-group (always visible if isSeller)
    Overview                             ← /my/selling/finances
    Transactions                         ← /my/selling/finances/transactions
    Payouts                              ← /my/selling/finances/payouts

  Analytics                              ← /my/selling/analytics
  Subscription                           ← /my/selling/subscription

── MESSAGES ──                           ← ALWAYS
  Inbox                                  ← /my/messages                [badge: unread count]

── SETTINGS ──                           ← ALWAYS
  Account                                ← /my/settings
  Addresses                              ← /my/settings/addresses
  Security                               ← /my/settings/security
  Notifications                          ← /my/settings/notifications

── HELP ──                               ← ALWAYS
  Help Center                            ← /h                          (links out to public layout)
  Contact Support                        ← /h/contact                  (links out to public layout)
  My Cases                               ← /my/support

─────────────────
[Start Selling]                          ← IF !isSeller (bottom CTA)
[Try Crosslister →]                      ← IF isSeller && !hasCrosslister
[Open a Store →]                         ← IF isSeller && PERSONAL && !hasStore
```

### 3.4 Navigation Registry (TypeScript)

```typescript
// src/lib/hub/hub-nav.ts

export type HubNavSection = {
  key: string;
  label: string;
  icon: string;                          // Lucide icon name
  gate: 'ALWAYS' | 'IS_SELLER' | 'HAS_CROSSLISTER' | 'HAS_STORE';
  parent?: string;                       // If set, renders as sub-group under parent section
  items: HubNavItem[];
};

export type HubNavItem = {
  key: string;
  label: string;
  href: string;
  icon?: string;
  badge?: () => Promise<number | null>;  // Dynamic count
  requiresScope?: string;               // For staff: delegated access scope
  external?: boolean;                    // Links outside /my shell (e.g., /h)
};

export const HUB_NAV: HubNavSection[] = [
  // ─── ALWAYS VISIBLE ─────────────────────────────────────────────
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    gate: 'ALWAYS',
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/my', icon: 'LayoutDashboard' },
    ],
  },
  {
    key: 'shopping',
    label: 'Shopping',
    icon: 'ShoppingBag',
    gate: 'ALWAYS',
    items: [
      { key: 'purchases', label: 'Purchases', href: '/my/buying/orders', icon: 'Package' },
      { key: 'offers-sent', label: 'Offers Sent', href: '/my/buying/offers', icon: 'Send' },
      { key: 'watchlist', label: 'Watchlist', href: '/my/buying/watchlist', icon: 'Heart' },
      { key: 'saved-searches', label: 'Saved Searches', href: '/my/buying/searches', icon: 'Search' },
      { key: 'my-reviews', label: 'My Reviews', href: '/my/buying/reviews', icon: 'Star' },
      { key: 'following', label: 'Following', href: '/my/buying/following', icon: 'UserPlus' },
    ],
  },

  // ─── SELLING ────────────────────────────────────────────────────
  {
    key: 'selling',
    label: 'Selling',
    icon: 'Store',
    gate: 'IS_SELLER',
    items: [
      { key: 'listings', label: 'Listings', href: '/my/selling/listings', icon: 'Tag',
        requiresScope: 'listings.view' },
      { key: 'seller-orders', label: 'Orders', href: '/my/selling/orders', icon: 'ShoppingCart',
        requiresScope: 'orders.view' },
      { key: 'offers-received', label: 'Offers', href: '/my/selling/offers', icon: 'HandCoins',
        requiresScope: 'orders.view' },
      { key: 'returns', label: 'Returns', href: '/my/selling/returns', icon: 'RotateCcw',
        requiresScope: 'returns.respond' },
      { key: 'shipping', label: 'Shipping Profiles', href: '/my/selling/shipping', icon: 'Truck',
        requiresScope: 'shipping.manage' },
      { key: 'promotions', label: 'Promotions', href: '/my/selling/promotions', icon: 'Megaphone',
        requiresScope: 'promotions.view' },
    ],
  },

  // ─── CROSSLISTER (sub-group under Selling) ─────────────────────
  {
    key: 'crosslister',
    label: 'Crosslister',
    icon: 'RefreshCw',
    gate: 'HAS_CROSSLISTER',
    parent: 'selling',
    items: [
      { key: 'platforms', label: 'Platforms', href: '/my/selling/crosslist/connect', icon: 'Link',
        requiresScope: 'crosslister.manage' },
      { key: 'import', label: 'Import', href: '/my/selling/crosslist/import', icon: 'Download',
        requiresScope: 'crosslister.import' },
      { key: 'automation', label: 'Automation', href: '/my/selling/crosslist/automation', icon: 'Zap',
        requiresScope: 'crosslister.manage' },
    ],
  },

  // ─── STORE (sub-group under Selling) ────────────────────────────
  {
    key: 'store',
    label: 'Store',
    icon: 'Storefront',
    gate: 'HAS_STORE',
    parent: 'selling',
    items: [
      { key: 'branding', label: 'Branding', href: '/my/selling/store', icon: 'Palette',
        requiresScope: 'store.manage' },
      { key: 'page-builder', label: 'Page Builder', href: '/my/selling/store/editor', icon: 'Layout',
        requiresScope: 'store.manage' },
      { key: 'staff', label: 'Staff', href: '/my/selling/staff', icon: 'Users',
        requiresScope: 'staff.manage' },
    ],
  },

  // ─── FINANCE (sub-group under Selling) ──────────────────────────
  {
    key: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    gate: 'IS_SELLER',
    parent: 'selling',
    items: [
      { key: 'finance-overview', label: 'Overview', href: '/my/selling/finances', icon: 'BarChart2',
        requiresScope: 'finances.view' },
      { key: 'transactions', label: 'Transactions', href: '/my/selling/finances/transactions', icon: 'FileText',
        requiresScope: 'finances.view' },
      { key: 'payouts', label: 'Payouts', href: '/my/selling/finances/payouts', icon: 'Banknote',
        requiresScope: 'finances.view' },
    ],
  },

  // ─── SELLER EXTRAS (flat items after sub-groups) ────────────────
  {
    key: 'seller-extras',
    label: '',
    icon: '',
    gate: 'IS_SELLER',
    parent: 'selling',
    items: [
      { key: 'analytics', label: 'Analytics', href: '/my/selling/analytics', icon: 'BarChart2',
        requiresScope: 'analytics.view' },
      { key: 'subscription', label: 'Subscription', href: '/my/selling/subscription', icon: 'Crown' },
    ],
  },

  // ─── MESSAGES ───────────────────────────────────────────────────
  {
    key: 'messages',
    label: 'Messages',
    icon: 'MessageSquare',
    gate: 'ALWAYS',
    items: [
      { key: 'inbox', label: 'Inbox', href: '/my/messages', icon: 'MessageSquare' },
    ],
  },

  // ─── SETTINGS ───────────────────────────────────────────────────
  {
    key: 'settings',
    label: 'Settings',
    icon: 'Settings',
    gate: 'ALWAYS',
    items: [
      { key: 'account', label: 'Account', href: '/my/settings', icon: 'UserCircle' },
      { key: 'addresses', label: 'Addresses', href: '/my/settings/addresses', icon: 'MapPin' },
      { key: 'security', label: 'Security', href: '/my/settings/security', icon: 'Shield' },
      { key: 'notifications', label: 'Notifications', href: '/my/settings/notifications', icon: 'Bell' },
    ],
  },

  // ─── HELP ───────────────────────────────────────────────────────
  {
    key: 'help',
    label: 'Help',
    icon: 'HelpCircle',
    gate: 'ALWAYS',
    items: [
      { key: 'help-center', label: 'Help Center', href: '/h', icon: 'BookOpen', external: true },
      { key: 'contact', label: 'Contact Support', href: '/h/contact', icon: 'HelpCircle', external: true },
      { key: 'my-cases', label: 'My Cases', href: '/my/support', icon: 'Ticket' },
    ],
  },
];
```

### 3.5 Navigation Filter Function

```typescript
export function filterHubNav(
  nav: HubNavSection[],
  capabilities: UserCapabilities
): HubNavSection[] {
  // Step 1: Filter by gate
  const gated = nav.filter((section) => {
    switch (section.gate) {
      case 'ALWAYS':          return true;
      case 'IS_SELLER':       return capabilities.isSeller;
      case 'HAS_CROSSLISTER': return capabilities.hasCrosslister;
      case 'HAS_STORE':       return capabilities.hasStore;
      default:                return false;
    }
  });

  // Step 2: Filter items by staff scopes
  const scoped = gated.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.requiresScope) return true;
      if (!capabilities.isStaff) return true;      // Owners have all scopes
      return (
        capabilities.delegatedScopes.includes('*') ||
        capabilities.delegatedScopes.includes(item.requiresScope)
      );
    }),
  }));

  // Step 3: Remove empty sections
  return scoped.filter((section) => section.items.length > 0);
}
```

### 3.6 Sidebar Rendering (Sub-Group Nesting)

The sidebar component groups sections with a `parent` field under their parent visually:

```typescript
function renderSidebar(sections: HubNavSection[]) {
  const topLevel = sections.filter(s => !s.parent);
  const subGroups = sections.filter(s => !!s.parent);

  return topLevel.map(section => (
    <div key={section.key}>
      <SectionHeader label={section.label} icon={section.icon} />
      {section.items.map(item => <NavLink {...item} />)}

      {/* Render sub-groups that belong to this section */}
      {subGroups
        .filter(sg => sg.parent === section.key)
        .map(sg => (
          <div key={sg.key} className="mt-2">
            {sg.label && <SubGroupDivider label={sg.label} icon={sg.icon} />}
            {sg.items.map(item => <NavLink {...item} indent />)}
          </div>
        ))
      }
    </div>
  ));
}
```

Sub-groups render as visually indented sections with a subtle divider and smaller label, creating the hierarchy without deep nesting.

---

## 4. Dashboard Behavior

The `/my` dashboard is **context-aware and configurable.**

### 4.1 User Preference

```typescript
// Stored on SellerProfile or user preferences
dashboardPriority: 'BUYING' | 'SELLING';  // Default: SELLING if isSeller, else BUYING
```

The user can toggle this in the dashboard UI: "Show selling first" / "Show buying first."

### 4.2 Pure Buyer (isSeller = false)

Shows:
- Recent purchases with status and tracking
- Watchlist highlights (price drops, relisted items)
- Saved search new results count
- Unread messages count
- "Start Selling" CTA card

### 4.3 Active Seller — Selling Priority (default for sellers)

**Seller Section (top, expanded):**
- Sales KPIs: GMV, orders, net revenue (period selectable: 7d / 30d / 90d)
- Action items with counts: orders awaiting shipment, pending offers, open returns, performance warnings
- Recent sales activity feed

**Buyer Section (below, collapsed by default):**
- Recent purchases
- Watchlist highlights
- Saved search alerts

### 4.4 Active Seller — Buying Priority

Same widgets, reversed order. Buyer section expanded on top, seller section below.

### 4.5 Staff User (isStaff = true)

Shows only widgets for sections the staff member has scopes for. No buyer section (staff manage the seller's account, not their own purchases).

Banner at top: "Acting as [Seller Name]" with link to switch back to own account.

---

## 5. Layout Implementation

### 5.1 Layout Component

```tsx
// src/app/(marketplace)/my/layout.tsx

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserCapabilities } from '@/lib/queries/user-capabilities';
import { HubSidebar } from '@/components/hub/hub-sidebar';
import { HubTopbar } from '@/components/hub/hub-topbar';

export default async function MyHubLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login?callbackUrl=/my');

  const capabilities = await getUserCapabilities(session.user.id);

  return (
    <div className="flex h-screen">
      <HubSidebar capabilities={capabilities} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <HubTopbar user={session.user} capabilities={capabilities} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 5.2 Capability Loader

```typescript
// src/lib/queries/user-capabilities.ts

import { db } from '@/lib/db';
import { user, sellerProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function getUserCapabilities(userId: string): Promise<UserCapabilities> {
  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { isSeller: true },
  });

  const profile = await db.query.sellerProfile.findFirst({
    where: eq(sellerProfile.userId, userId),
    columns: {
      sellerType: true,
      storeTier: true,
      listerTier: true,
      hasAutomation: true,
      performanceBand: true,
      status: true,
    },
  });

  const isSeller = !!userRecord?.isSeller && profile?.status === 'ACTIVE';
  const storeTier = profile?.storeTier ?? null;
  const listerTier = profile?.listerTier ?? null;

  // Check for delegation (staff acting on behalf)
  const delegation = await getActiveDelegation(userId);

  return {
    isSeller,
    sellerType: profile?.sellerType ?? 'PERSONAL',
    storeTier,
    hasStore: isSeller && storeTier !== null && storeTier !== 'NONE'
      && profile?.sellerType === 'BUSINESS',
    listerTier,
    hasCrosslister: listerTier !== null && listerTier !== 'NONE',
    hasAutomation: profile?.hasAutomation ?? false,
    performanceBand: profile?.performanceBand ?? null,
    isStaff: !!delegation,
    delegatedScopes: delegation?.scopes ?? [],
  };
}
```

### 5.3 Sidebar Component

```tsx
// src/components/hub/hub-sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filterHubNav, HUB_NAV } from '@/lib/hub/hub-nav';
import type { UserCapabilities } from '@/lib/queries/user-capabilities';

export function HubSidebar({ capabilities }: { capabilities: UserCapabilities }) {
  const filteredNav = filterHubNav(HUB_NAV, capabilities);
  const pathname = usePathname();

  const topLevel = filteredNav.filter(s => !s.parent);
  const subGroups = filteredNav.filter(s => !!s.parent);

  return (
    <aside className="hidden md:flex w-64 border-r bg-white dark:bg-gray-900 flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <Link href="/my" className="text-lg font-semibold text-violet-600">
          My Hub
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {topLevel.map((section) => (
          <div key={section.key} className="mb-4">
            {section.label && (
              <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                icon={item.icon}
                active={pathname === item.href || pathname.startsWith(item.href + '/')}
                external={item.external}
              >
                {item.label}
              </NavLink>
            ))}

            {/* Sub-groups */}
            {subGroups
              .filter(sg => sg.parent === section.key)
              .map(sg => (
                <div key={sg.key} className="mt-3 mb-2">
                  {sg.label && (
                    <p className="px-6 text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      {sg.label}
                    </p>
                  )}
                  {sg.items.map((item) => (
                    <NavLink
                      key={item.key}
                      href={item.href}
                      icon={item.icon}
                      active={pathname === item.href || pathname.startsWith(item.href + '/')}
                      indent
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))
            }
          </div>
        ))}
      </nav>

      {/* Bottom CTAs */}
      {!capabilities.isSeller && (
        <div className="p-4 border-t">
          <Link href="/sell" className="btn-primary w-full text-center block">
            Start Selling
          </Link>
        </div>
      )}
      {capabilities.isSeller && !capabilities.hasCrosslister && (
        <div className="p-4 border-t">
          <Link href="/my/selling/subscription" className="btn-secondary w-full text-center text-sm block">
            Try Crosslister →
          </Link>
        </div>
      )}
      {capabilities.isSeller && capabilities.sellerType === 'PERSONAL' && !capabilities.hasStore && (
        <div className="p-4 border-t">
          <Link href="/my/selling/subscription" className="btn-secondary w-full text-center text-sm block">
            Open a Store →
          </Link>
        </div>
      )}
    </aside>
  );
}
```

---

## 6. Seller Activation Flow

When a non-seller user clicks "Start Selling" or creates their first listing:

```
1. User clicks "Start Selling" or "List an Item"
2. System checks: user.isSeller?
   ├── YES → Navigate to /my/selling/listings/new
   └── NO  → Show activation prompt:
             "Ready to start selling? Your first listing is free."
             [Start Selling] button
3. On confirm:
   - Create SellerProfile:
       sellerType = PERSONAL
       storeTier = NONE
       listerTier = NONE
       hasAutomation = false
       performanceBand = EMERGING
       status = ACTIVE
   - Set user.isSeller = true
   - Emit audit event: SELLER_ACTIVATED
4. Sidebar immediately shows Selling section with all sub-items
5. Navigate to /my/selling/listings/new
```

NO multi-step onboarding wizard for personal sellers. They list, they sell. Business upgrade, store subscription, and crosslister come later through sidebar CTAs and the subscription page.

---

## 7. Staff Context Switching

When a staff member (via `DelegatedAccess`) accesses the hub:

```typescript
type StaffContext = {
  ownUserId: string;            // Staff member's own user ID
  actingAsUserId: string;       // The seller they're managing
  actingAsSellerId: string;     // The seller's SellerProfile ID
  scopes: string[];             // Delegated scopes
};
```

**Rules:**
- Staff see ONLY the seller sections they have scopes for
- Staff NEVER see the owner's buyer sections (Shopping, Messages as buyer)
- Staff actions are audited with `actorUserId` (staff) + `onBehalfOfSellerId` (owner)
- Staff cannot modify their own delegation
- Staff can switch back to their own account via topbar context switcher
- Topbar shows: "Acting as: [Seller Name] ▼" with dropdown to switch back

---

## 8. What Each User Type Sees

### Pure Buyer

```
MY HUB
  Dashboard (buying widgets)
  ── SHOPPING ──
    Purchases, Offers Sent, Watchlist, Saved Searches, My Reviews, Following
  ── MESSAGES ──
    Inbox
  ── SETTINGS ──
    Account, Addresses, Security, Notifications
  ── HELP ──
    Help Center, Contact Support, My Cases
  ─────────
  [Start Selling]
```

### Personal Seller (no store, no crosslister)

```
MY HUB
  Dashboard (selling + buying widgets)
  ── SHOPPING ──
    (same as buyer)
  ── SELLING ──
    Listings, Orders, Offers, Returns, Shipping Profiles, Promotions
    ── FINANCE ──
      Overview, Transactions, Payouts
    Analytics, Subscription
  ── MESSAGES ──
    Inbox
  ── SETTINGS ──
    (same as buyer)
  ── HELP ──
    (same as buyer)
  ─────────
  [Try Crosslister →]
  [Open a Store →]
```

### Business Seller with Store + Crosslister (Full)

```
MY HUB
  Dashboard (selling + buying widgets)
  ── SHOPPING ──
    (same as buyer)
  ── SELLING ──
    Listings, Orders, Offers, Returns, Shipping Profiles, Promotions
    ── CROSSLISTER ──
      Platforms, Import, Automation
    ── STORE ──
      Branding, Page Builder, Staff
    ── FINANCE ──
      Overview, Transactions, Payouts
    Analytics, Subscription
  ── MESSAGES ──
    Inbox
  ── SETTINGS ──
    (same as buyer)
  ── HELP ──
    (same as buyer)
```

### Staff Member (scoped to listings + orders only)

```
MY HUB
  Dashboard (seller KPIs only, no buying)
  ── SELLING ──
    Listings, Orders
  ── MESSAGES ──
    Inbox
  ─────────
  "Acting as: VintageFinds ▼" in topbar
```

---

## 9. Convenience Redirects

| Shortcut | Redirects To | Code |
|----------|-------------|------|
| `/sh` | `/my/selling` | 308 |
| `/sh/*` | `/my/selling/*` | 308 |
| `/seller` | `/my/selling` | 308 |
| `/seller/*` | `/my/selling/*` | 308 |
| `/m` | `/my/messages` | 308 |
| `/m/[id]` | `/my/messages/[id]` | 308 |
| `/my/buying` | `/my` | 308 |

---

## 10. Mobile Responsive Behavior

### Desktop (≥ 1280px)
- Full sidebar visible (always expanded, 256px)
- Content fills remaining width

### Tablet (768–1279px)
- Sidebar collapsed to icon-only rail (expandable on hover/click)
- Content fills remaining width

### Mobile (< 768px)
- Sidebar hidden (hamburger menu → slide-over drawer)
- Bottom navigation bar with 5 key actions:

| Slot | Non-Seller | Seller |
|------|-----------|--------|
| 1 | Dashboard | Dashboard |
| 2 | Purchases | Orders (to ship) |
| 3 | Start Selling | Listings |
| 4 | Messages | Messages |
| 5 | Profile | Profile |

---

## 11. Theme

The hub uses the same `next-themes` provider as the marketplace:
- Light/dark toggle in the topbar
- Respects system preference by default
- Single cookie `theme` shared across all shells
- Tailwind dark mode variants throughout
- Brand accent: `#7C3AED` (Deep Amethyst) for "My Hub" header and active states

---

## 12. What This Canonical Does NOT Cover

- **Corp Admin UI** — separate shell at `hub.twicely.co`, separate canonical
- **Helpdesk UI** — separate shell at `hub.twicely.co/hd/*`, separate canonical
- **Public marketplace pages** — browse, search, listing detail, checkout — separate layout
- **Storefront pages** — `/st/*` public store pages — separate layout
- **Backend services** — server actions, business logic, state machines — domain canonicals
- **API contracts** — covered by domain canonicals

This canonical governs the **user-facing hub shell**: persistent layout, sidebar navigation, capability gates, route structure, and responsive behavior.

---

## 13. Completion Criteria

The Unified User Hub ("My Hub") is complete when:
- [ ] Single layout at `src/app/(marketplace)/my/layout.tsx` with persistent shell
- [ ] `getUserCapabilities()` reads isSeller, sellerType, storeTier, listerTier, hasAutomation, delegation
- [ ] `filterHubNav()` shows/hides sections based on capabilities + staff scopes
- [ ] Sub-group rendering works (Crosslister, Store, Finance nest under Selling)
- [ ] Pure buyer sees: Dashboard, Shopping, Messages, Settings, Help + "Start Selling" CTA
- [ ] Personal seller sees: above + Selling (with Finance, Analytics, Subscription) + upsell CTAs
- [ ] Business seller with store sees: above + Store sub-group
- [ ] Crosslister subscriber sees: Crosslister sub-group under Selling
- [ ] Full seller sees: all sections including Crosslister + Store + Finance
- [ ] Staff member sees: only scoped sections, no buyer sections, context banner
- [ ] Dashboard is configurable (buyer-first or seller-first priority)
- [ ] "Start Selling" activation works for non-sellers (no wizard, immediate)
- [ ] Bottom CTAs show contextual upsells (Crosslister, Store)
- [ ] `/m` redirects to `/my/messages` (308)
- [ ] `/sh/*` and `/seller/*` redirect to `/my/selling/*` (308)
- [ ] `/my/buying` redirects to `/my` (308)
- [ ] Mobile responsive: bottom nav on < 768px, icon rail on tablet, full sidebar on desktop
- [ ] Theme toggle works (light/dark)
- [ ] Sidebar header says "My Hub" in brand accent color
- [ ] Marketplace nav link says "My Hub"

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-20 | Initial V3 lock. Adapted from V2 unified hub with: three-axis subscription model (StoreTier + ListerTier + Automation), crosslister nested under selling as sub-group, messages moved from `/m` to `/my/messages` (inside hub shell), "My Hub" branding, configurable dashboard priority (buyer-first or seller-first), sub-group sidebar rendering with `parent` field, mobile bottom nav, convenience redirects. |

---

# END CANONICAL
