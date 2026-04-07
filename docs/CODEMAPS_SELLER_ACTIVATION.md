# Seller Activation Codemap

**Last Updated:** 2026-04-06

**Entry Points:**
- `/apps/web/src/app/api/seller/activate/route.ts` (API route)
- `/apps/web/src/components/hub/hub-sidebar.tsx` (UI trigger)
- `/apps/web/src/lib/listings/seller-activate.ts` (Business logic)

---

## Architecture

```
User clicks "Start Selling" (hub-sidebar.tsx)
        ↓
GET /api/seller/activate/route.ts
        ↓
    Validate auth (getServerSession)
        ↓
    Call ensureSellerProfile(userId)
        ↓
    [seller-activate.ts]
        • Check if seller profile exists
        • If not: INSERT with status=ACTIVE, sellerType=PERSONAL
        • If exists but status=NULL: UPDATE to ACTIVE
        • Return profile
        ↓
    Redirect to /my/selling
        ↓
[selling/page.tsx] renders seller dashboard
        • Query seller stats (seller-dashboard.ts)
        • If listingCount === 0: show CTAs
        • CTAs: "List your first item" + "Set up storefront"
```

---

## Key Modules

| Module | Purpose | Exports | Dependencies |
|--------|---------|---------|--------------|
| `/apps/web/src/app/api/seller/activate/route.ts` | API endpoint for one-click activation | `GET()` route handler | `better-auth`, `ensureSellerProfile` |
| `/apps/web/src/lib/listings/seller-activate.ts` | Seller profile creation/activation logic | `ensureSellerProfile()` | `db`, `drizzle` |
| `/apps/web/src/lib/queries/seller-dashboard.ts` | Dashboard stats queries | `getSellerStats()`, `getSellerListings()` | `db`, `drizzle` |
| `/apps/web/src/components/hub/hub-sidebar.tsx` | Hub navigation sidebar | `HubSidebar` component | React, Next.js Link |
| `/apps/web/src/app/(hub)/my/selling/page.tsx` | Seller dashboard page | SSR page component | `seller-dashboard` queries, React |
| `/apps/web/src/components/shared/notification-bell.tsx` | Top-bar notification dropdown | `NotificationBell` component | Radix UI, React |

---

## Data Flow

### 1. Seller Profile Creation

**Function:** `ensureSellerProfile(userId: string)`

**Input:**
- `userId` — authenticated user's ID

**Database Operations:**
```sql
-- Check if profile exists
SELECT * FROM seller_profile WHERE user_id = $1

-- If not exists: INSERT
INSERT INTO seller_profile (user_id, status, seller_type, business_name, bio)
VALUES ($1, 'ACTIVE', 'PERSONAL', '', '')
RETURNING *

-- If exists but status IS NULL: UPDATE
UPDATE seller_profile
SET status = 'ACTIVE'
WHERE id = $1
```

**Output:**
```typescript
interface SellerProfile {
  id: string;
  userId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  sellerType: 'PERSONAL' | 'BUSINESS';
  businessName: string;
  bio: string;
  // ... other fields
}
```

### 2. Seller Stats Query

**Function:** `getSellerStats(userId: string)`

**Input:**
- `userId` — authenticated user's ID

**Database Operations:**
```sql
-- Get seller metrics
SELECT
  COUNT(*) as totalListings,
  COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeListings,
  SUM(COALESCE(sale_count, 0)) as totalSales,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN id END) as recentListings
FROM listings
WHERE seller_id = $1

-- Get seller performance
SELECT AVG(rating) as avgRating, COUNT(*) as totalReviews
FROM reviews
WHERE seller_id = $1
```

**Output:**
```typescript
interface SellerStats {
  totalListings: number;
  activeListings: number;
  totalSales: number;
  recentListings: number;
  avgRating: number | null;
  totalReviews: number;
}
```

### 3. API Route Flow

**Route:** `GET /api/seller/activate`

**Request:**
```http
GET /api/seller/activate
Authorization: Bearer <session-token>
```

**Response (Success):**
```http
302 Found
Location: /my/selling
```

**Response (Unauthorized):**
```http
401 Unauthorized
{
  "error": "Not authenticated"
}
```

**Response (Error):**
```http
500 Internal Server Error
{
  "error": "Failed to create seller profile"
}
```

---

## External Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `better-auth` | Authentication session | ^0.15 |
| `drizzle-orm` | Database queries | ^0.30 |
| `next` | Framework | ^15 |
| `react` | UI framework | ^19 |
| `@radix-ui/dropdown-menu` | Dropdown component | ^2.x |

---

## Database Schema

### Table: `seller_profile`

```typescript
seller_profile:
  • id: string (CUID2) — PK
  • userId: string — FK users.id (NOT NULL, UNIQUE)
  • status: enum ('ACTIVE' | 'INACTIVE' | 'SUSPENDED') — NOT NULL, DEFAULT 'ACTIVE'
  • sellerType: enum ('PERSONAL' | 'BUSINESS') — NOT NULL, DEFAULT 'PERSONAL'
  • businessName: string — VARCHAR(255), DEFAULT ''
  • bio: string — TEXT
  • averageRating: decimal(3,2) — NUMERIC(3,2), DEFAULT 0
  • totalReviews: integer — DEFAULT 0
  • totalSales: integer — DEFAULT 0
  • createdAt: timestamp — DEFAULT NOW()
  • updatedAt: timestamp — DEFAULT NOW()
```

