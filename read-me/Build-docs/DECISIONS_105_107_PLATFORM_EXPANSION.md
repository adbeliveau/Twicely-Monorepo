# Decision Rationale — Entries #105–#107
**Append to:** `TWICELY_V3_DECISION_RATIONALE.md`
**Date:** 2026-03-06
**Session context:** Platform registry expansion, browser extension architecture

---

## 105. Platform Registry Expanded to 11 Channels

**Date:** 2026-03-06
**Status:** LOCKED
**Build phase:** Phase H (H2–H4)
**Schema impact:** A2.4 — `channelEnum` gains `WHATNOT`, `SHOPIFY`, `VESTIAIRE_COLLECTIVE`

### The Problem

The original 8-platform registry (eBay, Etsy, Mercari, Depop, Facebook Marketplace, Grailed, Poshmark, The RealReal) was defined before competitor analysis was complete. A review of Nifty's platform list revealed three platforms not yet in Twicely's registry: Whatnot, Shopify, and Vestiaire Collective.

### Decisions Per Platform

**Whatnot**
- Whatnot has a Seller API (currently in private beta, apply for access via [developers.whatnot.com](https://developers.whatnot.com)).
- Whatnot's primary value proposition is live-stream auctions, which Twicely has explicitly deferred (Decision #14: No Auctions).
- However, Whatnot also supports traditional Buy It Now (BIN) fixed-price listings, which are fully compatible with Twicely's data model.
- Decision: Add as **Tier A connector, crosslist BIN only**. No import (importing from a live/auction platform makes no sense). No live selling scope now or in Phase H.

**Shopify**
- Shopify is not a marketplace — it's a hosted storefront platform. The seller archetype (runs their own store) is distinct from pure resale sellers.
- Two directions are useful: importing Shopify inventory into Twicely (acquisition play — Shopify sellers are high-volume merchants); and crosslisting Twicely listings to a seller's Shopify store (distribution play).
- Neither direction requires the other. Forcing sellers into both creates unnecessary friction.
- Decision: Add as **Tier A connector. Seller chooses import-only, crosslist-only, or both at connect time.** Shopify has a full public OAuth Admin API — lowest integration risk of any new platform.

**Vestiaire Collective**
- EU-based luxury resale marketplace. No public API. Low US market share but high average order value.
- Fits the Tier C (browser extension) pattern. Low implementation risk given the extension infrastructure being built for Poshmark/FB/TRR anyway.
- Not a priority. Confirmed in registry, build last within Phase H.
- Decision: Add as **Tier C connector, browser extension. Import + crosslist. Low priority.**

### Final Registry

| Platform | Tier | Mechanism | Import | Crosslist |
|----------|------|-----------|--------|-----------|
| eBay | A | Official REST API | ✅ | ✅ |
| Etsy | A | Official REST API v3 | ✅ | ✅ |
| Whatnot | A | Seller API (private beta) | ❌ | ✅ BIN only |
| Shopify | A | Admin API + OAuth | ✅ opt | ✅ opt |
| Mercari | B | Reverse-engineered API | ✅ | ✅ |
| Depop | B | Reverse-engineered API | ✅ | ✅ |
| Grailed | B | Reverse-engineered API | ✅ | ✅ |
| Poshmark | C | Browser extension | ✅ | ✅ |
| Facebook Marketplace | C | Browser extension | ✅ | ✅ |
| The RealReal | C | Browser extension | ✅ | ✅ |
| Vestiaire Collective | C | Browser extension | ✅ | ✅ |

**Note on Tier C import vs crosslist:** F1/F2 HTTP connectors handle *import* for Poshmark, FB Marketplace, and The RealReal via session-based scraping. Outbound crosslisting (publish/update/delist) for all Tier C platforms goes through the browser extension built in Phase H1. These are not contradictory — import and crosslist use different mechanisms for the same platforms.

---

## 106. Browser Extension: Chrome + Edge + Firefox, Manifest V3, Thin Client

**Date:** 2026-03-06
**Status:** LOCKED
**Build phase:** H1
**Schema impact:** A2.4 — adds `extensionInstallation`, `extensionJob` tables + 3 new enums

### The Problem

Tier C platforms (Poshmark, Facebook Marketplace, The RealReal, Vestiaire Collective) have no public API. They actively block server-side automation. The only viable mechanism for programmatic listing management on these platforms is browser automation executing inside the user's own authenticated session — exactly the same mechanism Vendoo and other crosslisters use.

### Why a Browser Extension (Not a Desktop App)

Options considered:

| Approach | Pros | Cons |
|----------|------|------|
| Desktop Electron app | Full OS access, background execution | Massive install friction, cross-platform maintenance, security concerns |
| Browser extension (MV3) | Runs in browser where user is already logged in, low install friction, single codebase for Chrome/Edge | Must be installed; Firefox has lower market share |
| Headless browser on server | No user install required | Requires storing user credentials server-side (legal/security liability), platforms detect and ban datacenter IPs |

Browser extension wins on install friction and security. The headless browser approach is rejected outright — storing credentials server-side creates money-transmitter-adjacent liability and is how platforms detect and ban automated accounts.

### Browser Targets

| Browser | Engine | Market Share | Notes |
|---------|--------|-------------|-------|
| Chrome | Chromium + MV3 | ~65% | Primary target |
| Edge | Chromium + MV3 | ~13% | Same codebase, separate store submission |
| Firefox | Gecko + MV3 | ~4% | MV3 supported since v109; use `webextension-polyfill` |

Single codebase produces three build outputs via webpack/vite. `webextension-polyfill` abstracts `browser.*` vs `chrome.*` namespace differences.

### Architecture: Thin Client

The extension contains zero business logic. It is a remote execution environment.

```
BullMQ job created
  → extensionJob row inserted (PENDING)
  → Centrifugo pushes job payload to extension channel (extension:{sellerId}:{installationId})
  → Extension receives payload, ACKs (extensionJob → EXECUTING)
  → Extension executes DOM script on target platform tab
  → Extension POSTs result to /api/crosslister/extension/callback
  → extensionJob → COMPLETED or FAILED
  → crossJob updated accordingly
```

All business logic (what to publish, when, retry rules, fee calculations) lives server-side. The extension only knows how to translate a job payload into DOM interactions for a specific platform.

### Job Delivery

Extension maintains a persistent Centrifugo subscription on `extension:{sellerId}:{installationId}`. If the browser is closed, jobs queue as `PENDING` and are dispatched when the extension reconnects. Jobs expire at `deadlineAt` (default: 5 minutes from creation) if not completed — this prevents stale jobs from executing out of context.

### Heartbeat

Extension pings `/api/crosslister/extension/heartbeat` every 5 minutes. If no heartbeat for 30 minutes, `extensionInstallation.isActive` flips to false. The crosslister UI surfaces a "Your extension is disconnected" warning for affected Tier C platform operations.

### Security

- Extension has no access to Twicely session cookies (different origin). It authenticates to the callback API using a short-lived signed token issued at registration.
- Extension only operates on tabs matching platform domains (declared in `host_permissions`).
- `sessionData` on `crosslisterAccount` for Tier C platforms stores only the platform's own session state, encrypted at rest. Twicely never stores platform passwords.

### Build Placement

Phase H1 — first step of Phase H. All Tier C connector work in H4 depends on the extension being built first.

---

## 107. Shopify Connector Scope is Seller-Configurable

**Date:** 2026-03-06
**Status:** LOCKED
**Build phase:** H3
**Applies to:** `SHOPIFY` channel only

### The Problem

Shopify is architecturally different from every other platform in Twicely's registry. Other platforms are marketplaces — sellers list there to find buyers Twicely doesn't have. Shopify is a storefront host — sellers use it to run their own branded store, often for a different customer segment than resale marketplaces.

This creates two distinct use cases with different seller motivations:

**Import only:** A seller running a Shopify store wants to centralise their inventory into Twicely's crosslister for management. They do not want Twicely pushing listings back to Shopify (it's already there). They want: Shopify → Twicely.

**Crosslist only:** A seller building inventory on Twicely wants to push high-performing listings to their own Shopify store for additional distribution. They do not want to import from Shopify (they built this inventory on Twicely). They want: Twicely → Shopify.

**Both:** A seller who genuinely wants bidirectional sync. Less common but valid.

### Decision

At Shopify connect time, seller selects scope:
- Import from Shopify → Twicely
- Crosslist from Twicely → Shopify
- Both (bidirectional)

This is surfaced as a toggle/checkbox in the "Connect Shopify Store" onboarding flow. The underlying `crosslisterAccount.capabilities` JSON records `{ canImport: true/false, canPublish: true/false }` based on selection.

Neither direction requires the other. Twicely does not force a seller who wants import-only to also crosslist back. This is the correct UX — respecting that Shopify sellers have an existing business with intentional channel strategy.

### Why Not Force Both

The Poshmark, Mercari, Grailed model (all import + crosslist) works because those are pure marketplaces with identical seller intent. A seller on Poshmark and Mercari selling the same items has no reason to treat them asymmetrically.

Shopify sellers do have asymmetric intent. Forcing both directions would confuse the seller and risk unintended listing duplication on their Shopify store.

### Scope at Connector Level

The `ConnectorCapabilities` for Shopify dynamically reflects the seller's selection:
```typescript
{
  canImport:  true | false,  // Set at connect time
  canPublish: true | false,  // Set at connect time
  hasWebhooks: true,         // Shopify supports webhooks — always enabled
  ...
}
```

Capabilities can be updated post-connect from the crosslister account settings page.
