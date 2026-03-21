import { pgTable, text, varchar, decimal, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { interestSourceEnum } from './enums';

// Platform-Curated Interest Tags
export const interestTag = pgTable('interest_tag', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  group: varchar('group', { length: 50 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  description: varchar('description', { length: 200 }),
  categoryIds: text('category_ids').array(),
  attributes: jsonb('attributes'),
  cardEmphasis: varchar('card_emphasis', { length: 50 }).notNull().default('default'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('idx_interest_tag_group').on(table.group),
}));

// Per-User Interest Weights
export const userInterest = pgTable('user_interest', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tagSlug: varchar('tag_slug', { length: 50 }).notNull().references(() => interestTag.slug),
  weight: decimal('weight', { precision: 6, scale: 3 }).notNull().default('1.0'),
  source: interestSourceEnum('source').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserTagSource: unique().on(table.userId, table.tagSlug, table.source),
  userIdIdx: index('idx_user_interest_user_id').on(table.userId),
  expiresAtIdx: index('idx_user_interest_expires_at').on(table.expiresAt),
}));
