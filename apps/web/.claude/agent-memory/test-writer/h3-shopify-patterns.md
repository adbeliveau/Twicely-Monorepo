# H3.1 Shopify Connector Test Patterns

## Connector test file split (H3.1 gap-fill)

The executor's `shopify-connector.test.ts` was already 380 lines. Gap-fill tests were split across two new files:
- `shopify-connector-extra.test.ts` — authenticate edge cases + buildAuthUrl scope encoding (230 lines)
- `shopify-connector-revoke-health.test.ts` — revokeAuth no-op paths + healthCheck branches (191 lines)

## Key Shopify-specific edge cases (authenticate)

1. **Empty state = missing shopDomain**: `credentials.state = ''` triggers the "shopDomain missing" error path before any fetch.
2. **HTTP 200 with error body**: Shopify can return 200 but `{ error: 'invalid_request', error_description: '...' }`. The impl checks `rawData.error` before schema parse. Test with `ok: true` + `error` field.
3. **Schema rejection path**: When token response is missing `access_token`, `ShopifyAccessTokenSchema.safeParse` fails → returns `'Invalid token response from Shopify'`.
4. **Shop info non-ok (403, 404)**: The `shopResponse.ok` guard means `externalAccountId` and `externalUsername` stay null, but `result.success` remains `true`. Test separately from the throw path.
5. **Shop info throws**: Caught by try/catch, logged as warn, result still has `success: true`.

## revokeAuth no-op guard

```typescript
// Both conditions gate the fetch call:
if (!account.accessToken || !account.externalAccountId) {
  logger.info('...nothing to revoke');
  return;
}
```
Test accessToken=null AND externalAccountId=null as separate cases.

## healthCheck branches

- `accessToken` null → returns immediately (no fetch)
- `externalAccountId` null → returns immediately (no fetch)
- fetch throws → `{ healthy: false, error: String(err) }` — does NOT throw
- HTTP non-ok → `error: \`Shopify API returned ${response.status}\``
- Verify URL format: `https://${shopDomain}/admin/api/${apiVersion}/shop.json`
- Verify header: `'X-Shopify-Access-Token': account.accessToken`

## buildAuthUrl URL param verification

Use `new URL(url).searchParams.get('scope')` to verify exact scope string rather than `.toContain()`. The exact value matters since it's passed verbatim to Shopify.

## Shopify tokens are permanent

Always assert `result.refreshToken === null` and `result.tokenExpiresAt === null` in happy-path authenticate tests.

## revokeAuth DELETE endpoint

```
https://${shopDomain}/admin/api_permissions/current.json
```
with `{ method: 'DELETE', headers: { 'X-Shopify-Access-Token': token } }`.

## Seed test pattern (captured values)

`seed-shopify-settings.test.ts` captures `db.insert().values()` calls in a `beforeAll`. The key prefix groups are:
- `crosslister.shopify.*` — feature flags, OAuth config, API version, scopes
- `crosslister.fees.shopify.*` — fee rates
- `crosslister.rateLimit.shopify.*` — rate limits

The test checks `>= 12` Shopify settings. Actual count in seed-crosslister.ts: 10 settings under `crosslister.shopify.*` + 1 under `crosslister.fees.shopify.*` + 1 under `crosslister.rateLimit.shopify.*` = 12 total.
