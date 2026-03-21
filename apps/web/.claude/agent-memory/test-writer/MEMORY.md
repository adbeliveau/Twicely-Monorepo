# Test Writer - Agent Memory

## Patterns

### staffAuthorize mock pattern — include session object

`staffAuthorize` returns both `ability` AND `session`. Actions that reach the audit-event insertion path use `session.staffUserId`. Always mock both fields:

```typescript
vi.mock('@/lib/casl/staff-authorize', () => ({ staffAuthorize: vi.fn() }));

// Use a makeStaffAuth helper so every test gets both fields:
function makeStaffAuth(canManage = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canManage) },
    session: { staffUserId: 'staff-test-1', email: 'staff@example.com',
               displayName: 'Staff User', isPlatformStaff: true as const, platformRoles: [] as never[] },
  };
}
// Mocking only { ability } causes TypeError on session.staffUserId in audit event paths.
```

### Drizzle DB chain mocking — separate chains for multiple inserts
Use `mockReturnValueOnce` for each `db.insert()` call. Using `mockReturnValue` causes both calls to share the same chain object.

### Async import pattern for vi.resetModules()
```typescript
beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });
it('...', async () => { const { fn } = await import('../module'); });
```

### makeInsertReturningChain
```typescript
function makeInsertReturningChain(id: string) {
  return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id }]) }) };
}
```

### Chainable select mock (thenable pattern — for queries ending at .orderBy() without .limit())
```typescript
function makeSelectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(rows).then(resolve),
  };
  ['from','where','groupBy','orderBy','limit','offset','innerJoin','for'].forEach(k => {
    c[k] = vi.fn().mockReturnValue(c);
  });
  return c;
}
```

## Edge Cases Index

- Polling engine demoteTier: mock `getPlatformSetting` to `1` (1ms dwell) to force HOT→prePollTier path; 8-day lastPolledAt triggers COLD, 31-day triggers LONGTAIL
- Polling engine HOT→LONGTAIL: use separate captured `updateChain` to assert `set.mock.calls[0][0].pollTier === 'LONGTAIL'`
- `sale-polling-handler.ts`: tested separately in `handlers/__tests__/` not `polling/__tests__/`; uses `as unknown as ChannelProjection` (established pattern in crosslister tests)
- poll-executor: connector-not-wired path tested by making the account DB query throw `'No connector registered for channel: POSHMARK'`

- D4 Finance Center: see inline comments in finance-center test files
- D4.1 Expense Tracking: `createChain()` needs `'innerJoin'`; `getCogsSummaryAction` checks `Analytics` subject
- D4.2 OCR/Mileage: `vi.stubGlobal('fetch', mockFetch)` for OCR tests; mileage uses STORED ratePerMile on update
- D4.3 Reports: `getPnlReportData` = 7 selects; `getBalanceSheetData` = 9; `listReportsSchema` max pageSize = 50
- E1.3 Q&A: `pinQuestion` with `isPinned=false` skips pin count query; action imports from `@/lib/casl` re-export
- E1.4 Q&A components: CUID2 required for action IDs
- E2.2 Messaging: `(555) 123-4567` NOT matched by phone pattern (paren breaks `\b`)
- F4 Lister Subscriptions: see `f4-lister-subscriptions.md`

### sql tagged template .as() mock — dashboard queries

`sql\`...\`.as('alias')` calls fail if `sql` mock returns a plain object without `.as`. Fix:
```typescript
function makeSqlExpr(raw: string) {
  return { sql: raw, as: (alias: string) => ({ sql: raw, alias }) };
}
vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (tpl: TemplateStringsArray, ...vals: unknown[]) => makeSqlExpr(tpl.join(String(vals[0] ?? ''))),
    { as: vi.fn(), join: vi.fn((items: unknown[]) => ({ join: items })) }
  ),
  // ...rest of mock
}));
```
The `sql` export must be both a tagged template function AND have static methods (`.as`, `.join`).

### G9 Helpdesk Testing Notes

