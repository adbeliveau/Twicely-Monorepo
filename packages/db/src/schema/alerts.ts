import { pgTable, text, integer, boolean, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';
import { category } from './catalog';

export const priceAlert = pgTable('price_alert', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').references(() => listing.id, { onDelete: 'cascade' }),
  alertType:       text('alert_type').notNull(),
  targetPriceCents: integer('target_price_cents'),
  percentDrop:     real('percent_drop'),
  priceCentsAtCreation: integer('price_cents_at_creation'),
  isActive:        boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('pa_user').on(table.userId),
  listingIdx:      index('pa_listing').on(table.listingId),
  activeIdx:       index('pa_active').on(table.isActive, table.listingId),
}));

export const categoryAlert = pgTable('category_alert', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  categoryId:      text('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  filtersJson:     jsonb('filters_json').notNull().default('{}'),
  isActive:        boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('ca_user').on(table.userId),
  categoryIdx:     index('ca_category').on(table.categoryId),
}));