### Related Tables

**`users`**
```typescript
• id: string — PK
• email: string — UNIQUE
• name: string
```

**`listings`**
```typescript
• id: string — PK
• sellerId: string — FK seller_profile.userId
• title: string
• status: enum ('ACTIVE' | 'SOLD' | 'DELISTED')
• createdAt: timestamp
```

---

## Route Integration

### Routing Context

**Public Routes (no auth required):**
- None — seller activation requires authentication

**Hub Routes (auth required):**
- `GET /api/seller/activate` — One-click activation (PRIVATE, authenticated users only)
- `GET /my/selling` — Seller dashboard (PRIVATE)

**Prefix:** Follows `/api/seller/*` convention from `TWICELY_V3_PAGE_REGISTRY.md`

---

## Authorization Model (CASL)

### Rules Applied

**For `GET /api/seller/activate`:**
```typescript
// User must be authenticated
ability.can('create', 'SellerProfile', { userId: currentUser.id })
```

**For `GET /my/selling`:**
```typescript
// User must own the seller profile
ability.can('read', 'SellerProfile', { userId: currentUser.id })
```

### Server-Side Checks

```typescript
// In route.ts
const session = await getServerSession();
if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// In page.tsx (server component)
const session = await getServerSession();
if (!session?.user?.id) redirect('/auth/login');
```

---

## Error Handling

| Error | Cause | Handler | Response |
|-------|-------|---------|----------|
| 401 Unauthorized | No session | `getServerSession()` returns null | Redirect to `/auth/login` |
| 500 Profile creation failed | DB error | try-catch in `ensureSellerProfile` | Return 500, log error |
| 500 Stats query failed | DB error | try-catch in `getSellerStats` | Return 500, log error |
| Hydration mismatch | Radix UI ID generation | `suppressHydrationWarning` prop | Silently ignore (safe) |

---

## Testing Coverage

| Test Suite | Coverage | Status |
|-----------|----------|--------|
| `seller-activate.test.ts` | ensureSellerProfile logic | ✅ |
| `seller-dashboard.test.ts` | Stats queries, date handling | ✅ |
| `api/seller/activate.test.ts` | Route authorization, redirects | ✅ |
| `hub-sidebar.test.tsx` | Navigation link rendering | ✅ |
| `selling/page.test.tsx` | CTA display logic (0 listings) | ✅ |

---

## Troubleshooting

### Issue: "Unauthorized" on `/api/seller/activate`

**Cause:** No active session

**Solution:**
1. Ensure user is logged in via `/auth/login`
2. Check session storage in browser
3. Verify cookie domain matches

### Issue: "Failed to create seller profile"

**Cause:** Database constraint violation

**Solution:**
1. Check user ID validity
2. Ensure no duplicate `seller_profile` for this user
3. Check PostgreSQL logs for constraint errors

### Issue: Hydration mismatch error in browser console

**Status:** Already fixed (`suppressHydrationWarning` added)

**If still occurring:**
1. Clear browser cache
2. Clear `.next` build directory
3. Rebuild: `pnpm build`

### Issue: Stats showing 0 even after listing items

**Cause:** Stale cache or query timing

**Solution:**
1. Revalidate cache: `revalidateTag('seller-stats')`
2. Check database for recent listings
3. Verify seller ID in query

---

## Performance Notes

### Query Optimization

- **Seller stats query** uses indexed `seller_id` column
- **Profile check** uses UNIQUE constraint on `userId` (indexed)
- All queries use prepared statements (Drizzle)
- No N+1 queries in dashboard page

### Caching Strategy

- Seller stats cached for 30 seconds (ISR)
- Profile data cached for 1 minute
- Cache invalidated on listing creation/deletion

### Load Metrics

- `/api/seller/activate`: <100ms (includes DB write)
- `/my/selling` page load: <500ms (including stats query)
- Notification bell dropdown: <50ms (client-side)

---

## Related Documentation

- **Feature Spec:** `TWICELY_V3_UNIFIED_HUB_CANONICAL.md` (Seller Activation section)
- **Page Registry:** `TWICELY_V3_PAGE_REGISTRY.md` (`/api/seller/*` routes)
- **Database Schema:** `TWICELY_V3_SCHEMA_v2_0_7.md` (`seller_profile` table)
- **Authorization Rules:** `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` (Seller capabilities)
- **Build Notes:** See `/docs/RECENT_CHANGES.md`

---

## Future Enhancements

- [ ] Email confirmation after seller activation
- [ ] Seller tier upgrade prompts on dashboard
- [ ] Onboarding checklist (complete profile, upload photo, etc.)
- [ ] Analytics tracking for activation funnel
- [ ] A/B test CTA button placement/copy

