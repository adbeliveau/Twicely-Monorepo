# TWICELY_LOCK_ENUMS_AND_STATES.md
## Authoritative Enum & State Machine Definitions

**Version:** 1.0  
**Locked:** 2026-01-23  
**Authority:** This document is the single source of truth for all enum values and state machine definitions.

---

## PRECEDENCE RULE

When conflicts exist between sources:

1. **This lock sheet** (highest authority after resolution)
2. **LOCKED documents** (TWICELY_*_LOCKED.md)
3. **schema.prisma**
4. **CANONICAL documents**
5. **Install Phase documents** (lowest authority)

**If any source contradicts this lock sheet, that source must be updated.**

---

## 1. ORDER STATE MACHINE (CANONICAL)

### 1.1 OrderStatus Enum (Authoritative)

**Source:** TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md:L191-207

```prisma
enum OrderStatus {
  // Creation flow
  CREATED                 // Order created, awaiting payment intent
  AWAITING_PAYMENT        // Payment initiated but not confirmed
  
  // Payment confirmed
  PAID                    // Payment confirmed via webhook
  AWAITING_FULFILLMENT    // Paid, seller must ship/fulfill
  
  // Fulfillment flow
  FULFILLED               // Shipped/picked up completed
  DELIVERED               // Delivery confirmed
  COMPLETED               // Post-delivery window passed, no issues
  
  // Cancellation
  CANCELED                // Cancelled (spelling: American English)
  
  // Return flow
  RETURN_REQUESTED        // Buyer requested return
  RETURN_APPROVED         // Seller/platform approved return
  RETURN_IN_TRANSIT       // Return shipped back
  RETURNED                // Return received by seller
  
  // Refund flow
  REFUNDED                // Full refund completed
  PARTIAL_REFUNDED        // Partial refund completed
  
  // Dispute flow
  DISPUTED                // Chargeback/dispute opened
  
  // Terminal
  CLOSED                  // Terminal state (completed/refunded/dispute resolved)
}
```

**Total States:** 17

### 1.2 Order State Transitions (Authoritative)

```
CREATED → AWAITING_PAYMENT → PAID → AWAITING_FULFILLMENT → FULFILLED → DELIVERED → COMPLETED → CLOSED

Cancellation:
  CREATED/AWAITING_PAYMENT → CANCELED

Returns:
  DELIVERED → RETURN_REQUESTED → RETURN_APPROVED → RETURN_IN_TRANSIT → RETURNED → REFUNDED/PARTIAL_REFUNDED

Disputes:
  PAID/FULFILLED/DELIVERED/COMPLETED → DISPUTED → REFUNDED/COMPLETED (depending on outcome)
```

### 1.3 Payment-Driven Rules (Hard)

| Transition | Trigger | Rule |
|------------|---------|------|
| → PAID | Webhook only | `payment_intent.succeeded` |
| → REFUNDED | Webhook only | `refund.created` + full amount |
| → PARTIAL_REFUNDED | Webhook only | `refund.created` + partial amount |
| → DISPUTED | Webhook only | `charge.dispute.created` |

---

## 2. LISTING STATE MACHINE (CANONICAL)

### 2.1 ListingStatus Enum (Authoritative)

**Source:** TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md:L80-86 + schema.prisma alignment

```prisma
enum ListingStatus {
  DRAFT           // Not visible, editable, not sellable
  PENDING_REVIEW  // Awaiting moderation (optional for some categories)
  ACTIVE          // Visible, sellable
  PAUSED          // Temporarily not sellable
  ENDED           // No longer sellable, may be relisted
  SOLD            // Reserved to a paid order (terminal for single-item)
  REMOVED         // Removed by moderation
  ARCHIVED        // Historical, read-only storage (terminal)
}
```

**Total States:** 8

### 2.2 Listing State Transitions (Authoritative)

```
DRAFT → PENDING_REVIEW (if moderation required) → ACTIVE
DRAFT → ACTIVE (if no moderation)
ACTIVE ↔ PAUSED
ACTIVE → ENDED
PAUSED → ENDED
ENDED → ACTIVE (relist)
ACTIVE → SOLD (payment confirmed)
SOLD → ARCHIVED
ENDED → ARCHIVED
Any → REMOVED (platform moderation)
```

### 2.3 Multi-Quantity Behavior

- Listing remains `ACTIVE` while `availableQuantity > 0`
- Transitions to `ENDED` (not `SOLD`) when `availableQuantity = 0`
- `SOLD` state is for single-item listings only

---

## 3. SELLER TIER ENUM (CANONICAL)

**Source:** TWICELY_V2_FREEZE_0_44_LOCKED.md:L184-191, TWICELY_Monetization_CANONICAL:L82-91

