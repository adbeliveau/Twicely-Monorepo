# TWICELY V3 — Smart Cart Prompts (Planned — Post-Launch Wave 1)

**Version:** v1.0 | **Date:** 2026-04-08 | **Status:** PLANNED (post-launch Wave 1, first 30–90 days)
**Source:** Ported from Twicely V2
- `TWICELY_ORDERS_FULFILLMENT_CANONICAL.md` § 6 (business rules)
- `TWICELY_V2_INSTALL_PHASE_3_ORDERS_SHIPPING.md` lines 3485–3525 (schema)

**Scope:** Self-contained to cart/checkout. Does NOT touch payments, ledger, orders, or state machines.

---

## 1. WHY POST-LAUNCH (not pre-launch)

This is an additive conversion feature. Even though it's cheap (~1 week), it's **still scope creep against a frozen launch**. Ship it in Wave 1 after the core commerce flows have run clean in production for 30+ days.

**Why do it at all:** proven conversion lifter across marketplaces. Mono's current cart canonical has no equivalent prompting system.

---

## 2. CORE MODEL

```typescript
// Drizzle schema

export const cartPromptTypeEnum = pgEnum("cart_prompt_type", [
  "FREE_SHIPPING_THRESHOLD",   // "Add $X more for free shipping"
  "BUNDLE_AVAILABLE",          // "Bundle these for 15% off"
  "QUANTITY_DISCOUNT",         // "Buy 3, get 10% off"
  "SELLER_PROMO",              // Seller-specific promotion
  "RELATED_ITEMS",             // "Frequently bought together"
]);

export const cartPrompts = pgTable("cart_prompts", {
  id: text("id").primaryKey(),
  cartId: text("cart_id").notNull(),

  promptType: cartPromptTypeEnum("prompt_type").notNull(),

  headline: text("headline").notNull(),       // "Add $4.20 for FREE SHIPPING!"
  subtext: text("subtext"),
  ctaText: text("cta_text").notNull(),        // "View items"

  targetSellerId: text("target_seller_id"),
  targetListingIds: text("target_listing_ids").array().default([]),
  targetBundleId: text("target_bundle_id"),

  currentAmountCents: integer("current_amount_cents"),
  targetAmountCents: integer("target_amount_cents"),
  savingsAmountCents: integer("savings_amount_cents"),

  priority: integer("priority").default(0),
  isDismissed: boolean("is_dismissed").default(false),
  isActedUpon: boolean("is_acted_upon").default(false),  // analytics

  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (t) => ({
  cartIdx: index("cart_prompt_cart_idx").on(t.cartId, t.isDismissed),
  expiresIdx: index("cart_prompt_expires_idx").on(t.expiresAt),
}));
```

---

## 3. GENERATION RULES

1. **Max 3 prompts per cart** at a time (configurable platform setting)
2. **Sorted by priority** descending — higher priority = shown first
3. **Refresh on every cart change** — add item, remove item, quantity update → regenerate
4. **Expire after 24 hours** — cron-swept
5. **Dismissed prompts never reappear** for the same cart
6. **Acted-upon prompts** are tracked separately for analytics (did the buyer click CTA?)

### Priority convention (from V2)
- Bundle available: **15** (highest — biggest savings)
- Free shipping threshold: **10**
- Quantity discount: **10**
- Seller promo: **5**
- Related items: **1**

Tune by conversion data post-launch.

---

## 4. GENERATION LOGIC

Pseudocode — port from V2 `TWICELY_ORDERS_FULFILLMENT_CANONICAL.md` § 6.3:

```typescript
async function generatePrompts(cart: Cart): Promise<CartPrompt[]> {
  const prompts: CartPrompt[] = [];
  const sellerItems = groupBySeller(cart.items);

  for (const [sellerId, items] of sellerItems) {
    const sellerTotal = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

    // 1. FREE_SHIPPING_THRESHOLD
    const profile = await getShippingProfile(sellerId);
    if (profile?.domesticFreeShippingAbove && sellerTotal < profile.domesticFreeShippingAbove) {
      prompts.push({
        promptType: "FREE_SHIPPING_THRESHOLD",
        headline: `Add $${((profile.domesticFreeShippingAbove - sellerTotal) / 100).toFixed(2)} more for FREE SHIPPING!`,
        subtext: "From this seller",
        ctaText: "View more items",
        targetSellerId: sellerId,
        currentAmountCents: sellerTotal,
        targetAmountCents: profile.domesticFreeShippingAbove,
        savingsAmountCents: profile.domesticFirstItemCents,
        priority: 10,
      });
    }

    // 2. BUNDLE_AVAILABLE
    const bundles = await getApplicableBundles(sellerId, items.map(i => i.listingId));
    for (const { bundle, qualifies, missingListings } of bundles) {
      if (!qualifies && missingListings.length <= 2) {
        prompts.push({
          promptType: "BUNDLE_AVAILABLE",
          headline: `Add ${missingListings.length} more for ${bundle.discountValue}% off!`,
          subtext: bundle.name,
          ctaText: "Complete bundle",
          targetBundleId: bundle.id,
          targetListingIds: missingListings,
          priority: 15,
        });
      }
    }

    // 3. QUANTITY_DISCOUNT — if listing has tiered pricing
    // 4. SELLER_PROMO — if seller has active promo code
    // 5. RELATED_ITEMS — if cart qualifies for cross-sell
  }

  // Sort by priority and cap at 3
  prompts.sort((a, b) => b.priority - a.priority);
  return prompts.slice(0, 3);
}
```

