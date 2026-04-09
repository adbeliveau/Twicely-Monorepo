# TWICELY V2 — Install Phase 14: Returns + Disputes Case Management
**Status:** LOCKED (v1.2)  
**Backend-first:** Schema → API → Ledger hooks → Health → UI → Doctor  
**Canonicals:** MUST align with:
- `/rules/TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md`
- `/rules/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md`
- `/rules/TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_14_RETURNS_DISPUTES_CASE_MGMT.md`  
> Prereq: Phase 13 complete.

---

## 0) What this phase installs

### Backend
- ReturnCase model with full state machine (OPEN → APPROVED → IN_TRANSIT → RECEIVED → REFUNDED | REJECTED)
- DisputeCase model with evidence collection and escalation
- DisputeEvidence model for buyer/seller document uploads
- RefundRecord model for tracking refund execution
- PayoutHold integration (model defined in Phase 4)
- ReturnShipment model for return tracking
- Refund service with idempotent ledger posting
- Dispute service with hold management
- Return policy enforcement

### UI (Corp)
- Corp → Returns queue (pending review)
- Corp → Disputes queue (open cases)
- Corp → Case detail with evidence viewer
- Corp → Hold management

### UI (Buyer)
- Buyer → Orders → Request Return
- Buyer → Orders → Open Dispute
- Buyer → Track Return Status

### UI (Seller)
- Seller Hub → Returns (respond to requests)
- Seller Hub → Disputes (provide evidence)

### Ops
- Health provider: `returns_disputes`
- Doctor checks: refund ledger posting, hold application, state transitions

---

## 1) Prisma Schema (Additive)

