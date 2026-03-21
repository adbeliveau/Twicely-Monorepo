# A5: Seed Script

## What This Is

Seed script that populates the database with system reference data + demo data for development. Idempotent — run twice, same result.

## Scope

Two categories of seed data:

### System Data (required for the app to function)

1. **Categories** — 4 top-level matching fee buckets + leaf subcategories
2. **Fee schedules** — 1 per fee bucket with rates from spec
3. **Sequence counters** — order_number, case_number
4. **Staff user** — 1 SUPER_ADMIN for hub.twicely.co

### Demo Data (for B-phase development)

5. **Marketplace users** — 3 buyer-only, 3 sellers
6. **Seller profiles** — 3 (2 PERSONAL, 1 BUSINESS)
7. **Business info** — 1 (for the BUSINESS seller)
8. **Addresses** — 1 per marketplace user
9. **Listings** — 50 ACTIVE across leaf categories
10. **Listing images** — 1 placeholder per listing
11. **Orders** — 10 in various statuses with order items

### NOT in A5 scope (seeded in later phases)

- Helpdesk teams, routing rules, SLA policies (Phase E)
- Notification templates (Phase E)
- Platform settings (added per-phase as needed)
- Provider adapters (Phase E+)

---

## File Structure

```
src/lib/db/seed.ts                     — Entry point, orchestrates seeders
src/lib/db/seed/seed-system.ts         — Categories, fee schedules, sequence counters, staff user
src/lib/db/seed/seed-users.ts          — 6 marketplace users + seller profiles + business info + addresses
src/lib/db/seed/seed-listings.ts       — 50 listings + images
src/lib/db/seed/seed-orders.ts         — 10 orders + order items
```

5 files total. No file over 300 lines. No other files created.

---

## package.json Script

Add to scripts:

```json
"db:seed": "tsx src/lib/db/seed.ts"
```

Install tsx as a dev dependency if not already present:

```bash
pnpm add -D tsx
```

---

## Password Hashing

Marketplace users need password hashes in the `account` table. Before writing any seed code:

1. Query the existing account record: `SELECT password FROM account LIMIT 1;`
2. Examine the hash format (Better Auth uses scrypt or argon2)
3. Use the SAME hashing approach in the seed script

If Better Auth uses Node.js `scrypt`, the seed should use `crypto.scryptSync`. If it uses argon2, import `@node-rs/argon2`. Match the exact format — salt encoding, hash encoding, separator character, etc.

All demo users use password: `DemoPass123!`

---

## Idempotency

Use Drizzle's `.onConflictDoNothing()` on every insert. All seed records use hardcoded CUID2 IDs so the same seed can run multiple times without duplicating data.

Generate IDs once and hardcode them as constants. Do NOT use `createId()` in the seed — that generates random IDs each run, breaking idempotency.

Pattern:

```typescript
await db.insert(someTable).values([...]).onConflictDoNothing();
```

---

## Existing User

There is an existing user in the database: adrian@twicely.co (ID: XNEUhcyqOnO22BHoAXqER3QGfKZuBqRd). Do NOT touch this user. Do NOT create seed data that conflicts with this ID or email.

---

## DATA SPECIFICATIONS

### Categories (16 total: 4 top-level + 12 leaf)

| Top-Level | Fee Bucket | Leaf Categories |
|-----------|-----------|-----------------|
| Electronics | ELECTRONICS | Phones & Tablets, Computers & Laptops, Cameras & Photo |
| Apparel & Accessories | APPAREL_ACCESSORIES | Women's Clothing, Men's Clothing, Shoes & Sneakers |
| Home & Garden | HOME_GENERAL | Kitchen & Dining, Furniture, Garden & Outdoor |
| Collectibles & Luxury | COLLECTIBLES_LUXURY | Trading Cards, Watches & Jewelry, Designer Handbags |

- Top-level categories: `isLeaf: false`, `depth: 0`, `parentId: null`
- Leaf categories: `isLeaf: true`, `depth: 1`, `parentId: <parent ID>`
- Slugs: lowercase hyphenated (e.g., `phones-tablets`, `womens-clothing`)
- Path: materialized (e.g., `electronics.phones-tablets`)
- All `isActive: true`, `sortOrder` sequential per level.

### Fee Schedules (4 rows)

| Fee Bucket | FVF Rate % | Insertion Fee (cents) | effectiveAt |
|-----------|-----------|---------------------|------------|
| ELECTRONICS | 9.0 | 25 | 2026-01-01T00:00:00Z |
| APPAREL_ACCESSORIES | 10.0 | 25 | 2026-01-01T00:00:00Z |
| HOME_GENERAL | 10.0 | 25 | 2026-01-01T00:00:00Z |
| COLLECTIBLES_LUXURY | 11.5 | 25 | 2026-01-01T00:00:00Z |

`createdByStaffId` = the SUPER_ADMIN staff user ID.

### Sequence Counters (2 rows)

| Name | Prefix | Current Value | Padded Width |
|------|--------|--------------|-------------|
| order_number | ORD- | 0 | 6 |
| case_number | HD- | 0 | 6 |

