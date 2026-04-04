import { pgTable, text, integer, boolean, timestamp, jsonb, real, date, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { sellerProfile } from './identity';

// §18.2 expense
export const expense = pgTable('expense', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category:            text('category').notNull(),     // From platform setting: finance.expenseCategories
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  vendor:              text('vendor'),
  description:         text('description'),
  receiptUrl:          text('receipt_url'),             // R2 stored receipt photo
  receiptDataJson:     jsonb('receipt_data_json'),      // AI-extracted receipt data
  expenseDate:         timestamp('expense_date', { withTimezone: true }).notNull(),
  isRecurring:         boolean('is_recurring').notNull().default(false),
  recurringFrequency:  text('recurring_frequency'),    // 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
  recurringEndDate:    timestamp('recurring_end_date', { withTimezone: true }),
  parentExpenseId:     text('parent_expense_id'),      // Self-ref for recurring source
  // Intelligence layer — sourcing & automation
  sourcingTripGroupId: text('sourcing_trip_group_id'),
  isAutoLogged:        boolean('is_auto_logged').notNull().default(false),
  autoLogEventType:    text('auto_log_event_type'),
  recurringExpenseId:  text('recurring_expense_id'),    // FK to recurring_expense.id
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDateIdx:         index('exp_user_date').on(table.userId, table.expenseDate),
  userCatIdx:          index('exp_user_cat').on(table.userId, table.category),
  sourcingTripIdx:     index('exp_sourcing_trip').on(table.sourcingTripGroupId).where(sql`sourcing_trip_group_id IS NOT NULL`),
}));

// §18.3 mileageEntry
export const mileageEntry = pgTable('mileage_entry', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  description:     text('description').notNull(),
  miles:           real('miles').notNull(),
  ratePerMile:     real('rate_per_mile').notNull(),     // IRS rate from platform setting
  deductionCents:  integer('deduction_cents').notNull(),
  tripDate:        timestamp('trip_date', { withTimezone: true }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDateIdx:     index('mi_user_date').on(table.userId, table.tripDate),
}));

// §18.4 financialReport
export const financialReport = pgTable('financial_report', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reportType:      text('report_type').notNull(),      // 'PNL' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'TAX_PREP' | 'INVENTORY_AGING'
  periodStart:     timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:       timestamp('period_end', { withTimezone: true }).notNull(),
  snapshotJson:    jsonb('snapshot_json').notNull(),
  format:          text('format').notNull(),            // 'JSON' | 'CSV' | 'PDF'
  fileUrl:         text('file_url'),                    // R2 stored exported file
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTypeIdx:     index('fr_user_type').on(table.userId, table.reportType),
}));

// §18.5 accountingIntegration
export const accountingIntegration = pgTable('accounting_integration', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider:          text('provider').notNull(),        // 'QUICKBOOKS' | 'XERO'
  accessToken:       text('access_token'),              // Encrypted at app layer
  refreshToken:      text('refresh_token'),             // Encrypted at app layer
  externalAccountId: text('external_account_id'),
  lastSyncAt:        timestamp('last_sync_at', { withTimezone: true }),
  status:            text('status').notNull(),          // 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userProviderIdx:   unique().on(table.userId, table.provider),
}));

// §18.6 financialProjection — nightly cache for intelligence layer metrics
export const financialProjection = pgTable('financial_projection', {
  id:                        text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:           text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  projectedRevenue30dCents:  integer('projected_revenue_30d_cents'),
  projectedExpenses30dCents: integer('projected_expenses_30d_cents'),
  projectedProfit30dCents:   integer('projected_profit_30d_cents'),
  sellThroughRate90d:        integer('sell_through_rate_90d'),         // basis points
  avgSalePrice90dCents:      integer('avg_sale_price_90d_cents'),
  effectiveFeeRate90d:       integer('effective_fee_rate_90d'),        // basis points
  avgDaysToSell90d:          integer('avg_days_to_sell_90d'),
  breakEvenRevenueCents:     integer('break_even_revenue_cents'),
  breakEvenOrders:           integer('break_even_orders'),
  healthScore:               integer('health_score'),                  // 0-100
  healthScoreBreakdownJson:  jsonb('health_score_breakdown_json'),
  inventoryTurnsPerMonth:    integer('inventory_turns_per_month'),     // basis points
  performingPeriodsJson:     jsonb('performing_periods_json'),
  dataQualityScore:          integer('data_quality_score').notNull().default(0),
  computedAt:                timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});

// §18.7 recurringExpense — rules for auto-creating expense entries on schedule
export const recurringExpense = pgTable('recurring_expense', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  userId:        text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category:      text('category').notNull(),
  amountCents:   integer('amount_cents').notNull(),
  vendor:        text('vendor'),
  description:   text('description'),
  frequency:     text('frequency').notNull(),     // 'MONTHLY' | 'WEEKLY' | 'ANNUAL'
  startDate:     date('start_date').notNull(),
  endDate:       date('end_date'),
  isActive:      boolean('is_active').notNull().default(true),
  lastCreatedAt: date('last_created_at'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActiveIdx: index('re_user_active').on(table.userId, table.isActive),
}));