See [g9-helpdesk-patterns.md](g9-helpdesk-patterns.md) for full details. Key points:
- Job files use BullMQ — mock with `vi.hoisted()` for factory callbacks
- `createSavedView` uses `ability.can('read', 'HelpdeskSavedView')` (not 'manage')
- `helpdesk-signature.ts` uses HTML entity escaping (not tag stripping) — `\n` → `<br />`
- `enqueueHelpdeskRetentionPurge` passes 3 args to `queue.add`: (name, data, options) — test with `expect.objectContaining({ jobId: ... })`
- CASL helpdesk: AGENT can manage HelpdeskCase + read KB; LEAD+ manage macros; MANAGER manage teams/SLA/automation
- Automation engine uses ALL-match rule evaluation (not first-wins)

## General Rules

- G1-A personalization: `saveUserInterestsAction` validates schema BEFORE calling `authorize()` — so validation errors are returned even for unauthenticated users; test this ordering explicitly
- Duplicate slugs in tagSlugs array: DB returns 1 unique tag but array length is 2 → triggers "One or more interest tags are invalid" (no dedup in implementation)
- Zod `.strict()` on all schemas — extra fields always return Invalid input
- `authorize()` delegation: `session.delegationId` truthy → use `session.onBehalfOfSellerId` as userId
- Admin finance: amountCents must be positive integer — 0, negative, floats all return Invalid input
- Component logic tests: extract pure branches as local functions, test without React/DOM
- `createChain()` proxy must include `'innerJoin'` when testing queries that use joins
- `vi.stubGlobal('fetch', mockFetch)` for fetch-based tests (not `vi.mock`)

## File Splitting

- Hard limit is 250 lines per test file (task prompt), CLAUDE.md says 300 for production code
- Split by describe block — each file gets own complete mock setup
- Task instructions may explicitly allow test files to exceed 300 lines

## G1-B Seller Onboarding Notes

- `submitBusinessInfoAction` calls BOTH `getBusinessInfo` AND `getSellerProfile` — mock both for happy path tests
- Order in submitBusinessInfoAction: auth → CASL → schema parse → getBusinessInfo (duplicate check) → getSellerProfile (exists check) → transaction → audit
- `db.transaction` mock pattern: `mockTransaction.mockImplementation(async (cb) => { const tx = { insert: ..., update: ... }; await cb(tx); })`
- `vi.unmock('@/lib/validations/seller-onboarding')` needed to test real Zod behaviour in action tests that mock everything else
- `RESERVED_STORE_SLUGS` is exported from validations — loop over it in schema tests to verify all slugs are blocked
- updateStoreNameAction skips slug uniqueness check when `profile.storeSlug === storeSlug` (same slug reassignment is fine)

## G1-C Import Onboarding Notes

- `getImportOnboardingState` fires 3 queries in parallel (Promise.all): accounts, batches, profileRow — mock with 3 `mockReturnValueOnce` calls in that order
- `availableImportChannels` = ACTIVE accounts where `firstImportCompletedAt === null` (null check, not undefined)
- Channel display names come from real `channel-registry.ts` (EBAY → 'eBay', POSHMARK → 'Poshmark', MERCARI → 'Mercari') — use `vi.mock(..., async importOriginal => real)` to keep registry real while mocking DB
- `listerTier` falls back to `'NONE'` string (not enum) when `profileRow[0]` is undefined
- `ImportGuideBanner` uses `useState(false)` for `mounted` + `useEffect` for localStorage read — SSR guard: returns null when `!mounted`
- Banner dismiss key: `'twicely:import-guide-dismissed'` stored as `'true'` string
- Component tests use pure-logic extraction (Vitest env: node, no DOM, no RTL) — mirror guard clauses and text-building logic as plain functions

## Anthropic SDK Mock (G1.1 AI AutoFill)

Use a class (not `vi.fn().mockImplementation`) so `new Anthropic()` works. NEVER use `vi.resetModules()` with this mock — it breaks the constructor.

```typescript
const mockCreate = vi.fn(); // declare ONCE at module level

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

// Import the module under test at module level (no dynamic import per test)
import { analyzeListingImages } from '../ai-autofill-service';
// Use beforeEach(vi.clearAllMocks) + vi.stubGlobal('fetch', ...) + afterEach(vi.unstubAllGlobals)
```

