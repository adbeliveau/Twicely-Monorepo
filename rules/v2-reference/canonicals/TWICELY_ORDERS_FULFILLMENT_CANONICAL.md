# TWICELY_ORDERS_FULFILLMENT_CANONICAL.md
**Status:** LOCKED (v2.0)  
**Scope:** Cart, bundles, order creation, payment settlement, shipping, fulfillment, cancellations, delivery lifecycle, and buyer-seller negotiation.  
**Audience:** Backend, frontend, ops, payments, and AI agents.  
**Non-Goal:** UI styling, carrier-specific APIs, or tax engine internals.

---

## 1. Purpose

This canonical defines **how carts and orders behave end-to-end** from buyer intent to purchase completion, including bundle discounts and buyer-seller negotiation.

It ensures orders:
- settle money correctly
- ship predictably
- resolve edge cases safely
- feed payouts deterministically
- support seller-created bundles and "Make Me a Deal" negotiations

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Orders are immutable records of intent**
2. **Money settles before fulfillment**
3. **Fulfillment is seller-responsible unless explicitly delegated**
4. **State machines drive behavior**
5. **Every fulfillment action is auditable**
6. **Carts enable multi-item, multi-seller checkout**
7. **Bundles incentivize larger purchases** (NEW)
8. **Negotiations are transparent and time-bound** (NEW)

---

## 3. Order Types (v2)

| Type | Description |
|------|-------------|
| STANDARD | Single seller, shipped |
| BUNDLE | Items purchased via seller bundle (NEW) |
| NEGOTIATED | Items purchased via "Make Me a Deal" (NEW) |
| LOCAL_PICKUP | In-person handoff (future flag) |

---

## 4. Shopping Cart

### 4.1 Cart Model

```ts
type Cart = {
  id: string;
  userId?: string;
  sessionId?: string;
  status: CartStatus;
  
  // Items
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  currency: string;
  
  // Bundles (NEW)
  appliedBundles: CartBundle[];
  bundleDiscountCents: number;
  
  // Smart prompts (NEW)
  prompts: CartPrompt[];
  
  // Negotiation requests (NEW)
  bundleRequests: BundleRequest[];
  
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type CartStatus = 
  | "ACTIVE"
  | "MERGED"
  | "CONVERTED"
  | "ABANDONED"
  | "EXPIRED";

type CartItem = {
  id: string;
  cartId: string;
  listingId: string;
  variantId?: string;
  variantLabel?: string;
  sellerId: string;
  quantity: number;
  priceCents: number;
  
  // Bundle membership (NEW)
  bundleId?: string;
  bundleDiscountCents: number;
  
  isAvailable: boolean;
  unavailableReason?: string;
  isSavedForLater: boolean;
};
```

### 4.2 Cart Rules

1. **One active cart per user/session**
2. **Guest carts merge on login**
3. **Items grouped by seller at checkout**
4. **Price snapshot captured when item added**
5. **Cart validates items before checkout**
6. **Bundle discounts applied at cart level** (NEW)
7. **Smart prompts refresh on cart changes** (NEW)

### 4.3 Cart Reservations

Short-term inventory holds while shopping:

```ts
type CartReservation = {
  cartId: string;
  listingId: string;
  variantId?: string;
  quantity: number;
  expiresAt: Date;    // 15 minutes
  isActive: boolean;
};
```

### 4.4 Cart-to-Order Conversion

