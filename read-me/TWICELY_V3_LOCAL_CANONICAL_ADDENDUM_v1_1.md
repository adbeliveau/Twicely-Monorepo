# TWICELY V3 — Twicely.Local Canonical Addendum v1.2

**Version:** v1.2
**Date:** 2026-03-10
**Status:** LOCKED
**Applies to:** TWICELY_V3_LOCAL_CANONICAL.md v1.0
**Purpose:** Lock in all new features, policies, and decisions for Twicely.Local decided in the March 2026 architecture session. Apply all sections here on top of the base canonical. Where conflict exists, this addendum wins.

---

## A0. SafeTrade — Complete Payment Model

**See Decision #81**
**Supersedes:** Local Canonical §8 (Payment Options), Decision #42 (Local Transaction Fee Model)

### The Name

Feature is called **SafeTrade**. Never "escrow" in UI or legal copy. SafeTrade is a Twicely brand — legally it is a "payment processing and platform protection fee." Get legal confirmation before launch.

### What SafeTrade Is

A mutual commitment mechanism. Not primarily buyer protection — a **serious buyer signal to the seller**. Both parties pay a SafeTrade Fee the moment it activates. Neither can ghost for free.

### Three Seller States

| State | Badge | Checkout |
|-------|-------|----------|
| **SafeTrade Required** | `📍 Local · SafeTrade Required` | Mandatory — no cash option |
| **SafeTrade Available** (default) | `📍 Local · SafeTrade Available` | Buyer chooses SafeTrade or Cash |
| **Cash Only** | `📍 Local · Cash Only` | No SafeTrade shown |

### SafeTrade Fee

`(itemPriceCents × 0.029) + 30` cents — exactly Stripe's processing cost.

Both parties pay at escrow creation regardless of who requested it:
- Seller's card on file: charged immediately
- Buyer's card: bundled into auth hold (`item price + SafeTrade Fee`)

### Auth Hold — Not a Charge

SafeTrade Fee is bundled into buyer's auth hold. Never a separate charge. Prevents double Stripe billing.

```
Buyer's auth hold:   $206.10  ($200 item + $6.10 SafeTrade)
Seller's card:         $6.10  charged immediately
```

### Three Scenarios

**S1 — Seller Requires SafeTrade**
Both pay at creation. At settlement: seller's fee credited back, TF deducted. If buyer renigs: buyer forfeits their SafeTrade Fee, seller refunded. If seller renigs: seller forfeits their SafeTrade Fee, buyer's full auth hold released.

**S2 — Buyer Requests SafeTrade**
Identical mechanics to S1. Both still pay. "Who requested it" only determines initiation — both have skin in the game.

**S3 — Cash / Off-Platform**
No Stripe. No SafeTrade. No fees. Pure FBMP experience. Twicely makes $0.

### Fee Math — $200 Item, 9% TF

| Outcome | Stripe Cost | SafeTrade Collected | TF | Twicely Total |
|---------|-------------|--------------------|----|---------------|
| Sale completes | $6.76 | $12.20 | $18.00 | **+$23.44** |
| Buyer renigs | $0.96 | $6.10 | $0 | **+$5.14** |
| Seller renigs | $0.48 | $6.10 | $0 | **+$5.62** |
| No fault expiry | $0.48 | $0 | $0 | **-$0.48** |

No-fault expiry loss of $0.48 accepted (Option B). Revisit only if expiry rate exceeds 5% of SafeTrade transactions.

### TF Rate

**Same as shipped orders. Category-based feeBucket. No local discount.**
`commerce.local.transactionFeePercent` — **DEPRECATED. Remove from seed.**

Gaming vector eliminated — no financial incentive to fake local orders when TF is identical.

### What SafeTrade Unlocks

SafeTrade = full infrastructure suite. Cash = text and that's it.

