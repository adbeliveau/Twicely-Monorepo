# TWICELY CORE COMMERCE STATE MACHINES (PRODUCTS, LISTINGS, ORDERS) - LOCKED

## STATUS
**LOCKED BASELINE - DO NOT DEVIATE WITHOUT EXPLICIT VERSION CHANGE**

This document defines the canonical state machines for:
- Products (catalog items / templates)
- Listings (sellable offers)
- Orders (purchase + fulfillment lifecycle)

It is the definitive reference for:
- Allowed states
- Allowed transitions
- Who can perform transitions (owner / delegated staff / platform staff)
- Required side effects (audit, timestamps, inventory, messaging)

This spec MUST align with:
- `TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`
- `TWICELY_PAYMENTS_PAYOUTS_STRIPE_CONNECT_LOCKED.md`
- `TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md`

---

## 0. Core Definitions

### Owner (seller)
The user who owns the listing/order (sellerId/ownerId on the resource).

### Actor
The authenticated user performing the action (actorUserId).

### Delegated staff
Actor may act on behalf of an owner only with explicit delegated permissions.

### Platform staff
Twicely internal roles (platform RBAC). Platform staff can access admin tools and perform restricted actions, always audited.

---

## 1. Products State Machine (Catalog)

> Products are reusable templates used to create listings (e.g., common SKU, brand/model, attributes).
> In a marketplace, products may be created by sellers, admins, or via imports.

### 1.1 Product States
- `draft` - incomplete, not usable for new listings
- `active` - usable template for creating listings
- `archived` - read-only, not usable for new listings (existing listings remain valid)

### 1.2 Allowed Transitions
- `draft -> active`
- `active -> archived`
- `archived -> active` (optional, if you want restore)

### 1.3 Transition Rules

**Platform Staff (Corp RBAC):**
- Platform staff with appropriate role can create/edit products
- Product catalog is platform-managed, not seller-owned
- All platform actions are audited

**Seller Context:**
- Sellers do NOT have `catalog.*` permissions (see RBAC_VOCABULARY_LOCK.md)
- Sellers create **listings** (not products) via `listings.manage` scope
- Listings may optionally reference a product template

> Note: The `catalog.*` permission namespace is reserved for platform staff only.
> Seller delegated access uses `listings.manage` for seller content creation.

### 1.4 Required Fields by State
- `draft`: minimal identity allowed
- `active`: must have all required attributes (category, brand, title, condition schema, attribute set)
- `archived`: immutable except admin restore note

### 1.5 Required Side Effects
- AuditEvent on transitions
- Timestamp updates:
  - `activatedAt`, `archivedAt`
- If product is archived:
  - block creation of new listings referencing this product
  - existing listings remain unchanged

---

## 2. Listings State Machine (Sellable Offers)

Listings represent an offer for sale with price, condition, photos, shipping policy, etc.
A listing is owned by a seller userId and is the authoritative sellable record.

### 2.1 Listing States (Canonical)
- `draft` - not visible, editable, not sellable
- `active` - visible, sellable
- `paused` - temporarily not sellable, still visible or hidden depending on product decision
- `ended` - no longer sellable, may be relisted
- `sold` - reserved to a paid order (terminal for the listing)
- `archived` - historical, read-only storage (terminal)

> Note: `sold` is a state indicating a completed sale (linked to a paid order).
> `ended` is seller-initiated end without sale.

### 2.2 Allowed Transitions
- `draft -> active`
- `active -> paused`
- `paused -> active`
- `active -> ended`
- `paused -> ended`
- `ended -> active` (relist / revive)
- `active -> sold` (system transition when order payment confirmed)
- `sold -> archived` (system transition after order completes / retention period)
- `ended -> archived` (seller or system archival)

### 2.3 Transition Rules (Who can do what)

**Owner can:**
- create/edit draft
- activate
- pause/unpause
- end listing
- relist ended listings
- archive ended listings

**Delegated staff can:**
- if has `listing.create` and `listing.edit`
- pause/unpause if has `listing.end` or `listing.edit` (policy decision; baseline: require explicit `listing.end`)
- end/relist only with `listing.end`

**Platform staff can:**
- end listing for policy/moderation reasons
- archive listing
- restore ended/archived listing only by admin override
All platform actions must include `reasonCode` and be audited.

