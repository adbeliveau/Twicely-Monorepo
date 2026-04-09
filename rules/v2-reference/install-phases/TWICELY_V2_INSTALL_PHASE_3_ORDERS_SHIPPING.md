# TWICELY V2 - Install Phase 3: Cart + Orders + Fulfillment + Shipping
**Status:** LOCKED (v1.6)  
**Backend-first:** Schema  ->  API  ->  Audit  ->  Health  ->  UI  ->  Doctor  
**Canonicals:** TWICELY_ORDERS_FULFILLMENT_CANONICAL.md, TWICELY_SHIPPING_RETURNS_LOGISTICS_CANONICAL.md, TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_3_ORDERS_SHIPPING.md`  
> Prereq: Phase 2 complete and Doctor passes Phase 2.

---

## 0) What this phase installs

### Backend
- **Cart + CartItem models (CRITICAL-2 fix)**
- Cart reservations for inventory hold
- Order + OrderItem models
- Complete OrderStatus enum including return states
- Inventory reservation (atomic with order create)
- Shipment model + tracking
- Handling SLA fields and late-shipment flags
- Seller shipping profiles with combined shipping rates
- Order state machine with valid transitions
- Multi-seller cart -> multiple orders conversion
- **Order Cancellation System** (buyer/seller rules, free window, abuse prevention)
- **Combined Shipping Calculation** (first item + additional item rates)
- **CheckoutSession** for multi-seller single payment tracking
- Buyer cancel abuse tracking and restrictions

### UI (minimal)
- Buyer: cart, order list, order details, cancel order
- Seller: fulfill order (add tracking / create label), respond to cancel requests
- Corp: order lookup (read-only), cancellation policy settings

### Ops
- Health provider: `orders`
- Doctor checks: cart operations, inventory reservation, order transitions

---

## 1) Prisma Schema

```prisma
// =============================================================================
// SHOPPING CART (CRITICAL-2)
// =============================================================================

enum CartStatus {
  ACTIVE          // Currently being used
  MERGED          // Merged into another cart (guest  ->  logged in)
  CONVERTED       // Converted to order(s)
  ABANDONED       // Left without checkout
  EXPIRED         // Session expired
}

model Cart {
  id              String      @id @default(cuid())
  
  // Owner (nullable for guest carts)
  userId          String?
  sessionId       String?     // For guest carts
  
  // Status
  status          CartStatus  @default(ACTIVE)
  
  // Totals (denormalized for performance)
  itemCount       Int         @default(0)
  subtotalCents   Int         @default(0)
  currency        String      @default("USD")
  
  // Conversion tracking
  convertedToOrderIds String[] @default([])
  
  // Expiry
  expiresAt       DateTime?
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  lastActivityAt  DateTime    @default(now())

  // Relations
  items           CartItem[]
  appliedCoupons  CartCoupon[]

  // Bundle Builder relations (v1.7)
  appliedBundles  CartBundle[]
  bundleRequests  BundleRequest[]

  @@unique([userId, status], name: "user_active_cart")
  @@index([sessionId, status])
  @@index([status, expiresAt])
  @@index([updatedAt])
}

model CartItem {
  id              String    @id @default(cuid())
  cartId          String
  cart            Cart      @relation(fields: [cartId], references: [id], onDelete: Cascade)

  // =========================================================================
  // ITEM REFERENCE
  // =========================================================================
  listingId       String

  // Variation support (Phase 41/44 integration)
  // For listings with variations, this references the specific SKU
  listingChildId  String?   // References ListingChild.id if variation selected

  // Snapshot of selected variation options (for display/audit)
  // Format: { "Size": "Medium", "Color": "Blue" }
  variationsJson  Json?     @default("{}")

  // =========================================================================
  // QUANTITY
  // =========================================================================
  quantity        Int       @default(1)

  // =========================================================================
  // PRICE SNAPSHOT (captured when added)
  // =========================================================================
  priceCents      Int
  currency        String    @default("USD")

  // Original price (for showing savings)
  originalPriceCents Int?

  // =========================================================================
  // SELLER (denormalized for cart grouping)
  // =========================================================================
  sellerId        String

  // =========================================================================
  // VALIDATION STATE
  // =========================================================================
  isAvailable     Boolean   @default(true)
  unavailableReason String?  // SOLD_OUT, LISTING_REMOVED, PRICE_CHANGED, VARIATION_UNAVAILABLE

  // =========================================================================
  // FLAGS
  // =========================================================================
  isSavedForLater Boolean   @default(false)

  // =========================================================================
  // BUNDLE BUILDER (v1.7)
  // =========================================================================
  bundleId              String?
  bundleDiscountCents   Int       @default(0)

  // =========================================================================
  // TIMESTAMPS
  // =========================================================================
  addedAt         DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // =========================================================================
  // CONSTRAINTS
  // =========================================================================
  // Unique on listing + variation combination (allows same listing with different variations)
  @@unique([cartId, listingId, listingChildId])

  // =========================================================================
  // INDEXES
  // =========================================================================
  @@index([cartId, isSavedForLater])
  @@index([listingId])
  @@index([listingChildId])
  @@index([sellerId])
  @@index([bundleId])
}

model CartCoupon {
  id              String    @id @default(cuid())
  cartId          String
  cart            Cart      @relation(fields: [cartId], references: [id], onDelete: Cascade)
  
  couponCode      String
  couponId        String?
  
  // Discount details
  discountType    String    // PERCENT, FIXED_AMOUNT, FREE_SHIPPING
  discountValue   Int
  
  // Applied amount
  appliedAmountCents Int    @default(0)
  
  // Scope
  appliesToSellerId String?
  
  createdAt       DateTime  @default(now())

  @@unique([cartId, couponCode])
}

model CartReservation {
  id              String    @id @default(cuid())
  cartId          String
  cartItemId      String
  listingId       String
  
  // Reservation details
  quantity        Int
  
  // Expiry (short-lived hold)
  expiresAt       DateTime
  
  // Status
  isActive        Boolean   @default(true)
  releasedAt      DateTime?
  releaseReason   String?
  
  createdAt       DateTime  @default(now())

  @@unique([cartId, listingId])
  @@index([listingId, isActive])
  @@index([expiresAt, isActive])
}

// =============================================================================
// ORDER STATUS ENUM — REFERENCE ONLY
// =============================================================================

> **⚠️ AUTHORITATIVE SOURCE:** OrderStatus is defined in `TWICELY_LOCK_ENUMS_AND_STATES.md`
>
> **DO NOT** redefine this enum in phase docs. The canonical 17-state enum is:
>
> ```
> CREATED, AWAITING_PAYMENT, PAID, AWAITING_FULFILLMENT, FULFILLED,
> DELIVERED, COMPLETED, CANCELED, RETURN_REQUESTED, RETURN_APPROVED,
> RETURN_IN_TRANSIT, RETURNED, REFUNDED, PARTIAL_REFUNDEDED, DISPUTED, CLOSED
> ```

### Order State Mapping for Phase 3

This phase implements the following state transitions:

| Action | From State | To State | Trigger |
|--------|------------|----------|---------|
| Create order | — | `CREATED` | Checkout initiated |
| Initiate payment | `CREATED` | `AWAITING_PAYMENT` | Payment intent created |
| Payment confirmed | `AWAITING_PAYMENT` | `PAID` | Webhook: `payment_intent.succeeded` |
| Ready to fulfill | `PAID` | `AWAITING_FULFILLMENT` | Auto after payment |
| Mark shipped | `AWAITING_FULFILLMENT` | `FULFILLED` | Seller adds tracking |
| Delivery confirmed | `FULFILLED` | `DELIVERED` | Carrier webhook or manual |
| Auto-complete | `DELIVERED` | `COMPLETED` | 7-day window passes |
| Close order | `COMPLETED` | `CLOSED` | Terminal state |
| Cancel order | `CREATED`/`AWAITING_PAYMENT` | `CANCELED` | Buyer/seller/timeout |
| Close cancelled | `CANCELED` | `CLOSED` | Terminal state |

### Return Flow (Phase 14 Implements Full Logic)

| Action | From State | To State |
|--------|------------|----------|
| Request return | `DELIVERED` | `RETURN_REQUESTED` |
| Approve return | `RETURN_REQUESTED` | `RETURN_APPROVED` |
| Ship return | `RETURN_APPROVED` | `RETURN_IN_TRANSIT` |
| Receive return | `RETURN_IN_TRANSIT` | `RETURNED` |
| Process refund | `RETURNED` | `REFUNDED` or `PARTIAL_REFUNDEDED` |
| Close return | `REFUNDED`/`PARTIAL_REFUNDEDED` | `CLOSED` |

### Dispute Flow (Phase 14/33 Implements Full Logic)

| Action | From State | To State |
|--------|------------|----------|
| Dispute opened | `PAID`/`FULFILLED`/`DELIVERED` | `DISPUTED` |
| Dispute resolved | `DISPUTED` | `REFUNDED` or `COMPLETED` |
| Close dispute | `REFUNDED`/`COMPLETED` | `CLOSED` |

// =============================================================================
// ORDER CANCELLATION (eBay-exact rules)
// =============================================================================

enum CancelInitiator {
  BUYER
  SELLER
  SYSTEM      // Auto-cancel (payment failed, timeout)
  PLATFORM    // Admin/support intervention
}

enum BuyerCancelReason {
  PURCHASED_BY_MISTAKE
  FOUND_CHEAPER_ELSEWHERE
  CHANGED_MIND
  SHIPPING_TOO_SLOW
  SHIPPING_TOO_EXPENSIVE
  PAYMENT_ISSUE
  OTHER
}

enum SellerCancelReason {
  OUT_OF_STOCK
  ITEM_DAMAGED
  ITEM_LOST
  BUYER_REQUESTED
  PRICING_ERROR
  CANNOT_SHIP_TO_ADDRESS
  SUSPECTED_FRAUD
  OTHER
}

enum CancelRequestStatus {
  PENDING           // Awaiting approval
  APPROVED          // Cancel approved
  DENIED            // Cancel denied
  AUTO_APPROVED     // System auto-approved (within free cancel window)
  WITHDRAWN         // Requester withdrew request
}

// =============================================================================
// SHIPPING PROFILE
// =============================================================================

model ShippingProfile {
  id                      String   @id @default(cuid())
  sellerId                String
  name                    String
  isDefault               Boolean  @default(false)

  // ==========================================================================
  // SHIPPING RATES
  // ==========================================================================

  // Domestic shipping
  domesticFirstItemCents      Int      @default(0)   // First item shipping cost
  domesticAdditionalItemCents Int      @default(0)   // Each additional item
  domesticFreeShippingAbove   Int?                   // Free shipping threshold (cents)

  // International shipping (if enabled)
  internationalFirstItemCents     Int?
  internationalAdditionalItemCents Int?
  internationalFreeShippingAbove  Int?

  // ==========================================================================
  // HANDLING
  // ==========================================================================
  handlingDays        Int      @default(3)
  handlingDaysMax     Int?

  // ==========================================================================
  // COMBINED SHIPPING RULES
  // ==========================================================================
  combinedShippingEnabled Boolean @default(true)

  // Max items for combined shipping (0 = unlimited)
  combinedShippingMaxItems Int    @default(0)

  // ==========================================================================
  // OTHER
  // ==========================================================================
  returnAddressJson   Json     @default("{}")
  servicesJson        Json     @default("[]")  // Carrier/service options
  domesticOnly        Boolean  @default(true)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([sellerId, isDefault])
  @@index([sellerId])
}

// =============================================================================
// SHIPPING POLICY SETTINGS (Admin Configurable)
// =============================================================================