| Feature | SafeTrade | Cash |
|---------|-----------|------|
| Meetup map | ✅ | ❌ |
| Time picker | ✅ | ❌ |
| Safe meetup spots | ✅ | ❌ |
| Check-in | ✅ | ❌ |
| Safety timer | ✅ | ❌ |
| No-show detection | ✅ | ❌ |
| Day-of confirmation | ✅ | ❌ |
| Reminders | ✅ | ❌ |
| QR + dual-token | ✅ | ❌ |
| Offline mode | ✅ | ❌ |
| Price adjustment | ✅ | ❌ |
| Photo evidence | ✅ | ❌ |
| Auto-reserve listing | ✅ | ❌ |
| Fraud detection | ✅ | ❌ |
| Buyer protection claims | ✅ | ❌ |
| Large item flags | ✅ | ❌ |
| Messaging | ✅ | ✅ |
| Financial Center log | ✅ | ✅ |
| Reliability tracking | ✅ | ✅ |

### Seller Requirement

Card on file required to enable SafeTrade (Required or Available). Prompt at listing creation if missing.

### Shippo Hard Block

```typescript
if (order.isLocalPickup) {
  throw new Error('Shipping labels cannot be purchased for local pickup orders')
}
```

Order integrity only — gaming prevention is handled by TF parity.

---

## A1. Fulfillment Architecture Clarification

Twicely.Local is a fulfillment option on a listing, not a separate product. See Decision #78.

`listing.fulfillmentType` is the sole entry point:
- `SHIP_ONLY` — local never activates
- `LOCAL_ONLY` — localTransaction always created at checkout
- `SHIP_AND_LOCAL` — localTransaction created only if buyer selects local at checkout

No tier gate. No separate signup. Available to all sellers with a saved address.

---

## A2. Meetup Map (Leaflet + OpenStreetMap)

**Builds in: G2.5**

The meetup detail screen displays a non-interactive Leaflet + OpenStreetMap map showing:

- Buyer pin — brand primary `#7C3AED`
- Seller pin — `#2563EB`
- Safe meetup spot pin — `#059669` (only if one exists within radius)
- Dashed polyline between buyer and seller
- Distance chip overlay (top-left): "X.X mi away"
- "Safe Spot Nearby" chip (top-right): green, only if verified location in radius

Map is non-interactive (no pan/zoom). "Get Directions" button opens `https://maps.google.com/?q={lat},{lng}` in native maps.

Mapbox geocoding adapter remains the geocoding provider (address → lat/lng at save time). Leaflet is the renderer only. No Mapbox GL JS anywhere in the project.

**Component:** `src/components/local/meetup-map.tsx`
Loaded via `dynamic(() => import('./meetup-map'), { ssr: false })` — Leaflet requires browser DOM.

---

## A3. Meetup Price Adjustment

**Builds in: G2.6**
**See Decision #74**

Seller can reduce the transaction price at the meetup (before showing QR) when a flaw is discovered in person.

### Rules

| Rule | Value |
|------|-------|
| Who initiates | Seller only |
| Max discount | 33% of original `amountCents` (reads from `commerce.local.maxAdjustmentPercent`) |
| Max per transaction | 1 adjustment |
| Fee recalculation | Twicely keeps TF on original amount. No fee reversal. |
| Old tokens on adjustment | Invalidated immediately |
| New tokens generated | Yes — full new token pair on buyer acceptance |
| Buyer action | Must explicitly accept before new tokens shown |
| Buyer decline | Original tokens stand, status returns to BOTH_CHECKED_IN |
| Ledger | `LOCAL_PRICE_ADJUSTMENT` — Stripe partial refund for delta only |

### New Status

`ADJUSTMENT_PENDING` added to `localTransactionStatusEnum`.

### State Machine Update

```
SCHEDULED → SELLER_CHECKED_IN → BOTH_CHECKED_IN → ADJUSTMENT_PENDING → RECEIPT_CONFIRMED → COMPLETED
                                                 ↘ (no adjustment)  ↗
```

### Schema Additions to `localTransaction`

```typescript
adjustedPriceCents:     integer
adjustmentReason:       text
adjustmentInitiatedAt:  timestamp
adjustmentAcceptedAt:   timestamp
adjustmentDeclinedAt:   timestamp
```