### API Route testing (NextRequest)
```typescript
import { NextRequest } from 'next/server';
function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
// Import route handler at module level (not per-test dynamic import)
import { POST } from '../route';
```
No need to mock `next/server` — NextRequest works fine in Vitest node environment.

### next/headers cookies() mock with vi.hoisted (route handlers)
When the route calls `await cookies()` and then `.get()`, `.set()`, `.delete()` on the result:
```typescript
const { mockCookiesGet, mockCookiesSet, mockCookiesStore } = vi.hoisted(() => {
  const mockCookiesGet = vi.fn();
  const mockCookiesSet = vi.fn();
  const mockCookiesStore = { get: mockCookiesGet, set: mockCookiesSet, delete: vi.fn() };
  return { mockCookiesGet, mockCookiesSet, mockCookiesStore };
});
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookiesStore),
}));
```
Use `vi.resetAllMocks()` in `beforeEach` (not `vi.clearAllMocks`) so mock queues are cleared between tests. The `mockCookiesStore` reference in the vi.mock factory is safe because vi.hoisted runs before vi.mock.

### GET route testing (NextRequest with custom headers and query params)
```typescript
function makeRequest(code: string, opts: { forwardedFor?: string; query?: string } = {}): NextRequest {
  const url = `http://localhost:3000/path/${code}${opts.query ? `?${opts.query}` : ''}`;
  const headers: Record<string, string> = {};
  if (opts.forwardedFor) headers['x-forwarded-for'] = opts.forwardedFor;
  return new NextRequest(url, { headers });
}
```
For dynamic route params (Promise<{ code: string }>), pass `{ params: Promise.resolve({ code }) }` as the second argument.

### Query functions ending at orderBy (not limit) — static import pattern

For query functions that end their chain at `.orderBy()`, use static imports (not dynamic `await import()`) combined with a single module-level `mockDbSelect = vi.fn()`. Do NOT use `vi.resetModules()` in `beforeEach` for these tests — it causes re-import without the mock registry, making functions appear undefined.

The chainSelect helper must mock BOTH `orderBy` (resolves array) AND `limit` (resolves array) plus `from`/`where` returning `this`:
```typescript
function chainSelectOrderBy(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain['orderBy'] = vi.fn().mockResolvedValue(result);
  chain['limit'] = vi.fn().mockResolvedValue(result);
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  return chain;
}
```
Use static `import { getPartitionedFlags, ... } from '../module'` at the top.

### Real query API vs. expected (always read the file!)

The `admin-feature-flags.ts` query file was refactored to use `getPartitionedFlags()` (single DB query) instead of three separate `getKillSwitches()`, `getLaunchGates()`, `getRegularFlags()` calls. Always re-read the implementation file before writing tests — don't rely on test requirements or previous file readings.

### makeValuesChain helper (insert().values().returning())
See advanced-mock-patterns.md for full details. Short form:
```typescript
mockInsert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id }]) }) });
```

### H3.1 Shopify Connector patterns
See [h3-shopify-patterns.md](h3-shopify-patterns.md) for full details.
Key: authenticate tests cover empty-state, HTTP-200-with-error, schema rejection, shop-info-non-ok separately. revokeAuth: two no-op guard cases (null token, null shopDomain). healthCheck: null-token/null-shopDomain/fetch-throws all tested. buildAuthUrl: use `new URL(url).searchParams.get('scope')` for exact match.

## Mock Queue Contamination — Critical Rule

`vi.clearAllMocks()` does NOT clear `mockReturnValueOnce` queues. Use `vi.resetAllMocks()` in `beforeEach` when any test in the file sets up mocks that may not be consumed (e.g., early-return paths). Otherwise unconsumed `mockReturnValueOnce` stacks bleed into subsequent describe blocks.

**BUT**: `vi.resetAllMocks()` ALSO clears `mockResolvedValue` implementations set in `vi.mock()` factories (e.g., `getPlatformSetting: vi.fn().mockResolvedValue(30)`). After `vi.resetAllMocks()`, those return `undefined`.

**Fix when both patterns needed**: Declare mock functions with `vi.hoisted()` and call a `restoreMocks()` helper in `beforeEach` that re-applies stable return values after `resetAllMocks`. Example: [admin-data-retention-ext.test.ts](../../src/lib/actions/__tests__/admin-data-retention-ext.test.ts).

**Symptom**: test passes in isolation (`-t "test name"`) but fails in full-file run.
**Fix**: Change `vi.clearAllMocks()` to `vi.resetAllMocks()` in all `beforeEach` hooks.

### vi.mock factory hoisting — vi.hoisted() is the preferred pattern

`vi.mock` is hoisted before `const mockFn = vi.fn()` declarations. Use `vi.hoisted()` to declare mock functions before the hoist boundary:

```typescript
const { mockCouponsCreate, mockPromotionCodesCreate } = vi.hoisted(() => ({
  mockCouponsCreate: vi.fn(),
  mockPromotionCodesCreate: vi.fn(),
}));

