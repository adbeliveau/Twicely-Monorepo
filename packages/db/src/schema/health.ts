import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// ── Health Run ──────────────────────────────────────────────────────────
// Tracks each health-check run (scheduled, interactive, or manual).
export const healthRun = pgTable('health_run', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  runType:           text('run_type').notNull(),          // 'scheduled' | 'interactive' | 'manual'
  status:            text('status').notNull(),             // overall: HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN
  startedAt:         timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt:        timestamp('finished_at', { withTimezone: true }),
  durationMs:        integer('duration_ms'),
  totalChecks:       integer('total_checks').notNull().default(0),
  healthyCount:      integer('healthy_count').default(0),
  degradedCount:     integer('degraded_count').default(0),
  unhealthyCount:    integer('unhealthy_count').default(0),
  unknownCount:      integer('unknown_count').default(0),
  triggeredByStaffId: text('triggered_by_staff_id'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runTypeStartedAtIdx: index('hr_run_type_started_at').on(table.runType, table.startedAt),
  statusIdx:           index('hr_status').on(table.status),
}));

// ── Health Snapshot ─────────────────────────────────────────────────────
// Individual check result within a run.
export const healthSnapshot = pgTable('health_snapshot', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  runId:       text('run_id').notNull().references(() => healthRun.id, { onDelete: 'cascade' }),
  checkName:   text('check_name').notNull(),
  module:      text('module').notNull(),
  status:      text('status').notNull(),               // HEALTHY | DEGRADED | UNHEALTHY | UNKNOWN
  message:     text('message'),
  latencyMs:   integer('latency_ms'),
  detailsJson: jsonb('details_json').default(sql`'{}'`),
  checkedAt:   timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  runIdIdx:          index('hs_run_id').on(table.runId),
  checkNameAtIdx:    index('hs_check_name_at').on(table.checkName, table.checkedAt),
  statusIdx:         index('hs_status').on(table.status),
  moduleAtIdx:       index('hs_module_at').on(table.module, table.checkedAt),
}));

// ── Health Check Provider ───────────────────────────────────────────────
// Registry of available health checks and their configuration.
export const healthCheckProvider = pgTable('health_check_provider', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  checkName:      text('check_name').notNull().unique(),
  module:         text('module').notNull(),
  description:    text('description'),
  isActive:       boolean('is_active').default(true),
  timeoutMs:      integer('timeout_ms').default(5000),
  scheduleGroup:  text('schedule_group'),
  lastStatus:     text('last_status'),
  lastCheckedAt:  timestamp('last_checked_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
