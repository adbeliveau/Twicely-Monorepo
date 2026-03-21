# H1.4 Extension Status UI - Findings

## What Exists Already
- `/my/selling/crosslist` page does NOT exist yet (no file at `src/app/(marketplace)/my/selling/crosslist/`)
- All 6 extension API routes exist: authorize, callback, register, heartbeat, session, detect + scrape (7 total)
- Extension popup at `extensions/chrome/src/popup/popup.html` already shows 3 Tier C platforms
- Service worker opens `/my/selling/crosslist?source=extension` on extension install
- `crosslister.ts` queries file has `getCrosslisterDashboardData`, `getSellerQueueStatus`
- 17 existing crosslister UI components in `src/components/crosslister/`
- CASL rules exist: `can('manage', 'CrosslisterAccount', { sellerId: userId })`
- Channel registry has all 8 channels with tier, color, authMethod, displayName

## Key Architecture Decisions (in prompt)
- Extension detection from server side is HEURISTIC only (lastAuthAt within 30 min)
- `?source=extension` query param confirms extension presence for that page load
- No direct JS communication between Next.js page and Chrome extension (CSP)
- FB Marketplace is Tier B (OAuth) despite extension capturing its sessions
- Extension banner only mentions true Tier C platforms (Poshmark, TheRealReal)
- 24-hour staleness threshold for session expiry (owner decision flagged)

## Spec Gaps Flagged
- Chrome Web Store URL is placeholder (extension not published)
- 30-minute heartbeat detection threshold not in any spec
- 24-hour session staleness threshold not in any spec
- FB Marketplace extension role unclear (informational only)

## Existing Component Inventory
- `platform-card.tsx` - per-account card with status, listing count, import/disconnect buttons
- `queue-status-card.tsx` - queued/publishing/failed counts
- `publish-meter-display.tsx` - usage bar with tier, used, remaining, rollover
- `crosslister-onboarding-empty.tsx` - hero + 3 steps + 3 value props for empty state
- `connect-platform-cta.tsx` - simple CTA for "Connect your first platform"
- `connect-platform-grid.tsx` - 3-column grid (eBay, Poshmark, Mercari) with connect buttons
- `session-auth-dialog.tsx` - credential dialog for Tier C platforms
- `crosslist-panel.tsx` - "Also list on" panel with channel checkboxes

## Schema Facts
- `crosslisterAccount.authMethod`: 'OAUTH' | 'API_KEY' | 'SESSION'
- `crosslisterAccount.lastAuthAt`: Timestamp, updated on each session sync
- `crosslisterAccount.status`: 'ACTIVE' | 'REAUTHENTICATION_REQUIRED' | 'REVOKED' | 'ERROR' | 'PAUSED'
- `crosslisterAccount.sellerId`: References `user.id` (ownership model)
- Tier C channels: POSHMARK (authMethod='SESSION'), THEREALREAL (authMethod='SESSION')
- FB_MARKETPLACE uses OAUTH in channel-registry.ts (NOT SESSION)

## Files Created
- Install prompt: `.claude/install-prompts/H1.4-extension-status-ui.md`
- 8 files total: 5 production + 3 test
