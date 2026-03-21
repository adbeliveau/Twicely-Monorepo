# H2.1 Whatnot OAuth -- Research Findings

## Key Discovery: Whatnot NOT in Canonical Specs
- Whatnot is NOT mentioned in the Lister Canonical (not in connector tier table, not in channelEnum list)
- Whatnot is NOT in the schema doc's channelEnum (only 9 values currently)
- Whatnot is NOT in the Feature Lock-in doc
- Whatnot is NOT in the Page Registry
- Whatnot IS in the Build Tracker as H2.1/H2.2/H2.3 (queued)
- Whatnot IS mentioned in Decision Rationale only as "live selling" comparison (post-launch)
- Zero occurrences of "whatnot" or "WHATNOT" in the entire codebase

## Whatnot API Architecture
- Official Seller API: https://developers.whatnot.com/
- Uses OAuth 2.0 + GraphQL (NOT REST like other connectors)
- Auth URL: https://api.whatnot.com/seller-api/rest/oauth/authorize
- Token URL: https://api.whatnot.com/seller-api/rest/oauth/token
- GraphQL: https://api.whatnot.com/seller-api/graphql
- Staging variants at api.stage.whatnot.com
- Scopes: read:inventory, write:inventory, read:orders, write:orders, read:customers
- Refresh tokens expire in 1 year, invalidated on use (must store new one)
- Token prefix: wn_access_tk_ (prod), wn_access_tk_test_ (staging)

## GraphQL Operations Available
Queries: listing, listings, product, products, productVariant, productVariants, me, order, orders
Mutations: listingCreate, listingUpdate, listingDelete, listingPublish, listingUnpublish, listingAdjustQuantity, productCreate, productUpdate, productDelete, orderCancel, addTrackingCode

## Tier Classification Decision
- Classified as Tier B (API-Limited, no webhooks) based on:
  - Has official OAuth API (not session-based)
  - No known webhook support
  - GraphQL API with limited endpoints
  - Matches Mercari/Depop/Grailed tier

## Schema Impact
- channelEnum needs 10th value: 'WHATNOT'
- ExternalChannel type needs 'WHATNOT' union member
- Requires Drizzle migration for ALTER TYPE channel ADD VALUE

## Pattern: GraphQL vs REST Connector
- First GraphQL connector in the codebase (all 8 existing are REST)
- Implementation wraps GraphQL behind same PlatformConnector interface
- Uses plain fetch() with JSON body (no GraphQL client library)
- Response wrapper: { data: T | null, errors?: Array<{ message: string }> }