### Staff User (1 row)

Table: `staff_user`

- email: admin@hub.twicely.co
- displayName: Platform Admin
- passwordHash: Hash of `AdminPass123!` (use bcrypt — staff_user is NOT Better Auth managed)
- mfaEnabled: false
- isActive: true

Table: `staff_user_role` (1 row)

- role: SUPER_ADMIN

Use `bcryptjs` (install as dep if not present) for staff_user password. Staff auth is separate from Better Auth marketplace auth.

### Marketplace Users (6 rows in `user` + 6 rows in `account`)

| # | Email | Name | isSeller | Username | Role |
|---|-------|------|----------|----------|------|
| 1 | buyer1@demo.twicely.co | Emma Thompson | false | emma_t | Buyer only |
| 2 | buyer2@demo.twicely.co | James Wilson | false | james_w | Buyer only |
| 3 | buyer3@demo.twicely.co | Sofia Garcia | false | sofia_g | Buyer only |
| 4 | seller1@demo.twicely.co | Mike's Electronics | true | mikes_electronics | PERSONAL seller |
| 5 | seller2@demo.twicely.co | Sarah's Closet | true | sarahs_closet | PERSONAL seller |
| 6 | seller3@demo.twicely.co | Vintage Vault LLC | true | vintage_vault | BUSINESS seller |

All users: `emailVerified: true`, `buyerQualityTier: 'GREEN'`, `isBanned: false`, `marketingOptIn: false`

For each user, also insert into `account` table:

- `userId`: matching user ID
- `providerId`: 'credential'
- `accountId`: same as user ID
- `password`: hashed `DemoPass123!` (same format as Better Auth uses)

### Seller Profiles (3 rows)

| User | Seller Type | Store Tier | Lister Tier | Performance Band | Status |
|------|------------|-----------|------------|-----------------|--------|
| seller1 (Mike) | PERSONAL | NONE | FREE | STANDARD | ACTIVE |
| seller2 (Sarah) | PERSONAL | NONE | LITE | STANDARD | ACTIVE |
| seller3 (Vintage) | BUSINESS | BASIC | PLUS | ABOVE_STANDARD | ACTIVE |

All: `payoutsEnabled: false`, `stripeOnboarded: false`, `vacationMode: false`, `handlingTimeDays: 3`, `trustScore: 80`

Store names match user names. Store slugs: `mikes-electronics`, `sarahs-closet`, `vintage-vault`

### Business Info (1 row — for seller3 only)

- businessName: Vintage Vault LLC
- businessType: LLC
- address1: 456 Commerce Ave
- city: Austin
- state: TX
- zip: 78701
- country: US

### Addresses (6 rows — 1 per marketplace user)

Give each user a distinct US address. Keep them realistic (real city/state/zip combos). Set `isDefault: true` for all.

### Listings (50 rows)

Distribute across the 3 sellers and 12 leaf categories:

- seller1 (Mike): 20 listings (mostly Electronics)
- seller2 (Sarah): 15 listings (mostly Apparel)
- seller3 (Vintage): 15 listings (mix of Collectibles + Home)

All listings:

- `status: 'ACTIVE'` (except 9 that become SOLD — see Orders section)
- `enforcementState: 'CLEAR'`
- `quantity: 1`, `availableQuantity: 1`, `soldQuantity: 0` (adjusted for sold items)
- `currency: 'USD'`
- `freeShipping: false`
- `allowOffers: false` (except ~10 listings set to true with autoAcceptOfferCents/autoDeclineOfferCents)
- `autoRenew: true`

Prices: realistic range $15–$500 (stored as cents). Each listing needs a unique `slug` (URL-friendly, derived from title). Titles should be realistic for the category (e.g., "iPhone 14 Pro Max 256GB Space Black" not "Test Listing 1").

Give each listing a `condition` from the enum. Mix them: mostly LIKE_NEW and VERY_GOOD with some NEW_WITH_TAGS and GOOD.

Set `activatedAt` to a random date in the past 30 days. Set `createdAt` and `updatedAt` to the same value as `activatedAt`.

Use `tags` sparingly — 2-3 tags per listing as a text array.

### Listing Images (50 rows — 1 per listing)

- `url`: `https://placehold.co/800x800/eee/999?text=<category>` (use the leaf category slug)
- `position: 0`
- `isPrimary: true`
- `width: 800`, `height: 800`
- `altText`: same as listing title

### Orders (10 rows + order items)

Buyers purchase from sellers. Each order has 1 item (keep it simple).

| # | Buyer | Seller | Status | Notes |
|---|-------|--------|--------|-------|
| 1 | buyer1 | seller1 | PAID | Awaiting shipment, within handling time |
| 2 | buyer2 | seller1 | PAID | Awaiting shipment, LATE (isLateShipment: true) |
| 3 | buyer1 | seller2 | PROCESSING | Being prepared |
| 4 | buyer3 | seller2 | SHIPPED | Has tracking number |
| 5 | buyer2 | seller3 | IN_TRANSIT | Has tracking URL |
| 6 | buyer1 | seller3 | DELIVERED | Delivered, protection window open |
| 7 | buyer3 | seller1 | COMPLETED | Completed normally |
| 8 | buyer2 | seller2 | COMPLETED | Completed normally |
| 9 | buyer1 | seller3 | CANCELED | cancelInitiator: 'BUYER', cancelReason: 'Changed my mind' |
| 10 | buyer3 | seller3 | RETURN_REQUESTED | Return in progress |

