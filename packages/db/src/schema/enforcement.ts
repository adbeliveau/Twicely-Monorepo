import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  contentReportReasonEnum,
  contentReportStatusEnum,
  contentReportTargetEnum,
  enforcementActionTypeEnum,
  enforcementActionStatusEnum,
  enforcementTriggerEnum,
} from './enums';
import { user } from './auth';

// §8.6 contentReport — user-submitted reports on listings, reviews, messages, users (G4)
export const contentReport = pgTable('content_report', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: content reports are moderation records — must survive user deletion for audit
  reporterUserId: text('reporter_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  targetType:     contentReportTargetEnum('target_type').notNull(),
  targetId:       text('target_id').notNull(),
  reason:         contentReportReasonEnum('reason').notNull(),
  description:    text('description'),
  status:         contentReportStatusEnum('status').notNull().default('PENDING'),
  reviewedByStaffId: text('reviewed_by_staff_id'),
  reviewedAt:     timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes:    text('review_notes'),
  enforcementActionId: text('enforcement_action_id'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reporterIdx: index('cr_reporter').on(table.reporterUserId),
  targetIdx:   index('cr_target').on(table.targetType, table.targetId),
  statusIdx:   index('cr_status').on(table.status),
  createdIdx:  index('cr_created').on(table.createdAt),
}));

// §8.7 enforcementAction — staff-issued enforcement actions against sellers/users (G4)
export const enforcementAction = pgTable('enforcement_action', {
  id:             text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: enforcement actions are moderation audit records — must survive user deletion
  userId:         text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  actionType:     enforcementActionTypeEnum('action_type').notNull(),
  trigger:        enforcementTriggerEnum('trigger').notNull(),
  status:         enforcementActionStatusEnum('status').notNull().default('ACTIVE'),
  reason:         text('reason').notNull(),
  details:        jsonb('details').notNull().default('{}'),
  contentReportId: text('content_report_id'),
  issuedByStaffId: text('issued_by_staff_id'),
  expiresAt:      timestamp('expires_at', { withTimezone: true }),
  liftedAt:       timestamp('lifted_at', { withTimezone: true }),
  liftedByStaffId: text('lifted_by_staff_id'),
  liftedReason:   text('lifted_reason'),
  // Appeal fields (G4.2)
  appealNote:              text('appeal_note'),
  appealEvidenceUrls:      text('appeal_evidence_urls').array().notNull().default(sql`'{}'::text[]`),
  appealedAt:              timestamp('appealed_at', { withTimezone: true }),
  appealedByUserId:        text('appealed_by_user_id'),
  appealReviewedByStaffId: text('appeal_reviewed_by_staff_id'),
  appealReviewNote:        text('appeal_review_note'),
  appealResolvedAt:        timestamp('appeal_resolved_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:    index('ea_user').on(table.userId),
  typeIdx:    index('ea_type').on(table.actionType),
  statusIdx:  index('ea_status').on(table.status),
  triggerIdx: index('ea_trigger').on(table.trigger),
  createdIdx: index('ea_created').on(table.createdAt),
}));
