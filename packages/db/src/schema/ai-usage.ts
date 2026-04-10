import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

// ai_usage_log — tracks every AI API call with model, tokens, latency, cost
export const aiUsageLog = pgTable('ai_usage_log', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  feature:      text('feature').notNull(),
  userId:       text('user_id').references(() => user.id, { onDelete: 'set null' }),
  model:        text('model').notNull(),
  provider:     text('provider').notNull(),
  inputTokens:  integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  latencyMs:    integer('latency_ms').notNull(),
  cached:       boolean('cached').notNull().default(false),
  error:        text('error'),
  costMicros:   integer('cost_micros').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  featureCreatedIdx: index('aul_feature_created').on(table.feature, table.createdAt),
  userCreatedIdx:    index('aul_user_created').on(table.userId, table.createdAt),
  providerIdx:       index('aul_provider').on(table.provider, table.createdAt),
}));

// ai_embedding_cache — persistent embedding cache (supplements Valkey)
export const aiEmbeddingCache = pgTable('ai_embedding_cache', {
  contentHash:  text('content_hash').primaryKey(),
  model:        text('model').notNull(),
  dimensions:   integer('dimensions').notNull(),
  embedding:    text('embedding').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
