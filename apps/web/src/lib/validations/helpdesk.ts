import { z } from 'zod';
import { zodId } from './shared';

// Internal IDs (case, staff, team, etc.) may be cuid2 or seed-format strings.
const internalId = zodId;

const attachmentSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
});

// Case creation (user-initiated via /h/contact)
export const createCaseSchema = z.object({
  type: z.enum(['SUPPORT', 'ORDER', 'RETURN', 'BILLING', 'ACCOUNT']),
  subject: z.string().min(10).max(200),
  description: z.string().min(50).max(5000),
  orderId: internalId.optional(),
  listingId: internalId.optional(),
  attachments: z.array(attachmentSchema).max(5).optional(),
}).strict();

// Case message (user reply)
export const createCaseMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachments: z.array(attachmentSchema).max(5).optional(),
}).strict();

// Agent reply (staff)
export const agentReplySchema = z.object({
  caseId: internalId,
  body: z.string().min(1).max(10000),
  bodyHtml: z.string().optional(),
  isInternal: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(5).optional(),
}).strict();

// Case status update
export const updateCaseStatusSchema = z.object({
  caseId: internalId,
  status: z.enum(['OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED']),
}).strict();

// Case assignment
export const assignCaseSchema = z.object({
  caseId: internalId,
  assignedAgentId: internalId.nullable(),
  assignedTeamId: internalId.nullable(),
}).strict();

// Case priority update
export const updateCasePrioritySchema = z.object({
  caseId: internalId,
  priority: z.enum(['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']),
}).strict();

// CSAT submission
export const submitCsatSchema = z.object({
  caseId: internalId,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
}).strict();

// Macro CRUD
export const createMacroSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  bodyTemplate: z.string().min(1).max(10000),
  actionsJson: z.array(z.object({
    type: z.string(),
    value: z.unknown(),
  })).optional(),
  isShared: z.boolean().default(true),
}).strict();

// Saved view
export const createSavedViewSchema = z.object({
  name: z.string().min(1).max(100),
  filtersJson: z.record(z.string(), z.unknown()),
  sortJson: z.record(z.string(), z.unknown()).optional(),
  isDefault: z.boolean().default(false),
}).strict();

// KB article
export const createKbArticleSchema = z.object({
  categoryId: internalId,
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(200),
  excerpt: z.string().max(300).optional(),
  body: z.string().min(10),
  bodyFormat: z.enum(['MARKDOWN', 'HTML', 'RICHTEXT']).default('MARKDOWN'),
  audience: z.enum(['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY']).default('ALL'),
  tags: z.array(z.string()).optional(),
  searchKeywords: z.array(z.string()).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(300).optional(),
  isFeatured: z.boolean().default(false),
  isPinned: z.boolean().default(false),
}).strict();

// KB category
export const createKbCategorySchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  parentId: internalId.nullable().optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

// KB article feedback
export const submitArticleFeedbackSchema = z.object({
  articleId: internalId,
  helpful: z.boolean(),
  comment: z.string().max(500).optional(),
}).strict();

