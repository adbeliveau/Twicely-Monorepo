---
name: G7 Accessibility Findings
description: Codebase accessibility audit results and G7 install prompt details for WCAG 2.1 AA compliance
type: project
---

## G7 Accessibility (WCAG 2.1 AA) — Prompt WRITTEN 2026-03-16

### Existing A11y State (Good)
- shadcn/ui uses Radix primitives (Dialog, DropdownMenu, Sheet — built-in ARIA)
- 46 files have `alt` attributes on images
- Auth forms have `htmlFor`/`id` label associations
- Admin sidebar uses `aria-current="page"`, `aria-disabled`, `aria-hidden`
- NotificationBell has `sr-only` text
- Image gallery thumbnails have `aria-label` and `aria-current`
- Cookie consent banner uses `role="dialog"` + `aria-label`
- shadcn Button has `focus-visible:ring` styles
- Hub topbar hamburger has `sr-only` text

### Missing (What G7 Adds)
- No skip navigation link
- No `aria-live` regions (notifications, search results, route changes)
- No `prefers-reduced-motion` handling (tw-animate-css does NOT include it)
- No landmark `aria-label` on nav elements
- Auth form errors lack `role="alert"`/`aria-live`
- Search bar missing `role="search"`
- Icon-only buttons missing labels
- Heading hierarchy violations (h1 > h3 with no h2 in selling layout)
- `outline-none` used on auth inputs without `focus-visible` replacement
- Notification unread indicator is color-only
- Admin sidebar collapsible sections missing `aria-expanded`

### Key Stats
- 185 page.tsx files, 401 non-test component files
- 24 shadcn/ui components
- 19 files use `sr-only`
- 53 files have `aria-label` or similar
- 1 file has `role="navigation"` (pagination.tsx)
- 0 files have `aria-live`
- 3 files have `prefers-reduced-motion` (all in video components)
- axe-core is in pnpm-lock.yaml but NOT in package.json devDependencies explicitly

### Prompt Structure
- 4 sub-steps: G7.1 (global infra), G7.2 (layouts), G7.3 (components), G7.4 (page audit + seed)
- 5 new files (2 components + 3 tests)
- 25-30 modified files
- 1 platform setting seeded (accessibility.enforceMinContrast)
- ~120 lines of new tests expected

### Spec Source
- Feature Lock-in section 34: all requirements
- Platform Settings Canonical section 16.1: enforceMinContrast
- Build Sequence Tracker: G7 depends on "All UI" (all layouts must exist)

### SPEC INCONSISTENCIES
1. Feature Lock-in says "axe-core integrated into CI pipeline" — no CI workflow for this yet. Deferred to G10.
2. Feature Lock-in says "VoiceOver testing on key flows" — manual QA, not automatable.

**Why:** Accessibility is a compliance requirement. Document defers CI integration to G10.
**How to apply:** When G10 is written, include axe-core CI integration step.
