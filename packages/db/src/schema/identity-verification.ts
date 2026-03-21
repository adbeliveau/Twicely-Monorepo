import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { verificationLevelEnum, verificationStatusEnum } from './enums';
import { user } from './auth';

// G6 — Identity Verification table
// Tracks per-user verification sessions, attempts, and results.
// Does NOT store raw ID images — only status metadata.
export const identityVerification = pgTable('identity_verification', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  level:               verificationLevelEnum('level').notNull(),
  status:              verificationStatusEnum('status').notNull().default('PENDING'),

  // Stripe Identity session (Enhanced level only)
  stripeSessionId:     text('stripe_session_id'),
  stripeReportId:      text('stripe_report_id'),

  // Result metadata — NEVER store raw ID images
  verifiedAt:          timestamp('verified_at', { withTimezone: true }),
  failedAt:            timestamp('failed_at', { withTimezone: true }),
  failureReason:       text('failure_reason'),
  expiresAt:           timestamp('expires_at', { withTimezone: true }),

  // Trigger context
  triggeredBy:         text('triggered_by').notNull(),
  triggeredByStaffId:  text('triggered_by_staff_id'),

  // Retry tracking
  attemptCount:        integer('attempt_count').notNull().default(1),
  lastAttemptAt:       timestamp('last_attempt_at', { withTimezone: true }),
  retryAfter:          timestamp('retry_after', { withTimezone: true }),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:   index('iv_user').on(table.userId),
  statusIdx: index('iv_status').on(table.status),
  levelIdx:  index('iv_level').on(table.level),
}));

// G6 — Data Export Request table
// Tracks async GDPR data export requests per user.
export const dataExportRequest = pgTable('data_export_request', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  userId:             text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:             text('status').notNull().default('PENDING'), // PENDING | PROCESSING | COMPLETED | FAILED | EXPIRED
  format:             text('format').notNull().default('json'),    // 'json' | 'csv'
  downloadUrl:        text('download_url'),
  downloadExpiresAt:  timestamp('download_expires_at', { withTimezone: true }),
  completedAt:        timestamp('completed_at', { withTimezone: true }),
  errorMessage:       text('error_message'),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:   index('der_user').on(table.userId),
  statusIdx: index('der_status').on(table.status),
}));
