/**
 * Disputes Automation Schema (V4 Phase 08)
 *
 * Six new tables for the automated dispute resolution system:
 *   - disputeRule: configurable auto-resolution rules
 *   - disputeRuleExecution: immutable audit trail of rule evaluations
 *   - disputeSla: per-dispute SLA tracking with escalation triggers
 *   - disputeEvidence: structured evidence records
 *   - disputeTimeline: immutable event log
 *   - disputeResolution: final resolution with Decision #92 waterfall result
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { dispute } from './shipping';

// 7.4 disputeRule — configurable auto-resolution rules managed by Trust & Safety
export const disputeRule = pgTable('dispute_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').unique().notNull(),
  ruleType:            text('rule_type').notNull(),
  priority:            integer('priority').notNull().default(100),
  conditions:          jsonb('conditions').notNull(),
  action:              text('action').notNull(),
  actionParams:        jsonb('action_params').notNull().default('{}'),
  isActive:            boolean('is_active').notNull().default(true),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ruleTypeActiveIdx:   index('dr_rule_type_active').on(table.ruleType, table.isActive),
  priorityIdx:         index('dr_priority').on(table.priority),
}));

// 7.5 disputeRuleExecution — immutable audit trail of every rule evaluation
export const disputeRuleExecution = pgTable('dispute_rule_execution', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  ruleId:              text('rule_id')
    .references(() => disputeRule.id, { onDelete: 'set null' }),
  ruleName:            text('rule_name').notNull(),
  conditions:          jsonb('conditions').notNull(),
  context:             jsonb('context').notNull(),
  action:              text('action').notNull(),
  outcome:             text('outcome').notNull(),
  errorMessage:        text('error_message'),
  executedAt:          timestamp('executed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeTimeIdx:      index('dre_dispute_time').on(table.disputeId, table.executedAt),
  ruleIdx:             index('dre_rule').on(table.ruleId),
}));

// 7.6 disputeSla — per-dispute SLA tracking with escalation
export const disputeSla = pgTable('dispute_sla', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').unique().notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  currentStage:        text('current_stage').notNull(),
  stageStartedAt:      timestamp('stage_started_at', { withTimezone: true }).notNull(),
  slaDeadline:         timestamp('sla_deadline', { withTimezone: true }).notNull(),
  escalatedAt:         timestamp('escalated_at', { withTimezone: true }),
  isOverdue:           boolean('is_overdue').notNull().default(false),
  escalationLevel:     integer('escalation_level').notNull().default(0),
}, (table) => ({
  deadlineOverdueIdx:  index('dsla_deadline_overdue').on(table.slaDeadline, table.isOverdue),
  stageIdx:            index('dsla_stage').on(table.currentStage),
  escalationIdx:       index('dsla_escalation').on(table.escalationLevel),
}));

// 7.7 disputeEvidence — structured evidence records
export const disputeEvidence = pgTable('dispute_evidence', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  submittedBy:         text('submitted_by').notNull(),
  submitterId:         text('submitter_id').notNull(),
  evidenceType:        text('evidence_type').notNull(),
  description:         text('description'),
  storageKey:          text('storage_key'),
  metadata:            jsonb('metadata').notNull().default('{}'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeSubmitterIdx: index('de_dispute_submitter').on(table.disputeId, table.submittedBy),
}));

// 7.8 disputeTimeline — immutable event log
export const disputeTimeline = pgTable('dispute_timeline', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').notNull()
    .references(() => dispute.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),
  actorType:           text('actor_type').notNull(),
  actorId:             text('actor_id'),
  description:         text('description').notNull(),
  metadata:            jsonb('metadata').notNull().default('{}'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  disputeTimeIdx:      index('dt_dispute_time').on(table.disputeId, table.createdAt),
}));

// 7.9 disputeResolution — final resolution record with Decision #92 waterfall result
export const disputeResolution = pgTable('dispute_resolution', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  disputeId:           text('dispute_id').unique().notNull()
    .references(() => dispute.id, { onDelete: 'restrict' }),
  outcome:             text('outcome').notNull(),
  reason:              text('reason').notNull(),
  refundCents:         integer('refund_cents').notNull().default(0),
  sellerDebited:       boolean('seller_debited').notNull().default(false),
  resolvedBy:          text('resolved_by').notNull(),
  resolvedById:        text('resolved_by_id'),
  ruleId:              text('rule_id')
    .references(() => disputeRule.id, { onDelete: 'set null' }),
  waterfallResult:     jsonb('waterfall_result'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  outcomeIdx:          index('dres_outcome').on(table.outcome),
  resolvedByIdx:       index('dres_resolved_by').on(table.resolvedBy),
}));