```ts
async function convertCartToOrders(cartId: string, buyerId: string) {
  const cart = await getCart(cartId);
  
  // 1. Validate all cart items
  await validateCart(cartId);
  
  // 2. Group items by seller
  const itemsBySeller = groupBySeller(cart.items);
  
  // 3. Calculate bundle discounts per seller
  const bundleDiscounts = await calculateBundleDiscounts(cart);
  
  // 4. Create one order per seller
  const orderIds = [];
  for (const [sellerId, items] of itemsBySeller) {
    const order = await createOrder({
      buyerId,
      sellerId,
      items,
      bundleDiscountCents: bundleDiscounts[sellerId] ?? 0,
      appliedBundleId: cart.appliedBundles.find(b => b.sellerId === sellerId)?.id,
      bundleRequestId: cart.bundleRequests.find(r => r.sellerId === sellerId && r.status === "ACCEPTED")?.id,
    });
    orderIds.push(order.id);
  }
  
  // 5. Mark cart as converted
  await updateCart(cartId, { status: "CONVERTED", convertedToOrderIds: orderIds });
  
  // 6. Increment bundle usage counts
  for (const bundle of cart.appliedBundles) {
    await incrementBundleUsage(bundle.sellerBundleId);
  }
  
  return orderIds;
}
```

---

## 5. Seller Bundles (NEW)

### 5.1 Seller Bundle Model

```ts
type SellerBundle = {
  id: string;
  sellerId: string;
  
  name: string;
  description?: string;
  imageUrl?: string;
  
  // Discount
  discountType: BundleDiscountType;
  discountValue: number;    // Percent (0-100) or cents
  
  // Bundle composition
  bundleType: BundleType;
  
  // For SPECIFIC_ITEMS
  listingIds: string[];
  minQuantity: number;
  
  // For CATEGORY
  categoryIds: string[];
  minCategoryItems?: number;
  
  // For ANY_ITEMS
  minItems?: number;
  minTotalCents?: number;
  
  // Limits
  maxUsesTotal?: number;
  maxUsesPerBuyer?: number;
  usedCount: number;
  
  // Validity
  isActive: boolean;
  startsAt: Date;
  endsAt?: Date;
  
  // Analytics
  viewCount: number;
  applyCount: number;
  conversionCount: number;
};

type BundleDiscountType = "PERCENT" | "FIXED_AMOUNT";

type BundleType = 
  | "SPECIFIC_ITEMS"   // Must buy specific listings
  | "CATEGORY"         // Any items from category
  | "ANY_ITEMS";       // Any items from seller
```

### 5.2 Bundle Rules

1. **Max 50 active bundles per seller** (configurable)
2. **Max 50% discount** (configurable)
3. **Min 2 items per bundle**
4. **Bundles cannot overlap** (same listing in multiple bundles)
5. **Seller owns all listings in bundle**
6. **Bundle discount applied BEFORE coupons**

### 5.3 Bundle Application

```ts
async function applyBundle(cartId: string, bundleId: string): Promise<CartBundle> {
  const bundle = await getBundle(bundleId);
  const cart = await getCart(cartId);
  
  // Validate bundle is active
  if (!bundle.isActive) throw new Error("BUNDLE_NOT_ACTIVE");
  if (bundle.endsAt && bundle.endsAt < new Date()) throw new Error("BUNDLE_EXPIRED");
  
  // Validate cart meets requirements
  const sellerItems = cart.items.filter(i => i.sellerId === bundle.sellerId);
  
  if (bundle.bundleType === "SPECIFIC_ITEMS") {
    const hasAll = bundle.listingIds.every(id => 
      sellerItems.some(i => i.listingId === id)
    );
    if (!hasAll) throw new Error("BUNDLE_REQUIREMENTS_NOT_MET");
  }
  
  if (bundle.bundleType === "ANY_ITEMS") {
    if (sellerItems.length < (bundle.minItems ?? 2)) {
      throw new Error("BUNDLE_REQUIREMENTS_NOT_MET");
    }
  }
  
  // Calculate discount
  const itemsSubtotal = sellerItems.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const discountCents = bundle.discountType === "PERCENT"
    ? Math.floor(itemsSubtotal * bundle.discountValue / 100)
    : bundle.discountValue;
  
  // Apply bundle
  const cartBundle = await createCartBundle({
    cartId,
    sellerBundleId: bundleId,
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    appliedDiscountCents: discountCents,
    cartItemIds: sellerItems.map(i => i.id),
  });
  
  // Update bundle stats
  await incrementBundleApplyCount(bundleId);
  
  return cartBundle;
}
```

