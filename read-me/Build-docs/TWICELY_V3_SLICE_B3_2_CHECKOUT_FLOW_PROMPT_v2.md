# TWICELY V3 — B3.2 Checkout Flow (REVISED v2)

**Phase:** B3.2 | **Depends On:** B3.1 (DONE) + shippingCents patch (DONE) | **Enables:** B3.3, B3.4, B3.5, B4
**User Story:** "As a buyer, I can view my cart, enter a shipping address, pay via Stripe, and receive order confirmations — one per seller."

**Prerequisite patch applied:** `listing.shippingCents` column added (integer, not null, default 0). Seller sets flat shipping price per listing. `freeShipping = true` means `shippingCents = 0`. Cart query returns `shippingCents` per item. This is the value used for FVF calculation and checkout display.

---

## ⛔ HARD STOP PROTOCOL

This prompt has 6 sub-sections (B3.2a through B3.2f) plus a test section. After EACH sub-section:

1. Run `npx tsc --noEmit` and show the output
2. Run the GREP CHECKS listed at the end of that section
3. Show the grep output
4. **STOP. Say "B3.2X complete. Waiting for approval." Do NOT proceed.**

If you skip a stop, the entire slice will be rolled back. This happened on the first attempt and cost a full day. Do NOT repeat it.

---

## DOCUMENTS TO READ BEFORE WRITING ANY CODE

Read ALL of these FULLY. Not grep. Not skim. Read.

1. `TWICELY_V3_BUILD_BRIEF.md` — Execution rules, vertical slices, file approval protocol
2. `TWICELY_V3_PAGE_REGISTRY.md` — Cart states, Checkout 3-step flow, Confirmation page
3. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — §3 (Cart & Multi-Seller Checkout)
4. `TWICELY_V3_SCHEMA.md` — §2.5 (address), §6.1-6.5 (cart → orderPayment), §11.1 (ledgerEntry)
5. `TWICELY_V3_MONETIZATION_PRICING_CANONICAL.md` — §5.1 (FVF rates), §5.2 (store tier discounts), §5.6 (payment processing)
6. `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` — §4.4 (idempotency keys), §5.1 (Order Captured posting rules — 3 or 4 ledger entries per order)
7. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — CASL gates for BUYER actor

---

## WHAT B3.1 ALREADY BUILT (Do NOT recreate)

| File | What It Does |
|------|-------------|
| `src/lib/actions/cart.ts` | `addToCart`, `removeFromCart`, `updateCartItemQuantity`, `getOrCreateCart` |
| `src/lib/queries/cart.ts` | `getCartWithItems` — cart + items with listing data, images, seller info |
| `src/lib/commerce/availability.ts` | `checkListingAvailability` — status, quantity, vacation checks |
| `src/components/pages/listing/add-to-cart-button.tsx` | AddToCartButton on listing detail |

Stripe packages installed: `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`.

---

## RULES (1-35)

### Standard Rules (1-11)

1. **TypeScript strict:true.** Zero `as any`. Zero `as unknown as T`. Zero `@ts-ignore`.
2. **No file over 300 lines.** Split if longer.
3. **Query layer pattern.** DB reads → `src/lib/queries/`. No raw Drizzle in pages or actions.
4. **Server actions for all writes.** `src/lib/actions/`. Zod validation → CASL check → mutate.
5. **CASL enforcement on every action.** Check ability before mutation. 403 if unauthorized.
6. **CASL checks on pages.** Checkout requires authenticated buyer with cart items.
7. **Server Components by default.** `'use client'` only for interactivity.
8. **No CSS files.** Tailwind only.
9. **STOP after each sub-section.** Run tsc + grep checks. Wait for approval. DO NOT PROCEED.
10. **Do NOT invent fields or columns.** Schema is defined. Use what exists.
11. **Integer cents for ALL money.** No floats for storage or calculation. Display: `(cents / 100).toFixed(2)`.

### B3.2-Specific Prohibitions (12-35)

