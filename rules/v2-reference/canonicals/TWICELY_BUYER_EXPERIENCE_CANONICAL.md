# TWICELY_BUYER_EXPERIENCE_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Buyer journey, cart, checkout, engagement features, messaging, reviews, guarantees, and post-purchase experience.  
**Audience:** Product, frontend, backend, trust, support, and AI agents.  
**Non-Goal:** Seller ops, payout logic, or internal admin tooling.

---

## 1. Purpose

This canonical defines the **buyer-facing truth** of Twicely.
It ensures buyers experience:
- clarity
- predictability
- trust
- protection without abuse

If behavior is not defined here, it must not exist.

---

## 2. Core Principles

1. **Buyers are protected, not privileged**
2. **Clarity beats cleverness**
3. **Checkout must be fast and obvious**
4. **Post-purchase confidence matters**
5. **Buyer actions are auditable**
6. **Engagement features drive retention**

---

## 3. Buyer Types

| Type | Description |
|---|---|
| GUEST | One-time checkout, limited actions |
| REGISTERED | Full buyer account |

Rules:
- Guests may add to cart and checkout
- Guests must register to open disputes or leave reviews
- Guest carts merge on registration/login

---

## 4. Buyer Journey (High-Level)

1. Discover listing (search, browse, recommendations)
2. View listing details
3. Add to cart / Save to watchlist
4. Continue shopping or checkout
5. Order confirmation
6. Track shipment
7. Receive item
8. Review / return / dispute (if needed)

---

## 5. Shopping Cart

### 5.1 Cart Rules
- One active cart per user/session
- Items from multiple sellers allowed
- Each seller's items become separate order at checkout
- Cart validates items before checkout

### 5.2 Cart Actions
| Action | Description |
|---|---|
| Add to cart | Add listing with quantity |
| Update quantity | Change item quantity |
| Remove | Remove item from cart |
| Save for later | Move to saved items |
| Move to cart | Return saved item to active cart |

### 5.3 Cart Validation
Before checkout, cart validates:
- Listing still active
- Inventory available
- Price unchanged (or buyer notified)

---

## 6. Checkout Flow

### 6.1 Preconditions
- Listing is ACTIVE
- Inventory available
- Buyer passes fraud/risk checks

### 6.2 Flow
1. Review cart items
2. Select shipping address
3. Select shipping option per seller
4. Enter payment
5. Review totals (items + shipping + tax)
6. Place order

### 6.3 Multi-Seller Checkout
```ts
async function checkout(cartId: string, buyerId: string) {
  // Validate cart
  await validateCart(cartId);
  
  // Group by seller, create orders
  const orderIds = await convertCartToOrders(cartId, buyerId);
  
  // Initiate combined payment
  await initiatePayment(orderIds, paymentMethodId);
  
  return orderIds;
}
```

---

## 7. Buyer Engagement Features

### 7.1 Watchlist

Buyers may save listings for later consideration.

```ts
type WatchlistItem = {
  id: string;
  userId: string;
  listingId: string;
  addedAt: Date;
  notifyOnPriceDrop: boolean;
  notifyOnEndingSoon: boolean;
  priceWhenAdded: number;
  lowestPriceSeen?: number;
  notes?: string;
};
```

Rules:
- One watchlist per buyer
- No limit on items (practical limit: 1000)
- Price drop notifications if enabled
- Ending soon notifications if enabled
- Watchlist items do NOT reserve inventory

### 7.2 Saved Searches

Buyers may save search queries for quick access and notifications.

```ts
type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  queryJson: {
    keywords?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: string[];
    filters?: Record<string, any>;
  };
  notifyOnNewResults: boolean;
  notifyFrequency: "INSTANT" | "DAILY" | "WEEKLY";
  lastCheckedAt?: Date;
  lastNotifiedAt?: Date;
  createdAt: Date;
};
```

Rules:
- Max 50 saved searches per buyer
- New results notifications if enabled
- Frequency controls notification rate
- Searches may be named for easy identification

### 7.3 Recently Viewed

System tracks recently viewed listings for personalization.

