import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// §21.4.3 seoRedirect — Redirect rule management for SEO
export const seoRedirect = pgTable('seo_redirect', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  fromPath:     text('from_path').notNull().unique(),
  toPath:       text('to_path').notNull(),
  statusCode:   integer('status_code').notNull().default(301),
  isActive:     boolean('is_active').notNull().default(true),
  hitCount:     integer('hit_count').notNull().default(0),
  lastHitAt:    timestamp('last_hit_at', { withTimezone: true }),
  reason:       text('reason'),
  createdBy:    text('created_by'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeFromIdx: index('sr_active_from').on(table.isActive, table.fromPath),
}));