12. **Do NOT skip Stripe.** Real `PaymentElement` required. No fake payments. No "placeholder."
13. **Do NOT build Stripe Connect or payouts.** Phase C3. B3.2 uses ONE PaymentIntent per cart.
14. **Do NOT build real tax calculation.** Phase G. `taxCents = 0`.
15. **Do NOT build real shipping rate calculation.** Each listing has its own `shippingCents` set by the seller. Use that value. Do NOT call Shippo. Do NOT invent a flat rate.
16. **Do NOT build coupon/discount logic.** Phase D2. `discountCents = 0`.
17. **Do NOT build guest checkout.** Auth required. Redirect to login.
18. **Do NOT build combined shipping modes.** Phase B3.3. Each item ships individually.
19. **Do NOT build local pickup option.** Phase B3.4.
20. **Do NOT build authentication offer.** Phase B3.5.
21. **Do NOT build bundle suggestions in cart.** Deferred.
22. **Do NOT build "Saved for Later" in cart.** Deferred.
23. **Do NOT build cart expiry logic.** Deferred.
24. **FVF calculated server-side only.** From `fee_schedule` table or hardcoded defaults. Never trust client.
25. **Checkout uses `(checkout)` route group** with minimal layout (logo only). NOT `(marketplace)`.
26. **Checkout is a 3-STEP flow** (Address → Review → Payment). NOT single page. Step indicator + back buttons.
27. **DECREASE `listing.availableQuantity` after order creation.** If 0 → `status = 'SOLD'`, `soldAt = now()`.
28. **Order number: `TWC-YYMMDD-XXXXX`** — prefix TWC, 2-digit year, 6-digit date, 5 random uppercase alphanumeric.
29. **FVF rates (hardcoded defaults):** Electronics=9%, Apparel=10%, Home=10%, Collectibles=11.5%, default=10%.
30. **Store tier FVF discounts:** NONE=0%, STARTER=-0.1%, BASIC=-0.25%, PRO=-0.5%, ELITE=-0.75%, ENTERPRISE=-0.75%.
31. **Address form and address selector go in `src/components/shared/`** — NOT in checkout folder. They're reused in account settings.
32. **Ledger entries are REQUIRED.** Every order must post: `ORDER_PAYMENT_CAPTURED`, `ORDER_FVF_FEE`, `ORDER_STRIPE_PROCESSING_FEE`. Per Finance Engine §5.1.
33. **Idempotency is REQUIRED.** `finalizeOrder` must check for existing orders by `paymentIntentId` before creating. Double-submit must return existing orders, not create duplicates.
34. **Do NOT distribute shipping across items.** Each cart item has its own `shippingCents` from its listing. FVF per item = `(itemPriceCents + itemShippingCents) × rate`. There is no order-level flat shipping rate to distribute.
35. **Write tests against the SPEC, not the code.** If your code produces $9.00 but the spec says $9.54, the CODE is wrong, not the test. Fix the code.

---

## THE FVF CALCULATION — READ THIS CAREFULLY

This section exists because the first attempt got FVF wrong. Read every line.

### What FVF Is Charged On

Per Monetization Canonical §5.1: **"Calculated on item price + shipping charged to buyer. Taxes excluded."**

FVF base per item = `itemPriceCents + itemShippingCents`

Each cart item links to a listing. Each listing has a `shippingCents` column (the flat shipping cost the seller set). There is NO order-level shipping to split. Each item already knows its own shipping cost.

### Function Signature (EXACT)

```typescript
export function calculateFvf(
  itemPriceCents: number,
  shippingCents: number,
  feeBucket: string | null,
  storeTier: string
): { fvfAmountCents: number; fvfRateBps: number }
```

This is a PURE function. No database calls. No async. It takes the fee bucket and store tier as inputs (the caller resolves those from the DB).

### Calculation Logic

```
1. baseBps = lookup feeBucket → ELECTRONICS=900, APPAREL=1000, HOME=1000, COLLECTIBLES=1150, default=1000
2. discountBps = lookup storeTier → NONE=0, STARTER=10, BASIC=25, PRO=50, ELITE=75, ENTERPRISE=75
3. effectiveBps = baseBps - discountBps
4. fvfBase = itemPriceCents + shippingCents
5. fvfAmountCents = Math.round(fvfBase * effectiveBps / 10000)
6. return { fvfAmountCents, fvfRateBps: effectiveBps }
```

### Worked Examples (Your Tests MUST Match These Exactly)

| # | Item | Shipping | Bucket | Store Tier | Base BPS | Discount | Effective BPS | FVF Base | FVF Amount |
|---|------|----------|--------|------------|----------|----------|---------------|----------|------------|
| 1 | $100.00 (10000) | $5.99 (599) | ELECTRONICS | NONE | 900 | 0 | 900 | 10599 | Math.round(10599 × 900 / 10000) = **954** ($9.54) |
| 2 | $50.00 (5000) | $0 (0) | APPAREL | BASIC | 1000 | 25 | 975 | 5000 | Math.round(5000 × 975 / 10000) = **488** ($4.88) |
| 3 | $500.00 (50000) | $12.99 (1299) | COLLECTIBLES | PRO | 1150 | 50 | 1100 | 51299 | Math.round(51299 × 1100 / 10000) = **5643** ($56.43) |
| 4 | $25.00 (2500) | $0 (0) | null (default) | NONE | 1000 | 0 | 1000 | 2500 | Math.round(2500 × 1000 / 10000) = **250** ($2.50) |
| 5 | $499.00 (49900) | $8.00 (800) | APPAREL* | NONE | 1000 | 0 | 1000 | 50700 | Math.round(50700 × 1000 / 10000) = **5070** ($50.70) |
| 6 | $500.00 (50000) | $8.00 (800) | COLLECTIBLES* | NONE | 1150 | 0 | 1150 | 50800 | Math.round(50800 × 1150 / 10000) = **5842** ($58.42) |
| 7 | $75.00 (7500) | $5.99 (599) | HOME | ELITE | 1000 | 75 | 925 | 8099 | Math.round(8099 × 925 / 10000) = **749** ($7.49) |
| 8 | $200.00 (20000) | $0 (0) | APPAREL | STARTER | 1000 | 10 | 990 | 20000 | Math.round(20000 × 990 / 10000) = **1980** ($19.80) |

