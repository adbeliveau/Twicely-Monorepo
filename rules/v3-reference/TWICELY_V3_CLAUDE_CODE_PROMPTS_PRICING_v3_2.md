# TWICELY V3 — Claude Code Prompts: Pricing Restructure v3.2 Migration

**Purpose:** Step-by-step prompts for Claude Code to migrate from v2.0 pricing model to v3.2.
**Rules:** Execute ONE section at a time. Wait for Adrian's approval between sections. READ FIRST before coding.

---

## PROMPT 1: Schema Enum Migration (FVF → TF, StoreTier simplification, ListerTier simplification)

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md

TASK: Migrate schema enums and type definitions for Pricing Restructure v3.2. This is a RENAME + SIMPLIFY, not a rewrite of business logic.

CHANGES:

1. StoreTier enum — REMOVE BASIC and ELITE, ADD POWER:
   OLD: NONE | STARTER | BASIC | PRO | ELITE | ENTERPRISE
   NEW: NONE | STARTER | PRO | POWER | ENTERPRISE
   - Rename all references to ELITE → POWER in code
   - Remove all references to BASIC (merge into STARTER behavior)
   - Update type definitions, switch statements, tier comparison functions

2. ListerTier enum — SIMPLIFY to 4 values, ADD LITE:
   OLD: NONE | FREE | LITE | PLUS | POWER | MAX | ENTERPRISE
   NEW: NONE | FREE | LITE | PRO
   - PLUS → PRO (rename)
   - POWER, MAX, ENTERPRISE → removed (merge into PRO behavior)
   - LITE stays as-is
   - Update type definitions, switch statements, tier comparison functions

3. FVF → TF rename (UI strings and variable names only, NOT database columns yet):
   - Rename all TypeScript variables/functions containing "fvf" → "tf"
   - Rename all UI display strings "Final Value Fee" → "Transaction Fee"
   - Rename all UI display strings "FVF" → "TF"
   - DO NOT rename database columns in this step (migration in Prompt 2)

4. Add SellerStatus enum if not present:
   enum SellerStatus { PERSONAL = 'PERSONAL', BUSINESS = 'BUSINESS' }

RULES:
- Run `npx tsc --noEmit` after changes — must compile clean
- Run `npx vitest run` after changes — note which tests fail (expected, will fix in Prompt 4)
- Do NOT change any business logic — this is naming only
- Do NOT touch test files yet (Prompt 4 handles tests)

STOP after completing. List all files changed. Report TypeScript errors and test failures.
```

---

## PROMPT 2: Database Migration — Column Renames + New Columns

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md

TASK: Create Drizzle migration for database schema changes.

MIGRATION STEPS:

1. Rename columns (use ALTER TABLE ... RENAME COLUMN):
   - orders.fvf_rate → orders.tf_rate
   - orders.fvf_amount → orders.tf_amount
   - order_items.fvf_rate → order_items.tf_rate (if exists)
   - order_items.fvf_amount → order_items.tf_amount (if exists)
   - Any other columns containing "fvf" → "tf"

2. Update enum types in PostgreSQL:
   - ALTER TYPE store_tier: remove BASIC, ELITE; add POWER
   - ALTER TYPE lister_tier: remove PLUS, POWER, MAX, ENTERPRISE; ensure LITE exists; add PRO if not present
   - Add seller_status type if not exists: PERSONAL, BUSINESS

3. Add new columns:
   - seller_profiles.seller_status (seller_status enum, default PERSONAL)
   - Add commerce.escrow.holdHours to platform_settings seed
   - NOTE: stripe_processing_fee_cents was NOT added to the order table — Stripe fee data lives on orderPayment.stripeFeesCents

4. Update Drizzle schema files to match new column names and enums.

RULES:
- Migration must be reversible (include down migration)
- Use Drizzle's migration generation: `npx drizzle-kit generate`
- Verify migration runs clean: `npx drizzle-kit push` (or equivalent)
- Update all Drizzle schema TypeScript files to match new column names
- Run `npx tsc --noEmit` — must compile clean

STOP after completing. List migration file created. Report any errors.
```

---

## PROMPT 3: TF Calculator — Replace Category-Based FVF with Progressive Brackets

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md
- src/lib/commerce/fees.ts (or wherever FVF calculation lives)

TASK: Replace the FVF calculator with a progressive TF bracket calculator.

OLD LOGIC (category-based):
  function calculateFvf(categoryId, salePrice) → looks up category rate → returns flat percentage