// KB article update
export const updateKbArticleSchema = z.object({
  articleId: internalId,
  categoryId: internalId.optional(),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(3).max(200).optional(),
  excerpt: z.string().max(300).optional().nullable(),
  body: z.string().min(10).optional(),
  bodyFormat: z.enum(['MARKDOWN', 'HTML', 'RICHTEXT']).optional(),
  audience: z.enum(['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY']).optional(),
  tags: z.array(z.string()).optional(),
  searchKeywords: z.array(z.string()).optional(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(300).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPinned: z.boolean().optional(),
}).strict();

// KB category update
export const updateKbCategorySchema = z.object({
  categoryId: internalId,
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  parentId: internalId.nullable().optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
}).strict();

// KB search query
export const kbSearchSchema = z.object({
  q: z.string().min(1).max(200),
  categorySlug: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
}).strict();

// Case tags update
export const updateCaseTagsSchema = z.object({
  caseId: internalId,
  tags: z.array(z.string()),
}).strict();

// Agent-created case (internal)
export const createAgentCaseSchema = z.object({
  type: z.enum(['SUPPORT', 'ORDER', 'RETURN', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM']),
  subject: z.string().min(10).max(200),
  description: z.string().min(10).max(5000),
  requesterId: internalId,
  orderId: internalId.optional(),
  listingId: internalId.optional(),
  priority: z.enum(['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
}).strict();

// ─── Management schemas (G9.2) ─────────────────────────────────────────────────

// Macro update
export const updateMacroSchema = z.object({
  macroId: internalId,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  bodyTemplate: z.string().min(1).max(10000).optional(),
  actionsJson: z.array(z.object({ type: z.string(), value: z.unknown() })).optional(),
  isShared: z.boolean().optional(),
}).strict();

// Team
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxConcurrentCases: z.number().int().min(1).max(100).default(25),
  roundRobinEnabled: z.boolean().default(true),
}).strict();

export const updateTeamSchema = z.object({
  teamId: internalId,
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  maxConcurrentCases: z.number().int().min(1).max(100).optional(),
  roundRobinEnabled: z.boolean().optional(),
}).strict();

// Routing rule condition/action shapes
const routingConditionSchema = z.object({
  field: z.enum(['type', 'channel', 'priority', 'subject', 'tags', 'requesterType']),
  operator: z.enum(['eq', 'in', 'contains', 'gte', 'lte', 'startsWith']),
  value: z.union([z.string(), z.array(z.string())]),
});

const routingActionSchema = z.object({
  assignTeamId: internalId.optional(),
  assignAgentId: internalId.optional(),
  setPriority: z.enum(['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']).optional(),
  addTags: z.array(z.string()).optional(),
  setCategory: z.string().max(100).optional(),
});

export const createRoutingRuleSchema = z.object({
  name: z.string().min(1).max(200),
  conditionsJson: z.array(routingConditionSchema).min(1),
  actionsJson: routingActionSchema,
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
}).strict();

export const updateRoutingRuleSchema = z.object({
  ruleId: internalId,
  name: z.string().min(1).max(200).optional(),
  conditionsJson: z.array(routingConditionSchema).min(1).optional(),
  actionsJson: routingActionSchema.optional(),
  isActive: z.boolean().optional(),
}).strict();

// Automation rule
const automationTriggerEnum = z.enum([
  'CASE_CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED',
  'SLA_WARNING', 'SLA_BREACHED', 'NO_RESPONSE',
  'AGENT_ASSIGNED', 'MESSAGE_RECEIVED', 'CASE_REOPENED',
]);

const automationConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'in', 'gte', 'lte', 'contains']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const automationActionSchema = z.object({
  type: z.enum([
    'SET_PRIORITY', 'ASSIGN_TEAM', 'ASSIGN_AGENT',
    'ADD_TAGS', 'REMOVE_TAGS', 'SET_STATUS',
    'SEND_NOTIFICATION', 'ADD_NOTE',
  ]),
  value: z.unknown(),
});

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  triggerEvent: automationTriggerEnum,
  conditionsJson: z.array(automationConditionSchema),
  actionsJson: z.array(automationActionSchema).min(1),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
}).strict();

export const updateAutomationRuleSchema = z.object({
  ruleId: internalId,
  name: z.string().min(1).max(200).optional(),
  triggerEvent: automationTriggerEnum.optional(),
  conditionsJson: z.array(automationConditionSchema).optional(),
  actionsJson: z.array(automationActionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
}).strict();

// SLA policy (extended)
export const updateSlaPolicySchema = z.object({
  policyId: internalId,
  firstResponseMinutes: z.number().int().min(1).optional(),
  resolutionMinutes: z.number().int().min(1).optional(),
  businessHoursOnly: z.boolean().optional(),
  escalateOnBreach: z.boolean().optional(),
}).strict();

// Merge cases — canonical §28
export const mergeCasesSchema = z.object({
  sourceCaseId: internalId,
  targetCaseId: internalId,
}).strict();

// Report date range
export const reportDateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preset: z.enum(['today', 'this_week', 'this_month', 'last_30_days']).optional(),
}).strict();