*Tests 5-6: The $500 threshold rule for jewelry/watches. Under $500 → APPAREL bucket. At $500+ → COLLECTIBLES bucket. The FVF calculator does NOT determine the bucket — the caller passes the correct bucket based on category + price. But the test must verify the correct bucket is used by the calling code.

**If your code does not produce these exact cent values, your code is wrong. Fix the code, not the test.**

---

## SUB-SECTION B3.2a — Cart Page UI

**Route:** `/cart` | **Layout:** `(marketplace)` | **Gate:** AUTH

### Page States

- **LOADING:** Cart skeleton (3 item placeholders)
- **EMPTY:** "Your cart is empty" + "Continue Shopping" CTA → `/`
- **POPULATED:** Items grouped by seller, per-item quantity controls, remove button, per-seller subtotals (items + shipping), grand total, "Proceed to Checkout" CTA
- **STALE:** Items with `isAvailable: false` grayed out with reason text, excluded from totals

### Cart Layout

```
┌──────────────────────────────────────────────────────────┐
│ Shopping Cart (X items)                                   │
├──────────────────────────────────────────────────────────┤
│ 📦 Seller: VintageVibes (2 items)                        │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [img] Vintage Denim Jacket   Qty:[1][-][+]  $45.00  │ │
│ │       Size M · Good           Shipping: $5.99 [Remove]│ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ [img] Retro Sunglasses       Qty:[1][-][+]  $22.00  │ │
│ │       Like New                Shipping: $4.99 [Remove]│ │
│ └──────────────────────────────────────────────────────┘ │
│                            Subtotal: $67.00              │
│                            Shipping: $10.98              │
│                                                           │
│ 📦 Seller: SneakerKing (1 item)                         │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [img] Air Jordan 1 Retro     Qty:[1][-][+] $189.00  │ │
│ │       New with Tags           Shipping: FREE  [Remove]│ │
│ └──────────────────────────────────────────────────────┘ │
│                            Subtotal: $189.00             │
│                            Shipping: $0.00               │
├──────────────────────────────────────────────────────────┤
│                   Items: $256.00                          │
│                   Shipping: $10.98                        │
│                   Tax: Calculated at checkout             │
│                   ───────────────                         │
│                   Estimated Total: $266.98                │
│                   [Proceed to Checkout]                   │
└──────────────────────────────────────────────────────────┘
```

Each item shows ITS OWN shipping cost from the listing, NOT a shared/distributed/flat rate.

### Mobile (375px)

- Items stack vertically. Image left (60px), text right.
- Remove = trash icon, not text.
- Summary section full-width.

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 1 | `src/app/(marketplace)/cart/page.tsx` | Cart page server component | 60 |
| 2 | `src/components/pages/cart/cart-content.tsx` | Grouped items, totals, CTA (client) | 200 |
| 3 | `src/components/pages/cart/cart-item-row.tsx` | Item row with qty controls, remove | 120 |

### Specs

**Cart Page (file 1):**
- Server component. `authorize()` for session. `getCartWithItems(userId)`.
- Empty cart → empty state. Has items → `<CartContent>`.
- `export const dynamic = 'force-dynamic'`.

**Cart Content (file 2):**
- `'use client'`. Groups items by `sellerId`. Seller name as section header.
- Per-seller subtotal = `SUM(item.priceCents × item.quantity)`.
- Per-seller shipping = `SUM(item's listing shippingCents × item.quantity)`.
- Grand totals at bottom. "Proceed to Checkout" → `router.push('/checkout')`.
- Calls existing `removeFromCart`, `updateCartItemQuantity` server actions.
- Items with `isAvailable === false`: grayed, excluded from totals.
- "X people have this in their cart" — DO NOT SHOW (Feature Lockin §3).

**Cart Item Row (file 3):**
- Thumbnail (60×60), title (links to `/i/[slug]`), condition badge, price, shipping cost, quantity +/-, remove.
- Qty range: 1 to min(availableQuantity, 10). Debounce 300ms on change.
- Unavailable: gray overlay + "(Sold)" or "(No longer available)" badge.

### B3.2a GATE — Run Before Proceeding

```bash
npx tsc --noEmit 2>&1
wc -l src/app/\(marketplace\)/cart/page.tsx src/components/pages/cart/cart-content.tsx src/components/pages/cart/cart-item-row.tsx
grep -c "groupBy\|sellerId\|grouped" src/components/pages/cart/cart-content.tsx
grep -c "shippingCents\|shipping" src/components/pages/cart/cart-item-row.tsx
```

**Expected:** tsc clean, all 3 files exist, files under line limits, cart-content groups by seller, cart-item-row shows per-item shipping.

### ⛔ STOP. Say "B3.2a complete." Show gate output. Wait for approval.

---

## SUB-SECTION B3.2b — Address Management

Reusable components in `src/components/shared/` — NOT in checkout folder.

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 4 | `src/lib/queries/address.ts` | `getUserAddresses`, `getAddressById` | 50 |
| 5 | `src/lib/actions/address.ts` | `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress` | 160 |
| 6 | `src/lib/validations/address.ts` | Zod schemas for address CRUD | 60 |
| 7 | `src/components/shared/address-form.tsx` | Create/edit address form (client) | 160 |
| 8 | `src/components/shared/address-selector.tsx` | Select saved address or add new (client) | 130 |

