# TWICELY V3 — Personalization & Interest System Canonical

**Version:** v1.0 | **Date:** 2026-02-19 | **Status:** LOCKED
**Tagline:** "Twicely is the platform you make it."

> **Implementation Strategy:** Silent data collection begins in Phase B3. UI ships behind `PERSONALIZATION_ENABLED` feature flag in Phase G. No dual-maintenance. No premature optimization.

---

## 1. PHILOSOPHY

Twicely has everything, but nobody wants everything. The platform must feel like a single-category marketplace built for each buyer — while never restricting access to anything.

Three personas, same platform, three different experiences:

| Persona | What Their Twicely Feels Like |
|---------|-------------------------------|
| 19-year-old streetwear buyer | Depop-like feed — sneakers, vintage tees, trending badges, social proof |
| 45-year-old electronics collector | Spec tables, authentication badges, price comparisons, condition grades |
| Mom shopping kids' clothes | Size guides, condition ratings, seller reliability, bundle deals |

**The personalization IS the platform's identity.** Not a feature. Not an add-on. The answer to "what is Twicely?" is "whatever you need it to be."

---

## 2. THE THREE LAYERS

### Layer 1: Content Curation (What You See)

Your interests determine which listings surface on the homepage "For You" feed, in notifications, and in recommendations. This is the noise filter.

- A fashion buyer's homepage shows only fashion
- An electronics buyer's homepage shows only electronics
- Full catalog always accessible via Explore and Categories tabs

### Layer 2: Presentation Adaptation (How You See It)

Different interest profiles get different visual emphasis on listing cards. Same data, different prominence.

- Fashion buyers → lifestyle photos, watcher count, trending badges
- Electronics buyers → specs, condition grade, retail price comparison
- Collectibles buyers → authentication badges, rarity, market value trend

### Layer 3: Discovery Behavior (How You Interact)

The platform respects **current intent**, not just profile.

- **Search** always shows everything. No interest filtering.
- **Categories** always show everything. No interest filtering.
- **"For You" feed** is personalized. This is the only filtered view.
- The user is **never locked in a box**.

---

## 3. INTEREST TAGS

Interest tags are curated by Twicely. They are NOT user-generated. They cross-cut the category tree.

### Tag Properties

| Property | Description |
|----------|-------------|
| slug | Unique identifier: `streetwear`, `vintage`, `gaming` |
| label | Display name: "Streetwear", "Vintage", "Gaming" |
| group | Parent domain: `fashion`, `electronics`, `home`, `collectibles`, `lifestyle` |
| imageUrl | Lifestyle image for onboarding picker |
| categoryIds | Maps to existing category table IDs (one tag → many categories) |
| attributes | Optional JSONB filters (e.g., `condition=vintage` for the "Vintage" tag) |
| cardEmphasis | Which listing card variant buyers in this interest see |

### Cross-Cut Behavior

Tags are NOT 1:1 with categories. They span:

| Tag | Categories It Spans | Why |
|-----|---------------------|-----|
| Vintage | Fashion, Home Decor, Collectibles | "Vintage" is an era, not a category |
| Gaming | Electronics, Collectibles | Gaming PCs AND Pokémon cards |
| Sneakers | Fashion > Shoes, Collectibles | Worn shoes AND rare unworn Jordans |
| Y2K | Fashion, Accessories | Aesthetic that crosses sub-categories |
| Sustainable | Fashion, Home | Buyer value, not product type |

### Card Emphasis Values

| Value | Use When Buyer's Top Interest Group Is | Prominent Fields |
|-------|---------------------------------------|-----------------|
| `social` | fashion | Lifestyle photo, watcher count, trending badge, "Hot" label |
| `specs` | electronics | Product photo, retail price comparison, condition grade, auth badge |
| `collectible` | collectibles | Detail photo, market value trend, rarity, "1 of N on Twicely" |
| `default` | home, lifestyle, mixed | Standard: photo, title, price, condition, shipping |

Computed from the user's highest-weighted interest group. Falls back to `default` for new users or ties.

### Seed Tags (Initial Set — 30+)

**Fashion:** Streetwear, Vintage Fashion, Designer, Y2K, Activewear, Sustainable Fashion, Plus Size, Luxury, Kids & Baby Fashion, Denim, Outerwear

**Electronics:** Smartphones, Gaming Hardware, Audio, Cameras, Computers, Smart Home, Wearable Tech

**Home:** Home Decor, Kitchen, Outdoor & Garden, Furniture, Vintage Home

