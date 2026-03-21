# Twicely — Canonical Hub Enforcement Rules

**Version:** v1.0 | **Date:** 2026-02-24 | **Status:** LOCKED
**Owner:** Adrian | **Approved:** 2026-02-24
**Supplements:** Lister Canonical (insert as §6A, between §6 Import Pipeline and §7 Crosslisting)
**Also updates:** Feature Lock-in §24 (Listing Creation), Build Sequence Tracker (add enforcement checks to F3/F5)

---

## 0. PURPOSE

This document codifies the **one rule that makes the entire Twicely business model work:**

> **If a listing is live anywhere, it is live on Twicely.**

Without this rule, sellers use Twicely as a cheap crosslisting tool, push inventory to eBay/Poshmark/Mercari, and keep Twicely's marketplace empty. The canonical hub model collapses. Twicely earns zero Transaction Fees. The flywheel dies.

This was implied by "Twicely canonical always wins" (Lister Canonical §30) but never stated as explicit, enforceable business rules with defined system behaviors. This document fixes that.

---

## 1. THE FOUR RULES

### Rule 1: Sellers May Create Draft Listings

Sellers can create and hold DRAFT listings on Twicely indefinitely. Drafts auto-save every 30 seconds (per Feature Lock-in §24). A draft is a work-in-progress — incomplete photos, missing fields, unfinished descriptions. This is normal and expected.

**System behavior:** No restrictions on creating, editing, or holding drafts.

---

### Rule 2: Only ACTIVE Twicely Listings Can Be Distributed

A listing must be **ACTIVE on Twicely** before it can be crosslisted to any external platform. DRAFT, PAUSED, ENDED, and SOLD listings cannot be published externally.

**System behavior:**

| Twicely Listing Status | Can Crosslist? | Publish Button State |
|------------------------|---------------|---------------------|
| DRAFT | ❌ NO | Disabled — tooltip: "Publish on Twicely first to crosslist" |
| ACTIVE | ✅ YES | Enabled |
| PAUSED | ❌ NO | Disabled — tooltip: "Reactivate on Twicely first" |
| ENDED | ❌ NO | Hidden |
| SOLD | ❌ NO | Hidden |

**Enforcement points:**

1. **UI gate:** Crosslist/publish buttons disabled for non-ACTIVE listings. Tooltip explains why.
2. **API gate:** `POST /api/lister/publish` rejects with `400 LISTING_NOT_ACTIVE` if `listing.status !== 'ACTIVE'`.
3. **Scheduler gate:** Scheduler skips any queued PUBLISH job where the canonical listing is no longer ACTIVE. Job status → CANCELLED with reason `CANONICAL_NOT_ACTIVE`.
4. **Automation gate:** Auto-relist and other automation features only operate on ACTIVE Twicely listings.

**Import exception:** Imported listings skip DRAFT and go straight to ACTIVE (per Lister Canonical §6.1). This rule is unchanged — imports always create ACTIVE listings.

---

### Rule 3: Cannot Deactivate on Twicely While Live Externally

A seller **cannot** end, pause, or delete a Twicely listing that has ACTIVE projections on any external platform. The seller must delist from all external platforms first, then deactivate on Twicely.

**System behavior:**

When a seller attempts to end/pause a listing that has active external projections:

| Seller Action | Active External Projections? | Result |
|---------------|------------------------------|--------|
| End listing | None | ✅ Allowed — listing ends immediately |
| End listing | 1+ ACTIVE projections | ⚠️ Blocked — see flow below |
| Pause listing | None | ✅ Allowed — listing pauses immediately |
| Pause listing | 1+ ACTIVE projections | ⚠️ Blocked — see flow below |
| Delete draft | N/A (drafts have no projections) | ✅ Allowed |

**Blocked action flow:**

```
Seller clicks "End Listing" or "Pause Listing"
        │
        ▼
System checks: SELECT FROM channel_projection
  WHERE listing_id = ? AND status = 'ACTIVE'
        │
        ├── 0 results → proceed with end/pause
        │
        └── 1+ results → show modal:
            ┌────────────────────────────────────────────────┐
            │  This listing is live on 3 platforms:          │
            │                                                │
            │  ✅ eBay — Active                              │
            │  ✅ Poshmark — Active                          │
            │  ✅ Mercari — Active                           │
            │                                                │
            │  To end this listing, delist from all          │
            │  external platforms first.                     │
            │                                                │
            │  [Delist All & End]    [Cancel]                │
            └────────────────────────────────────────────────┘
```

**"Delist All & End" button behavior:**

1. Creates DELIST jobs (not EMERGENCY_DELIST — this is seller-initiated, not a sale) for every ACTIVE projection.
2. Sets listing status to `ENDING` (transitional state — visible to seller as "Ending...").
3. As each delist confirms, projection status → DELISTED.
4. When ALL projections are DELISTED or ENDED → listing status transitions to ENDED (or PAUSED if that was the original intent).
5. If any delist fails after 3 retries → listing stays ACTIVE, seller notified: "Could not delist from [platform]. Please try again or delist manually on [platform]."