### 2.4 Preconditions
- `draft -> active` requires:
  - required fields present (title, price, condition, photos >= 1, category, shipping policy)
  - seller payments profile is valid if you require it pre-sale (policy choice)
- `active -> sold` requires:
  - an associated order with status `paid` (confirmed via payment platform webhook)
- `ended -> active` relist requires:
  - inventory still available
  - not under moderation lock

### 2.5 Side Effects
- AuditEvent for every seller-initiated transition
- System transitions (`active -> sold`, `sold -> archived`) must also be logged as system events
- Inventory lock:
  - on `active -> sold`, lock quantity to prevent double sale
- Search indexing updates:
  - `active` indexed
  - `paused/ended/sold/archived` removed from active search

### 2.6 Multi-Quantity Listings Behavior (CANONICAL - HIGH-6 Clarification)

For listings with `quantity > 1`, the following rules apply:

**State Rules:**
- Listing remains `ACTIVE` while `availableQuantity > 0`
- Listing transitions to `ENDED` when `availableQuantity = 0` (NOT to `SOLD`)
- The `SOLD` state is reserved for single-item listings only

**Quantity Fields:**
- `quantity`: Original listed quantity (immutable after first sale)
- `availableQuantity`: Remaining purchasable quantity (decrements on sale)

**Partial Sale Flow:**
1. Buyer purchases `N` units (where `N <= availableQuantity`)
2. System reserves `N` units via `InventoryReservation`
3. `availableQuantity` decremented by `N` atomically
4. On payment: Order created, listing remains ACTIVE if quantity remains
5. If `availableQuantity = 0`: Listing transitions to `ENDED`

**Seller Quantity Reduction:**
- Seller MAY reduce quantity at any time
- Seller CANNOT reduce below reserved quantity (pending orders)

**Race Conditions:**
- Reservation system prevents overselling
- First successful payment wins inventory
- Failed reservations return `INSUFFICIENT_QUANTITY`

**Order Cancellation:**
- Canceled orders release inventory (increment `availableQuantity`)
- Reservation status changes to `RELEASED`

**Audit Requirements:**
- All quantity changes logged with reason code
- State transitions logged with quantity snapshot

---

## 3. Order State Machine (Purchase + Fulfillment)

Orders are created when a buyer commits to purchase.
Order state is driven by:
- Buyer actions (checkout)
- Payment platform events (webhooks)
- Seller fulfillment actions
- Delivery confirmation
- Refunds/disputes

### 3.1 Order States (Canonical)
- `created` - order created, awaiting payment intent completion
- `awaiting_payment` - payment initiated but not confirmed
- `paid` - payment confirmed (webhook)
- `canceled` - canceled prior to payment confirmation (or failed payment timeout)
- `awaiting_fulfillment` - paid, seller must ship/fulfill
- `fulfilled` - shipped/picked up completed, in transit or handoff done
- `delivered` - delivery confirmed (carrier or buyer confirmation)
- `completed` - post-delivery window passed with no issues OR buyer confirms
- `return_requested` - buyer requested return
- `return_approved` - seller/platform approved return
- `return_in_transit` - return shipped back
- `returned` - return received
- `refunded` - full refund completed
- `partial_refunded` - partial refund completed
- `disputed` - chargeback/dispute opened
- `closed` - terminal closed state (completed/refunded/dispute resolved)

> Note: `closed` may be a derived status; if you prefer, treat `completed/refunded` as terminal and skip `closed`.
> Keep it consistent.

### 3.2 Allowed Transitions (High-level)

**Checkout / Payment**
- `created -> awaiting_payment`
- `awaiting_payment -> paid` (webhook confirmed)
- `awaiting_payment -> cancelled` (payment failed/expired)
- `created -> cancelled` (buyer cancels before payment initiated)

**Fulfillment**
- `paid -> awaiting_fulfillment` (immediate or derived)
- `awaiting_fulfillment -> fulfilled` (seller ships / marks pickup ready)
- `fulfilled -> delivered` (carrier confirms or buyer confirms pickup)
- `delivered -> completed` (after time window or buyer confirms)

**Returns**
- `delivered -> return_requested` (within return window)
- `return_requested -> return_approved` (seller/platform)
- `return_approved -> return_in_transit` (buyer ships return)
- `return_in_transit -> returned` (seller receives)
- `returned -> refunded` OR `returned -> partial_refunded`

