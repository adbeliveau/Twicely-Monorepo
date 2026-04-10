import { pgTable, text, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { variationValueScopeEnum, variantReservationStatusEnum } from './enums';
import { user } from './auth';
import { category } from './catalog';
import { listing } from './listings';

// variationType -- Variation Dimensions
export const variationType = pgTable('variation_type', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  key:           text('key').notNull().unique(),
  label:         text('label').notNull(),
  description:   text('description'),
  icon:          text('icon'),
  inputType:     text('input_type').notNull().default('dropdown'),
  isSystem:      boolean('is_system').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  sortOrder:     integer('sort_order').notNull().default(0),
  totalListings: integer('total_listings').notNull().default(0),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeSortIdx: index('vt_active_sort').on(table.isActive, table.sortOrder),
}));

// variationValue -- Value Library
export const variationValue = pgTable('variation_value', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  variationTypeId: text('variation_type_id').notNull()
                     .references(() => variationType.id, { onDelete: 'cascade' }),
  value:           text('value').notNull(),
  normalizedValue: text('normalized_value').notNull(),
  scope:           variationValueScopeEnum('scope').notNull().default('PLATFORM'),
  categoryId:      text('category_id')
                     .references(() => category.id, { onDelete: 'set null' }),
  sellerId:        text('seller_id')
                     .references(() => user.id, { onDelete: 'cascade' }),
  colorHex:        text('color_hex'),
  imageUrl:        text('image_url'),
  usageCount:      integer('usage_count').notNull().default(0),
  lastUsedAt:      timestamp('last_used_at', { withTimezone: true }),
  isActive:        boolean('is_active').notNull().default(true),
  promotedAt:      timestamp('promoted_at', { withTimezone: true }),
  promotedBy:      text('promoted_by'),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeScopeIdx:  index('vv_type_scope').on(table.variationTypeId, table.scope, table.isActive),
  typeUsageIdx:  index('vv_type_usage').on(table.variationTypeId, table.isActive, table.usageCount),
  sellerTypeIdx: index('vv_seller_type').on(table.sellerId, table.variationTypeId),
  normalizedIdx: index('vv_normalized').on(table.normalizedValue),
  dedupUniq:     unique('vv_dedup').on(
    table.variationTypeId, table.normalizedValue, table.scope, table.categoryId, table.sellerId
  ),
}));

// categoryVariationType -- Category-Type Mapping
export const categoryVariationType = pgTable('category_variation_type', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:      text('category_id').notNull()
                     .references(() => category.id, { onDelete: 'cascade' }),
  variationTypeId: text('variation_type_id').notNull()
                     .references(() => variationType.id, { onDelete: 'cascade' }),
  isRequired:      boolean('is_required').notNull().default(false),
  isPrimary:       boolean('is_primary').notNull().default(false),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  catTypeUniq: unique('cvt_cat_type').on(table.categoryId, table.variationTypeId),
  catIdx:      index('cvt_cat').on(table.categoryId),
}));

// listingVariation -- Variation Dimensions on a Listing
export const listingVariation = pgTable('listing_variation', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull()
                     .references(() => listing.id, { onDelete: 'cascade' }),
  variationTypeId: text('variation_type_id').notNull()
                     .references(() => variationType.id),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingTypeUniq: unique('lv_listing_type').on(table.listingId, table.variationTypeId),
  listingIdx:      index('lv_listing').on(table.listingId),
}));

// listingVariationOption -- Values Selected for a Listing Variation
export const listingVariationOption = pgTable('listing_variation_option', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingVariationId:  text('listing_variation_id').notNull()
                         .references(() => listingVariation.id, { onDelete: 'cascade' }),
  variationValueId:    text('variation_value_id')
                         .references(() => variationValue.id, { onDelete: 'set null' }),
  customValue:         text('custom_value'),
  displayValue:        text('display_value').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  variationIdx: index('lvo_variation').on(table.listingVariationId),
  valueIdx:     index('lvo_value').on(table.variationValueId),
}));

// listingChild -- Individual SKU / Variant
export const listingChild = pgTable('listing_child', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  parentListingId:     text('parent_listing_id').notNull()
                         .references(() => listing.id, { onDelete: 'cascade' }),
  variationCombination: jsonb('variation_combination').notNull(),
  sku:                 text('sku').notNull(),
  priceCents:          integer('price_cents').notNull(),
  compareAtPriceCents: integer('compare_at_price_cents'),
  costCents:           integer('cost_cents'),
  quantity:            integer('quantity').notNull().default(0),
  availableQuantity:   integer('available_quantity').notNull().default(0),
  reservedQuantity:    integer('reserved_quantity').notNull().default(0),
  lowStockThreshold:   integer('low_stock_threshold').notNull().default(5),
  weightOz:            integer('weight_oz'),
  barcode:             text('barcode'),
  isActive:            boolean('is_active').notNull().default(true),
  isDefault:           boolean('is_default').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentSkuUniq:   unique('lc_parent_sku').on(table.parentListingId, table.sku),
  parentActiveIdx: index('lc_parent_active').on(table.parentListingId, table.isActive),
  skuIdx:          index('lc_sku').on(table.sku),
  barcodeIdx:      index('lc_barcode').on(table.barcode),
}));

// listingChildImage -- Per-Variant Images
export const listingChildImage = pgTable('listing_child_image', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  listingChildId: text('listing_child_id').notNull()
                    .references(() => listingChild.id, { onDelete: 'cascade' }),
  url:            text('url').notNull(),
  altText:        text('alt_text'),
  sortOrder:      integer('sort_order').notNull().default(0),
  isPrimary:      boolean('is_primary').notNull().default(false),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childSortIdx: index('lci_child_sort').on(table.listingChildId, table.sortOrder),
}));

// variantReservation -- Cart Stock Holds
export const variantReservation = pgTable('variant_reservation', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  listingChildId: text('listing_child_id').notNull()
                    .references(() => listingChild.id, { onDelete: 'cascade' }),
  userId:         text('user_id').notNull()
                    .references(() => user.id, { onDelete: 'cascade' }),
  cartId:         text('cart_id'),
  quantity:       integer('quantity').notNull(),
  expiresAt:      timestamp('expires_at', { withTimezone: true }).notNull(),
  status:         variantReservationStatusEnum('status').notNull().default('ACTIVE'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childStatusIdx: index('vr_child_status').on(table.listingChildId, table.status),
  expiresIdx:     index('vr_expires').on(table.expiresAt),
  userIdx:        index('vr_user').on(table.userId),
}));

// sizeGuide -- Size Charts
export const sizeGuide = pgTable('size_guide', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  name:            text('name').notNull(),
  categoryId:      text('category_id')
                     .references(() => category.id, { onDelete: 'set null' }),
  brand:           text('brand'),
  chartDataJson:   jsonb('chart_data_json').notNull(),
  measurementTips: text('measurement_tips'),
  fitType:         text('fit_type'),
  fitDescription:  text('fit_description'),
  isActive:        boolean('is_active').notNull().default(true),
  isGlobal:        boolean('is_global').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index('sg_category').on(table.categoryId),
  brandIdx:    index('sg_brand').on(table.brand),
}));
