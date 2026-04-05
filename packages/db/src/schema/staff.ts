import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { platformRoleEnum } from './enums';

// §2.6 staffUser (Platform Staff – Separate from Marketplace)
export const staffUser = pgTable('staff_user', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  email:           text('email').notNull().unique(),
  displayName:     text('display_name').notNull(),
  passwordHash:    text('password_hash').notNull(),
  mfaEnabled:      boolean('mfa_enabled').notNull().default(false),
  mfaRequired:     boolean('mfa_required').notNull().default(false),
  mfaSecret:       text('mfa_secret'),
  recoveryCodes:   text('recovery_codes'),
  isActive:        boolean('is_active').notNull().default(true),
  lastLoginAt:     timestamp('last_login_at', { withTimezone: true }),
  signatureHtml:   text('signature_html'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx:        index('su_email').on(table.email),
}));

// §2.7 staffUserRole
export const staffUserRole = pgTable('staff_user_role', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:     text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  role:            platformRoleEnum('role').notNull(),
  grantedByStaffId: text('granted_by_staff_id').notNull(),
  grantedAt:       timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt:       timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  staffRoleIdx:    index('sur_staff_role').on(table.staffUserId, table.role),
}));

// §2.8 staffSession
export const staffSession = pgTable('staff_session', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:     text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  token:           text('token').notNull().unique(),
  ipAddress:       text('ip_address'),
  userAgent:       text('user_agent'),
  mfaVerified:     boolean('mfa_verified').notNull().default(false),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  lastActivityAt:  timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx:        index('ss_token').on(table.token),
  staffIdx:        index('ss_staff').on(table.staffUserId),
}));
