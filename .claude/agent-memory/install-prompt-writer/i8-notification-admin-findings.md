# I8 Notification Admin - Findings

## Scope
- 3 hub pages: /notifications (enrich), /notifications/[id] (new), /notifications/new (new)
- 4 server actions (create, update, delete, toggle)
- 3 query functions + Zod schemas
- 2 client components (editor, toggle)
- ~41 tests across 3 test files

## Key Facts
- `notificationTemplate` table already exists in `src/lib/db/schema/notifications.ts` (§10.4)
- 19 seed templates in `seed-notifications.ts` (offers, orders, watchlist, search, subscription, returns, disputes, protection, shipping)
- `Notification` CASL subject already exists (subjects.ts line 17)
- Permission registry has read/create/update/delete on Notification (permission-registry-data.ts lines 229-238)
- ADMIN gets `can('manage', 'all')` via `definePlatformAdminAbilities` — no CASL changes needed
- Nav entry exists in admin-nav.ts (key: notifications, href: /notifications, roles: ['ADMIN'])
- Existing stub page at /notifications/page.tsx: counts templates, checks `ability.can('read', 'Notification')`

## Schema Details
- `key`: unique, text, stable identifier (e.g., 'order.confirmed')
- `category`: free text, not enum ('offers', 'orders', 'watchlist', etc.)
- `channels`: text array, valid values: EMAIL, PUSH, IN_APP, SMS
- `isSystemOnly`: boolean, prevents deletion
- `htmlTemplate`: nullable, for rich email version

## Design Decisions
- Template `key` is immutable after creation (code references by key)
- System-only templates cannot be deleted but CAN be deactivated
- ADMIN-only (not DEVELOPER) per admin-nav.ts
- No notification sending/preview (future scope)
- Category filter populated dynamically from distinct DB values

## Spec Gaps
- Page Registry only lists /notifications, not /[id] or /new (documentation gap, consistent with KB)
- notifications.* vs comms.* settings key inconsistency (known, not relevant to I8)