### New Platform Setting

`commerce.local.maxAdjustmentPercent: 33`

---

## A4. Dual-Token Ed25519 QR with Escrow-Time Preload

**Builds in: G2.7**
**See Decision #75**

### Token Architecture

Two Ed25519-signed tokens generated at escrow creation (internet guaranteed):

```typescript
sellerToken: signed { transactionId, amountCents, buyerId, sellerId, role: 'SELLER', expiresAt, nonce }
buyerToken:  signed { transactionId, amountCents, buyerId, sellerId, role: 'BUYER', expiresAt, nonce }
sellerOfflineCode: 6-digit numeric
buyerOfflineCode:  6-digit numeric
```

All four values pushed to both phones immediately after Stripe escrow confirmation. Stored to IndexedDB (not localStorage). Both phones are fully offline-ready before leaving for the meetup.

### Online Mode (default)

Buyer scans seller's QR → submits `{ sellerToken }` → server validates Ed25519 + nonce → escrow releases → Centrifugo pushes to both phones simultaneously.

### Offline Mode (opt-in)

Activated by: manual "No Internet Access" button, `navigator.onLine === false`, or submission timeout.

Both parties scan each other's QR or enter each other's 6-digit codes. Each phone verifies the other's token signature offline using the embedded public key. Either phone submits the combined payload `{ sellerToken, buyerToken }` when signal returns. First submission wins. Second is idempotent no-op.

### Seller Offline Confirmation

After successful dual scan in offline mode, seller's screen displays:
```
✅ TRANSACTION VERIFIED
{itemTitle} — ${amount} secured in escrow
Verified via cryptographic signature
ID: {transactionId}
⏳ Syncing when connected — payment releases automatically
```

This is cryptographically true — Ed25519 signature verified on-device using public key.

### Security Layers

| Attack | Prevention |
|--------|-----------|
| Forged QR | Ed25519 signature verification on-device |
| Tampered token | Any modification breaks signature |
| Replay | Nonce — server marks used on first submission |
| Expiry | `expiresAt` checked after signature passes |
| Wrong-party | `role` field — scanner rejects matching role |

### Schema Changes (replaces single token fields)

```typescript
sellerConfirmationCode:  text unique
sellerOfflineCode:       text
buyerConfirmationCode:   text unique
buyerOfflineCode:        text
confirmationMode:        'QR_ONLINE' | 'QR_DUAL_OFFLINE' | 'CODE_ONLINE' | 'CODE_DUAL_OFFLINE'
```

### Environment Variables

```
LOCAL_TX_SIGNING_KEY=               (Ed25519 private key — server only)
NEXT_PUBLIC_LOCAL_TX_VERIFY_KEY=    (Ed25519 public key — embedded in app)
```

### Centrifugo Channel

Both phones subscribe to `local-tx:{transactionId}` on meetup screen mount. Server publishes on: CONFIRMED, ADJUSTMENT_PENDING, ADJUSTMENT_ACCEPTED, ADJUSTMENT_DECLINED, CANCELED.

### New Platform Settings

```
commerce.local.offlineModeEnabled: true
commerce.local.preloadTokensOnEscrow: true
commerce.local.tokenExpiryHours: 48
```

---

## A5. Local Reliability System

**Builds in: G2.8**
**See Decision #77**
**Supersedes:** Local Canonical §7 (No-Show Penalties)

### No Monetary Penalties

All monetary penalties for meetup failures are removed. `commerce.local.noShowFeeCents` is deprecated. The Local Reliability Score replaces financial consequences with reputational ones.

### Local Reliability Score Display

Visible on meetup screen — both parties see each other's score:

```
✅ Reliable     — X local meetups, Y% completion
⚠️ Inconsistent — cancellations in last 90 days
🔴 Unreliable   — multiple no-shows, proceed with caution
```

### Reliability Marks