**Collectibles:** Trading Cards, Vinyl Records, Sneaker Collecting, Watches, Art, Coins & Currency, Sports Memorabilia, Funko & Figures

**Lifestyle:** Books, Fitness, Beauty, Musical Instruments, Crafts & DIY

Tags can be added over time via admin. No code changes needed — just `interestTag` table inserts.

---

## 4. ONBOARDING PICKER

### Design

Full-screen visual grid. NOT checkboxes. Large lifestyle images with short labels. Tap to select (highlight with brand purple border), tap again to deselect.

- **Prompt:** "What brings you to Twicely?"
- **Minimum:** 2 selections
- **Maximum:** No limit
- **Target time:** 10 seconds
- **Skippable:** Yes — "Skip for now" link at bottom

### Skip Behavior

If user skips onboarding:
- Homepage shows generic trending feed (Explore tab behavior)
- System learns from behavior instead (clicks, purchases, watchlist)
- Settings page shows "You haven't picked any interests yet — want to personalize your feed?"
- No degraded experience. No nag screens. Just a suggestion.

### Route

Part of `/my/selling/onboarding` flow (G1) for sellers. For buyers, shown on first homepage visit after signup as an interstitial overlay (not a separate page — dismissable).

---

## 5. HOMEPAGE: FOR YOU + CONTEXT SWITCHING

### Three Tabs (Persistent at Top)

| Tab | Default? | Content | Personalized? |
|-----|----------|---------|---------------|
| **For You** | Yes (if interests exist) | Interest-weighted listings + social follows + watchlist drops | Yes |
| **Explore** | Yes (if no interests) | Trending across ALL categories. Staff picks. Seasonal. | No — algorithmic but universal |
| **Categories** | No | Traditional category tree. Always complete. | No — full catalog |

### "For You" Feed Sections (in priority order)

1. **New from sellers you follow** — social override, no interest filtering
2. **Price drops on watchlist** — urgency, no interest filtering
3. **Matched listings** — interest-weighted, most relevant first
4. **Boosted listings** — only those matching interests (monetization, never pollutes)

### "Explore" Feed Sections

1. **Trending Now** — highest velocity items across all categories
2. **Staff Picks** — editorially curated (admin tool)
3. **Seasonal** — time-based features (back to school, holiday, etc.)
4. **Rising Sellers** — new sellers with early traction

### "Categories" Tab

Standard category tree. Electronics → Phones → iPhones. Identical to `/c/` route behavior. No personalization. Full catalog.

### Guest Users (Not Logged In)

See Explore tab by default. No "For You" available. Categories always accessible.

---

## 6. SIGNAL WEIGHTING & DECAY

### Signal Table

| Action | Weight | Decay Period | Expires After |
|--------|--------|-------------|---------------|
| Explicit pick (onboarding/settings) | 10.0 | Never | NULL (permanent until removed) |
| Purchase matching interest | 2.0 | Linear | 90 days |
| Purchase off-interest | 0.5 | Linear | 30 days |
| Watchlist add | 0.5 | Linear | 60 days |
| Listing click (>5 sec dwell) | 0.1 | Linear | 14 days |
| Search query | 0.05 | Linear | 7 days |
| Browse category page | 0.0 | N/A | N/A — browsing does NOT signal |
| Follow a seller | 0.0 | N/A | N/A — handled by social feed, not interest weight |

### Weight Stacking

A user can have multiple signals for the same tag from different sources. Weights SUM.

Example: User explicitly picked "Sneakers" (10.0) + purchased sneakers twice (2.0 × 2) + watched 5 sneaker listings (0.1 × 5) = total weight 14.5 for "Sneakers".

### The Gift-Buying Problem (Solved)

"I'm a fashion buyer. I bought my husband a bluetooth speaker. Will my feed change?"

**No.** One off-interest purchase = 0.5 weight, decays in 30 days. Their explicit fashion interests total 20+ weight. The electronics signal is noise that auto-clears. No "gift mode" needed. No "pause personalization" toggle. The math handles it.

### Decay Implementation

- `expiresAt` column on `userInterest` table
- Nightly cron job: `DELETE FROM userInterest WHERE expiresAt IS NOT NULL AND expiresAt < NOW()`
- Explicit picks have `expiresAt = NULL` — never deleted by cron
- No gradual decay (V1 simplification). Signal is full weight until expiry, then gone.

---

## 7. SETTINGS PAGE

### Route: `/my/settings/interests`

### Layout

