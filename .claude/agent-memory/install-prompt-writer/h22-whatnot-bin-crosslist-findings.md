# H2.2 Whatnot BIN Crosslist -- Research Findings

## Existing Code Inventory (at H2.2 start)
- `whatnot-connector.ts` (362 lines) -- auth lifecycle complete, 5 stubs remain
- `whatnot-types.ts` (64 lines) -- token, profile, listing, pagination types
- `whatnot-normalizer.ts` (151 lines) -- normalize + toExternalListing + parseMoneyToCents
- `whatnot-schemas.ts` (56 lines) -- WhatnotListingSchema + WhatnotTokenResponseSchema
- `whatnot-connector.test.ts` (398 lines) -- ~35 tests covering auth lifecycle + stubs
- `whatnot-normalizer.test.ts` (104 lines) -- ~10 tests
- `whatnot-schemas.test.ts` (47 lines) -- ~2 tests
- Already in connector index.ts, publish-service.ts, platform-fees.ts

## Whatnot GraphQL Seller API
- Endpoint: `https://api.whatnot.com/seller-api/graphql` (prod) / `https://api.stage.whatnot.com/seller-api/graphql` (staging)
- Auth: Bearer token in Authorization header
- Relay-style pagination: `nodes`, `pageInfo { hasNextPage endCursor }`
- Money type: `{ amount: "12.99", currencyCode: "USD" }` -- decimal string, not cents
- Status values: PUBLISHED, UNPUBLISHED, SOLD
- userErrors pattern: mutations return 200 OK with `userErrors[]` for validation failures

## Available GraphQL Operations
- Queries: listing(id), listings(first, after)
- Mutations: listingCreate(input), listingPublish(id), listingUpdate(id, input), listingUnpublish(id), listingDelete(id), listingAdjustQuantity
- Livestream mutations exist but OUT OF SCOPE (no BIN relevance)

## Key Architecture Decisions
- Extracted whatnot-graphql.ts helper to reduce connector file bloat
- Extracted whatnot-transform.ts for outbound TransformedListing -> WhatnotListingInput
- Separate test file (whatnot-connector-crosslist.test.ts) to avoid bloating auth tests
- 2-step create: listingCreate (DRAFT) -> listingPublish (PUBLISHED)
- delistListing uses listingUnpublish (not delete) -- idempotent on already-unpublished

## File Size Concerns
- whatnot-connector.ts already 362 lines, will grow to ~450-500
- ebay-connector.ts is 589 lines (precedent for large connector files)
- User preference: accept file size violations rather than splitting
- New helper files (graphql, transform) stay under 300 lines
