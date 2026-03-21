import { pgTable, text, integer, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

// ai_autofill_usage — tracks monthly auto-fill usage per user
export const aiAutofillUsage = pgTable('ai_autofill_usage', {
  id:        text('id').primaryKey().$defaultFn(() => createId()),
  userId:    text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  monthKey:  text('month_key').notNull(),  // format: "2026-03"
  count:     integer('count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userMonthIdx: unique().on(table.userId, table.monthKey),
  userIdx:      index('aau_user').on(table.userId),
}));
