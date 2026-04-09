# TWICELY V3 — Integration Test Prompt

**Purpose:** Instructions for Claude Code to create comprehensive integration and E2E tests covering all critical user flows.

---

## TEST FRAMEWORK

- Unit/Integration: Vitest
- E2E: Playwright
- Test DB: Neon branch or local PostgreSQL (seeded before each suite)
- Stripe: test mode (`sk_test_xxx`, card `4242424242424242`)
- All tests must be deterministic and isolated

---

## CRITICAL HAPPY PATHS

### 1. Browse → Search → Buy
```
1. GET / → homepage renders, featured listings visible
2. GET /s?q=vintage+dress → search results returned
3. GET /i/[slug] → listing detail renders with price, images, seller info
4. POST /api/cart/add → item added to cart
5. GET /cart → cart renders with item, subtotal, shipping
6. POST /api/checkout → Stripe payment intent created
7. POST /api/checkout/confirm → order created (PAID), inventory decremented
8. Assert: order in DB with correct totals, ledger entries created (TF, Stripe fee)
```

### 2. List Item → Activate → Sell
```
1. POST /api/listings → draft created
2. PUT /api/listings/[id] → fill required fields
3. POST /api/listings/[id]/images → upload images
4. POST /api/listings/[id]/activate → status ACTIVE, activatedAt set
5. Assert: listing searchable, appears in seller dashboard
```

### 3. Offer → Accept → Order
```
1. POST /api/offers → buyer submits offer (Stripe hold created)
2. Assert: offer status PENDING, hold captured
3. POST /api/offers/[id]/accept → seller accepts
4. Assert: hold converted to charge, order created, listing marked SOLD
```

### 4. Offer → Counter → Accept
```
1. POST /api/offers → buyer offers $50
2. POST /api/offers/[id]/counter → seller counters at $65
3. Assert: old hold released, new hold at $65
4. POST /api/offers/[id]/accept → buyer accepts counter
5. Assert: charge captured at $65, order created
```

### 5. Offer → Expire
```
1. POST /api/offers → buyer offers, 48hr expiry
2. Advance clock 49 hours
3. Run expiry job
4. Assert: offer EXPIRED, hold released, buyer notified
```

### 6. Return → Refund (Seller Fault)
```
1. Setup: completed order
2. POST /api/returns → buyer requests return (reason: INAD)
3. Assert: return status PENDING_SELLER, bucket SELLER_FAULT
4. POST /api/returns/[id]/approve → seller approves
5. Assert: return label generated, status APPROVED
6. Simulate shipment delivery
7. POST /api/returns/[id]/confirm-receipt → seller confirms
8. Assert: refund issued, TF partially reversed (Twicely keeps original), ledger entries
```

### 7. Return → Partial Refund (Buyer Remorse)
```
1. POST /api/returns → buyer requests return (reason: REMORSE)
2. Assert: bucket BUYER_REMORSE
3. POST /api/returns/[id]/offer-partial → seller offers 85% refund (15% restocking)
4. POST /api/returns/[id]/accept-partial → buyer accepts
5. Assert: partial refund issued, restocking fee applied, buyer pays return shipping
```

### 8. Dispute Escalation
```
1. POST /api/returns → buyer claims INAD
2. POST /api/returns/[id]/decline → seller declines
3. POST /api/disputes → buyer escalates
4. Assert: dispute OPEN, support case created
5. POST /api/disputes/[id]/resolve → staff resolves in buyer's favor
6. Assert: full refund, seller's protection score adjusted
```

### 9. Checkout with Authentication Offer ($500+ item)
```
1. Setup: listing with priceCents = 80000 ($800)
2. GET /i/[slug] → auth option visible
3. POST /api/checkout → include authenticationRequested: true
4. Assert: order.authenticationOffered = true, auth fee added to total
5. Alt: authenticationRequested: false
6. Assert: order.authenticationDeclined = true, authenticationDeclinedAt set
```