```ts
type RecentlyViewed = {
  id: string;
  userId: string;
  listingId: string;
  viewedAt: Date;
  viewCount: number;
};
```

Rules:
- Last 100 unique listings per buyer
- Older views pushed out (FIFO)
- Used for "Continue browsing" features
- Buyer may clear history
- Does not track guests (session-only)

### 7.4 Buyer Preferences

```ts
type BuyerPreferences = {
  userId: string;
  defaultSortOrder: "RELEVANCE" | "PRICE_LOW" | "PRICE_HIGH" | "NEWEST";
  resultsPerPage: 24 | 48 | 96;
  emailWatchlistAlerts: boolean;
  emailSavedSearches: boolean;
  emailPriceDrops: boolean;
};
```

---

## 8. Payments & Pricing Transparency

- Buyers pay the platform
- All costs shown before confirmation:
  - item price
  - shipping
  - tax
- No post-checkout fees
- Currency locked at checkout

---

## 9. Buyer ↔ Seller Messaging

### 9.1 Rules
- Messaging is **order-scoped only**
- No pre-purchase messaging (v1)
- No off-platform contact info allowed
- Attachments allowed (images only)

```ts
type OrderMessage = {
  orderId: string;
  conversationId: string;
  senderId: string;
  senderRole: "BUYER" | "SELLER";
  body: string;
  createdAt: Date;
};
```

Messages are:
- rate-limited
- moderated
- auditable
- immutable after send

---

## 10. Notifications (Buyer-Facing)

### 10.1 Transactional (Required)
- Order placed
- Payment confirmed
- Order shipped
- Order delivered
- Refund issued
- Dispute updates

### 10.2 Engagement (Optional)
- Price drop on watchlist item
- New results for saved search
- Item ending soon
- Back in stock

Channels:
- Email (required)
- In-app (required)
- Push (optional)

---

## 11. Reviews & Ratings

### 11.1 Eligibility
- Order must be COMPLETED
- One review per order

### 11.2 Review Structure
```ts
type Review = {
  id: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  comment?: string;
  itemAsDescribed: 1 | 2 | 3 | 4 | 5;
  shippingSpeed: 1 | 2 | 3 | 4 | 5;
  communication: 1 | 2 | 3 | 4 | 5;
  photoUrls?: string[];
  createdAt: Date;
};
```

### 11.3 Enforcement
- Reviews may be removed for policy violations
- Ratings impact seller trust score (bounded, non-linear)
- Sellers may respond to reviews (one response per review)

---

## 12. Buyer Protection

Buyers are protected if:
- Payment completed on-platform
- Dispute opened within allowed window
- Evidence provided

Protection may include:
- Full refund
- Partial refund
- Replacement (future)

---

## 13. Returns & Disputes (Buyer Side)

- Buyer may open return/dispute within window
- Buyer must select reason
- Evidence may be required
- Abuse is penalized

```ts
function openBuyerDispute(orderId: string, reason: string) {
  assertDisputeWindowOpen(orderId);
  createDisputeCase(orderId, reason);
}
```

---

## 14. Abuse Prevention

Indicators:
- Excessive disputes
- False claims
- Abusive messaging
- Excessive returns

Actions:
- warnings
- buying restrictions
- account suspension

---

## 15. RBAC & Permissions

| Action | Permission |
|---|---|
| Browse/Search | public |
| Add to cart | public |
| Checkout | buyer |
| Add to watchlist | buyer |
| Save search | buyer |
| Message seller | buyer |
| Open dispute | buyer |
| Leave review | buyer |
| Remove review | trust |
| Override buyer status | admin |

---

## 16. Audit & Logging

Audit events required for:
- disputes opened
- reviews submitted/removed
- buyer restrictions
- watchlist price alerts triggered

---

## 17. Out of Scope

- Loyalty programs
- Buyer subscriptions
- Buyer advertising
- Social features (following sellers)

---

## 18. Final Rule

The buyer experience exists to **build trust without enabling exploitation**.

If behavior is not defined here, it must be rejected or added to this canonical.