| Behavior | Marks |
|----------|-------|
| Cancel 24hr+ before | 0 |
| Cancel under 24hr | -1 |
| Cancel same day under 2hr | -2 |
| No-show | -3 |
| Seller dark on meetup day | -1 |
| Reschedule excess (3+ on same transaction) | -1 |

### Suspension

9 marks in 90 days → local transactions suspended for 90 days. Marks decay after 180 days. Suspension is access removal only — shipped transactions unaffected.

### Refund Policy

Full refund always, regardless of who cancelled or why. Buyer never loses money on a cancelled local transaction.

### New Platform Settings

```
commerce.local.suspensionMarkThreshold: 9
commerce.local.suspensionDays: 90
commerce.local.markDecayDays: 180
```

### Deprecated Platform Settings

```
commerce.local.noShowFeeCents        — REMOVED
commerce.local.noShowStrikeLimit     — REMOVED
```

---

## A6. Meetup Time Picker

**Builds in: G2.9**

After checkout, `localTransaction.scheduledAt` is null. Before check-in is allowed, a confirmed meetup time must exist in the system. This is the mechanism that sets it.

### How It Works

After the order is created with local pickup selected, both parties see a "Set Meetup Time" prompt on the order screen. Either party can propose a time. The other party accepts or proposes a different time.

### Flow

```
1. Checkout completes → localTransaction created, scheduledAt: null
2. Order screen shows "Schedule Your Meetup" prompt to both parties
3. Either party opens the time picker → selects date + time slot
4. Proposal sent as a structured in-app notification (not a free-form message):
   "Jordan proposed Thursday March 12 at 2:00 PM. Accept or suggest another time."
5. Other party accepts → scheduledAt set → BullMQ reminder jobs enqueued
   Other party proposes different time → counter-proposal sent → repeat
6. Once scheduledAt is set, check-in becomes available
```

### Rules