**Section 1 — Active Interests**
Tags the user explicitly selected. Displayed as removable chips. Tap X to remove.

**Section 2 — Suggested (Behavioral)**
Interests the system inferred from behavior (purchases, clicks) but user hasn't explicitly added. Shows if any behavioral signal weight > 1.0. Displayed as addable chips. Tap + to confirm as explicit.

**Section 3 — All Interests**
Full list grouped by domain (Fashion, Electronics, Home, Collectibles, Lifestyle). Collapsed by default. Expand to browse and add.

**Section 4 — Reset**
"Reset feed" button. Clears ALL behavioral signals (source != EXPLICIT). Keeps explicit picks. Confirmation dialog: "This will reset your feed recommendations based on your activity. Your selected interests will stay. Continue?"

### Interest Removal Behavior

When a user removes an explicit interest:
- Delete the EXPLICIT row from `userInterest`
- Behavioral signals for that tag remain (they'll decay naturally)
- Feed updates on next homepage load

---

## 8. SEARCH & CATEGORY BEHAVIOR

### Search (Critical — No Filtering)

Search ALWAYS returns results across all categories. Interest weights are NOT applied to search ranking. If a fashion buyer searches "bluetooth speaker," they see bluetooth speakers. Period.

Search does record a behavioral signal (0.05 weight) for the matched interest tags of results the user clicks. But the search results themselves are unfiltered.

### Category Browsing (Critical — No Filtering)

Category pages (`/c/*`) ALWAYS show all listings in that category. No interest filtering. No re-ranking. Standard sort (relevance, price, date) applies.

Category browsing adds ZERO behavioral signal. Categories are for exploration. The system does not learn from exploration.

### Why This Matters

If search or categories were filtered by interests, users would feel trapped. The personalization promise is: "We show you what matters on the homepage. Everything else is always one tap away." Breaking that promise destroys trust.

---

## 9. SOCIAL OVERRIDE — FOLLOWING

When a user follows a seller, that seller's new listings appear in "For You" **regardless of interest match**. This is the social override.

Rules:
- Following does NOT add interest weight. It's a separate feed source.
- Unfollowing removes the seller from the social section of "For You" immediately.
- A fashion buyer who follows a seller that also sells electronics WILL see those electronics listings in their feed. This is intentional — "I trust this seller" crosses categories.
- Social listings appear in Section 1 of the "For You" feed (highest priority).

This creates the Instagram-like experience: feed = algorithmic curation + social graph.

---

## 10. BOOSTED LISTINGS IN PERSONALIZED FEED

Boosted listings (seller-paid promotion) appear in "For You" BUT only if they match at least one of the buyer's interests.

Rules:
- A boosted electronics listing does NOT appear in a fashion-only buyer's "For You" feed
- Boosted listings appear in Section 4 (lowest priority in "For You")
- Boosted listings ALWAYS appear in "Explore" tab (not interest-filtered)
- 30% max promoted in search results (existing rule) is unaffected
- Attribution window remains 7 days (existing rule)

This means boosting is more effective when targeted — sellers boost in categories where buyers exist. Natural market signal.

---

## 11. NOTIFICATIONS INTEGRATION

When `PERSONALIZATION_ENABLED = true`:

| Notification Type | Interest-Filtered? |
|-------------------|-------------------|
| "New listings you might like" digest | Yes — only matching interests |
| Price drop on watchlist | No — always sent |
| New listing from followed seller | No — always sent (social override) |
| Order updates | No — transactional |
| Offer updates | No — transactional |

The daily/weekly digest email only includes listings matching the user's interest profile. This prevents the "email full of irrelevant stuff" problem that kills engagement.

---

## 12. SCHEMA

### Table: `interestTag`

```typescript
export const interestTag = pgTable('interest_tag', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  group: varchar('group', { length: 50 }).notNull(), // fashion, electronics, home, collectibles, lifestyle
  imageUrl: varchar('image_url', { length: 500 }),
  description: varchar('description', { length: 200 }),
  categoryIds: text('category_ids').array(), // maps to category.id values
  attributes: jsonb('attributes'), // optional extra filters
  cardEmphasis: varchar('card_emphasis', { length: 50 }).notNull().default('default'), // social, specs, collectible, default
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Table: `userInterest`

```typescript
export const interestSourceEnum = pgEnum('interest_source', [
  'EXPLICIT',   // User picked in onboarding or settings
  'PURCHASE',   // Bought an item in this interest
  'WATCHLIST',  // Added item to watchlist
  'CLICK',      // Clicked listing with >5 sec dwell
  'SEARCH',     // Searched terms matching this interest
]);

export const userInterest = pgTable('user_interest', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tagSlug: varchar('tag_slug', { length: 50 }).notNull().references(() => interestTag.slug),
  weight: decimal('weight', { precision: 6, scale: 3 }).notNull().default('1.0'),
  source: interestSourceEnum('source').notNull(),
  expiresAt: timestamp('expires_at'), // NULL = never expires (explicit picks)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserTagSource: unique().on(table.userId, table.tagSlug, table.source),
  userIdIdx: index('idx_user_interest_user_id').on(table.userId),
  expiresAtIdx: index('idx_user_interest_expires_at').on(table.expiresAt),
}));
```

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_user_interest_user_id` | userId | Fast lookup for feed query |
| `idx_user_interest_expires_at` | expiresAt | Nightly decay job performance |
| `interest_tag_slug_unique` | slug (already unique) | FK lookups |
| `interest_tag_group_idx` | group | Settings page grouping |