**Refunds**
- `paid/awaiting_fulfillment/fulfilled/delivered -> refunded` (admin/seller policy)
- `paid/... -> partial_refunded`

**Disputes**
- `paid/fulfilled/delivered/completed -> disputed` (chargeback opened)
- `disputed -> refunded` (lost) OR `disputed -> completed` (won) + adjustments
- `refunded/completed -> closed` (optional terminal)

### 3.3 Who can trigger transitions

**Buyer can:**
- create order (checkout)
- request cancellation before paid (policy choice)
- request return within return window
- confirm delivery/pickup (optional)
- open disputes externally (payment platform), reflected via webhook

**Seller (owner) can:**
- accept/cancel before paid only if policy allows
- fulfill (ship)
- approve/deny return (within policy)
- issue refunds (if permitted by policy; recommended: seller can initiate refunds up to amount available)

**Delegated staff can:**
Only with explicit permissions:
- `order.view`
- `order.fulfill`
- `order.message_buyer`
- `refunds.request` / `refunds.initiate`
- `returns.manage`

**Platform staff can:**
- override cancellations
- issue refunds
- force return decisions
- apply moderation locks
Always requires `reasonCode` + audit event.

### 3.4 Payment-driven rules (Hard Requirements)
- `paid` state can only be set via webhook-confirmed payment success.
- Refund states can only be set after webhook-confirmed refund creation/completion.
- `disputed` state is set via webhook dispute created.
- Transition application must be idempotent.

### 3.5 Fulfillment rules
- Shipment must include:
  - carrier
  - tracking number (unless local pickup)
  - shippedAt timestamp
- For local pickup:
  - pickup code / confirmation flow (recommended)
  - handoffAt timestamp

### 3.6 Completion window (Policy)
Define an order auto-completes after:
- X days from delivery (e.g., 3-7 days)
unless:
- return requested
- dispute opened
- moderation hold

---

## 4. Moderation & Locks (Cross-cutting)

Certain actions require "locks" to prevent state changes:
- `moderationHold` on listings/orders
- `paymentHold` if connected account not ready (policy)
- `fraudHold` if risk signals present

### Lock behavior
- If `moderationHold=true`, seller actions that change sellability/fulfillment are blocked
- Platform staff can override with reason

---

## 5. Required Audit & Timestamps

### 5.1 Audit (Required)
For every state transition:
- `actorUserId`
- `onBehalfOfUserId` if delegated
- `actionKey` (e.g. `listing.activate`, `order.fulfill`, `order.refund`)
- `resourceType`, `resourceId`
- `fromState`, `toState`
- `reasonCode` (required for platform overrides)

### 5.2 Required timestamps (Minimum)

**Listing**
- `createdAt`, `updatedAt`
- `activatedAt`
- `pausedAt`
- `endedAt`
- `soldAt`
- `archivedAt`

**Order**
- `createdAt`, `updatedAt`
- `paidAt`
- `fulfilledAt`
- `deliveredAt`
- `completedAt`
- return-related timestamps (requested/approved/received)
- refund timestamps (partial/full)

---

## 6. Idempotency Requirements (Commerce Side)

All state transitions must be safe under retries:
- If event already applied, no-op
- For webhook-driven transitions, key idempotency by provider event ID and ledgerKey strategy from the webhooks spec

---

## 7. Acceptance Checklist

### Listings
- [ ] A listing cannot be sold twice (inventory lock works).
- [ ] A listing cannot become `sold` unless payment is confirmed.
- [ ] Seller/staff can only transition states they have permission for.
- [ ] Search index reflects sellable states correctly.

### Orders
- [ ] `paid` only comes from webhooks.
- [ ] Refund/dispute states only come from webhooks.
- [ ] Seller fulfillment requires tracking/pickup confirmation.
- [ ] Auto-complete respects return/dispute/hold conditions.

### Auditing
- [ ] Every transition creates an audit record with actor + onBehalfOf + from/to + reasonCode when required.

---

## VERSION
- **v1.0 - Core commerce state machines baseline**
- Date locked: 2026-01-17
- **v1.1 - Spelling standardization (cancelled -> canceled)**
- Date updated: 2026-01-24
