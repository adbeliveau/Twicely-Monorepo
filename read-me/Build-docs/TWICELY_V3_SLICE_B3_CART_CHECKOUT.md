# TWICELY V3 — Slice B3: Cart & Checkout (REVISED)

**User Story:** "As a buyer, I can add items to my cart and purchase them via Stripe. Orders are created per seller."

**Prerequisite:** B2 complete (listing creation, seller dashboard, image upload all working). B1 complete (browse, search, listing detail).

---

## RULES (Same as B1/B2 — Plus B3-Specific Rules)

1. **Do NOT install packages** unless explicitly told. Check what's available first.
2. **Do NOT create files** that aren't listed in the section. No "helpers" or "utils" you invented.
3. **Do NOT add API routes** unless the section says to. Use server actions.
4. **No CSS files.** Tailwind only. No globals.css modifications.
5. **No hardcoded demo data.** Data comes from the database via Drizzle queries.
6. **No `as any`.** No `@ts-ignore`. No `as unknown as T`. Fix the type.
7. **No file over 300 lines** unless approved. Split it.
8. **Server Components by default.** Only add `'use client'` when you need interactivity (forms, click handlers, useState).
9. **Do NOT skip ahead.** Complete the section, show verification, STOP.
10. **Do NOT invent fields or columns.** The schema is defined. Use what exists.
11. **Integer cents for ALL money.** No floats. No `Number.toFixed()` for storage.

### B3-SPECIFIC PROHIBITIONS — READ CAREFULLY

12. **Do NOT skip Stripe.** You MUST integrate Stripe Elements with a real PaymentElement. Do NOT mark orders as PAID without Stripe confirmation. Do NOT write "MVP shortcut" or "skip Stripe for now." The entire point of B3 is Stripe integration in test mode.
13. **Do NOT build Stripe Connect or payout logic.** That's Phase C3. B3 uses a single PaymentIntent for the total amount — seller transfers come later.
14. **Do NOT build real tax calculation.** Tax is Phase G. Use 0 for taxCents.
15. **Do NOT build real shipping rate calculation.** Use flat $5.99 or free shipping. Shippo is Phase B4.
16. **Do NOT build coupon/discount logic.** That's Phase D2. discountCents = 0.
17. **Do NOT build guest checkout.** Requires authentication.
18. **TF must be calculated server-side** from the fee_schedule table. Never trust client-submitted fee amounts.
19. **Checkout uses its OWN route group `(checkout)`** with a minimal layout. NOT `(marketplace)`. The checkout page must NOT have the marketplace header/footer/nav.
20. **Checkout is a 3-STEP flow** (Address → Shipping → Payment). NOT a single scrollable page. Step indicator at top with back buttons.
21. **After order creation, DECREASE listing.availableQuantity.** If it hits 0, set listing.status = 'SOLD' and listing.soldAt = now(). This is mandatory — without it, the same item can be purchased multiple times.
22. **Order number format is TWC-YYMMDD-XXXXX** (prefix TWC, 2-digit year + month + day, 5 random alphanumeric uppercase). Superseded by B3.2 v2 prompt rule 28 — the earlier "YYYYMMDD-XXXX" (4-char) wording is retired. Example: `TWC-260218-A7K2B`.
23. **TF default rates** from the spec are: Electronics 9%, Apparel 10%, Home 10%, Collectibles 11.5%, default 10%. NOT 12/13/13/15. And you MUST apply store tier discount from sellerProfile.storeTier.
24. **Address components must be REUSABLE** — create separate `address-form.tsx` and `address-selector.tsx` components, not a 400-line monolith page.

---

## WHAT B3 BUILDS

| Page | Route | Layout Group | Gate | What |
|------|-------|-------------|------|------|
| Cart | `/cart` | (marketplace) | AUTH | Items grouped by seller, quantity, remove, checkout CTA |
| Checkout | `/checkout` | **(checkout)** | AUTH + cart not empty | 3-step: Address → Shipping → Payment |
| Order Confirmed | `/checkout/confirmation/[orderId]` | **(checkout)** | AUTH + own order | Order summary, estimated delivery |

**Also modifies:**
- Listing detail page (`/i/[slug]`) — adds "Add to Cart" button

