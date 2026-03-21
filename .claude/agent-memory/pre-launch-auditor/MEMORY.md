# Pre-Launch Auditor Memory

> **DEPRECATED 2026-03-06:** This agent replaced by `/audit` command (Super Audit).
> Memory preserved as historical reference. New audit patterns go in main MEMORY.md.

## Audit #4: 2026-03-04 (Phase D Focused Audit)
- **Verdict**: NOT READY (8 critical, 3 high, 4 medium, 3 low)
- **Focus**: Phase D only (storefronts, subscriptions, delegation, authentication)
- **Biggest pattern**: Delegation non-support (5 files use session.userId directly)
- **Second pattern**: Bare CASL checks (4 files import from @/lib/casl/authorize, skip sub())
- **Third pattern**: Hub mod/disputes pages use marketplace auth instead of staffAuthorize()
- change-subscription.ts uses session.sellerId and session.userId directly (no delegation)
- seller-listings.ts, shipping-profiles.ts, shipping-profile-manage.ts, payout-settings.ts all use session.userId without delegation
- authentication.ts, authentication-complete.ts, seller-response.ts import from @/lib/casl/authorize (not @/lib/casl barrel)
- storefront.ts:updateStoreCategories drops category slug field on insert

## Audit #3: 2026-03-03 (Full Codebase Audit)
- **Verdict**: NOT READY (30 blockers, 38 warnings, 12 info)
- Schema = CLEAN (139 tables all present in Drizzle)
- 25 routes from Page Registry have no page.tsx
- No requestPayout action exists

## What Gets Fixed Between Audits
- Audit 3->4: storefront.ts, storefront-pages.ts, promotions.ts, boosting.ts, listings-create/update/delete.ts, bulk-listings.ts, shipping.ts, stripe-onboarding.ts, create-subscription-checkout.ts, manage-subscription.ts, create-bundle-checkout.ts all NOW use authorize()+sub()+delegation
- What persists: seller-listings.ts, shipping-profiles.ts, payout-settings.ts, seller-response.ts STILL lack delegation. authentication.ts/authentication-complete.ts STILL use wrong import. Hub disputes STILL use marketplace auth.

## Systemic Patterns
- **CASL bypass improving**: Down from 13 files (Audit #3) to ~7 files (Audit #4)
- **Delegation non-support**: Staff delegation (D5) implemented in authorize.ts but not propagated to all action files
- **Import consistency**: Files importing from `@/lib/casl/authorize` directly always miss `sub()`. The barrel `@/lib/casl` exports both.
- **Hub disputes auth mismatch**: STILL present since Audit #3

## Known False Positives
- follow.ts session.userId: Personal user action, delegation not applicable
- delegation.ts session.sellerId: Owner-only operations, sellerId===userId
- Cron routes lacking CASL: Expected (secret-based auth)
- TF/fee calculator DEFAULT_* fallbacks: Reads platform_settings first
- authentication.ts sellerId from input: Admin action targeting a seller
- browsing-history/watchlist/alerts/notifications { session } only: Personal data, low risk

## Architecture Notes
- Correct import for marketplace actions: `import { authorize, sub } from '@/lib/casl';`
- Correct import for admin actions: `import { staffAuthorize } from '@/lib/casl/staff-authorize';`
- Hub layout provides staff cookie gate for ALL hub pages
- Admin pages (d, usr, tx, fin, mod, cfg) should use staffAuthorize; my/* pages use marketplace auth