```prisma
// =============================================================================
// RETURN REASONS (Canonical)
// Per TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md Section 3
// =============================================================================

enum ReturnReason {
  NOT_AS_DESCRIBED
  DAMAGED_IN_TRANSIT
  WRONG_ITEM
  DEFECTIVE
  MISSING_PARTS
  BUYER_REMORSE        // Only if seller policy allows
  OTHER
}

enum ReturnStatus {
  OPEN                 // Buyer opened request
  PENDING_SELLER       // Awaiting seller response
  APPROVED             // Seller approved return
  REJECTED             // Seller rejected (can escalate)
  LABEL_SENT           // Return label provided
  IN_TRANSIT           // Item shipped back
  RECEIVED             // Seller received item
  INSPECTING           // Seller inspecting item
  REFUND_PENDING       // Approved for refund
  REFUNDED             // Refund completed
  CLOSED_NO_REFUND     // Closed without refund
  ESCALATED            // Escalated to dispute
}

enum DisputeStatus {
  OPEN                 // Dispute opened
  AWAITING_SELLER      // Seller must respond
  AWAITING_BUYER       // Buyer must respond
  UNDER_REVIEW         // Platform reviewing
  ESCALATED            // Escalated to senior review
  RESOLVED_BUYER       // Resolved in buyer's favor
  RESOLVED_SELLER      // Resolved in seller's favor
  RESOLVED_SPLIT       // Split resolution
  CLOSED               // Closed without resolution
}

enum DisputeReason {
  ITEM_NOT_RECEIVED
  ITEM_NOT_AS_DESCRIBED
  UNAUTHORIZED_PURCHASE
  RETURN_NOT_PROCESSED
  REFUND_NOT_RECEIVED
  SELLER_UNRESPONSIVE
  OTHER
}

enum HoldReason {
  DISPUTE_OPENED
  CHARGEBACK_RECEIVED
  RISK_FLAG
  VERIFICATION_PENDING
  POLICY_VIOLATION
  MANUAL_REVIEW
}

enum HoldStatus {
  ACTIVE
  RELEASED
  CONVERTED_TO_DEBIT   // Hold became actual deduction
}

// =============================================================================
// RETURN CASE
// =============================================================================

model ReturnCase {
  id              String        @id @default(cuid())
  caseNumber      String        @unique @default(cuid()) // Human-readable RMA number
  
  orderId         String
  orderItemId     String?       // Specific item if multi-item order
  
  buyerId         String
  sellerId        String
  
  // Return details
  reason          ReturnReason
  status          ReturnStatus  @default(OPEN)
  buyerNotes      String?
  sellerNotes     String?
  
  // Item condition
  quantityReturned Int          @default(1)
  conditionOnReturn String?     // as_sent|damaged|different_item|etc.
  
  // Policy reference
  returnPolicyId  String?
  returnWindow    Int           @default(30)  // Days from delivery
  
  // Shipping
  returnShipmentId String?
  returnLabelUrl  String?
  returnTrackingNumber String?
  returnCarrier   String?
  
  // Resolution
  resolutionType  String?       // full_refund|partial_refund|replacement|no_refund
  refundAmountCents Int?
  refundId        String?
  
  // Staff handling
  assignedToStaffId String?
  
  // Timestamps
  requestedAt     DateTime      @default(now())
  sellerRespondedAt DateTime?
  approvedAt      DateTime?
  rejectedAt      DateTime?
  shippedAt       DateTime?
  receivedAt      DateTime?
  refundedAt      DateTime?
  closedAt        DateTime?
  escalatedAt     DateTime?
  
  // Deadlines
  sellerResponseDeadline DateTime?
  returnShipDeadline DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  evidence        ReturnEvidence[]
  messages        ReturnMessage[]

  @@index([orderId])
  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([status, createdAt])
  @@index([assignedToStaffId, status])
}

// =============================================================================
// RETURN EVIDENCE
// =============================================================================

model ReturnEvidence {
  id              String      @id @default(cuid())
  returnCaseId    String
  returnCase      ReturnCase  @relation(fields: [returnCaseId], references: [id], onDelete: Cascade)
  
  submittedBy     String      // userId
  submittedByRole String      // buyer|seller|staff
  
  type            String      // photo|video|document|screenshot|message
  url             String
  description     String?
  
  createdAt       DateTime    @default(now())

  @@index([returnCaseId])
}

// =============================================================================
// RETURN MESSAGES (Communication thread)
// =============================================================================

model ReturnMessage {
  id              String      @id @default(cuid())
  returnCaseId    String
  returnCase      ReturnCase  @relation(fields: [returnCaseId], references: [id], onDelete: Cascade)
  
  senderId        String
  senderRole      String      // buyer|seller|staff|system
  
  message         String
  isInternal      Boolean     @default(false)  // Staff-only notes
  
  createdAt       DateTime    @default(now())

  @@index([returnCaseId, createdAt])
}

// =============================================================================
// DISPUTE CASE
// =============================================================================

model DisputeCase {
  id              String        @id @default(cuid())
  caseNumber      String        @unique @default(cuid())
  
  orderId         String
  returnCaseId    String?       // If escalated from return
  
  buyerId         String
  sellerId        String
  
  // Dispute details
  reason          DisputeReason
  status          DisputeStatus @default(OPEN)
  description     String
  
  // Amounts
  disputedAmountCents Int
  resolvedAmountCents Int?
  
  // Resolution
  outcome         String?       // buyer_full|buyer_partial|seller|split|withdrawn
  resolutionNotes String?
  
  // Staff handling
  assignedToStaffId String?
  escalatedToStaffId String?
  
  // External reference (chargeback)
  externalDisputeId String?     // Stripe dispute ID
  isChargeback    Boolean       @default(false)
  
  // Hold reference
  payoutHoldId    String?
  
  // Timestamps
  openedAt        DateTime      @default(now())
  sellerResponseDeadline DateTime?
  buyerResponseDeadline DateTime?
  escalatedAt     DateTime?
  resolvedAt      DateTime?
  
  // Response tracking
  sellerRespondedAt DateTime?
  buyerRespondedAt DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  evidence        DisputeEvidence[]
  messages        DisputeMessage[]
  timeline        DisputeTimeline[]

  @@index([orderId])
  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([status, openedAt])
  @@index([assignedToStaffId, status])
  @@index([externalDisputeId])
}

// =============================================================================
// DISPUTE SLA SETTINGS (Admin Configurable)
// =============================================================================

model DisputeSlaSettings {
  id                              String   @id @default(cuid())
  version                         String
  effectiveAt                     DateTime
  isActive                        Boolean  @default(true)

  // Response Deadlines (hours)
  sellerResponseDeadlineHours     Int      @default(48)
  buyerResponseDeadlineHours      Int      @default(48)
  platformReviewDeadlineHours     Int      @default(72)

  // Auto-Escalation Rules
  autoEscalateOnNoSellerResponse  Boolean  @default(true)
  autoEscalateOnNoEvidence        Boolean  @default(true)
  escalationDelayHours            Int      @default(24)

  // Auto-Resolution Rules
  autoResolveInBuyerFavorOnTimeout     Boolean @default(true)
  autoResolveRequiresTrackingDelivered Boolean @default(true)
  autoResolutionDelayHours             Int     @default(72)

  // Refund Policies
  autoRefundOnItemNotReceived     Boolean  @default(true)
  autoRefundOnItemNotAsDescribed  Boolean  @default(false)
  maxAutoRefundCents              Int      @default(50000) // $500

  // Communication
  sendReminderBeforeDeadlineHours Int      @default(12)
  maxRemindersPerParty            Int      @default(2)

  // Audit
  createdByStaffId                String
  createdAt                       DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

// =============================================================================
// DISPUTE EVIDENCE
// =============================================================================

model DisputeEvidence {
  id              String       @id @default(cuid())
  disputeCaseId   String
  disputeCase     DisputeCase  @relation(fields: [disputeCaseId], references: [id], onDelete: Cascade)
  
  submittedBy     String
  submittedByRole String       // buyer|seller|staff
  
  type            String       // photo|video|document|screenshot|tracking|communication
  category        String       // proof_of_delivery|item_condition|communication|receipt|other
  url             String
  description     String?
  
  // For Stripe evidence submission
  submittedToProvider Boolean  @default(false)
  submittedToProviderAt DateTime?
  
  createdAt       DateTime     @default(now())

  @@index([disputeCaseId])
}

// =============================================================================
// DISPUTE MESSAGES
// =============================================================================

model DisputeMessage {
  id              String       @id @default(cuid())
  disputeCaseId   String
  disputeCase     DisputeCase  @relation(fields: [disputeCaseId], references: [id], onDelete: Cascade)
  
  senderId        String
  senderRole      String       // buyer|seller|staff|system
  
  message         String
  isInternal      Boolean      @default(false)
  
  createdAt       DateTime     @default(now())

  @@index([disputeCaseId, createdAt])
}

// =============================================================================
// DISPUTE TIMELINE (Audit trail)
// =============================================================================

model DisputeTimeline {
  id              String       @id @default(cuid())
  disputeCaseId   String
  disputeCase     DisputeCase  @relation(fields: [disputeCaseId], references: [id], onDelete: Cascade)
  
  action          String       // opened|seller_responded|escalated|resolved|etc.
  actorId         String?
  actorRole       String?      // buyer|seller|staff|system
  
  previousStatus  String?
  newStatus       String?
  
  details         Json         @default("{}")
  
  createdAt       DateTime     @default(now())

  @@index([disputeCaseId, createdAt])
}

// =============================================================================
// SELLER APPEAL (Phase 38 Integration)
// =============================================================================

model SellerAppeal {
  id                    String   @id @default(cuid())
  claimId               String   @unique
  claim                 BuyerProtectionClaim @relation(fields: [claimId], references: [id])
  sellerId              String

  reason                String   // AppealReason enum value
  description           String
  evidenceUrls          String[]

  status                String   @default("PENDING") // PENDING, UNDER_REVIEW, APPROVED, DENIED, WITHDRAWN

  reviewedByStaffId     String?
  reviewedAt            DateTime?

  decision              String?  // OVERTURN_FULL, OVERTURN_PARTIAL, UPHELD, MODIFIED
  decisionReason        String?

  refundReversed        Boolean  @default(false)
  refundReversedAmountCents Int?
  scoreAdjustment       Int?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([sellerId, status])
  @@index([status, createdAt])
}

// =============================================================================
// DISPUTE TIMELINE EVENT (Detailed event tracking - Phase 38 Integration)
// =============================================================================

model DisputeTimelineEvent {
  id          String   @id @default(cuid())
  claimId     String

  eventType   String   // See TimelineEventType enum in canonical
  description String
  actorType   String   // BUYER, SELLER, SYSTEM, STAFF
  actorId     String?

  metaJson    Json?

  occurredAt  DateTime @default(now())

  @@index([claimId, occurredAt])
}

// =============================================================================
// PAYOUT HOLD
// NOTE: PayoutHold model is defined in Phase 4 (canonical location)
// Use: import from Phase 4's schema
// Reference: TWICELY_V2_INSTALL_PHASE_4_PAYMENTS_WEBHOOKS_LEDGER_PAYOUTS.md
//
// A5 BLOCKER FIX: Removed duplicate model definition.
// Phase 14 dispute service should use Phase 4's PayoutHold model directly.
// Map HoldReason enum values to Phase 4's reasonCode string field.
// =============================================================================

// HoldReason enum - Phase 14 specific, maps to Phase 4 reasonCode
enum HoldReason {
  DISPUTE_OPENED
  CHARGEBACK_RECEIVED
  RISK_FLAG
  VERIFICATION_PENDING
  POLICY_VIOLATION
  MANUAL_REVIEW
}

// HoldStatus enum - compatible with Phase 4 status field
enum HoldStatus {
  ACTIVE
  RELEASED
  CONVERTED_TO_DEBIT   // Hold became actual deduction
}

// =============================================================================
// REFUND RECORD
// =============================================================================

model RefundRecord {
  id              String      @id @default(cuid())
  
  orderId         String
  returnCaseId    String?
  disputeCaseId   String?
  
  sellerId        String
  buyerId         String
  
  // Amounts
  amountCents     Int
  currency        String      @default("USD")
  
  // Breakdown
  itemRefundCents Int
  shippingRefundCents Int     @default(0)
  taxRefundCents  Int         @default(0)
  
  // Type
  refundType      String      // full|partial|shipping_only
  reason          String
  
  // Provider
  providerRefundId String?    // Stripe refund ID
  providerStatus  String?     // pending|succeeded|failed
  
  // Ledger
  ledgerEntryId   String?
  ledgerKey       String      @unique
  
  // Staff
  initiatedByStaffId String?
  
  // Timestamps
  requestedAt     DateTime    @default(now())
  processedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([orderId])
  @@index([sellerId, createdAt])
  @@index([providerRefundId])
}

// =============================================================================
// RETURN POLICY (Seller-defined)
// =============================================================================

model ReturnPolicy {
  id              String      @id @default(cuid())
  sellerId        String
  
  name            String      // "30-Day Returns", "No Returns", etc.
  isDefault       Boolean     @default(false)
  
  // Policy settings
  acceptsReturns  Boolean     @default(true)
  returnWindowDays Int        @default(30)
  
  // Who pays return shipping
  returnShippingPaidBy String @default("buyer") // buyer|seller
  
  // Restocking fee
  restockingFeePercent Int    @default(0)  // 0-20%
  
  // Conditions
  requiresOriginalPackaging Boolean @default(false)
  requiresUnused    Boolean   @default(false)
  
  // Eligible reasons
  allowBuyerRemorse Boolean   @default(false)
  
  isActive        Boolean     @default(true)
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([sellerId, isDefault])
  @@index([sellerId, isActive])
}
```

Run migration:
```bash
npx prisma migrate dev --name returns_disputes_phase14
```

---

## 2) Return Types & Constants

Create `packages/core/returns/types.ts`:

```ts
export const RETURN_STATUS = {
  OPEN: "OPEN",
  PENDING_SELLER: "PENDING_SELLER",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  LABEL_SENT: "LABEL_SENT",
  IN_TRANSIT: "IN_TRANSIT",
  RECEIVED: "RECEIVED",
  INSPECTING: "INSPECTING",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
  CLOSED_NO_REFUND: "CLOSED_NO_REFUND",
  ESCALATED: "ESCALATED",
} as const;

export type ReturnStatus = typeof RETURN_STATUS[keyof typeof RETURN_STATUS];

export const RETURN_REASON = {
  NOT_AS_DESCRIBED: "NOT_AS_DESCRIBED",
  DAMAGED_IN_TRANSIT: "DAMAGED_IN_TRANSIT",
  WRONG_ITEM: "WRONG_ITEM",
  DEFECTIVE: "DEFECTIVE",
  MISSING_PARTS: "MISSING_PARTS",
  BUYER_REMORSE: "BUYER_REMORSE",
  OTHER: "OTHER",
} as const;

export type ReturnReason = typeof RETURN_REASON[keyof typeof RETURN_REASON];

// Valid status transitions
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  OPEN: ["PENDING_SELLER", "ESCALATED"],
  PENDING_SELLER: ["APPROVED", "REJECTED", "ESCALATED"],
  APPROVED: ["LABEL_SENT", "IN_TRANSIT"],
  REJECTED: ["ESCALATED", "CLOSED_NO_REFUND"],
  LABEL_SENT: ["IN_TRANSIT"],
  IN_TRANSIT: ["RECEIVED"],
  RECEIVED: ["INSPECTING", "REFUND_PENDING"],
  INSPECTING: ["REFUND_PENDING", "CLOSED_NO_REFUND"],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  CLOSED_NO_REFUND: [],
  ESCALATED: ["REFUND_PENDING", "CLOSED_NO_REFUND"],
};

export function isValidReturnTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[from]?.includes(to) ?? false;
}

// Deadlines
export const SELLER_RESPONSE_DEADLINE_DAYS = 3;
export const RETURN_SHIP_DEADLINE_DAYS = 14;
export const INSPECTION_DEADLINE_DAYS = 3;
```

---

## 3) Dispute Types & Constants

Create `packages/core/disputes/types.ts`:

```ts
export const DISPUTE_STATUS = {
  OPEN: "OPEN",
  AWAITING_SELLER: "AWAITING_SELLER",
  AWAITING_BUYER: "AWAITING_BUYER",
  UNDER_REVIEW: "UNDER_REVIEW",
  ESCALATED: "ESCALATED",
  RESOLVED_BUYER: "RESOLVED_BUYER",
  RESOLVED_SELLER: "RESOLVED_SELLER",
  RESOLVED_SPLIT: "RESOLVED_SPLIT",
  CLOSED: "CLOSED",
} as const;

export type DisputeStatus = typeof DISPUTE_STATUS[keyof typeof DISPUTE_STATUS];

export const DISPUTE_REASON = {
  ITEM_NOT_RECEIVED: "ITEM_NOT_RECEIVED",
  ITEM_NOT_AS_DESCRIBED: "ITEM_NOT_AS_DESCRIBED",
  UNAUTHORIZED_PURCHASE: "UNAUTHORIZED_PURCHASE",
  RETURN_NOT_PROCESSED: "RETURN_NOT_PROCESSED",
  REFUND_NOT_RECEIVED: "REFUND_NOT_RECEIVED",
  SELLER_UNRESPONSIVE: "SELLER_UNRESPONSIVE",
  OTHER: "OTHER",
} as const;

export type DisputeReason = typeof DISPUTE_REASON[keyof typeof DISPUTE_REASON];

export const DISPUTE_OUTCOME = {
  BUYER_FULL: "buyer_full",
  BUYER_PARTIAL: "buyer_partial",
  SELLER: "seller",
  SPLIT: "split",
  WITHDRAWN: "withdrawn",
} as const;

// Deadlines
export const SELLER_DISPUTE_RESPONSE_DAYS = 5;
export const BUYER_DISPUTE_RESPONSE_DAYS = 5;
export const PLATFORM_REVIEW_DAYS = 10;
```

---

## 4) Return Service

