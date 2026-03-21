# H4.1 Vestiaire Extension Scripts - Findings

## Key Architecture Facts
- Vestiaire Collective is Tier C (session-based, no API). Same tier as Poshmark and TheRealReal.
- Vestiaire is a peer-to-peer luxury marketplace. Sellers SET their own prices (unlike TRR where platform sets prices).
- Vestiaire is NOT in the Lister Canonical at all. Only appears in Build Sequence Tracker as H4.1/H4.2.
- Vestiaire is NOT in the channelEnum (needs 12th value via Drizzle migration).
- Vestiaire IS a React SPA with JSON-LD Product markup (same scraping strategy as TRR).
- Multi-currency is the unique challenge: EUR, GBP, USD, CHF, etc.

## Pre-wired Infrastructure (Already Done)
- `manifest.json`: `www.vestiairecollective.com/*` in host_permissions AND content_scripts matches
- `types.ts`: ExtensionChannel already includes 'VESTIAIRE'
- `constants.ts`: SUPPORTED_CHANNELS already includes 'VESTIAIRE'
- `bridge.ts` line 55: Stub comment `// VESTIAIRE left as stub for H4.1`

## NOT Done (H4.1 Scope)
- channelEnum in enums.ts (12th value, needs migration)
- ExternalChannel type in crosslister/types.ts
- CHANNEL_REGISTRY entries: WHATNOT, SHOPIFY, AND VESTIAIRE all missing from map
- Session route Zod enum (currently rejects VESTIAIRE)
- Scrape route Zod enum (currently rejects VESTIAIRE)
- Platform settings seed (7+ settings)
- Channel map entries in platform-fees.ts (CHANNEL_FEE_KEY + DEFAULT_FEE_RATES_BPS), publish-service.ts (channelSettingKey), crosslister-import.ts (getImportFlagKey)
- The actual vestiaire.ts content script file
- Hub admin page at /cfg/vestiaire

## Existing Rejection Tests to Update
- `session.test.ts` line 137: `it('rejects VESTIAIRE channel (not yet in DB enum)')` -- must update to expect 200 success
- `scrape-ext.test.ts` line 144: `it('returns 400 for VESTIAIRE channel')` -- must update to expect 200 success

## CRITICAL: CHANNEL_REGISTRY Gap (Discovered During Prompt Writing)
- WHATNOT added to channelEnum + ExternalChannel in H2.1 but NOT to CHANNEL_REGISTRY
- SHOPIFY added to channelEnum + ExternalChannel in H3.1 but NOT to CHANNEL_REGISTRY
- H4.1 must add all three: WHATNOT, SHOPIFY, VESTIAIRE to CHANNEL_REGISTRY
- This was NOT caught in previous H2.1/H3.1 implementations

## Multi-Currency Decision
- ScrapedListing has no `currency` field -- recommended adding optional `currency?: string`
- parsePriceWithCurrency() helper handles EUR comma-decimal format (150,00 = 150.00)
- Content script does NOT convert currency -- server's responsibility during import

## Tier C Session Pattern (Mirrors TRR)
- Cookie-based session: try `_vc_session`, `_vestiaire_session`, `vc_token`
- Embedded script data: `window.__INITIAL_STATE__`, `window.__PRELOADED_STATE__`
- DOM fallback for user info
- Session data shape: { sessionToken, userId, email, detectedAt }

## Fee Rate
- No canonical source for Vestiaire commission. Estimated 1500 bps (15%).
- Actual: varies 12-25% depending on item price and seller status.

## Correct Map Names (Verified Against Code)
- platform-fees.ts: `CHANNEL_FEE_KEY` (not "CHANNEL_KEY_MAP"), `DEFAULT_FEE_RATES_BPS` (not "FALLBACK_RATES")
- publish-service.ts: `channelSettingKey()` function with internal `map` variable
- crosslister-import.ts: `getImportFlagKey()` function with internal `map` variable

## URL Patterns
- Product pages: `/*/p-XXXXXXX.html` (main pattern)
- Older format: `/*/XXXXXXX.shtml`
- Sell form: `/sell/`

## Prompt Output
- Written to: `.claude/install-prompts/H4.1-vestiaire-extension-scripts.md`
- 6 new files, 16 modified files
- 7 spec gaps flagged for owner decision
