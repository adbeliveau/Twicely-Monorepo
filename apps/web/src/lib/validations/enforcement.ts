import { z } from 'zod';
import { zodId } from './shared';

// Target types for content reports
const contentReportTargetTypeEnum = z.enum(['LISTING', 'REVIEW', 'MESSAGE', 'USER']);

// Reasons for content reports
const contentReportReasonEnum = z.enum([
  'COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY',
  'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE',
  'SHILL_REVIEWS', 'OTHER',
]);

// Enforcement action types
const enforcementActionTypeEnum = z.enum([
  'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
  'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN',
]);

// Enforcement trigger types (staff can only use these 3 — not SCORE_BASED or SYSTEM_AUTO)
const staffTriggerEnum = z.enum(['POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL']);

// Performance band values
const performanceBandEnum = z.enum(['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']);

/** User-submitted content report */
export const contentReportSchema = z.object({
  targetType:  contentReportTargetTypeEnum,
  targetId:    zodId,
  reason:      contentReportReasonEnum,
  description: z.string().max(1000).optional(),
}).strict();

/** Staff reviewing a content report */
export const reviewContentReportSchema = z.object({
  reportId:    zodId,
  status:      z.enum(['CONFIRMED', 'DISMISSED']),
  reviewNotes: z.string().max(2000).optional(),
}).strict();

/** Staff issuing an enforcement action */
export const issueEnforcementActionSchema = z.object({
  userId:          zodId,
  actionType:      enforcementActionTypeEnum,
  trigger:         staffTriggerEnum,
  reason:          z.string().min(1).max(2000),
  contentReportId: zodId.optional(),
  expiresAt:       z.string().datetime().optional(),
}).strict();

/** Staff lifting an enforcement action */
export const liftEnforcementActionSchema = z.object({
  actionId:     zodId,
  liftedReason: z.string().min(1).max(2000),
}).strict();

/** Admin updating seller enforcement level and/or band override */
export const updateSellerEnforcementSchema = z.object({
  userId:              zodId,
  enforcementLevel:    z.enum(['COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION']).nullable().optional(),
  bandOverride:        performanceBandEnum.optional(),
  bandOverrideReason:  z.string().max(500).optional(),
}).strict();

export type ContentReportInput = z.infer<typeof contentReportSchema>;
export type ReviewContentReportInput = z.infer<typeof reviewContentReportSchema>;
export type IssueEnforcementActionInput = z.infer<typeof issueEnforcementActionSchema>;
export type LiftEnforcementActionInput = z.infer<typeof liftEnforcementActionSchema>;
export type UpdateSellerEnforcementInput = z.infer<typeof updateSellerEnforcementSchema>;

/** Seller submitting an appeal on an enforcement action */
export const submitAppealSchema = z.object({
  enforcementActionId: zodId,
  appealNote:          z.string().min(10).max(2000),
  appealEvidenceUrls:  z.array(z.string().url()).max(5).optional(),
}).strict();

/** Staff reviewing an enforcement appeal */
export const reviewAppealSchema = z.object({
  enforcementActionId: zodId,
  decision:            z.enum(['APPROVED', 'DENIED']),
  reviewNote:          z.string().min(1).max(2000),
}).strict();

export type SubmitAppealInput = z.infer<typeof submitAppealSchema>;
export type ReviewAppealInput = z.infer<typeof reviewAppealSchema>;