**Deferred to later phases:**
- Guest checkout → disabled
- Real shipping rates via Shippo → B4
- Real tax calculation → Phase G
- Stripe Connect transfers to sellers → C3
- Coupon/promo code field → D2
- Cart expiry cron job → deferred
- "Saved for later" section → deferred

---

## FIRST: Pre-checks

Before starting any section:

```bash
# Verify Stripe is installed
pnpm list stripe @stripe/stripe-js @stripe/react-stripe-js

# Verify env vars exist
grep "STRIPE" .env.local

# Verify tsc is clean
npx tsc --noEmit
```

If Stripe packages are NOT installed:
```bash
pnpm add stripe @stripe/stripe-js @stripe/react-stripe-js
```

If STRIPE env vars are missing, add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_PLACEHOLDER
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_PLACEHOLDER
```

Also check if `src/middleware.ts` or `src/proxy.ts` sets the `x-pathname` header. The selling layout needs this. If missing, create middleware that sets `x-pathname` from `request.nextUrl.pathname`.

Show pre-check output. Then proceed to B3.1.

### STOP. Show pre-check output before proceeding.

---

## SECTION B3.1 — Cart Server Actions + Add to Cart Button

**Creates ~4 files. Modifies 1 existing file. Hard stop after.**

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/lib/commerce/availability.ts` | Utility | checkListingAvailability — is listing purchasable? |
| 2 | `src/lib/queries/cart.ts` | Query | getCartWithItems — full cart with items, images, seller info |
| 3 | `src/lib/actions/cart.ts` | Server Actions | addToCart, removeFromCart, updateCartItemQuantity, getOrCreateCart |
| 4 | `src/components/pages/listing/add-to-cart-button.tsx` | Client Component | Add to Cart button with feedback |

### File to Modify

| # | File | Change |
|---|------|--------|
| 1 | Listing detail page (find it at `src/app/(marketplace)/i/[slug]/page.tsx`) | Add AddToCartButton, remove old "Buy Now" placeholder button |

### Specifications

**Availability Check (`availability.ts`):**
- `checkListingAvailability(listingId: string, requestedQuantity: number): Promise<{ available: boolean; reason?: string; availableQuantity?: number }>`
- Checks: listing.status === 'ACTIVE', availableQuantity >= requestedQuantity, seller not on vacation (sellerProfile.vacationMode)
- Return reasons: 'NOT_FOUND', 'SOLD', 'PAUSED', 'ENDED', 'REMOVED', 'INSUFFICIENT_QUANTITY', 'SELLER_ON_VACATION'
- NOT a server action — just an async function. No `'use server'` directive.

**Cart Actions (`actions/cart.ts`):**
- All actions use `'use server'` directive
- All actions require authentication

**`getOrCreateCart(userId: string): Promise<string>`:**
- Find existing cart WHERE userId = userId AND status = 'ACTIVE'
- If none: create new cart with status='ACTIVE', itemCount=0, subtotalCents=0
- Return cart.id

**`addToCart(listingId: string, quantity?: number)`:**
- Get session, get or create cart
- Check availability (must be ACTIVE, quantity available)
- Check buyer !== seller (cannot buy your own listing)
- If item already in cart: increment quantity (up to availableQuantity)
- If new: insert cart_item with priceCents=listing.priceCents (unit price), sellerId=listing.ownerUserId
- Recalculate cart.itemCount and cart.subtotalCents (sum of priceCents * quantity for all items)
- Update cart.lastActivityAt
- Return `{ success: true, cartItemCount }` or `{ success: false, error }`
- Call `revalidatePath('/cart')`

**`removeFromCart(cartItemId: string)`:**
- Verify cart ownership (cart_item -> cart -> userId must match session)
- Delete cart_item
- Recalculate cart totals
- Return `{ success: true }`

**`updateCartItemQuantity(cartItemId: string, quantity: number)`:**
- Verify ownership
- If quantity <= 0: delete the item
- Check availability for new quantity
- Update cart_item.quantity
- Recalculate cart totals
- Return `{ success: true }` or `{ success: false, error }`

