# H3.2 Shopify Import -- Research Findings

## Critical Bug Fix: normalizer-dispatch.ts
- normalizer-dispatch.ts handles 8 channels (EBAY through DEPOP) but is MISSING WHATNOT and SHOPIFY.
- Import pipeline stage 3 (TRANSFORMING) calls `normalizeExternalListing(raw, batchChannel)` -- will throw for any post-Phase-F connector.
- H3.2 prompt includes adding BOTH Shopify and Whatnot cases to fix this latent bug.
- This was missed in H2.1/H2.2 because the Whatnot connector normalizes inside `fetchListings` before the data hits import-service.

## Shopify REST Admin API Specifics
- Products endpoint: `GET /admin/api/{version}/products.json`
- Auth: `X-Shopify-Access-Token` header (unique among connectors -- not Bearer token).
- Pagination: `Link` header with `page_info` cursor (RFC 8288). When page_info is in URL, ALL other query params ignored.
- First page: `?status=active&limit=50`. Subsequent: `?page_info=CURSOR&limit=50` only.
- Product `status` is lowercase: `active`, `archived`, `draft`.
- Price is decimal string on variants (e.g. "29.99"), not on product level.
- `body_html` contains HTML -- must strip with regex (no new deps).
- `tags` is comma-separated string, NOT array.
- Weight on variants needs unit conversion (lb/oz/kg/g -> grams).
- Multi-variant: sum quantities, use first variant's price. Min quantity = 1.

## Existing File State
- shopify-connector.ts: 356 lines (ALREADY over 300 limit). Split required.
- shopify-normalizer.ts: 15 lines (stub, throws "not implemented").
- shopify-schemas.ts: 27 lines (only ShopifyShopSchema + ShopifyAccessTokenSchema).
- shopify-types.ts: 72 lines (has ShopifyProduct, ShopifyVariant, ShopifyImage already defined).
- normalizer-dispatch.ts: 141 lines (8 channels, no WHATNOT/SHOPIFY).

## Architecture: File Split
- Extract `fetchShopifyProducts`, `fetchSingleShopifyProduct`, `parseShopifyLinkHeader` into `shopify-import.ts`.
- Connector methods become thin delegation wrappers.
- Pattern mirrors `whatnot-graphql.ts` extraction for Whatnot.

## Architecture: Normalizer Dual Path
- fetchListings normalizes internally (returns ExternalListing[]) -- data stored in rawDataJson on importRecord.
- normalizer-dispatch also handles raw Shopify JSON for stage 3 of import pipeline.
- Both paths use the same normalizer functions from shopify-normalizer.ts.
- When called from dispatch, no shopDomain available -- URL will be empty string.

## Test Estimates
- Build tracker v1.87: 8293 tests baseline.
- Prompt v2 estimates ~79 new tests (normalizer ~32, connector-import ~31, schemas ~12, dispatch ~4).
- Total target: ~8372.

## Seeded Platform Settings (from seed-crosslister.ts)
- `crosslister.shopify.apiVersion`: '2024-01'
- `crosslister.shopify.importEnabled`: false
- `crosslister.shopify.crosslistEnabled`: false
- `crosslister.shopify.rateLimitPerMinute`: 120
- `crosslister.shopify.rateLimitPerDay`: 10000
- OAuth creds: clientId, clientSecret, redirectUri, scopes