---

## 5. INTEGRATION POINTS

| System | How it integrates |
|---|---|
| Cart service | Call `generatePrompts(cart)` after every mutation |
| Shipping profile service | Read `domesticFreeShippingAbove` for FREE_SHIPPING_THRESHOLD |
| Bundle service (if Mono has it) | Read applicable bundles for BUNDLE_AVAILABLE |
| Listing service | Read quantity tiers for QUANTITY_DISCOUNT |
| Promo service | Read active seller promos for SELLER_PROMO |
| Recommendations service | Cross-sell suggestions for RELATED_ITEMS |
| Centrifugo realtime | Push new prompts to cart UI without page reload |
| Analytics | Track `prompt.impression`, `prompt.click`, `prompt.dismiss`, `prompt.conversion` |

**Does NOT integrate with:**
- Payments service
- Order creation
- Ledger
- State machines
- Webhook system

That's the point — it's a view layer on top of the cart, not a change to the commerce primitives.

---

## 6. UI SURFACE

- Single "Smart Suggestions" strip at the top of the cart page
- Max 3 visible at a time, horizontally scrollable on mobile
- Each prompt has: headline, subtext (optional), CTA button, dismiss X
- Dismiss action is one-tap, irreversible per cart, persisted to DB
- Click CTA → deep link to relevant seller page / listing / bundle

---

## 7. ANALYTICS

Track per prompt type:
- **Impressions** — how many times rendered
- **Dismissals** — how many times X'd out
- **Clicks** — how many times CTA tapped
- **Conversions** — attributed uplift (did buyer add the suggested item, reach threshold, etc)

Grafana dashboard: prompt type × conversion rate over time. Tune priority constants based on data.

---

## 8. MONO-SPECIFIC ADAPTATION

| Concern | V2 Pattern | Mono Adaptation |
|---|---|---|
| Schema | Prisma | Drizzle (Section 2) |
| Realtime updates | Polling | Centrifugo push on cart mutation |
| Queue | None | BullMQ worker for expiry cleanup (hourly) |
| Analytics | Custom | Grafana + Prometheus counters |
| Feature flag | Phase 9 | Gate behind `cart.smart_prompts` flag, enable to 10% → 50% → 100% |

---

## 9. OUT OF SCOPE (v1)

- AI-generated prompt copy (use static templates)
- Personalized prompts by buyer history
- Cross-seller prompts (all prompts are seller-scoped)
- Email reminder prompts (that's cart abandonment, separate feature)
- Mobile push prompts

---

## 10. COMPLETION CRITERIA

- [ ] `cartPrompts` table migrated (Drizzle)
- [ ] `cartPromptTypeEnum` added
- [ ] `generatePrompts(cart)` service implemented (start with just FREE_SHIPPING_THRESHOLD and BUNDLE_AVAILABLE)
- [ ] Cart mutation hook regenerates prompts
- [ ] Expiry cleanup cron (BullMQ)
- [ ] Cart UI renders suggestions strip
- [ ] Dismiss action persists
- [ ] Analytics events fire for impression/click/dismiss/conversion
- [ ] Feature flag `cart.smart_prompts` gates the feature
- [ ] Grafana dashboard for conversion tuning

---

## 11. REFERENCE

- Full business rules: `Twicely-V2/rules/canonicals/New folder/TWICELY_ORDERS_FULFILLMENT_CANONICAL.md` § 6
- V2 Prisma schema: `Twicely-V2/rules/install-phases/TWICELY_V2_INSTALL_PHASE_3_ORDERS_SHIPPING.md` lines 3485–3525
- V2 generation logic full: same Phase 3 file around lines 3840–3950

Scanned and imported 2026-04-08 as part of V2 → Mono gap analysis.
