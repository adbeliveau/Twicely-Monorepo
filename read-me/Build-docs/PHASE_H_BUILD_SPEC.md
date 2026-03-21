# Phase H — Platform Expansion & Browser Extension
**Status:** SPECCED — build after Phase G (production launch)
**Date:** 2026-03-06
**Decision references:** #105, #106, #107
**Schema addendum:** A2.4

---

## What Phase H Is

Phase H is the post-launch platform expansion phase. It is deliberately separated from the G1–G10 production launch sequence. The reasoning:

1. **Whatnot requires API access approval.** Their Seller API is private beta — Twicely must apply and be accepted before build can begin. This is a dependency outside our control. Phase G cannot block on it.
2. **The browser extension is a separate product artifact.** It has its own store submission review process (Chrome Web Store, Edge Add-ons, Firefox AMO). Review times are 1–7 days per browser. Building it during Phase G would introduce external review timelines into the launch critical path.
3. **Vestiaire Collective is low priority.** Delaying launch for an EU luxury niche platform with no API makes no sense.
4. **Shopify sellers are a distinct acquisition motion.** Onboarding Shopify sellers requires marketing support that is better prepared post-launch when Twicely has real traction to reference.

Phase H starts immediately after G10 (production sign-off) is complete and the platform is live.

---

## Phase H Steps

### H1 — Browser Extension (Chrome + Edge + Firefox)

**Depends on:** G10 (live platform, real Centrifugo endpoints), Schema A2.4 applied
**Platforms served:** Poshmark, Facebook Marketplace, The RealReal, Vestiaire Collective (H4)
**Blocking for:** H4

#### H1.1 — Extension scaffold + registration

**Files:**
```
apps/extension/
├── manifest.chrome.json        # Chrome/Edge MV3 manifest
├── manifest.firefox.json       # Firefox MV3 manifest (minor diffs from Chrome)
├── src/
│   ├── background/
│   │   ├── index.ts            # Service worker (MV3 — not persistent background page)
│   │   ├── centrifugo.ts       # Centrifugo subscription + reconnect logic
│   │   ├── heartbeat.ts        # 5-minute heartbeat to /api/crosslister/extension/heartbeat
│   │   └── job-dispatcher.ts   # Receives job from Centrifugo, routes to correct platform script
│   ├── content/
│   │   ├── poshmark/
│   │   │   ├── publish.ts      # DOM script: create listing on Poshmark
│   │   │   ├── update.ts
│   │   │   ├── delist.ts
│   │   │   └── share.ts        # Automation: share-to-followers
│   │   ├── fb-marketplace/
│   │   │   ├── publish.ts
│   │   │   ├── update.ts
│   │   │   └── delist.ts
│   │   ├── therealreal/
│   │   │   ├── publish.ts
│   │   │   └── delist.ts
│   │   └── vestiaire/          # H4 only
│   │       ├── publish.ts
│   │       └── delist.ts
│   ├── popup/
│   │   ├── Popup.tsx           # React popup: connection status, active jobs, help link
│   │   └── popup.html
│   └── lib/
│       ├── api-client.ts       # Authenticated POST to /api/crosslister/extension/*
│       ├── auth.ts             # Token storage + refresh
│       └── polyfill.ts         # webextension-polyfill import
├── build/
│   ├── chrome/                 # Build output for Chrome Web Store
│   ├── edge/                   # Build output for Edge Add-ons
│   └── firefox/                # Build output for Firefox AMO
├── vite.config.ts
└── package.json
```

**H1.1 deliverable:** Extension installs, registers with server (`/api/crosslister/extension/register`), receives Centrifugo token and channel, sustains heartbeat. No job execution yet.

**Tests:**
- Unit: `centrifugo.ts` reconnect logic, `heartbeat.ts` timer
- E2E: Install extension → visit crosslister settings → "Extension connected" status shown in UI

---

#### H1.2 — Job execution: Poshmark + Facebook Marketplace

Implement `publish`, `update`, `delist` DOM scripts for the two highest-volume Tier C platforms. This is the majority of extension value.

**Acceptance criteria:**
- Extension receives a PUBLISH job via Centrifugo
- Navigates to poshmark.com/sell or fb.com/marketplace/create
- Fills form fields from `payloadJson` (title, description, price, images, condition, category)
- Submits form
- POSTs result (externalId, externalUrl) to callback
- `extensionJob` → COMPLETED
- `channelProjection` for Poshmark/FB updated to ACTIVE with external URL

---

#### H1.3 — Job execution: The RealReal

The RealReal is consignment — their listing flow is atypical. Implement separately after H1.2 is stable.

---

#### H1.4 — Crosslister UI: extension status panel

In the crosslister dashboard (`/my/selling/crosslist`), add:
- Extension connection status per browser
- "Install extension" CTA if no active installation found
- Pending/active job queue count for Tier C platforms
- "Extension disconnected" warning with reconnect guidance

---

### H2 — Whatnot Connector (Tier A, BIN Only)

**Depends on:** Whatnot Seller API access approved (apply at developers.whatnot.com)
**Scope:** Crosslist only — no import

#### H2.1 — Whatnot OAuth + account connect

Standard Tier A OAuth flow. Scope: `listings:write`, `listings:read`, `webhooks`.

#### H2.2 — Crosslist BIN listings to Whatnot

Map Twicely listing → Whatnot product. Whatnot supports: title, description, price, images, category, condition. Register `LISTING_CREATED`, `LISTING_UPDATED`, `PRODUCT_SOLD` webhooks.