---

## 13. FEED QUERY (V1 — NO ML)

```sql
WITH user_weights AS (
  SELECT tag_slug, SUM(weight) as total_weight
  FROM user_interest
  WHERE user_id = $1
    AND (expires_at IS NULL OR expires_at > NOW())
  GROUP BY tag_slug
)
SELECT l.*,
  COALESCE(MAX(uw.total_weight), 0) as relevance_score
FROM listing l
JOIN category c ON l.category_id = c.id
LEFT JOIN interest_tag it
  ON c.id = ANY(it.category_ids) AND it.is_active = true
LEFT JOIN user_weights uw ON uw.tag_slug = it.slug
WHERE l.status = 'ACTIVE'
GROUP BY l.id
ORDER BY
  relevance_score DESC,
  l.boosted_until DESC NULLS LAST,
  l.created_at DESC
LIMIT 40 OFFSET $2
```

No ML service. No recommendation engine. Pure SQL. The interests ARE the engine.

Performance note: With proper indexes, this query handles 100K+ active listings efficiently. If performance degrades at scale, materialize `user_weights` as a cached view refreshed hourly.

---

## 14. IMPLEMENTATION PHASES (PHASED ROLLOUT)

### What Gets Built When

| Component | Phase | Visible to User? | Feature Flag? | Notes |
|-----------|-------|-------------------|---------------|-------|
| Schema tables (interestTag, userInterest) | Next migration batch | No | No | Empty tables, zero cost |
| Seed interest tags (30+ tags) | Same migration | No | No | Data only |
| Signal: record PURCHASE in finalizeOrder | B3 (checkout) | No | No | One line insert after order completion |
| Signal: record WATCHLIST on watchlist add | B1 (when revisited) | No | No | One line insert |
| Signal: record CLICK on listing view | E1 | No | No | Background job, >5 sec dwell |
| Signal: record SEARCH on search query | E1 | No | No | Background job |
| Nightly decay job | E1 | No | No | Cron: delete expired signals |
| Onboarding interest picker | G1 | Yes | `PERSONALIZATION_ENABLED` | Full-screen visual grid |
| `/my/settings/interests` page | G1 | Yes | `PERSONALIZATION_ENABLED` | Settings page |
| Homepage "For You" tab + feed query | G1 | Yes | `PERSONALIZATION_ENABLED` | Default tab when flag=true |
| Homepage "Explore" tab | G1 | Yes | `PERSONALIZATION_ENABLED` | Replaces current homepage when flag=true |
| Card emphasis variants | G polish | Yes | `PERSONALIZATION_ENABLED` | Conditional CSS only |
| Notification digest filtering | Post-launch | Yes | `PERSONALIZATION_ENABLED` | Email content filtering |

### Feature Flag Behavior

**`PERSONALIZATION_ENABLED = false` (default through Phases B-F):**
- Homepage shows current generic feed (becomes "Explore" when flag flips)
- No onboarding picker shown
- No interest settings page visible
- Silent signal recording STILL RUNS — collecting data for future use
- No card emphasis variants — all cards use `default` layout

**`PERSONALIZATION_ENABLED = true` (flipped in Phase G when ready):**
- Homepage default tab becomes "For You" (personalized)
- Current homepage content moves to "Explore" tab
- Onboarding picker shown to new users
- Settings page visible
- Card emphasis active
- Months of pre-collected behavioral data immediately available

### Silent Signal Recording (B3+)

