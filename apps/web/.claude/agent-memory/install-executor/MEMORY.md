# Install Executor - Agent Memory

## H2.3 Whatnot Sale Webhook — Key Patterns (2026-03-19)

### Vitest: never reference outer const in vi.mock() factory
Vitest hoists `vi.mock()` calls above imports. If you write:
```typescript
const mockFn = vi.fn();
vi.mock('@/lib/db', () => ({ db: { select: mockFn } })); // WRONG — hoisting error
```
Fix: use `vi.fn()` inline in the factory, then get a reference via `vi.mocked()` after import:
```typescript
vi.mock('@/lib/db', () => ({ db: { select: vi.fn() } })); // correct
import { db } from '@/lib/db';
// then: vi.mocked(db.select).mockReturnValue(...)
```

### Zod v4: z.record() requires two arguments
In Zod v4 (project uses ^4.3.6), `z.record(z.unknown())` is a type error.
Must always be `z.record(z.string(), z.unknown())` — two arguments.

### Webhook route test pattern: vi.resetModules() in beforeEach
Route tests use dynamic `import('../route')` to get fresh module per test.
Add `vi.resetModules()` to `beforeEach` to prevent mock contamination across tests.

### Webhook signature verification: timing-safe comparison
HMAC verification pattern:
1. Read `crosslister.whatnot.webhookSecret` from platform_settings
2. If empty/missing → return `{ valid: false, error: 'Webhook secret not configured' }`
3. If signature empty → return `{ valid: false, error: 'Invalid signature' }`
4. Compute HMAC, buffers must be equal length for timingSafeEqual (returns false if lengths differ)

## I15 Settings Hub Enrichment — Key Patterns (2026-03-20)

### PlatformSettingSeed type: valid type values
`PlatformSettingSeed.type` accepts only: `'number' | 'string' | 'boolean' | 'cents' | 'bps' | 'array'`.
There is no `'json'` type — use `'array'` for JSON arrays, `'string'` for JSON objects.

### Vitest mock for `.where().orderBy().limit()` chain
When the query uses `.where().orderBy().limit()`, mock both paths:
```typescript
function makeSelectFromWhereLimit(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }),
        limit: vi.fn().mockResolvedValue(rows), // also mock without orderBy
      }),
    }),
  };
}
```

### Hub API routes pattern (staffAuthorize in API routes)
Pattern for hub-only API routes: wrap staffAuthorize in try/catch, return 401 on throw:
```typescript
let ability;
try {
  ({ ability } = await staffAuthorize());
} catch {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
if (!ability.can('read', 'Setting')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Route.ts for dynamic params in App Router (Next.js 15)
Next.js 15 uses `Promise<{ id: string }>` for dynamic params:
```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
```

## H3.4 Shopify Bidirectional Sync — Key Patterns (2026-03-20)

### Shopify HMAC: Base64 not hex
Shopify webhook HMAC uses `.digest('base64')`, not `.digest('hex')` like Whatnot.
Shopify uses `crosslister.shopify.clientSecret` (same as OAuth secret) — not a separate webhookSecret.

### loadShopifyConfig mock pattern
`loadShopifyConfig` in shopify-connector.ts uses `.select().from().where()` with NO `.limit()`.
The `.where()` call must be mocked to resolve directly (not via `.limit()`):
```typescript
vi.mocked(db.select).mockReturnValueOnce({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([  // no .limit() here
      { key: 'crosslister.shopify.apiVersion', value: '2024-01' },
    ]),
  }),
} as never);
```

### Type compatibility: ExternalDiffShape / SyncJobPayload for jsonb columns
Drizzle jsonb columns expect `Record<string, unknown>`. Custom interfaces need intersection type:
```typescript
type ExternalDiffShape = { /* fields */ } & Record<string, unknown>;
```

### ConnectorCapabilities cast to Record<string, unknown>
`ConnectorCapabilities` cannot be cast directly to `Record<string, unknown>`.
Use JSON round-trip: `JSON.parse(JSON.stringify(capabilities)) as Record<string, unknown>`.

### File size violations — pre-existing issue
As of H3.4 commit, 78 files are over 300 lines (includes 76 pre-existing).
Two H3.4 files are over: outbound-sync.ts (342) and shopify-connector.ts (312).
User MEMORY.md note: "Feedback: Don't Split Files" — user accepts violations over splitting.
Report but do not split.

### Outbound sync wiring
`detectOutboundSyncNeeded` + `queueOutboundSync` wired as fire-and-forget at end of `updateListing`
in `src/lib/actions/listings-update.ts`. Pattern: `.then().catch()` on the promise.

### File locations for H3.x
- Shopify schemas: `src/lib/crosslister/connectors/shopify-schemas.ts`
- Shopify types: `src/lib/crosslister/connectors/shopify-types.ts`
- Shopify normalizer: `src/lib/crosslister/connectors/shopify-normalizer.ts`
- Shopify connector: `src/lib/crosslister/connectors/shopify-connector.ts`
- Sale webhook handler (multi-platform): `src/lib/crosslister/handlers/sale-webhook-handler.ts`
- Shopify-specific handlers: `src/lib/crosslister/handlers/shopify-webhook-handlers.ts`
- Outbound sync service: `src/lib/crosslister/services/outbound-sync.ts`
- Webhook verify: `src/lib/crosslister/connectors/shopify-webhook-verify.ts`
- Webhook route: `src/app/api/crosslister/shopify/webhook/route.ts`
- Seed file: `src/lib/db/seed/seed-crosslister.ts`

## I17 Admin Sidebar Final Update — Key Findings (2026-03-20)

### Admin nav key files
- Nav registry: `src/lib/hub/admin-nav.ts` (406 lines — approved registry exception)
- Sidebar component: `src/components/admin/admin-sidebar.tsx` (ICON_MAP uses shorthand object syntax)
- Hub pages root: `src/app/(hub)/`

### Dispute rules double-segment path
`src/app/(hub)/mod/disputes/disputes/rules/page.tsx` → URL `/mod/disputes/disputes/rules`
The double "disputes" in the filesystem is intentional — nav href must be `/mod/disputes/disputes/rules`.

### Helpdesk page missing (deferred)
`src/app/(hub)/hd/page.tsx` does NOT exist. The nav item exists with `roles: [HELPDESK_AGENT...]`.
When writing filesystem tests for nav hrefs, exclude `/hd` from the page existence check.

### Icon regex for ICON_MAP extraction
Use `[A-Z][A-Za-z0-9]+` (not `[A-Z][A-Za-z]+`) — `BarChart2`, `ChevronDown` etc. have digits.

### I17 completion
Phase I: 17/17 complete. Tests: 9232 (was 9206, +26). TypeScript: 0 errors.