**Cart recalculation helper (private function, not exported):**
- Query all cart_items for the cart
- Sum quantity for itemCount
- Sum (priceCents * quantity) for subtotalCents
- Update cart record

**Cart Query (`queries/cart.ts`):**
- `getCartWithItems(userId: string): Promise<CartWithItems | null>`
- Returns cart with all items grouped by sellerId
- Each item includes: cart_item fields, listing title/slug/status/availableQuantity/priceCents, primary image URL, seller name (from sellerProfile.storeName or user.name)
- Re-check availability inline: if listing.status !== 'ACTIVE' or listing.availableQuantity < cartItem.quantity -> mark isAvailable=false
- **IMPORTANT:** When fetching primary images, filter by the cart's listing IDs using `inArray(listingImage.listingId, listingIds)`. Do NOT query all primary images in the database.
- Also export `getCartItemCount(userId: string): Promise<number>` for header badge

**Return types:**
```typescript
interface CartWithItems {
  cartId: string;
  itemCount: number;
  subtotalCents: number;
  groups: SellerGroup[];
}

interface SellerGroup {
  sellerId: string;
  sellerName: string;
  items: CartItemDetail[];
  groupSubtotalCents: number;
}

interface CartItemDetail {
  cartItemId: string;
  listingId: string;
  title: string;
  slug: string;
  quantity: number;
  unitPriceCents: number;
  primaryImageUrl: string | null;
  isAvailable: boolean;
  unavailableReason: string | null;
  maxQuantity: number;
}
```

**Add to Cart Button (`add-to-cart-button.tsx`):**
- Client component
- Props: `listingId: string`, `availableQuantity: number`, `sellerId: string`, `currentUserId: string | null`, `slug: string`
- If currentUserId === sellerId: "This is your listing" disabled
- If !currentUserId: link to `/auth/login?redirect=/i/{slug}`
- If availableQuantity <= 0: "Out of Stock" disabled
- Default: "Add to Cart" button. On click -> call addToCart -> "Added to Cart" + "View Cart" link
- Error state: show error below button

**Modify listing detail page:**
- Add AddToCartButton below the price section
- Remove the old placeholder "Buy Now" button if one exists
- Get session to pass currentUserId (null if not logged in)

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/lib/actions/cart.ts" \
  "src/lib/queries/cart.ts" \
  "src/components/pages/listing/add-to-cart-button.tsx" \
  "src/lib/commerce/availability.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B3.2 until Adrian approves.

---

## SECTION B3.2 — Cart Page

**Creates ~3 files. Hard stop after.**

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/(marketplace)/cart/page.tsx` | Server Component | Cart page — fetches cart data |
| 2 | `src/components/pages/cart/cart-content.tsx` | Client Component | Cart items grouped by seller, quantity controls, totals |
| 3 | `src/components/pages/cart/cart-item-row.tsx` | Client Component | Single cart item row |

### Specifications

**Cart Page (`cart/page.tsx`):**
- Requires authentication
- Title: "Cart | Twicely", robots noindex
- Fetch cart via `getCartWithItems(userId)`
- Empty state: shopping bag icon + "Your cart is empty" + "Continue Shopping" CTA
- Non-empty: render CartContent

**Cart Content (`cart-content.tsx`):**
- Desktop: two columns — items (2/3), order summary sidebar (1/3)
- Mobile: single column, summary at bottom
- Items grouped by seller with seller name header
- Unavailable items: warning banner, grayed out, "Remove" button
- Order Summary: subtotal, shipping "Calculated at checkout", tax "Calculated at checkout", estimated total, "Proceed to Checkout" button (links to `/checkout`), "Continue Shopping" link
- "Proceed to Checkout" disabled if no available items

**Cart Item Row (`cart-item-row.tsx`):**
- Image thumbnail (links to listing), title (links to listing), unit price, quantity selector (dropdown, min 1, max = maxQuantity), line total, remove button
- If unavailable: grayed with strikethrough, reason text, remove button only
- Mobile: stacked layout

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/app/(marketplace)/cart/page.tsx" \
  "src/components/pages/cart/cart-content.tsx" \
  "src/components/pages/cart/cart-item-row.tsx"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B3.3 until Adrian approves.

---

## SECTION B3.3 — Address Management + Reusable Components

**Creates ~5 files. Hard stop after.**

This section builds address CRUD AND reusable components that checkout will use in B3.5.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/lib/actions/addresses.ts` | Server Actions | createAddress, updateAddress, deleteAddress, setDefaultAddress |
| 2 | `src/lib/queries/address.ts` | Query | getUserAddresses, getAddressById |
| 3 | `src/components/pages/checkout/address-form.tsx` | Client Component | Address form (add new / edit) — REUSABLE |
| 4 | `src/components/pages/checkout/address-selector.tsx` | Client Component | Select from saved addresses — REUSABLE |
| 5 | `src/app/(marketplace)/my/settings/addresses/page.tsx` | Page | Address management page using the components above |

