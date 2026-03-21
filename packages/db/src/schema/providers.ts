import { pgTable, text, integer, boolean, timestamp, jsonb, index, unique, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { providerAdapterSourceEnum, providerServiceTypeEnum, providerInstanceStatusEnum } from './enums';

// §14.8 providerAdapter
export const providerAdapter = pgTable('provider_adapter', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  serviceType:       providerServiceTypeEnum('service_type').notNull(),
  code:              text('code').notNull(),
  name:              text('name').notNull(),
  description:       text('description'),
  logoUrl:           text('logo_url'),
  docsUrl:           text('docs_url'),
  configSchemaJson:  jsonb('config_schema_json').notNull().default(sql`'[]'`),
  adapterSource:     providerAdapterSourceEnum('adapter_source').notNull().default('BUILT_IN'),
  httpConfigJson:    jsonb('http_config_json'),
  isBuiltIn:         boolean('is_built_in').notNull().default(false),
  enabled:           boolean('enabled').notNull().default(true),
  sortOrder:         integer('sort_order').notNull().default(100),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceCodeIdx:    unique().on(table.serviceType, table.code),
  serviceTypeIdx:    index('pa_service_type').on(table.serviceType),
}));

// §14.9 providerInstance
export const providerInstance = pgTable('provider_instance', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  adapterId:         text('adapter_id').notNull().references(() => providerAdapter.id, { onDelete: 'restrict' }),
  name:              text('name').notNull().unique(),
  displayName:       text('display_name').notNull(),
  configJson:        jsonb('config_json').notNull().default(sql`'{}'`),
  status:            providerInstanceStatusEnum('status').notNull().default('ACTIVE'),
  priority:          integer('priority').notNull().default(100),
  lastHealthStatus:  text('last_health_status'),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  lastHealthLatencyMs: integer('last_health_latency_ms'),
  lastHealthError:   text('last_health_error'),
  createdByStaffId:  text('created_by_staff_id').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  adapterIdx:        index('pi_adapter').on(table.adapterId),
  statusIdx:         index('pi_status').on(table.status),
}));

// §14.10 providerSecret
export const providerSecret = pgTable('provider_secret', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:        text('instance_id').notNull().references(() => providerInstance.id, { onDelete: 'cascade' }),
  key:               text('key').notNull(),
  encryptedValue:    text('encrypted_value').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instanceKeyIdx:    unique().on(table.instanceId, table.key),
}));

// §14.11 providerUsageMapping
export const providerUsageMapping = pgTable('provider_usage_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  usageKey:            text('usage_key').notNull().unique(),
  description:         text('description'),
  serviceType:         providerServiceTypeEnum('service_type').notNull(),
  primaryInstanceId:   text('primary_instance_id').notNull(),
  fallbackInstanceId:  text('fallback_instance_id'),
  autoFailover:        boolean('auto_failover').notNull().default(false),
  enabled:             boolean('enabled').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceTypeIdx:      index('pum_service_type').on(table.serviceType),
  primaryInstanceFk:   foreignKey({
    columns: [table.primaryInstanceId],
    foreignColumns: [providerInstance.id],
    name: 'pum_primary_instance_fk',
  }).onDelete('restrict'),
  fallbackInstanceFk:  foreignKey({
    columns: [table.fallbackInstanceId],
    foreignColumns: [providerInstance.id],
    name: 'pum_fallback_instance_fk',
  }).onDelete('set null'),
}));

// §14.12 providerHealthLog
export const providerHealthLog = pgTable('provider_health_log', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:        text('instance_id').notNull().references(() => providerInstance.id, { onDelete: 'cascade' }),
  status:            text('status').notNull(),
  latencyMs:         integer('latency_ms'),
  errorMessage:      text('error_message'),
  detailsJson:       jsonb('details_json').notNull().default(sql`'{}'`),
  checkedAt:         timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instanceIdx:       index('phl_instance').on(table.instanceId, table.checkedAt),
}));