model ShippingPolicySettings {
  id                        String   @id @default(cuid())
  version                   String
  effectiveAt               DateTime
  isActive                  Boolean  @default(true)

  // Default Handling Times
  defaultHandlingTimeDays   Int      @default(3)
  maxHandlingTimeDays       Int      @default(10)

  // Shipping SLAs
  lateShipmentThresholdDays Int      @default(1)
  trackingRequiredAboveCents Int     @default(5000)   // $50
  signatureRequiredAboveCents Int    @default(75000)  // $750

  // Carrier Settings
  enabledCarriers           String[] @default(["USPS", "UPS", "FEDEX"])
  defaultCarrier            String   @default("USPS")

  // Label Generation
  labelGenerationEnabled    Boolean  @default(true)
  labelDiscountPercentage   Int      @default(0)

  // Insurance
  autoInsureAboveCents      Int      @default(10000)  // $100
  maxInsuranceCents         Int      @default(500000) // $5000

  // Return Shipping
  returnLabelFundingModel   String   @default("seller") // seller|buyer|platform

  // Audit
  createdByStaffId          String
  createdAt                 DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

// =============================================================================
// ORDER
// =============================================================================

model Order {
  id              String      @id @default(cuid())
  
  // Parties
  buyerId         String
  sellerId        String
  
  // Status (state machine)
  status          OrderStatus @default(CREATED)

  // Cart reference
  sourceCartId    String?

  // Money summary
  itemSubtotalCents   Int     @default(0)
  shippingCents       Int     @default(0)
  taxCents            Int     @default(0)
  discountCents       Int     @default(0)
  totalCents          Int     @default(0)
  currency            String  @default("USD")

  // Shipping info
  shippingAddressJson Json    @default("{}")
  shippingOptionJson  Json    @default("{}")
  shippingProfileId   String?

  // Billing info
  billingAddressJson  Json    @default("{}")

  // Buyer notes
  buyerNote           String?
  
  // Gift options
  isGift              Boolean @default(false)
  giftMessage         String?

  // Timestamps (state machine)
  paidAt              DateTime?
  shippedAt           DateTime?
  deliveredAt         DateTime?
  completedAt         DateTime?
  canceledAt          DateTime?
  disputedAt          DateTime?
  refundedAt          DateTime?
  
  // Return timestamps
  returnRequestedAt   DateTime?
  returnApprovedAt    DateTime?
  returnDeclinedAt    DateTime?
  returnInTransitAt   DateTime?
  returnedAt          DateTime?

  // SLA tracking
  expectedShipByAt    DateTime?
  expectedDeliveryAt  DateTime?

  // ==========================================================================
  // CANCELLATION TRACKING
  // ==========================================================================

  canceledByUserId    String?           // Who initiated cancel
  cancelInitiator     CancelInitiator?  // BUYER | SELLER | SYSTEM | PLATFORM
  cancelReason        String?           // BuyerCancelReason or SellerCancelReason value
  cancelReasonDetails String?           // Free text
  cancelRequestId     String?           // Link to OrderCancelRequest if was requested

  // Was this a "free window" cancel (no penalty)?
  wasFreeWindowCancel Boolean @default(false)

  // Defect tracking (for seller cancels)
  cancelCountsAsDefect Boolean @default(false)

  // Multi-order checkout tracking
  checkoutSessionId     String?       // Links orders from same checkout
  paymentIntentId       String?       // Shared PaymentIntent ID

  // Shipping breakdown for transparency
  shippingBreakdownJson Json?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations
  items               OrderItem[]
  shipment            Shipment?
  payment             OrderPayment?
  returnShipment      ReturnShipment?
  cancelRequests      OrderCancelRequest[]

  @@index([buyerId, createdAt])
  @@index([sellerId, createdAt])
  @@index([status])
  @@index([sourceCartId])
  @@index([checkoutSessionId])
  @@index([paymentIntentId])
}

// =============================================================================
// ORDER ITEM
// =============================================================================

model OrderItem {
  id              String  @id @default(cuid())
  orderId         String
  order           Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  listingId       String
  listingSnapshotJson Json @default("{}")
  
  title           String
  quantity        Int
  unitPriceCents  Int
  currency        String  @default("USD")
  
  // Item-level tracking
  status          String  @default("pending")
  
  createdAt       DateTime @default(now())

  @@index([listingId])
  @@index([orderId])
}

// =============================================================================
// INVENTORY RESERVATION
// Per Phase 41 Variations integration
// =============================================================================

enum ReservationStatus {
  PENDING     // Initial reservation, awaiting confirmation
  RESERVED    // Confirmed reservation
  RELEASED    // Released back to available inventory
  CONSUMED    // Converted to order/sale
  EXPIRED     // Timed out without confirmation
}

model InventoryReservation {
  id          String            @id @default(cuid())
  
  // Listing reference (always required)
  listingId   String
  listing     Listing           @relation(fields: [listingId], references: [id], onDelete: Cascade)
  
  // ==========================================================================
  // Variation Support (Phase 41 Integration)
  // If variantId is null, reservation applies to base listing quantity
  // If variantId is set, reservation applies to specific variant quantity
  // ==========================================================================
  variantId   String?
  variant     ListingVariant?   @relation(fields: [variantId], references: [id], onDelete: SetNull)
  
  // Order reference (set when reservation is confirmed)
  orderId     String?
  order       Order?            @relation(fields: [orderId], references: [id], onDelete: SetNull)
  
  // Reservation details
  quantity    Int
  status      ReservationStatus @default(PENDING)
  
  // Expiration (for cart/checkout holds)
  expiresAt   DateTime?         // When this reservation expires if not confirmed
  
  // Timestamps
  reservedAt  DateTime          @default(now())
  confirmedAt DateTime?         // When status changed to RESERVED
  releasedAt  DateTime?         // When status changed to RELEASED
  consumedAt  DateTime?         // When status changed to CONSUMED
  
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  // ==========================================================================
  // Indexes
  // ==========================================================================
  @@index([listingId, status])
  @@index([variantId, status])
  @@index([orderId])
  @@index([expiresAt])
  @@index([status, expiresAt])  // For cleanup job
}

// =============================================================================
// SHIPMENT (Outbound)
// =============================================================================

enum ShipmentStatus {
  PENDING
  LABEL_CREATED
  FULFILLED
  IN_TRANSIT
  OUT_FOR_DELIVERY
  DELIVERED
  EXCEPTION
  RETURNED_TO_SENDER
}

model Shipment {
  id              String         @id @default(cuid())
  orderId         String         @unique
  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)

  carrier         String?
  service         String?
  tracking        String?
  labelUrl        String?
  status          ShipmentStatus @default(PENDING)

  // Costs
  shippingCostCents   Int?
  insuranceCostCents  Int?
  
  // Dimensions/weight
  weightOz        Float?
  lengthIn        Float?
  widthIn         Float?
  heightIn        Float?

  // SLA tracking
  lateShipment    Boolean   @default(false)
  shippedAt       DateTime?
  deliveredAt     DateTime?
  expectedDeliveryAt DateTime?

  // From/To addresses
  fromAddressJson Json      @default("{}")
  toAddressJson   Json      @default("{}")

  // Tracking events
  trackingEventsJson Json   @default("[]")

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([tracking])
  @@index([status])
}

// =============================================================================
// RETURN SHIPMENT
// =============================================================================

model ReturnShipment {
  id              String         @id @default(cuid())
  orderId         String         @unique
  order           Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)

  carrier         String?
  tracking        String?
  labelUrl        String?
  status          ShipmentStatus @default(PENDING)

  // Who pays
  paidBy          String         @default("BUYER") // BUYER|SELLER|PLATFORM

  shippedAt       DateTime?
  deliveredAt     DateTime?

  fromAddressJson Json           @default("{}")
  toAddressJson   Json           @default("{}")

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([tracking])
}

// =============================================================================
// CANCELLATION POLICY SETTINGS (Admin Configurable)
// =============================================================================

model CancellationPolicySettings {
  id                          String   @id @default(cuid())
  version                     String   @unique
  effectiveAt                 DateTime
  isActive                    Boolean  @default(true)

  // ==========================================================================
  // BUYER CANCEL RULES
  // ==========================================================================

  // Free cancellation window (buyer can cancel for any reason, no penalty)
  buyerFreeCancelWindowMinutes    Int  @default(5)      // 5 minutes

  // After free window, buyer must REQUEST cancel (seller approves)
  buyerCanRequestCancelBeforeShip Boolean @default(true)
  buyerCanRequestCancelAfterShip  Boolean @default(false)

  // Buyer abuse thresholds
  buyerCancelAbuseWindowDays      Int  @default(30)     // Rolling window
  buyerCancelAbuseThreshold       Int  @default(5)      // Max cancels in window
  buyerCancelAbusePenaltyType     String @default("WARNING") // WARNING|RESTRICT|SUSPEND
  buyerCancelAbuseCooldownDays    Int  @default(7)      // Restriction duration

  // ==========================================================================
  // SELLER CANCEL RULES
  // ==========================================================================

  // Seller can cancel before shipment (with defect impact)
  sellerCanCancelBeforeShip       Boolean @default(true)
  sellerCanCancelAfterShip        Boolean @default(false)

  // Seller cancel = defect (impacts seller standards)
  sellerCancelCountsAsDefect      Boolean @default(true)

  // Exceptions that don't count as defect
  sellerCancelNoDefectReasons     String[] @default(["BUYER_REQUESTED", "SUSPECTED_FRAUD"])

  // ==========================================================================
  // REFUND RULES ON CANCEL
  // ==========================================================================

  // Auto-refund when order canceled
  autoRefundOnCancel              Boolean @default(true)

  // Refund method
  refundToOriginalPayment         Boolean @default(true)

  // Restocking fee (if seller cancels after buyer paid)
  restockingFeeEnabled            Boolean @default(false)
  restockingFeePercent            Int     @default(0)

  // ==========================================================================
  // SYSTEM CANCEL RULES
  // ==========================================================================

  // Auto-cancel unpaid orders after X hours
  unpaidOrderCancelHours          Int     @default(48)

  // Auto-cancel if payment fails
  autoCancelOnPaymentFailure      Boolean @default(true)

  // Audit
  createdByStaffId                String
  createdAt                       DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

// =============================================================================
// CANCEL REQUEST (For requests that need approval)
// =============================================================================

model OrderCancelRequest {
  id              String              @id @default(cuid())
  orderId         String
  order           Order               @relation(fields: [orderId], references: [id])

  // Who requested
  requestedByUserId   String
  initiator           CancelInitiator

  // Reason
  buyerReason         BuyerCancelReason?
  sellerReason        SellerCancelReason?
  reasonDetails       String?             // Free text explanation

  // Status
  status              CancelRequestStatus @default(PENDING)

  // Response (if requires approval)
  respondedByUserId   String?
  respondedAt         DateTime?
  responseNote        String?
  denialReason        String?

  // Timestamps
  createdAt           DateTime            @default(now())
  expiresAt           DateTime?           // Request expires if not responded

  @@index([orderId])
  @@index([requestedByUserId])
  @@index([status, createdAt])
}

// =============================================================================
// BUYER CANCEL ABUSE TRACKING
// =============================================================================

model BuyerCancelHistory {
  id              String   @id @default(cuid())
  userId          String
  orderId         String

  cancelType      String   // "FREE_WINDOW" | "APPROVED_REQUEST" | "AUTO"
  reason          BuyerCancelReason?

  // Was this flagged as potential abuse?
  flaggedAsAbuse  Boolean  @default(false)

  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
  @@index([userId, flaggedAsAbuse])
}

model BuyerCancelRestriction {
  id              String   @id @default(cuid())
  userId          String   @unique

  restrictionType String   // "WARNING" | "RESTRICT" | "SUSPEND"
  reason          String

  // Counts at time of restriction
  cancelCountInWindow Int
  windowDays          Int

  startsAt        DateTime @default(now())
  endsAt          DateTime?

  // Lifted early?
  liftedAt        DateTime?
  liftedByStaffId String?
  liftedReason    String?

  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([endsAt])
}

// =============================================================================
// CHECKOUT SESSION (Multi-seller single payment)
// =============================================================================

model CheckoutSession {
  id                String   @id @default(cuid())
  cartId            String   @unique
  buyerId           String

  // Payment
  stripePaymentIntentId String?

  // Orders created from this checkout
  orderIds          String[]

  // Totals
  subtotalCents     Int
  shippingCents     Int
  taxCents          Int
  totalCents        Int
  currency          String  @default("USD")

  // Status
  status            String  @default("PENDING") // PENDING|PAID|FAILED|EXPIRED

  paidAt            DateTime?
  createdAt         DateTime @default(now())

  @@index([stripePaymentIntentId])
  @@index([buyerId])
}

// =============================================================================
// SELLER DEFECT (for tracking cancel defects)
// =============================================================================

model SellerDefect {
  id          String   @id @default(cuid())
  sellerId    String
  orderId     String?
  defectType  String   // SELLER_CANCELED_ORDER | LATE_SHIPMENT | CASE_CLOSED_WITHOUT_RESOLUTION
  reason      String?
  occurredAt  DateTime

  // Expiration (defects fall off after X days)
  expiresAt   DateTime?

  createdAt   DateTime @default(now())

  @@index([sellerId, occurredAt])
  @@index([sellerId, defectType])
}
```

Run migration:
```bash
npx prisma migrate dev --name cart_orders_shipping_phase3
```

### CartItem Variations Migration (Phase 41/44 Integration)

For existing databases, run this migration to add variation support to CartItem:

```sql
-- Add variation fields to CartItem
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "listingChildId" TEXT;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "variationsJson" JSONB DEFAULT '{}';

-- Update unique constraint (drop old, add new)
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_listingId_key";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_listingId_listingChildId_key"
  UNIQUE ("cartId", "listingId", "listingChildId");

-- Add index for listingChildId
CREATE INDEX IF NOT EXISTS "CartItem_listingChildId_idx" ON "CartItem"("listingChildId");
```

Or via Prisma:
```bash
npx prisma migrate dev --name cart_item_variation_support
```

---

## 2) Cart Service

Create `packages/core/cart/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CART_EXPIRY_HOURS = 72;
const RESERVATION_MINUTES = 15;

/**
 * Get or create active cart for user/session
 */
export async function getOrCreateCart(args: { userId?: string; sessionId?: string }) {
  if (!args.userId && !args.sessionId) {
    throw new Error("USER_OR_SESSION_REQUIRED");
  }

  const existing = await prisma.cart.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        args.userId ? { userId: args.userId } : {},
        args.sessionId ? { sessionId: args.sessionId } : {},
      ].filter(o => Object.keys(o).length > 0),
    },
    include: { items: { where: { isSavedForLater: false } } },
  });

  if (existing) {
    await prisma.cart.update({
      where: { id: existing.id },
      data: { lastActivityAt: new Date() },
    });
    return existing;
  }

  return prisma.cart.create({
    data: {
      userId: args.userId,
      sessionId: args.sessionId,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + CART_EXPIRY_HOURS * 60 * 60 * 1000),
    },
    include: { items: true },
  });
}

/**
 * Add item to cart (with variation support - Phase 41/44)
 */
export async function addToCart(args: {
  cartId: string;
  listingId: string;
  listingChildId?: string;  // For variations
  quantity?: number;
}) {
  const quantity = args.quantity ?? 1;

  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    include: {
      children: args.listingChildId ? {
        where: { id: args.listingChildId }
      } : false,
    },
  });

  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.status !== "ACTIVE") throw new Error("LISTING_NOT_AVAILABLE");

  // Determine price and availability based on variation selection
  let priceCents = listing.priceCents ?? 0;
  let availableQuantity = listing.quantity ?? 0;
  let variationsJson = {};

  // If variation selected, use child pricing/inventory
  if (args.listingChildId) {
    const child = (listing as any).children?.[0];
    if (!child) throw new Error("VARIATION_NOT_FOUND");
    if (!child.isAvailable) throw new Error("VARIATION_UNAVAILABLE");

    // Use child-specific price if set, otherwise parent price
    priceCents = child.priceCents ?? listing.priceCents ?? 0;
    availableQuantity = child.availableQuantity ?? 0;

    // Capture variation options for display
    variationsJson = child.optionsJson ?? {};
  }

  if (availableQuantity < quantity) throw new Error("INSUFFICIENT_QUANTITY");

  // Check for existing cart item (unique on listing + variation)
  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_listingId_listingChildId: {
        cartId: args.cartId,
        listingId: args.listingId,
        listingChildId: args.listingChildId ?? null,
      },
    },
  });

  if (existing) {
    const newQuantity = existing.quantity + quantity;
    if (availableQuantity < newQuantity) {
      throw new Error("INSUFFICIENT_QUANTITY");
    }

    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: newQuantity },
    });

    await recalculateCartTotals(args.cartId);
    await upsertReservation(args.cartId, updated.id, args.listingId, newQuantity, args.listingChildId);
    return updated;
  }

  const item = await prisma.cartItem.create({
    data: {
      cartId: args.cartId,
      listingId: args.listingId,
      listingChildId: args.listingChildId,
      variationsJson,
      quantity,
      priceCents,
      currency: listing.currency ?? "USD",
      sellerId: listing.ownerUserId,
      originalPriceCents: listing.originalPriceCents,
    },
  });

  await recalculateCartTotals(args.cartId);
  await upsertReservation(args.cartId, item.id, args.listingId, quantity, args.listingChildId);

  return item;
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  if (quantity < 1) {
    return removeFromCart(cartItemId);
  }

  const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!item) throw new Error("ITEM_NOT_FOUND");

  const listing = await prisma.listing.findUnique({ where: { id: item.listingId } });
  if (!listing || (listing.quantity ?? 0) < quantity) {
    throw new Error("INSUFFICIENT_QUANTITY");
  }

  const updated = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });

  await recalculateCartTotals(item.cartId);
  await upsertReservation(item.cartId, item.id, item.listingId, quantity);

  return updated;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(cartItemId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!item) return;

  await prisma.cartItem.delete({ where: { id: cartItemId } });
  await recalculateCartTotals(item.cartId);
  await releaseReservation(item.cartId, item.listingId, "ITEM_REMOVED");
}

