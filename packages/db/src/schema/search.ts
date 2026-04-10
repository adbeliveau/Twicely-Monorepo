import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  searchRuleTypeEnum,
  searchIndexStatusEnum,
  searchIndexJobTypeEnum,
  searchIndexJobStatusEnum,
} from './enums';

// ── Search Synonym Set ──────────────────────────────────────────────────────
// Groups of equivalent terms for search expansion.
export const searchSynonymSet = pgTable('search_synonym_set', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  name:      text('name').notNull(),
  terms:     text('terms').array().notNull(),
  enabled:   boolean('enabled').notNull().default(true),
  version:   integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  enabledIdx: index('ss_enabled').on(table.enabled),
}));

// ── Search Rule ─────────────────────────────────────────────────────────────
// Merchandising rules: pin, bury, rewrite, redirect, block.
export const searchRule = pgTable('search_rule', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  ruleType:     searchRuleTypeEnum('rule_type').notNull(),
  queryPattern: text('query_pattern').notNull(),
  payloadJson:  jsonb('payload_json').default(sql`'{}'`),
  enabled:      boolean('enabled').notNull().default(true),
  priority:     integer('priority').notNull().default(0),
  startsAt:     timestamp('starts_at', { withTimezone: true }),
  endsAt:       timestamp('ends_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleTypeEnabledIdx: index('sr_rule_type_enabled').on(table.ruleType, table.enabled),
  priorityIdx:        index('sr_priority').on(table.priority),
}));

// ── Search Index Version ────────────────────────────────────────────────────
// Tracks all physical OpenSearch indices and their alias state.
export const searchIndexVersion = pgTable('search_index_version', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  domain:            text('domain').notNull().default('listings'),
  physicalIndexName: text('physical_index_name').notNull().unique(),
  mappingVersion:    integer('mapping_version').notNull(),
  docCount:          integer('doc_count').notNull().default(0),
  status:            searchIndexStatusEnum('status').notNull().default('CREATING'),
  isReadActive:      boolean('is_read_active').notNull().default(false),
  isWriteActive:     boolean('is_write_active').notNull().default(false),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  domainStatusIdx: index('siv_domain_status').on(table.domain, table.status),
  readActiveIdx:   index('siv_read_active').on(table.isReadActive),
}));

// ── Search Index Job ────────────────────────────────────────────────────────
// Audit trail for reindex, alias swap, and rollback operations.
export const searchIndexJob = pgTable('search_index_job', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  jobType:            searchIndexJobTypeEnum('job_type').notNull(),
  domain:             text('domain').notNull().default('listings'),
  status:             searchIndexJobStatusEnum('status').notNull().default('PENDING'),
  totalItems:         integer('total_items').default(0),
  succeededItems:     integer('succeeded_items').default(0),
  failedItems:        integer('failed_items').default(0),
  errorSummary:       text('error_summary'),
  triggeredByStaffId: text('triggered_by_staff_id'),
  startedAt:          timestamp('started_at', { withTimezone: true }),
  completedAt:        timestamp('completed_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobTypeStatusIdx:  index('sij_job_type_status').on(table.jobType, table.status),
  domainCreatedIdx:  index('sij_domain_created').on(table.domain, table.createdAt),
}));

// ── Search Query Log ────────────────────────────────────────────────────────
// Analytics: search query telemetry (fire-and-forget).
export const searchQueryLog = pgTable('search_query_log', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  queryText:       text('query_text'),
  normalizedQuery: text('normalized_query'),
  resultCount:     integer('result_count').notNull().default(0),
  latencyMs:       integer('latency_ms'),
  engine:          text('engine').notNull(),
  facetUsageJson:  jsonb('facet_usage_json').default(sql`'{}'`),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIdx:      index('sql_created_at').on(table.createdAt),
  normalizedIdx:     index('sql_normalized').on(table.normalizedQuery),
  engineIdx:         index('sql_engine').on(table.engine),
}));
