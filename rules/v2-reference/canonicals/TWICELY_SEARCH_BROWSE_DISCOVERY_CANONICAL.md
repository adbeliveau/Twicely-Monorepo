# TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md
**Status:** LOCKED (v1.1)  
**Scope:** Search, browse, ranking, filtering, indexing, and discovery behavior.  
**Audience:** Backend, frontend, search, data, and AI agents.  
**Non-Goal:** This document does NOT prescribe a specific search engine (Elastic, OpenSearch, DB, etc.).

---

## 1. Purpose

This canonical defines **how buyers discover listings** in Twicely:
- search
- browse
- filters
- ranking
- suppression

It ensures discovery is:
- predictable
- fair
- abuse-resistant
- consistent across surfaces

If discovery behavior is not defined here, it **must not exist**.

---

## 2. Core Principles

1. **Buyer intent first**  
   Relevance > seller preferences > monetization.

2. **Search is deterministic**  
   Same inputs produce the same ordered results (within freshness windows).

3. **Eligibility before ranking**  
   Listings must pass eligibility gates *before* ranking.

4. **Separation of concerns**  
   Indexing, eligibility, ranking, and presentation are independent stages.

5. **No dark patterns**  
   Sponsored content is always explicitly labeled.

6. **Trust integration is gated and configurable**  
   Seller trust affects discovery only through the trust pipeline defined in:
   `TWICELY_RATINGS_TRUST_CANONICAL.md`.

---

## 3. Discovery Surfaces

### 3.1 Supported Surfaces (v1)

| Surface | Description |
|---|---|
| Keyword Search | Text-based buyer queries |
| Category Browse | Hierarchical category navigation |
| Filtered Results | Attribute-based narrowing |
| Seller Storefront | Seller-specific inventory |
| Related Listings | Contextual discovery |

---

## 4. Eligibility Rules (Hard Gates)

A listing is **eligible for discovery** only if ALL conditions are met:

```ts
function isDiscoveryEligible(listing: Listing): boolean {
  return (
    listing.status === "ACTIVE" &&
    listing.inventoryAvailable > 0 &&
    listing.requiredAttributesComplete === true &&
    listing.enforcementState === "CLEAR"
  );
}
```

### 4.1 Disqualifiers
- not ACTIVE
- quantity = 0
- missing required category attributes
- paused, ended, removed, or sold
- trust & safety restriction

Disqualified listings MUST NOT be indexed or returned.

---

## 5. Indexing Contract

### 5.1 Indexed Fields (v1)

| Field | Purpose |
|---|---|
| title | keyword relevance |
| description | long-text relevance |
| categoryPath | browse + filtering |
| priceCents | sorting |
| createdAt | freshness |
| updatedAt | recency |
| attributes | filters |
| sellerId | storefront |
| condition | filtering |
| tags | optional relevance boost |

### 5.2 Indexing Triggers

Index updates MUST occur on:
- listing activation
- price change
- quantity change
- attribute change
- enforcement action
- relist
- removal
- seller trust eligibility changes (hard gate events)

---

## 6. Search Query Processing

### 6.1 Normalization
- lowercase
- trim whitespace
- remove stop words
- tokenize phrases
- normalize plurals

### 6.2 Query Types
- exact phrase
- partial match
- attribute-assisted (e.g., size, brand)

---

## 7. Ranking Model (v1.1)

### 7.1 Ranking Signals

| Signal | Weight | Notes |
|---|---|---|
| Text relevance | HIGH | title > description |
| Category match | HIGH | exact > parent |
| Freshness | MEDIUM | decay over time |
| Price competitiveness | MEDIUM | relative to category |
| Seller trust | LOW→MED | **applied as gated multiplier** (see §8) |
| Engagement | LOW | views, saves (capped) |

> Engagement signals are capped to prevent runaway dominance.

---

## 8. Trust & Ratings Integration (Direct Hook)

Trust is integrated via a **two-step mechanism**:
1) **Hard gate** seller eligibility (remove from results)
2) **Soft multiplier** applied after relevance scoring

All thresholds, decay, bands, and cap-only rules live in:
`TWICELY_RATINGS_TRUST_CANONICAL.md` (source of truth).

### 8.1 Hard gate stage (seller eligibility)
Before relevance ranking, each listing must pass:
- `isSellerSearchEligible(...)` from the trust canonical