/**
 * Save item for later
 */
export async function saveForLater(cartItemId: string) {
  const item = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { isSavedForLater: true },
  });

  await recalculateCartTotals(item.cartId);
  await releaseReservation(item.cartId, item.listingId, "SAVED_FOR_LATER");

  return item;
}

/**
 * Move saved item back to cart
 */
export async function moveToCart(cartItemId: string) {
  const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
  if (!item) throw new Error("ITEM_NOT_FOUND");

  const listing = await prisma.listing.findUnique({ where: { id: item.listingId } });
  if (!listing || listing.status !== "ACTIVE") {
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { isAvailable: false, unavailableReason: "LISTING_UNAVAILABLE" },
    });
    throw new Error("LISTING_UNAVAILABLE");
  }

  if ((listing.quantity ?? 0) < item.quantity) {
    throw new Error("INSUFFICIENT_QUANTITY");
  }

  const updated = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { isSavedForLater: false, isAvailable: true, unavailableReason: null },
  });

  await recalculateCartTotals(item.cartId);
  await upsertReservation(item.cartId, item.id, item.listingId, item.quantity);

  return updated;
}

/**
 * Validate cart before checkout (with variation support - Phase 41/44)
 */
export async function validateCart(cartId: string): Promise<{
  valid: boolean;
  issues: Array<{ itemId: string; listingId: string; listingChildId?: string; issue: string }>;
}> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { where: { isSavedForLater: false } } },
  });

  if (!cart) throw new Error("CART_NOT_FOUND");
  if (cart.items.length === 0) return { valid: false, issues: [{ itemId: "", listingId: "", issue: "CART_EMPTY" }] };

  const issues: Array<{ itemId: string; listingId: string; listingChildId?: string; issue: string }> = [];

  for (const item of cart.items) {
    const listing = await prisma.listing.findUnique({
      where: { id: item.listingId },
      include: {
        children: item.listingChildId ? {
          where: { id: item.listingChildId }
        } : false,
      },
    });

    if (!listing) {
      issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId ?? undefined, issue: "LISTING_NOT_FOUND" });
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { isAvailable: false, unavailableReason: "LISTING_REMOVED" },
      });
      continue;
    }

    if (listing.status !== "ACTIVE") {
      issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId ?? undefined, issue: "LISTING_UNAVAILABLE" });
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { isAvailable: false, unavailableReason: "LISTING_UNAVAILABLE" },
      });
      continue;
    }

    // Variation-specific validation
    if (item.listingChildId) {
      const child = (listing as any).children?.[0];

      if (!child) {
        issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId, issue: "VARIATION_REMOVED" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { isAvailable: false, unavailableReason: "VARIATION_UNAVAILABLE" },
        });
        continue;
      }

      if (!child.isAvailable) {
        issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId, issue: "VARIATION_UNAVAILABLE" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { isAvailable: false, unavailableReason: "VARIATION_UNAVAILABLE" },
        });
        continue;
      }

      if ((child.availableQuantity ?? 0) < item.quantity) {
        issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId, issue: "INSUFFICIENT_VARIATION_QUANTITY" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { isAvailable: false, unavailableReason: "SOLD_OUT" },
        });
        continue;
      }

      // Check variation price changes
      const currentPrice = child.priceCents ?? listing.priceCents ?? 0;
      if (currentPrice !== item.priceCents) {
        issues.push({ itemId: item.id, listingId: item.listingId, listingChildId: item.listingChildId, issue: "PRICE_CHANGED" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { priceCents: currentPrice },
        });
      }
    } else {
      // Non-variation listing validation
      if ((listing.quantity ?? 0) < item.quantity) {
        issues.push({ itemId: item.id, listingId: item.listingId, issue: "INSUFFICIENT_QUANTITY" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { isAvailable: false, unavailableReason: "SOLD_OUT" },
        });
        continue;
      }

      // Check price changes
      if ((listing.priceCents ?? 0) !== item.priceCents) {
        issues.push({ itemId: item.id, listingId: item.listingId, issue: "PRICE_CHANGED" });
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { priceCents: listing.priceCents ?? 0 },
        });
      }
    }
  }

  return { valid: issues.filter(i => i.issue !== "PRICE_CHANGED").length === 0, issues };
}

/**
 * Clear cart
 */
export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.cart.update({
    where: { id: cartId },
    data: { itemCount: 0, subtotalCents: 0 },
  });
  await prisma.cartReservation.updateMany({
    where: { cartId, isActive: true },
    data: { isActive: false, releasedAt: new Date(), releaseReason: "CART_CLEARED" },
  });
}

/**
 * Merge guest cart into user cart
 */
export async function mergeCarts(guestCartId: string, userId: string) {
  const userCart = await getOrCreateCart({ userId });
  const guestCart = await prisma.cart.findUnique({
    where: { id: guestCartId },
    include: { items: true },
  });

  if (!guestCart || guestCart.id === userCart.id) return userCart;

  for (const item of guestCart.items) {
    try {
      await addToCart({ cartId: userCart.id, listingId: item.listingId, quantity: item.quantity });
    } catch {
      // Skip items that can't be merged
    }
  }

  await prisma.cart.update({
    where: { id: guestCartId },
    data: { status: "MERGED" },
  });

  return getOrCreateCart({ userId });
}

/**
 * Convert cart to orders (groups by seller)
 */
export async function convertCartToOrders(cartId: string, userId: string, shippingAddress: any): Promise<string[]> {
  const validation = await validateCart(cartId);
  if (!validation.valid) {
    throw new Error("CART_VALIDATION_FAILED");
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { where: { isSavedForLater: false, isAvailable: true } } },
  });

  if (!cart || cart.items.length === 0) throw new Error("CART_EMPTY");

  // Group items by seller
  const itemsBySeller = new Map<string, typeof cart.items>();
  for (const item of cart.items) {
    const existing = itemsBySeller.get(item.sellerId) ?? [];
    existing.push(item);
    itemsBySeller.set(item.sellerId, existing);
  }

  const orderIds: string[] = [];

  // Create order for each seller
  for (const [sellerId, items] of itemsBySeller) {
    const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

    const order = await prisma.order.create({
      data: {
        buyerId: userId,
        sellerId,
        status: "CREATED",
        sourceCartId: cartId,
        itemSubtotalCents: subtotal,
        totalCents: subtotal,
        currency: cart.currency,
        shippingAddressJson: shippingAddress,
        items: {
          create: items.map((item) => ({
            listingId: item.listingId,
            title: "", // Will be filled from listing
            quantity: item.quantity,
            unitPriceCents: item.priceCents,
            currency: item.currency,
          })),
        },
      },
    });

    orderIds.push(order.id);

    // Create inventory reservations
    for (const item of items) {
      await prisma.inventoryReservation.create({
        data: {
          orderId: order.id,
          listingId: item.listingId,
          quantity: item.quantity,
          status: "RESERVED",
        },
      });

      // Decrement listing quantity
      await prisma.listing.update({
        where: { id: item.listingId },
        data: { quantity: { decrement: item.quantity } },
      });
    }
  }

  // Mark cart as converted
  await prisma.cart.update({
    where: { id: cartId },
    data: { status: "CONVERTED", convertedToOrderIds: orderIds },
  });

  // Release cart reservations
  await prisma.cartReservation.updateMany({
    where: { cartId, isActive: true },
    data: { isActive: false, releasedAt: new Date(), releaseReason: "CHECKOUT_COMPLETE" },
  });

  return orderIds;
}

// Helper functions

async function recalculateCartTotals(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId, isSavedForLater: false, isAvailable: true },
  });

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  await prisma.cart.update({
    where: { id: cartId },
    data: { itemCount, subtotalCents, lastActivityAt: new Date() },
  });
}

async function upsertReservation(cartId: string, cartItemId: string, listingId: string, quantity: number) {
  await prisma.cartReservation.upsert({
    where: { cartId_listingId: { cartId, listingId } },
    update: {
      quantity,
      expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
      isActive: true,
      releasedAt: null,
      releaseReason: null,
    },
    create: {
      cartId,
      cartItemId,
      listingId,
      quantity,
      expiresAt: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
    },
  });
}

async function releaseReservation(cartId: string, listingId: string, reason: string) {
  await prisma.cartReservation.updateMany({
    where: { cartId, listingId, isActive: true },
    data: { isActive: false, releasedAt: new Date(), releaseReason: reason },
  });
}
```

---

## 3) Order State Machine

Create `packages/core/orders/stateMachine.ts`:

```ts
export const ORDER_STATUS = {
  CREATED: "CREATED",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAID: "PAID",
  AWAITING_FULFILLMENT: "AWAITING_FULFILLMENT",
  FULFILLED: "FULFILLED",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  DISPUTED: "DISPUTED",
  REFUNDED: "REFUNDED",
  PARTIAL_REFUNDED: "PARTIAL_REFUNDED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURN_APPROVED: "RETURN_APPROVED",
  RETURN_IN_TRANSIT: "RETURN_IN_TRANSIT",
  RETURNED: "RETURNED",
  CLOSED: "CLOSED",
} as const;

export type OrderStatusType = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  CREATED: ["AWAITING_PAYMENT", "CANCELED"],
  AWAITING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["AWAITING_FULFILLMENT", "FULFILLED", "CANCELED", "REFUNDED"],
  AWAITING_FULFILLMENT: ["FULFILLED", "CANCELED", "REFUNDED"],
  FULFILLED: ["DELIVERED", "RETURN_REQUESTED", "DISPUTED"],
  DELIVERED: ["COMPLETED", "RETURN_REQUESTED", "DISPUTED"],
  COMPLETED: ["RETURN_REQUESTED", "DISPUTED"],
  CANCELED: [],
  DISPUTED: ["REFUNDED", "PARTIAL_REFUNDED", "COMPLETED"],
  REFUNDED: ["CLOSED"],
  PARTIAL_REFUNDED: ["CLOSED"],
  RETURN_REQUESTED: ["RETURN_APPROVED"],
  RETURN_APPROVED: ["RETURN_IN_TRANSIT"],
  RETURN_IN_TRANSIT: ["RETURNED"],
  RETURNED: ["REFUNDED", "PARTIAL_REFUNDED"],
  COMPLETED: ["CLOSED"],
  CANCELED: ["CLOSED"],
  CLOSED: [],
};

export function isValidOrderTransition(from: OrderStatusType, to: OrderStatusType): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canCancelOrder(status: OrderStatusType): boolean {
  return ["CREATED", "AWAITING_PAYMENT", "PAID", "AWAITING_FULFILLMENT"].includes(status);
}

export function getTimestampFieldForStatus(status: OrderStatusType): string | null {
  const map: Record<string, string> = {
    PAID: "paidAt",
    FULFILLED: "shippedAt",
    DELIVERED: "deliveredAt",
    COMPLETED: "completedAt",
    CANCELED: "canceledAt",
    DISPUTED: "disputedAt",
    REFUNDED: "refundedAt",
    RETURN_REQUESTED: "returnRequestedAt",
    RETURN_APPROVED: "returnApprovedAt",
    RETURN_IN_TRANSIT: "returnInTransitAt",
    RETURNED: "returnedAt",
    CLOSED: "closedAt",
  };
  return map[status] ?? null;
}
```

---

## 4) Order Service

Create `packages/core/orders/service.ts`:

```ts
import { PrismaClient, Prisma } from "@prisma/client";
import { ORDER_STATUS, isValidOrderTransition, getTimestampFieldForStatus } from "./stateMachine";

const prisma = new PrismaClient();

export type TransitionOrderArgs = {
  orderId: string;
  toStatus: string;
  actorUserId: string;
  note?: string;
};

/**
 * Transition order to new status
 */
export async function transitionOrder(args: TransitionOrderArgs) {
  const order = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!order) return { success: false, error: "ORDER_NOT_FOUND" };

  if (!isValidOrderTransition(order.status as any, args.toStatus as any)) {
    return { success: false, error: `INVALID_TRANSITION:${order.status}->${args.toStatus}` };
  }

  const timestampField = getTimestampFieldForStatus(args.toStatus as any);
  const updateData: any = { status: args.toStatus };
  if (timestampField) {
    updateData[timestampField] = new Date();
  }

  const updated = await prisma.order.update({
    where: { id: args.orderId },
    data: updateData,
  });

  // Audit event
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.actorUserId,
      action: `order.transition.${args.toStatus.toLowerCase()}`,
      entityType: "Order",
      entityId: args.orderId,
      metaJson: { from: order.status, to: args.toStatus, note: args.note },
    },
  });

  return { success: true, order: updated };
}

/**
 * Reserve inventory for order
 */
export async function reserveInventory(
  tx: Prisma.TransactionClient,
  args: { listingId: string; orderId: string; qty: number }
) {
  const listing = await tx.listing.findUnique({ where: { id: args.listingId } });
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if ((listing.quantity ?? 0) < args.qty) throw new Error("INSUFFICIENT_INVENTORY");

  await tx.listing.update({
    where: { id: args.listingId },
    data: { quantity: { decrement: args.qty } },
  });

  await tx.inventoryReservation.create({
    data: {
      orderId: args.orderId,
      listingId: args.listingId,
      quantity: args.qty,
      status: "RESERVED",
    },
  });
}

