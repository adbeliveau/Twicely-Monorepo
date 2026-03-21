# G10.10 Saved Payment Methods — Research Findings

## Status
Prompt WRITTEN 2026-03-18.
File: `.claude/install-prompts/G10.10-saved-payment-methods.md`

## Test Baseline
User specified 7518 tests when requesting the prompt.
Build tracker shows 7481 (G10.8) + 37 (G10.9) = 7518.

## Key Spec Gaps Found

### GAP 1 — Route not in Page Registry
`/my/settings/payments` is NOT in Page Registry v1.8. Registry goes to page 78 (/my/settings/privacy).
The feature exists in the build tracker (G10.10 entry) but is not formally registered as a page.
Prompt documents this, adds it as an informal page 78-A, adds the nav tab to layout.tsx.

### GAP 2 — No buyer stripeCustomerId (CRITICAL)
The `user` table has NO `stripeCustomerId` column.
`sellerProfile.stripeCustomerId` = billing customer (for subscriptions ONLY).
A NEW `stripeCustomerId` column must be added to the `user` table for buyer payment methods.
These are TWO SEPARATE Stripe Customer objects — must never be merged.
Owner confirmation required before proceeding.

### GAP 3 — No PaymentMethod CASL subject
`PaymentMethod` not in SUBJECTS array. Use existing `can('update', 'User', { id: userId })`.
No new CASL rules needed.

### GAP 4 — No default PM storage in DB
Default payment method stored on Stripe Customer object, read/written via Stripe API.
No `defaultPaymentMethodId` column added to user table. Owner confirmation preferred.

## Settings Pages Architecture
All `/my/settings/*` pages live in `src/app/(hub)/my/settings/`.
Layout file: `src/app/(hub)/my/settings/layout.tsx` — contains SETTINGS_NAV array.
Currently 4 tabs: Profile, Notifications, Security, Privacy & Data.
Must add 5th tab: Payments at `/my/settings/payments`.

Pattern to follow: `privacy/page.tsx` (async Server Component + authorize() + redirect).
NOT the pattern of `security/page.tsx` (client component + useSession).

## Existing Stripe Infrastructure
- `src/lib/stripe/server.ts` — stripe singleton, createPaymentIntent, createConnectPaymentIntent
- `src/lib/stripe/client.ts` — getStripePromise() singleton
- `src/lib/stripe/connect.ts` — seller Connect account management
- `src/components/providers/stripe-provider.tsx` — Elements wrapper (takes clientSecret)
- `src/components/offers/inline-card-element.tsx` — CardElement + useStripe pattern (good reference)
- Packages: `@stripe/react-stripe-js` ^5.6.0, `@stripe/stripe-js` ^8.7.0, `stripe` ^20.3.1

## Stripe Customer Separation
- `sellerProfile.stripeCustomerId` = seller billing customer (subscriptions)
  Written by: create-subscription-checkout.ts, create-bundle-checkout.ts, purchase-automation.ts, purchase-overage-pack.ts
  via `setStripeCustomerId(sellerProfileId, customerId)` from `@/lib/mutations/subscriptions`
- `user.stripeCustomerId` (NEW, to be added) = buyer payment customer (marketplace checkout)
  Written by: new `getOrCreateStripeCustomer(userId, email)` helper in payment-methods.ts

## File Count Summary
13 files total (9 new + 3 modified + 1 auto-generated migration):
1. `src/lib/db/schema/auth.ts` — MODIFY (add stripeCustomerId to user)
2. Migration SQL (auto-generated)
3. `src/lib/actions/payment-methods.ts` — CREATE
4. `src/lib/actions/__tests__/payment-methods.test.ts` — CREATE (~14 tests)
5. `src/app/api/payments/setup-intent/route.ts` — CREATE
6. `src/app/api/payments/setup-intent/__tests__/route.test.ts` — CREATE (~3 tests)
7. `src/app/(hub)/my/settings/payments/page.tsx` — CREATE
8. `src/app/(hub)/my/settings/layout.tsx` — MODIFY (add Payments tab)
9. `src/components/pages/payments/payment-methods-client.tsx` — CREATE
10. `src/components/pages/payments/payment-method-card.tsx` — CREATE
11. `src/components/pages/payments/add-card-form.tsx` — CREATE
12. `src/components/pages/payments/__tests__/payment-method-card.test.tsx` — CREATE (~5 tests)
13. `src/components/pages/payments/__tests__/payment-methods-client.test.tsx` — CREATE (~3 tests)

## IDOR Protection Pattern
Every mutation must verify `pm.customer === stripeCustomerId` (PM belongs to this user's Customer).
Return "Payment method not found" — never reveal ownership details.
This prevents a user from detaching or setting as default another user's card by guessing PM IDs.

## SetupIntent vs PaymentIntent
- SetupIntent (`seti_...`): Save card without charging. Use for "Add a card" flow.
- PaymentIntent (`pi_...`): Charge immediately. Used in checkout.
- Both work with `<Elements>` — same component accepts either client secret.
- SetupIntent flow: `stripe.confirmCardSetup(clientSecret, { payment_method: { card: cardElement } })`
- Deferred creation: DO NOT pre-create SetupIntent on page load — create only when user clicks "Add card".

## Spec-Compliant Disclosure (MANDATORY)
Must appear on the payments settings page:
"Payments are processed and paid out through Stripe. Twicely displays payment status and transaction activity."
Source: Pricing Canonical section 3.3
