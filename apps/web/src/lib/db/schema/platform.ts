import { pgTable, text, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { auditSeverityEnum, featureFlagTypeEnum, moduleStateEnum } from './enums';
import { staffUser } from './staff';

// §14.1 platformSetting
export const platformSetting = pgTable('platform_setting', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  key:                 text('key').notNull().unique(),
  value:               jsonb('value').notNull(),
  type:                text('type').notNull().default('string'),
  category:            text('category').notNull(),
  description:         text('description'),
  isSecret:            boolean('is_secret').notNull().default(false),
  updatedByStaffId:    text('updated_by_staff_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:         index('ps_category').on(table.category),
}));

// §14.2 platformSettingHistory
export const platformSettingHistory = pgTable('platform_setting_history', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  settingId:           text('setting_id').notNull().references(() => platformSetting.id),
  previousValue:       jsonb('previous_value').notNull(),
  newValue:            jsonb('new_value').notNull(),
  changedByStaffId:    text('changed_by_staff_id').notNull(),
  reason:              text('reason'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  settingIdx:          index('psh_setting').on(table.settingId, table.createdAt),
}));

// §14.3 featureFlag
export const featureFlag = pgTable('feature_flag', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  key:                 text('key').notNull().unique(),
  name:                text('name').notNull(),
  description:         text('description'),
  type:                featureFlagTypeEnum('type').notNull().default('BOOLEAN'),
  enabled:             boolean('enabled').notNull().default(false),
  percentage:          integer('percentage'),
  targetingJson:       jsonb('targeting_json').notNull().default(sql`'{}'`),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §14.4 auditEvent
export const auditEvent = pgTable('audit_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  actorType:           text('actor_type').notNull(),
  actorId:             text('actor_id'),
  action:              text('action').notNull(),
  subject:             text('subject').notNull(),
  subjectId:           text('subject_id'),
  severity:            auditSeverityEnum('severity').notNull().default('LOW'),
  detailsJson:         jsonb('details_json').notNull().default(sql`'{}'`),
  ipAddress:           text('ip_address'),
  userAgent:           text('user_agent'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  actorIdx:            index('ae_actor').on(table.actorType, table.actorId),
  subjectIdx:          index('ae_subject').on(table.subject, table.subjectId),
  actionIdx:           index('ae_action').on(table.action, table.createdAt),
  severityIdx:         index('ae_severity').on(table.severity, table.createdAt),
}));

// §14.5 sequenceCounter
export const sequenceCounter = pgTable('sequence_counter', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull().unique(),
  prefix:              text('prefix').notNull(),
  currentValue:        integer('current_value').notNull().default(0),
  paddedWidth:         integer('padded_width').notNull().default(6),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §14.5.1 moduleRegistry
export const moduleRegistry = pgTable('module_registry', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  moduleId:            text('module_id').notNull().unique(),
  label:               text('label').notNull(),
  description:         text('description'),
  state:               moduleStateEnum('state').notNull().default('DISABLED'),
  version:             text('version').notNull().default('1.0.0'),
  configPath:          text('config_path'),
  manifestJson:        jsonb('manifest_json').notNull().default(sql`'{}'`),
  installedByStaffId:  text('installed_by_staff_id'),
  installedAt:         timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  stateIdx:            index('mr_state').on(table.state),
}));

// §14.6 customRole
export const customRole = pgTable('custom_role', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull().unique(),
  code:              text('code').notNull().unique(),
  description:       text('description'),
  permissionsJson:   jsonb('permissions_json').notNull().default(sql`'[]'`),
  isActive:          boolean('is_active').notNull().default(true),
  createdByStaffId:  text('created_by_staff_id').notNull(),
  updatedByStaffId:  text('updated_by_staff_id'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §14.7 staffUserCustomRole
export const staffUserCustomRole = pgTable('staff_user_custom_role', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:       text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  customRoleId:      text('custom_role_id').notNull().references(() => customRole.id, { onDelete: 'cascade' }),
  grantedByStaffId:  text('granted_by_staff_id').notNull(),
  grantedAt:         timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt:         timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  staffRoleIdx:      unique().on(table.staffUserId, table.customRoleId),
}));