**Constraints:**
- Whatnot's live-auction data model is irrelevant — create as Buy It Now / Shop item only
- No auto-relist on Whatnot (platform-specific rule, enforced in connector capabilities)
- Mark `canMakeOffers: false` in capabilities (Whatnot offers are live-sale only)

#### H2.3 — Sale detection via Whatnot webhook

`PRODUCT_SOLD` webhook → mark `channelProjection` SOLD → BullMQ job to delist on other platforms if hub enforcement is active.

---

### H3 — Shopify Connector (Tier A, Seller-Configurable)

**Depends on:** H1 complete (extension not needed — Shopify is Tier A)
**Scope:** Import and/or crosslist — seller chooses at connect time

#### H3.1 — Shopify OAuth + scope selection UI

OAuth using Shopify Admin API. At connect time, seller sees:
```
What would you like to do with your Shopify store?
☑ Import my Shopify products into Twicely
☑ Push my Twicely listings to my Shopify store
```
Defaults to both checked. Either can be unchecked. At least one must be selected.
Stores selection in `crosslisterAccount.capabilities.canImport` / `.canPublish`.

#### H3.2 — Shopify import

Pull products from Shopify Admin API `/admin/api/2024-01/products.json`. Map to Twicely listing format. Standard import pipeline — goes ACTIVE immediately, exempt from insertion fees.

#### H3.3 — Crosslist to Shopify

Push Twicely listings to Shopify as products. Map Twicely condition → Shopify metafield. Register `orders/paid` webhook for sale detection.

#### H3.4 — Bidirectional inventory sync (if both enabled)

When a listing sells on either platform, deduct inventory on the other. Use Shopify `inventory_levels` API + Twicely hub enforcement.

---

### H4 — Vestiaire Collective Connector (Tier C, Extension)

**Depends on:** H1.2 (extension + job system live), H1.4 (status UI)
**Scope:** Import + crosslist
**Priority:** Low — build last in Phase H

#### H4.1 — Vestiaire extension scripts

Add `apps/extension/src/content/vestiaire/publish.ts` and `delist.ts`. Vestiaire's listing form is EU-English; map Twicely fields including luxury-specific metadata (brand, authentication status, original price).

#### H4.2 — Vestiaire import (session scrape)

Since Vestiaire has no API, import uses the extension to scrape the seller's "My Closet" page. Extension reads listing data from DOM and posts to `/api/crosslister/migration/vestiaire` (import endpoint, not migration — same pipeline as other Tier B/C imports).

---

## Phase H Build Sequence Summary

| Step | Feature | Depends on | Blocker for |
|------|---------|------------|-------------|
| H1.1 | Extension scaffold + registration | G10 live | H1.2, H1.3, H1.4, H4 |
| H1.2 | Poshmark + FB Marketplace scripts | H1.1 | H1.4 |
| H1.3 | The RealReal scripts | H1.1 | — |
| H1.4 | Extension status UI | H1.2 | — |
| H2.1 | Whatnot OAuth | API access approved | H2.2 |
| H2.2 | Whatnot BIN crosslist | H2.1 | H2.3 |
| H2.3 | Whatnot sale webhook | H2.2 | — |
| H3.1 | Shopify OAuth + scope UI | — | H3.2, H3.3 |
| H3.2 | Shopify import | H3.1 | H3.4 |
| H3.3 | Shopify crosslist | H3.1 | H3.4 |
| H3.4 | Shopify bidirectional sync | H3.2 + H3.3 | — |
| H4.1 | Vestiaire extension scripts | H1.2 | H4.2 |
| H4.2 | Vestiaire import | H4.1 | — |

**Total steps:** 13
**Parallelisable:** H2 and H3 can run in parallel after H1.1 is complete. H4 after H1.2.

---

## What Phase H Adds to Build Sequence Tracker

Append to `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md`:

```
## Phase H — Platform Expansion & Browser Extension

| Step | Feature | Status | Notes |
|------|---------|--------|-------|
| H1.1 | Extension scaffold + registration | 🔲 | After G10 |
| H1.2 | Poshmark + FB Marketplace scripts | 🔲 | After H1.1 |
| H1.3 | The RealReal scripts | 🔲 | After H1.1 |
| H1.4 | Extension status UI | 🔲 | After H1.2 |
| H2.1 | Whatnot OAuth | 🔲 | Requires API access approval |
| H2.2 | Whatnot BIN crosslist | 🔲 | After H2.1 |
| H2.3 | Whatnot sale webhook | 🔲 | After H2.2 |
| H3.1 | Shopify OAuth + scope selection UI | 🔲 | — |
| H3.2 | Shopify import | 🔲 | After H3.1 |
| H3.3 | Shopify crosslist | 🔲 | After H3.1 |
| H3.4 | Shopify bidirectional sync | 🔲 | After H3.2 + H3.3 |
| H4.1 | Vestiaire extension scripts | 🔲 | After H1.2 |
| H4.2 | Vestiaire import | 🔲 | After H4.1 |
```

**Updated totals:**

| Phase | Steps | Done | Remaining |
|-------|-------|------|-----------|
| A–G (existing) | 151 | 108 | 43 |
| H (new) | 13 | 0 | 13 |
| **TOTAL** | **164** | **108** | **56** |

---

## Pre-Phase H Actions Required Now

1. **Apply for Whatnot Seller API access** — developers.whatnot.com. Do this during Phase G so approval isn't the blocker when H starts.
2. **Register Chrome Web Store developer account** — one-time $5 fee, requires Google account.
3. **Register Edge Add-ons developer account** — free, requires Microsoft account.
4. **Register Firefox AMO developer account** — free.
5. **Schema A2.4 migration** — apply before H1.1 build begins.