### Specifications

**Address Query (`queries/address.ts`):**
- `getUserAddresses(userId: string)`: all addresses, ordered by isDefault DESC, createdAt DESC
- `getAddressById(addressId: string, userId: string)`: single address, verify ownership

**Address Actions (`actions/addresses.ts`):**
- All require authentication, all verify ownership

**`createAddress(data)`:**
- Validate: name, address1, city, state, zip required. Country defaults to 'US'.
- If isDefault=true OR first address: set as default, unset previous default
- Return `{ success: true, addressId }` or `{ success: false, errors }`

**`updateAddress(addressId, data)`:**
- Verify ownership. Update fields. Handle default toggle.

**`deleteAddress(addressId)`:**
- Verify ownership. Delete. If was default, promote another address.

**`setDefaultAddress(addressId)`:**
- Verify ownership. Unset old default, set new.

**Address Form (`address-form.tsx`):**
- REUSABLE component — used in both settings page AND checkout
- Props: `initialData?: Partial<AddressData>`, `onSubmit: (data) => Promise<void>`, `onCancel?: () => void`, `isSubmitting?: boolean`
- Fields: Name, Address Line 1, Address Line 2 (opt), City, State (dropdown of US states), ZIP, Country (US only, disabled), Phone (opt), Label (opt — "Home", "Work"), Set as Default checkbox
- Inline validation for required fields
- Use shadcn/ui Input, Select, Button components — NOT raw HTML inputs

**Address Selector (`address-selector.tsx`):**
- REUSABLE component — used in checkout step 1
- Props: `addresses: Address[]`, `selectedId: string | null`, `onSelect: (id: string) => void`, `onAddNew: () => void`
- Saved addresses as selectable radio cards (name, full address, default badge)
- Selected card highlighted
- "Add New Address" button at bottom
- If no saved addresses: show AddressForm immediately

**Addresses Page (`settings/addresses/page.tsx`):**
- Uses AddressForm and address actions
- List all addresses as cards with edit/delete/set-default actions
- "Add Address" button opens AddressForm inline
- Should be UNDER 200 lines by composing the reusable components

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/lib/actions/addresses.ts" \
  "src/lib/queries/address.ts" \
  "src/components/pages/checkout/address-form.tsx" \
  "src/components/pages/checkout/address-selector.tsx" \
  "src/app/(marketplace)/my/settings/addresses/page.tsx"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B3.4 until Adrian approves.

---

## SECTION B3.4 — Order Creation Logic + TF Calculation

**Creates ~3 files. Hard stop after.**

