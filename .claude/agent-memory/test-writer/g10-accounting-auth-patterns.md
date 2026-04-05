# G10 Accounting + Authentication Patterns

## G10.3 Sync Engine

### refreshIntegrationTokens mock pattern
Two DB calls: `select` (get integration) + `update` (save new tokens).
Both `decrypt` AND `encrypt` must be mocked — decrypt for refresh token, encrypt for both new tokens.

```typescript
vi.mock('@twicely/db/encryption', () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
}));
mockEncrypt.mockImplementation((s: string) => `encrypted-${s}`);
```

### syncPayouts mock pattern
Three DB select patterns in sequence:
1. `makeSelectChain([INTEGRATION])` — fetch integration (has `.limit`)
2. `makeSelectChainNoLimit([payouts])` — fetch payouts (no `.limit`, ends at `.where`)
3. `makeSelectChain([])` or `makeSelectChain([existing])` — entityMap check per payout (has `.limit`)

The payout query does NOT use `.limit()` — it uses `.where()` directly as the terminal call. Use `makeSelectChainNoLimit` for it.

Also mock `payoutToJournalEntry` in `../entity-mappers` separately from `orderToInvoice`/`expenseToExpenseData`.

### payout table schema stub
Include `payout` in the `@twicely/db/schema` mock:
```typescript
payout: { id: 'id', userId: 'userId', status: 'status', amountCents: 'amountCents', createdAt: 'createdAt' },
```

### errorMessage cap test
`syncPayouts` caps errorMessage at first 3 errors joined by `'; '`.
Test with 4 payouts where adapter throws — verify `result.errorMessage?.split('; ').length === 3`.
Need `mockReturnValueOnce` for each of the 4 entityMap checks (one per payout).

## G10 Cron Route — CRON_SECRET protected GET

### Pattern for plain `Request` (not `NextRequest`)
The cron route handler takes `Request`, not `NextRequest`. Use `new Request(url, { method: 'GET', headers })`.
Do NOT import from `next/server` for the test helper.

### timingSafeEqual length check
When `expected.length !== actual.length`, the route returns 401 before calling `timingSafeEqual`.
Test the length-mismatch case explicitly (e.g., `'Bearer x'` is shorter than the real secret).

### DB query chain for integrations (no .limit)
Integrations query ends at `.where()` — use `makeSelectChainNoLimit`.

## G10.2 ai-webhook + notifyAuthResult

### Pre-existing breakage in ai-webhook.test.ts (as of G10.2)
The route was updated to fetch a listing title for notifications (lines 82-87 in route.ts).
The OLD `ai-webhook.test.ts` only mocks ONE `mockDbSelect` call per test. This causes
`TypeError: Cannot read properties of undefined (reading 'from')` for the second select.

The NEW `ai-webhook-notify.test.ts` correctly mocks TWO selects:
1. `chainSelect([AI_PENDING_REQ])` — auth request lookup
2. `chainSelect([LISTING_ROW])` — listing title lookup

Tests for AUTHENTICATED need THREE selects (auth request, listing, certUrl sub-query).

### notifyAuthResult mock in ai-webhook tests
```typescript
vi.mock('@/lib/authentication/auth-notifier', () => ({
  notifyAuthResult: (...args: unknown[]) => mockNotifyAuthResult(...args),
}));
```
notifyAuthResult is called with `void` (fire-and-forget), so it won't block the response.
The test still passes because the mock resolves synchronously.

Also need:
```typescript
vi.mock('@/lib/authentication/cost-split', () => ({
  calculateAuthCostSplit: vi.fn().mockReturnValue({ buyerShareCents: 500, sellerShareCents: 1499 }),
}));
```

### certUrl sub-query in AUTHENTICATED path
The AUTHENTICATED branch does a `.then()` sub-query on the certUrl. Mock as:
```typescript
{
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  then: vi.fn().mockImplementation((resolve) =>
    Promise.resolve([{ verifyUrl: 'https://twicely.co/verify/TW-ABC' }]).then(resolve),
  ),
}
```

## G10.2 auth-notifier unit tests

### Template key verification
Test each of the 3 result types against their expected template key — explicit string match, not `expect.any(String)`.

### buyerId === sellerId — single notify
Implementation skips buyer notify when `buyerId === sellerId`. Verify `mockNotify` called once.

### Error suppression
`notifyAuthResult` catches all errors and logs them. Test:
1. `mockNotify.mockRejectedValue(new Error(...))`
2. `await expect(notifyAuthResult(...)).resolves.toBeUndefined()`
3. `expect(mockLoggerError).toHaveBeenCalledWith('[notifyAuthResult] ...', expect.objectContaining({ result: 'AUTHENTICATED' }))`
