# H1.1 Extension Scaffold Findings

## Key Discovery: No Browser Extension Architecture in Canonical Docs
- The Lister Canonical has NO dedicated section on browser extension architecture
- Phase H "Browser Extension" is mentioned only in the Build Sequence Tracker (4 lines)
- Tier C session automation (Section 9.4) describes server-side headless sessions, NOT browser extension
- The extension concept must be inferred from:
  - Tier C limitations (session-based connectors need real browser context)
  - Build Sequence Tracker H1.1-H1.4 entries
  - The fact that Poshmark, TheRealReal, and FB Marketplace all use session/browser-context auth

## Architecture Decisions Made in Prompt
These decisions were NOT in canonical docs -- flagged as "owner decisions needed":
1. Chrome Manifest V3 (vs V2, Firefox)
2. JWT-based extension auth (not cookie-based, not OAuth)
3. Standalone build (not pnpm workspace member)
4. esbuild bundler (lightweight, no React)
5. chrome.storage.local for token storage
6. 5 API routes under /api/extension/
7. Content script bridge pattern (detect platform + relay messages)

## Existing Code Patterns Used
- Connector registry pattern: registerConnector() at module load
- Channel registry: CHANNEL_REGISTRY Map with ChannelMetadata
- Crosslister account actions: authorize() + sub() + CASL for ownership
- Poshmark connector uses sessionData: { jwt, username } shape
- TheRealReal connector uses sessionData: { sessionId, csrfToken, userId, email }
- Human-like delays (2-8s) in Tier C connectors

## Schema Facts
- `crosslisterAccount.authMethod` supports 'OAUTH' | 'API_KEY' | 'SESSION'
- `crosslisterAccount.sessionData` is JSONB -- can store any shape
- Tier C platforms: POSHMARK (tier C), THEREALREAL (tier C)
- FB_MARKETPLACE is actually Tier B (OAuth) in current impl, not Tier C
- Vestiaire (VESTIAIRE) not in channelEnum yet -- H4.1 scope

## Extension API Route Structure
- GET  /api/extension/authorize -- redirect-based auth initiation
- GET  /api/extension/callback  -- HTML page to relay token
- POST /api/extension/register  -- exchange registration token for session token
- POST /api/extension/heartbeat -- periodic health check
- POST /api/extension/session   -- receive Tier C session data
- POST /api/extension/detect    -- log platform detection (analytics)
