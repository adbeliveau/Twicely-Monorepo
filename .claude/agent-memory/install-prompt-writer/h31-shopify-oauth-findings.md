# H3.1 Shopify OAuth — Research Findings

## Key Discovery: Shopify Not in Lister Canonical
- Lister Canonical Section 9.1 lists only 8 platforms. Shopify absent.
- Build tracker has H3.1-H3.4 for Shopify but no canonical spec.
- Prompt based on Shopify Admin REST API docs + established connector patterns.

## Schema State
- channelEnum currently 10 values (WHATNOT added in H2.1). SHOPIFY will be 11th.
- Schema doc (v2.1.0) only lists 9 values (missing WHATNOT too). Both are code-level additions.

## Shopify OAuth Uniqueness (vs other connectors)
- Per-store OAuth: Each seller connects their own `{shop}.myshopify.com` store.
- Auth URL is per-store: `https://{shop}.myshopify.com/admin/oauth/authorize`.
- Permanent access tokens — no refresh token, no expiry.
- HMAC verification required on callback (unique among all connectors).
- Callback includes `shop` and `hmac` query params (not just `code` and `state`).

## Files Requiring Modification
- enums.ts (channelEnum)
- types.ts (ExternalChannel union)
- connectors/index.ts (barrel import)
- admin-nav.ts (sidebar entry)
- seed-crosslister.ts (14 new settings)
- admin-connector-settings.ts (CONNECTOR_AUTH_CONFIG)

## Existing Patterns to Follow
- WhatnotConnector (H2.1) is the most recent reference
- All connectors: loadConfig from platformSetting, self-register, same method signatures
- Callback routes: exact pattern from whatnot/callback/route.ts
- Admin pages: ConnectorSettingsPage shared component with ConnectorConfig shape
- Tests: mock db/schema/logger/connector-registry/global.fetch, setupDbMock(), buildAccount()

## Platform Settings Pattern for Shopify
- Feature flags: `crosslister.shopify.{importEnabled,crosslistEnabled,automationEnabled}` (all false)
- OAuth creds: `crosslister.shopify.{clientId,clientSecret,redirectUri}`
- Config: `crosslister.shopify.{apiVersion,scopes}`
- Rate limits: `crosslister.shopify.{rateLimitPerMinute,rateLimitPerDay}`
- Fee rate: `crosslister.fees.shopify.rateBps`
- Hourly rate: `crosslister.rateLimit.shopify.callsPerHourPerSeller`
