# H1.3 TheRealReal Content Script - Findings

## Key Architecture Facts
- TheRealReal is Tier C (session-based, no API). Same tier as Poshmark.
- TRR is a consignment marketplace: sellers submit items, TRR sets prices and manages listings.
- TRR is NOT a Next.js app. No `__NEXT_DATA__`. Traditional server-rendered site (likely Rails) with React hydration.
- Session uses cookies (`session_id`) + CSRF meta tags (standard Rails pattern).

## Server-Side Connector (Already Exists)
- `therealreal-connector.ts`: Full PlatformConnector implementation. Self-registers.
- `therealreal-types.ts`: TrrConsignment, TrrSessionData, TrrAuthResponse, TrrDesigner, TrrCategory, TrrImage
- `therealreal-normalizer.ts`: normalizeTrrListing(), parseTrrPrice(), condition mapping, toExternalListing()
- `therealreal-schemas.ts`: Zod schemas for runtime validation

## TrrSessionData Shape (Critical)
Server-side `extractSessionData()` expects EXACTLY these 4 keys:
- `sessionId: string` - from session_id cookie
- `csrfToken: string` - from meta[name="csrf-token"] tag
- `userId: string` - TRR user ID
- `email: string` - TRR email
If ANY are missing, `extractSessionData()` returns null and ALL connector ops fail.

## Existing Infrastructure (No Server Changes Needed)
- `/api/extension/session` route: Already accepts THEREALREAL channel
- `/api/extension/scrape` route: Already accepts THEREALREAL channel
- `manifest.json`: Already has `www.therealreal.com` in host_permissions and content_scripts
- `types.ts`: ExtensionChannel already includes 'THEREALREAL'
- `constants.ts`: SUPPORTED_CHANNELS already includes 'THEREALREAL'
- `bridge.ts` line 51: Comment stub ready for THEREALREAL handler

## Consignment Model Implications
- Auto-fill does NOT fill price (TRR sets it)
- Scrape works on BOTH /products/<slug> (public) and /account/consignments/<id> (private)
- TRR condition grades: Excellent, Very Good, Good, Fair, Poor (mapped in normalizer)
- TRR fee rate: 2000 bps (20%) seeded in seed-crosslister.ts
- TRR rate limit: 60 calls/hour/seller (same as Poshmark)

## Spec Gaps
- No dedicated TRR section in Lister Canonical (Poshmark has Section 16)
- Cookie name uncertainty: could be `session_id`, `_session_id`, or `_therealreal_session`
- User data embedding pattern unknown (try multiple patterns)
- Consignment submission form URL unknown
- Lister Canonical rollout table says TRR automation is "partial" (yellow circle)

## Prompt Output
- Written to: `.claude/install-prompts/H1.3-therealreal-content-scripts.md`
- Scope: 1 new file (therealreal.ts), 1-2 modified files (bridge.ts, optionally types.ts)
- No server-side changes, no new tests (existing scrape tests cover THEREALREAL)
- Follows exact pattern of poshmark.ts and fb-marketplace.ts