### Address Schema (from SCHEMA.md §2.5)

```
address: id, userId, label, name, address1, address2, city, state, zip, country, phone, isDefault, createdAt, updatedAt
```

### Specs

**Validation (file 6):**
- `addressSchema`: name (1-100), address1 (1-200), address2 (optional, max 200), city (1-100), state (2-char US), zip (`/^\d{5}(-\d{4})?$/`), country (default 'US'), phone (optional), label (optional, max 50).
- Export `createAddressSchema`, `updateAddressSchema`, `deleteAddressSchema`.

**Actions (file 5):**
- All require `authorize()`. All validate with Zod.
- `createAddress`: If first address → auto `isDefault = true`. Insert. `revalidatePath`.
- `updateAddress`: Verify `address.userId === session.userId`. Update.
- `deleteAddress`: Verify ownership. Cannot delete default if others exist. Delete.
- `setDefaultAddress`: Verify ownership. Transaction: unset old default, set new.

**Address Form (file 7):**
- `'use client'`. Props: `onSubmit(data)`, `defaultValues?`, `isLoading?`.
- Fields: name, address1, address2, city, state (dropdown), zip, phone, label.
- Submit: "Save Address" (new) or "Update Address" (edit).

**Address Selector (file 8):**
- `'use client'`. Props: `addresses[]`, `selectedId`, `onSelect(id)`, `onAddNew()`.
- Saved addresses as radio cards. Default has badge. "Add New Address" button.
- No addresses → shows AddressForm immediately.

### B3.2b GATE

```bash
npx tsc --noEmit 2>&1
test -f src/components/shared/address-form.tsx && echo "PASS: address-form in shared/" || echo "FAIL: wrong location"
test -f src/components/shared/address-selector.tsx && echo "PASS: address-selector in shared/" || echo "FAIL: wrong location"
grep -c "authorize" src/lib/actions/address.ts
grep -c "isDefault" src/lib/actions/address.ts
```

**Expected:** tsc clean, both address components in `shared/`, authorize in every action, isDefault logic present.

### ⛔ STOP. Say "B3.2b complete." Show gate output. Wait for approval.

---

## SUB-SECTION B3.2c — Order Creation Logic

The business logic core. No UI — just pure functions and the order creation transaction.

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 9 | `src/lib/commerce/order-number.ts` | `generateOrderNumber()` | 30 |
| 10 | `src/lib/commerce/fvf-calculator.ts` | `calculateFvf(itemPriceCents, shippingCents, feeBucket, storeTier)` | 60 |
| 11 | `src/lib/commerce/create-order.ts` | `createOrdersFromCart(...)` — the core transaction | 250 |

### Order Number (file 9)

Format: `TWC-YYMMDD-XXXXX`

- `TWC` — literal prefix (NOT TWI, NOT TW)
- `YYMMDD` — today's date, 2-digit year (NOT YYYYMMDD)
- `XXXXX` — 5 random uppercase alphanumeric (NOT 4 chars)

Example: `TWC-260218-A7K2B`

Check uniqueness against `order.orderNumber`. Retry max 5 times on collision.

### FVF Calculator (file 10)

**READ "THE FVF CALCULATION" SECTION ABOVE.** The function signature and worked examples are there.

```typescript
// Fee bucket base rates (basis points)
const BASE_RATES: Record<string, number> = {
  ELECTRONICS: 900,
  APPAREL: 1000,       // also APPAREL_ACCESSORIES
  HOME: 1000,          // also HOME_GENERAL
  COLLECTIBLES: 1150,  // also COLLECTIBLES_LUXURY
};
const DEFAULT_RATE = 1000;

// Store tier discounts (basis points to subtract)
const TIER_DISCOUNTS: Record<string, number> = {
  NONE: 0,
  STARTER: 10,
  BASIC: 25,
  PRO: 50,
  ELITE: 75,
  ENTERPRISE: 75,
};

export function calculateFvf(
  itemPriceCents: number,
  shippingCents: number,
  feeBucket: string | null,
  storeTier: string
): { fvfAmountCents: number; fvfRateBps: number } {
  const baseBps = (feeBucket && BASE_RATES[feeBucket]) || DEFAULT_RATE;
  const discountBps = TIER_DISCOUNTS[storeTier] || 0;
  const effectiveBps = baseBps - discountBps;
  const fvfBase = itemPriceCents + shippingCents;
  const fvfAmountCents = Math.round(fvfBase * effectiveBps / 10000);
  return { fvfAmountCents, fvfRateBps: effectiveBps };
}
```

This is the COMPLETE function. Copy it. Do NOT modify the signature. Do NOT remove `shippingCents`. Do NOT make it async.

### Order Creator (file 11)

**Input:**
```typescript
interface CreateOrdersInput {
  userId: string;
  cartId: string;
  shippingAddressId: string;
  paymentIntentId: string;
}
```

**Output:**
```typescript
interface CreateOrdersResult {
  orders: Array<{ orderId: string; orderNumber: string; sellerId: string; totalCents: number }>;
}
```

**Algorithm (inside a per-seller DB transaction):**