- Check-in button is locked until `scheduledAt` is confirmed by both parties
- Either party can propose. Either party can accept.
- No limit on proposals before acceptance — unlike reschedules (which have a 2-proposal limit), this is initial scheduling so back-and-forth is expected
- Time picker shows slots in 30-minute increments
- Minimum lead time: 1 hour from now (can't schedule a meetup in the past or immediately)
- Maximum lead time: 30 days
- Once `scheduledAt` is set, any change goes through the Reschedule Flow (A7), not back to the time picker

### What Gets Triggered on `scheduledAt` Confirmation

- BullMQ job: 24hr reminder (A10)
- BullMQ job: 1hr reminder (A10)
- BullMQ job: auto-cancel at `scheduledAt + 48hr` (existing G2 logic)
- BullMQ job: no-show check at `scheduledAt + 30min` (existing G2.3 logic)
- Day-of confirmation button activates when `now >= scheduledAt - 12hr` (A9)

### Schema Additions to `localTransaction`

```typescript
scheduledAtConfirmedAt:   timestamp   // when both parties agreed on the time
schedulingProposedBy:     text        // userId of who set the final accepted time
```

### New Notification Templates

- `local.schedule.proposal` — "X proposed {date} at {time}. Tap to accept or suggest another time."
- `local.schedule.accepted` — "Meetup confirmed for {date} at {time} at {location}."
- `local.schedule.reminder.setup` — "Don't forget to schedule your meetup for {item}." (fires 24hr after checkout if scheduledAt still null)

---

## A7. Reschedule Flow

**Builds in: G2.10**

Structured reschedule mechanism that updates `localTransaction.scheduledAt` and resets all time-based jobs.

### Rules

- Either party can propose a reschedule while status is SCHEDULED, SELLER_CHECKED_IN, or BUYER_CHECKED_IN
- Other party must accept or decline in-app
- On acceptance: `scheduledAt` updated, no-show detection job re-queued for new time, auto-cancel job re-queued for new time + 48 hours, safety timer reset
- Maximum 2 reschedules per transaction before reliability mark applies (3rd reschedule = -1 mark on initiating party)
- Reschedule not available once status is BOTH_CHECKED_IN or later

### Schema Additions to `localTransaction`

```typescript
rescheduleCount:         integer default 0
lastRescheduledAt:       timestamp
lastRescheduledBy:       text  // 'BUYER' | 'SELLER'
originalScheduledAt:     timestamp  // preserved from initial scheduling
```

### New Status

`RESCHEDULE_PENDING` added to `localTransactionStatusEnum`.

---

## A8. Pre-Meetup Cancellation Policy

**Builds in: G2.11**

Either party can cancel a scheduled local transaction before the meetup occurs. Full refund always.

### Cancellation Windows and Marks

| Window | Marks Applied |
|--------|--------------|
| 24hr+ before scheduled time | 0 marks |
| Under 24hr before | -1 mark on cancelling party |
| Same day, under 2hr | -2 marks on cancelling party |

### Cancellation Rules

- Available while status is SCHEDULED, SELLER_CHECKED_IN, BUYER_CHECKED_IN, or RESCHEDULE_PENDING
- NOT available once BOTH_CHECKED_IN — at that point both parties are physically present, use the adjustment flow or walk away without cancelling
- Full Stripe refund issued immediately on cancellation
- Reliability mark posted to cancelling party's `localReliabilityEvent`
- Both parties notified via push notification
- Listing returns to ACTIVE status on cancellation

### New Status

`CANCELED_BY_BUYER` and `CANCELED_BY_SELLER` as sub-states of CANCELED for reporting clarity.

---

## A9. Day-of Confirmation Request ("Are We Still On?")

**Builds in: G2.12**

Buyer can send a structured meetup confirmation request on the day of the scheduled meetup.

### Rules

- Button appears on order screen within 12 hours of `scheduledAt` only
- One confirmation request per transaction
- Seller receives in-app notification (not a message): "Buyer is confirming today's meetup at {time}. Confirm or reschedule."
- Seller has 2 hours to respond

### Outcomes

| Seller Response | Result |
|----------------|--------|
| Confirms | Both notified, meetup confirmed |
| Proposes reschedule | Reschedule flow triggers |
| No response within 2hr | -1 reliability mark on seller + escalation flag on transaction |

### Dark Seller Escalation

If seller doesn't respond to day-of confirmation AND doesn't check in at scheduled time → no-show marks apply immediately (no need to wait the full 30-minute check-in window). The pre-meetup non-response is already a signal.

---

## A10. Meetup Reminder Notifications

**Builds in: G2.13**

Automated reminders sent to both parties before the scheduled meetup.

| Trigger | Recipient | Message |
|---------|-----------|---------|
| 24 hours before `scheduledAt` | Both | "Your meetup for {item} is tomorrow at {time} at {location}" |
| 1 hour before `scheduledAt` | Both | "Your meetup for {item} is in 1 hour. {location}" |

Both reminders include deep link to the order meetup screen.

BullMQ delayed jobs enqueued when `scheduledAt` is set (and re-enqueued on reschedule).

New notification templates:
- `local.reminder.24hr`
- `local.reminder.1hr`

---

## A11. Listing Auto-Reserve on Escrow Creation

**Builds in: G2.14**

When a local transaction reaches SCHEDULED status (escrow captured), the listing is automatically marked `RESERVED`.

### Rules

- `listing.status` transitions `ACTIVE → RESERVED` on localTransaction creation
- RESERVED listings are not visible in search results or browse
- RESERVED listings are accessible via direct URL with "This item is reserved" banner
- On transaction COMPLETED → listing transitions to SOLD
- On transaction CANCELED → listing transitions back to ACTIVE automatically
- On transaction NO_SHOW + no re-schedule within 24hr → listing transitions back to ACTIVE

### Duplicate Listing Detection

When a local transaction is SCHEDULED, if the seller creates a new listing with photos that pHash-match the reserved listing:
- New listing flagged immediately
- Seller notified: "This item appears to already have a pending local transaction"
- Flag escalated for staff review if seller proceeds

### New `listing.status` Value

`RESERVED` added to `listingStatusEnum`.

---

## A12. Escrow Fraud Detection and Consequences

**Builds in: G2.15**
**See Decision #79 (fraud exception to no-penalty rule)**

Selling an item after escrow is captured is theft. Hard consequences apply regardless of the no-monetary-penalty philosophy — this is not a reliability failure, it's deliberate fraud.

### Detection Triggers

| Signal | Action |
|--------|--------|
| Seller manually marks a different order for the same listing as COMPLETED while localTransaction is SCHEDULED | Automatic fraud flag |
| pHash duplicate listing created while transaction is SCHEDULED (from A10) | Fraud investigation trigger |
| Seller no-show + listing immediately relisted within 24hr | Fraud investigation trigger |
| Buyer files fraud claim with evidence (screenshot of item sold elsewhere) | Manual review |

### Consequences

| Severity | What Happened | Consequence |
|----------|--------------|-------------|
| Confirmed fraud | Sold item after escrow, buyer no-showed | Full refund from escrow + local transaction permanent ban + account review for full suspension |
| Strong signal | Duplicate listing while SCHEDULED | Listing removed + formal warning + reliability marks |
| Pattern (2nd offense) | Second confirmed fraud | Full account suspension |

### Buyer Protection

Full refund from escrow always. Escrow funds have not moved to the seller — Stripe reverses cleanly. Buyer is made whole regardless of fraud investigation outcome.

### New Ledger Entry

`LOCAL_FRAUD_REVERSAL` — escrow reversed to buyer on confirmed fraud. Seller payout blocked.

---

## A13. At-Meetup Photo Evidence

**Builds in: G2.16**

Before confirming receipt (scanning QR or entering code), buyer is prompted to take condition photos of the item.

### Rules

- Prompt appears on buyer's confirmation screen: "Take photos before confirming receipt"
- Photo capture is **optional** — buyer can skip and confirm without photos
- If buyer takes photos: timestamped and stored to R2, linked to `localTransaction.meetupPhotoUrls`
- Photos are available to both parties and support staff in the transaction record
- If buyer skips photos and later files a claim → "No meetup photos captured" shown in claim UI (not a block, just context)

### Why Optional

Making it mandatory creates friction that discourages escrow use. Optional + educational is sufficient. Buyers who understand the protection will use it. Over time, community norms will encourage photo capture without platform enforcement.

### Schema Addition to `localTransaction`

```typescript
meetupPhotoUrls:     text[].default([])
meetupPhotosAt:      timestamp  // when photos were taken, null if skipped
```

---

## A14. Local Seller Metrics

**Builds in: G2.17**

Local-specific performance metrics displayed separately from shipped order ratings.

### What's Displayed

**On seller storefront:**
```
Local Meetups
✅ 47 completed · 96% completion rate
Usually responds same day
```

**On listing detail (LOCAL_ONLY or SHIP_AND_LOCAL):**
```
📍 Local Pickup
Jordan S. · 47 local meetups · 96% completion
```

**On meetup screen (both parties see each other):**
Full reliability score display (see A5).

### Metrics Tracked

| Metric | Definition |
|--------|-----------|
| `localTransactionCount` | Total local transactions attempted |
| `localCompletionRate` | Completed / attempted |
| `localNoShowCount` | Total no-shows (rolling 90 days) |
| `localAvgResponseTimeHours` | Average response to day-of confirmation requests |
| `localReliabilityTier` | RELIABLE / INCONSISTENT / UNRELIABLE (derived from marks) |

### Privacy

Reliability marks are private — only the tier display is public. Buyers see RELIABLE/INCONSISTENT/UNRELIABLE, not the raw mark count or specific events.

---

## A15. Large Item Handling Flags

**Builds in: G2.18**

Seller can flag listings that require special handling at pickup.

### Flags (multi-select)

```
☐ Buyer must bring own transport (won't fit in standard car)
☐ Loading help required (heavy/bulky — bring someone)
☐ Disassembly required before transport
☐ Special equipment needed (dolly, straps, etc.)
```

### Display

- Listing detail shows selected flags prominently near "Local Pickup Available"
- Checkout local pickup selection shows flags with warning: "Before selecting local pickup, note: {flags}"
- Buyer must acknowledge flags at checkout (checkbox: "I understand the pickup requirements")

### Schema Addition to `listing`

```typescript
localHandlingFlags: text[].default([])
// 'NEEDS_VEHICLE' | 'NEEDS_HELP' | 'NEEDS_DISASSEMBLY' | 'NEEDS_EQUIPMENT'
```

---

## A16. Monetization Clarification

**See Decision #79**

Cash local transactions are tracked in the seller's Financial Center but Twicely does not charge any fee on them. The 5% local fee applies to in-app Stripe escrow payments only.

Financial Center cash sale display includes conversion nudge:
```
Cash sale — ${amount}
⚠️ Not covered by Twicely Buyer Protection
Tip: Use in-app payment next time to protect both parties
```

No penalty, no enforcement, no gate on cash transactions.

---

## Updated Platform Settings (Complete Local Set)

```
# Transaction
commerce.local.transactionFeePercent: 5.0
commerce.local.defaultRadiusMiles: 25
commerce.local.maxRadiusMiles: 50

# Escrow / Tokens
commerce.local.preloadTokensOnEscrow: true
commerce.local.offlineModeEnabled: true
commerce.local.tokenExpiryHours: 48
commerce.local.confirmationCodeExpiryHours: 48  // legacy — superseded by tokenExpiryHours

# Reliability (replaces noshow fee settings)
commerce.local.suspensionMarkThreshold: 9
commerce.local.suspensionDays: 90
commerce.local.markDecayDays: 180

# Safety
commerce.local.safetyNudgeMinutes: 30
commerce.local.safetyEscalationMinutes: 15
commerce.local.meetupAutoCancelMinutes: 30
commerce.local.offlineGraceHours: 2
commerce.local.claimWindowDays: 7

# Scheduling
commerce.local.dayOfConfirmationWindowHours: 12
commerce.local.dayOfConfirmationResponseHours: 2
commerce.local.rescheduleMaxCount: 2

# Price Adjustment
commerce.local.maxAdjustmentPercent: 33

# DEPRECATED — remove from seed
# commerce.local.noShowFeeCents         REMOVED
# commerce.local.noShowStrikeLimit      REMOVED
```

---

## Updated Build Sequence (G2 Sub-Steps)

| Step | Feature | Depends On |
|------|---------|-----------|
| G2 ✅ | Core local transaction flow | E2, C5 |
| G2.1 ✅ | QR escrow + offline fallback | G2 |
| G2.2 ✅ | Safe meetup UI | G2 |
| G2.3 ✅ | No-show detection (updated in G2.8) | G2.1 |
| G2.4 ✅ | Safety timer + emergency | G2.1 |
| G2.5 ⬜ | Meetup map (Leaflet + OSM) | G2 |
| G2.6 ⬜ | Meetup price adjustment | G2.5 |
| G2.7 ⬜ | Dual-token Ed25519 + offline mode | G2.6 |
| G2.8 ⬜ | Reliability system (replaces noshow fees) | G2.7 |
| G2.9 ⬜ | Meetup time picker (sets scheduledAt) | G2.8 |
| G2.10 ⬜ | Reschedule flow | G2.9 |
| G2.11 ⬜ | Pre-meetup cancellation flow | G2.8 |
| G2.12 ⬜ | Day-of confirmation request | G2.10 |
| G2.13 ⬜ | Meetup reminder notifications | G2.9 |
| G2.14 ⬜ | Listing auto-reserve on escrow | G2.7 |
| G2.15 ⬜ | Escrow fraud detection | G2.14 |
| G2.16 ⬜ | At-meetup photo evidence | G2.7 |
| G2.17 ⬜ | Local seller metrics | G2.8 |
| G2.18 ⬜ | Large item handling flags | G2 |