**API enforcement:**

- `POST /api/listings/{id}/end` returns `409 ACTIVE_EXTERNAL_PROJECTIONS` with list of platforms.
- `POST /api/listings/{id}/pause` returns `409 ACTIVE_EXTERNAL_PROJECTIONS` with list of platforms.
- `POST /api/listings/{id}/delist-all-and-end` triggers the cascade flow above.
- `POST /api/listings/{id}/delist-all-and-pause` triggers the cascade flow above.

---

### Rule 4: No External-Only Listings

A listing **cannot** exist as ACTIVE on any external platform without also being ACTIVE on Twicely. If the Twicely canonical listing is not ACTIVE, no projection of that listing should be ACTIVE anywhere.

**This rule prevents:**
- Sellers publishing to eBay/Poshmark but keeping Twicely as DRAFT (using Twicely as a free crosslister backend)
- Race conditions where Twicely listing ends but external delists haven't completed yet
- Manual external relisting after Twicely deactivation

**System behavior:**

1. **Publish gate (Rule 2):** Prevents creation of external-only listings at the source.
2. **Sync verification:** During periodic polling/verification, if a projection is ACTIVE but the canonical listing is not ACTIVE → auto-create DELIST job for that projection.
3. **Status change cascade:** When a Twicely listing transitions OUT of ACTIVE (to ENDED, PAUSED, or SOLD), the system immediately queues DELIST jobs for all ACTIVE projections (same as Rule 3 enforcement, but triggered automatically on status change rather than blocked).

**Reconciliation cron (safety net):**

```
Job: canonical-hub-reconciliation
Schedule: Every 6 hours
Queue: lister:verification

Logic:
  SELECT cp.id, cp.channel, cp.listing_id
  FROM channel_projection cp
  JOIN listing l ON l.id = cp.listing_id
  WHERE cp.status = 'ACTIVE'
  AND l.status NOT IN ('ACTIVE')

  For each orphaned projection:
    → Create DELIST job (priority: HIGH, not EMERGENCY)
    → Log to audit: ORPHANED_PROJECTION_DETECTED
    → Alert seller: "Your [item] was delisted from [platform] because it is no longer active on Twicely."
```

---

## 2. SALE-TRIGGERED TRANSITIONS (Clarification)

When a sale happens (on Twicely or any external platform), the listing status flow is:

**Sale on Twicely:**
1. Order created → listing.status = SOLD
2. EMERGENCY_DELIST jobs created for all ACTIVE external projections (per Lister Canonical §12)
3. External projections transition to DELISTED as delists confirm

**Sale on external platform (detected via webhook/polling):**
1. Sale detected → listing.status = SOLD, listing.soldOnChannel = [platform]
2. EMERGENCY_DELIST jobs created for all OTHER ACTIVE external projections
3. Twicely listing is already marked SOLD — no Twicely delist needed (it was the canonical)

In both cases, the canonical hub rules are maintained: the Twicely listing reflects the true state, and no orphaned active projections remain.

---

## 3. VACATION MODE INTERACTION

When a seller activates vacation mode (Feature Lock-in §16, Build Sequence Tracker G3.7):

1. All Twicely listings → PAUSED
2. Rule 3 triggers: DELIST jobs created for all ACTIVE external projections
3. External listings delist as jobs complete
4. When vacation ends: Twicely listings → ACTIVE, seller can re-crosslist

Vacation mode respects the canonical hub — no external listings stay live while Twicely is paused.

---

## 4. BULK OPERATIONS

Bulk end/pause from the seller dashboard (`/my/selling/listings` batch actions) follows the same rules:

- System checks all selected listings for active external projections
- If ANY selected listing has active projections → show summary modal:
  - "X listings can be ended immediately"
  - "Y listings need to be delisted from external platforms first"
  - [End X Now & Delist Y] [Cancel]
- Delist jobs are batched through the scheduler at MEDIUM priority (not EMERGENCY — this is seller-initiated, not a sale)

---

## 5. LISTING STATUS TRANSITIONS (Complete Reference)

```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ Publish on Twicely
                         ▼
              ┌────────────────────┐
         ┌────│     ACTIVE         │────┐
         │    │  (live on Twicely) │    │
         │    └──────┬──────┬──────┘    │
         │           │      │           │
         │     Sale  │      │ Seller    │ Seller
         │  (any ch) │      │ pauses    │ ends
         │           │      │           │
         │           ▼      ▼           ▼
         │    ┌──────┐  ┌────────┐  ┌────────────┐
         │    │ SOLD │  │ PAUSED │  │  ENDING    │
         │    └──────┘  └───┬────┘  │ (delist    │
         │                  │       │  cascade)  │
         │            Resume│       └─────┬──────┘
         │                  │             │ All delists
         │                  ▼             │ confirmed
         │           ┌──────────┐         │
         └───────────│  ACTIVE  │         │
                     └──────────┘         ▼
                                    ┌──────────┐
                                    │  ENDED   │
                                    └──────────┘

  Notes:
  - DRAFT → ACTIVE: only when listing meets minimum requirements
                     (1+ photo, title, price, category, condition)
  - ACTIVE → PAUSED/ENDED: only when zero ACTIVE external projections
                            OR seller triggers "Delist All" cascade
  - ACTIVE → SOLD: triggered by sale on any channel
  - SOLD: terminal — triggers EMERGENCY_DELIST on all platforms
  - ENDING: transitional — waiting for external delists to confirm
  - PAUSED → ACTIVE: immediate, no external dependencies
```