NEW LOGIC (progressive brackets):
  function calculateTf(sellerMonthlyGmvCents: number, salePriceCents: number): { tfCents: number, effectiveRate: number }
  
  Brackets (read from platform_settings, NOT hardcoded):
    $0-$499:      10.0%
    $500-$1,999:  11.0%
    $2,000-$4,999: 10.5%
    $5,000-$9,999: 10.0%
    $10,000-$24,999: 9.5%
    $25,000-$49,999: 9.0%
    $50,000-$99,999: 8.5%
    $100,000+:     8.0%

  PROGRESSIVE/MARGINAL calculation:
    Given a seller's current monthly GMV of $3,000 and a new $50 sale:
    - Seller is in bracket 3 ($2,000-$4,999)
    - The $50 sale is taxed at bracket 3 rate: 10.5%
    - TF = $50 × 0.105 = $5.25
    
    BUT if seller's GMV is $4,980 and sale is $50:
    - First $20 taxed at bracket 3 (10.5%): $2.10
    - Remaining $30 taxed at bracket 4 (10.0%): $3.00
    - TF = $5.10

  MINIMUM TF: $0.50 per order (from platform_settings)

IMPLEMENTATION:
1. Create src/lib/commerce/tf-calculator.ts
2. Export: calculateTf(sellerMonthlyGmvCents, salePriceCents, brackets?) → { tfCents, effectiveRate, bracketBreakdown }
3. Read brackets from platform_settings (with fallback defaults)
4. Include helper: getSellerMonthlyGmv(sellerId, month?) → number (sum of order.sale_price for current calendar month)
5. Include helper: getEffectiveRate(monthlyGmvCents) → number (what rate applies to next dollar)

ALSO UPDATE:
- Checkout flow: replace fvf calculation call with tf calculation call
- Order creation: store tf_rate and tf_amount on order
- Offer acceptance: calculate TF at acceptance time
- Return/refund: calculate TF refund at rate originally charged

RULES:
- All rates stored as basis points (1000 = 10.00%) in platform_settings
- All money as cents (integer, never float)
- Bracket boundaries as cents in platform_settings
- NEVER hardcode rates — always read from settings with fallback defaults
- Run `npx tsc --noEmit` after changes

DO NOT update tests yet (Prompt 4). DO NOT update UI components yet (Prompt 5).

STOP after completing. List all files created/modified. Report TypeScript status.
```

---

## PROMPT 4: Test Migration — Update All Affected Tests

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_TESTING_STANDARDS.md
- src/lib/commerce/tf-calculator.ts (from Prompt 3)

TASK: Update all tests affected by the v3.2 pricing migration. Target: ALL tests pass, test count increases.

STEP 1: Run `npx vitest run` and capture ALL failures.

STEP 2: Fix each failing test. Categories of fixes:

A) RENAME ONLY (FVF → TF variable names):
   - Change test variable names from fvf* to tf*
   - Change assertion labels
   - DO NOT change test logic if the behavior is the same

B) ENUM VALUE CHANGES:
   - Tests referencing StoreTier.BASIC → change to StoreTier.STARTER (or remove if testing BASIC-specific behavior)
   - Tests referencing StoreTier.ELITE → change to StoreTier.POWER
   - Tests referencing ListerTier.PLUS → change to ListerTier.PRO
   - Tests referencing ListerTier.POWER/MAX/ENTERPRISE → change to ListerTier.PRO

C) FEE CALCULATION CHANGES:
   - Old tests: expect fvf = salePrice * categoryRate
   - New tests: expect tf = calculateTf(sellerMonthlyGmv, salePrice)
   - Must account for progressive brackets in test values
   - Use explicit GMV values in test setup to ensure deterministic bracket

STEP 3: Add NEW tests for TF calculator (src/lib/commerce/__tests__/tf-calculator.test.ts):

```typescript
// Required test cases:
describe('calculateTf', () => {
  it('charges 10% for seller in bracket 1 ($0-$499)')
  it('charges 11% for seller in bracket 2 ($500-$1,999)')
  it('handles bracket boundary crossing within a single sale')
  it('charges 8% for enterprise seller ($100K+)')
  it('enforces $0.50 minimum TF')
  it('returns correct effective rate')
  it('reads brackets from platform settings')
  it('uses fallback defaults when settings missing')
  it('handles zero sale price')
  it('handles seller with no prior sales (GMV = 0)')
  it('calculates correct TF after return reduces monthly GMV')
})
```

STEP 4: Run `npx vitest run` — ALL tests must pass.

RULES:
- Test count MUST increase (not decrease)
- Every new function gets at least 5 test cases
- Use explicit values (not random/generated) for deterministic tests
- Test edge cases: bracket boundaries, $0 sales, $0.01 sales, returns

STOP after completing. Report: total tests before, total tests after, all pass/fail status.
```

