# H2.2 Whatnot BIN Crosslist — Testing Notes

## File Locations
- `src/lib/crosslister/connectors/__tests__/whatnot-connector-crosslist.test.ts` (54+12 tests, 935 lines)
- `src/lib/crosslister/connectors/__tests__/whatnot-graphql.test.ts` (8+6 tests, 253 lines)
- `src/lib/crosslister/connectors/__tests__/whatnot-transform.test.ts` (14+7 tests, 179 lines)

## Mock Pattern Used

Connector tests use `global.fetch = mockFetch` (not `vi.stubGlobal`) at module level.
DB mock uses a simple chainable: `mockDbSelect.mockReturnValue({ from: fn().mockReturnValue({ where: fn().mockResolvedValue(config) }) })`.
Module is dynamically imported per test via `await import('../whatnot-connector')`.
`vi.clearAllMocks()` in `beforeEach` is sufficient (mockReturnValueOnce queues not shared across describes here).

## Branch Coverage Map

### fetchListings
- No accessToken → empty result (no fetch call)
- 401 status → `executeGraphQL` returns `status:401` → connector returns empty (does NOT throw)
- GraphQL errors → empty result
- Network error (fetch throws) → caught → empty result
- Invalid listing schema → skipped (logged, not thrown)
- Only ACTIVE (PUBLISHED) listings returned — UNPUBLISHED/SOLD filtered out
- Cursor: sends `after: cursor` when provided, `after: null` when not

### createListing (2-step)
- Step 1 HTTP 429/5xx → retryable:true (never reaches step 2)
- Step 1 HTTP 4xx non-429 → retryable:false
- Step 1 `data` is null → `'No response data'`, retryable:true
- Step 1 `listing.id` is null → `'No listing ID returned'`, retryable:true
- Step 1 `userErrors` → retryable:false, externalId:null
- Step 2 `userErrors` → retryable:true, externalId IS set (partial failure)
- Network error (catch) → retryable:true

### updateListing
- Empty changes `{}` — connector does NOT short-circuit; still sends mutation
- `userErrors` → retryable:false
- HTTP 429/5xx → retryable:true
- Network error → retryable:true

### delistListing — idempotent paths
Three separate paths that all return `success:true`:
1. HTTP 404 response status
2. `userErrors[0].message` contains 'already' or 'unpublished' or 'not found'
3. `result.errors` array contains message with 'not found' (GraphQL-level error on 200 response)

### verifyListing — status mapping
| Whatnot status | VerificationResult.status |
|---|---|
| `PUBLISHED` | `ACTIVE` |
| `SOLD` | `SOLD` |
| anything else | `ENDED` |
| no data / errors | `REMOVED`, exists:false |
| no accessToken | `UNKNOWN`, exists:false |

Quantity: `firstVariant?.inventoryQuantity ?? 1` (fallback to 1 when no variants).
lastModifiedAt: `null` when `updatedAt` is null OR `isNaN(new Date(updatedAt).getTime())`.

## executeGraphQL — Branch Coverage
- Network error (fetch throws) → `{ data: null, errors: [{message: err}], status: 0 }`
- HTTP error + parseable body → `{ data: null, errors: body.errors ?? [synthesized], status }`
- HTTP error + unparseable body → `{ data: null, errors: [{message: 'HTTP N'}], status }`
- HTTP 200 + unparseable body → `{ data: null, errors: null, status: 200 }` (NOT an error)
- HTTP 200 + partial data + errors → returns both data AND errors
- HTTP 200 + clean data → `{ data, errors: null, status: 200 }`

## toWhatnotPartialInput — Fields
All fields are optional — only included when key present in changes:
`title` (truncated 200), `description` (truncated 5000), `priceCents` → `price.amount` (decimal string),
`images` → `media` (sorted, max 10), `quantity`, `category` → `productTaxonomyNodeId` (undefined when empty ID).