The key insight: by the time you flip the flag, you already have months of purchase, watchlist, and click data. The "For You" feed works from day one — no cold start problem.

**In finalizeOrder (B3 — checkout.ts):**
```typescript
// After order status updated to PAID
// Record purchase interest signal for each order item
for (const item of orderItems) {
  await recordPurchaseSignal(order.buyerId, item.categoryId);
}
```

**Helper function (lib/personalization/signals.ts):**
```typescript
import { db } from '@/lib/db';
import { userInterest, interestTag } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function recordPurchaseSignal(
  userId: string,
  categoryId: string
): Promise<void> {
  // Find interest tags that include this category
  const tags = await db
    .select({ slug: interestTag.slug })
    .from(interestTag)
    .where(
      and(
        eq(interestTag.isActive, true),
        sql`${categoryId} = ANY(${interestTag.categoryIds})`
      )
    );

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90-day decay for in-interest purchase

  for (const tag of tags) {
    await db
      .insert(userInterest)
      .values({
        userId,
        tagSlug: tag.slug,
        weight: '2.0',
        source: 'PURCHASE',
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [userInterest.userId, userInterest.tagSlug, userInterest.source],
        set: {
          weight: '2.0', // Reset weight on repeat purchase
          expiresAt, // Extend expiry
          updatedAt: new Date(),
        },
      });
  }
}
```

This function is safe to call even when `PERSONALIZATION_ENABLED = false`. It just writes rows. Nothing reads them until the flag is on.

---

## 15. WHAT THIS DOES NOT DO

Explicit exclusions to prevent scope creep:

| NOT This | Why |
|----------|-----|
| ML recommendation engine | V1 is pure SQL. ML is post-launch if ever. |
| Collaborative filtering ("users like you also bought") | Requires scale we don't have at launch |
| Interest-filtered search | Search is ALWAYS unfiltered. Non-negotiable. |
| Interest-filtered categories | Categories are ALWAYS unfiltered. Non-negotiable. |
| User-generated tags | Tags are platform-curated only. Prevents spam/noise. |
| "Shopping for a gift" mode | Signal decay handles this. No special mode needed. |
| "Pause personalization" toggle | Explore tab IS unpersonalized. One tap away. |
| Per-session interests | Overengineered. Tabs solve context switching. |
| Real-time feed updates | Feed refreshes on page load. No websocket push for new listings. |

---

## 16. SUCCESS METRICS (Post-Launch)

When `PERSONALIZATION_ENABLED` is flipped on, measure:

| Metric | Target | How |
|--------|--------|-----|
| "For You" engagement rate | >40% of homepage clicks go to "For You" listings | Analytics event |
| Interest completion rate | >60% of new users pick 2+ interests in onboarding | Onboarding funnel |
| Feed relevance (proxy) | Click-through rate on "For You" > "Explore" | A/B comparison |
| Noise reduction | Bounce rate decreases >10% vs pre-personalization | Analytics |
| Cross-category discovery | >5% of purchases are outside explicit interests | Purchase analysis |

---

## 17. DECISIONS LOG ENTRIES

| Decision | Ruling | Date |
|----------|--------|------|
| Personalization approach | Three-layer system: content curation, presentation adaptation, discovery behavior | 2026-02-19 |
| Interest tags are platform-curated, not user-generated | Prevents spam, maintains quality | 2026-02-19 |
| Search and categories are NEVER interest-filtered | Non-negotiable. Users must never feel trapped. | 2026-02-19 |
| Category browsing adds zero behavioral signal | Categories are for exploration, not intent | 2026-02-19 |
| Signal decay via expiresAt + nightly cron | Simple, no gradual decay in V1 | 2026-02-19 |
| Feature flag: PERSONALIZATION_ENABLED | Silent collection B3+, UI in G, flip when density exists | 2026-02-19 |
| Card emphasis: social/specs/collectible/default | Determined by buyer's highest-weighted interest group | 2026-02-19 |
| Homepage tabs: For You / Explore / Categories | Context switching via tabs, not settings or modes | 2026-02-19 |
| Following overrides interest filtering in feed | Social trust crosses categories | 2026-02-19 |
| Boosted listings respect interest filtering in For You | Boosted electronics won't pollute fashion feeds | 2026-02-19 |
| No ML in V1 | Pure SQL feed query. ML is post-launch if ever. | 2026-02-19 |
| Phased rollout: silent signals first, UI behind flag | Avoids dual-maintenance, collects data from day one | 2026-02-19 |