Server-side logic for creating orders from a cart. Includes TF calculation from fee_schedule with store tier discount, order number generation, and per-seller order splitting. No UI in this section.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/lib/commerce/create-order.ts` | Server Logic | createOrdersFromCart — splits cart into per-seller orders |
| 2 | `src/lib/commerce/fees.ts` | Utility | calculateTF — fee_schedule lookup + store tier discount |
| 3 | `src/lib/commerce/order-number.ts` | Utility | generateOrderNumber — TWC-YYMMDD-XXXXX format (2-digit year, 5 random chars) |

### Specifications

**Order Number Generator (`order-number.ts`):**
- Format: `TWC-{YYMMDD}-{5 random alphanumeric uppercase}` (2-digit year, 5 random chars — regex `/^TWC-\d{6}-[A-Z0-9]{5}$/`)
- Example: `TWC-20260216-A7B3`
- Check uniqueness against order table, retry if collision (max 5 retries)
- **NOT `TW-`. NOT 5 chars. Exactly `TWC-` prefix, exactly 4 random chars.**

**TF Calculator (`fees.ts`):**

`calculateTF(categoryId: string, salePriceCents: number, sellerId: string): Promise<{ tfRatePercent: number; tfAmountCents: number }>`

Steps:
1. Get the listing's category -> map to fee bucket (from category.feeBucket)
2. Query fee_schedule WHERE feeBucket matches AND effectiveAt <= NOW() AND (expiresAt IS NULL OR expiresAt > NOW()), ORDER BY effectiveAt DESC LIMIT 1
3. If no fee_schedule found: use DEFAULT rates — **Electronics 9%, Apparel 10%, Home 10%, Collectibles 11.5%, default 10%**
4. Look up seller's storeTier from sellerProfile
5. Apply store tier discount: `finalRate = categoryRate - tierDiscount`
   - NONE = 0
   - STARTER = 0.1
   - STARTER = 0.25
   - PRO = 0.5
   - POWER = 0.75
   - ENTERPRISE = 0.75
   - Example: Electronics (9%) with STARTER (0.25) = 9 - 0.25 = 8.75%
6. Calculate: `tfAmountCents = Math.round(salePriceCents * finalRate / 100)`
7. Return `{ tfRatePercent: finalRate, tfAmountCents }`

**FORBIDDEN: Hardcoding fee rates in the calculation path. The fee_schedule query is required. Only the fallback defaults are hardcoded.**
**FORBIDDEN: Using 12/13/13/15% rates. The correct rates are 9/10/10/11.5/10.**

**Create Orders (`create-order.ts`):**

`createOrdersFromCart(userId: string, cartId: string, shippingAddressId: string, paymentIntentId: string): Promise<{ orders: CreatedOrder[]; error?: string }>`

Logic:
1. Fetch cart with items (re-verify all available)
2. If any unavailable: return error
3. Fetch shipping address by ID (verify ownership)
4. Group cart items by sellerId
5. For each seller group, in a database **transaction**:
   a. Generate order number (TWC-YYMMDD-XXXXX)
   b. Shipping: all items freeShipping=true -> 0, else flat 599 cents
   c. itemSubtotalCents = sum of (unitPriceCents * quantity)
   d. taxCents = 0, discountCents = 0
   e. totalCents = itemSubtotalCents + shippingCents
   f. Insert `order` with status='CREATED', shippingAddressJson
   g. Insert `order_item` rows with listingSnapshotJson
   h. Calculate TF per item, sum totals
   i. Insert `order_payment`: status='pending', stripePaymentIntentId
   **j. CRITICAL: For each item, UPDATE listing SET availableQuantity = availableQuantity - purchasedQty. IF availableQuantity reaches 0 THEN SET status='SOLD', soldAt=now(). DO NOT SKIP.**
6. Update cart status to 'CONVERTED'
7. Return orders array

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/lib/commerce/create-order.ts" \
  "src/lib/commerce/fees.ts" \
  "src/lib/commerce/order-number.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# Verify order number format
grep -n "TWC-" src/lib/commerce/order-number.ts || echo "ERROR: TWC- prefix not found"

# Verify inventory decrement exists
grep -n "availableQuantity" src/lib/commerce/create-order.ts || echo "ERROR: No inventory decrement"

# Verify TF defaults are correct
grep -n "9\.\|10\.\|11\.5" src/lib/commerce/fees.ts || echo "ERROR: Check TF rates"
```

### STOP. Do not proceed to B3.5 until Adrian approves.

---

## SECTION B3.5 — Checkout Layout + Stripe Payment + 3-Step Flow

**Creates ~7 files. Largest section. Hard stop after.**

