# Browser Extension Architecture — Twicely Crosslister
**Version:** 1.0
**Status:** SPECCED — build in Phase H1
**Date:** 2026-03-06
**Decision:** #106
**Targets:** Chrome, Edge, Firefox (Manifest V3)

---

## Overview

The Twicely crosslister browser extension enables Tier C platform automation. It is a thin execution client — all business logic lives server-side. The extension's only job is to translate server-issued job payloads into DOM interactions on target platform tabs.

**Scope:** Poshmark, Facebook Marketplace, The RealReal, Vestiaire Collective (H4)
**Not in scope:** eBay, Etsy, Mercari, Depop, Grailed, Whatnot, Shopify — these are Tier A/B and use server-side API calls

---

## Architecture Principles

1. **Zero business logic in extension.** No pricing, no fee calculation, no scheduling decisions. Extension receives a job, executes it, reports back.
2. **Server is the source of truth.** `extensionJob` table tracks every job state. If the extension crashes, jobs re-queue on reconnect.
3. **Extension never stores platform credentials.** It operates inside the user's existing browser session. No passwords, no session tokens stored in extension storage.
4. **Platform-specific DOM scripts are isolated.** Each platform has its own content script directory. A Poshmark DOM change never touches FB Marketplace code.

---

## Repository Structure

```
apps/extension/
├── package.json
├── vite.config.ts              # Multi-entry build; outputs chrome/, edge/, firefox/ in build/
├── tsconfig.json               # strict: true
├── manifest.chrome.json        # Chrome + Edge (same file, different package.json name)
├── manifest.firefox.json       # Firefox — minor differences (browser_specific_settings)
│
├── src/
│   │
│   ├── background/             # MV3 service worker (non-persistent)
│   │   ├── index.ts            # Entry point — bootstraps all background modules
│   │   ├── centrifugo.ts       # Centrifugo WebSocket subscription
│   │   ├── heartbeat.ts        # 5-minute interval → /api/crosslister/extension/heartbeat
│   │   ├── job-dispatcher.ts   # Routes incoming jobs to correct content script
│   │   └── reconnect.ts        # Exponential backoff reconnect logic
│   │
│   ├── content/                # Platform-specific DOM scripts (injected per tab)
│   │   ├── poshmark/
│   │   │   ├── index.ts        # Entry — message listener, routes to action
│   │   │   ├── publish.ts      # Create new listing
│   │   │   ├── update.ts       # Edit existing listing
│   │   │   ├── delist.ts       # Delete/end listing
│   │   │   ├── share.ts        # Share to followers (Automation add-on only)
│   │   │   └── selectors.ts    # DOM selector constants — isolated for easy update
│   │   ├── fb-marketplace/
│   │   │   ├── index.ts
│   │   │   ├── publish.ts
│   │   │   ├── update.ts
│   │   │   ├── delist.ts
│   │   │   └── selectors.ts
│   │   ├── therealreal/
│   │   │   ├── index.ts
│   │   │   ├── publish.ts      # TRR is consignment — flow differs from standard
│   │   │   ├── delist.ts
│   │   │   └── selectors.ts
│   │   └── vestiaire/          # Added in H4
│   │       ├── index.ts
│   │       ├── publish.ts
│   │       ├── delist.ts
│   │       └── selectors.ts
│   │
│   ├── popup/                  # Browser action popup (click extension icon)
│   │   ├── Popup.tsx           # React component
│   │   ├── popup.html
│   │   └── popup.css
│   │
│   └── lib/
│       ├── api-client.ts       # Authenticated fetch to /api/crosslister/extension/*
│       ├── auth.ts             # Token: stored in chrome.storage.local (encrypted)
│       ├── message-bus.ts      # chrome.runtime.sendMessage abstraction
│       ├── polyfill.ts         # webextension-polyfill (browser.* compatibility)
│       └── types.ts            # Shared types: ExtensionJob, JobPayload, JobResult
│
└── build/
    ├── chrome/                 # Chrome Web Store submission package
    ├── edge/                   # Edge Add-ons submission package
    └── firefox/                # Firefox AMO submission package
```