```prisma
enum SellerTier {
  SELLER      // $0/mo     - Casual seller (no store)
  STARTER     // $4.95/mo  - Entry level store
  BASIC       // $21.95/mo - Small business store
  PRO         // $59.95/mo - Growing business store
  ELITE       // $299.95/mo - High volume store
  ENTERPRISE  // $2,999.95/mo - Enterprise store
}
```

**Total Values:** 6

---

## 4. SELLER TYPE ENUM (CANONICAL)

**Source:** TWICELY_V2_FREEZE_0_44_LOCKED.md:L147-152, TWICELY_USER_MODEL_LOCKED.md:§3

```prisma
enum SellerType {
  PERSONAL    // Individual seller - SELLER tier only, cannot subscribe to store
  BUSINESS    // Registered business - can use any tier (SELLER through ENTERPRISE)
}
```

**Total Values:** 2

**Rule:** PERSONAL sellers CANNOT subscribe to store tiers (STARTER+). Must upgrade to BUSINESS first.

---

## 5. SELLER STATUS ENUM (CANONICAL)

**Source:** TWICELY_V2_INSTALL_PHASE_13:SellerStatus

```prisma
enum SellerStatus {
  SELLER_DRAFT      // Started onboarding
  SELLER_PENDING    // Awaiting verification
  SELLER_ACTIVE     // Fully verified, can sell
  SELLER_RESTRICTED // Limited actions
  SELLER_SUSPENDED  // Cannot sell
}
```

**Total Values:** 5

---

## 6. PAYOUTS STATUS ENUM (CANONICAL)

**Source:** TWICELY_V2_INSTALL_PHASE_13:PayoutsStatus

```prisma
enum PayoutsStatus {
  PAYOUTS_PENDING   // Not yet set up
  PAYOUTS_REVIEW    // Under review
  PAYOUTS_ENABLED   // Can receive payouts
  PAYOUTS_BLOCKED   // Blocked by platform
}
```

**Total Values:** 4

---

## 7. RETURN STATUS ENUM (CANONICAL)

```prisma
enum ReturnStatus {
  REQUESTED
  APPROVED
  DENIED
  SHIPPED
  RECEIVED
  REFUNDED
  CLOSED
  ESCALATED
}
```

**Total Values:** 8

---

## 8. DISPUTE STATUS ENUM (CANONICAL)

```prisma
enum DisputeStatus {
  OPEN
  PENDING_SELLER
  PENDING_BUYER
  UNDER_REVIEW
  RESOLVED_BUYER_FAVOR
  RESOLVED_SELLER_FAVOR
  RESOLVED_SPLIT
  CLOSED
  ESCALATED
}
```

**Total Values:** 9

---

## 9. BUSINESS TYPE ENUM (CANONICAL)

**Source:** TWICELY_V2_FREEZE_0_44_LOCKED.md:L159-167

```prisma
enum BusinessType {
  SOLE_PROPRIETOR
  LLC
  CORPORATION
  PARTNERSHIP
  NONPROFIT
  OTHER
}
```

**Total Values:** 6

---

## 10. TAX ID TYPE ENUM (CANONICAL)

**Source:** TWICELY_V2_FREEZE_0_44_LOCKED.md:L169-178

```prisma
enum TaxIdType {
  SSN
  EIN
  ITIN
}
```

**Total Values:** 3

---

## SOURCE-OF-TRUTH REFERENCES

| Enum | Primary Source | Verified Against |
|------|----------------|------------------|
| OrderStatus | TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md:L191-207 | schema.prisma (requires update) |
| ListingStatus | TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md:L80-86 | schema.prisma |
| SellerTier | TWICELY_V2_FREEZE_0_44_LOCKED.md:L184-191 | Monetization_CANONICAL, schema.prisma |
| SellerType | TWICELY_V2_FREEZE_0_44_LOCKED.md:L147-152 | USER_MODEL_LOCKED, schema.prisma |
| SellerStatus | TWICELY_V2_INSTALL_PHASE_13 | schema.prisma |
| PayoutsStatus | TWICELY_V2_INSTALL_PHASE_13 | schema.prisma |
| BusinessType | TWICELY_V2_FREEZE_0_44_LOCKED.md:L159-167 | schema.prisma |
| TaxIdType | TWICELY_V2_FREEZE_0_44_LOCKED.md:L169-178 | schema.prisma |

---

## REQUIRED SCHEMA UPDATE

The following changes are REQUIRED to align schema.prisma with this lock sheet:

```prisma
// REPLACE existing OrderStatus with:
enum OrderStatus {
  CREATED
  AWAITING_PAYMENT
  PAID
  AWAITING_FULFILLMENT
  FULFILLED
  DELIVERED
  COMPLETED
  CANCELED
  RETURN_REQUESTED
  RETURN_APPROVED
  RETURN_IN_TRANSIT
  RETURNED
  REFUNDED
  PARTIAL_REFUNDED
  DISPUTED
  CLOSED
}

// ADD to ListingStatus:
// ARCHIVED (already in LOCKED doc)
```

---

**END OF LOCK SHEET**