---

## 6. Smart Cart Prompts (NEW)

### 6.1 Cart Prompt Model

```ts
type CartPrompt = {
  id: string;
  cartId: string;
  
  promptType: CartPromptType;
  
  headline: string;         // "Add $12 more for FREE SHIPPING!"
  subtext?: string;
  ctaText: string;          // "View items"
  
  targetSellerId?: string;
  targetListingIds: string[];
  targetBundleId?: string;
  
  currentAmountCents?: number;
  targetAmountCents?: number;
  savingsAmountCents?: number;
  
  priority: number;
  isDismissed: boolean;
  expiresAt?: Date;
};

type CartPromptType =
  | "FREE_SHIPPING_THRESHOLD"   // "Add $X for free shipping"
  | "BUNDLE_AVAILABLE"          // "Bundle these for 15% off"
  | "QUANTITY_DISCOUNT"         // "Buy 3, get 10% off"
  | "SELLER_PROMO"              // Seller-specific promotion
  | "RELATED_ITEMS";            // "Frequently bought together"
```

### 6.2 Prompt Generation Rules

1. **Max 3 prompts per cart** (configurable)
2. **Prompts sorted by priority** (higher = more relevant)
3. **Refresh on every cart change**
4. **Expire after 24 hours**
5. **Dismissed prompts don't reappear**

### 6.3 Prompt Generation Logic

```ts
async function generatePrompts(cart: Cart): Promise<CartPrompt[]> {
  const prompts: CartPrompt[] = [];
  
  // Group items by seller
  const sellerItems = groupBySeller(cart.items);
  
  for (const [sellerId, items] of sellerItems) {
    const sellerTotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    
    // 1. Free shipping threshold
    const profile = await getShippingProfile(sellerId);
    if (profile?.domesticFreeShippingAbove && sellerTotal < profile.domesticFreeShippingAbove) {
      prompts.push({
        promptType: "FREE_SHIPPING_THRESHOLD",
        headline: `Add $${((profile.domesticFreeShippingAbove - sellerTotal) / 100).toFixed(2)} for FREE SHIPPING!`,
        ctaText: "View items",
        targetSellerId: sellerId,
        savingsAmountCents: profile.domesticFirstItemCents,
        priority: 10,
      });
    }
    
    // 2. Bundle available
    const bundles = await getApplicableBundles(sellerId, items.map(i => i.listingId));
    for (const { bundle, qualifies, missingListings } of bundles) {
      if (!qualifies && missingListings.length <= 2) {
        prompts.push({
          promptType: "BUNDLE_AVAILABLE",
          headline: `Add ${missingListings.length} item${missingListings.length > 1 ? "s" : ""} for ${bundle.discountValue}% off!`,
          subtext: bundle.name,
          ctaText: "Complete bundle",
          targetBundleId: bundle.id,
          targetListingIds: missingListings,
          priority: 15,
        });
      }
    }
  }
  
  // Sort and limit
  prompts.sort((a, b) => b.priority - a.priority);
  return prompts.slice(0, 3);
}
```

---

## 7. Make Me a Deal (NEW)

### 7.1 Bundle Request Model

```ts
type BundleRequest = {
  id: string;
  cartId: string;
  buyerId: string;
  sellerId: string;
  
  // Items to bundle
  listingIds: string[];
  quantities: Record<string, number>;
  
  // Original pricing
  originalSubtotalCents: number;
  originalShippingCents: number;
  originalTotalCents: number;
  
  // Buyer's proposal
  proposedTotalCents?: number;
  proposedMessage?: string;
  
  // Status
  status: BundleRequestStatus;
  
  // Seller's counter-offer
  counterOfferCents?: number;
  counterOfferMessage?: string;
  counterOfferExpiresAt?: Date;
  
  // Final accepted terms
  acceptedTotalCents?: number;
  acceptedDiscountCents?: number;
  
  // Timestamps
  createdAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
};

type BundleRequestStatus =
  | "PENDING"         // Awaiting seller
  | "COUNTER_OFFERED" // Seller made counter
  | "ACCEPTED"        // Deal accepted
  | "DECLINED"        // Seller declined
  | "EXPIRED"         // Request expired
  | "WITHDRAWN"       // Buyer withdrew
  | "CONVERTED";      // Converted to order
```