Checkout lives in route group `(checkout)` with minimal layout. 3-step flow. Stripe Elements for payment. Orders NOT marked paid without Stripe confirmation.

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/lib/stripe/server.ts` | Utility | Stripe instance + createPaymentIntent |
| 2 | `src/lib/stripe/client.ts` | Utility | getStripe client loader (singleton) |
| 3 | `src/app/(checkout)/layout.tsx` | Layout | Minimal — logo only, no nav/footer |
| 4 | `src/app/(checkout)/checkout/page.tsx` | Server Component | Fetches cart + addresses |
| 5 | `src/components/pages/checkout/checkout-flow.tsx` | Client Component | 3-step state machine |
| 6 | `src/components/pages/checkout/payment-form.tsx` | Client Component | Stripe PaymentElement |
| 7 | `src/lib/actions/checkout.ts` | Server Actions | initiateCheckout, completeCheckout |

### Specifications

**Stripe Server (`stripe/server.ts`):**
- Initialize Stripe with STRIPE_SECRET_KEY
- Export `createPaymentIntent(amountCents, metadata)` -> `{ clientSecret, paymentIntentId }`
- Uses `stripe.paymentIntents.create()` with amount, currency='usd', automatic_payment_methods

**Stripe Client (`stripe/client.ts`):**
- Singleton `getStripe()` using `loadStripe(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)`

**Checkout Layout (`(checkout)/layout.tsx`):**
- Twicely logo (links to /), no nav, no footer, white background
- Children centered, max-width 800px
- SEPARATE route group from (marketplace)

**Checkout Page (`(checkout)/checkout/page.tsx`):**
- Auth required, redirect if no cart/no available items
- Fetch cart + addresses
- Render CheckoutFlow

**Checkout Flow (`checkout-flow.tsx`) — 3 STEPS:**

Step indicator at top: ① Shipping → ② Delivery → ③ Payment

**Step 1 — Shipping Address:**
- AddressSelector (from B3.3)
- Select or create address
- "Continue to Delivery" button

**Step 2 — Delivery Method:**
- Per-seller groups with shipping option
- "Standard Shipping ($5.99)" or "Free Shipping"
- "Continue to Payment" button + Back button

**Step 3 — Review & Pay:**
- Full order summary
- PaymentForm component
- Back button to step 2

**Place Order sequence:**
1. User reaches step 3 -> call `initiateCheckout(cartId, shippingAddressId)`:
   - Re-validates cart
   - Calculates total
   - Creates PaymentIntent via Stripe
   - Returns `{ clientSecret, paymentIntentId, totalCents }`
2. PaymentForm renders `<Elements>` with clientSecret, shows `<PaymentElement>`
3. User clicks "Place Order" -> `stripe.confirmPayment()`
4. On success -> call `completeCheckout(cartId, shippingAddressId, paymentIntentId)`:
   - Verifies PaymentIntent via `stripe.paymentIntents.retrieve()` — MUST be 'succeeded'
   - Calls createOrdersFromCart
   - Updates orders to PAID, payments to captured
   - Returns orders
5. Redirect to `/checkout/confirmation/{firstOrderId}`

**DO NOT SKIP STRIPE. DO NOT MARK ORDERS PAID WITHOUT STRIPE CONFIRMATION.**

**Payment Form (`payment-form.tsx`):**
- Wraps `<Elements>` + `<PaymentElement>` from @stripe/react-stripe-js
- "Place Order — Pay $XX.XX" button
- Loading: spinner, no back button
- Error: show Stripe error, allow retry
- Success: call completeCheckout, then redirect

**Checkout Actions (`actions/checkout.ts`):**

`initiateCheckout(cartId, shippingAddressId)`:
- Auth, validate cart, calculate totals, create PaymentIntent
- Return { clientSecret, paymentIntentId, totalCents }

`completeCheckout(cartId, shippingAddressId, paymentIntentId)`:
- Auth, verify PI status with Stripe, create orders, update to PAID
- Return { orders }

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/lib/stripe/server.ts" \
  "src/lib/stripe/client.ts" \
  "src/app/(checkout)/layout.tsx" \
  "src/app/(checkout)/checkout/page.tsx" \
  "src/components/pages/checkout/checkout-flow.tsx" \
  "src/components/pages/checkout/payment-form.tsx" \
  "src/lib/actions/checkout.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done

# Verify Stripe integration
grep -n "PaymentElement\|confirmPayment" src/components/pages/checkout/payment-form.tsx || echo "ERROR: Stripe not integrated"
grep -n "paymentIntents" src/lib/actions/checkout.ts src/lib/stripe/server.ts || echo "ERROR: Stripe server missing"

# Verify (checkout) layout exists
test -f "src/app/(checkout)/layout.tsx" && echo "OK: checkout layout" || echo "ERROR: No checkout layout"
```

