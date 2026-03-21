# I9 Promotions Admin — Findings

## Two Separate Domain Objects
- `promotion` table (schema Section 15): seller-created, D2 scope. Types: PERCENT_OFF, AMOUNT_OFF, FREE_SHIPPING, BUNDLE_DISCOUNT. Scopes: STORE_WIDE, CATEGORY, SPECIFIC_LISTINGS.
- `promoCode` table (schema Section 21): affiliate or platform, G1 scope. Types: AFFILIATE, PLATFORM. Discount types: PERCENTAGE, FIXED.
- These are DIFFERENT CASL subjects: `Promotion` vs `PromoCode`.

## Existing Code Inventory
- Schema: `src/lib/db/schema/promotions.ts` (promotion, promotionUsage, promotedListing, promotedListingEvent)
- Schema: `src/lib/db/schema/affiliates.ts` (promoCode, promoCodeRedemption)
- Seller queries: `src/lib/queries/promotions.ts` (getSellerPromotions, getPromotionById, getPromotionStats, etc.)
- Seller actions: `src/lib/actions/promotions.ts` (createPromotion, updatePromotion, deactivatePromotion, reactivatePromotion)
- Platform promo actions: `src/lib/actions/promo-codes-platform.ts` (createPlatformPromoCode, updatePlatformPromoCode, validatePromoCode)
- Affiliate promo actions: `src/lib/actions/promo-codes-affiliate.ts` (createAffiliatePromoCode, updateAffiliatePromoCode, deleteAffiliatePromoCode)
- Hub promo page: `src/app/(hub)/fin/promo-codes/page.tsx` — only shows PLATFORM promo codes
- Dialog: `src/components/hub/create-platform-promo-dialog.tsx` — client-side form for creating platform promo codes
- Validations: `src/lib/validations/promo-code.ts` — createPromoCodeSchema, updatePromoCodeSchema, createPlatformPromoCodeSchema, applyPromoCodeSchema

## CASL Gap
- `Promotion` subject exists in subjects.ts (line 22)
- Seller ability: `can('manage', 'Promotion', { sellerId })` (ability.ts line 79)
- Platform staff: NO `manage Promotion` or `read Promotion` in platform-abilities.ts
- `PromoCode` subject: `can('manage', 'PromoCode')` for FINANCE role (platform-abilities.ts line 124)
- Fix: Add `can('manage', 'Promotion')` for ADMIN, `can('read', 'Promotion')` for MODERATION+FINANCE

## Spec Gaps
- `/promotions` hub route NOT in Page Registry (build tracker authoritative for Phase I)
- `discountRule` does NOT exist — decomposer mentioned it but it's just the `promotion` table
- Feature Lock-in Section 2: "Admin can disable any seller's promotions if abusive" — but no CASL rule existed

## Pattern Notes
- Dual-table detail page (`/promotions/[id]`): try promotion table first, fall back to promoCode. Both use CUID2 IDs.
- admin-nav.ts update deferred to I17
- Existing `/fin/promo-codes` stays as financial view; `/promotions` is admin CRUD view