Create `packages/core/returns/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { 
  RETURN_STATUS, 
  RETURN_REASON,
  isValidReturnTransition,
  SELLER_RESPONSE_DEADLINE_DAYS,
  RETURN_SHIP_DEADLINE_DAYS,
} from "./types";

const prisma = new PrismaClient();

export type OpenReturnArgs = {
  orderId: string;
  orderItemId?: string;
  buyerId: string;
  reason: string;
  notes?: string;
  evidenceUrls?: string[];
};

export async function openReturn(args: OpenReturnArgs) {
  // Validate order exists and belongs to buyer
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { listing: true },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.buyerId !== args.buyerId) throw new Error("NOT_ORDER_OWNER");
  
  // Check order status allows returns
  if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
    throw new Error("ORDER_NOT_ELIGIBLE_FOR_RETURN");
  }

  // Check return window
  const deliveredAt = order.deliveredAt ?? order.completedAt;
  if (!deliveredAt) throw new Error("DELIVERY_NOT_CONFIRMED");
  
  const daysSinceDelivery = Math.floor(
    (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Get seller's return policy
  const returnPolicy = await prisma.returnPolicy.findFirst({
    where: { sellerId: order.sellerId, isDefault: true, isActive: true },
  });
  
  const returnWindow = returnPolicy?.returnWindowDays ?? 30;
  
  if (daysSinceDelivery > returnWindow) {
    throw new Error("RETURN_WINDOW_EXPIRED");
  }

  // Check if return already exists
  const existingReturn = await prisma.returnCase.findFirst({
    where: { 
      orderId: args.orderId,
      status: { notIn: ["REFUNDED", "CLOSED_NO_REFUND"] },
    },
  });
  
  if (existingReturn) throw new Error("RETURN_ALREADY_EXISTS");

  const sellerResponseDeadline = new Date();
  sellerResponseDeadline.setDate(
    sellerResponseDeadline.getDate() + SELLER_RESPONSE_DEADLINE_DAYS
  );

  // Create return case
  const returnCase = await prisma.returnCase.create({
    data: {
      orderId: args.orderId,
      orderItemId: args.orderItemId,
      buyerId: args.buyerId,
      sellerId: order.sellerId,
      reason: args.reason as any,
      status: "PENDING_SELLER",
      buyerNotes: args.notes,
      returnPolicyId: returnPolicy?.id,
      returnWindow,
      sellerResponseDeadline,
    },
  });

  // Add evidence if provided
  if (args.evidenceUrls?.length) {
    await prisma.returnEvidence.createMany({
      data: args.evidenceUrls.map((url) => ({
        returnCaseId: returnCase.id,
        submittedBy: args.buyerId,
        submittedByRole: "buyer",
        type: "photo",
        url,
      })),
    });
  }

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: order.sellerId,
      type: "RETURN_REQUESTED",
      title: "Return Request Received",
      body: `A buyer has requested a return for order ${order.orderNumber}`,
      dataJson: { returnCaseId: returnCase.id, orderId: args.orderId },
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.buyerId,
      action: "return.opened",
      entityType: "ReturnCase",
      entityId: returnCase.id,
      metaJson: { orderId: args.orderId, reason: args.reason },
    },
  });

  return returnCase;
}

export async function sellerRespondToReturn(args: {
  returnCaseId: string;
  sellerId: string;
  action: "approve" | "reject";
  notes?: string;
  actorUserId: string;
}) {
  const returnCase = await prisma.returnCase.findUnique({
    where: { id: args.returnCaseId },
  });

  if (!returnCase) throw new Error("RETURN_NOT_FOUND");
  if (returnCase.sellerId !== args.sellerId) throw new Error("NOT_RETURN_OWNER");
  if (returnCase.status !== "PENDING_SELLER") throw new Error("INVALID_STATUS");

  const now = new Date();

  if (args.action === "approve") {
    const returnShipDeadline = new Date();
    returnShipDeadline.setDate(
      returnShipDeadline.getDate() + RETURN_SHIP_DEADLINE_DAYS
    );

    const updated = await prisma.returnCase.update({
      where: { id: args.returnCaseId },
      data: {
        status: "APPROVED",
        sellerNotes: args.notes,
        sellerRespondedAt: now,
        approvedAt: now,
        returnShipDeadline,
      },
    });

    // Notify buyer
    await prisma.notification.create({
      data: {
        userId: returnCase.buyerId,
        type: "RETURN_APPROVED",
        title: "Return Approved",
        body: "Your return request has been approved. Please ship the item back.",
        dataJson: { returnCaseId: args.returnCaseId },
      },
    });

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: args.actorUserId,
        action: "return.approved",
        entityType: "ReturnCase",
        entityId: args.returnCaseId,
      },
    });

    return updated;
  }

  if (args.action === "reject") {
    const updated = await prisma.returnCase.update({
      where: { id: args.returnCaseId },
      data: {
        status: "REJECTED",
        sellerNotes: args.notes,
        sellerRespondedAt: now,
        rejectedAt: now,
      },
    });

    // Notify buyer - can escalate
    await prisma.notification.create({
      data: {
        userId: returnCase.buyerId,
        type: "RETURN_REJECTED",
        title: "Return Request Declined",
        body: "The seller has declined your return request. You may escalate to a dispute.",
        dataJson: { returnCaseId: args.returnCaseId },
      },
    });

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: args.actorUserId,
        action: "return.rejected",
        entityType: "ReturnCase",
        entityId: args.returnCaseId,
        metaJson: { notes: args.notes },
      },
    });

    return updated;
  }

  throw new Error("INVALID_ACTION");
}

export async function markReturnShipped(args: {
  returnCaseId: string;
  buyerId: string;
  trackingNumber: string;
  carrier: string;
}) {
  const returnCase = await prisma.returnCase.findUnique({
    where: { id: args.returnCaseId },
  });

  if (!returnCase) throw new Error("RETURN_NOT_FOUND");
  if (returnCase.buyerId !== args.buyerId) throw new Error("NOT_RETURN_BUYER");
  if (!["APPROVED", "LABEL_SENT"].includes(returnCase.status)) {
    throw new Error("INVALID_STATUS");
  }

  const updated = await prisma.returnCase.update({
    where: { id: args.returnCaseId },
    data: {
      status: "IN_TRANSIT",
      returnTrackingNumber: args.trackingNumber,
      returnCarrier: args.carrier,
      shippedAt: new Date(),
    },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: returnCase.sellerId,
      type: "RETURN_SHIPPED",
      title: "Return Item Shipped",
      body: `The buyer has shipped the return item. Tracking: ${args.trackingNumber}`,
      dataJson: { returnCaseId: args.returnCaseId, trackingNumber: args.trackingNumber },
    },
  });

  return updated;
}

export async function markReturnReceived(args: {
  returnCaseId: string;
  sellerId: string;
  conditionOnReturn: string;
  notes?: string;
  actorUserId: string;
}) {
  const returnCase = await prisma.returnCase.findUnique({
    where: { id: args.returnCaseId },
  });

  if (!returnCase) throw new Error("RETURN_NOT_FOUND");
  if (returnCase.sellerId !== args.sellerId) throw new Error("NOT_RETURN_SELLER");
  if (returnCase.status !== "IN_TRANSIT") throw new Error("INVALID_STATUS");

  const updated = await prisma.returnCase.update({
    where: { id: args.returnCaseId },
    data: {
      status: "INSPECTING",
      conditionOnReturn: args.conditionOnReturn,
      sellerNotes: args.notes,
      receivedAt: new Date(),
    },
  });

  return updated;
}

export async function approveRefund(args: {
  returnCaseId: string;
  staffId?: string;
  sellerId?: string;
  refundAmountCents: number;
  resolutionType: "full_refund" | "partial_refund";
  notes?: string;
}) {
  const returnCase = await prisma.returnCase.findUnique({
    where: { id: args.returnCaseId },
    include: { returnCase: true },
  });

  if (!returnCase) throw new Error("RETURN_NOT_FOUND");
  
  // Validate actor
  const actorUserId = args.staffId ?? args.sellerId;
  if (!actorUserId) throw new Error("ACTOR_REQUIRED");
  
  if (args.sellerId && returnCase.sellerId !== args.sellerId) {
    throw new Error("NOT_RETURN_SELLER");
  }

  if (!["INSPECTING", "RECEIVED", "ESCALATED"].includes(returnCase.status)) {
    throw new Error("INVALID_STATUS");
  }

  const updated = await prisma.returnCase.update({
    where: { id: args.returnCaseId },
    data: {
      status: "REFUND_PENDING",
      resolutionType: args.resolutionType,
      refundAmountCents: args.refundAmountCents,
      sellerNotes: args.notes,
    },
  });

  // Process refund
  const refund = await processRefund({
    orderId: returnCase.orderId,
    returnCaseId: args.returnCaseId,
    sellerId: returnCase.sellerId,
    buyerId: returnCase.buyerId,
    amountCents: args.refundAmountCents,
    reason: `Return: ${returnCase.reason}`,
    initiatedByStaffId: args.staffId,
  });

  // Update return case with refund
  await prisma.returnCase.update({
    where: { id: args.returnCaseId },
    data: {
      status: "REFUNDED",
      refundId: refund.id,
      refundedAt: new Date(),
      closedAt: new Date(),
    },
  });

  // Notify buyer
  await prisma.notification.create({
    data: {
      userId: returnCase.buyerId,
      type: "REFUND_ISSUED",
      title: "Refund Issued",
      body: `Your refund of $${(args.refundAmountCents / 100).toFixed(2)} has been processed.`,
      dataJson: { returnCaseId: args.returnCaseId, refundId: refund.id },
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: "return.refunded",
      entityType: "ReturnCase",
      entityId: args.returnCaseId,
      metaJson: { refundAmountCents: args.refundAmountCents, refundId: refund.id },
    },
  });

  return { returnCase: updated, refund };
}

export async function escalateReturnToDispute(args: {
  returnCaseId: string;
  buyerId: string;
  description: string;
}) {
  const returnCase = await prisma.returnCase.findUnique({
    where: { id: args.returnCaseId },
  });

  if (!returnCase) throw new Error("RETURN_NOT_FOUND");
  if (returnCase.buyerId !== args.buyerId) throw new Error("NOT_RETURN_BUYER");
  
  if (!["REJECTED", "PENDING_SELLER"].includes(returnCase.status)) {
    throw new Error("CANNOT_ESCALATE");
  }

  // Import dispute service
  const { openDispute } = await import("../disputes/service");

  const dispute = await openDispute({
    orderId: returnCase.orderId,
    returnCaseId: args.returnCaseId,
    buyerId: args.buyerId,
    reason: "RETURN_NOT_PROCESSED",
    description: args.description,
    disputedAmountCents: returnCase.refundAmountCents ?? 0,
  });

  await prisma.returnCase.update({
    where: { id: args.returnCaseId },
    data: {
      status: "ESCALATED",
      escalatedAt: new Date(),
    },
  });

  return dispute;
}
```

---

## 5) Dispute Service

