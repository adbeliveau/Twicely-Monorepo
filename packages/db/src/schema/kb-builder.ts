import { pgTable, text, integer, boolean, timestamp, index, unique, uniqueIndex, date } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { kbArticle } from './kb';

// §37.3.1 kbArticleVersion — immutable snapshot of article at publish time
export const kbArticleVersion = pgTable('kb_article_version', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  articleId:         text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  versionNumber:     integer('version_number').notNull(),
  title:             text('title').notNull(),
  slug:              text('slug').notNull(),
  content:           text('content').notNull(), // Tiptap JSON as string
  excerpt:           text('excerpt'),
  authorId:          text('author_id').notNull(),
  status:            text('status', { enum: ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] }).notNull(),
  publishedAt:       timestamp('published_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleVersionIdx: unique('kbav_article_version').on(table.articleId, table.versionNumber),
  articleDateIdx:    index('kbav_article_date').on(table.articleId, table.createdAt),
}));

// §37.7 kbArticleEditLock — pessimistic soft lock for single-author editing
export const kbArticleEditLock = pgTable('kb_article_edit_lock', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  articleId:         text('article_id').notNull().unique().references(() => kbArticle.id, { onDelete: 'cascade' }),
  lockedByUserId:    text('locked_by_user_id').notNull(),
  lockedAt:          timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),
});

// §37 kbArticleSearch — plain text extraction for search indexing
export const kbArticleSearch = pgTable('kb_article_search', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  articleId:         text('article_id').notNull().unique().references(() => kbArticle.id, { onDelete: 'cascade' }),
  indexedContent:    text('indexed_content').notNull(),
  indexedAt:         timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
});

// §37.3.2 kbCategoryV2 — hierarchical KB categories with positioning
export const kbCategoryV2 = pgTable('kb_category_v2', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull(),
  slug:              text('slug').notNull().unique(),
  description:       text('description'),
  parentId:          text('parent_id'),
  position:          integer('position').notNull().default(0),
  iconName:          text('icon_name'),
  isPublic:          boolean('is_public').notNull().default(true),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:         index('kbcv2_parent').on(table.parentId),
  slugIdx:           index('kbcv2_slug').on(table.slug),
}));

// §37 kbArticleCategory — many-to-many article<>category with ordering
export const kbArticleCategory = pgTable('kb_article_category', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  articleId:         text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  categoryId:        text('category_id').notNull().references(() => kbCategoryV2.id, { onDelete: 'cascade' }),
  position:          integer('position').notNull().default(0),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleCategoryIdx: unique('kbac_article_category').on(table.articleId, table.categoryId),
  articleIdx:         index('kbac_article').on(table.articleId),
  categoryIdx:        index('kbac_category').on(table.categoryId),
}));

// §37.3.3 kbArticleAnalytics — daily article performance metrics
export const kbArticleAnalytics = pgTable('kb_article_analytics', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  articleId:             text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  date:                  date('date').notNull(),
  pageViews:             integer('page_views').notNull().default(0),
  uniqueVisitors:        integer('unique_visitors').notNull().default(0),
  helpfulYesCount:       integer('helpful_yes_count').notNull().default(0),
  helpfulNoCount:        integer('helpful_no_count').notNull().default(0),
  avgTimeOnPageSeconds:  integer('avg_time_on_page_seconds'),
  searchClickCount:      integer('search_click_count').notNull().default(0),
  caseDeflectionCount:   integer('case_deflection_count').notNull().default(0),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleDateIdx:        uniqueIndex('kban_article_date').on(table.articleId, table.date),
  dateIdx:               index('kban_date').on(table.date),
}));

// §37.3.4 kbSearchLog — tracks search-to-article conversion
export const kbSearchLog = pgTable('kb_search_log', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  query:               text('query').notNull(),
  resultCount:         integer('result_count').notNull(),
  clickedArticleId:    text('clicked_article_id').references(() => kbArticle.id, { onDelete: 'set null' }),
  userId:              text('user_id'),
  sessionFingerprint:  text('session_fingerprint'),
  source:              text('source').notNull().default('help_center'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  queryDateIdx:        index('kbsl_query_date').on(table.query, table.createdAt),
  clickedArticleIdx:   index('kbsl_clicked').on(table.clickedArticleId),
}));
