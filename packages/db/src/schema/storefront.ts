import { pgTable, text, integer, index, uniqueIndex, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

// §2.5b storefront
export const storefront = pgTable('storefront', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  ownerUserId:         text('owner_user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  slug:                text('slug').unique(),
  name:                text('name'),
  bannerUrl:           text('banner_url'),
  logoUrl:             text('logo_url'),
  accentColor:         text('accent_color'),              // From 12-color preset palette
  announcement:        text('announcement'),              // One-line announcement bar (STARTER+)
  aboutHtml:           text('about_html'),                // Rich text, 2000 char limit
  socialLinksJson:     jsonb('social_links_json').notNull().default('{}'),  // { instagram, youtube, tiktok, twitter, website }
  featuredListingIds:  text('featured_listing_ids').array().notNull().default(sql`'{}'::text[]`),  // Up to 6
  defaultView:         text('default_view').notNull().default('GRID'),  // 'GRID' | 'LIST'
  returnPolicy:        text('return_policy'),             // 2000 char limit
  shippingPolicy:      text('shipping_policy'),           // 2000 char limit
  isPublished:         boolean('is_published').notNull().default(false),
  vacationMode:        boolean('vacation_mode').notNull().default(false),
  vacationMessage:     text('vacation_message'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdx:            index('sf_owner').on(table.ownerUserId),
  slugIdx:             index('sf_slug').on(table.slug),
  publishedIdx:        index('sf_published').on(table.isPublished),
}));

// §2.5c storefrontCustomCategory
export const storefrontCustomCategory = pgTable('storefront_custom_category', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  storefrontId:    text('storefront_id').notNull().references(() => storefront.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  description:     text('description'),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  storefrontIdx:   index('scc_storefront').on(table.storefrontId),
  sortIdx:         index('scc_sort').on(table.storefrontId, table.sortOrder),
}));

// §2.5d storefrontPage — custom Puck pages (POWER+ tier)
export const storefrontPage = pgTable('storefront_page', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  storefrontId: text('storefront_id').notNull().references(() => storefront.id, { onDelete: 'cascade' }),
  slug:         text('slug').notNull(),
  title:        text('title').notNull(),
  puckData:     jsonb('puck_data').notNull(),
  isPublished:  boolean('is_published').notNull().default(false),
  sortOrder:    integer('sort_order').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  storefrontIdx: index('sfp_storefront').on(table.storefrontId),
  sortIdx:       index('sfp_sort').on(table.storefrontId, table.sortOrder),
  uniqueSlug:    uniqueIndex('sfp_unique_slug').on(table.storefrontId, table.slug),
}));