---

## 6. UI COPY

### Crosslist Button (Disabled States)

| State | Button | Tooltip |
|-------|--------|---------|
| DRAFT | "Crosslist" (disabled, gray) | "Publish this listing on Twicely first to crosslist to other platforms." |
| PAUSED | "Crosslist" (disabled, gray) | "Reactivate this listing on Twicely to crosslist." |
| ACTIVE, no platforms connected | "Crosslist" (enabled) → connect flow | "Connect a platform to start crosslisting." |
| ACTIVE, platforms connected | "Crosslist" (enabled, purple) | "Publish to connected platforms." |

### End/Pause Listing (With Active Projections)

Modal title: **"This listing is live on other platforms"**
Modal body: "To [end/pause] this listing, it needs to be removed from [platform list] first. We can do this automatically."
Primary CTA: **"Delist All & [End/Pause]"**
Secondary CTA: "Cancel"
Loading state: "Delisting from [platform]..." with per-platform progress indicators.

### Notification: Orphaned Projection Cleaned Up

Subject: "Listing removed from [platform]"
Body: "Your listing '[title]' was removed from [platform] because it is no longer active on Twicely. All listings must be active on Twicely to remain live on other platforms."

---

## 7. PLATFORM SETTINGS

```
hub.canonical.requireActiveForCrossList:       true     # Rule 2 — cannot crosslist non-ACTIVE
hub.canonical.blockDeactivateWithProjections:  true     # Rule 3 — cannot end/pause with active projections
hub.canonical.reconciliationIntervalHours:     6        # Rule 4 — orphan detection frequency
hub.canonical.delistCascadeMaxWaitMinutes:     30       # Max time to wait for delist cascade before alerting
hub.canonical.orphanDelistPriority:            'HIGH'   # Priority for orphaned projection delist jobs
```

All settings admin-configurable via `hub.twicely.co/cfg/commerce`. Zero hardcoded values.

---

## 8. ENFORCEMENT IN EXISTING DOCS

This addendum requires the following updates to existing canonical documents:

### Lister Canonical §30 (Forbidden Patterns) — ADD:

```
❌ Crosslisting DRAFT, PAUSED, ENDED, or SOLD listings (only ACTIVE can be crosslisted)
❌ Ending/pausing a Twicely listing while it has ACTIVE external projections (delist externally first)
❌ External-only listings (every ACTIVE projection requires an ACTIVE canonical listing)
```

### Feature Lock-in §24 (Listing Creation) — ADD to Listing States:

```
ENDING: Transitional state. Listing is being delisted from external platforms before
        ending on Twicely. Visible to seller as "Ending..." with platform delist progress.
        Not searchable. Not purchasable. Auto-resolves to ENDED when all delists confirm.
```

### Build Sequence Tracker — ADD enforcement checks:

```
F3.2 | Canonical hub enforcement (Rules 1-4) | ⬜ | F3 | Publish gate, deactivation block, delist cascade, reconciliation cron.
```

### Schema — ADD ENDING to listing status enum:

```typescript
// Add 'ENDING' to listing status enum if not already present
export const listingStatusEnum = pgEnum('listing_status', [
  'DRAFT', 'ACTIVE', 'PAUSED', 'ENDING', 'ENDED', 'SOLD', 'REMOVED'
]);
```

---

## 9. WHY THIS MATTERS (Business Context)

**Without these rules:** A seller signs up, imports 500 eBay listings (free), crosslists to Poshmark and Mercari (Lite tier at $13.99/mo), then pauses all Twicely listings. Twicely's marketplace has zero inventory from this seller. Twicely earns $13.99/mo in subscription revenue but $0 in Transaction Fees. The marketplace stays empty. Buyers leave. The flywheel never spins.

**With these rules:** The same seller imports 500 listings. They go ACTIVE on Twicely automatically. Seller crosslists to Poshmark and Mercari. All 500 listings are now live on three platforms including Twicely. Buyers on Twicely can discover and purchase these items. Twicely earns Transaction Fees on every sale. If the seller wants to end listings on Twicely, they must also remove them from external platforms — no free ride.

**The canonical hub model only works if the hub is always populated.** These four rules guarantee it.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-24 | Initial lock. Four canonical hub enforcement rules, delist cascade flow, vacation mode interaction, bulk operations, ENDING transitional state, reconciliation cron, platform settings, UI copy. |

---

**This document is the single source of truth for canonical hub enforcement rules.**
**If a listing is live anywhere, it is live on Twicely. No exceptions.**
