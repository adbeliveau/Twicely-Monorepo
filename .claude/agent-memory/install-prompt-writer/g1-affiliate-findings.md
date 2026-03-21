# G1 — Affiliate & Trials Findings

## Affiliate Schema State (G1.2)
- affiliates.ts: 147 lines, ALL 6 tables present (affiliate, promoCode, referral, promoCodeRedemption, affiliateCommission, affiliatePayout)
- ALL 6 enums in enums.ts (affiliateTier, affiliateStatus, referralStatus, promoCodeType, promoDiscountType, commissionStatus)
- Already exported from index.ts barrel
- Migration 0008_schema-addendum-v1-3.sql contains all CREATE TABLE + CREATE TYPE statements
- seed-affiliates.ts exists: 2 affiliates, 3 promo codes, 5 referrals, 3 commissions, 1 payout
- CASL subjects already registered: Affiliate, Referral, PromoCode, AffiliateCommission, AffiliatePayout
- CASL abilities already in ability.ts (seller) + platform-abilities.ts (finance.manage staff)
- Field additions: user.referredByAffiliateId (auth.ts), sellerProfile.trialListerUsed/trialStoreUsed/trialAutomationUsed/trialFinanceUsed (identity.ts)
- Affiliate platform settings SEEDED: 24 keys (12 affiliate + 12 trial; G1-FIX adds 6 more = 30 total)

## CASL Issues
- STILL OPEN: ability.ts lines 230-236 use `{ affiliateId: userId }` for child tables but affiliateId = affiliate.id (CUID2 PK), NOT user.id
- Workaround in G1.5: subject-level CASL check + manual ownership verification (look up affiliate by userId, verify promoCode.affiliateId === affiliate.id)
- CaslSession does NOT include `username`. Actions needing username must query user table directly.

## G1.3 Existing Code
- joinAffiliateProgram action (113 lines), 2 queries, 1 validation schema, 2 components (signup form + status card)
- page.tsx (79 lines), hub-nav already wired, 6 test files

## G1.4 Dashboard
- Dashboard + referrals + payouts sub-pages. 6 components in src/components/affiliate/. Dashboard 175 lines.
- Seed data: seller1 has 5 referrals, 3 commissions, 1 payout. seller2 has 1 referral, 0 commissions, 0 payouts.

## G1.5 Promo Codes
- SCHEMA GAP: promoCode table has NO stripeCouponId/stripePromotionCodeId columns
- SPEC GAP: No fixed-dollar max for community promo codes. Only affiliate.maxPromoDiscountBps covers PERCENTAGE.
- SPEC GAP: Community affiliate max active codes not specified (influencer = 10 per Section 2.8)
- platform-abilities.ts has NO PromoCode manage rules. Must add for admin actions.
- applyCoupon action is for SELLER marketplace coupons, NOT subscription promo codes.
- createSubscriptionCheckout action (227 lines) currently has NO promoCode support.
- Hub admin route: `/fin/promo-codes` per Canonical Section 7.2. Gate: finance.manage scope.

## G1.6 Referral Link Handler
- `/ref/{code}` is App Router route handler (route.ts, not page.tsx). Cookie name: `twicely_ref`.
- proxy.ts needs `/ref/` added to PUBLIC_PREFIXES.
- Signup attribution (reading cookie, setting referredByAffiliateId) is NOT part of G1.6.
- Cookie utility at src/lib/affiliate/referral-cookie.ts (getReferralIdFromCookie, clearReferralCookie).

## G1-FIX Audit Blockers
- B1: recordPromoCodeRedemption security (move from server action file to helper)
- B2: broken commissions link
- B3-B5: hardcoded limits -> platform settings
- Adds 6 settings: community/influencer maxPromoCodeDurationMonths, maxActivePromoCodes, maxFixedPromoDiscountCents

## Key Rules
- Page registry has `/my/selling/affiliate` but NOT sub-routes. Canonical Section 7.1 has all 3 routes -- follow Canonical.
- Feature Lock-in has NO affiliate section -- all rules in TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md.
- Canonical Section 2.7: username anonymized after 30 days from signup. NOT in platform settings -- hardcoded.
- formatCentsToDollars at `src/lib/finance/format.ts` -- use for all money display.
- Better Auth cookie prefix: `twicely.` (dot). Referral cookie uses `twicely_ref` (underscore).
- Next deps after G1: G3.1 (influencer), G3.3 (payouts), G3.6 (creator links).
