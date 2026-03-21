import { pgTable, text, integer, boolean, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { caseTypeEnum, caseStatusEnum, casePriorityEnum, caseChannelEnum, caseMessageDirectionEnum, caseMessageDeliveryStatusEnum } from './enums';

// §13.1 helpdeskCase
export const helpdeskCase = pgTable('helpdesk_case', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseNumber:          text('case_number').notNull().unique(),
  type:                caseTypeEnum('type').notNull(),
  channel:             caseChannelEnum('channel').notNull().default('WEB'),
  subject:             text('subject').notNull(),
  description:         text('description'),
  status:              caseStatusEnum('status').notNull().default('NEW'),
  priority:            casePriorityEnum('priority').notNull().default('NORMAL'),

  // Requester
  requesterId:         text('requester_id').notNull(),
  requesterEmail:      text('requester_email'),
  requesterType:       text('requester_type').notNull().default('buyer'),

  // Assignment
  assignedTeamId:      text('assigned_team_id'),
  assignedAgentId:     text('assigned_agent_id'),

  // Commerce context
  orderId:             text('order_id'),
  listingId:           text('listing_id'),
  sellerId:            text('seller_id'),
  payoutId:            text('payout_id'),
  disputeCaseId:       text('dispute_case_id'),
  returnRequestId:     text('return_request_id'),
  conversationId:      text('conversation_id'),

  // Classification
  category:            text('category'),
  subcategory:         text('subcategory'),
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),

  // SLA
  slaFirstResponseDueAt: timestamp('sla_first_response_due_at', { withTimezone: true }),
  slaResolutionDueAt: timestamp('sla_resolution_due_at', { withTimezone: true }),
  slaFirstResponseBreached: boolean('sla_first_response_breached').notNull().default(false),
  slaResolutionBreached: boolean('sla_resolution_breached').notNull().default(false),
  firstResponseAt:     timestamp('first_response_at', { withTimezone: true }),

  // Merge tracking (§28)
  mergedIntoCaseId:    text('merged_into_case_id'),

  // Lifecycle
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  closedAt:            timestamp('closed_at', { withTimezone: true }),
  reopenedAt:          timestamp('reopened_at', { withTimezone: true }),
  lastActivityAt:      timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  requesterIdx:      index('hdc_requester').on(table.requesterId),
  statusIdx:         index('hdc_status').on(table.status),
  agentIdx:          index('hdc_agent').on(table.assignedAgentId),
  teamIdx:           index('hdc_team').on(table.assignedTeamId),
  orderIdx:          index('hdc_order').on(table.orderId),
  slaResponseIdx:    index('hdc_sla_response').on(table.slaFirstResponseDueAt),
  mergedIntoIdx:     index('hdc_merged_into').on(table.mergedIntoCaseId),
}));

// §13.2 caseMessage
export const caseMessage = pgTable('case_message', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  senderType:          text('sender_type').notNull(),
  senderId:            text('sender_id'),
  senderName:          text('sender_name'),
  direction:           caseMessageDirectionEnum('direction').notNull(),
  body:                text('body').notNull(),
  bodyHtml:            text('body_html'),
  attachments:         jsonb('attachments').notNull().default(sql`'[]'`),
  deliveryStatus:      caseMessageDeliveryStatusEnum('delivery_status').notNull().default('SENT'),
  emailMessageId:      text('email_message_id'),
  fromMergedCaseId:    text('from_merged_case_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('cm_case').on(table.caseId, table.createdAt),
}));

// §13.3 caseEvent
export const caseEvent = pgTable('case_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),
  actorType:           text('actor_type').notNull(),
  actorId:             text('actor_id'),
  dataJson:            jsonb('data_json').notNull().default(sql`'{}'`),
  fromMergedCaseId:    text('from_merged_case_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('ce_case').on(table.caseId, table.createdAt),
}));

// §13.4 caseWatcher
export const caseWatcher = pgTable('case_watcher', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  staffUserId:         text('staff_user_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseStaffIdx:        unique().on(table.caseId, table.staffUserId),
}));

// §13.5 caseCsat
export const caseCsat = pgTable('case_csat', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().unique().references(() => helpdeskCase.id),
  userId:              text('user_id').notNull(),
  rating:              integer('rating').notNull(),
  comment:             text('comment'),
  surveyRequestedAt:   timestamp('survey_requested_at', { withTimezone: true }).notNull(),
  respondedAt:         timestamp('responded_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.6 helpdeskTeam
export const helpdeskTeam = pgTable('helpdesk_team', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull().unique(),
  description:         text('description'),
  isDefault:           boolean('is_default').notNull().default(false),
  maxConcurrentCases:  integer('max_concurrent_cases').notNull().default(25),
  roundRobinEnabled:   boolean('round_robin_enabled').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.7 helpdeskTeamMember
export const helpdeskTeamMember = pgTable('helpdesk_team_member', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  teamId:              text('team_id').notNull().references(() => helpdeskTeam.id, { onDelete: 'cascade' }),
  staffUserId:         text('staff_user_id').notNull(),
  isAvailable:         boolean('is_available').notNull().default(true),
  activeCaseCount:     integer('active_case_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teamStaffIdx:        unique().on(table.teamId, table.staffUserId),
}));

// §13.8 helpdeskRoutingRule
export const helpdeskRoutingRule = pgTable('helpdesk_routing_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  conditionsJson:      jsonb('conditions_json').notNull(),
  actionsJson:         jsonb('actions_json').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.9 helpdeskMacro
export const helpdeskMacro = pgTable('helpdesk_macro', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  description:         text('description'),
  bodyTemplate:        text('body_template').notNull(),
  actionsJson:         jsonb('actions_json').notNull().default(sql`'[]'`),
  isShared:            boolean('is_shared').notNull().default(true),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  usageCount:          integer('usage_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.10 helpdeskSlaPolicy
export const helpdeskSlaPolicy = pgTable('helpdesk_sla_policy', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  priority:            casePriorityEnum('priority').notNull().unique(),
  firstResponseMinutes: integer('first_response_minutes').notNull(),
  resolutionMinutes:   integer('resolution_minutes').notNull(),
  businessHoursOnly:   boolean('business_hours_only').notNull().default(true),
  escalateOnBreach:    boolean('escalate_on_breach').notNull().default(false),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.11 helpdeskAutomationRule
export const helpdeskAutomationRule = pgTable('helpdesk_automation_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  triggerEvent:        text('trigger_event').notNull(),
  conditionsJson:      jsonb('conditions_json').notNull().default(sql`'[]'`),
  actionsJson:         jsonb('actions_json').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.12 helpdeskSavedView
export const helpdeskSavedView = pgTable('helpdesk_saved_view', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  staffUserId:         text('staff_user_id'),
  filtersJson:         jsonb('filters_json').notNull(),
  sortJson:            jsonb('sort_json').notNull().default(sql`'{}'`),
  isDefault:           boolean('is_default').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.13 helpdeskEmailConfig
export const helpdeskEmailConfig = pgTable('helpdesk_email_config', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  fromName:            text('from_name').notNull().default('Twicely Support'),
  fromEmail:           text('from_email').notNull().default('support@twicely.co'),
  replyToPattern:      text('reply_to_pattern').notNull().default('case+{caseId}@support.twicely.co'),
  signatureHtml:       text('signature_html'),
  autoReplyEnabled:    boolean('auto_reply_enabled').notNull().default(true),
  autoReplyTemplateKey: text('auto_reply_template_key').notNull().default('helpdesk.case.auto_reply'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