```
1. Fetch cart items WHERE cartId AND isAvailable = true AND isSavedForLater = false
2. Group cart items by sellerId
3. Fetch + verify shipping address (userId must match)
4. Snapshot address as JSON

FOR EACH seller group (each in its own transaction):
  5a. Generate order number (TWC-YYMMDD-XXXXX)
  5b. For each item: resolve feeBucket from category, get seller's storeTier
  5c. For each item: calculateFvf(item.priceCents, item.shippingCents, feeBucket, storeTier)
  5d. Sum totals:
      - itemSubtotalCents = SUM(priceCents × quantity)
      - shippingCents = SUM(item.shippingCents × quantity)
      - taxCents = 0
      - discountCents = 0
      - totalCents = itemSubtotalCents + shippingCents
  5e. INSERT order (status='PAID', paidAt=now(), shippingAddressJson=snapshot)
  5f. INSERT orderItems (with listingSnapshotJson per item)
  5g. INSERT orderPayment:
      - stripePaymentIntentId = paymentIntentId
      - amountCents = totalCents
      - fvfAmountCents = SUM of per-item FVF
      - fvfRatePercent = weighted average rate
      - stripeFeesCents = Math.round(totalCents * 0.029 + 30)  [estimate]
      - netToSellerCents = totalCents - fvfAmountCents - stripeFeesCents
      - status = 'captured', capturedAt = now()
  5h. Set handlingDueAt = now() + seller's handlingTimeDays
  5i. For each item: DECREASE listing.availableQuantity. If 0 → status='SOLD', soldAt=now()
  5j. INSERT ledger entries (ALL THREE REQUIRED):
      - ORDER_PAYMENT_CAPTURED: +totalCents, idempotencyKey='order:{orderId}:captured'
      - ORDER_FVF_FEE: -fvfAmountCents, idempotencyKey='order:{orderId}:fvf'
      - ORDER_STRIPE_PROCESSING_FEE: -stripeFeesCents, idempotencyKey='order:{orderId}:stripe_fee'

6. Set cart.status = 'CONVERTED'
7. Return created orders
```

**listingSnapshotJson per orderItem:**
```json
{ "title": "...", "description": "...", "priceCents": 10000, "condition": "GOOD", "images": ["url1", "url2"], "categoryName": "..." }
```

### B3.2c GATE — Critical Business Logic Checks

```bash
npx tsc --noEmit 2>&1

# Order number format
grep -n "TWC-" src/lib/commerce/order-number.ts
grep -n "YYMMDD\|getFullYear\|padStart\|slice" src/lib/commerce/order-number.ts

# FVF includes shipping
grep -n "shippingCents" src/lib/commerce/fvf-calculator.ts
grep -n "itemPriceCents + shippingCents\|itemPriceCents +shippingCents\|fvfBase" src/lib/commerce/fvf-calculator.ts

# Ledger entries exist
grep -c "ORDER_PAYMENT_CAPTURED" src/lib/commerce/create-order.ts
grep -c "ORDER_FVF_FEE" src/lib/commerce/create-order.ts
grep -c "ORDER_STRIPE_PROCESSING_FEE" src/lib/commerce/create-order.ts

# Inventory decrement
grep -n "availableQuantity" src/lib/commerce/create-order.ts
grep -n "SOLD\|soldAt" src/lib/commerce/create-order.ts

# Listing snapshot
grep -n "listingSnapshotJson" src/lib/commerce/create-order.ts

# Cart converted
grep -n "CONVERTED" src/lib/commerce/create-order.ts

# FVF function is synchronous (not async)
grep -n "async.*calculateFvf\|export async function calculateFvf" src/lib/commerce/fvf-calculator.ts
```

**Expected results:**
- tsc clean
- `TWC-` in order number (NOT TWI, NOT TW)
- `shippingCents` appears in fvf-calculator.ts as part of the base calculation
- `fvfBase = itemPriceCents + shippingCents` (or equivalent)
- 3 ledger entry types all present in create-order.ts (count ≥ 1 each)
- `availableQuantity` decrement present
- `SOLD` and `soldAt` present
- `listingSnapshotJson` present
- `CONVERTED` present
- calculateFvf is NOT async (grep should return 0 matches)

### ⛔ STOP. Say "B3.2c complete." Show ALL gate output. Wait for approval.

---

## SUB-SECTION B3.2d — Stripe Integration

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 12 | `src/lib/stripe/server.ts` | Stripe instance + `createPaymentIntent` | 50 |
| 13 | `src/lib/stripe/client.ts` | Client-side Stripe.js loader | 15 |
| 14 | `src/components/providers/stripe-provider.tsx` | `<Elements>` wrapper | 30 |

### Specs

**Server (file 12):**
```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

export async function createPaymentIntent(
  amountCents: number,
  currency: string = 'usd',
  metadata: Record<string, string> = {}
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return { clientSecret: pi.client_secret!, paymentIntentId: pi.id };
}
```

**Client (file 13):**
```typescript
import { loadStripe, type Stripe } from '@stripe/stripe-js';
let stripePromise: Promise<Stripe | null>;
export function getStripePromise() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
}
```

**Provider (file 14):**
```typescript
'use client';
import { Elements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripe/client';

export function StripeElementsProvider({
  clientSecret, children
}: { clientSecret: string; children: React.ReactNode }) {
  return (
    <Elements stripe={getStripePromise()} options={{ clientSecret }}>
      {children}
    </Elements>
  );
}
```