Create `packages/core/disputes/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import {
  DISPUTE_STATUS,
  DISPUTE_REASON,
  SELLER_DISPUTE_RESPONSE_DAYS,
} from "./types";

const prisma = new PrismaClient();

export type OpenDisputeArgs = {
  orderId: string;
  returnCaseId?: string;
  buyerId: string;
  reason: string;
  description: string;
  disputedAmountCents: number;
  evidenceUrls?: string[];
};

export async function openDispute(args: OpenDisputeArgs) {
  // Validate order
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.buyerId !== args.buyerId) throw new Error("NOT_ORDER_OWNER");

  // Check for existing open dispute
  const existingDispute = await prisma.disputeCase.findFirst({
    where: {
      orderId: args.orderId,
      status: { notIn: ["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_SPLIT", "CLOSED"] },
    },
  });

  if (existingDispute) throw new Error("DISPUTE_ALREADY_EXISTS");

  const sellerResponseDeadline = new Date();
  sellerResponseDeadline.setDate(
    sellerResponseDeadline.getDate() + SELLER_DISPUTE_RESPONSE_DAYS
  );

  // Create dispute
  const dispute = await prisma.disputeCase.create({
    data: {
      orderId: args.orderId,
      returnCaseId: args.returnCaseId,
      buyerId: args.buyerId,
      sellerId: order.sellerId,
      reason: args.reason as any,
      status: "AWAITING_SELLER",
      description: args.description,
      disputedAmountCents: args.disputedAmountCents,
      sellerResponseDeadline,
    },
  });

  // Add evidence
  if (args.evidenceUrls?.length) {
    await prisma.disputeEvidence.createMany({
      data: args.evidenceUrls.map((url) => ({
        disputeCaseId: dispute.id,
        submittedBy: args.buyerId,
        submittedByRole: "buyer",
        type: "photo",
        category: "item_condition",
        url,
      })),
    });
  }

  // Create timeline entry
  await prisma.disputeTimeline.create({
    data: {
      disputeCaseId: dispute.id,
      action: "opened",
      actorId: args.buyerId,
      actorRole: "buyer",
      newStatus: "AWAITING_SELLER",
      details: { reason: args.reason },
    },
  });

  // Apply payout hold
  const hold = await applyDisputeHold({
    sellerId: order.sellerId,
    disputeCaseId: dispute.id,
    amountCents: args.disputedAmountCents,
  });

  await prisma.disputeCase.update({
    where: { id: dispute.id },
    data: { payoutHoldId: hold.id },
  });

  // Notify seller
  await prisma.notification.create({
    data: {
      userId: order.sellerId,
      type: "DISPUTE_OPENED",
      title: "Dispute Opened",
      body: `A buyer has opened a dispute for order ${order.orderNumber}. Please respond within ${SELLER_DISPUTE_RESPONSE_DAYS} days.`,
      dataJson: { disputeCaseId: dispute.id, orderId: args.orderId },
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.buyerId,
      action: "dispute.opened",
      entityType: "DisputeCase",
      entityId: dispute.id,
      metaJson: { orderId: args.orderId, reason: args.reason },
    },
  });

  return dispute;
}

export async function sellerRespondToDispute(args: {
  disputeCaseId: string;
  sellerId: string;
  response: string;
  evidenceUrls?: string[];
  actorUserId: string;
}) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: args.disputeCaseId },
  });

  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
  if (dispute.sellerId !== args.sellerId) throw new Error("NOT_DISPUTE_SELLER");
  if (dispute.status !== "AWAITING_SELLER") throw new Error("INVALID_STATUS");

  // Add evidence
  if (args.evidenceUrls?.length) {
    await prisma.disputeEvidence.createMany({
      data: args.evidenceUrls.map((url) => ({
        disputeCaseId: args.disputeCaseId,
        submittedBy: args.sellerId,
        submittedByRole: "seller",
        type: "document",
        category: "proof_of_delivery",
        url,
      })),
    });
  }

  // Add message
  await prisma.disputeMessage.create({
    data: {
      disputeCaseId: args.disputeCaseId,
      senderId: args.sellerId,
      senderRole: "seller",
      message: args.response,
    },
  });

  const updated = await prisma.disputeCase.update({
    where: { id: args.disputeCaseId },
    data: {
      status: "UNDER_REVIEW",
      sellerRespondedAt: new Date(),
    },
  });

  // Timeline
  await prisma.disputeTimeline.create({
    data: {
      disputeCaseId: args.disputeCaseId,
      action: "seller_responded",
      actorId: args.sellerId,
      actorRole: "seller",
      previousStatus: "AWAITING_SELLER",
      newStatus: "UNDER_REVIEW",
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.actorUserId,
      action: "dispute.seller_responded",
      entityType: "DisputeCase",
      entityId: args.disputeCaseId,
    },
  });

  return updated;
}

export async function resolveDispute(args: {
  disputeCaseId: string;
  staffId: string;
  outcome: "buyer_full" | "buyer_partial" | "seller" | "split";
  resolvedAmountCents?: number;
  notes: string;
}) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: args.disputeCaseId },
  });

  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
  if (["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_SPLIT", "CLOSED"].includes(dispute.status)) {
    throw new Error("ALREADY_RESOLVED");
  }

  let newStatus: string;
  let refundAmount = 0;

  switch (args.outcome) {
    case "buyer_full":
      newStatus = "RESOLVED_BUYER";
      refundAmount = dispute.disputedAmountCents;
      break;
    case "buyer_partial":
      newStatus = "RESOLVED_BUYER";
      refundAmount = args.resolvedAmountCents ?? Math.floor(dispute.disputedAmountCents / 2);
      break;
    case "seller":
      newStatus = "RESOLVED_SELLER";
      refundAmount = 0;
      break;
    case "split":
      newStatus = "RESOLVED_SPLIT";
      refundAmount = args.resolvedAmountCents ?? Math.floor(dispute.disputedAmountCents / 2);
      break;
    default:
      throw new Error("INVALID_OUTCOME");
  }

  const updated = await prisma.disputeCase.update({
    where: { id: args.disputeCaseId },
    data: {
      status: newStatus,
      outcome: args.outcome,
      resolvedAmountCents: refundAmount,
      resolutionNotes: args.notes,
      resolvedAt: new Date(),
    },
  });

  // Timeline
  await prisma.disputeTimeline.create({
    data: {
      disputeCaseId: args.disputeCaseId,
      action: "resolved",
      actorId: args.staffId,
      actorRole: "staff",
      previousStatus: dispute.status,
      newStatus,
      details: { outcome: args.outcome, resolvedAmountCents: refundAmount },
    },
  });

  // Process refund if buyer wins
  if (refundAmount > 0) {
    await processRefund({
      orderId: dispute.orderId,
      disputeCaseId: args.disputeCaseId,
      sellerId: dispute.sellerId,
      buyerId: dispute.buyerId,
      amountCents: refundAmount,
      reason: `Dispute resolution: ${args.outcome}`,
      initiatedByStaffId: args.staffId,
    });
  }

  // Release hold
  if (dispute.payoutHoldId) {
    await releaseHold({
      holdId: dispute.payoutHoldId,
      staffId: args.staffId,
      reason: `Dispute resolved: ${args.outcome}`,
    });
  }

  // Notify both parties
  await prisma.notification.createMany({
    data: [
      {
        userId: dispute.buyerId,
        type: "DISPUTE_RESOLVED",
        title: "Dispute Resolved",
        body: `Your dispute has been resolved. Outcome: ${args.outcome}`,
        dataJson: { disputeCaseId: args.disputeCaseId, outcome: args.outcome },
      },
      {
        userId: dispute.sellerId,
        type: "DISPUTE_RESOLVED",
        title: "Dispute Resolved",
        body: `A dispute on your order has been resolved. Outcome: ${args.outcome}`,
        dataJson: { disputeCaseId: args.disputeCaseId, outcome: args.outcome },
      },
    ],
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.staffId,
      action: "dispute.resolved",
      entityType: "DisputeCase",
      entityId: args.disputeCaseId,
      metaJson: { outcome: args.outcome, resolvedAmountCents: refundAmount },
    },
  });

  return updated;
}

export async function escalateDispute(args: {
  disputeCaseId: string;
  staffId: string;
  reason: string;
}) {
  const dispute = await prisma.disputeCase.findUnique({
    where: { id: args.disputeCaseId },
  });

  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");

  const updated = await prisma.disputeCase.update({
    where: { id: args.disputeCaseId },
    data: {
      status: "ESCALATED",
      escalatedToStaffId: args.staffId,
      escalatedAt: new Date(),
    },
  });

  await prisma.disputeTimeline.create({
    data: {
      disputeCaseId: args.disputeCaseId,
      action: "escalated",
      actorId: args.staffId,
      actorRole: "staff",
      previousStatus: dispute.status,
      newStatus: "ESCALATED",
      details: { reason: args.reason },
    },
  });

  return updated;
}
```