---

## PROMPT 5: UI Components — Stripe Fee Display + Payout Language

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PAGE_REGISTRY.md
- Twicely_Payments_UX_Legal_Microcopy_Pack.pdf (in read-me folder)

TASK: Update all UI components for v3.2 pricing display.

CHANGES:

1. ORDER DETAIL / CHECKOUT — Stripe fee as separate line:
   Old:
     Subtotal: $50.00
     FVF (10.5%): -$5.25
     Net: $44.75
   
   New:
     Sale: $50.00
     Transaction Fee (10%): -$5.00
     Payment Processing: -$1.75
     Net Earnings: $43.25
     [small text] Processed and paid out through Stripe.

2. SELLER DASHBOARD — Payout card:
   Old: "Balance: $247.50"
   New:
     Card title: "Payouts"
     Primary: "Available for payout: $247.50"
     Secondary: "Pending: $132.10"
     Tertiary: "Paid out (last 30 days): $1,842.65"
     Subtext: "Processed and paid out through Stripe."
     CTA: "View payout details"

3. PAYOUT PAGE — Language changes:
   - Page title: "Payouts and earnings"
   - Header: "Track your earnings, payout status, and payout history. Twicely displays this information while Stripe processes payouts."
   - Status filters: All | Available | Pending | Paid out | On hold | Disputed
   - CTA for payout settings: "Manage payout method in Stripe"

4. TRANSACTION ROW LABELS:
   - "Gross sale" (not "Sale price")
   - "Twicely fees" (not "FVF" or "Commission")
   - "Payment processing fee" (not "Stripe fee")
   - "Net earnings" (not "Net payout")

5. NOTIFICATION COPY:
   - "Your payout was initiated through Stripe." (not "Withdrawal initiated")
   - "Your payout was sent to your bank account." (not "Funds deposited")
   - "Your available-for-payout amount changed..." (not "Balance updated")

6. SUBSCRIPTION TIER DISPLAYS:
   - Store tiers: Free / Starter / Pro / Power / Enterprise
   - Crosslister tiers: Free / Lite / Pro
   - Remove all references to BASIC, ELITE, PLUS, MAX

GLOBAL SEARCH AND REPLACE (UI strings only):
   - "Final Value Fee" → "Transaction Fee"
   - "FVF" → "TF" (in display strings, NOT in code where already renamed)
   - "Twicely Balance" → "Available for payout"
   - "Withdraw" → "Request payout" (in seller-facing UI)
   - "Your balance" → "Available for payout"
   - "wallet" → remove or replace with "payout"

BANNED STRINGS (grep to verify ZERO occurrences in UI):
   - "Twicely Balance"
   - "Twicely wallet"
   - "Funds in your Twicely account"
   - "Withdraw from Twicely"
   - "FVF"
   - "Final Value Fee"
   - "SellerTier"
   - "SubscriptionTier"
   - StoreTier.BASIC
   - StoreTier.ELITE
   - ListerTier.PLUS
   - ListerTier.POWER (as lister tier, not store tier)
   - ListerTier.MAX
   - ListerTier.ENTERPRISE

RULES:
- Run `npx tsc --noEmit` after all changes
- Run `npx vitest run` — all tests must still pass
- Verify banned strings: `grep -rn "Twicely Balance\|Twicely wallet\|FVF\|Final Value Fee\|SellerTier\|SubscriptionTier" src/`

