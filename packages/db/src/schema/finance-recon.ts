/**
 * Finance Reconciliation Schema
 *
 * Tables for reconciliation runs, variances, and rules.
 * Canonical 31: Stripe-ledger reconciliation, variance detection,
 * mismatch tracking, and resolution lifecycle.
 *
 * Immutability rule: Reconciliation NEVER mutates ledger entries.
 * Corrections are separate reversal entries. Reports are immutable once generated.
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { reconciliationReport, ledgerEntry } from './finance';

// --- reconciliationVariance -------------------------------------------------

export const reconciliationVariance = pgTable('reconciliation_variance', {
  id:                     text('id').primaryKey().$defaultFn(() => createId()),
  reconciliationReportId: text('reconciliation_report_id').notNull()
                            .references(() => reconciliationReport.id, { onDelete: 'cascade' }),

  // Variance classification
  type:                   text('type').notNull(),
    // 'UNMATCHED_STRIPE_EVENT' | 'ORPHANED_LEDGER_ENTRY' | 'AMOUNT_MISMATCH' |
    // 'DUPLICATE_STRIPE_EVENT' | 'TIMING_DIFFERENCE'
  severity:               text('severity').notNull(),
    // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

  // References (at least one must be non-null)
  stripeEventId:          text('stripe_event_id'),
  stripeObjectType:       text('stripe_object_type'),
  ledgerEntryId:          text('ledger_entry_id')
                            .references(() => ledgerEntry.id, { onDelete: 'restrict' }),

  // Amounts (integer cents)
  stripeAmountCents:      integer('stripe_amount_cents'),
  ledgerAmountCents:      integer('ledger_amount_cents'),
  varianceAmountCents:    integer('variance_amount_cents').notNull(),

  // Context
  orderId:                text('order_id'),
  userId:                 text('user_id'),

  // Resolution lifecycle
  isResolved:             boolean('is_resolved').notNull().default(false),
  resolvedAt:             timestamp('resolved_at', { withTimezone: true }),
  resolvedByStaffId:      text('resolved_by_staff_id'),
  resolutionType:         text('resolution_type'),
  resolutionNote:         text('resolution_note'),
  correctionLedgerEntryId: text('correction_ledger_entry_id'),

  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportIdx:     index('rv_report').on(table.reconciliationReportId),
  typeIdx:       index('rv_type_resolved').on(table.type, table.isResolved),
  stripeIdx:     index('rv_stripe_event').on(table.stripeEventId),
  ledgerIdx:     index('rv_ledger_entry').on(table.ledgerEntryId),
  severityIdx:   index('rv_severity').on(table.severity, table.isResolved),
}));

// --- reconRule --------------------------------------------------------------

export const reconRule = pgTable('recon_rule', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull(),
  description:       text('description'),
  varianceType:      text('variance_type').notNull(),
  thresholdCents:    integer('threshold_cents').notNull().default(0),
  thresholdPercent:  integer('threshold_percent'),
  autoResolveBelow:  integer('auto_resolve_below').notNull().default(0),
  isActive:          boolean('is_active').notNull().default(true),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  varianceTypeIdx:   index('rr_rule_variance_type').on(table.varianceType, table.isActive),
  nameIdx:           uniqueIndex('rr_rule_name').on(table.name),
}));

// --- financeSnapshot --------------------------------------------------------

export const financeSnapshot = pgTable('finance_snapshot', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  periodType:            text('period_type').notNull(),
  periodStart:           timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:             timestamp('period_end', { withTimezone: true }).notNull(),

  grossRevenueCents:     integer('gross_revenue_cents').notNull().default(0),
  netRevenueCents:       integer('net_revenue_cents').notNull().default(0),
  totalFeesCents:        integer('total_fees_cents').notNull().default(0),
  totalRefundsCents:     integer('total_refunds_cents').notNull().default(0),
  totalPayoutsCents:     integer('total_payouts_cents').notNull().default(0),
  totalChargebacksCents: integer('total_chargebacks_cents').notNull().default(0),

  orderCount:            integer('order_count').notNull().default(0),
  refundCount:           integer('refund_count').notNull().default(0),
  chargebackCount:       integer('chargeback_count').notNull().default(0),
  payoutCount:           integer('payout_count').notNull().default(0),

  dataJson:              jsonb('data_json').notNull().default(sql`'{}'`),
  generatedByStaffId:    text('generated_by_staff_id'),
  generatedAt:           timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodIdx:     uniqueIndex('fs_period').on(table.periodType, table.periodStart, table.periodEnd),
  periodTypeIdx: index('fs_period_type').on(table.periodType, table.periodStart),
}));