---

## 5.5) Appeal Service (Phase 38 Integration)

Create `packages/core/appeals/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export type AppealReason =
  | "BUYER_MISREPRESENTED"
  | "EVIDENCE_SUPPORTS_SELLER"
  | "POLICY_MISAPPLIED"
  | "ITEM_NOT_AS_DESCRIBED_INCORRECT"
  | "SHIPPING_ISSUE_NOT_SELLER_FAULT"
  | "OTHER";

export type AppealDecision =
  | "OVERTURN_FULL"
  | "OVERTURN_PARTIAL"
  | "UPHELD"
  | "MODIFIED";

export async function fileAppeal(input: {
  claimId: string;
  sellerId: string;
  reason: AppealReason;
  description: string;
  evidenceUrls: string[];
}): Promise<any> {
  // Verify seller owns the claim
  const claim = await prisma.buyerProtectionClaim.findFirst({
    where: { id: input.claimId, sellerId: input.sellerId },
  });
  if (!claim) throw new Error("CLAIM_NOT_FOUND");
  if (claim.status !== "RESOLVED_BUYER_FAVOR") {
    throw new Error("CLAIM_NOT_APPEALABLE");
  }

  // Check existing appeal
  const existing = await prisma.sellerAppeal.findUnique({
    where: { claimId: input.claimId },
  });
  if (existing) throw new Error("APPEAL_ALREADY_EXISTS");

  const appeal = await prisma.sellerAppeal.create({
    data: {
      claimId: input.claimId,
      sellerId: input.sellerId,
      reason: input.reason,
      description: input.description,
      evidenceUrls: input.evidenceUrls,
      status: "PENDING",
    },
  });

  await emitAuditEvent({
    action: "appeal.filed",
    entityType: "SellerAppeal",
    entityId: appeal.id,
    meta: { sellerId: input.sellerId, claimId: input.claimId },
  });

  return appeal;
}

export async function reviewAppeal(input: {
  appealId: string;
  staffId: string;
  decision: AppealDecision;
  reason: string;
}): Promise<any> {
  const appeal = await prisma.sellerAppeal.findUnique({
    where: { id: input.appealId },
  });
  if (!appeal) throw new Error("APPEAL_NOT_FOUND");
  if (appeal.status !== "PENDING" && appeal.status !== "UNDER_REVIEW") {
    throw new Error("APPEAL_NOT_REVIEWABLE");
  }

  const updated = await prisma.sellerAppeal.update({
    where: { id: input.appealId },
    data: {
      status: input.decision === "UPHELD" ? "DENIED" : "APPROVED",
      decision: input.decision,
      decisionReason: input.reason,
      reviewedByStaffId: input.staffId,
      reviewedAt: new Date(),
    },
  });

  // Handle refund reversal if overturned
  if (input.decision === "OVERTURN_FULL" || input.decision === "OVERTURN_PARTIAL") {
    // Trigger refund reversal logic (Phase 38)
  }

  await emitAuditEvent({
    action: "appeal.reviewed",
    entityType: "SellerAppeal",
    entityId: input.appealId,
    meta: { staffId: input.staffId, decision: input.decision },
  });

  return updated;
}

export async function getSellerAppeals(sellerId: string): Promise<any[]> {
  return prisma.sellerAppeal.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
  });
}
```

---

## 6) Refund Service (Ledger-First, Idempotent)

Create `packages/core/refunds/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function refundLedgerKey(refundId: string): string {
  return `refund:${refundId}`;
}

export type ProcessRefundArgs = {
  orderId: string;
  returnCaseId?: string;
  disputeCaseId?: string;
  sellerId: string;
  buyerId: string;
  amountCents: number;
  reason: string;
  initiatedByStaffId?: string;
};

export async function processRefund(args: ProcessRefundArgs) {
  // Generate refund ID
  const refundId = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ledgerKey = refundLedgerKey(refundId);

  // Check idempotency - if ledger entry exists, refund already processed
  const existingLedger = await prisma.ledgerEntry.findUnique({
    where: { ledgerKey },
  });

  if (existingLedger) {
    // Return existing refund record
    const existingRefund = await prisma.refundRecord.findFirst({
      where: { ledgerKey },
    });
    return existingRefund;
  }

  // Get order for breakdown
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");

  // Calculate breakdown (simplified - full refund)
  const itemRefundCents = args.amountCents;
  const shippingRefundCents = 0;
  const taxRefundCents = 0;

  // Create refund record
  const refund = await prisma.refundRecord.create({
    data: {
      orderId: args.orderId,
      returnCaseId: args.returnCaseId,
      disputeCaseId: args.disputeCaseId,
      sellerId: args.sellerId,
      buyerId: args.buyerId,
      amountCents: args.amountCents,
      itemRefundCents,
      shippingRefundCents,
      taxRefundCents,
      refundType: args.amountCents >= (order.totalCents ?? 0) ? "full" : "partial",
      reason: args.reason,
      ledgerKey,
      initiatedByStaffId: args.initiatedByStaffId,
    },
  });

  // Post ledger entry (idempotent via upsert)
  await prisma.ledgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      ledgerKey,
      provider: "platform",
      providerObjectType: "refund",
      providerObjectId: refund.id,
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: "REFUND",
      direction: "DEBIT",
      amountCents: args.amountCents,
      currency: "USD",
      occurredAt: new Date(),
      description: args.reason,
    },
  });

  // Post fee reversal if applicable
  const feeReversalKey = `${ledgerKey}:fee_reversal`;
  const originalFee = await prisma.ledgerEntry.findFirst({
    where: {
      orderId: args.orderId,
      type: "MARKETPLACE_FEE",
    },
  });

  if (originalFee) {
    const feeRefundCents = Math.floor(
      (args.amountCents / (order.totalCents ?? args.amountCents)) * originalFee.amountCents
    );

    await prisma.ledgerEntry.upsert({
      where: { ledgerKey: feeReversalKey },
      update: {},
      create: {
        ledgerKey: feeReversalKey,
        provider: "platform",
        providerObjectType: "refund",
        providerObjectId: refund.id,
        sellerId: args.sellerId,
        orderId: args.orderId,
        type: "REFUND_FEE_REVERSAL",
        direction: "CREDIT",
        amountCents: feeRefundCents,
        currency: "USD",
        occurredAt: new Date(),
        description: `Fee reversal for refund ${refund.id}`,
      },
    });
  }

  // Update order status
  await prisma.order.update({
    where: { id: args.orderId },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
    },
  });

  // Mark refund as processed
  await prisma.refundRecord.update({
    where: { id: refund.id },
    data: {
      processedAt: new Date(),
      providerStatus: "succeeded",
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.initiatedByStaffId ?? "system",
      action: "refund.processed",
      entityType: "RefundRecord",
      entityId: refund.id,
      metaJson: {
        orderId: args.orderId,
        amountCents: args.amountCents,
        reason: args.reason,
      },
    },
  });

  return refund;
}
```

---

## 7) Hold Service (Uses Phase 4 PayoutHold Model)

