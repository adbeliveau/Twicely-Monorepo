import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { listingStatusEnum, listingConditionEnum, enforcementStateEnum, offerStatusEnum, offerTypeEnum, channelEnum, combinedShippingModeEnum, fulfillmentTypeEnum, authenticationStatusEnum } from './enums';
import { user } from './auth';
import { category } from './catalog';
import { storefrontCustomCategory } from './storefront';

// §5.1 listing
export const listing = pgTable('listing', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  ownerUserId:           text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:                listingStatusEnum('status').notNull().default('DRAFT'),
  title:                 text('title'),
  description:           text('description'),
  categoryId:            text('category_id').references(() => category.id, { onDelete: 'set null' }),
  storefrontCategoryId:  text('storefront_category_id').references(() => storefrontCustomCategory.id, { onDelete: 'set null' }),
  condition:             listingConditionEnum('condition'),
  brand:                 text('brand'),
  priceCents:            integer('price_cents'),
  originalPriceCents:    integer('original_price_cents'),
  cogsCents:             integer('cogs_cents'),
  sourcingExpenseId:     text('sourcing_expense_id'),     // FK to expense.id — enforced in migration
  currency:              text('currency').notNull().default('USD'),
  quantity:              integer('quantity').notNull().default(1),
  availableQuantity:     integer('available_quantity'),
  soldQuantity:          integer('sold_quantity').notNull().default(0),
  soldPriceCents:        integer('sold_price_cents'),  // A2.1 — actual transaction price
  slug:                  text('slug').unique(),

  // Offers
  allowOffers:           boolean('allow_offers').notNull().default(false),
  autoAcceptOfferCents:  integer('auto_accept_offer_cents'),
  autoDeclineOfferCents: integer('auto_decline_offer_cents'),
  offerExpiryHours:      integer('offer_expiry_hours'),  // null = platform default (48h)

  // Shipping & Fulfillment
  fulfillmentType:       fulfillmentTypeEnum('fulfillment_type').notNull().default('SHIP_ONLY'),
  localPickupRadiusMiles: integer('local_pickup_radius_miles'),  // null = seller default
  localHandlingFlags:    text('local_handling_flags').array().notNull().default(sql`'{}'::text[]`),
  shippingProfileId:     text('shipping_profile_id'),
  weightOz:              integer('weight_oz'),
  lengthIn:              real('length_in'),
  widthIn:               real('width_in'),
  heightIn:              real('height_in'),
  freeShipping:          boolean('free_shipping').notNull().default(false),
  shippingCents:         integer('shipping_cents').notNull().default(0),

  // Attributes (dynamic per category)
  attributesJson:        jsonb('attributes_json').notNull().default(sql`'{}'`),
  tags:                  text('tags').array().notNull().default(sql`'{}'::text[]`),

  // Authentication (D6 — Authentication Program)
  authenticationStatus:     authenticationStatusEnum('authentication_status').notNull().default('NONE'),
  authenticationRequestId:  text('authentication_request_id'),

  // Enforcement
  enforcementState:      enforcementStateEnum('enforcement_state').notNull().default('CLEAR'),

  // Deal badge (computed by market index)
  dealBadgeType:         text('deal_badge_type'),
  dealBadgeComputedAt:   timestamp('deal_badge_computed_at', { withTimezone: true }),

  // Boosting
  boostPercent:          real('boost_percent'),
  boostStartedAt:        timestamp('boost_started_at', { withTimezone: true }),

  // Listing lifecycle timestamps
  activatedAt:           timestamp('activated_at', { withTimezone: true }),
  pausedAt:              timestamp('paused_at', { withTimezone: true }),
  endedAt:               timestamp('ended_at', { withTimezone: true }),
  soldAt:                timestamp('sold_at', { withTimezone: true }),
  expiresAt:             timestamp('expires_at', { withTimezone: true }),
  autoRenew:             boolean('auto_renew').notNull().default(true),

  // Archive (SOLD listings hidden from dashboard but kept for records)
  archivedAt:            timestamp('archived_at', { withTimezone: true }),

  // Import source
  importedFromChannel:   channelEnum('imported_from_channel'),
  importedExternalId:    text('imported_external_id'),

  // Video
  videoUrl:              text('video_url'),                   // R2 URL, nullable
  videoThumbUrl:         text('video_thumb_url'),             // First frame thumbnail
  videoDurationSeconds:  integer('video_duration_seconds'),   // 15-60 seconds per platform settings

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerStatusIdx:  index('lst_owner_status').on(table.ownerUserId, table.status),
  ownerCreatedIdx: index('lst_owner_created').on(table.ownerUserId, table.createdAt),
  categoryIdx:     index('lst_category').on(table.categoryId),
  storefrontCatIdx: index('lst_storefront_cat').on(table.storefrontCategoryId),
  statusCreatedIdx: index('lst_status_created').on(table.status, table.createdAt),
  priceIdx:        index('lst_price').on(table.priceCents),
  slugIdx:         index('lst_slug').on(table.slug),
  enforcementIdx:  index('lst_enforcement').on(table.enforcementState),
  expiresIdx:      index('lst_expires').on(table.expiresAt),
  fulfillmentIdx:  index('lst_fulfillment').on(table.fulfillmentType),
  authStatusIdx:   index('lst_auth_status').on(table.authenticationStatus),
  cogsIdx:         index('lst_cogs').on(table.cogsCents).where(sql`cogs_cents IS NOT NULL`),
}));