**Do NOT create a Stripe webhook handler.** Webhooks are Phase C3.

### B3.2d GATE

```bash
npx tsc --noEmit 2>&1
grep -n "PaymentElement\|paymentIntents.create" src/lib/stripe/server.ts
grep -n "loadStripe" src/lib/stripe/client.ts
grep -n "Elements" src/components/providers/stripe-provider.tsx
```

### ⛔ STOP. Say "B3.2d complete." Show gate output. Wait for approval.

---

## SUB-SECTION B3.2e — Checkout Flow (Pages + UI)

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 15 | `src/app/(checkout)/layout.tsx` | Minimal: logo + step indicator, no marketplace nav | 50 |
| 16 | `src/app/(checkout)/checkout/page.tsx` | Server orchestrator: auth, cart, PI, render flow | 90 |
| 17 | `src/components/pages/checkout/checkout-flow.tsx` | 3-step client component managing step state | 220 |
| 18 | `src/components/pages/checkout/checkout-summary.tsx` | Order summary: items, subtotals, shipping, total | 140 |
| 19 | `src/components/pages/checkout/payment-form.tsx` | Stripe PaymentElement + submit + error handling | 140 |
| 20 | `src/lib/actions/checkout.ts` | `initiateCheckout`, `finalizeOrder` server actions | 180 |

### Checkout Layout (file 15)

- Twicely logo linking to `/`.
- Step indicator: `1. Address → 2. Review → 3. Payment`.
- NO marketplace header, footer, search, category nav.
- `export const dynamic = 'force-dynamic'`.

### Checkout Page (file 16) — Server Component

```
1. authorize() → redirect to login if unauthenticated
2. getCartWithItems(userId) → redirect to /cart if empty
3. Filter out unavailable items. If all unavailable → redirect to /cart
4. Calculate grandTotalCents across all sellers (items + shipping per item)
5. createPaymentIntent(grandTotalCents, { userId, cartId })
6. getUserAddresses(userId)
7. Render <StripeElementsProvider clientSecret={...}>
     <CheckoutFlow cartItems={...} addresses={...} paymentIntentId={...} totalCents={...} />
   </StripeElementsProvider>
```

### Checkout Flow (file 17)

`'use client'`. Uses `useState<1 | 2 | 3>(1)` for step.

**Step 1 — Address:**
- `<AddressSelector>` from `@/components/shared/address-selector`.
- Add new → inline `<AddressForm>` from `@/components/shared/address-form`.
- "Continue" validates address selected → step 2.
- Back link → `/cart`.

**Step 2 — Review:**
- `<CheckoutSummary>` with items grouped by seller.
- Selected address (readonly). "Edit" link → step 1.
- "Continue to Payment" → step 3.

**Step 3 — Payment:**
- `<CheckoutSummary>` compact mode (totals only).
- `<PaymentForm>` with Stripe PaymentElement.
- Processing state blocks navigation.

URL does NOT change between steps. Browser back → `/cart`.

### Payment Form (file 19)

```
1. useStripe() + useElements() hooks
2. <PaymentElement /> renders
3. "Pay $XX.XX" button
4. On submit:
   a. setProcessing(true)
   b. stripe.confirmPayment({ elements, redirect: 'if_required' })
   c. Error → show message, setProcessing(false)
   d. Success → call finalizeOrder server action
   e. finalizeOrder returns orderId → router.push('/checkout/confirmation/[orderId]')
5. "Processing your order..." overlay during finalization (no back, no resubmit)
```

### Checkout Actions (file 20)

**`finalizeOrder(paymentIntentId: string, shippingAddressId: string)`:**

```
1. authorize() → get userId
2. IDEMPOTENCY CHECK: query orders WHERE paymentIntentId = this PI
   → If orders exist, return them (do NOT create duplicates)
3. Verify PI status via stripe.paymentIntents.retrieve(paymentIntentId)
   → If status !== 'succeeded', return error
4. Get user's active cart
5. Call createOrdersFromCart({ userId, cartId, shippingAddressId, paymentIntentId })
6. Return { orders, redirectUrl: '/checkout/confirmation/[firstOrderId]' }
```

### B3.2e GATE

```bash
npx tsc --noEmit 2>&1

# Checkout layout is NOT marketplace
test -f src/app/\(checkout\)/layout.tsx && echo "PASS: (checkout) layout exists" || echo "FAIL"
grep -c "header\|Header\|nav\|Nav\|footer\|Footer" src/app/\(checkout\)/layout.tsx

# 3-step flow
grep -n "useState.*1.*2.*3\|step.*1\|step.*2\|step.*3\|setStep" src/components/pages/checkout/checkout-flow.tsx | head -5

# PaymentElement usage
grep -n "PaymentElement" src/components/pages/checkout/payment-form.tsx
grep -n "confirmPayment" src/components/pages/checkout/payment-form.tsx

# Idempotency in finalizeOrder
grep -n "paymentIntentId" src/lib/actions/checkout.ts | head -5

# PI verification
grep -n "paymentIntents.retrieve\|retrieve" src/lib/actions/checkout.ts

# Address components imported from shared/
grep -n "shared/address" src/components/pages/checkout/checkout-flow.tsx
```