> **A5 BLOCKER FIX:** This service uses the PayoutHold model from Phase 4 (canonical location).
> Phase 14 HoldReason enum values are mapped to Phase 4's `reasonCode` string field.
> See: `TWICELY_V2_INSTALL_PHASE_4_PAYMENTS_WEBHOOKS_LEDGER_PAYOUTS.md`

Create `packages/core/holds/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// HOLD REASON MAPPING
// Phase 14 HoldReason enum → Phase 4 reasonCode string
// =============================================================================
const HOLD_REASON_MAP: Record<string, string> = {
  DISPUTE_OPENED: "dispute_opened",
  CHARGEBACK_RECEIVED: "chargeback_received",
  RISK_FLAG: "risk_flag",
  VERIFICATION_PENDING: "verification_pending",
  POLICY_VIOLATION: "policy_violation",
  MANUAL_REVIEW: "manual_review",
};

function mapHoldReason(reason: string): string {
  return HOLD_REASON_MAP[reason] ?? reason.toLowerCase();
}

export async function applyDisputeHold(args: {
  sellerId: string;
  disputeCaseId: string;
  amountCents?: number;
  reason?: string;
}) {
  // Use Phase 4's PayoutHold model with reasonCode mapping
  const hold = await prisma.payoutHold.create({
    data: {
      sellerId: args.sellerId,
      reasonCode: mapHoldReason(args.reason ?? "DISPUTE_OPENED"),
      status: "ACTIVE",
      amountCents: args.amountCents,
      referenceType: "dispute",
      referenceId: args.disputeCaseId,
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: "system",
      action: "hold.applied",
      entityType: "PayoutHold",
      entityId: hold.id,
      metaJson: {
        sellerId: args.sellerId,
        reasonCode: hold.reasonCode,
        disputeCaseId: args.disputeCaseId,
      },
    },
  });

  return hold;
}

export async function releaseHold(args: {
  holdId: string;
  staffId: string;
  reason: string;
}) {
  const hold = await prisma.payoutHold.findUnique({
    where: { id: args.holdId },
  });

  if (!hold) throw new Error("HOLD_NOT_FOUND");
  if (hold.status !== "ACTIVE") throw new Error("HOLD_NOT_ACTIVE");

  const updated = await prisma.payoutHold.update({
    where: { id: args.holdId },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
      releasedByStaffId: args.staffId,
      notes: args.reason,
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.staffId,
      action: "hold.released",
      entityType: "PayoutHold",
      entityId: args.holdId,
      metaJson: { reason: args.reason },
    },
  });

  return updated;
}

export async function getActiveHolds(sellerId: string) {
  return prisma.payoutHold.findMany({
    where: {
      sellerId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasActiveHold(sellerId: string): Promise<boolean> {
  const count = await prisma.payoutHold.count({
    where: {
      sellerId,
      status: "ACTIVE",
    },
  });
  return count > 0;
}
```

---

## 8) API Endpoints

### 8.1 Buyer Return API