/**
 * Release inventory (on cancel)
 */
export async function releaseInventory(tx: Prisma.TransactionClient, orderId: string) {
  const reservation = await tx.inventoryReservation.findUnique({ where: { orderId } });
  if (!reservation || reservation.status !== "RESERVED") return;

  await tx.listing.update({
    where: { id: reservation.listingId },
    data: { quantity: { increment: reservation.quantity } },
  });

  await tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
}

/**
 * Consume inventory (on completion)
 */
export async function consumeInventory(tx: Prisma.TransactionClient, orderId: string) {
  const reservation = await tx.inventoryReservation.findUnique({ where: { orderId } });
  if (!reservation || reservation.status !== "RESERVED") return;

  await tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { status: "CONSUMED", consumedAt: new Date() },
  });
}

/**
 * Get buyer orders
 */
export async function getBuyerOrders(buyerId: string, limit = 50) {
  return prisma.order.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { items: true, shipment: true },
  });
}

/**
 * Get seller orders
 */
export async function getSellerOrders(sellerId: string, status?: string, limit = 50) {
  const where: any = { sellerId };
  if (status) where.status = status;

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { items: true, shipment: true },
  });
}
```

---

## 5) Shipment Service

Create `packages/core/orders/shipment.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { transitionOrder } from "./service";

const prisma = new PrismaClient();

/**
 * Create shipment for order
 */
export async function createShipment(args: {
  orderId: string;
  carrier: string;
  tracking: string;
  service?: string;
  actorUserId: string;
}) {
  const order = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  // Check order can be shipped
  if (!["PAID", "AWAITING_FULFILLMENT"].includes(order.status)) {
    throw new Error(`CANNOT_SHIP:${order.status}`);
  }

  // Check if late
  const lateShipment = order.expectedShipByAt ? new Date() > order.expectedShipByAt : false;

  const shipment = await prisma.shipment.create({
    data: {
      orderId: args.orderId,
      carrier: args.carrier,
      tracking: args.tracking,
      service: args.service,
      status: "FULFILLED",
      lateShipment,
      shippedAt: new Date(),
      fromAddressJson: {}, // TODO: from seller profile
      toAddressJson: order.shippingAddressJson,
    },
  });

  // Transition order
  await transitionOrder({
    orderId: args.orderId,
    toStatus: "FULFILLED",
    actorUserId: args.actorUserId,
  });

  return shipment;
}

/**
 * Update shipment tracking
 */
export async function updateShipmentTracking(shipmentId: string, trackingEvents: any[]) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error("SHIPMENT_NOT_FOUND");

  // Determine new status from events
  let newStatus = shipment.status;
  let deliveredAt = shipment.deliveredAt;

  for (const event of trackingEvents) {
    if (event.status === "delivered") {
      newStatus = "DELIVERED";
      deliveredAt = new Date(event.timestamp);
    } else if (event.status === "in_transit") {
      if (newStatus !== "DELIVERED") newStatus = "IN_TRANSIT";
    } else if (event.status === "out_for_delivery") {
      if (newStatus !== "DELIVERED") newStatus = "OUT_FOR_DELIVERY";
    }
  }

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: newStatus,
      deliveredAt,
      trackingEventsJson: trackingEvents,
    },
  });

  // If delivered, transition order
  if (newStatus === "DELIVERED" && shipment.status !== "DELIVERED") {
    await transitionOrder({
      orderId: shipment.orderId,
      toStatus: "DELIVERED",
      actorUserId: "system",
    });
  }

  return updated;
}
```

---

## 5.1) Combined Shipping Calculation Service

Create `packages/core/shipping/calculate-shipping.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ShippingItem {
  listingId: string;
  sellerId: string;
  quantity: number;
  priceCents: number;
}

interface ShippingCalculation {
  sellerId: string;
  items: ShippingItem[];
  subtotalCents: number;
  shippingCents: number;
  breakdown: {
    firstItemCents: number;
    additionalItemsCents: number;
    freeShippingApplied: boolean;
  };
}

/**
 * Calculate shipping for a group of items from the same seller
 */
export async function calculateShippingForSeller(
  sellerId: string,
  items: ShippingItem[],
  destinationCountry: string = "US"
): Promise<ShippingCalculation> {
  const isDomestic = destinationCountry === "US";

  // Get seller's default shipping profile
  const profile = await prisma.shippingProfile.findFirst({
    where: { sellerId, isDefault: true },
  });

  // Get listing-level shipping overrides
  const listingIds = items.map(i => i.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      shippingFirstItemCents: true,
      shippingAdditionalCents: true,
      shippingFreeEnabled: true,
      shippingProfileId: true,
    },
  });

  const listingMap = new Map(listings.map(l => [l.id, l]));

  // Calculate subtotal
  const subtotalCents = items.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);

  // Check for free shipping threshold
  const freeShippingThreshold = isDomestic
    ? profile?.domesticFreeShippingAbove
    : profile?.internationalFreeShippingAbove;

  if (freeShippingThreshold && subtotalCents >= freeShippingThreshold) {
    return {
      sellerId,
      items,
      subtotalCents,
      shippingCents: 0,
      breakdown: {
        firstItemCents: 0,
        additionalItemsCents: 0,
        freeShippingApplied: true,
      },
    };
  }

  // Check if any item has free shipping enabled
  const hasItemWithFreeShipping = items.some(item => {
    const listing = listingMap.get(item.listingId);
    return listing?.shippingFreeEnabled;
  });

  if (hasItemWithFreeShipping) {
    // If ANY item has free shipping, entire order from this seller is free
    return {
      sellerId,
      items,
      subtotalCents,
      shippingCents: 0,
      breakdown: {
        firstItemCents: 0,
        additionalItemsCents: 0,
        freeShippingApplied: true,
      },
    };
  }

  // Calculate combined shipping
  // Sort items by shipping cost (highest first = first item)
  const itemsWithShipping = items.flatMap(item => {
    const listing = listingMap.get(item.listingId);

    // Get first item rate (listing override or profile)
    const firstItemCents = listing?.shippingFirstItemCents
      ?? (isDomestic ? profile?.domesticFirstItemCents : profile?.internationalFirstItemCents)
      ?? 0;

    // Get additional item rate
    const additionalCents = listing?.shippingAdditionalCents
      ?? (isDomestic ? profile?.domesticAdditionalItemCents : profile?.internationalAdditionalItemCents)
      ?? 0;

    // Expand by quantity
    const expanded: Array<{ listingId: string; firstItemCents: number; additionalCents: number }> = [];
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ listingId: item.listingId, firstItemCents, additionalCents });
    }
    return expanded;
  });

  // Sort by first item cost descending (most expensive = first item)
  itemsWithShipping.sort((a, b) => b.firstItemCents - a.firstItemCents);

  // First item pays full rate, rest pay additional rate
  let shippingCents = 0;
  let firstItemCents = 0;
  let additionalItemsCents = 0;

  itemsWithShipping.forEach((item, index) => {
    if (index === 0) {
      // First item - full rate
      shippingCents += item.firstItemCents;
      firstItemCents = item.firstItemCents;
    } else {
      // Additional items - discounted rate
      shippingCents += item.additionalCents;
      additionalItemsCents += item.additionalCents;
    }
  });

  return {
    sellerId,
    items,
    subtotalCents,
    shippingCents,
    breakdown: {
      firstItemCents,
      additionalItemsCents,
      freeShippingApplied: false,
    },
  };
}

/**
 * Calculate shipping for entire cart (grouped by seller)
 */
export async function calculateCartShipping(
  cartItems: ShippingItem[],
  destinationCountry: string = "US"
): Promise<{
  totalShippingCents: number;
  bySeller: ShippingCalculation[];
}> {
  // Group by seller
  const itemsBySeller = new Map<string, ShippingItem[]>();
  for (const item of cartItems) {
    const existing = itemsBySeller.get(item.sellerId) ?? [];
    existing.push(item);
    itemsBySeller.set(item.sellerId, existing);
  }

  // Calculate shipping per seller
  const calculations: ShippingCalculation[] = [];
  let totalShippingCents = 0;

  for (const [sellerId, items] of itemsBySeller) {
    const calc = await calculateShippingForSeller(sellerId, items, destinationCountry);
    calculations.push(calc);
    totalShippingCents += calc.shippingCents;
  }

  return {
    totalShippingCents,
    bySeller: calculations,
  };
}
```

---

## 5.2) Order Cancellation Service

Create `packages/core/orders/cancel-service.ts`:

```ts
import { PrismaClient, CancelInitiator, BuyerCancelReason, SellerCancelReason, CancelRequestStatus } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// GET ACTIVE CANCELLATION POLICY
// =============================================================================

export async function getActiveCancellationPolicy() {
  const policy = await prisma.cancellationPolicySettings.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });

  if (!policy) {
    // Return defaults
    return {
      buyerFreeCancelWindowMinutes: 5,
      buyerCanRequestCancelBeforeShip: true,
      buyerCanRequestCancelAfterShip: false,
      buyerCancelAbuseWindowDays: 30,
      buyerCancelAbuseThreshold: 5,
      buyerCancelAbusePenaltyType: "WARNING",
      buyerCancelAbuseCooldownDays: 7,
      sellerCanCancelBeforeShip: true,
      sellerCanCancelAfterShip: false,
      sellerCancelCountsAsDefect: true,
      sellerCancelNoDefectReasons: ["BUYER_REQUESTED", "SUSPECTED_FRAUD"],
      autoRefundOnCancel: true,
      unpaidOrderCancelHours: 48,
      autoCancelOnPaymentFailure: true,
    };
  }

  return policy;
}

// =============================================================================
// BUYER CANCEL - CHECK ELIGIBILITY
// =============================================================================

export interface BuyerCancelEligibility {
  canCancel: boolean;
  cancelType: "FREE_WINDOW" | "REQUEST_REQUIRED" | "NOT_ALLOWED";
  reason?: string;
  requiresSellerApproval: boolean;
  hasAbuseRestriction: boolean;
  restrictionDetails?: any;
}

export async function checkBuyerCancelEligibility(
  orderId: string,
  buyerId: string
): Promise<BuyerCancelEligibility> {
  const policy = await getActiveCancellationPolicy();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerId: true,
      status: true,
      createdAt: true,
      paidAt: true,
      shippedAt: true,
    },
  });

  if (!order) {
    return { canCancel: false, cancelType: "NOT_ALLOWED", reason: "ORDER_NOT_FOUND", requiresSellerApproval: false, hasAbuseRestriction: false };
  }

  if (order.buyerId !== buyerId) {
    return { canCancel: false, cancelType: "NOT_ALLOWED", reason: "NOT_YOUR_ORDER", requiresSellerApproval: false, hasAbuseRestriction: false };
  }

  // Check for active abuse restriction
  const restriction = await prisma.buyerCancelRestriction.findUnique({
    where: { userId: buyerId },
  });

  const hasActiveRestriction = restriction &&
    (!restriction.endsAt || restriction.endsAt > new Date()) &&
    !restriction.liftedAt;

  if (hasActiveRestriction && restriction.restrictionType === "SUSPEND") {
    return {
      canCancel: false,
      cancelType: "NOT_ALLOWED",
      reason: "CANCEL_PRIVILEGE_SUSPENDED",
      requiresSellerApproval: false,
      hasAbuseRestriction: true,
      restrictionDetails: restriction,
    };
  }

  // Already canceled or completed
  if (["CANCELED", "COMPLETED", "REFUNDED", "DISPUTED"].includes(order.status)) {
    return { canCancel: false, cancelType: "NOT_ALLOWED", reason: "ORDER_NOT_CANCELABLE", requiresSellerApproval: false, hasAbuseRestriction: false };
  }

  // Already shipped - check policy
  if (order.shippedAt) {
    if (!policy.buyerCanRequestCancelAfterShip) {
      return { canCancel: false, cancelType: "NOT_ALLOWED", reason: "ORDER_ALREADY_FULFILLED", requiresSellerApproval: false, hasAbuseRestriction: false };
    }
    return {
      canCancel: true,
      cancelType: "REQUEST_REQUIRED",
      requiresSellerApproval: true,
      hasAbuseRestriction: !!hasActiveRestriction,
    };
  }

  // Check free cancel window (from order creation or payment, whichever is later)
  const windowStart = order.paidAt ?? order.createdAt;
  const windowEndMs = windowStart.getTime() + (policy.buyerFreeCancelWindowMinutes * 60 * 1000);
  const now = Date.now();

  if (now <= windowEndMs) {
    // Within free cancel window
    return {
      canCancel: true,
      cancelType: "FREE_WINDOW",
      requiresSellerApproval: false,
      hasAbuseRestriction: !!hasActiveRestriction,
    };
  }

  // After free window, before shipment - request required
  if (policy.buyerCanRequestCancelBeforeShip) {
    return {
      canCancel: true,
      cancelType: "REQUEST_REQUIRED",
      requiresSellerApproval: true,
      hasAbuseRestriction: !!hasActiveRestriction,
    };
  }

  return { canCancel: false, cancelType: "NOT_ALLOWED", reason: "CANCEL_WINDOW_EXPIRED", requiresSellerApproval: false, hasAbuseRestriction: false };
}

// =============================================================================
// BUYER CANCEL - EXECUTE (FREE WINDOW)
// =============================================================================