**Expected:**
- (checkout) layout exists, minimal header/footer references (just logo)
- Step state management present
- PaymentElement + confirmPayment in payment form
- paymentIntentId check in checkout actions (idempotency)
- PI retrieval for server-side verification
- Address imports from `@/components/shared/`

### ⛔ STOP. Say "B3.2e complete." Show ALL gate output. Wait for approval.

---

## SUB-SECTION B3.2f — Order Confirmation

### Files to Create

| # | File | Purpose | Max Lines |
|---|------|---------|-----------|
| 21 | `src/app/(checkout)/checkout/confirmation/[orderId]/page.tsx` | Confirmation page | 80 |
| 22 | `src/lib/queries/order-detail.ts` | `getOrderById`, `getOrdersByPaymentIntent` | 90 |
| 23 | `src/components/pages/checkout/order-confirmation.tsx` | Confirmation display | 140 |

### Specs

**Confirmation Page (file 21):**
- Server component. `authorize()`. `getOrderById(orderId, userId)`.
- If multi-seller → also fetch sibling orders via `paymentIntentId`.
- Render `<OrderConfirmation orders={orders} />`.

**Confirmation Display (file 23):**
- ✅ checkmark + "Order Confirmed!"
- For each order: order number, items with images, seller name, shipping total, order total.
- Shipping address.
- Payment method summary (card type + last 4 if available, or just total).
- "What's next" section: sellers notified, shipping updates by email, track in My Orders.
- CTAs: "View My Orders" → `/my/buying/orders`, "Continue Shopping" → `/`.

### B3.2f GATE

```bash
npx tsc --noEmit 2>&1
npm run lint 2>&1 | tail -5
grep -n "getOrderById\|getOrdersByPaymentIntent" src/lib/queries/order-detail.ts
```

### ⛔ STOP. Say "B3.2f complete." Show gate output. Wait for approval.

---

## TESTING

### Files to Create

| # | File | What | Max Lines |
|---|------|------|-----------|
| 24 | `src/lib/commerce/__tests__/fvf-calculator.test.ts` | All 8 worked examples + edge cases | 120 |
| 25 | `src/lib/commerce/__tests__/order-number.test.ts` | Format, length, prefix, uniqueness | 50 |
| 26 | `src/lib/actions/__tests__/checkout.test.ts` | Idempotency, PI verification, cart validation | 100 |
| 27 | `src/lib/actions/__tests__/address.test.ts` | CRUD, default swap, ownership | 100 |

### FVF Tests — MANDATORY EXACT VALUES

These are from "THE FVF CALCULATION" section. Your tests MUST assert these exact cent values:

```typescript
describe('calculateFvf', () => {
  // Test 1: Electronics $100 + $5.99 shipping, no store
  expect(calculateFvf(10000, 599, 'ELECTRONICS', 'NONE'))
    .toEqual({ fvfAmountCents: 954, fvfRateBps: 900 });

  // Test 2: Apparel $50, free shipping, Store Basic
  expect(calculateFvf(5000, 0, 'APPAREL', 'BASIC'))
    .toEqual({ fvfAmountCents: 488, fvfRateBps: 975 });

  // Test 3: Collectibles $500 + $12.99 shipping, Store Pro
  expect(calculateFvf(50000, 1299, 'COLLECTIBLES', 'PRO'))
    .toEqual({ fvfAmountCents: 5643, fvfRateBps: 1100 });

  // Test 4: Uncategorized $25, no shipping, no store
  expect(calculateFvf(2500, 0, null, 'NONE'))
    .toEqual({ fvfAmountCents: 250, fvfRateBps: 1000 });

  // Test 5: $499 jewelry → APPAREL bucket
  expect(calculateFvf(49900, 800, 'APPAREL', 'NONE'))
    .toEqual({ fvfAmountCents: 5070, fvfRateBps: 1000 });

  // Test 6: $500 jewelry → COLLECTIBLES bucket
  expect(calculateFvf(50000, 800, 'COLLECTIBLES', 'NONE'))
    .toEqual({ fvfAmountCents: 5842, fvfRateBps: 1150 });

  // Test 7: Home $75 + $5.99 shipping, Elite store
  expect(calculateFvf(7500, 599, 'HOME', 'ELITE'))
    .toEqual({ fvfAmountCents: 749, fvfRateBps: 925 });

  // Test 8: Apparel $200, free shipping, Starter store
  expect(calculateFvf(20000, 0, 'APPAREL', 'STARTER'))
    .toEqual({ fvfAmountCents: 1980, fvfRateBps: 990 });
});
```

**If any test fails, the code is wrong. Fix the `calculateFvf` function, not the test values.**

### Order Number Tests

```typescript
describe('generateOrderNumber', () => {
  it('matches TWC-YYMMDD-XXXXX format', ...);
  it('has 5-char suffix (not 4)', ...);
  it('uses TWC prefix (not TWI)', ...);
  it('uses 2-digit year (not 4-digit)', ...);
});
```

### Checkout Tests

