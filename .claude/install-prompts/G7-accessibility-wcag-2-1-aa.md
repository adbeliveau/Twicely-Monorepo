# [G7] Accessibility (WCAG 2.1 AA Compliance)

**One-line Summary:** Make the entire Twicely V3 codebase WCAG 2.1 AA compliant by adding skip navigation, ARIA attributes, focus management, reduced motion support, screen reader announcements, semantic landmarks, and touch target enforcement across all layouts, components, and pages.

**Canonical Sources (READ ALL BEFORE STARTING):**
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` section 34 (Accessibility requirements)
- `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` section 16.1 (accessibility.enforceMinContrast)
- `TWICELY_V3_PAGE_REGISTRY.md` (all routes and layouts)
- `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` (hub keyboard shortcuts)
- `TWICELY_V3_TESTING_STANDARDS.md` (testing patterns)
- `CLAUDE.md` (build rules, tech stack, vocabulary)

---

## PREREQUISITES

- Phases A through G6, G8, G9 are all COMPLETE
- All 6 layouts exist: marketplace, dashboard (my hub), checkout, auth, admin hub, helpdesk, storefront
- 185 page.tsx files, 401 non-test component files exist
- shadcn/ui components (24 total) are installed with Radix UI primitives (Dialog, DropdownMenu, Sheet, etc. already have ARIA built in)
- `tw-animate-css` is installed (no reduced-motion handling)
- `axe-core` is referenced in pnpm-lock.yaml (available for testing)
- Sonner (toast library) is configured in root layout

---

## SCOPE OVERVIEW

This is a POLISH step. The goal is maximum accessibility impact with minimal structural changes. The codebase already has some good a11y foundations:
- shadcn/ui components use Radix UI primitives (built-in ARIA for Dialog, DropdownMenu, Sheet, etc.)
- Most images have `alt` attributes (46 files use `alt=`)
- Auth forms have `htmlFor`/`id` label associations
- Admin sidebar uses `aria-current="page"`, `aria-disabled="true"`, `aria-hidden="true"`
- NotificationBell uses `sr-only` text
- Image gallery thumbnails use `aria-label` and `aria-current`
- Cookie consent banner uses `role="dialog"` and `aria-label`
- Buttons have `focus-visible:ring` via shadcn defaults
- Hub topbar hamburger has `sr-only` text

**Missing (what this step adds):**
- No skip navigation link anywhere
- No `aria-live` regions for dynamic content (notification count, search results count, toast announcements)
- No `prefers-reduced-motion` handling (tw-animate-css does NOT include it)
- No landmark roles on layouts (no `role="navigation"`, `role="banner"`, `role="contentinfo"`)
- No `aria-label` on most `<nav>` elements (multiple navs per page but no distinguishing labels)
- Error alerts in auth forms lack `role="alert"` and `aria-live="assertive"`
- Search bar missing `role="search"` on form
- Many icon-only buttons missing `aria-label` / `sr-only` text
- No heading level audit (h1 then h3, skipping h2 in some pages)
- `outline-none` used on auth form inputs without `focus-visible` replacement
- Touch targets on some elements below 44x44px minimum
- No `aria-describedby` linking form errors to their inputs
- Notification unread indicator is color-only (blue dot) with no text alternative
- Admin sidebar collapsible sections missing `aria-expanded`

---

## SUB-STEPS

This feature is decomposed into 4 sub-steps. Execute them in order.

### G7.1 — Global Infrastructure (Skip Nav, Reduced Motion, Landmarks, Announcer)
### G7.2 — Layout & Navigation Accessibility (All 6 Layouts)
### G7.3 — Component-Level Accessibility (Forms, Modals, Interactive Widgets)
### G7.4 — Page-Level Audit & Platform Setting Seed

---

## G7.1 — GLOBAL INFRASTRUCTURE

### What to Build

#### 1. Skip Navigation Component

**Create:** `src/components/shared/skip-nav.tsx`

A visually-hidden link that becomes visible on focus. Must be the FIRST focusable element in every layout. Follows the spec: "Skip to main content" link as first focusable element on every page.

```
Component: SkipNav
- Renders <a href="#main-content"> with text "Skip to main content"
- Visually hidden by default (sr-only equivalent)
- On focus: becomes visible, positioned fixed at top-left, high z-index (z-[100])
- Styling: bg-background text-foreground px-4 py-2 font-medium text-sm rounded-md shadow-lg border
- When activated: scrolls to and focuses element with id="main-content"
- Must be a plain <a>, not a Button component (needs to work before JS loads)
```

#### 2. Live Region Announcer

**Create:** `src/components/shared/route-announcer.tsx`

A client component that announces route changes to screen readers using Next.js `usePathname()`.

```
Component: RouteAnnouncer
- Uses aria-live="assertive" and role="status"
- Visually hidden (sr-only positioning)
- On route change (usePathname()), announces the new page title
- Gets title from document.title after a small delay (100ms) to let Next.js update <title>
- Renders a <div> with the announcement text
```

#### 3. Reduced Motion CSS

**Modify:** `src/app/globals.css`

Add a `@media (prefers-reduced-motion: reduce)` block at the end of the file. This addresses the spec requirement: "`prefers-reduced-motion` media query respected. Animations/transitions disabled when user has reduced motion preference."

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Note:** Using 0.01ms (not 0s) so that animation-end events still fire and Radix UI state transitions work correctly.

#### 4. Root Layout Updates

**Modify:** `src/app/layout.tsx`

Add the RouteAnnouncer as a sibling to Toaster inside `<body>`.

---

## G7.2 — LAYOUT & NAVIGATION ACCESSIBILITY

### Marketplace Layout (`src/app/(marketplace)/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child inside the outer `<div>`
2. Add `id="main-content"` to the `<main>` element
3. Add `tabIndex={-1}` to `<main>` (allows programmatic focus for skip nav)