// §5.2 listingImage
export const listingImage = pgTable('listing_image', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  listingId:   text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  url:         text('url').notNull(),
  position:    integer('position').notNull().default(0),
  altText:     text('alt_text'),
  isPrimary:   boolean('is_primary').notNull().default(false),
  width:       integer('width'),
  height:      integer('height'),
  sizeBytes:   integer('size_bytes'),
  blurHash:    text('blur_hash'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingPosIdx: unique().on(table.listingId, table.position),
  listingIdx:    index('li_listing').on(table.listingId),
}));

// §5.3 listingOffer (counter chain model: each counter = new row with parentOfferId)
export const listingOffer = pgTable('listing_offer', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  listingId:         text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  // restrict: offer is a commercial record — must survive user account deletion for audit
  buyerId:           text('buyer_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  sellerId:          text('seller_id').notNull(),  // userId, not sellerProfileId
  offerCents:        integer('offer_cents').notNull(),
  currency:          text('currency').notNull().default('USD'),
  message:           text('message'),
  status:            offerStatusEnum('status').notNull().default('PENDING'),
  type:              offerTypeEnum('type').notNull().default('BEST_OFFER'),
  expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),
  // Counter chain: parentOfferId links to the offer being countered
  parentOfferId:     text('parent_offer_id'),  // null for initial offers, set for counters
  counterByRole:     text('counter_by_role'),  // 'BUYER' | 'SELLER' — who created this counter
  counterCount:      integer('counter_count').notNull().default(0),  // denormalized depth
  respondedAt:       timestamp('responded_at', { withTimezone: true }),
  stripeHoldId:      text('stripe_hold_id'),  // null when seller counters (no hold until buyer acts)
  shippingAddressId: text('shipping_address_id'),  // buyer's saved address ID for order creation
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingStatusIdx:  index('lo_listing_status').on(table.listingId, table.status),
  buyerStatusIdx:    index('lo_buyer_status').on(table.buyerId, table.status),
  sellerStatusIdx:   index('lo_seller_status').on(table.sellerId, table.status),
  expiresIdx:        index('lo_expires').on(table.expiresAt, table.status),
  parentOfferIdx:    index('lo_parent_offer').on(table.parentOfferId),
}));

// §5.3b watcherOffer — seller broadcast to watchers
export const watcherOffer = pgTable('watcher_offer', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:              text('seller_id').notNull(),  // userId
  discountedPriceCents:  integer('discounted_price_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  watchersNotifiedCount: integer('watchers_notified_count').notNull().default(0),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('wo_listing').on(table.listingId),
  sellerIdx:             index('wo_seller').on(table.sellerId),
  expiresIdx:            index('wo_expires').on(table.expiresAt),
}));

// §5.4 listingFee
export const listingFee = pgTable('listing_fee', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:        text('seller_id').notNull(),
  type:            text('type').notNull(),
  amountCents:     integer('amount_cents').notNull(),
  currency:        text('currency').notNull().default('USD'),
  billingPeriod:   text('billing_period'),
  waived:          boolean('waived').notNull().default(false),
  waivedReason:    text('waived_reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('lf_seller').on(table.sellerId, table.createdAt),
  listingIdx:      index('lf_listing').on(table.listingId),
}));

// §5.5 listingVersion
export const listingVersion = pgTable('listing_version', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  version:         integer('version').notNull(),
  snapshotJson:    jsonb('snapshot_json').notNull(),
  changeReason:    text('change_reason'),
  changedByUserId: text('changed_by_user_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingVersionIdx: unique().on(table.listingId, table.version),
}));

// §5.6 shippingProfile
export const shippingProfile = pgTable('shipping_profile', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  userId:               text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:                 text('name').notNull(),
  carrier:              text('carrier').notNull().default('USPS'),
  service:              text('service'),
  handlingTimeDays:     integer('handling_time_days').notNull().default(3),
  isDefault:            boolean('is_default').notNull().default(false),
  weightOz:             integer('weight_oz'),
  lengthIn:             real('length_in'),
  widthIn:              real('width_in'),
  heightIn:             real('height_in'),

  // Combined shipping (Schema Addendum v1.2)
  combinedShippingMode:  combinedShippingModeEnum('combined_shipping_mode').notNull().default('NONE'),
  flatCombinedCents:     integer('flat_combined_cents'),
  additionalItemCents:   integer('additional_item_cents'),
  autoDiscountPercent:   real('auto_discount_percent'),
  autoDiscountMinItems:  integer('auto_discount_min_items').default(2),

  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:              index('shp_user').on(table.userId),
}));

// §5.3c offerBundleItem — junction table for bundle offers
export const offerBundleItem = pgTable('offer_bundle_item', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  offerId:     text('offer_id').notNull().references(() => listingOffer.id, { onDelete: 'cascade' }),
  listingId:   text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  offerIdx:    index('obi_offer').on(table.offerId),
  listingIdx:  index('obi_listing').on(table.listingId),
}));

// §27.1 listingPriceHistory (canonical v2.0.7)
export const listingPriceHistory = pgTable('listing_price_history', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  priceCents:      integer('price_cents').notNull(),
  previousCents:   integer('previous_cents'),
  changeReason:    text('change_reason').notNull(),    // 'MANUAL' | 'PROMOTION' | 'COUPON' | 'SMART_DROP' | 'IMPORT' | 'OFFER_ACCEPTED'
  changedByUserId: text('changed_by_user_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:      index('lph_listing').on(table.listingId, table.createdAt),
}));