### 10. Local Pickup Flow
```
1. Setup: listing with fulfillmentType = SHIP_AND_LOCAL
2. POST /api/checkout → isLocalPickup: true
3. Assert: order created, localTransaction created, confirmationCode generated
4. POST /api/local/[id]/seller-checkin
5. POST /api/local/[id]/buyer-checkin
6. POST /api/local/[id]/confirm → buyer confirms with code
7. Assert: escrow released, order COMPLETED, 5% local fee in ledger
```

### 11. Combined Shipping — Auto-Discount
```
1. Setup: seller with combinedShippingMode = AUTO_DISCOUNT, 25% discount, minItems 2
2. Buyer adds 3 items from same seller to cart
3. POST /api/checkout
4. Assert: shipping total = sum of individual × 0.75, savings shown
```

### 12. Combined Shipping — Seller-Quoted (48hr Penalty)
```
1. Setup: seller with combinedShippingMode = QUOTED
2. Buyer purchases 2 items → hold at max shipping
3. Assert: combinedShippingQuote created, status PENDING_SELLER
4. Advance clock 49 hours (past deadline)
5. Run penalty job
6. Assert: quote status PENALTY_APPLIED, 25% discount auto-applied
```

---

## ERROR PATHS

### 13. Sold-Out Item at Checkout
```
1. Buyer A and Buyer B both have item in cart
2. Buyer A completes checkout → order created
3. Buyer B attempts checkout → 409 Conflict, item no longer available
```

### 14. Payment Failure
```
1. POST /api/checkout with Stripe test card `4000000000000002` (decline)
2. Assert: order NOT created, user shown payment error, cart preserved
```

### 15. Multi-Seller Cart — Partial Failure
```
1. Cart has items from Seller A and Seller B
2. Seller A's item sells to someone else before checkout completes
3. Assert: Seller B's items still purchasable, Seller A's items removed from cart with message
```

### 16. Unauthorized Access
```
1. GET /my/selling → without auth → redirect to login
2. GET /api/orders/[id] → wrong user → 403
3. POST /api/listings/[id]/edit → not owner → 403
4. GET /hd/* → marketplace user → 403
5. GET /d/* → non-staff → 403
```

### 17. Expired Offer + Concurrent Purchase
```
1. Buyer A has pending offer on listing
2. Buyer B purchases listing at full price
3. Assert: Buyer A's offer auto-declined, hold released
```

---

## CASL AUTHORIZATION TESTS

Test each actor type against expected permissions:

| Actor | Can | Cannot |
|-------|-----|--------|
| Guest | Browse, search, view listings | Purchase, message, review |
| Buyer | Purchase, message sellers, review, file claims | List items, access seller dashboard |
| Seller | List items, manage orders, view analytics | Access other sellers' data |
| Delegate | Scoped actions per permission set | Actions outside permission scope |
| Staff | Access hub, manage users, resolve disputes | SUPER_ADMIN-only actions |
| Super Admin | Everything | Nothing restricted |

---

## PERFORMANCE TESTS

```
1. Search with 10,000 listings → P95 < 200ms
2. Homepage with 50 featured listings → LCP < 2.5s
3. Listing detail page → TTFB < 200ms
4. Cart with 20 items from 5 sellers → checkout total calculation < 100ms
5. Concurrent: 50 users browsing + 10 purchasing simultaneously → no errors
```

---

## TEST FILE STRUCTURE

```
tests/
  unit/
    fees/
      tf.test.ts
      combined-shipping.test.ts
      auth-cost-split.test.ts
      local-fee.test.ts
    permissions/
      casl-buyer.test.ts
      casl-seller.test.ts
      casl-staff.test.ts
    state-machines/
      order-status.test.ts
      return-status.test.ts
      offer-status.test.ts
      auth-status.test.ts
  integration/
    cart.test.ts
    checkout.test.ts
    offers.test.ts
    returns.test.ts
    subscriptions.test.ts
    local-transactions.test.ts
    authentication.test.ts
    financial-center.test.ts
  e2e/
    browse-and-buy.spec.ts
    list-item.spec.ts
    offer-flow.spec.ts
    return-flow.spec.ts
    local-pickup.spec.ts
    seller-dashboard.spec.ts
    admin-dashboard.spec.ts
```