export async function buyerCancelOrderFreeWindow(args: {
  orderId: string;
  buyerId: string;
  reason: BuyerCancelReason;
  reasonDetails?: string;
}): Promise<{ success: boolean; order: any }> {
  const { orderId, buyerId, reason, reasonDetails } = args;

  // Check eligibility
  const eligibility = await checkBuyerCancelEligibility(orderId, buyerId);

  if (!eligibility.canCancel) {
    throw new Error(eligibility.reason ?? "CANCEL_NOT_ALLOWED");
  }

  if (eligibility.cancelType !== "FREE_WINDOW") {
    throw new Error("FREE_WINDOW_EXPIRED_USE_REQUEST");
  }

  // Execute cancel in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update order status
    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledByUserId: buyerId,
        cancelInitiator: "BUYER",
        cancelReason: reason,
        cancelReasonDetails: reasonDetails,
        wasFreeWindowCancel: true,
        cancelCountsAsDefect: false,
      },
    });

    // 2. Release inventory reservations
    await tx.inventoryReservation.updateMany({
      where: { orderId, status: "RESERVED" },
      data: { status: "RELEASED", releasedAt: new Date(), releaseReason: "ORDER_CANCELED" },
    });

    // 3. Restore listing quantities
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId },
      select: { listingId: true, quantity: true },
    });

    for (const res of reservations) {
      await tx.listing.update({
        where: { id: res.listingId },
        data: { quantity: { increment: res.quantity } },
      });
    }

    // 4. Record in cancel history (for abuse tracking)
    await tx.buyerCancelHistory.create({
      data: {
        userId: buyerId,
        orderId,
        cancelType: "FREE_WINDOW",
        reason,
      },
    });

    return order;
  });

  // 5. Trigger refund if order was paid
  const policy = await getActiveCancellationPolicy();
  if (policy.autoRefundOnCancel && result.paidAt) {
    await triggerCancelRefund(orderId);
  }

  // 6. Check for abuse
  await checkAndApplyBuyerCancelAbuse(buyerId);

  // 7. Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: buyerId,
      action: "order.canceled_by_buyer_free_window",
      entityType: "Order",
      entityId: orderId,
      metaJson: { reason, reasonDetails },
    },
  });

  return { success: true, order: result };
}

// =============================================================================
// BUYER CANCEL - REQUEST (After free window)
// =============================================================================

export async function buyerRequestCancel(args: {
  orderId: string;
  buyerId: string;
  reason: BuyerCancelReason;
  reasonDetails?: string;
}): Promise<{ success: boolean; request: any }> {
  const { orderId, buyerId, reason, reasonDetails } = args;

  // Check eligibility
  const eligibility = await checkBuyerCancelEligibility(orderId, buyerId);

  if (!eligibility.canCancel) {
    throw new Error(eligibility.reason ?? "CANCEL_NOT_ALLOWED");
  }

  if (eligibility.cancelType !== "REQUEST_REQUIRED") {
    throw new Error("USE_DIRECT_CANCEL_IN_FREE_WINDOW");
  }

  // Check for existing pending request
  const existingRequest = await prisma.orderCancelRequest.findFirst({
    where: { orderId, status: "PENDING" },
  });

  if (existingRequest) {
    throw new Error("CANCEL_REQUEST_ALREADY_PENDING");
  }

  // Create request
  const request = await prisma.orderCancelRequest.create({
    data: {
      orderId,
      requestedByUserId: buyerId,
      initiator: "BUYER",
      buyerReason: reason,
      reasonDetails,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours to respond
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: buyerId,
      action: "order.cancel_requested_by_buyer",
      entityType: "OrderCancelRequest",
      entityId: request.id,
      metaJson: { orderId, reason, reasonDetails },
    },
  });

  return { success: true, request };
}

// =============================================================================
// SELLER RESPOND TO CANCEL REQUEST
// =============================================================================

export async function sellerRespondToCancelRequest(args: {
  requestId: string;
  sellerId: string;
  approve: boolean;
  responseNote?: string;
  denialReason?: string;
}): Promise<{ success: boolean; request: any; order?: any }> {
  const { requestId, sellerId, approve, responseNote, denialReason } = args;

  const request = await prisma.orderCancelRequest.findUnique({
    where: { id: requestId },
    include: { order: true },
  });

  if (!request) {
    throw new Error("REQUEST_NOT_FOUND");
  }

  if (request.order.sellerId !== sellerId) {
    throw new Error("NOT_YOUR_ORDER");
  }

  if (request.status !== "PENDING") {
    throw new Error("REQUEST_ALREADY_PROCESSED");
  }

  if (approve) {
    // Approve and cancel order
    const result = await prisma.$transaction(async (tx) => {
      // Update request
      const updatedRequest = await tx.orderCancelRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          respondedByUserId: sellerId,
          respondedAt: new Date(),
          responseNote,
        },
      });

      // Cancel order
      const order = await tx.order.update({
        where: { id: request.orderId },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          canceledByUserId: request.requestedByUserId,
          cancelInitiator: "BUYER",
          cancelReason: request.buyerReason,
          cancelReasonDetails: request.reasonDetails,
          wasFreeWindowCancel: false,
          cancelCountsAsDefect: false, // Buyer-requested, seller approved
          cancelRequestId: requestId,
        },
      });

      // Release inventory
      await tx.inventoryReservation.updateMany({
        where: { orderId: request.orderId, status: "RESERVED" },
        data: { status: "RELEASED", releasedAt: new Date(), releaseReason: "CANCEL_REQUEST_APPROVED" },
      });

      // Restore quantities
      const reservations = await tx.inventoryReservation.findMany({
        where: { orderId: request.orderId },
      });

      for (const res of reservations) {
        await tx.listing.update({
          where: { id: res.listingId },
          data: { quantity: { increment: res.quantity } },
        });
      }

      // Record buyer cancel history
      await tx.buyerCancelHistory.create({
        data: {
          userId: request.requestedByUserId,
          orderId: request.orderId,
          cancelType: "APPROVED_REQUEST",
          reason: request.buyerReason,
        },
      });

      return { request: updatedRequest, order };
    });

    // Trigger refund
    const policy = await getActiveCancellationPolicy();
    if (policy.autoRefundOnCancel && result.order.paidAt) {
      await triggerCancelRefund(request.orderId);
    }

    // Check buyer abuse
    await checkAndApplyBuyerCancelAbuse(request.requestedByUserId);

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: sellerId,
        action: "order.cancel_request_approved",
        entityType: "OrderCancelRequest",
        entityId: requestId,
        metaJson: { orderId: request.orderId },
      },
    });

    return { success: true, request: result.request, order: result.order };
  } else {
    // Deny request
    const updatedRequest = await prisma.orderCancelRequest.update({
      where: { id: requestId },
      data: {
        status: "DENIED",
        respondedByUserId: sellerId,
        respondedAt: new Date(),
        responseNote,
        denialReason,
      },
    });

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: sellerId,
        action: "order.cancel_request_denied",
        entityType: "OrderCancelRequest",
        entityId: requestId,
        metaJson: { orderId: request.orderId, denialReason },
      },
    });

    return { success: true, request: updatedRequest };
  }
}

// =============================================================================
// SELLER CANCEL ORDER
// =============================================================================

export async function sellerCancelOrder(args: {
  orderId: string;
  sellerId: string;
  reason: SellerCancelReason;
  reasonDetails?: string;
}): Promise<{ success: boolean; order: any; countsAsDefect: boolean }> {
  const { orderId, sellerId, reason, reasonDetails } = args;

  const policy = await getActiveCancellationPolicy();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.sellerId !== sellerId) throw new Error("NOT_YOUR_ORDER");

  // Check if already shipped
  if (order.shippedAt && !policy.sellerCanCancelAfterShip) {
    throw new Error("CANNOT_CANCEL_AFTER_SHIPMENT");
  }

  if (!order.shippedAt && !policy.sellerCanCancelBeforeShip) {
    throw new Error("SELLER_CANCEL_NOT_ALLOWED");
  }

  // Check if already canceled
  if (order.status === "CANCELED") {
    throw new Error("ORDER_ALREADY_CANCELED");
  }

  // Determine if this counts as a defect
  const noDefectReasons = policy.sellerCancelNoDefectReasons ?? [];
  const countsAsDefect = policy.sellerCancelCountsAsDefect && !noDefectReasons.includes(reason);

  // Execute cancel
  const result = await prisma.$transaction(async (tx) => {
    // Update order
    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        canceledByUserId: sellerId,
        cancelInitiator: "SELLER",
        cancelReason: reason,
        cancelReasonDetails: reasonDetails,
        wasFreeWindowCancel: false,
        cancelCountsAsDefect: countsAsDefect,
      },
    });

    // Release inventory
    await tx.inventoryReservation.updateMany({
      where: { orderId, status: "RESERVED" },
      data: { status: "RELEASED", releasedAt: new Date(), releaseReason: "SELLER_CANCELED" },
    });

    // Restore quantities
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId },
    });

    for (const res of reservations) {
      await tx.listing.update({
        where: { id: res.listingId },
        data: { quantity: { increment: res.quantity } },
      });
    }

    // Record defect if applicable
    if (countsAsDefect) {
      await tx.sellerDefect.create({
        data: {
          sellerId,
          orderId,
          defectType: "SELLER_CANCELED_ORDER",
          reason,
          occurredAt: new Date(),
        },
      });
    }

    return updatedOrder;
  });

  // Trigger refund if paid
  if (policy.autoRefundOnCancel && result.paidAt) {
    await triggerCancelRefund(orderId);
  }

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: sellerId,
      action: "order.canceled_by_seller",
      entityType: "Order",
      entityId: orderId,
      metaJson: { reason, reasonDetails, countsAsDefect },
    },
  });

  return { success: true, order: result, countsAsDefect };
}

// =============================================================================
// BUYER ABUSE DETECTION
// =============================================================================

async function checkAndApplyBuyerCancelAbuse(userId: string): Promise<void> {
  const policy = await getActiveCancellationPolicy();

  // Count cancels in rolling window
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - policy.buyerCancelAbuseWindowDays);

  const cancelCount = await prisma.buyerCancelHistory.count({
    where: {
      userId,
      createdAt: { gte: windowStart },
    },
  });

  if (cancelCount >= policy.buyerCancelAbuseThreshold) {
    // Check if already restricted
    const existingRestriction = await prisma.buyerCancelRestriction.findUnique({
      where: { userId },
    });

    if (existingRestriction && !existingRestriction.liftedAt) {
      // Already restricted
      return;
    }

    // Apply restriction
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + policy.buyerCancelAbuseCooldownDays);

    await prisma.buyerCancelRestriction.upsert({
      where: { userId },
      create: {
        userId,
        restrictionType: policy.buyerCancelAbusePenaltyType,
        reason: `Exceeded ${policy.buyerCancelAbuseThreshold} cancellations in ${policy.buyerCancelAbuseWindowDays} days`,
        cancelCountInWindow: cancelCount,
        windowDays: policy.buyerCancelAbuseWindowDays,
        endsAt: policy.buyerCancelAbusePenaltyType === "WARNING" ? null : endsAt,
      },
      update: {
        restrictionType: policy.buyerCancelAbusePenaltyType,
        reason: `Exceeded ${policy.buyerCancelAbuseThreshold} cancellations in ${policy.buyerCancelAbuseWindowDays} days`,
        cancelCountInWindow: cancelCount,
        windowDays: policy.buyerCancelAbuseWindowDays,
        startsAt: new Date(),
        endsAt: policy.buyerCancelAbusePenaltyType === "WARNING" ? null : endsAt,
        liftedAt: null,
        liftedByStaffId: null,
        liftedReason: null,
      },
    });

    // Flag recent cancels as abuse
    await prisma.buyerCancelHistory.updateMany({
      where: {
        userId,
        createdAt: { gte: windowStart },
        flaggedAsAbuse: false,
      },
      data: { flaggedAsAbuse: true },
    });

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: "SYSTEM",
        action: "buyer.cancel_abuse_restriction_applied",
        entityType: "BuyerCancelRestriction",
        entityId: userId,
        metaJson: {
          cancelCount,
          threshold: policy.buyerCancelAbuseThreshold,
          penaltyType: policy.buyerCancelAbusePenaltyType,
        },
      },
    });
  }
}

// =============================================================================
// REFUND TRIGGER (calls Phase 4 refund service)
// =============================================================================

async function triggerCancelRefund(orderId: string): Promise<void> {
  // This calls the refund service from Phase 4
  // await refundService.createRefund({ orderId, reason: "ORDER_CANCELED", fullRefund: true });
  console.log(`[CancelService] Trigger refund for order ${orderId}`);
}
```

---

## 5.3) Cancellation API Endpoints

### Buyer Cancel Order

`apps/web/app/api/orders/[orderId]/cancel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  checkBuyerCancelEligibility,
  buyerCancelOrderFreeWindow,
  buyerRequestCancel,
} from "@/packages/core/orders/cancel-service";

// GET - Check cancel eligibility
export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const ctx = await requireAuth();
  const eligibility = await checkBuyerCancelEligibility(params.orderId, ctx.userId);
  return NextResponse.json(eligibility);
}

