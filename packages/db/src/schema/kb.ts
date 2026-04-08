import { pgTable, text, integer, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { kbArticleStatusEnum, kbAudienceEnum, kbBodyFormatEnum } from './enums';
import { helpdeskCase } from './helpdesk';

// §13.14 kbCategory
export const kbCategory = pgTable('kb_category', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  slug:                text('slug').notNull().unique(),
  parentId:            text('parent_id'),
  name:                text('name').notNull(),
  description:         text('description'),
  icon:                text('icon'),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:           index('kbc_parent').on(table.parentId),
}));

// §13.15 kbArticle
export const kbArticle = pgTable('kb_article', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  // set null: kb article survives category deletion (article remains, just uncategorized)
  categoryId:          text('category_id').references(() => kbCategory.id, { onDelete: 'set null' }),
  slug:                text('slug').notNull().unique(),
  title:               text('title').notNull(),
  excerpt:             text('excerpt'),
  body:                text('body').notNull(),
  bodyFormat:          kbBodyFormatEnum('body_format').notNull().default('MARKDOWN'),
  status:              kbArticleStatusEnum('status').notNull().default('DRAFT'),
  audience:            kbAudienceEnum('audience').notNull().default('ALL'),
  authorStaffId:       text('author_staff_id').notNull(),
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),
  searchKeywords:      text('search_keywords').array().notNull().default(sql`'{}'::text[]`),
  metaTitle:           text('meta_title'),
  metaDescription:     text('meta_description'),
  isFeatured:          boolean('is_featured').notNull().default(false),
  isPinned:            boolean('is_pinned').notNull().default(false),
  viewCount:           integer('view_count').notNull().default(0),
  helpfulYes:          integer('helpful_yes').notNull().default(0),
  helpfulNo:           integer('helpful_no').notNull().default(0),
  version:             integer('version').notNull().default(1),
  publishedAt:         timestamp('published_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:         index('kba_category').on(table.categoryId),
  statusIdx:           index('kba_status').on(table.status),
  audienceIdx:         index('kba_audience').on(table.audience),
}));

// §13.16 kbArticleAttachment
export const kbArticleAttachment = pgTable('kb_article_attachment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  url:                 text('url').notNull(),
  filename:            text('filename').notNull(),
  mimeType:            text('mime_type').notNull(),
  sizeBytes:           integer('size_bytes').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaa_article').on(table.articleId),
}));

// §13.17 kbArticleRelation
export const kbArticleRelation = pgTable('kb_article_relation', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  relatedArticleId:    text('related_article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articlePairIdx:      unique().on(table.articleId, table.relatedArticleId),
}));

// §13.18 kbCaseArticleLink
export const kbCaseArticleLink = pgTable('kb_case_article_link', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  // cascade: when article is deleted, remove the case-article links
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  linkedByStaffId:     text('linked_by_staff_id').notNull(),
  sentToCustomer:      boolean('sent_to_customer').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('kcal_case').on(table.caseId),
  articleIdx:          index('kcal_article').on(table.articleId),
}));

// §13.19 kbArticleFeedback
export const kbArticleFeedback = pgTable('kb_article_feedback', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  userId:              text('user_id'),
  sessionFingerprint:  text('session_fingerprint'),
  helpful:             boolean('helpful').notNull(),
  comment:             text('comment'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaf_article').on(table.articleId),
  dedupeIdx:           index('kbaf_dedupe').on(table.articleId, table.userId),
}));