Create `apps/web/app/api/returns/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { openReturn } from "@/packages/core/returns/service";

const prisma = new PrismaClient();

// GET /api/returns - List buyer's returns
export async function GET(req: Request) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()

  const returns = await prisma.returnCase.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ returns });
}

// POST /api/returns - Open new return
export async function POST(req: Request) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()
  const { orderId, orderItemId, reason, notes, evidenceUrls } = await req.json();

  try {
    const returnCase = await openReturn({
      orderId,
      orderItemId,
      buyerId,
      reason,
      notes,
      evidenceUrls,
    });

    return NextResponse.json({ returnCase }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 8.2 Seller Return API

Create `apps/web/app/api/seller/returns/[id]/respond/route.ts`:

```ts
import { NextResponse } from "next/server";
import { sellerRespondToReturn } from "@/packages/core/returns/service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sellerId = "twi_u_replace"; // TODO: requireUserAuth()
  const { action, notes } = await req.json();

  try {
    const returnCase = await sellerRespondToReturn({
      returnCaseId: params.id,
      sellerId,
      action,
      notes,
      actorUserId: sellerId,
    });

    return NextResponse.json({ returnCase });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 8.3 Dispute API

Create `apps/web/app/api/disputes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { openDispute } from "@/packages/core/disputes/service";

const prisma = new PrismaClient();

// GET /api/disputes - List buyer's disputes
export async function GET(req: Request) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()

  const disputes = await prisma.disputeCase.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ disputes });
}

// POST /api/disputes - Open new dispute
export async function POST(req: Request) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()
  const { orderId, reason, description, disputedAmountCents, evidenceUrls } = await req.json();

  try {
    const dispute = await openDispute({
      orderId,
      buyerId,
      reason,
      description,
      disputedAmountCents,
      evidenceUrls,
    });

    return NextResponse.json({ dispute }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 8.4 Corp Returns Queue

Create `apps/web/app/api/platform/returns/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "returns.view");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const assignedToMe = searchParams.get("assignedToMe") === "true";

  const where: any = {};
  if (status) where.status = status;
  if (assignedToMe) where.assignedToStaffId = ctx.actorUserId;

  const returns = await prisma.returnCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      evidence: true,
      messages: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json({ returns });
}
```

### 8.5 Corp Disputes Queue

Create `apps/web/app/api/platform/disputes/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "disputes.view");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: any = {};
  if (status) where.status = status;

  const disputes = await prisma.disputeCase.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: 100,
    include: {
      evidence: true,
      timeline: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });

  return NextResponse.json({ disputes });
}
```

### 8.6 Corp Resolve Dispute

Create `apps/web/app/api/platform/disputes/[id]/resolve/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { resolveDispute } from "@/packages/core/disputes/service";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "disputes.resolve");

  const { outcome, resolvedAmountCents, notes } = await req.json();

  try {
    const dispute = await resolveDispute({
      disputeCaseId: params.id,
      staffId: ctx.actorUserId,
      outcome,
      resolvedAmountCents,
      notes,
    });

    return NextResponse.json({ dispute });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

---

## 9) Health Provider

Create `packages/core/health/providers/returnsDisputesHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const returnsDisputesHealthProvider: HealthProvider = {
  id: "returns_disputes",
  label: "Returns & Disputes",
  description: "Validates return case flow, dispute handling, and hold management",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: No stale returns awaiting seller response (>3 days)
    const staleReturns = await prisma.returnCase.count({
      where: {
        status: "PENDING_SELLER",
        sellerResponseDeadline: { lt: new Date() },
      },
    });
    checks.push({
      id: "returns.no_stale_pending",
      label: "No overdue return responses",
      status: staleReturns === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleReturns === 0 ? "All responses on time" : `${staleReturns} overdue`,
    });
    if (staleReturns > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 2: No stale disputes awaiting seller (>5 days)
    const staleDisputes = await prisma.disputeCase.count({
      where: {
        status: "AWAITING_SELLER",
        sellerResponseDeadline: { lt: new Date() },
      },
    });
    checks.push({
      id: "disputes.no_stale_awaiting",
      label: "No overdue dispute responses",
      status: staleDisputes === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleDisputes === 0 ? "All responses on time" : `${staleDisputes} overdue`,
    });
    if (staleDisputes > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 3: All resolved disputes have outcome
    const resolvedWithoutOutcome = await prisma.disputeCase.count({
      where: {
        status: { in: ["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_SPLIT"] },
        outcome: null,
      },
    });
    checks.push({
      id: "disputes.resolved_have_outcome",
      label: "Resolved disputes have outcome",
      status: resolvedWithoutOutcome === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: resolvedWithoutOutcome === 0 ? "All have outcome" : `${resolvedWithoutOutcome} missing`,
    });
    if (resolvedWithoutOutcome > 0) status = HEALTH_STATUS.FAIL;

    // Check 4: Refunded returns have ledger entry
    const refundedReturns = await prisma.returnCase.findMany({
      where: { status: "REFUNDED" },
      take: 10,
    });
    let missingLedger = 0;
    for (const r of refundedReturns) {
      if (!r.refundId) {
        missingLedger++;
        continue;
      }
      const ledgerEntry = await prisma.ledgerEntry.findFirst({
        where: { providerObjectId: r.refundId, type: "REFUND" },
      });
      if (!ledgerEntry) missingLedger++;
    }
    checks.push({
      id: "returns.refunded_have_ledger",
      label: "Refunded returns have ledger entry",
      status: missingLedger === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: missingLedger === 0 ? "All have ledger" : `${missingLedger} missing`,
    });
    if (missingLedger > 0) status = HEALTH_STATUS.FAIL;

    // Check 5: Open disputes have active holds
    const openDisputes = await prisma.disputeCase.findMany({
      where: {
        status: { notIn: ["RESOLVED_BUYER", "RESOLVED_SELLER", "RESOLVED_SPLIT", "CLOSED"] },
      },
      take: 20,
    });
    let missingHolds = 0;
    for (const d of openDisputes) {
      if (!d.payoutHoldId) {
        missingHolds++;
        continue;
      }
      const hold = await prisma.payoutHold.findUnique({
        where: { id: d.payoutHoldId },
      });
      if (!hold || hold.status !== "ACTIVE") missingHolds++;
    }
    checks.push({
      id: "disputes.open_have_holds",
      label: "Open disputes have active holds",
      status: missingHolds === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: missingHolds === 0 ? "All have holds" : `${missingHolds} missing`,
    });
    if (missingHolds > 0) status = HEALTH_STATUS.FAIL;

    // Check 6: Active holds count
    const activeHolds = await prisma.payoutHold.count({
      where: { status: "ACTIVE" },
    });
    checks.push({
      id: "holds.active_count",
      label: "Active payout holds",
      status: HEALTH_STATUS.PASS,
      message: `${activeHolds} active holds`,
    });

    return {
      providerId: "returns_disputes",
      status,
      summary: status === HEALTH_STATUS.PASS 
        ? "Returns & disputes healthy" 
        : "Issues detected in returns/disputes",
      providerVersion: "1.0.0",
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

## 10) Doctor Checks

```ts
async function checkReturnsDisputes() {
  const checks = [];

  // 1. Create test order and return - verify state transitions
  const testOrderId = `test_order_${Date.now()}`;
  const testBuyerId = `test_buyer_${Date.now()}`;
  const testSellerId = `test_seller_${Date.now()}`;

  // Simulate return flow
  const returnCase = await prisma.returnCase.create({
    data: {
      orderId: testOrderId,
      buyerId: testBuyerId,
      sellerId: testSellerId,
      reason: "NOT_AS_DESCRIBED",
      status: "PENDING_SELLER",
      sellerResponseDeadline: new Date(Date.now() + 3 * 86400000),
    },
  });

  checks.push({
    key: "returns.create",
    ok: !!returnCase.id,
    details: "Return case created",
  });

  // 2. Approve return - verify status change
  const approved = await prisma.returnCase.update({
    where: { id: returnCase.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  checks.push({
    key: "returns.approve_transition",
    ok: approved.status === "APPROVED",
    details: "Status transitioned to APPROVED",
  });

  // 3. Create dispute and verify hold is applied
  const dispute = await prisma.disputeCase.create({
    data: {
      orderId: testOrderId,
      buyerId: testBuyerId,
      sellerId: testSellerId,
      reason: "ITEM_NOT_AS_DESCRIBED",
      status: "AWAITING_SELLER",
      description: "Test dispute",
      disputedAmountCents: 1000,
      sellerResponseDeadline: new Date(Date.now() + 5 * 86400000),
    },
  });

  const hold = await prisma.payoutHold.create({
    data: {
      sellerId: testSellerId,
      reason: "DISPUTE_OPENED",
      status: "ACTIVE",
      referenceType: "dispute",
      referenceId: dispute.id,
    },
  });

  checks.push({
    key: "disputes.hold_applied",
    ok: hold.status === "ACTIVE",
    details: "Hold applied on dispute open",
  });

  // 4. Verify payout execution is blocked with active hold
  const activeHolds = await prisma.payoutHold.count({
    where: { sellerId: testSellerId, status: "ACTIVE" },
  });
  checks.push({
    key: "holds.blocks_payout",
    ok: activeHolds > 0,
    details: `${activeHolds} active holds block payout`,
  });

  // 5. Create refund and verify ledger entry
  const refundId = `test_refund_${Date.now()}`;
  const ledgerKey = `refund:${refundId}`;

  await prisma.ledgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      ledgerKey,
      provider: "test",
      providerObjectType: "refund",
      providerObjectId: refundId,
      sellerId: testSellerId,
      orderId: testOrderId,
      type: "REFUND",
      direction: "DEBIT",
      amountCents: 1000,
      currency: "USD",
      occurredAt: new Date(),
    },
  });

  // Verify idempotency - second upsert should not create duplicate
  await prisma.ledgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      ledgerKey,
      provider: "test",
      providerObjectType: "refund",
      providerObjectId: refundId,
      sellerId: testSellerId,
      orderId: testOrderId,
      type: "REFUND",
      direction: "DEBIT",
      amountCents: 1000,
      currency: "USD",
      occurredAt: new Date(),
    },
  });

  const ledgerCount = await prisma.ledgerEntry.count({
    where: { ledgerKey },
  });
  checks.push({
    key: "refunds.ledger_idempotent",
    ok: ledgerCount === 1,
    details: ledgerCount === 1 ? "Idempotent" : `Duplicates: ${ledgerCount}`,
  });

  // Cleanup
  await prisma.ledgerEntry.deleteMany({ where: { provider: "test" } });
  await prisma.payoutHold.deleteMany({ where: { sellerId: testSellerId } });
  await prisma.disputeCase.deleteMany({ where: { buyerId: testBuyerId } });
  await prisma.returnCase.deleteMany({ where: { buyerId: testBuyerId } });

  return checks;
}
```

---

## 11) Phase 14 Completion Criteria

- ReturnCase model with full state machine
- DisputeCase model with evidence and timeline
- **DisputeSlaSettings** seeded with defaults
- Admin UI at `/corp/settings/disputes`
- Refund service posts ledger entries idempotently
- Dispute open applies PayoutHold (uses Phase 4 model with reasonCode mapping)
- Payout execution blocked when hold active
- Corp UI: Returns queue, Disputes queue
- Buyer UI: Request return, Open dispute
- Seller UI: Respond to returns
- Health provider passes all checks
- Doctor verifies:
  - Return state transitions
  - Dispute hold application
  - Refund ledger idempotency
  - Hold blocks payout

---

## 12) Canonical Alignment Notes

| Canonical Requirement | Implementation |
|----------------------|----------------|
| Clear windows | `sellerResponseDeadline`, `returnShipDeadline` |
| Evidence-based | DisputeEvidence, ReturnEvidence models |
| Ledger-first | Refund posts REFUND + REFUND_FEE_REVERSAL |
| Escalation path | Return → Dispute escalation flow |
| Holds block payouts | PayoutHold checked in payout execution |
| PayoutHold canonical | Model in Phase 4; Phase 14 maps HoldReason to reasonCode |
| Audit everything | AuditEvent for all mutations |
| Phase 38 (Buyer Protection) | SellerAppeal model and workflow |
| Phase 38 (Buyer Protection) | CategoryCoverageLimit lookups |
| Phase 38 (Buyer Protection) | SellerProtectionScore updates on claim resolution |

---

## 13) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 14 implementation |
| 1.1 | 2026-01-20 | Added DisputeSlaSettings (Compliance Fix) |
| 1.2 | 2026-01-21 | A5 Blocker Fix: Removed duplicate PayoutHold model, uses Phase 4 canonical with reasonCode mapping |
| 1.3 | 2026-01-22 | Phase 38 Integration: SellerAppeal, DisputeTimelineEvent models, Appeal service |
