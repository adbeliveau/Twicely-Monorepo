# TWICELY V3 — Twicely.Local Canonical

**Version:** v1.0 | **Date:** 2026-02-17 | **Status:** LOCKED

---

## 1. CONCEPT

Local pickup and meetup transactions with buyer protection via QR escrow. Seller lists item as SHIP_AND_LOCAL or LOCAL_ONLY. Buyer pays via Stripe at checkout → funds held in escrow → released when buyer scans QR code at meetup confirming receipt.

---

## 2. FULFILLMENT TYPES

| Type | Shipping | Local Pickup |
|------|----------|-------------|
| `SHIP_ONLY` (default) | ✅ | ❌ |
| `LOCAL_ONLY` | ❌ | ✅ |
| `SHIP_AND_LOCAL` | ✅ | ✅ (buyer chooses at checkout) |

Seller configures per-listing or via default in seller settings.

---

## 3. SELLER CONFIGURATION

- `maxMeetupDistanceMiles` (default: 25) — how far seller drives
- Pickup address or Safe Meetup Location selection
- UI at `/my/selling/settings/local`
- Buyer search: "Local Pickup" filter + radius slider (5–50 miles)
- Listing badge: "📍 Local Pickup" with distance from buyer

---

## 4. MEETUP FLOW

```
1. Buyer selects Local Pickup → pays item + 5% local fee + Stripe processing
2. System generates:
   - confirmationCode (UUID → QR code)
   - offlineCode (6-digit numeric fallback)
3. Buyer + seller coordinate time via in-app messaging
4. Both arrive at location
5. Optional: both check in (enables safety features)
6. Buyer inspects item → scans seller's QR OR enters 6-digit code
7. Confirmation modal: "Confirm you received [Item Name]?" → buyer taps Confirm
8. Escrow releases → seller paid → order marked COMPLETED
```

---

## 5. QR ESCROW RELEASE

| Method | Flow | When |
|--------|------|------|
| QR Scan | Seller shows QR → buyer scans → confirm modal | Default |
| Manual Code | Seller reads 6-digit code → buyer enters | No camera / preference |
| Offline | Buyer enters code → stored locally → syncs when connectivity returns | No signal |

- Confirmation codes are **single-use**. Invalidated immediately after use.
- Offline grace period: 2 hours. If device doesn't sync within 2 hours, buyer gets push notification to confirm online.
- Each code expires after 48 hours from scheduled meetup time.

---

## 6. SAFE MEETUP LOCATIONS

Platform-curated verified safe meetup spots.

**Types:** Police stations, retail stores (malls), community centers, custom (staff-verified).

**Features:**
- Suggested during meetup scheduling
- Listing shows "🏛️ Safe Meetup Spot Nearby" if within radius
- Staff manages at `/cfg/safe-spots` in hub admin
- Community can suggest → staff reviews and approves
- Operating hours stored for "is this spot open?" checks

**Data:** `safeMeetupLocation` table with geo coordinates, type, verification status, operating hours, meetup count, rating.

---

## 7. NO-SHOW PENALTIES

| Event | Penalty |
|-------|---------|
| One party checks in, other doesn't within 30 min | $5 fee charged to no-show party, paid to other |
| 3 no-shows in 90 days | Local transactions suspended for 90 days |
| Both don't show | Order auto-canceled, no penalty |

Platform settings:
```
commerce.local.noShowFeeCents: 500
commerce.local.noShowStrikeLimit: 3
commerce.local.noShowSuspensionDays: 90
commerce.local.meetupAutoCancelMinutes: 30
```

---

## 8. PAYMENT OPTIONS

| Method | Fee | Buyer Protection | Tracking |
|--------|-----|-----------------|---------|
| In-app (Stripe) | 5% + processing | Full | Full |
| Cash | 0% | None | Manual |
| Off-platform (Venmo/Zelle) | 0% | None | Manual |

Cash/off-platform transactions still tracked for seller analytics and Financial Center. Seller manually marks complete. Clear disclosure: "Cash payments not covered by Twicely Buyer Protection."

---

## 9. SAFETY FEATURES

| Feature | Trigger | Action |
|---------|---------|--------|
| Safety timer | Check-in but no confirmation within 30 min | Push notification to both: "Is everything OK?" |
| Emergency alert | Safety timer not dismissed within 15 min | Support case auto-created |
| Location sharing | Opt-in during active meetup | Approximate location visible to other party |
| Auto-cancel | 48 hours past scheduled time, no confirmation | Order auto-canceled + investigation flagged |

---

## 10. LOCAL BUYER PROTECTION CLAIMS

- Claim window: 7 days from QR confirmation
- Valid reasons: INAD (item doesn't match listing), DAMAGED (item was damaged before pickup)
- NOT valid: buyer remorse on local (you inspected it in person)
- Evidence required: photos showing discrepancy vs listing
- If no QR confirmation happened (cash deal): no claim possible

---

## 11. MESSAGING INTEGRATION

Meetup coordination happens via standard buyer-seller messaging with enhanced features:
- Quick-reply templates: "On my way", "I'm here", "Running 15 min late", "Need to reschedule"
- Location sharing button (opt-in)
- Auto-message when both check in: "Both parties checked in at [Location]"
- Auto-message on no-show: "[Party] didn't arrive. Order will be canceled in 30 minutes."

---

## 12. PLATFORM SETTINGS

```
commerce.local.transactionFeePercent: 5.0
commerce.local.defaultRadiusMiles: 25
commerce.local.maxRadiusMiles: 50
commerce.local.noShowFeeCents: 500
commerce.local.noShowStrikeLimit: 3
commerce.local.noShowSuspensionDays: 90
commerce.local.meetupAutoCancelMinutes: 30
commerce.local.offlineGraceHours: 2
commerce.local.confirmationCodeExpiryHours: 48
commerce.local.claimWindowDays: 7
```

---

## 13. PHASE

- Design: D1
- Build: G2 (requires messaging E2 + buyer protection C5)
- Dependencies: E2 (messaging), C5 (buyer protection), C3 (Stripe Connect for payouts)