```typescript
describe('finalizeOrder', () => {
  it('returns existing orders on duplicate paymentIntentId (idempotent)', ...);
  it('rejects if PI status is not succeeded', ...);
  it('creates per-seller orders from multi-seller cart', ...);
});
```

### TESTING GATE

```bash
npx tsc --noEmit 2>&1
npm run lint 2>&1 | tail -5
npx vitest run 2>&1
npm run build 2>&1 | tail -10
```

**ALL must pass.** Total test count should be 81 (existing) + new tests.

### ⛔ STOP. Say "B3.2 tests complete." Show full vitest + build output. Wait for approval.

---

## FILE PLAN SUMMARY

| # | Path | Action | Max Lines |
|---|------|--------|-----------|
| 1 | `src/app/(marketplace)/cart/page.tsx` | CREATE | 60 |
| 2 | `src/components/pages/cart/cart-content.tsx` | CREATE | 200 |
| 3 | `src/components/pages/cart/cart-item-row.tsx` | CREATE | 120 |
| 4 | `src/lib/queries/address.ts` | CREATE | 50 |
| 5 | `src/lib/actions/address.ts` | CREATE | 160 |
| 6 | `src/lib/validations/address.ts` | CREATE | 60 |
| 7 | `src/components/shared/address-form.tsx` | CREATE | 160 |
| 8 | `src/components/shared/address-selector.tsx` | CREATE | 130 |
| 9 | `src/lib/commerce/order-number.ts` | CREATE | 30 |
| 10 | `src/lib/commerce/fvf-calculator.ts` | CREATE | 60 |
| 11 | `src/lib/commerce/create-order.ts` | CREATE | 250 |
| 12 | `src/lib/stripe/server.ts` | CREATE | 50 |
| 13 | `src/lib/stripe/client.ts` | CREATE | 15 |
| 14 | `src/components/providers/stripe-provider.tsx` | CREATE | 30 |
| 15 | `src/app/(checkout)/layout.tsx` | CREATE | 50 |
| 16 | `src/app/(checkout)/checkout/page.tsx` | CREATE | 90 |
| 17 | `src/components/pages/checkout/checkout-flow.tsx` | CREATE | 220 |
| 18 | `src/components/pages/checkout/checkout-summary.tsx` | CREATE | 140 |
| 19 | `src/components/pages/checkout/payment-form.tsx` | CREATE | 140 |
| 20 | `src/lib/actions/checkout.ts` | CREATE | 180 |
| 21 | `src/app/(checkout)/checkout/confirmation/[orderId]/page.tsx` | CREATE | 80 |
| 22 | `src/lib/queries/order-detail.ts` | CREATE | 90 |
| 23 | `src/components/pages/checkout/order-confirmation.tsx` | CREATE | 140 |
| 24 | `src/lib/commerce/__tests__/fvf-calculator.test.ts` | CREATE | 120 |
| 25 | `src/lib/commerce/__tests__/order-number.test.ts` | CREATE | 50 |
| 26 | `src/lib/actions/__tests__/checkout.test.ts` | CREATE | 100 |
| 27 | `src/lib/actions/__tests__/address.test.ts` | CREATE | 100 |

**Total: 27 files, ~2,700 estimated lines**

---

## VERIFICATION CHECKLIST

Before marking B3.2 complete, ALL of these must be true:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx next lint` — zero errors
- [ ] `npx next build` — succeeds
- [ ] `npx vitest run` — all tests pass (81 existing + new)
- [ ] FVF test cases 1-8 produce exact cent values from worked examples
- [ ] Order number matches `TWC-YYMMDD-XXXXX` (not TWI, not YYYYMMDD, not 4 chars)
- [ ] Ledger entries: ORDER_PAYMENT_CAPTURED + ORDER_FVF_FEE + ORDER_STRIPE_PROCESSING_FEE
- [ ] `finalizeOrder` is idempotent (duplicate PI → existing orders returned)
- [ ] `stripe.paymentIntents.retrieve` called before creating orders
- [ ] `listing.availableQuantity` decremented, SOLD when 0
- [ ] `listingSnapshotJson` populated on every orderItem
- [ ] `orderPayment` has fvfAmountCents, fvfRatePercent, netToSellerCents, stripePaymentIntentId
- [ ] Cart status = CONVERTED after checkout
- [ ] Address components in `src/components/shared/` (NOT checkout folder)
- [ ] Checkout uses `(checkout)` route group (NOT marketplace)
- [ ] 3-step flow with step indicator
- [ ] Stripe PaymentElement renders
- [ ] No file exceeds 300 lines
- [ ] No `as any` or `@ts-ignore`
- [ ] `shippingCents` included in FVF base (item price + shipping)

---

## START SEQUENCE

```
1. Read all documents listed in "DOCUMENTS TO READ"
2. Present the file plan — list every file with path and one-line description
3. Wait for approval
4. Build B3.2a → STOP → wait
5. Build B3.2b → STOP → wait
6. Build B3.2c → STOP → wait
7. Build B3.2d → STOP → wait
8. Build B3.2e → STOP → wait
9. Build B3.2f → STOP → wait
10. Build tests → STOP → wait
11. Full build verification
12. tar -czf checkpoint-B3.2.tar.gz .
```

### ⛔ STOP. Present the file plan. Wait for approval before writing ANY code.