---

## Manifest V3

### Chrome/Edge (`manifest.chrome.json`)

```json
{
  "manifest_version": 3,
  "name": "Twicely Crosslister",
  "version": "1.0.0",
  "description": "Manage your listings across Poshmark, Facebook Marketplace, and more — powered by Twicely.",
  "permissions": [
    "storage",
    "alarms",
    "scripting"
  ],
  "host_permissions": [
    "https://poshmark.com/*",
    "https://www.facebook.com/marketplace/*",
    "https://www.therealreal.com/*",
    "https://www.vestiairecollective.com/*",
    "https://twicely.co/api/*"
  ],
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://poshmark.com/*"],
      "js": ["content/poshmark/index.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.facebook.com/marketplace/*"],
      "js": ["content/fb-marketplace/index.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://www.therealreal.com/*"],
      "js": ["content/therealreal/index.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Twicely Crosslister",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Firefox differences (`manifest.firefox.json`)

```json
{
  // Same as chrome, plus:
  "browser_specific_settings": {
    "gecko": {
      "id": "crosslister@twicely.co",
      "strict_min_version": "109.0"
    }
  }
}
```

---

## Job Flow

### 1. Registration

On install (and on browser open if not registered), extension calls:

```
POST /api/crosslister/extension/register
Body: { browser: 'CHROME', extensionVersion: '1.0.0', deviceFingerprint: '...' }
Response: {
  installationId: 'xxx',
  centrifugoUrl: 'wss://rt.twicely.co/connection/websocket',
  centrifugoToken: 'eyJ...', // Short-lived JWT
  channel: 'extension:userId:installationId'
}
```

Token stored in `chrome.storage.local`. Centrifugo subscription established.

### 2. Heartbeat

Every 5 minutes via `chrome.alarms`:
```
POST /api/crosslister/extension/heartbeat
Body: { installationId: 'xxx' }
```

### 3. Job Receipt

Centrifugo delivers job to extension channel:
```json
{
  "extensionJobId": "abc123",
  "jobType": "PUBLISH",
  "targetChannel": "POSHMARK",
  "payload": {
    "title": "Nike Air Max 90 Size 10",
    "description": "Great condition...",
    "priceCents": 8500,
    "images": ["https://r2.twicely.co/listings/..."],
    "condition": "VERY_GOOD",
    "category": "Men / Shoes",
    "brand": "Nike",
    "size": "10",
    "color": "White"
  }
}
```

`job-dispatcher.ts` maps `targetChannel` → correct content script tab + message.

### 4. Execution

`background/job-dispatcher.ts` sends message to content script via `chrome.tabs.sendMessage`. Content script executes DOM interactions. Tab must be open or background opens one.

**Tab management:** If no tab open for the target platform:
1. `chrome.tabs.create({ url: 'https://poshmark.com/sell', active: false })`
2. Wait for `complete` event
3. Send message to tab
4. Close tab on completion

### 5. Callback

On success or failure, extension POSTs to callback:
```
POST /api/crosslister/extension/callback
Body: {
  extensionJobId: 'abc123',
  status: 'COMPLETED',
  result: { externalId: 'pm_abc', externalUrl: 'https://poshmark.com/listing/...' }
}
-- or on failure --
Body: {
  extensionJobId: 'abc123',
  status: 'FAILED',
  errorCode: 'FORM_SUBMISSION_FAILED',
  errorMessage: 'Could not locate submit button'
}
```

---

## Content Script Pattern

Every platform content script follows this pattern:

```typescript
// src/content/poshmark/index.ts
import { browser } from '../lib/polyfill';
import { publish } from './publish';
import { update } from './update';
import { delist } from './delist';
import { share } from './share';
import type { JobMessage } from '../../lib/types';