STOP after completing. Report: files changed, TypeScript status, test status, banned string grep results.
```

---

## PROMPT 6: Platform Settings Seed — TF Brackets + Payout Settings

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md
- src/db/seed/ (find existing seed files)

TASK: Add all v3.2 pricing settings to the platform_settings seed.

NEW SETTINGS TO ADD:

```typescript
// TF Brackets (basis points for rates, cents for boundaries)
{ key: 'commerce.tf.bracket1.maxCents', value: '49900', type: 'integer', category: 'commerce', label: 'TF Bracket 1 max ($499)', editable: true },
{ key: 'commerce.tf.bracket1.rate', value: '1000', type: 'integer', category: 'commerce', label: 'TF Bracket 1 rate (10.00%)', editable: true },
{ key: 'commerce.tf.bracket2.maxCents', value: '199900', type: 'integer', category: 'commerce', label: 'TF Bracket 2 max ($1,999)', editable: true },
{ key: 'commerce.tf.bracket2.rate', value: '1100', type: 'integer', category: 'commerce', label: 'TF Bracket 2 rate (11.00%)', editable: true },
{ key: 'commerce.tf.bracket3.maxCents', value: '499900', type: 'integer', category: 'commerce', label: 'TF Bracket 3 max ($4,999)', editable: true },
{ key: 'commerce.tf.bracket3.rate', value: '1050', type: 'integer', category: 'commerce', label: 'TF Bracket 3 rate (10.50%)', editable: true },
{ key: 'commerce.tf.bracket4.maxCents', value: '999900', type: 'integer', category: 'commerce', label: 'TF Bracket 4 max ($9,999)', editable: true },
{ key: 'commerce.tf.bracket4.rate', value: '1000', type: 'integer', category: 'commerce', label: 'TF Bracket 4 rate (10.00%)', editable: true },
{ key: 'commerce.tf.bracket5.maxCents', value: '2499900', type: 'integer', category: 'commerce', label: 'TF Bracket 5 max ($24,999)', editable: true },
{ key: 'commerce.tf.bracket5.rate', value: '950', type: 'integer', category: 'commerce', label: 'TF Bracket 5 rate (9.50%)', editable: true },
{ key: 'commerce.tf.bracket6.maxCents', value: '4999900', type: 'integer', category: 'commerce', label: 'TF Bracket 6 max ($49,999)', editable: true },
{ key: 'commerce.tf.bracket6.rate', value: '900', type: 'integer', category: 'commerce', label: 'TF Bracket 6 rate (9.00%)', editable: true },
{ key: 'commerce.tf.bracket7.maxCents', value: '9999900', type: 'integer', category: 'commerce', label: 'TF Bracket 7 max ($99,999)', editable: true },
{ key: 'commerce.tf.bracket7.rate', value: '850', type: 'integer', category: 'commerce', label: 'TF Bracket 7 rate (8.50%)', editable: true },
{ key: 'commerce.tf.bracket8.maxCents', value: null, type: 'integer', category: 'commerce', label: 'TF Bracket 8 max (unlimited)', editable: true },
{ key: 'commerce.tf.bracket8.rate', value: '800', type: 'integer', category: 'commerce', label: 'TF Bracket 8 rate (8.00%)', editable: true },
{ key: 'commerce.tf.minimumCents', value: '50', type: 'integer', category: 'commerce', label: 'Minimum TF per order ($0.50)', editable: true },
{ key: 'commerce.tf.localRate', value: '500', type: 'integer', category: 'commerce', label: 'Local transaction fee rate (5.00%)', editable: true },

// Escrow
{ key: 'commerce.escrow.holdHours', value: '72', type: 'integer', category: 'commerce', label: 'Escrow hold hours after delivery', editable: true },

// Payout
{ key: 'commerce.payout.instantFeeCents', value: '250', type: 'integer', category: 'commerce', label: 'Instant payout fee ($2.50)', editable: true },
{ key: 'commerce.payout.instantMinCents', value: '1000', type: 'integer', category: 'commerce', label: 'Instant payout min ($10.00)', editable: true },

// Boosting
{ key: 'commerce.boost.minRate', value: '100', type: 'integer', category: 'commerce', label: 'Min boost rate (1%)', editable: true },
{ key: 'commerce.boost.maxRate', value: '800', type: 'integer', category: 'commerce', label: 'Max boost rate (8%)', editable: true },
{ key: 'commerce.boost.maxPromotedPct', value: '30', type: 'integer', category: 'commerce', label: 'Max promoted results %', editable: true },
{ key: 'commerce.boost.attributionDays', value: '7', type: 'integer', category: 'commerce', label: 'Boost attribution window (days)', editable: true },