### Marketplace Header (`src/components/shared/marketplace-header.tsx`)

**Changes:**
1. Wrap entire header in landmark: add `role="banner"` (already `<header>`, but explicit is safer for older screen readers)
2. Add `aria-label="Main navigation"` to the `<nav>` element
3. Logo link: add `aria-label="Twicely home"` to the Logo link (currently just text "Twicely")

### Marketplace Footer (`src/components/shared/marketplace-footer.tsx`)

**Changes:**
1. Add `role="contentinfo"` to `<footer>` (already semantic, but explicit for older readers)
2. Add `aria-label="Footer navigation"` to the implicit nav (the grid of links)
3. Wrap the link grid in a `<nav aria-label="Footer navigation">` element

### Mobile Bottom Nav (`src/components/shared/mobile-bottom-nav.tsx`)

**Changes:**
1. Add `aria-label="Mobile navigation"` to `<nav>`
2. Add `aria-current="page"` to active link (currently only styled, not announced)
3. Ensure each icon has `aria-hidden="true"` (text label is the accessible name)

### Search Bar (`src/components/shared/search-bar.tsx`)

**Changes:**
1. Add `role="search"` to `<form>`
2. Add `aria-label="Search listings"` to `<form>`
3. Add a visually-hidden `<label>` for the search input (currently has placeholder but no label). Use `<label htmlFor="search-input" className="sr-only">Search for items</label>` and `id="search-input"` on the Input.
4. Add `aria-label="Search"` to the search icon or mark it `aria-hidden="true"` (it's decorative)

### Hub Layout (`src/app/(hub)/my/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child inside outer `<div>`
2. Add `id="main-content"` and `tabIndex={-1}` to `<main>`

### Hub Sidebar (`src/components/hub/hub-sidebar.tsx`)

**Changes:**
1. Add `aria-label="User hub navigation"` to `<nav>`
2. Add `role="navigation"` to `<aside>` (already semantic, but explicit)
3. Section headings (the `<p>` tags with uppercase text): change to proper heading elements or add `role="heading" aria-level="2"` (they currently use `<p>` which screen readers cannot navigate)
4. Add `aria-current="page"` to active NavLink items

### Hub Bottom Nav (`src/components/hub/hub-bottom-nav.tsx`)

**Changes:**
1. Add `aria-label="Hub mobile navigation"` to `<nav>`
2. Add `aria-current="page"` to active NavItem
3. Add `aria-hidden="true"` to all icons (text labels serve as accessible names)

### Hub Topbar (`src/components/hub/hub-topbar.tsx`)

**Changes:**
1. The hamburger button already has `sr-only` -- good, verify it stays
2. If user avatar div (no image) has no accessible name: add `aria-label` with user name
3. The `<header>` needs no changes (semantic already)

### Admin Hub Layout (`src/app/(hub)/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` before `<AdminSidebar>` (inside the hub shell `<div>`)
2. Add `id="main-content"` and `tabIndex={-1}` to `<main>`

### Admin Sidebar (`src/components/admin/admin-sidebar.tsx`)

**Changes:**
1. Add `aria-label="Admin navigation"` to `<nav>`
2. `CollapsibleNavItem` button: add `aria-expanded={open}` and `aria-controls` pointing to the child `<ul>` id
3. Add `id` to the child `<ul>` for `aria-controls` reference (e.g., `id={`admin-nav-${item.key}`}`)
4. Chevron icons: add `aria-hidden="true"`

### Checkout Layout (`src/app/(checkout)/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child inside outer `<div>`
2. Add `id="main-content"` and `tabIndex={-1}` to `<main>`
3. Logo link: add `aria-label="Twicely home"`

### Storefront Layout (`src/app/(storefront)/st/[slug]/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child inside outer `<div>`
2. Add `id="main-content"` and `tabIndex={-1}` to `<main>`

### Auth Layout (`src/app/auth/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child
2. Wrap children in or add `id="main-content"` and `tabIndex={-1}` to the main content area

### Helpdesk Layout (`src/app/(helpdesk)/layout.tsx` and `src/app/(helpdesk)/hd/layout.tsx`)

**Changes:**
1. Add `<SkipNav />` as first child
2. Add `id="main-content"` and `tabIndex={-1}` to main content area

---

## G7.3 — COMPONENT-LEVEL ACCESSIBILITY

### Auth Forms — Error Announcements

**Modify:** `src/app/auth/login/page.tsx`

1. Error div: add `role="alert"` and `aria-live="assertive"` so screen readers announce errors immediately
2. Replace `focus:outline-none focus:ring-2 focus:ring-ring` on native `<input>` elements with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (must use `focus-visible` not `focus` to preserve keyboard focus indicator while hiding it for mouse clicks)
3. Add `aria-describedby="login-error"` on the form when error is present, and `id="login-error"` on the error div

**Modify:** `src/app/auth/signup/page.tsx`

1. Same error announcement pattern: `role="alert"` + `aria-live="assertive"` on error div
2. Same `focus:outline-none` to `focus-visible:outline-none` replacement on all native inputs
3. Add `aria-describedby` linking password hint text to password input

**Modify:** `src/app/auth/reset-password/page.tsx`

1. Same error pattern
2. Same focus-visible fix

**Modify:** `src/app/auth/forgot-password/page.tsx`

1. Same error pattern
2. Same focus-visible fix

### Notification Bell (`src/components/shared/notification-bell.tsx`)

**Changes:**
1. Unread count badge: add `aria-label` to the badge span (e.g., `aria-label="${unreadCount} unread notifications"`) -- currently the dot/count is visual only
2. The "Mark all read" button: ensure minimum touch target (add `min-h-[44px] min-w-[44px]` or `p-2` padding)

### Listing Card (`src/components/shared/listing-card.tsx`)

**Changes:**
1. The card is a `<Link>` wrapping everything. Screen readers will read the entire card content. Add an `aria-label` to the Link that summarizes: `aria-label="${listing.title}, ${formatPrice(listing.priceCents)}, ${listing.condition}"`
2. "Free Shipping" badge: add `role="status"` (it's informational)
3. Seller rating badge inside the card: mark decorative stars `aria-hidden="true"` if not already

### Image Gallery (`src/components/pages/listing/image-gallery.tsx`)

**Already good:** thumbnails have `aria-label` and `aria-current`. No changes needed.

### Listing Info (`src/components/pages/listing/listing-info.tsx`)

**Changes:**
1. The `<dl>` description list is correctly semantic -- good
2. Alert icons in local pickup requirements: add `aria-hidden="true"` to `<AlertTriangle>` icons (the text conveys the meaning)

### Star Rating (`src/components/pages/review/star-rating.tsx`)

**Already good:** Each star button has `aria-label`. Focus ring present. No changes needed.

### Listing Form (`src/components/pages/listing/listing-form.tsx`)

**Changes (carefully -- file is 298 lines, near the 300 limit):**
1. No structural changes to listing-form.tsx itself
2. Ensure child components (PriceInput, ShippingSection, etc.) have proper label associations -- spot check these

### Sonner/Toaster Accessibility

**Modify:** `src/app/layout.tsx`

The Sonner `<Toaster>` component: verify it passes `role` and `aria-live` correctly. Sonner v2+ handles this internally. If needed, add `toastOptions={{ role: 'status' }}` prop. The spec says: "ARIA live regions for dynamic content."

### Cookie Consent Banner (`src/components/cookie-consent-banner.tsx`)

**Already good:** Has `role="dialog"` and `aria-label="Cookie consent"`. Labels associated with switches via `htmlFor`. No changes needed.

### Empty States & Loading Skeletons

**Verify:** Loading skeletons (homepage `CardSkeleton`) should have `aria-busy="true"` on the container and `aria-label="Loading"` so screen readers announce loading state.

**Modify:** `src/app/(marketplace)/page.tsx`
1. Add `aria-busy="true"` and `aria-label="Loading listings"` to the CardSkeleton section wrapper

### Data Tables (`src/components/admin/data-table.tsx`)

**Changes:**
1. Verify `<table>` has `role="table"` (native HTML table already has this)
2. Add `aria-label` or `<caption>` describing the table contents
3. Ensure sortable column headers use `aria-sort` attribute

---

## G7.4 — PAGE-LEVEL AUDIT & PLATFORM SETTING SEED

### Platform Setting

**Modify:** `src/lib/db/seed/v32-platform-settings-extended.ts`

Add the `accessibility.enforceMinContrast` setting (specified in Feature Lock-in section 34 and Platform Settings Canonical section 16.1):

```typescript
{
  key: 'accessibility.enforceMinContrast',
  value: 'true',
  type: 'boolean',
  category: 'accessibility',
  label: 'Enforce minimum contrast ratio for store themes',
  description: 'Prevents publishing themes/colors that fail WCAG AA contrast checks',
  editable: true,
}
```

### Heading Hierarchy Audit

The installer must audit the following critical pages and fix heading levels that skip (e.g., h1 then h3 with no h2). The fix is simple: change the heading level, not the visual style. Use Tailwind text classes to maintain visual appearance while fixing semantic levels.

**Pages to audit (highest traffic, highest impact):**
1. Homepage (`src/app/(marketplace)/page.tsx`) -- h1 "Buy and sell secondhand. Better.", then h2 sections
2. Listing detail (`src/app/(marketplace)/i/[slug]/page.tsx`) -- h1 title, h2 "Description", h2 "Recent Reviews", etc.
3. Search results (`src/app/(marketplace)/s/page.tsx`)
4. Store pages (`src/app/(storefront)/st/[slug]/page.tsx`)
5. Cart (`src/app/(marketplace)/cart/page.tsx`)
6. Selling layout (`src/app/(hub)/my/selling/layout.tsx`) -- h1 "Start selling on Twicely", h3 below (WRONG -- should be h2)

**Fix pattern:** If h3 appears after h1 with no h2, change h3 to h2. If visual size needs to stay small, add Tailwind class (e.g., `<h2 className="text-base font-medium">` instead of `<h3 className="font-medium">`).

### Error Pages

**Modify:** `src/app/error.tsx`
1. Add `role="alert"` to the container div

**Modify:** `src/app/not-found.tsx`
1. No changes needed (h1 present, links have text)

### Selling Layout Heading Fix

**Modify:** `src/app/(hub)/my/selling/layout.tsx`
1. Change `<h3 className="font-medium">` elements (lines ~63, ~69, ~75) to `<h2 className="text-base font-medium">`

---

## CONSTRAINTS -- WHAT NOT TO DO

1. **DO NOT refactor any component structure** -- this is an overlay/enhancement pass only
2. **DO NOT change any business logic, routes, or data flow**
3. **DO NOT add new npm dependencies** -- axe-core is already available; use native ARIA attributes
4. **DO NOT modify shadcn/ui component source files** (button.tsx, dialog.tsx, input.tsx, etc.) unless fixing a specific a11y defect found during implementation. These already have good Radix UI accessibility primitives.
5. **DO NOT exceed 300 lines on any file** -- split if needed
6. **DO NOT add `aria-label` to elements that already have visible text labels** -- redundant labels confuse screen readers
7. **DO NOT use `role` attributes on semantic HTML elements that already have implicit roles** (e.g., `role="button"` on `<button>` is redundant). Exception: `role="navigation"` on `<aside>` for admin sidebar is acceptable since `<aside>` has implicit "complementary" role, not "navigation".
8. **DO NOT add `tabindex="0"` to non-interactive elements** -- only interactive elements should be focusable
9. **Use `tabIndex={-1}`** (not `tabIndex={0}`) on main content targets for skip-nav -- they should be programmatically focusable but not in natural tab order

---

## ACCEPTANCE CRITERIA

### Skip Navigation
- [ ] Every page has a "Skip to main content" link as the FIRST focusable element
- [ ] Pressing Tab from a fresh page load reveals the skip link
- [ ] Activating the skip link moves focus to the main content area
- [ ] The skip link is visually hidden until focused

### Keyboard Navigation
- [ ] All interactive elements (buttons, links, form controls, dropdown triggers) are reachable via Tab
- [ ] No keyboard traps exist (user can always Tab out of any component)
- [ ] Admin sidebar collapsible sections respond to Enter/Space and announce expanded/collapsed state
- [ ] Image gallery thumbnails are navigable via Tab and activatable via Enter/Space

### ARIA & Screen Reader
- [ ] Auth form errors are announced immediately to screen readers (role="alert", aria-live="assertive")
- [ ] Search bar form has `role="search"` and the input has an associated label (even if visually hidden)
- [ ] All `<nav>` elements have distinguishing `aria-label` attributes
- [ ] All icon-only buttons have either `aria-label` or `sr-only` text
- [ ] Notification bell badge announces count to screen readers
- [ ] Route changes are announced to screen readers via the RouteAnnouncer

### Focus Indicators
- [ ] No `outline: none` without a `focus-visible` replacement (auth form inputs fixed)
- [ ] All focus indicators use Tailwind's `ring` utilities (consistent with shadcn defaults)
- [ ] Focus indicators are visible on all interactive elements

### Reduced Motion
- [ ] `prefers-reduced-motion: reduce` media query is present in globals.css
- [ ] All animations and transitions are effectively disabled when user prefers reduced motion
- [ ] Radix UI state transitions still work (animation-end events fire with 0.01ms duration)

### Landmarks & Semantics
- [ ] Every layout has a `<main>` with `id="main-content"`
- [ ] No heading levels are skipped (h1 > h2 > h3, never h1 > h3)
- [ ] Footer is a `<footer>` element (already is)
- [ ] Header is a `<header>` element (already is)

### Touch Targets
- [ ] All interactive elements meet 44x44px minimum touch target size (verify via visual inspection on mobile viewport)
- [ ] NotificationBell "Mark all read" button meets minimum touch target

### Error States
- [ ] Form errors include icon + text (never color alone) -- verify existing pattern in auth forms
- [ ] Error containers have `role="alert"`

### Platform Setting
- [ ] `accessibility.enforceMinContrast` is seeded with value `true`, type `boolean`, category `accessibility`

### Vocabulary & Tech Stack
- [ ] No banned terms appear in any new or modified code
- [ ] No banned tech stack items referenced
- [ ] All routes use correct prefixes

---

## TEST REQUIREMENTS

### Unit Tests

**Create:** `src/components/shared/__tests__/skip-nav.test.ts`

```
describe('SkipNav', () => {
  it('renders a link with href="#main-content"')
  it('has text "Skip to main content"')
  it('has sr-only positioning classes by default')
  it('becomes visible on focus (has focus: override classes)')
})
```

**Create:** `src/components/shared/__tests__/route-announcer.test.ts`

```
describe('RouteAnnouncer', () => {
  it('renders with aria-live="assertive" and role="status"')
  it('is visually hidden (sr-only)')
  it('updates announcement text when pathname changes')
})
```

**Create:** `src/lib/__tests__/accessibility-audit.test.ts`

```
describe('Accessibility audit - static checks', () => {
  it('globals.css contains prefers-reduced-motion media query')
  it('all layout files contain skip-nav import')
  it('all layout main elements have id="main-content"')
  it('accessibility.enforceMinContrast platform setting is seeded')
})
```

### Integration Tests

No new integration tests needed -- this is a UI-only pass. Existing tests must continue passing (baseline: 6718 tests).

### Edge Cases

- Verify skip nav works in ALL 6+ layout groups (marketplace, hub, admin hub, checkout, auth, storefront, helpdesk)
- Verify reduced motion CSS does not break Radix UI dialog open/close transitions
- Verify RouteAnnouncer does not fire on initial page load (only on navigation)

---

## FILE APPROVAL LIST

### New Files (3)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/components/shared/skip-nav.tsx` | Skip-to-main-content link component (~25 lines) |
| 2 | `src/components/shared/route-announcer.tsx` | Screen reader route change announcer (~40 lines) |
| 3 | `src/components/shared/__tests__/skip-nav.test.ts` | Tests for skip nav component (~30 lines) |
| 4 | `src/components/shared/__tests__/route-announcer.test.ts` | Tests for route announcer (~40 lines) |
| 5 | `src/lib/__tests__/accessibility-audit.test.ts` | Static accessibility audit checks (~50 lines) |

### Modified Files (25-30)

| # | File Path | Changes |
|---|-----------|---------|
| 6 | `src/app/globals.css` | Add prefers-reduced-motion media query (~7 lines) |
| 7 | `src/app/layout.tsx` | Add RouteAnnouncer component |
| 8 | `src/app/(marketplace)/layout.tsx` | Add SkipNav, id="main-content" + tabIndex on main |
| 9 | `src/app/(hub)/my/layout.tsx` | Add SkipNav, id="main-content" + tabIndex on main |
| 10 | `src/app/(hub)/layout.tsx` | Add SkipNav, id="main-content" + tabIndex on main |
| 11 | `src/app/(checkout)/layout.tsx` | Add SkipNav, id="main-content" + tabIndex on main |
| 12 | `src/app/auth/layout.tsx` | Add SkipNav, id="main-content" + tabIndex |
| 13 | `src/app/(storefront)/st/[slug]/layout.tsx` | Add SkipNav, id="main-content" + tabIndex on main |
| 14 | `src/app/(helpdesk)/layout.tsx` | Add SkipNav, id="main-content" + tabIndex |
| 15 | `src/app/(helpdesk)/hd/layout.tsx` | Add id="main-content" + tabIndex if main exists here |
| 16 | `src/components/shared/marketplace-header.tsx` | aria-label on nav |
| 17 | `src/components/shared/marketplace-footer.tsx` | Wrap links in nav with aria-label |
| 18 | `src/components/shared/mobile-bottom-nav.tsx` | aria-label on nav, aria-current on active link, aria-hidden on icons |
| 19 | `src/components/shared/search-bar.tsx` | role="search", sr-only label, aria-hidden on search icon |
| 20 | `src/components/hub/hub-sidebar.tsx` | aria-label on nav, aria-current on active links |
| 21 | `src/components/hub/hub-bottom-nav.tsx` | aria-label on nav, aria-current, aria-hidden on icons |
| 22 | `src/components/hub/hub-topbar.tsx` | aria-label on avatar fallback div |
| 23 | `src/components/admin/admin-sidebar.tsx` | aria-expanded + aria-controls on collapsible sections, id on child ul |
| 24 | `src/components/shared/notification-bell.tsx` | aria-label on unread count badge |
| 25 | `src/components/shared/listing-card.tsx` | aria-label on link with summary text |
| 26 | `src/app/auth/login/page.tsx` | role="alert" on error, focus-visible fix on inputs |
| 27 | `src/app/auth/signup/page.tsx` | role="alert" on error, focus-visible fix on inputs, aria-describedby on password hint |
| 28 | `src/app/auth/reset-password/page.tsx` | role="alert" on error, focus-visible fix |
| 29 | `src/app/auth/forgot-password/page.tsx` | role="alert" on error, focus-visible fix |
| 30 | `src/app/(marketplace)/page.tsx` | aria-busy on skeleton fallbacks |
| 31 | `src/app/(hub)/my/selling/layout.tsx` | Fix h3 to h2 heading hierarchy |
| 32 | `src/app/error.tsx` | Add role="alert" |
| 33 | `src/components/pages/listing/listing-info.tsx` | aria-hidden on decorative AlertTriangle icons |
| 34 | `src/lib/db/seed/v32-platform-settings-extended.ts` | Seed accessibility.enforceMinContrast setting |

---

## VERIFICATION CHECKLIST

After implementation, run all of these:

### 1. Lint Script
```bash
./twicely-lint.sh
```
Paste FULL raw output. Must show 0 TypeScript errors, 0 banned terms, 0 files over 300 lines.

### 2. Test Suite
```bash
pnpm test
```
Must show >= 6718 tests passing (baseline). New tests add to this count.

### 3. TypeScript Check
```bash
pnpm typecheck
```
Must show 0 errors.

### 4. Skip Nav Verification
Manually verify (or describe how to verify) that:
- Loading any page and pressing Tab reveals the skip link
- The skip link text reads "Skip to main content"
- All 6+ layouts include the skip link

### 5. Reduced Motion Verification
Verify `globals.css` contains the `@media (prefers-reduced-motion: reduce)` block.

### 6. ARIA Verification
Run a search for all `<nav>` elements in layouts and verify each has a unique `aria-label`:
```bash
grep -rn "aria-label" src/components/shared/marketplace-header.tsx src/components/shared/marketplace-footer.tsx src/components/shared/mobile-bottom-nav.tsx src/components/hub/hub-sidebar.tsx src/components/hub/hub-bottom-nav.tsx src/components/admin/admin-sidebar.tsx
```

### 7. Error Alert Verification
```bash
grep -rn 'role="alert"' src/app/auth/ src/app/error.tsx
```
Should match all 4 auth pages + error.tsx.

### 8. File Count & Test Count Report
Report: files created, files modified, new test count, total test count.

---

## WCAG 2.1 AA CRITERIA ADDRESSED

| WCAG SC | Title | How Addressed |
|---------|-------|---------------|
| 1.1.1 | Non-text Content | alt text on images (existing), aria-label on icon buttons (new) |
| 1.3.1 | Info and Relationships | Semantic headings, landmarks, label associations, description lists |
| 1.3.2 | Meaningful Sequence | Logical DOM order maintained (no CSS order tricks) |
| 1.3.6 | Identify Purpose | Landmarks (nav, main, banner, contentinfo), role="search" |
| 1.4.3 | Contrast (Minimum) | Platform setting enforceMinContrast for store themes (audit existing colors separately) |
| 1.4.4 | Resize Text | Existing: Tailwind responsive + relative units (verify no break at 200%) |
| 1.4.11 | Non-text Contrast | Focus rings (3:1 against background) via Tailwind ring utilities |
| 2.1.1 | Keyboard | All interactive elements reachable via Tab, no keyboard traps |
| 2.1.2 | No Keyboard Trap | Radix UI primitives handle focus trapping in modals correctly |
| 2.4.1 | Bypass Blocks | Skip navigation link |
| 2.4.2 | Page Titled | Already present (Next.js Metadata API) |
| 2.4.3 | Focus Order | Logical tab order (DOM order = visual order) |
| 2.4.4 | Link Purpose | Descriptive link text + aria-labels on listing cards |
| 2.4.6 | Headings and Labels | Heading hierarchy audit, form label associations |
| 2.4.7 | Focus Visible | focus-visible ring on all interactive elements |
| 2.5.5 | Target Size (AAA, but specified) | 44x44px minimum touch targets |
| 3.2.2 | On Input | No unexpected context changes on input |
| 3.3.1 | Error Identification | role="alert" + icon + text for form errors |
| 3.3.2 | Labels or Instructions | All form inputs have associated labels |
| 4.1.2 | Name, Role, Value | ARIA attributes on custom widgets (collapsible nav, notification badge) |
| 4.1.3 | Status Messages | aria-live regions for errors, route changes, loading states |

---

## SPEC INCONSISTENCIES

1. **Feature Lock-in section 34** says "axe-core integrated into CI pipeline" but no CI workflow exists for it yet. This install prompt covers the component/page-level fixes; CI integration of axe-core is deferred to G10 (Production Readiness) which handles CI/CD pipeline.

2. **Feature Lock-in section 34** says "VoiceOver (macOS/iOS) testing on key flows" -- this is manual QA, not automatable. Document as post-implementation manual testing requirement.

---

## WHAT IS NOT IN SCOPE FOR G7

The following are explicitly out of scope to keep this step focused:

1. **Color contrast audit of all color combinations** -- this requires visual tooling (Chrome DevTools Contrast Checker or axe-core scan). The platform setting is seeded; actual color verification is manual QA.
2. **CI pipeline integration of axe-core** -- deferred to G10 (Production Readiness)
3. **Comprehensive heading hierarchy fix across all 185 pages** -- only the 6 highest-traffic pages are audited. Remaining pages follow the same pattern and can be fixed incrementally.
4. **Screen reader testing with VoiceOver/NVDA** -- manual QA activity, not an implementation task
5. **RTL support** -- not specified in the canonicals
6. **Dark mode contrast verification** -- the dark mode theme variables exist but verifying contrast ratios is manual QA
7. **Custom keyboard shortcuts for hub** -- already specified in Feature Lock-in section 10 and would be a separate hub-specific step
