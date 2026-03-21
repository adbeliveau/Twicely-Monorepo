import { pgTable, text, boolean, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { notificationChannelEnum, notificationPriorityEnum } from './enums';
import { user } from './auth';

// §10.1 notification
export const notification = pgTable('notification', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channel:         notificationChannelEnum('channel').notNull(),
  priority:        notificationPriorityEnum('priority').notNull().default('NORMAL'),
  templateKey:     text('template_key').notNull(),
  subject:         text('subject'),
  body:            text('body').notNull(),
  dataJson:        jsonb('data_json').notNull().default(sql`'{}'`),
  isRead:          boolean('is_read').notNull().default(false),
  readAt:          timestamp('read_at', { withTimezone: true }),
  sentAt:          timestamp('sent_at', { withTimezone: true }),
  failedAt:        timestamp('failed_at', { withTimezone: true }),
  failureReason:   text('failure_reason'),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userChannelIdx:  index('notif_user_channel').on(table.userId, table.channel, table.isRead),
  userCreatedIdx:  index('notif_user_created').on(table.userId, table.createdAt),
  templateIdx:     index('notif_template').on(table.templateKey),
}));

// §10.2 notificationPreference
export const notificationPreference = pgTable('notification_preference', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateKey:     text('template_key').notNull(),
  email:           boolean('email').notNull().default(true),
  push:            boolean('push').notNull().default(true),
  inApp:           boolean('in_app').notNull().default(true),
  sms:             boolean('sms').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTemplateIdx: unique().on(table.userId, table.templateKey),
}));

// §10.3 notificationSetting (user-level digest / quiet-hours config)
export const notificationSetting = pgTable('notification_setting', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }).unique(),
  digestFrequency:   text('digest_frequency').notNull().default('daily'),     // 'daily' | 'weekly'
  digestTimeUtc:     text('digest_time_utc').notNull().default('14:00'),      // HH:MM in UTC
  timezone:          text('timezone').notNull().default('America/New_York'),  // IANA timezone string
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart:   text('quiet_hours_start'),                               // HH:MM local time, e.g. '22:00'
  quietHoursEnd:     text('quiet_hours_end'),                                 // HH:MM local time, e.g. '08:00'
  dailySalesSummary: boolean('daily_sales_summary').notNull().default(false), // Seller-only
  staleListingDays:  integer('stale_listing_days'),                           // null = disabled
  trustScoreAlerts:  boolean('trust_score_alerts').notNull().default(false),  // Seller-only
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §10.4 notificationTemplate
export const notificationTemplate = pgTable('notification_template', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  key:             text('key').notNull().unique(),
  name:            text('name').notNull(),
  description:     text('description'),
  category:        text('category').notNull(),
  subjectTemplate: text('subject_template'),
  bodyTemplate:    text('body_template').notNull(),
  htmlTemplate:    text('html_template'),
  channels:        text('channels').array().notNull().default(sql`'{}'::text[]`),
  isSystemOnly:    boolean('is_system_only').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