// Insertion fees by tier
{ key: 'commerce.insertion.free.allowance', value: '50', type: 'integer', category: 'commerce', label: 'Free tier monthly listing allowance', editable: true },
{ key: 'commerce.insertion.free.feeCents', value: '35', type: 'integer', category: 'commerce', label: 'Free tier insertion fee ($0.35)', editable: true },
{ key: 'commerce.insertion.starter.allowance', value: '250', type: 'integer', category: 'commerce', label: 'Starter monthly listing allowance', editable: true },
{ key: 'commerce.insertion.starter.feeCents', value: '25', type: 'integer', category: 'commerce', label: 'Starter insertion fee ($0.25)', editable: true },
{ key: 'commerce.insertion.pro.allowance', value: '2000', type: 'integer', category: 'commerce', label: 'Pro monthly listing allowance', editable: true },
{ key: 'commerce.insertion.pro.feeCents', value: '10', type: 'integer', category: 'commerce', label: 'Pro insertion fee ($0.10)', editable: true },
{ key: 'commerce.insertion.power.allowance', value: '15000', type: 'integer', category: 'commerce', label: 'Power monthly listing allowance', editable: true },
{ key: 'commerce.insertion.power.feeCents', value: '5', type: 'integer', category: 'commerce', label: 'Power insertion fee ($0.05)', editable: true },

// Subscription pricing (cents, monthly)
{ key: 'subscription.store.starter.annualCents', value: '699', type: 'integer', category: 'subscription', label: 'Store Starter annual rate/mo ($6.99)', editable: true },
{ key: 'subscription.store.starter.monthlyCents', value: '1200', type: 'integer', category: 'subscription', label: 'Store Starter monthly rate ($12.00)', editable: true },
{ key: 'subscription.store.pro.annualCents', value: '2999', type: 'integer', category: 'subscription', label: 'Store Pro annual rate/mo ($29.99)', editable: true },
{ key: 'subscription.store.pro.monthlyCents', value: '3999', type: 'integer', category: 'subscription', label: 'Store Pro monthly rate ($39.99)', editable: true },
{ key: 'subscription.store.power.annualCents', value: '5999', type: 'integer', category: 'subscription', label: 'Store Power annual rate/mo ($59.99)', editable: true },
{ key: 'subscription.store.power.monthlyCents', value: '7999', type: 'integer', category: 'subscription', label: 'Store Power monthly rate ($79.99)', editable: true },
{ key: 'subscription.crosslister.lite.annualCents', value: '999', type: 'integer', category: 'subscription', label: 'Crosslister Lite annual rate/mo ($9.99)', editable: true },
{ key: 'subscription.crosslister.lite.monthlyCents', value: '1399', type: 'integer', category: 'subscription', label: 'Crosslister Lite monthly rate ($13.99)', editable: true },
{ key: 'subscription.crosslister.pro.annualCents', value: '2999', type: 'integer', category: 'subscription', label: 'Crosslister Pro annual rate/mo ($29.99)', editable: true },
{ key: 'subscription.crosslister.pro.monthlyCents', value: '3999', type: 'integer', category: 'subscription', label: 'Crosslister Pro monthly rate ($39.99)', editable: true },
{ key: 'subscription.finance.pro.annualCents', value: '999', type: 'integer', category: 'subscription', label: 'Finance Pro annual rate/mo ($9.99)', editable: true },
{ key: 'subscription.finance.pro.monthlyCents', value: '1499', type: 'integer', category: 'subscription', label: 'Finance Pro monthly rate ($14.99)', editable: true },
{ key: 'subscription.automation.annualCents', value: '999', type: 'integer', category: 'subscription', label: 'Automation annual rate/mo ($9.99)', editable: true },
{ key: 'subscription.automation.monthlyCents', value: '1299', type: 'integer', category: 'subscription', label: 'Automation monthly rate ($12.99)', editable: true },
```

ALSO REMOVE/UPDATE:
- Remove any FVF-related platform settings
- Remove category-based fee rate settings
- Remove references to BASIC, ELITE, PLUS, MAX, ENTERPRISE lister tiers in seed

RULES:
- All monetary values in cents (integer)
- All rates in basis points (integer, 1000 = 10.00%)
- Every setting must have: key, value, type, category, label, editable
- Run seed: verify no errors
- Run `npx tsc --noEmit` and `npx vitest run`

STOP after completing. Report seed status and test results.
```

---

## PROMPT 7: Add /pricing Page to Page Registry + Create Component

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PAGE_REGISTRY.md

TASK: Add /pricing route and create the pricing comparison page.

ROUTE: /pricing (public, no auth required)

PAGE SECTIONS:
1. Hero: "Simple, transparent fees that drop as you grow"
2. TF bracket visualization (slider or table showing effective rate by volume)
3. Store tier comparison table (Free / Starter / Pro / Power / Enterprise)
4. Crosslister tier comparison (Free / Lite / Pro)
5. Finance Pro feature card
6. Automation add-on card
7. Bundle pricing with "Save X%" badges
8. vs Competitors table (Twicely vs eBay vs Poshmark vs Mercari)
9. FAQ section
10. CTA: "Import your listings free — start selling in minutes"

