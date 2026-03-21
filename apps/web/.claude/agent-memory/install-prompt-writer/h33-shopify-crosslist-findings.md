# H3.3 Shopify Crosslist -- Research Findings

## Shopify REST Admin API for Crosslist
- Create: POST /admin/api/{version}/products.json { product: { ... } }
- Update: PUT /admin/api/{version}/products/{id}.json { product: { ... } }
- Delete: DELETE /admin/api/{version}/products/{id}.json (permanent, not archive)
- Verify: GET /admin/api/{version}/products/{id}.json
- Auth: X-Shopify-Access-Token header (NOT Bearer)
- Prices: decimal strings on variants ("29.99"), NOT numbers
- IDs: numbers in API, stored as strings in crosslisterListing.externalId
- Images: position is 1-based, sorted by position
- Tags: comma-separated string, NOT array
- Status: lowercase ('active', 'draft', 'archived')

## Image Cap Discrepancy
- SHOPIFY_CAPABILITIES in shopify-connector.ts: maxImagesPerListing = 250 (Shopify's actual limit)
- CHANNEL_REGISTRY tierACapabilities(10, 255, 5000): maxImagesPerListing = 10
- listing-transform.ts uses CHANNEL_REGISTRY value to limit images before passing to connector
- Resolution: Trust TransformedListing (pre-limited), add defensive 250 cap in toShopifyProductInput

## Connector File Size Issue
- shopify-connector.ts is 373 lines BEFORE H3.3 changes
- Already exceeds 300-line limit from H3.1 (OAuth) + H3.2 (import delegation)
- H3.3 solution: Replace 20-line stubs with ~60-line thin wrappers (net +40)
- May need to extract OAuth methods into shopify-auth.ts to get under 300

## Pattern Comparison: Whatnot vs Shopify Crosslist
- Whatnot: GraphQL mutations, 2-step create (draft+publish), Money type prices, unpublish for delist
- Shopify: REST API, 1-step create (status:'active'), decimal string prices, DELETE for delist
- Both: same connector interface, same job-executor dispatch, same publish-service enqueue

## Key Files
- shopify-connector.ts: 373 lines, 4 stubs at lines 319-341
- shopify-import.ts: 157 lines (extraction pattern for crosslist file)
- shopify-normalizer.ts: 222 lines (parseShopifyPrice, mapShopifyStatus, stripHtml reusable)
- shopify-schemas.ts: 67 lines (ShopifyProductSchema for verification)
- shopify-types.ts: 77 lines (needs ShopifyProductInput, ShopifyCreateProductResponse added)
- publish-service.ts: SHOPIFY already in channelSettingKey map (line 62)
- channel-registry.ts: SHOPIFY entry already present (lines 274-292, Tier A)
- normalizer-dispatch.ts: SHOPIFY case already present (lines 154-164)

## Test Estimates
- shopify-crosslist.test.ts: ~50 tests (transform + HTTP helpers)
- shopify-connector-crosslist.test.ts: ~31 tests (connector integration)
- Total: ~81 new tests
- Baseline: 8603, target: ~8684

## Existing Shopify Test Files (Must Not Regress)
- shopify-connector.test.ts (OAuth tests)
- shopify-connector-import.test.ts (import tests)
- shopify-connector-extra.test.ts
- shopify-connector-revoke-health.test.ts
- shopify-normalizer.test.ts
- shopify-schemas.test.ts
