---
name: I17 Admin Sidebar Final Update Findings
description: Gap analysis for admin-nav.ts — 15 new items, 3 restructures, 2 new groups, dispute rules URL discrepancy
type: project
---

## I17 Admin Sidebar Final Update

**Prompt written:** 2026-03-20
**File:** `.claude/install-prompts/I17-admin-sidebar-final-update.md`

### Key Findings
- admin-nav.ts is already 363 lines (over 300-line limit) — acceptable for registry data
- 15 new nav items to add, 3 groups to restructure (users/analytics/categories → collapsible), 1 item to remove (standalone affiliates)
- 2 new top-level groups: trust-safety (I7), promotions (I9)
- 5 missing icons in admin-sidebar ICON_MAP: Store, TrendingUp, EyeOff, Grid, Lock
- No existing test file for admin-nav — creating new `src/lib/hub/__tests__/admin-nav.test.ts`

### URL Discrepancy
- Dispute rules page at `src/app/(hub)/mod/disputes/disputes/rules/page.tsx` — double `disputes` in path, resulting URL is `/mod/disputes/disputes/rules` not `/mod/disputes/rules`

### NAV_ENTRY Comments
- Many I-phase pages have `// NAV_ENTRY:` comments on line 1 documenting their intended nav entry
- Pattern: `// NAV_ENTRY: { label: '...', href: '...', icon: '...', roles: [...] }`
- Some mark themselves as sub-pages: `// NAV_ENTRY (sub-page, no nav entry needed)`

### Pages NOT in Nav (Correct — detail/create pages)
- `/usr/[id]`, `/usr/new`, `/categories/[id]`, `/categories/new`
- `/fin/payouts/[id]`, `/fin/chargebacks/[id]`
- `/trust/sellers/[id]`, `/promotions/[id]`, `/promotions/new`
- `/notifications/[id]`, `/notifications/new`
- `/mod/listings/[id]`, `/mod/reviews/[id]`, `/mod/reports/[id]`
- `/health/[id]`, `/flags/[id]`
- `/cfg/data-retention/anonymize`, `/cfg/data-retention/exports`
- `/cfg/providers/mappings/new`, `/roles/staff/new`, `/kb/[id]/edit`