Order numbers: ORD-000001 through ORD-000010. Update the sequence counter's `currentValue` to 10.

For each order:

- `orderNumber`: ORD-XXXXXX
- `itemSubtotalCents`: from the listing's priceCents
- `shippingCents`: random 500–1200
- `taxCents`: 0 (no tax engine yet)
- `discountCents`: 0
- `totalCents`: itemSubtotal + shipping
- `currency: 'USD'`
- `handlingDueDays: 3`
- `shippingAddressJson`: buyer's address as JSON

Set appropriate lifecycle timestamps per status:

- **PAID**: set paidAt
- **PROCESSING**: set paidAt
- **SHIPPED**: set paidAt + shippedAt + trackingNumber
- **IN_TRANSIT**: set paidAt + shippedAt + trackingNumber + trackingUrl
- **DELIVERED**: set paidAt + shippedAt + deliveredAt
- **COMPLETED**: set paidAt + shippedAt + deliveredAt + completedAt
- **CANCELED**: set canceledAt + cancelInitiator + cancelReason
- **RETURN_REQUESTED**: set paidAt + shippedAt + deliveredAt

For the LATE order (#2): set `expectedShipByAt` to 2 days ago, `isLateShipment: true`
For order #4: `trackingNumber: '9400111899223033005282'`
For order #5: `trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223033005282'`

### Order Items (10 rows — 1 per order)

Each order item references one of the 50 seed listings. Pick listings that match the seller on the order. Store a `listingSnapshotJson` with `{ title, priceCents, condition }`.

### Sold Listings (9 of 50)

Any order that's PAID or beyond means the listing is sold. That's orders 1–8 and 10. Only order 9 (CANCELED) didn't sell.

9 of the 50 listings should be `status: 'SOLD'`, `soldQuantity: 1`, `availableQuantity: 0`, `soldAt` set to the order's paidAt. The other 41 stay ACTIVE.

---

## Entry Point: src/lib/db/seed.ts

```typescript
import { seedSystem } from './seed/seed-system';
import { seedUsers } from './seed/seed-users';
import { seedListings } from './seed/seed-listings';
import { seedOrders } from './seed/seed-orders';
import { db } from './index';  // your Drizzle db instance — check the actual export path

async function main() {
  console.log('🌱 Starting seed...');

  console.log('  → System data (categories, fees, sequences, staff)...');
  await seedSystem(db);

  console.log('  → Users (buyers, sellers, profiles, addresses)...');
  await seedUsers(db);

  console.log('  → Listings (50 listings + images)...');
  await seedListings(db);

  console.log('  → Orders (10 orders + items)...');
  await seedOrders(db);

  console.log('✅ Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
```

Each seed function receives the Drizzle `db` instance. Each function handles its own idempotency via `onConflictDoNothing()`.

---

## Rules

1. All IDs are hardcoded string constants (not generated at runtime). Use realistic CUID2-style strings or simple descriptive IDs like `'seed-buyer-1'`, `'seed-seller-1'`, etc.
2. No file over 300 lines.
3. No `as any`. No `@ts-ignore`. No `@ts-expect-error`. No eslint-disable comments.
4. Every insert uses `.onConflictDoNothing()`.
5. Import schema tables from the existing schema files in `src/lib/db/schema/`.
6. Do NOT modify any existing files except `package.json` (to add the db:seed script and tsx dep).
7. Do NOT create any files beyond the 5 listed above.
8. Show full terminal output for every command.
9. Explain every fix in plain English.

---

## Verification

Run in order, show FULL output:

1. `pnpm db:seed` — should complete without errors
2. `pnpm db:seed` — run AGAIN to prove idempotency
3. `npx tsc --noEmit` — zero errors
4. `pnpm lint` — zero warnings
5. `pnpm build` — clean build

Then show counts to verify:

```sql
SELECT 'users' as tbl, count(*) FROM "user"
UNION ALL SELECT 'sellers', count(*) FROM seller_profile
UNION ALL SELECT 'categories', count(*) FROM category
UNION ALL SELECT 'listings', count(*) FROM listing
UNION ALL SELECT 'orders', count(*) FROM "order"
UNION ALL SELECT 'order_items', count(*) FROM order_item
UNION ALL SELECT 'staff', count(*) FROM staff_user;
```

Expected counts (minimum — adrian's existing user adds 1 to users):

- users: 7 (6 seed + 1 existing)
- sellers: 3
- categories: 16
- listings: 50
- orders: 10
- order_items: 10
- staff: 1

---

## Checkpoint

BEFORE declaring done, save checkpoint:

```bash
tar -cf ../twicely-a5-seed.tar --exclude=node_modules --exclude=.next --exclude=.git .
```

Do not skip this. Do not forget. Do it before you say "done."
