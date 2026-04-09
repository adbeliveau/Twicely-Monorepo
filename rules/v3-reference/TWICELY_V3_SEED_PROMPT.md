# TWICELY V3 — Comprehensive Seed Prompt

**Purpose:** Instructions for Claude Code to create a complete seed script that populates the development database with realistic, interconnected demo data covering all features.

---

## EXECUTION RULES

1. Clear ALL existing data before seeding (truncate cascade)
2. All operations idempotent — running seed twice produces same result
3. Use Drizzle ORM insert operations, not raw SQL
4. All IDs are CUID2 (use `createId()`)
5. All money in cents
6. All timestamps in UTC with timezone
7. Password hash: use Better Auth's password hashing for all demo accounts
8. Respect all foreign key constraints — insert in dependency order

---

## DEMO ACCOUNTS

### Admin
| Email | Password | Role |
|-------|----------|------|
| adrian@twicely.co | Twicely123! | SUPER_ADMIN |

### Staff (hub.twicely.co)
| Email | Password | Roles |
|-------|----------|-------|
| sarah@twicely.co | Demo123! | ADMIN, FINANCE |
| mike@twicely.co | Demo123! | SUPPORT, MODERATION |
| lisa@twicely.co | Demo123! | HELPDESK_LEAD |
| james@twicely.co | Demo123! | HELPDESK_AGENT |
| dev@twicely.co | Demo123! | DEVELOPER, SRE |

### Sellers (19 marketplace users, all also buyers)

| Username | Seller Type | Store Tier | Lister Tier | Finance Tier | Automation | Perf Band | Specialty |
|----------|-----------|-----------|------------|-------------|-----------|----------|----------|
| vintagefinds | BUSINESS | PRO | PRO | PRO | ✅ | TOP_RATED | Vintage clothing |
| sneakerking | BUSINESS | POWER | PRO | PRO | ✅ | TOP_RATED | Sneakers, luxury |
| closetcleanout | PERSONAL | NONE | FREE | FREE | ❌ | EMERGING | Casual, closet clear |
| techdeals | BUSINESS | PRO | LITE | FREE | ❌ | ESTABLISHED | Electronics |
| luxuryresale | BUSINESS | POWER | PRO | PRO | ✅ | TOP_RATED | Handbags, jewelry |
| thriftflip | PERSONAL | STARTER | LITE | FREE | ❌ | EMERGING | Thrifted items |
| gamecollector | BUSINESS | STARTER | LITE | FREE | ✅ | ESTABLISHED | Video games, TCG |
| kidsstyle | PERSONAL | NONE | FREE | FREE | ❌ | EMERGING | Kids clothing |
| homegoods | BUSINESS | PRO | PRO | PRO | ✅ | ESTABLISHED | Home decor |
| bookworm | PERSONAL | STARTER | LITE | LITE | ❌ | EMERGING | Books, media |
| designerdeal | BUSINESS | PRO | POWER | PRO | ✅ | TOP_RATED | Designer clothing |
| sportsgear | BUSINESS | STARTER | LITE | FREE | ❌ | EMERGING | Sports equipment |
| watchlover | BUSINESS | POWER | PRO | PRO | ✅ | TOP_RATED | Luxury watches |
| craftmaker | PERSONAL | NONE | FREE | FREE | ❌ | EMERGING | Handmade items |
| electronicsplus | BUSINESS | PRO | PRO | PRO | ✅ | ESTABLISHED | Phones, laptops |
| retroretro | BUSINESS | STARTER | LITE | FREE | ✅ | EMERGING | Retro/vintage |
| newmom | PERSONAL | NONE | NONE | FREE | ❌ | EMERGING | Baby items (slow shipper) |
| suspendeduser | BUSINESS | NONE | NONE | FREE | ❌ | SUSPENDED | Suspended for counterfeits |
| vacationseller | BUSINESS | STARTER | LITE | FREE | ❌ | EMERGING | On vacation mode |

All seller emails: `{username}@demo.twicely.co`, password: `Demo123!`

### Pure Buyers (3 accounts that only buy)
| Username | Email | Buyer Quality | Notes |
|----------|-------|--------------|-------|
| happybuyer | happy@demo.twicely.co | GREEN | Good buyer, no issues |
| returnking | returns@demo.twicely.co | YELLOW | Frequent returner |
| problematic | problem@demo.twicely.co | RED | Disputed 5+ orders |

---

## LISTINGS (50+ across all categories)

### Category Distribution
- Apparel & Accessories: 15 listings (various sellers)
- Electronics: 10 listings
- Collectibles & Luxury: 8 listings (sneakerking, luxuryresale, watchlover)
- Home & General: 7 listings (homegoods, craftmaker)
- Books & Media: 5 listings (bookworm, gamecollector)
- Kids: 3 listings (kidsstyle, newmom)
- Sports: 2 listings (sportsgear)