If seller is ineligible:
- listing is removed from results
- listing MUST NOT be indexed for discovery where practical

### 8.2 Soft multiplier stage (ranking modifier)
After relevance scoring, apply:
- `final = relevanceScore * trustMultiplier`

Where:
- `trustMultiplier` is computed using the trust canonical’s settings snapshot
- cap-only behavior is enforced (new sellers are not demoted below neutral)

```ts
function finalScore(relevanceScore: number, trustMultiplier: number) {
  return relevanceScore * trustMultiplier;
}
```

---

## 9. Ranking Pipeline (Simplified)

```ts
function rankListings(listings: Listing[], query: SearchQuery): Listing[] {
  return listings
    .filter(isDiscoveryEligible)
    .filter(l => isSellerSearchEligibleFromTrust(l.sellerTrust)) // hard gate
    .map(l => ({
      listing: l,
      relevance: computeRelevance(l, query),
      trustMultiplier: computeTrustMultiplierFromTrust(l.sellerTrust),
    }))
    .sort((a, b) => (b.relevance * b.trustMultiplier) - (a.relevance * a.trustMultiplier))
    .map(r => r.listing);
}
```

---

## 10. Default Sort Orders

### 10.1 Search Results
- Best Match (default)
- Price: Low → High
- Price: High → Low
- Newest
- Oldest

### 10.2 Category Browse
- Best Match (default)
- Newly Listed
- Price: Low → High

---

## 11. Filters & Facets

### 11.1 Global Filters
- price range
- condition
- category
- seller

### 11.2 Category-Specific Filters
Defined by category schema:
- size
- brand
- color
- material
- gender

Filters must:
- be ANDed (intersection)
- be idempotent
- never override eligibility rules

---

## 12. Pagination & Limits

- Page-based pagination (v1)
- Stable ordering across pages
- Hard cap per page (e.g., 50)

```ts
type SearchPage = {
  results: Listing[];
  page: number;
  pageSize: number;
  totalResults: number;
};
```

---

## 13. Sponsored Content (Future-Safe)

### 13.1 Rules
- Sponsored listings must already be eligible (listing + seller trust)
- Sponsored placement is additive, not substitutive
- Clear visual labeling required
- Sponsored ranking never overrides filters

> If sponsorship is disabled, pipeline behavior is unchanged.

---

## 14. Browse Behavior

### 14.1 Category Landing
- Top-level categories show:
  - eligible listings only
  - aggregated facets
  - featured attributes

### 14.2 Empty States
- Clear messaging
- Suggestions to broaden filters
- No dead ends

---

## 15. Storefront Discovery

Seller storefront search:
- filters seller’s own eligible listings
- same eligibility + ranking rules
- no cross-seller mixing

---

## 16. Suppression & Enforcement

### 16.1 Suppression Types
- soft suppression (ranking penalty) — trust settings may create multipliers, but do not “hide” unless gated
- hard suppression (removal from index)

### 16.2 Authority
- Only Trust & Safety may suppress
- All suppression actions are audited

---

## 17. Abuse & Gaming Protections

- Title keyword stuffing detection
- Attribute mismatch detection
- Rapid relist throttling
- Duplicate listing detection

Abusive listings may be:
- suppressed
- removed
- escalated

---

## 18. Observability Requirements

Search system must emit:
- query latency
- result counts
- zero-result rate
- indexing lag
- suppression counts
- trust gating removals (count + reason band)

Feeds into Platform Health.

---

## 19. RBAC & Permissions

**Authorization:** All discovery and search settings are governed by **PlatformRole** only.

| Action | Required Role |
|---|---|
| View discovery metrics | PlatformRole.ADMIN \| PlatformRole.DEVELOPER |
| Suppress listing | PlatformRole.ADMIN \| PlatformRole.MODERATION |
| Modify ranking weights | PlatformRole.ADMIN |
| Modify trust settings | PlatformRole.ADMIN |

**Note:** Do NOT use invented permission keys like `analytics.read`, `trust.enforce`, or `trust.settings.write`. Use PlatformRole authorization only.

---

## 20. Out of Scope

- Personalization by user profile (future)
- AI recommendations (future)
- Ads bidding engine
- International search

---

## 21. Final Rule

Discovery must always favor:
**valid inventory → buyer intent → fairness → transparency**.

If behavior is not defined here, it must:
- be rejected, or
- be added as a new canonical version.