browser.runtime.onMessage.addListener(async (message: JobMessage, _sender, sendResponse) => {
  try {
    let result;
    switch (message.jobType) {
      case 'PUBLISH': result = await publish(message.payload); break;
      case 'UPDATE':  result = await update(message.payload); break;
      case 'DELIST':  result = await delist(message.payload); break;
      case 'SHARE':   result = await share(message.payload); break;
      default: throw new Error(`Unknown jobType: ${message.jobType}`);
    }
    sendResponse({ status: 'COMPLETED', result });
  } catch (err) {
    sendResponse({
      status: 'FAILED',
      errorCode: 'EXECUTION_ERROR',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
  return true; // Keep message channel open for async response
});
```

---

## Selector Isolation

Each platform keeps all DOM selectors in a single `selectors.ts` file. This is the first file that needs updating when a platform changes their UI.

```typescript
// src/content/poshmark/selectors.ts
export const SELECTORS = {
  sell: {
    titleInput:       '[data-et-name="title"]',
    descInput:        '[data-et-name="description"]',
    priceInput:       '[data-et-name="price"]',
    categoryDropdown: '[data-et-name="category_v2"]',
    conditionSelect:  '[data-et-name="condition"]',
    submitButton:     '[data-et-name="save_listing"]',
  },
  listing: {
    editButton:       '[data-et-name="edit_listing"]',
    deleteButton:     '[data-et-name="delete_listing"]',
  },
} as const;
```

When Poshmark changes their HTML, only `selectors.ts` changes. No hunting through publish/update/delist files.

---

## Popup UI

Minimal React popup. Surfaces:

1. **Connection status** — Green dot "Connected" or Red "Disconnected"
2. **Active jobs** — "3 pending jobs" with spinner
3. **Last activity** — "Last action: Poshmark — Published 2m ago"
4. **Open dashboard** — Link to `/my/selling/crosslist`
5. **Help** — Link to KB article on extension setup

No settings in popup. All configuration is done in the Twicely web app.

---

## Build Config

```typescript
// vite.config.ts (simplified)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    outDir: `build/${mode}`,  // mode = chrome | edge | firefox
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup:      resolve(__dirname, 'src/popup/popup.html'),
        poshmark:   resolve(__dirname, 'src/content/poshmark/index.ts'),
        fb:         resolve(__dirname, 'src/content/fb-marketplace/index.ts'),
        trr:        resolve(__dirname, 'src/content/therealreal/index.ts'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'chunks/[hash].js',
      },
    },
  },
}));
```

Build commands:
```bash
npm run build:chrome   # vite build --mode chrome
npm run build:edge     # vite build --mode edge  (identical output, different manifest copy step)
npm run build:firefox  # vite build --mode firefox (uses manifest.firefox.json)
npm run build:all      # runs all three
```

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Extension auth token leakage | Token stored in `chrome.storage.local` (not accessible to web pages). Short-lived JWT (1 hour), refreshed via heartbeat. |
| Malicious job injection | Server signs job payloads. Extension validates signature before execution. |
| Cross-origin data theft | Extension only has `host_permissions` for declared platform domains. Cannot read twicely.co session cookies (different origin). |
| Platform account bans | Extension executes actions at human-realistic speeds (configurable delay between actions). Does not exceed platform rate limits. |
| Extension removal | `isActive` flips false on next heartbeat window. Hub surfaces warning. Tier C jobs queue and retry when extension reconnects. |

---

## Store Submission Notes

**Chrome Web Store**
- $5 one-time developer fee
- Review typically 1–3 business days
- Single submission; Edge will pick it up via the Edge Add-ons program (Chromium-based, can list same extension)

**Edge Add-ons**
- Free
- Can cross-publish from Chrome Web Store OR submit separately
- Review 1–5 business days

**Firefox AMO (addons.mozilla.org)**
- Free
- Separate submission with `manifest.firefox.json`
- Review 1–7 business days for listed extensions
- Can self-distribute (unlisted) for faster iteration during testing

**Action required during Phase G:** Register developer accounts on all three stores so submission can happen immediately when H1 is ready.