vi.mock('../server', () => ({
  stripe: {
    coupons: { create: (...args: unknown[]) => mockCouponsCreate(...args) },
  },
}));
```

Alternatively, use wrapper lambdas directly in the factory (both work). Do NOT use module-level `const mockFn = vi.fn()` referenced directly in the factory object — causes "Cannot access before initialization". The linter auto-converts wrappers to `vi.hoisted()` style.

See [advanced-mock-patterns.md](advanced-mock-patterns.md) for: Zod ordering, G3/G4/G6 patterns, vi.hoisted rule, transaction mocks, listing-click route pattern.

## G8 GDPR Notes

- G8 test files: account-deletion-executor{,-pii,-edge}.test.ts + cleanup-{session,audit-archive,data-purge}.test.ts + cookie-consent.test.ts + data-export-enhanced.test.ts + admin-gdpr-dashboard.test.ts + gdpr/__tests__/pseudonymize.test.ts + components/__tests__/cookie-consent-banner-logic.test.ts
- Cookie banner tests (node env, no DOM): extract pure logic (parseConsentJson, isConsentFresh, buildConsentCookieValue) as local functions and test directly — document.cookie is not available in node env
- Account deletion executor: 3 test files (lifecycle, PII, edge). Edge cases: buyer-side blocker check (2nd query = seller orders, 3rd = buyer orders), ghost user (targetUser not found), idempotent check (second run with empty candidates)
- cleanup-audit-archive: "does NOT delete when R2 fails" — uploadToR2 throws → whole function rejects → db.execute not called
- admin-gdpr-dashboard: getGdprComplianceSummary uses Promise.all(4 selects) — all returning [{ c: 0 }] = empty state test

## H1.1 Browser Extension API Notes

See [h1-extension-patterns.md](h1-extension-patterns.md) for full details. Key points:
- Use `vi.resetModules()` + dynamic `await import('../route')` per test (env stubs must apply per-test)
- `detect/route.ts`: does NOT validate userId — only purpose — so absent userId + valid purpose → 200
- `heartbeat/route.ts`: DB error is caught by same try/catch as JWT verify → surfaces as 401 (not 500)
- `session/route.ts`: inner try/catch around DB → DB throws = 500; missing userId in payload = 403
- `callback/route.ts`: empty string `?token=` is falsy → 400 same as missing token
- Channel enum for session route: POSHMARK, FB_MARKETPLACE, THEREALREAL only (EBAY/VESTIAIRE rejected)

## H2.2 Whatnot BIN Crosslist Notes

See [h2-whatnot-patterns.md](h2-whatnot-patterns.md) for full details. Key points:
- `delistListing` has 3 idempotent success paths: HTTP 404, userErrors containing 'already'/'not found', `result.errors` array containing 'not found'
- `createListing` has 2 additional failure guards: `data:null` → 'No response data' (retryable:true), `listing.id:null` → 'No listing ID returned' (retryable:true)
- `executeGraphQL`: 200 OK + unparseable body → `{ data:null, errors:null }` (NOT an error condition)
- `verifyListing`: quantity from `firstVariant?.inventoryQuantity ?? 1`; `lastModifiedAt:null` when updatedAt invalid/null
- Connector tests use `global.fetch = mockFetch` at module level + `await import('../whatnot-connector')` per test