### 7.2 Bundle Request Rules

1. **Min 2 items from same seller**
2. **Min $20 cart value** (configurable)
3. **Max 5 requests per buyer per day** (abuse prevention)
4. **48-hour expiration** (configurable)
5. **Seller has 24-hour response SLA**
6. **Counter-offers expire in 24 hours**
7. **One pending request per seller per cart**

### 7.3 Bundle Request Flow

```
Buyer                    System                    Seller
  |                        |                         |
  |-- Create Request ----->|                         |
  |                        |-- Notify Seller ------->|
  |                        |                         |
  |                        |<-- Respond (Accept/Decline/Counter)
  |<-- Notify Buyer -------|                         |
  |                        |                         |
  |-- Accept Counter ----->| (if counter-offered)    |
  |                        |-- Notify Seller ------->|
  |                        |                         |
  |-- Checkout ----------->| (if accepted)           |
  |                        |-- Create Order -------->|
```

### 7.4 Bundle Request Processing

```ts
async function createBundleRequest(input: CreateBundleRequestInput): Promise<BundleRequest> {
  // Validate minimums
  if (input.listingIds.length < 2) throw new Error("MIN_ITEMS_NOT_MET");
  
  // Check daily limit
  const todayCount = await getBundleRequestCount(input.buyerId, startOfDay());
  if (todayCount >= 5) throw new Error("DAILY_LIMIT_EXCEEDED");
  
  // Calculate original totals
  const listings = await getListings(input.listingIds);
  const originalSubtotalCents = listings.reduce((sum, l) => {
    const qty = input.quantities[l.id] ?? 1;
    return sum + (l.priceCents * qty);
  }, 0);
  
  if (originalSubtotalCents < 2000) throw new Error("MIN_VALUE_NOT_MET");
  
  // Create request
  const request = await db.bundleRequest.create({
    data: {
      ...input,
      originalSubtotalCents,
      originalShippingCents: await estimateShipping(input.sellerId, input.listingIds),
      originalTotalCents: originalSubtotalCents + shippingCents,
      expiresAt: addHours(new Date(), 48),
    },
  });
  
  // Notify seller
  await sendNotification(input.sellerId, "BUNDLE_REQUEST_RECEIVED", {
    requestId: request.id,
    itemCount: input.listingIds.length,
  });
  
  return request;
}

async function respondToBundleRequest(input: {
  requestId: string;
  sellerId: string;
  action: "accept" | "decline" | "counter";
  counterOfferCents?: number;
  message?: string;
}): Promise<BundleRequest> {
  const request = await getRequest(input.requestId);
  if (request.sellerId !== input.sellerId) throw new Error("UNAUTHORIZED");
  if (request.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");
  if (request.expiresAt < new Date()) throw new Error("REQUEST_EXPIRED");
  
  switch (input.action) {
    case "accept":
      return updateRequest(request.id, {
        status: "ACCEPTED",
        acceptedTotalCents: request.proposedTotalCents ?? request.originalTotalCents,
        acceptedDiscountCents: request.originalTotalCents - (request.proposedTotalCents ?? request.originalTotalCents),
        respondedAt: new Date(),
      });
      
    case "decline":
      return updateRequest(request.id, {
        status: "DECLINED",
        respondedAt: new Date(),
      });
      
    case "counter":
      if (!input.counterOfferCents) throw new Error("COUNTER_AMOUNT_REQUIRED");
      return updateRequest(request.id, {
        status: "COUNTER_OFFERED",
        counterOfferCents: input.counterOfferCents,
        counterOfferMessage: input.message,
        counterOfferExpiresAt: addHours(new Date(), 24),
        respondedAt: new Date(),
      });
  }
}
```