// POST - Cancel or request cancel
export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const ctx = await requireAuth();
  const body = await req.json();

  const eligibility = await checkBuyerCancelEligibility(params.orderId, ctx.userId);

  if (!eligibility.canCancel) {
    return NextResponse.json({ error: eligibility.reason }, { status: 400 });
  }

  try {
    if (eligibility.cancelType === "FREE_WINDOW") {
      const result = await buyerCancelOrderFreeWindow({
        orderId: params.orderId,
        buyerId: ctx.userId,
        reason: body.reason,
        reasonDetails: body.reasonDetails,
      });
      return NextResponse.json(result);
    } else {
      const result = await buyerRequestCancel({
        orderId: params.orderId,
        buyerId: ctx.userId,
        reason: body.reason,
        reasonDetails: body.reasonDetails,
      });
      return NextResponse.json(result);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

### Seller Cancel Order

`apps/web/app/api/seller/orders/[orderId]/cancel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sellerCancelOrder } from "@/packages/core/orders/cancel-service";

export async function POST(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const ctx = await requireAuth();
  const body = await req.json();

  try {
    const result = await sellerCancelOrder({
      orderId: params.orderId,
      sellerId: ctx.userId,
      reason: body.reason,
      reasonDetails: body.reasonDetails,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

### Seller Respond to Cancel Request

`apps/web/app/api/seller/cancel-requests/[requestId]/respond/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sellerRespondToCancelRequest } from "@/packages/core/orders/cancel-service";

export async function POST(
  req: Request,
  { params }: { params: { requestId: string } }
) {
  const ctx = await requireAuth();
  const body = await req.json();

  try {
    const result = await sellerRespondToCancelRequest({
      requestId: params.requestId,
      sellerId: ctx.userId,
      approve: body.approve,
      responseNote: body.responseNote,
      denialReason: body.denialReason,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

---

## 6) Cart API Endpoints

### 6.1 Get Cart

`apps/web/app/api/cart/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOrCreateCart } from "@/packages/core/cart/service";

export async function GET(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const sessionId = req.headers.get("x-session-id") ?? undefined;

  const cart = await getOrCreateCart({ userId, sessionId });
  return NextResponse.json({ cart });
}
```

### 6.2 Add to Cart

`apps/web/app/api/cart/items/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOrCreateCart, addToCart } from "@/packages/core/cart/service";

export async function POST(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const { listingId, quantity } = await req.json();

  const cart = await getOrCreateCart({ userId });

  try {
    const item = await addToCart({ cartId: cart.id, listingId, quantity });
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 6.3 Update/Remove Cart Item

`apps/web/app/api/cart/items/[itemId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { updateCartItemQuantity, removeFromCart, saveForLater, moveToCart } from "@/packages/core/cart/service";

export async function PATCH(req: Request, { params }: { params: { itemId: string } }) {
  const { quantity, action } = await req.json();

  try {
    if (action === "save_for_later") {
      const item = await saveForLater(params.itemId);
      return NextResponse.json({ item });
    }
    if (action === "move_to_cart") {
      const item = await moveToCart(params.itemId);
      return NextResponse.json({ item });
    }
    const item = await updateCartItemQuantity(params.itemId, quantity);
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { itemId: string } }) {
  await removeFromCart(params.itemId);
  return NextResponse.json({ ok: true });
}
```

### 6.4 Validate Cart

`apps/web/app/api/cart/validate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOrCreateCart, validateCart } from "@/packages/core/cart/service";

export async function POST(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const cart = await getOrCreateCart({ userId });
  const result = await validateCart(cart.id);
  return NextResponse.json(result);
}
```

### 6.5 Checkout (Convert Cart to Orders)

`apps/web/app/api/cart/checkout/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getOrCreateCart, convertCartToOrders } from "@/packages/core/cart/service";

export async function POST(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const { shippingAddress } = await req.json();

  const cart = await getOrCreateCart({ userId });

  try {
    const orderIds = await convertCartToOrders(cart.id, userId, shippingAddress);
    return NextResponse.json({ orderIds }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

---

## 7) Order API Endpoints

### 7.1 Buyer Orders

`apps/web/app/api/buyer/orders/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getBuyerOrders } from "@/packages/core/orders/service";

export async function GET(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const orders = await getBuyerOrders(userId);
  return NextResponse.json({ orders });
}
```

### 7.2 Seller Orders

`apps/web/app/api/seller/orders/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getSellerOrders } from "@/packages/core/orders/service";

export async function GET(req: Request) {
  const userId = "twi_u_replace"; // TODO: auth
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const orders = await getSellerOrders(userId, status);
  return NextResponse.json({ orders });
}
```

### 7.3 Ship Order

`apps/web/app/api/seller/orders/[id]/ship/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createShipment } from "@/packages/core/orders/shipment";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = "twi_u_replace"; // TODO: auth
  const { carrier, tracking, service } = await req.json();

  try {
    const shipment = await createShipment({
      orderId: params.id,
      carrier,
      tracking,
      service,
      actorUserId: userId,
    });
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 7.4 Cancel Order

`apps/web/app/api/orders/[id]/cancel/route.ts`:
```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { transitionOrder, releaseInventory } from "@/packages/core/orders/service";
import { canCancelOrder } from "@/packages/core/orders/stateMachine";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = "twi_u_replace"; // TODO: auth
  const { reason } = await req.json();

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (order.buyerId !== userId && order.sellerId !== userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (!canCancelOrder(order.status as any)) {
    return NextResponse.json({ error: "CANNOT_CANCEL" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await releaseInventory(tx, order.id);
  });

  const result = await transitionOrder({
    orderId: order.id,
    toStatus: "CANCELED",
    actorUserId: userId,
    note: reason,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ order: result.order });
}
```

---

## 8) Cart Cleanup Cron

Create `packages/core/cart/cleanup.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Cleanup expired carts and reservations
 * Run hourly
 */
export async function cleanupExpiredCarts() {
  const now = new Date();

  // Mark expired carts as abandoned
  const expiredCarts = await prisma.cart.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    data: { status: "ABANDONED" },
  });

  // Release expired cart reservations
  const expiredReservations = await prisma.cartReservation.updateMany({
    where: { isActive: true, expiresAt: { lt: now } },
    data: { isActive: false, releasedAt: now, releaseReason: "EXPIRED" },
  });

  console.log(`Cleaned up ${expiredCarts.count} carts, ${expiredReservations.count} reservations`);

  return { expiredCarts: expiredCarts.count, expiredReservations: expiredReservations.count };
}
```

---

## 9) Health Provider

Create `packages/core/health/providers/ordersHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const ordersHealthProvider: HealthProvider = {
  id: "orders",
  label: "Cart, Orders & Fulfillment",
  description: "Cart and order lifecycle health",
  version: "1.2.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: No stuck cart reservations
    const stuckCartReservations = await prisma.cartReservation.count({
      where: { isActive: true, expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    checks.push({
      id: "cart.no_stuck_reservations",
      label: "No stuck cart reservations (>1h)",
      status: stuckCartReservations === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: stuckCartReservations === 0 ? "None" : `${stuckCartReservations} stuck`,
    });
    if (stuckCartReservations > 0) status = HEALTH_STATUS.WARN;

    // Check 2: No stale order reservations
    const staleOrderReservations = await prisma.inventoryReservation.count({
      where: { status: "RESERVED", createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    checks.push({
      id: "orders.no_stale_reservations",
      label: "No stale order reservations (>24h)",
      status: staleOrderReservations === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleOrderReservations === 0 ? "None" : `${staleOrderReservations} stale`,
    });
    if (staleOrderReservations > 0) status = HEALTH_STATUS.WARN;

    // Check 3: Paid orders have timestamp
    const paidWithoutTimestamp = await prisma.order.count({
      where: { status: { in: ["PAID", "FULFILLED", "DELIVERED", "COMPLETED"] }, paidAt: null },
    });
    checks.push({
      id: "orders.paid_have_timestamp",
      label: "Paid orders have paidAt",
      status: paidWithoutTimestamp === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: paidWithoutTimestamp === 0 ? "All valid" : `${paidWithoutTimestamp} missing`,
    });
    if (paidWithoutTimestamp > 0) status = HEALTH_STATUS.FAIL;

    // Check 4: Shipped orders have shipments
    const shippedWithoutShipment = await prisma.order.count({
      where: { status: { in: ["FULFILLED", "DELIVERED", "COMPLETED"] }, shipment: null },
    });
    checks.push({
      id: "orders.shipped_have_shipment",
      label: "Shipped orders have shipment",
      status: shippedWithoutShipment === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: shippedWithoutShipment === 0 ? "All valid" : `${shippedWithoutShipment} missing`,
    });
    if (shippedWithoutShipment > 0) status = HEALTH_STATUS.FAIL;

    // Check 5: Late shipment rate
    const totalShipped = await prisma.shipment.count();
    const lateShipments = await prisma.shipment.count({ where: { lateShipment: true } });
    const lateRate = totalShipped > 0 ? (lateShipments / totalShipped) * 100 : 0;
    checks.push({
      id: "orders.late_shipment_rate",
      label: "Late shipment rate",
      status: lateRate < 5 ? HEALTH_STATUS.PASS : lateRate < 15 ? HEALTH_STATUS.WARN : HEALTH_STATUS.FAIL,
      message: `${lateRate.toFixed(1)}%`,
    });

    // Check 6: Cart conversion rate (24h)
    const cartsCreated = await prisma.cart.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    const cartsConverted = await prisma.cart.count({
      where: { status: "CONVERTED", updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    checks.push({
      id: "cart.conversion_rate_24h",
      label: "Cart conversions (24h)",
      status: HEALTH_STATUS.PASS,
      message: `${cartsConverted}/${cartsCreated} converted`,
    });

    return {
      providerId: "orders",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Orders healthy" : "Issues detected",
      providerVersion: "1.2.0",
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 10) Order Auto-Complete Scheduler (HIGH-9)

Create `packages/core/orders/auto-complete.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

const AUTO_COMPLETE_DAYS = 3; // Days after delivery to auto-complete

/**
 * Auto-complete delivered orders
 * Should be run daily via cron job at 2 AM
 * 
 * Orders transition DELIVERED → COMPLETED after 3 days if:
 * - No open buyer protection claims
 * - No active return requests
 */
export async function autoCompleteDeliveredOrders(): Promise<{
  completed: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let completed = 0;
  let skipped = 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUTO_COMPLETE_DAYS);
  
  // Find delivered orders older than cutoff
  const eligibleOrders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: cutoffDate },
      // No open claims
      NOT: {
        protectionClaims: {
          some: {
            status: { in: ["OPEN", "SELLER_RESPONSE", "ESCALATED"] },
          },
        },
      },
    },
    take: 500, // Process in batches
  });
  
  for (const order of eligibleOrders) {
    try {
      // Check for active return requests
      const hasActiveReturn = await prisma.returnRequest.count({
        where: {
          orderId: order.id,
          status: { in: ["REQUESTED", "APPROVED", "IN_TRANSIT"] },
        },
      });
      
      if (hasActiveReturn > 0) {
        skipped++;
        continue;
      }
      
      // Auto-complete the order
      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
        
        // Release seller payout hold if held for delivery confirmation
        await tx.payoutHold.updateMany({
          where: {
            orderId: order.id,
            reasonCode: "delivery_pending",
            status: "active",
          },
          data: {
            status: "released",
            releasedAt: new Date(),
            releaseNote: "Order auto-completed after delivery confirmation period",
          },
        });
      });
      
      // Audit event
      await emitAuditEvent({
        actorUserId: "system",
        action: "order.auto_completed",
        entityType: "Order",
        entityId: order.id,
        meta: {
          previousStatus: "DELIVERED",
          daysAfterDelivery: AUTO_COMPLETE_DAYS,
        },
      });
      
      // Prompt buyer for review
      await prisma.notification.create({
        data: {
          userId: order.buyerId,
          type: "REVIEW_REMINDER",
          title: "How was your purchase?",
          body: "Your order has been completed. Leave a review to help other buyers!",
          channel: "push",
          priority: "normal",
          metaJson: { orderId: order.id, sellerId: order.sellerId },
        },
      });
      
      completed++;
    } catch (error) {
      errors.push(`${order.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Log summary
  await emitAuditEvent({
    actorUserId: "system",
    action: "order.auto_complete_batch",
    entityType: "Order",
    entityId: "batch",
    meta: { completed, skipped, errorCount: errors.length },
  });
  
  return { completed, skipped, errors };
}

/**
 * Get orders eligible for auto-complete (for preview/monitoring)
 */
export async function getAutoCompleteEligibleOrders(): Promise<{
  count: number;
  orders: Array<{ id: string; deliveredAt: Date; buyerId: string; sellerId: string }>;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUTO_COMPLETE_DAYS);
  
  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: cutoffDate },
    },
    select: {
      id: true,
      deliveredAt: true,
      buyerId: true,
      sellerId: true,
    },
    take: 100,
  });
  
  return {
    count: orders.length,
    orders: orders as Array<{ id: string; deliveredAt: Date; buyerId: string; sellerId: string }>,
  };
}
```

### Cron Configuration

Add to your cron scheduler (daily at 2 AM):

```ts
// cron/jobs/auto-complete-orders.ts
import { autoCompleteDeliveredOrders } from "@/packages/core/orders/auto-complete";

// Schedule: 0 2 * * * (daily at 2 AM)
export async function runAutoCompleteJob() {
  console.log("[CRON] Starting order auto-complete job");
  const result = await autoCompleteDeliveredOrders();
  console.log(`[CRON] Auto-complete: ${result.completed} completed, ${result.skipped} skipped, ${result.errors.length} errors`);
  return result;
}
```

---

## 11) Doctor Checks

```ts
async function checkCartAndOrders() {
  const checks = [];

  // Setup test data
  const testSellerId = "doctor_seller";
  const testBuyerId = "doctor_buyer";

  const testListing = await prisma.listing.create({
    data: {
      ownerUserId: testSellerId,
      status: "ACTIVE",
      title: "Doctor Test Item",
      priceCents: 1000,
      currency: "USD",
      quantity: 5,
      requiredAttributesComplete: true,
    },
  });

  // 1. Create cart
  const cart = await getOrCreateCart({ userId: testBuyerId });
  checks.push({ key: "cart.create", ok: !!cart.id, details: "Cart created" });

  // 2. Add item to cart
  const cartItem = await addToCart({ cartId: cart.id, listingId: testListing.id, quantity: 2 });
  checks.push({ key: "cart.add_item", ok: !!cartItem.id, details: "Item added" });

  // 3. Verify cart reservation created
  const reservation = await prisma.cartReservation.findUnique({
    where: { cartId_listingId: { cartId: cart.id, listingId: testListing.id } },
  });
  checks.push({ key: "cart.reservation", ok: reservation?.isActive === true, details: "Reservation active" });

  // 4. Update quantity
  const updated = await updateCartItemQuantity(cartItem.id, 3);
  checks.push({ key: "cart.update_qty", ok: updated.quantity === 3, details: `qty=${updated.quantity}` });

  // 5. Validate cart
  const validation = await validateCart(cart.id);
  checks.push({ key: "cart.validate", ok: validation.valid, details: validation.valid ? "Valid" : "Invalid" });

  // 6. Convert to order
  const orderIds = await convertCartToOrders(cart.id, testBuyerId, { street: "123 Test St" });
  checks.push({ key: "cart.convert", ok: orderIds.length === 1, details: `${orderIds.length} orders` });

  // 7. Verify inventory reserved
  const listingAfter = await prisma.listing.findUnique({ where: { id: testListing.id } });
  checks.push({ key: "order.inventory_reserved", ok: listingAfter?.quantity === 2, details: `qty=${listingAfter?.quantity}` });

  // 8. State machine transitions
  const validTransition = isValidOrderTransition("PAID", "FULFILLED");
  const invalidTransition = isValidOrderTransition("COMPLETED", "AWAITING_PAYMENT");
  checks.push({ key: "order.state_machine", ok: validTransition && !invalidTransition, details: "Transitions enforced" });

  // 9. Return states exist
  const returnStates = ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_IN_TRANSIT", "RETURNED"];
  const allExist = returnStates.every((s) => ORDER_STATUS[s as keyof typeof ORDER_STATUS]);
  checks.push({ key: "order.return_states", ok: allExist, details: "All return states in enum" });

  // Cleanup
  for (const orderId of orderIds) {
    await prisma.inventoryReservation.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
  }
  await prisma.cartReservation.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cart.delete({ where: { id: cart.id } });
  await prisma.listing.delete({ where: { id: testListing.id } });

  return checks;
}
```

---

## 12) Phase 3 Completion Criteria

- **Cart model with items and reservations (CRITICAL-2)**
- Add/update/remove cart items
- **ShippingPolicySettings** seeded with defaults
- **CancellationPolicySettings** seeded with defaults
- Admin UI at `/corp/settings/shipping` and `/corp/settings/orders/cancellation`
- Save for later functionality
- Guest cart -> user cart merge
- Cart validation before checkout
- Multi-seller cart -> multiple orders conversion
- Orders reserve inventory atomically
- **Buyer cancel (free window + request)** working
- **Seller cancel (with defect tracking)** working
- **Buyer cancel abuse detection** working
- Cancel releases inventory
- Shipment creation transitions order to FULFILLED
- OrderStatus enum includes return states
- State machine enforces valid transitions
- Late shipment flag tracked
- **Combined shipping calculation** (first item + additional items)
- **CheckoutSession** for multi-seller single payment
- Health provider passes
- Doctor passes all Phase 3 checks

---

## 13) Canonical Alignment

| Requirement | Implementation |
|-------------|----------------|
| Multi-item checkout | Cart + CartItem models |
| Inventory hold | CartReservation (short-term), InventoryReservation (order) |
| Multi-seller orders | Cart groups by seller  ->  separate orders |
| Return states | RETURN_REQUESTED through RETURNED in enum |
| State machine | ORDER_STATUS_TRANSITIONS map |
| Late shipment tracking | lateShipment flag on Shipment |
| Auto-complete | autoCompleteDeliveredOrders() cron job (HIGH-9) |

---

## 14) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 3 implementation |
| 1.1 | 2026-01-15 | Added CRITICAL-2 Cart fixes |
| 1.2 | 2026-01-19 | Added FIX-8 InventoryReservation variation linking |
| 1.3 | 2026-01-20 | Added HIGH-9 Order auto-complete scheduler |
| 1.4 | 2026-01-20 | Added ShippingPolicySettings (Compliance Fix) |
| 1.5 | 2026-01-21 | Commerce Flow Fixes: Cancellation system, combined shipping, multi-seller checkout |
| 1.6 | 2026-01-22 | **CartItem Variations**: Added listingChildId, variationsJson fields for Phase 41/44 integration; Updated unique constraint; Updated addToCart and validateCart services |
| 1.7 | 2026-01-22 | **Bundle Builder Addendum**: Added SellerBundle, CartBundle, CartPrompt, BundleRequest, BundleSettings models; Smart cart prompts; "Make Me a Deal" negotiation flow |

---

## 15) Bundle Builder Addendum (v1.7)

> This section adds Bundle Builder features: Seller Bundles, Smart Cart Prompts, and "Make Me a Deal" Negotiation.

### 15.1) Bundle Builder Prisma Models

```prisma
// =============================================================================
// SELLER BUNDLES
// =============================================================================

model SellerBundle {
  id              String    @id @default(cuid())
  sellerId        String

  name            String
  description     String?
  imageUrl        String?

  discountType    BundleDiscountType @default(PERCENT)
  discountValue   Int                // Percent (0-100) or cents

  bundleType      BundleType         @default(SPECIFIC_ITEMS)

  // For SPECIFIC_ITEMS type
  listingIds      String[]
  minQuantity     Int      @default(2)

  // For CATEGORY type
  categoryIds     String[]
  minCategoryItems Int?

  // For ANY_ITEMS type
  minItems        Int?
  minTotalCents   Int?

  // Limits
  maxUsesTotal    Int?
  maxUsesPerBuyer Int?
  usedCount       Int      @default(0)

  isActive        Boolean  @default(true)
  startsAt        DateTime @default(now())
  endsAt          DateTime?

  // Analytics
  viewCount       Int      @default(0)
  applyCount      Int      @default(0)
  conversionCount Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  seller          User     @relation(fields: [sellerId], references: [id])
  cartBundles     CartBundle[]

  @@index([sellerId, isActive])
  @@index([isActive, startsAt, endsAt])
}

enum BundleDiscountType {
  PERCENT
  FIXED_AMOUNT
}

enum BundleType {
  SPECIFIC_ITEMS
  CATEGORY
  ANY_ITEMS
}

// =============================================================================
// CART BUNDLE (Applied seller bundles)
// =============================================================================

model CartBundle {
  id              String    @id @default(cuid())
  cartId          String
  cart            Cart      @relation(fields: [cartId], references: [id], onDelete: Cascade)

  sellerBundleId  String
  sellerBundle    SellerBundle @relation(fields: [sellerBundleId], references: [id])

  discountType    String
  discountValue   Int
  appliedDiscountCents Int  @default(0)

  cartItemIds     String[]

  createdAt       DateTime  @default(now())

  @@unique([cartId, sellerBundleId])
  @@index([sellerBundleId])
}

// =============================================================================
// SMART CART PROMPTS
// =============================================================================

model CartPrompt {
  id              String    @id @default(cuid())
  cartId          String

  promptType      CartPromptType

  headline        String
  subtext         String?
  ctaText         String

  targetSellerId  String?
  targetListingIds String[]
  targetBundleId  String?

  currentAmountCents Int?
  targetAmountCents  Int?
  savingsAmountCents Int?

  isDismissed     Boolean   @default(false)
  isActedUpon     Boolean   @default(false)

  priority        Int       @default(0)

  createdAt       DateTime  @default(now())
  expiresAt       DateTime?

  @@index([cartId, isDismissed])
  @@index([expiresAt])
}

enum CartPromptType {
  FREE_SHIPPING_THRESHOLD
  BUNDLE_AVAILABLE
  QUANTITY_DISCOUNT
  SELLER_PROMO
  RELATED_ITEMS
}

// =============================================================================
// MAKE ME A DEAL - BUNDLE REQUESTS
// =============================================================================

model BundleRequest {
  id              String    @id @default(cuid())
  cartId          String
  cart            Cart      @relation(fields: [cartId], references: [id])

  buyerId         String
  sellerId        String

  listingIds      String[]
  quantities      Json      @default("{}")

  originalSubtotalCents Int
  originalShippingCents Int
  originalTotalCents    Int

  proposedTotalCents    Int?
  proposedMessage       String?

  status          BundleRequestStatus @default(PENDING)

  counterOfferCents     Int?
  counterOfferMessage   String?
  counterOfferExpiresAt DateTime?

  acceptedTotalCents    Int?
  acceptedDiscountCents Int?

  sellerViewedAt  DateTime?
  respondedAt     DateTime?
  buyerRespondedAt DateTime?
  expiredAt       DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  expiresAt       DateTime

  buyer           User      @relation("BuyerBundleRequests", fields: [buyerId], references: [id])
  seller          User      @relation("SellerBundleRequests", fields: [sellerId], references: [id])

  @@index([sellerId, status])
  @@index([buyerId, status])
  @@index([cartId])
  @@index([expiresAt])
}

enum BundleRequestStatus {
  PENDING
  COUNTER_OFFERED
  ACCEPTED
  DECLINED
  EXPIRED
  WITHDRAWN
  CONVERTED
}

// =============================================================================
// BUNDLE SETTINGS (Admin Configurable)
// =============================================================================

model BundleSettings {
  id                        String   @id @default(cuid())
  version                   String   @unique
  effectiveAt               DateTime
  isActive                  Boolean  @default(true)

  // Seller Bundles
  sellerBundlesEnabled      Boolean  @default(true)
  maxBundlesPerSeller       Int      @default(50)
  maxDiscountPercent        Int      @default(50)
  minBundleItems            Int      @default(2)

  // Smart Prompts
  smartPromptsEnabled       Boolean  @default(true)
  freeShippingPromptEnabled Boolean  @default(true)
  bundlePromptEnabled       Boolean  @default(true)
  relatedItemsPromptEnabled Boolean  @default(true)
  maxPromptsPerCart         Int      @default(3)

  // Make Me a Deal
  makeMeADealEnabled        Boolean  @default(true)
  minItemsForDeal           Int      @default(2)
  minCartValueCentsForDeal  Int      @default(2000)
  requestExpirationHours    Int      @default(48)
  maxRequestsPerBuyerDay    Int      @default(5)
  sellerResponseSlaHours    Int      @default(24)
  counterOfferExpirationHours Int    @default(24)

  trackBundleConversions    Boolean  @default(true)

  createdByStaffId          String
  createdAt                 DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}
```

### 15.2) Order Model Bundle Fields

Add these fields to the existing Order model:

```prisma
model Order {
  // ... existing fields ...

  // Bundle Builder (v1.7)
  bundleDiscountCents Int     @default(0)
  appliedBundleId     String?
  bundleRequestId     String?

  @@index([bundleRequestId])
}
```

### 15.3) Platform Settings

```typescript
// packages/core/config/bundleSettings.ts

export const BUNDLE_SETTINGS = {
  // Seller Bundles
  SELLER_BUNDLES_ENABLED: true,
  MAX_BUNDLES_PER_SELLER: 50,
  MAX_DISCOUNT_PERCENT: 50,
  MIN_BUNDLE_ITEMS: 2,

  // Smart Prompts
  SMART_PROMPTS_ENABLED: true,
  FREE_SHIPPING_PROMPT_ENABLED: true,
  BUNDLE_PROMPT_ENABLED: true,
  RELATED_ITEMS_PROMPT_ENABLED: true,
  MAX_PROMPTS_PER_CART: 3,

  // Make Me a Deal
  MAKE_ME_A_DEAL_ENABLED: true,
  MIN_ITEMS_FOR_DEAL: 2,
  MIN_CART_VALUE_CENTS_FOR_DEAL: 2000,
  REQUEST_EXPIRATION_HOURS: 48,
  MAX_REQUESTS_PER_BUYER_DAY: 5,
  SELLER_RESPONSE_SLA_HOURS: 24,
  COUNTER_OFFER_EXPIRATION_HOURS: 24,

  TRACK_BUNDLE_CONVERSIONS: true,
} as const;
```

### 15.4) Seller Bundle Service

```typescript
// packages/core/bundles/sellerBundleService.ts
import { PrismaClient, BundleDiscountType, BundleType } from "@prisma/client";
import { BUNDLE_SETTINGS } from "../config/bundleSettings";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export interface CreateSellerBundleInput {
  sellerId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  discountType: BundleDiscountType;
  discountValue: number;
  bundleType: BundleType;
  listingIds?: string[];
  categoryIds?: string[];
  minQuantity?: number;
  minItems?: number;
  minTotalCents?: number;
  maxUsesTotal?: number;
  maxUsesPerBuyer?: number;
  startsAt?: Date;
  endsAt?: Date;
}

export async function createSellerBundle(input: CreateSellerBundleInput) {
  // Validate seller hasn't exceeded bundle limit
  const existingCount = await prisma.sellerBundle.count({
    where: { sellerId: input.sellerId, isActive: true },
  });
  if (existingCount >= BUNDLE_SETTINGS.MAX_BUNDLES_PER_SELLER) {
    throw new Error("BUNDLE_LIMIT_EXCEEDED");
  }

  // Validate discount
  if (input.discountType === "PERCENT" && input.discountValue > BUNDLE_SETTINGS.MAX_DISCOUNT_PERCENT) {
    throw new Error("DISCOUNT_TOO_HIGH");
  }

  // Validate listings belong to seller
  if (input.listingIds && input.listingIds.length > 0) {
    const listings = await prisma.listing.findMany({
      where: { id: { in: input.listingIds }, ownerUserId: input.sellerId },
    });
    if (listings.length !== input.listingIds.length) {
      throw new Error("INVALID_LISTING_IDS");
    }
  }

  const bundle = await prisma.sellerBundle.create({
    data: {
      sellerId: input.sellerId,
      name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
      discountType: input.discountType,
      discountValue: input.discountValue,
      bundleType: input.bundleType,
      listingIds: input.listingIds ?? [],
      categoryIds: input.categoryIds ?? [],
      minQuantity: input.minQuantity ?? BUNDLE_SETTINGS.MIN_BUNDLE_ITEMS,
      minItems: input.minItems,
      minTotalCents: input.minTotalCents,
      maxUsesTotal: input.maxUsesTotal,
      maxUsesPerBuyer: input.maxUsesPerBuyer,
      startsAt: input.startsAt ?? new Date(),
      endsAt: input.endsAt,
    },
  });

  await emitAuditEvent({
    action: "bundle.created",
    entityType: "SellerBundle",
    entityId: bundle.id,
    meta: { sellerId: input.sellerId, bundleType: input.bundleType },
  });

  return bundle;
}

export async function getSellerBundles(sellerId: string, includeInactive = false) {
  return prisma.sellerBundle.findMany({
    where: {
      sellerId,
      isActive: includeInactive ? undefined : true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicableBundles(sellerId: string, listingIds: string[]) {
  const now = new Date();

  const bundles = await prisma.sellerBundle.findMany({
    where: {
      sellerId,
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
  });

  return bundles.map(bundle => {
    let qualifies = false;
    let missingListings: string[] = [];

    if (bundle.bundleType === "SPECIFIC_ITEMS") {
      const present = bundle.listingIds.filter(id => listingIds.includes(id));
      missingListings = bundle.listingIds.filter(id => !listingIds.includes(id));
      qualifies = missingListings.length === 0;
    } else if (bundle.bundleType === "ANY_ITEMS") {
      qualifies = listingIds.length >= (bundle.minItems ?? 2);
    }

    return { bundle, qualifies, missingListings };
  });
}

export async function deactivateBundle(bundleId: string, sellerId: string) {
  const bundle = await prisma.sellerBundle.findFirst({
    where: { id: bundleId, sellerId },
  });
  if (!bundle) throw new Error("BUNDLE_NOT_FOUND");

  return prisma.sellerBundle.update({
    where: { id: bundleId },
    data: { isActive: false },
  });
}
```

### 15.5) Smart Cart Prompts Service

```typescript
// packages/core/bundles/smartPromptService.ts
import { PrismaClient, CartPromptType } from "@prisma/client";
import { BUNDLE_SETTINGS } from "../config/bundleSettings";
import { getApplicableBundles } from "./sellerBundleService";

const prisma = new PrismaClient();

interface CartContext {
  cartId: string;
  items: Array<{
    listingId: string;
    sellerId: string;
    priceCents: number;
    quantity: number;
  }>;
}

export async function generateCartPrompts(context: CartContext): Promise<void> {
  if (!BUNDLE_SETTINGS.SMART_PROMPTS_ENABLED) return;

  await prisma.cartPrompt.deleteMany({ where: { cartId: context.cartId } });

  const prompts: Array<any> = [];

  // Group items by seller
  const sellerItems = new Map<string, typeof context.items>();
  for (const item of context.items) {
    const existing = sellerItems.get(item.sellerId) ?? [];
    existing.push(item);
    sellerItems.set(item.sellerId, existing);
  }

  for (const [sellerId, items] of sellerItems) {
    const sellerTotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    const listingIds = items.map(i => i.listingId);

    // Free shipping threshold
    if (BUNDLE_SETTINGS.FREE_SHIPPING_PROMPT_ENABLED) {
      const profile = await prisma.shippingProfile.findFirst({
        where: { sellerId, isDefault: true },
      });

      if (profile?.domesticFreeShippingAbove && sellerTotal < profile.domesticFreeShippingAbove) {
        const remaining = profile.domesticFreeShippingAbove - sellerTotal;
        prompts.push({
          promptType: "FREE_SHIPPING_THRESHOLD" as CartPromptType,
          headline: `Add $${(remaining / 100).toFixed(2)} more for FREE SHIPPING!`,
          subtext: `From this seller`,
          ctaText: "View more items",
          targetSellerId: sellerId,
          targetListingIds: [],
          savingsAmountCents: profile.domesticFirstItemCents,
          priority: 10,
        });
      }
    }

    // Bundle available
    if (BUNDLE_SETTINGS.BUNDLE_PROMPT_ENABLED) {
      const bundles = await getApplicableBundles(sellerId, listingIds);

      for (const { bundle, qualifies, missingListings } of bundles) {
        if (!qualifies && missingListings.length <= 2) {
          prompts.push({
            promptType: "BUNDLE_AVAILABLE" as CartPromptType,
            headline: `Add ${missingListings.length} more item${missingListings.length > 1 ? "s" : ""} for ${bundle.discountValue}% off!`,
            subtext: bundle.name,
            ctaText: "Complete bundle",
            targetSellerId: sellerId,
            targetListingIds: missingListings,
            targetBundleId: bundle.id,
            priority: 15,
          });
        }
      }
    }
  }

  // Save top prompts
  prompts.sort((a, b) => b.priority - a.priority);
  for (const prompt of prompts.slice(0, BUNDLE_SETTINGS.MAX_PROMPTS_PER_CART)) {
    await prisma.cartPrompt.create({
      data: {
        cartId: context.cartId,
        ...prompt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }
}

export async function getCartPrompts(cartId: string) {
  return prisma.cartPrompt.findMany({
    where: {
      cartId,
      isDismissed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { priority: "desc" },
  });
}

export async function dismissPrompt(promptId: string) {
  return prisma.cartPrompt.update({
    where: { id: promptId },
    data: { isDismissed: true },
  });
}
```

### 15.6) Make Me a Deal Service

```typescript
// packages/core/bundles/bundleRequestService.ts
import { PrismaClient, BundleRequestStatus } from "@prisma/client";
import { BUNDLE_SETTINGS } from "../config/bundleSettings";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export interface CreateBundleRequestInput {
  cartId: string;
  buyerId: string;
  sellerId: string;
  listingIds: string[];
  quantities: Record<string, number>;
  proposedTotalCents?: number;
  proposedMessage?: string;
}

export async function createBundleRequest(input: CreateBundleRequestInput) {
  if (!BUNDLE_SETTINGS.MAKE_ME_A_DEAL_ENABLED) {
    throw new Error("MAKE_ME_A_DEAL_DISABLED");
  }

  if (input.listingIds.length < BUNDLE_SETTINGS.MIN_ITEMS_FOR_DEAL) {
    throw new Error("MIN_ITEMS_NOT_MET");
  }

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requestsToday = await prisma.bundleRequest.count({
    where: { buyerId: input.buyerId, createdAt: { gte: today } },
  });
  if (requestsToday >= BUNDLE_SETTINGS.MAX_REQUESTS_PER_BUYER_DAY) {
    throw new Error("DAILY_REQUEST_LIMIT_EXCEEDED");
  }

  // Check for existing pending request
  const existingRequest = await prisma.bundleRequest.findFirst({
    where: {
      cartId: input.cartId,
      sellerId: input.sellerId,
      status: { in: ["PENDING", "COUNTER_OFFERED"] },
    },
  });
  if (existingRequest) throw new Error("REQUEST_ALREADY_EXISTS");

  // Calculate original totals
  const listings = await prisma.listing.findMany({
    where: { id: { in: input.listingIds } },
  });

  const originalSubtotalCents = listings.reduce((sum, listing) => {
    const qty = input.quantities[listing.id] ?? 1;
    return sum + (listing.priceCents ?? 0) * qty;
  }, 0);

  if (originalSubtotalCents < BUNDLE_SETTINGS.MIN_CART_VALUE_CENTS_FOR_DEAL) {
    throw new Error("MIN_CART_VALUE_NOT_MET");
  }

  const shippingProfile = await prisma.shippingProfile.findFirst({
    where: { sellerId: input.sellerId, isDefault: true },
  });
  const originalShippingCents = shippingProfile?.domesticFirstItemCents ?? 0;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + BUNDLE_SETTINGS.REQUEST_EXPIRATION_HOURS);

  const request = await prisma.bundleRequest.create({
    data: {
      cartId: input.cartId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      listingIds: input.listingIds,
      quantities: input.quantities,
      originalSubtotalCents,
      originalShippingCents,
      originalTotalCents: originalSubtotalCents + originalShippingCents,
      proposedTotalCents: input.proposedTotalCents,
      proposedMessage: input.proposedMessage,
      expiresAt,
    },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: input.sellerId,
      type: "BUNDLE_REQUEST_RECEIVED",
      title: "New Bundle Request!",
      body: `A buyer wants to make a deal on ${input.listingIds.length} items`,
      channel: "push",
      priority: "high",
      metaJson: { requestId: request.id },
    },
  });

  await emitAuditEvent({
    action: "bundle_request.created",
    entityType: "BundleRequest",
    entityId: request.id,
    meta: { buyerId: input.buyerId, sellerId: input.sellerId },
  });

  return request;
}

export async function respondToBundleRequest(args: {
  requestId: string;
  sellerId: string;
  action: "accept" | "decline" | "counter";
  counterOfferCents?: number;
  counterOfferMessage?: string;
}) {
  const request = await prisma.bundleRequest.findFirst({
    where: { id: args.requestId, sellerId: args.sellerId },
  });

  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.status !== "PENDING" && request.status !== "COUNTER_OFFERED") {
    throw new Error("REQUEST_NOT_ACTIONABLE");
  }
  if (new Date() > request.expiresAt) throw new Error("REQUEST_EXPIRED");

  let status: BundleRequestStatus;
  let acceptedTotalCents: number | undefined;
  let acceptedDiscountCents: number | undefined;
  let counterOfferExpiresAt: Date | undefined;

  switch (args.action) {
    case "accept":
      status = "ACCEPTED";
      acceptedTotalCents = request.proposedTotalCents ?? request.originalTotalCents;
      acceptedDiscountCents = request.originalTotalCents - acceptedTotalCents;
      break;
    case "decline":
      status = "DECLINED";
      break;
    case "counter":
      if (!args.counterOfferCents) throw new Error("COUNTER_OFFER_REQUIRED");
      status = "COUNTER_OFFERED";
      counterOfferExpiresAt = new Date();
      counterOfferExpiresAt.setHours(counterOfferExpiresAt.getHours() + BUNDLE_SETTINGS.COUNTER_OFFER_EXPIRATION_HOURS);
      break;
    default:
      throw new Error("INVALID_ACTION");
  }

  const updated = await prisma.bundleRequest.update({
    where: { id: args.requestId },
    data: {
      status,
      counterOfferCents: args.counterOfferCents,
      counterOfferMessage: args.counterOfferMessage,
      counterOfferExpiresAt,
      acceptedTotalCents,
      acceptedDiscountCents,
      respondedAt: new Date(),
    },
  });

  // Notify buyer
  await prisma.notification.create({
    data: {
      userId: request.buyerId,
      type: `BUNDLE_REQUEST_${args.action.toUpperCase()}`,
      title: args.action === "accept" ? "Deal Accepted! 🎉" : args.action === "counter" ? "Counter Offer Received" : "Deal Request Declined",
      body: args.action === "accept"
        ? `Your bundle deal was accepted!`
        : args.action === "counter"
          ? `Seller made a counter offer of $${(args.counterOfferCents! / 100).toFixed(2)}`
          : `The seller declined your bundle request.`,
      channel: "push",
      priority: "high",
      metaJson: { requestId: request.id },
    },
  });

  return updated;
}

export async function buyerRespondToCounter(args: {
  requestId: string;
  buyerId: string;
  action: "accept" | "decline";
}) {
  const request = await prisma.bundleRequest.findFirst({
    where: { id: args.requestId, buyerId: args.buyerId, status: "COUNTER_OFFERED" },
  });

  if (!request) throw new Error("REQUEST_NOT_FOUND");
  if (request.counterOfferExpiresAt && new Date() > request.counterOfferExpiresAt) {
    throw new Error("COUNTER_OFFER_EXPIRED");
  }

  const status = args.action === "accept" ? "ACCEPTED" : "DECLINED";
  const acceptedTotalCents = args.action === "accept" ? request.counterOfferCents! : undefined;
  const acceptedDiscountCents = args.action === "accept" ? request.originalTotalCents - acceptedTotalCents! : undefined;

  return prisma.bundleRequest.update({
    where: { id: args.requestId },
    data: {
      status,
      acceptedTotalCents,
      acceptedDiscountCents,
      buyerRespondedAt: new Date(),
    },
  });
}

export async function getSellerBundleRequests(sellerId: string, status?: BundleRequestStatus) {
  return prisma.bundleRequest.findMany({
    where: { sellerId, status: status ?? undefined },
    include: { buyer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBuyerBundleRequests(buyerId: string) {
  return prisma.bundleRequest.findMany({
    where: { buyerId },
    include: { seller: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// Cron: Expire old requests
export async function expireBundleRequests() {
  const expired = await prisma.bundleRequest.updateMany({
    where: {
      status: { in: ["PENDING", "COUNTER_OFFERED"] },
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", expiredAt: new Date() },
  });
  return { expiredCount: expired.count };
}
```

### 15.7) Cart Service Updates

Add to existing cart service:

```typescript
// Add to packages/core/cart/service.ts

export async function applyBundleToCart(cartId: string, bundleId: string) {
  const bundle = await prisma.sellerBundle.findUnique({ where: { id: bundleId } });
  if (!bundle || !bundle.isActive) throw new Error("BUNDLE_NOT_FOUND");

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { where: { sellerId: bundle.sellerId, isSavedForLater: false } } },
  });
  if (!cart) throw new Error("CART_NOT_FOUND");

  // Check if bundle already applied
  const existing = await prisma.cartBundle.findUnique({
    where: { cartId_sellerBundleId: { cartId, sellerBundleId: bundleId } },
  });
  if (existing) throw new Error("BUNDLE_ALREADY_APPLIED");

  // Validate bundle requirements
  const cartListingIds = cart.items.map(i => i.listingId);
  if (bundle.bundleType === "SPECIFIC_ITEMS") {
    const hasAll = bundle.listingIds.every(id => cartListingIds.includes(id));
    if (!hasAll) throw new Error("BUNDLE_REQUIREMENTS_NOT_MET");
  }

  // Calculate discount
  const itemsSubtotal = cart.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const discountCents = bundle.discountType === "PERCENT"
    ? Math.floor(itemsSubtotal * bundle.discountValue / 100)
    : bundle.discountValue;

  await prisma.cartBundle.create({
    data: {
      cartId,
      sellerBundleId: bundleId,
      discountType: bundle.discountType,
      discountValue: bundle.discountValue,
      appliedDiscountCents: discountCents,
      cartItemIds: cart.items.map(i => i.id),
    },
  });

  await prisma.sellerBundle.update({
    where: { id: bundleId },
    data: { applyCount: { increment: 1 } },
  });

  return { discountCents };
}

export async function removeBundleFromCart(cartId: string, bundleId: string) {
  await prisma.cartBundle.deleteMany({
    where: { cartId, sellerBundleId: bundleId },
  });
}
```

### 15.8) Health Provider Updates

Add these checks to the orders health provider:

```typescript
// Add to ordersHealthProvider checks:

// Bundle request backlog
const pendingBundleRequests = await prisma.bundleRequest.count({
  where: {
    status: "PENDING",
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
});
checks.push({
  id: "orders.bundle_request_backlog",
  label: "Bundle request backlog",
  status: pendingBundleRequests < 50 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
  message: pendingBundleRequests === 0 ? "None" : `${pendingBundleRequests} pending >24h`,
});

// Expired bundle requests not cleaned up
const expiredNotCleaned = await prisma.bundleRequest.count({
  where: {
    status: { in: ["PENDING", "COUNTER_OFFERED"] },
    expiresAt: { lt: new Date() },
  },
});
checks.push({
  id: "orders.expired_bundle_requests",
  label: "Expired bundle requests",
  status: expiredNotCleaned === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
  message: expiredNotCleaned === 0 ? "Cleaned" : `${expiredNotCleaned} need cleanup`,
});
```

### 15.9) Bundle Builder Completion Criteria

- [ ] SellerBundle model for seller-created bundles
- [ ] CartBundle for applied bundles
- [ ] CartPrompt for smart prompts
- [ ] BundleRequest for "Make Me a Deal"
- [ ] BundleSettings admin-configurable
- [ ] Seller bundle CRUD
- [ ] Smart cart prompts generation
- [ ] "Make Me a Deal" request flow
- [ ] Bundle request counter-offer flow
- [ ] Admin UI at `/corp/settings/bundles`

### 15.10) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Seller bundles | Limited | ✅ Full bundle creation with discounts |
| Smart cart prompts | No | ✅ "Add $X for free shipping" |
| Bundle suggestions | No | ✅ "Complete bundle for 15% off" |
| "Make Me a Deal" | No | ✅ Buyer-initiated negotiation |
| Counter-offers | Limited | ✅ Full negotiation flow |
| Bundle analytics | No | ✅ View/apply/conversion tracking |