### STOP. Do not proceed to B3.6 until Adrian approves.

---

## SECTION B3.6 — Order Confirmation Page

**Creates ~2 files. Hard stop after.**

### Files to Create

| # | File | Type | Purpose |
|---|------|------|---------|
| 1 | `src/app/(checkout)/checkout/confirmation/[orderId]/page.tsx` | Server Component | Order confirmation |
| 2 | `src/lib/queries/order.ts` | Query | getOrderConfirmation |

### Specifications

**Order Query (`queries/order.ts`):**
- `getOrderConfirmation(orderId: string, userId: string)`: order + items + payment, only if buyerId === userId

**Confirmation Page:**
- Auth required. Fetch order, redirect to / if not found.
- Green checkmark + "Order Confirmed!" + order number
- Estimated delivery: "3-7 business days"
- Sections: Items, Shipping Address, Payment Summary
- "Continue Shopping" button

### Verification

```bash
npx tsc --noEmit
pnpm lint
for f in \
  "src/app/(checkout)/checkout/confirmation/[orderId]/page.tsx" \
  "src/lib/queries/order.ts"; do
  test -f "$f" && echo "OK: $f" || echo "MISSING: $f"
done
```

### STOP. Do not proceed to B3.7 until Adrian approves.

---

## SECTION B3.7 — Full Flow Test + Bug Fixes

**No new files. Full audit.**

### Test Flow

1. Listing detail -> "Add to Cart" visible
2. Add items from 2 sellers
3. /cart -> grouped by seller, totals correct
4. Quantity change -> recalculate
5. Remove -> recalculate
6. "Proceed to Checkout" -> /checkout (minimal layout, NO marketplace nav)
7. Step 1: address -> "Continue"
8. Step 2: shipping -> "Continue"
9. Step 3: summary + Stripe card
10. Test card: 4242 4242 4242 4242
11. "Place Order" -> processing -> success
12. Confirmation page with order details
13. **DB check: orders created, payments with stripePaymentIntentId, cart=CONVERTED, listing.availableQuantity decreased**

### Audit

```bash
echo "=== B3 FINAL AUDIT ==="

echo "--- 1. TypeScript ---"
npx tsc --noEmit

echo "--- 2. Lint ---"
pnpm lint

echo "--- 3. Build ---"
pnpm build

echo "--- 4. No type suppressions ---"
grep -rn "as any\|@ts-ignore\|@ts-expect" \
  src/app/\(marketplace\)/cart/ \
  src/app/\(checkout\)/ \
  src/components/pages/cart/ \
  src/components/pages/checkout/ \
  src/lib/actions/cart.ts \
  src/lib/actions/addresses.ts \
  src/lib/actions/checkout.ts \
  src/lib/queries/cart.ts \
  src/lib/queries/order.ts \
  src/lib/queries/address.ts \
  src/lib/commerce/ \
  src/lib/stripe/ 2>&1 || echo "CLEAN"

echo "--- 5. Critical checks ---"
grep -n "TWC-" src/lib/commerce/order-number.ts
grep -n "availableQuantity" src/lib/commerce/create-order.ts
grep -n "PaymentElement" src/components/pages/checkout/payment-form.tsx
test -f "src/app/(checkout)/layout.tsx" && echo "OK: checkout layout" || echo "MISSING"

echo "=== B3 AUDIT COMPLETE ==="
```

**Checkpoint:**
```bash
git add -A
git commit -m "B3 complete: cart, checkout, Stripe payment, order creation, TF, addresses"
```

### STOP. B3 complete. Wait for Adrian's approval.

---

## B3 FILE COUNT

| Section | Files |
|---------|-------|
| B3.1 | 4 + 1 mod |
| B3.2 | 3 |
| B3.3 | 5 |
| B3.4 | 3 |
| B3.5 | 7 |
| B3.6 | 2 |
| B3.7 | 0 |
| **Total** | **~24 + 1 mod** |

---

**END OF B3 PROMPT (REVISED)**
