# H1.2 Content Scripts Findings

## Key Architecture Discoveries

### Extension File Structure (H1.1 Baseline)
- `extensions/chrome/` is a standalone project (separate package.json, tsconfig, build.mjs)
- Build tool: esbuild, targets chrome120
- 3 entry points: service-worker (ESM), popup (IIFE), bridge (IIFE)
- Content script bridge runs on all platform URLs as IIFE

### Bridge Pattern
- Single `bridge.ts` IIFE detects platform by hostname, sends PLATFORM_DETECTED
- Stub listener for EXECUTE_ACTION (H1.2+ fills in handlers)
- Message protocol: ContentToBackground / BackgroundToContent union types
- LISTING_SCRAPED type defined in types.ts but NOT handled by service worker yet

### Existing Session Data Shapes
- **Poshmark** (Tier C): `{ jwt: string, username: string }` -- from poshmark-types.ts PoshmarkSessionData
- **FB Marketplace** (Tier B, OAuth): Uses `account.accessToken`, NOT sessionData JSONB
  - FB connector has separate OAuth callback route: `/api/crosslister/fb-marketplace/callback/route.ts`
  - Extension session capture for FB is informational (confirm login, capture userId), not auth-critical

### API Route Pattern (Extension)
- JWT validation via `jose` jwtVerify, secret from `EXTENSION_JWT_SECRET` env var
- Token purpose check: `payload['purpose'] !== 'extension-session'`
- Zod `.strict()` for body validation
- Same 3-step pattern: validate auth -> parse body -> process

### Important Tier Distinction
- Poshmark = Tier C (session-based, NO official API)
- FB Marketplace = Tier B (OAuth, Graph API v18.0)
- Extension captures sessions for BOTH, but FB's primary auth remains OAuth
- Poshmark connector uses internal mobile API (undocumented), user agent spoofing

### FB Marketplace DOM Challenge
- Facebook uses randomized class names (hash-based, change between deploys)
- Must use ARIA roles, data-testid, semantic HTML for scraping
- No __NEXT_DATA__ equivalent on Facebook

### Poshmark DOM Strategy
- Poshmark is Next.js app, has `<script id="__NEXT_DATA__">` JSON blob
- Most reliable scrape path: parse __NEXT_DATA__ JSON -> navigate to listing data
- DOM selectors as fallback (styled-components with semi-stable prefixes like listing__title)

### Content Script Constraints (MV3)
- Cannot make cross-origin fetches (service worker's job)
- Must dispatch native events to trigger React state updates
- Cannot programmatically set file inputs (browser security)
- Runs once at document_idle; SPA navigation needs MutationObserver detection

### Test Pattern (Extension API Routes)
- vi.mock for @/lib/db, @/lib/db/schema, drizzle-orm, @/lib/logger
- SignJWT from jose for creating test tokens
- TEST_SECRET string for EXTENSION_JWT_SECRET
- vi.stubEnv for env vars
- Dynamic import: `const { POST } = await import('../route')`

### Existing Extension Test Count
- 11 test files in src/app/api/extension/__tests__/
- 86 total tests from H1.1 (per build tracker)

### No Canonical Spec for Content Script DOM Selectors
- Poshmark __NEXT_DATA__ paths and Facebook DOM selectors are reverse-engineered
- Expected to break periodically when platforms update
- Content scripts should be resilient (try multiple paths, graceful null returns)