COMPETITOR COMPARISON TABLE:
| Feature | Twicely | eBay | Poshmark | Mercari |
|---------|---------|------|----------|---------|
| Seller fee ($500/mo) | 10% | 13.25% | 20% | 10% |
| Seller fee ($5K/mo) | ~10.6% | 13.25% | 20% | 10% |
| Seller fee ($25K/mo) | ~9.8% | 13.25% | 20% | 10% |
| Payment processing | Shown separately | 2.35% added | Included | Included |
| Total cost ($500/mo) | ~13.5% | ~15.6% | 20% | ~13.5% |
| Total cost ($25K/mo) | ~13.3% | ~15.6% | 20% | ~13.5% |
| Free import | ✅ | — | — | — |
| Crosslisting built-in | ✅ | ❌ | ❌ | ❌ |
| Buyer protection | 30 days | 30 days | 3 days | 3 days |

ADD to page registry:
  route: /pricing
  auth: public
  layout: marketing
  title: "Pricing — Twicely"
  description: "Transparent fees that drop as you grow. Start at 10%, never more than 11%."

RULES:
- Page must be responsive (375px minimum)
- Use Twicely brand purple (#7C3AED) for CTAs
- All fee numbers must come from platform_settings (not hardcoded in UI)
- Include "Fees are subject to change" disclaimer

STOP after completing. Show page at mobile and desktop widths.
```

---

## PROMPT 8: Final Verification — Full Audit

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_TESTING_STANDARDS.md

TASK: Final verification audit for Pricing Restructure v3.2 migration.

CHECKS:

1. TypeScript compilation:
   npx tsc --noEmit
   Expected: 0 errors

2. Test suite:
   npx vitest run
   Expected: ALL pass, count >= pre-migration count + 11 (new TF calculator tests)

3. Banned strings (must return ZERO results):
   grep -rn "FVF\|Final Value Fee\|Twicely Balance\|Twicely wallet\|SellerTier\|SubscriptionTier" src/ --include="*.ts" --include="*.tsx"
   grep -rn "StoreTier.BASIC\|StoreTier.ELITE" src/ --include="*.ts" --include="*.tsx"
   grep -rn "ListerTier.PLUS\|ListerTier.POWER\|ListerTier.MAX\|ListerTier.ENTERPRISE" src/ --include="*.ts" --include="*.tsx"

4. Correct strings (must return results):
   grep -rn "Transaction Fee\|calculateTf\|tf_rate\|tf_amount" src/ --include="*.ts" --include="*.tsx"
   grep -rn "Available for payout\|Processed and paid out through Stripe" src/ --include="*.ts" --include="*.tsx"
   grep -rn "StoreTier.POWER\|ListerTier.LITE\|ListerTier.PRO" src/ --include="*.ts" --include="*.tsx"

5. Route verification:
   - /pricing page loads
   - /my/payouts page uses correct language
   - Checkout flow shows TF + Stripe processing as separate lines
   - Seller dashboard payout card shows "Available for payout" not "Balance"

6. Platform settings verification:
   - All TF bracket settings exist and have correct values
   - All subscription pricing settings exist
   - commerce.escrow.holdHours = 72

REPORT FORMAT:
✅ or ❌ for each check
Total tests: [before] → [after]
Total TypeScript errors: [count]
Banned strings found: [count] (must be 0)
Files modified total: [count]
Migration status: PASS or FAIL

If ANY check fails, list specific failures and DO NOT mark migration complete.
```

---

## EXECUTION ORDER

| Prompt | Description | Depends On | Est. Time |
|--------|------------|-----------|-----------|
| 1 | Schema enum migration | — | 30 min |
| 2 | Database migration | Prompt 1 | 20 min |
| 3 | TF calculator | Prompts 1-2 | 45 min |
| 4 | Test migration | Prompts 1-3 | 60 min |
| 5 | UI components | Prompts 1-4 | 45 min |
| 6 | Platform settings seed | Prompts 1-5 | 30 min |
| 7 | /pricing page | Prompts 1-6 | 60 min |
| 8 | Final audit | Prompts 1-7 | 15 min |

**Total estimated: 5-6 hours of Claude Code time across 1-2 days.**

Adrian approves between each prompt. No prompt executes without approval of the previous one's output.