---

## 8. Order Lifecycle States

Orders MUST conform to the Core Commerce State Machines.

| State | Description |
|-------|-------------|
| CREATED | Order record created |
| AWAITING_PAYMENT | Awaiting payment confirmation |
| PAID | Funds confirmed |
| FULFILLMENT_PENDING | Awaiting shipment |
| SHIPPED | Carrier scan confirmed |
| DELIVERED | Carrier delivery confirmed |
| COMPLETED | Post-delivery window elapsed |
| CANCELED | Order voided |
| DISPUTED | Under dispute review |
| REFUNDED | Funds returned to buyer |
| PARTIAL_REFUND | Partial funds returned |
| RETURN_REQUESTED | Buyer requested return |
| RETURN_APPROVED | Return authorized |
| RETURN_DECLINED | Return denied |
| RETURN_IN_TRANSIT | Return shipment in progress |
| RETURNED | Item returned to seller |

---

## 9. Order Creation

### 9.1 Preconditions

- Listing must be ACTIVE
- Inventory must be available
- Buyer passes risk checks
- Bundle requirements met (if bundle order)
- Bundle request accepted (if negotiated order)

### 9.2 Order Model Extensions

```ts
type Order = {
  // ... existing fields ...
  
  // Bundle tracking (NEW)
  bundleDiscountCents: number;
  appliedBundleId?: string;
  bundleRequestId?: string;
  
  // Type indicator
  orderType: "STANDARD" | "BUNDLE" | "NEGOTIATED";
};
```

### 9.3 Atomicity

Order creation MUST:
1. Reserve inventory (hard reservation)
2. Create order record with bundle discount
3. Initiate payment intent
4. Mark bundle request as converted (if applicable)

```ts
async function createOrder(input: CreateOrderInput) {
  return db.$transaction(async (tx) => {
    // Reserve inventory
    for (const item of input.items) {
      await reserveInventory(tx, item.listingId, item.variantId, item.quantity);
    }
    
    // Calculate totals with bundle discount
    const itemSubtotal = input.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    const total = itemSubtotal + input.shippingCents + input.taxCents - input.bundleDiscountCents;
    
    // Create order
    const order = await tx.order.create({
      data: {
        ...input,
        totalCents: total,
        orderType: input.bundleRequestId ? "NEGOTIATED" : input.appliedBundleId ? "BUNDLE" : "STANDARD",
      },
    });
    
    // Mark bundle request converted
    if (input.bundleRequestId) {
      await tx.bundleRequest.update({
        where: { id: input.bundleRequestId },
        data: { status: "CONVERTED" },
      });
    }
    
    // Create payment intent
    await createPaymentIntent(order);
    
    return order;
  });
}
```

---

## 10. Combined Shipping with Bundles

### 10.1 Combined Shipping Rules

When multiple items from same seller:
1. First item pays full shipping rate
2. Additional items pay reduced rate
3. Free shipping threshold applies to pre-bundle subtotal
4. Bundle discount does NOT affect shipping calculation

```ts
function calculateCombinedShipping(items: CartItem[], profile: ShippingProfile): number {
  if (items.length === 0) return 0;
  
  const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  
  // Check free shipping threshold (before bundle discount)
  if (profile.domesticFreeShippingAbove && subtotal >= profile.domesticFreeShippingAbove) {
    return 0;
  }
  
  // First item
  let shipping = profile.domesticFirstItemCents;
  
  // Additional items
  const additionalItems = items.slice(1).reduce((sum, i) => sum + i.quantity, 0) + 
                          (items[0].quantity - 1);
  shipping += additionalItems * profile.domesticAdditionalItemCents;
  
  return shipping;
}
```

---

## 11. Cancellations