### Listing States
- 35 ACTIVE listings
- 5 SOLD listings (with completed orders)
- 3 PAUSED listings
- 2 DRAFT listings
- 3 ENDED listings
- 2 REMOVED listings (enforcement)

### Special Listings
- 3 listings with `fulfillmentType: SHIP_AND_LOCAL`
- 2 listings with `fulfillmentType: LOCAL_ONLY`
- 2 listings with authentication badges (EXPERT_AUTHENTICATED)
- 5 listings with boosting enabled (2-6% rates)
- 3 listings with offers enabled + auto-accept/decline thresholds
- 2 listings imported from eBay (`importedFromChannel: EBAY`)

---

## ORDERS (10+ at various statuses)

| Order | Buyer | Seller | Status | Special |
|-------|-------|--------|--------|---------|
| 1 | happybuyer | vintagefinds | COMPLETED | Has review |
| 2 | returnking | techdeals | REFUNDED | Return: BUYER_REMORSE |
| 3 | happybuyer | sneakerking | COMPLETED | Authenticated (expert) |
| 4 | problematic | luxuryresale | DISPUTED | Active dispute |
| 5 | happybuyer | homegoods | SHIPPED | In transit |
| 6 | returnking | designerdeal | COMPLETED | Has review (3 stars) |
| 7 | closetcleanout | gamecollector | PAID | Processing |
| 8 | thriftflip | bookworm | COMPLETED | Local pickup |
| 9 | problematic | watchlover | CANCELED | Buyer canceled |
| 10 | happybuyer | electronicsplus | DELIVERED | Pending review |

---

## REVIEWS (6+)

| Order | Rating | Seller | Buyer | Trust Weight | Notes |
|-------|--------|--------|-------|-------------|-------|
| 1 | 5 | vintagefinds | happybuyer | 1.2 | High-value order |
| 3 | 5 | sneakerking | happybuyer | 1.5 | Authenticated item |
| 6 | 3 | designerdeal | returnking | 0.8 | Had dispute |
| 8 | 4 | bookworm | thriftflip | 1.0 | Local pickup |
| (seller review) | 5 | — | happybuyer | 1.0 | Seller reviewing buyer |
| (seller review) | 2 | — | problematic | 0.6 | Problematic buyer |

---

## SUBSCRIPTIONS

Create `storeSubscription`, `listerSubscription`, `financeSubscription` records for every seller with tier > NONE. All with status ACTIVE, current period start = 30 days ago, end = today + 30 days. Use fake Stripe subscription/price IDs: `sub_demo_xxx`, `price_demo_xxx`.

---

## PLATFORM SETTINGS (ALL 150+)

Seed all platform settings from:
- Pricing Canonical v3.2 (fee rates, tier prices, bundle prices)
- Buyer Protection Canonical (claim windows, limits)
- Local Canonical (fees, penalties, timeouts)
- Financial Center Canonical (mileage rate, categories, retention)
- Authentication settings
- Combined shipping settings
- Payout frequency settings
- General platform settings (listing limits, offer timing, etc.)

---

## ADDITIONAL DATA

### Categories (4 fee buckets, 15+ subcategories)
Seed complete category tree with `feeBucket` assignments and `categoryAttributeSchema` entries.

### Shipping Profiles
2-3 per active seller with various combined shipping modes.

### Addresses
1-2 per user. Default address set.

### Watchlist
happybuyer watching 5 listings. returnking watching 3.

### Browsing History
10 entries for happybuyer (various engagement levels).

### Price Alerts
2 price alerts for happybuyer (ANY_DROP, TARGET_PRICE).

### Safe Meetup Locations
5 locations in demo metro area (2 police stations, 2 retail, 1 community center).

### Expenses (Financial Center)
10 expense entries for vintagefinds (various categories, 3 recurring).
5 mileage entries for vintagefinds.

### Ledger Entries
Create ledger entries for all completed orders (TF, Stripe processing, boost fees where applicable).

---

## SEED FILE STRUCTURE

```
src/db/seed/
  index.ts           # Main entry point — runs all seeders in order
  seeders/
    01-staff.ts      # Staff users + roles
    02-users.ts      # Marketplace users
    03-sellers.ts    # Seller profiles + subscriptions
    04-categories.ts # Category tree + attributes
    05-listings.ts   # Listings + images + shipping profiles
    06-orders.ts     # Orders + shipments + ledger entries
    07-reviews.ts    # Reviews + seller performance
    08-offers.ts     # Active + expired offers
    09-returns.ts    # Return requests + disputes
    10-local.ts      # Local transactions + safe locations
    11-auth.ts       # Authentication requests + certificates
    12-finance.ts    # Expenses + mileage + reports
    13-engagement.ts # Watchlist, browsing history, price alerts
    14-settings.ts   # All platform settings
    15-notifications.ts # Sample notifications
```

Run with: `npx tsx src/db/seed/index.ts`
