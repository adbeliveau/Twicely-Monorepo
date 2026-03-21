import { pgTable, text, integer, index, unique, timestamp, real, jsonb, bigint } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { category } from './catalog';
import { listing } from './listings';

// §20.6 marketPricePoint
export const marketPricePoint = pgTable('market_price_point', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  source:            text('source').notNull(),             // 'TWICELY_NATIVE' | 'EBAY_SELLER' | 'EBAY_PUBLIC' | 'POSHMARK_SELLER' | 'MERCARI_SELLER'
  categoryId:        text('category_id').notNull().references(() => category.id),
  brand:             text('brand'),
  conditionBucket:   text('condition_bucket'),              // 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE'
  priceCents:        integer('price_cents').notNull(),
  shippingCents:     integer('shipping_cents'),
  soldAt:            timestamp('sold_at', { withTimezone: true }).notNull(),
  daysToSell:        integer('days_to_sell'),                // list-to-sell duration (null if unknown)
  platform:          text('platform'),                       // 'TWICELY' | 'EBAY' | 'POSHMARK' | 'MERCARI' | 'FACEBOOK'
  // NO seller ID, NO buyer ID — anonymized
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryBrandIdx:  index('mpp_cat_cond_brand_sold').on(table.categoryId, table.conditionBucket, table.brand, table.soldAt),
  soldAtIdx:         index('mpp_sold_at').on(table.soldAt),
  sourceIdx:         index('mpp_source').on(table.source),
}));

// §20.7 marketCategorySummary
export const marketCategorySummary = pgTable('market_category_summary', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:        text('category_id').notNull().references(() => category.id),
  brand:             text('brand'),                          // null = all brands in category
  conditionBucket:   text('condition_bucket'),                // null = all conditions
  periodType:        text('period_type').notNull(),           // 'DAILY' | 'WEEKLY' | 'MONTHLY'
  periodStart:       timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:         timestamp('period_end', { withTimezone: true }).notNull(),

  // Price stats
  sampleSize:        integer('sample_size').notNull(),
  medianPriceCents:  integer('median_price_cents').notNull(),
  avgPriceCents:     integer('avg_price_cents').notNull(),
  p25PriceCents:     integer('p25_price_cents').notNull(),
  p75PriceCents:     integer('p75_price_cents').notNull(),
  minPriceCents:     integer('min_price_cents').notNull(),
  maxPriceCents:     integer('max_price_cents').notNull(),

  // Sell-through stats
  avgDaysToSell:     integer('avg_days_to_sell'),
  medianDaysToSell:  integer('median_days_to_sell'),
  sellThroughRate:   real('sell_through_rate'),               // sold / (sold + expired) in period

  // Volume
  totalSoldCount:    integer('total_sold_count').notNull(),
  totalGmvCents:     bigint('total_gmv_cents', { mode: 'number' }).notNull(),

  // Trend
  priceChangePct:    real('price_change_pct'),                // vs previous period
  volumeChangePct:   real('volume_change_pct'),               // vs previous period

  // Sources contributing
  dataSourcesJson:   jsonb('data_sources_json').notNull().default('{}'),  // { TWICELY_NATIVE: 45, EBAY_SELLER: 120, ... }
  confidence:        text('confidence').notNull(),            // 'HIGH' (50+) | 'MEDIUM' (20-49) | 'LOW' (< 20)

  computedAt:        timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryPeriodIdx: index('mcs_cat_period').on(table.categoryId, table.periodType, table.periodStart),
  brandIdx:          index('mcs_brand').on(table.brand),
  uniqCategoryWindow: unique('mcs_unique_dim_period').on(table.categoryId, table.conditionBucket, table.brand, table.periodType, table.periodStart),
}));

// §20.8 marketListingIntelligence
export const marketListingIntelligence = pgTable('market_listing_intelligence', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  categoryId:            text('category_id').notNull(),

  // Price guidance
  marketMedianCents:     integer('market_median_cents'),
  marketLowCents:        integer('market_low_cents'),
  marketHighCents:       integer('market_high_cents'),
  sweetSpotLowCents:     integer('sweet_spot_low_cents'),
  sweetSpotHighCents:    integer('sweet_spot_high_cents'),
  sampleSize:            integer('sample_size').notNull(),

  // Time-to-sell
  estimatedDaysToSell:   integer('estimated_days_to_sell'),
  categoryAvgDays:       integer('category_avg_days'),

  // Health signal
  healthSignal:          text('health_signal'),               // 'SELLING_FAST' | 'ON_TRACK' | 'SLOW_MOVER' | 'STALE'
  healthNudgeText:       text('health_nudge_text'),           // Human-readable nudge

  // Platform recommendation (crosslister sellers only)
  bestPlatform:          text('best_platform'),               // 'EBAY' | 'POSHMARK' | 'MERCARI' | 'FACEBOOK'
  bestPlatformReason:    text('best_platform_reason'),
  platformPricesJson:    jsonb('platform_prices_json'),       // { EBAY: { median: 4800 }, POSHMARK: { median: 5500 }, ... }

  // Sources
  dataSourcesJson:       jsonb('data_sources_json'),
  computedAt:            timestamp('computed_at', { withTimezone: true }).notNull(),
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('mli_listing').on(table.listingId),
  expiresIdx:            index('mli_expires').on(table.expiresAt),
}));

// §20.9 marketOfferIntelligence
export const marketOfferIntelligence = pgTable('market_offer_intelligence', {
  id:                      text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:              text('category_id').notNull().references(() => category.id),
  conditionBucket:         text('condition_bucket'),
  priceBucketCents:        integer('price_bucket_cents'),     // rounded to nearest $10

  // Offer patterns
  avgAcceptedPctOfAsk:     real('avg_accepted_pct_of_ask'),   // e.g., 0.82 = 82% of asking
  medianAcceptedPctOfAsk:  real('median_accepted_pct_of_ask'),
  acceptanceRate:          real('acceptance_rate'),            // % of offers accepted
  counterRate:             real('counter_rate'),               // % of offers countered
  avgCounterPctOfAsk:      real('avg_counter_pct_of_ask'),    // avg counter as % of ask

  sampleSize:              integer('sample_size').notNull(),
  periodStart:             timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:               timestamp('period_end', { withTimezone: true }).notNull(),
  computedAt:              timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryCondIdx:         index('moi_cat_cond').on(table.categoryId, table.conditionBucket),
  priceBucketIdx:          index('moi_price_bucket').on(table.priceBucketCents),
}));
