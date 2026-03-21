import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { feeBucketEnum } from './enums';

// §4.1 category
export const category = pgTable('category', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  slug:            text('slug').notNull().unique(),
  parentId:        text('parent_id'),
  name:            text('name').notNull(),
  description:     text('description'),
  icon:            text('icon'),
  feeBucket:       feeBucketEnum('fee_bucket').notNull(),
  sortOrder:       integer('sort_order').notNull().default(0),
  isActive:        boolean('is_active').notNull().default(true),
  isLeaf:          boolean('is_leaf').notNull().default(false),
  depth:           integer('depth').notNull().default(0),
  path:            text('path').notNull().default(''),
  metaTitle:       text('meta_title'),
  metaDescription: text('meta_description'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:       index('cat_parent').on(table.parentId),
  pathIdx:         index('cat_path').on(table.path),
  activeIdx:       index('cat_active').on(table.isActive),
}));

// §4.2 categoryAttributeSchema
export const categoryAttributeSchema = pgTable('category_attribute_schema', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:      text('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  label:           text('label').notNull(),
  fieldType:       text('field_type').notNull(),
  isRequired:      boolean('is_required').notNull().default(false),
  isRecommended:   boolean('is_recommended').notNull().default(false),
  showInFilters:   boolean('show_in_filters').notNull().default(false),
  showInListing:   boolean('show_in_listing').notNull().default(true),
  optionsJson:     jsonb('options_json').notNull().default(sql`'[]'`),
  validationJson:  jsonb('validation_json').notNull().default(sql`'{}'`),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:     index('cas_category').on(table.categoryId),
}));