### 11.1 Buyer Cancellations

- Free cancel window: 5 minutes (configurable)
- After window: requires seller approval
- Bundle orders: all items or none (no partial cancel)

### 11.2 Seller Cancellations

- Allowed before shipment
- Requires reason code
- Counts as defect (unless buyer-requested or fraud)
- Bundle orders: full cancel only

### 11.3 Inventory Release

```ts
async function cancelOrder(orderId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    
    // Release all inventory
    await releaseInventory(tx, orderId);
    
    // Update order
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
    
    // If bundle order, update bundle stats
    if (order.appliedBundleId) {
      await tx.sellerBundle.update({
        where: { id: order.appliedBundleId },
        data: { conversionCount: { decrement: 1 } },
      });
    }
  });
}
```

---

## 12. Platform Settings

| Setting | Default | Description |
|---------|---------|-------------|
| SELLER_BUNDLES_ENABLED | true | Allow seller bundles |
| MAX_BUNDLES_PER_SELLER | 50 | Bundle limit per seller |
| MAX_BUNDLE_DISCOUNT_PERCENT | 50 | Max discount allowed |
| MIN_BUNDLE_ITEMS | 2 | Minimum items for bundle |
| SMART_PROMPTS_ENABLED | true | Show cart prompts |
| MAX_PROMPTS_PER_CART | 3 | Prompt limit |
| MAKE_ME_A_DEAL_ENABLED | true | Allow negotiation |
| MIN_ITEMS_FOR_DEAL | 2 | Min items for request |
| MIN_VALUE_FOR_DEAL_CENTS | 2000 | Min cart value ($20) |
| REQUEST_EXPIRATION_HOURS | 48 | Request timeout |
| COUNTER_OFFER_EXPIRATION_HOURS | 24 | Counter timeout |
| MAX_REQUESTS_PER_BUYER_DAY | 5 | Abuse prevention |
| BUYER_FREE_CANCEL_WINDOW_MINUTES | 5 | Free cancel period |
| CART_RESERVATION_MINUTES | 15 | Inventory hold time |

---

## 13. RBAC & Permissions

| Action | Permission |
|--------|------------|
| Add to cart | public |
| Checkout | buyer |
| Create bundle | seller (self) |
| Manage bundles | seller (self) |
| Send bundle request | buyer |
| Respond to bundle request | seller (self) |
| Mark shipped | seller (self) or delegated |
| Cancel order | seller (self) or delegated |
| Force cancel | support |
| Configure bundle settings | orders.admin |

---

## 14. Health Checks

| Check | Pass Condition |
|-------|----------------|
| Stale cart reservations | <100 expired reservations |
| Pending bundle requests | <50 requests >24h without response |
| Expired bundle requests | All expired requests cleaned up |
| Bundle usage accuracy | Usage counts match order counts |
| Overdue shipments | <10 orders past ship-by date |

---

## 15. Audit Requirements

**Must emit audit events:**
- Cart conversion
- Bundle created/updated/deactivated
- Bundle applied to cart
- Bundle request created/responded/converted
- Order state transitions
- Cancellations
- Shipment confirmation

---

## 16. Integration Points

| System | Integration |
|--------|-------------|
| Payments | PaymentIntent for checkout |
| Inventory | Reservations and deductions |
| Shipping | Profile lookup, label generation |
| Notifications | Bundle request alerts, prompts |
| Analytics | Bundle performance tracking |
| Promotions | Bundle + coupon stacking rules |

---

## 17. Out of Scope

- Split shipments
- Auction orders
- Subscription orders
- International shipping rules (see Phase 40)

---

## 18. Final Rule

Orders exist to:
**protect buyers, pay sellers, and keep the platform solvent**.

Bundles exist to:
**incentivize larger purchases while giving sellers pricing flexibility**.

Negotiations exist to:
**let buyers and sellers find mutually beneficial deals**.

**If behavior is not defined here, it must be added to this canonical.**
