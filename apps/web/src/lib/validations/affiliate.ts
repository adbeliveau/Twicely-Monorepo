import { z } from 'zod';

export const joinAffiliateSchema = z.object({
  referralCode: z.string()
    .min(3, 'Referral code must be at least 3 characters')
    .max(30, 'Referral code must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, and underscores allowed')
    .transform((val) => val.toUpperCase())
    .optional(),
}).strict();

export type JoinAffiliateInput = z.infer<typeof joinAffiliateSchema>;

// ─── Influencer Application ──────────────────────────────────────────────────

export const applyInfluencerSchema = z.object({
  applicationNote: z.string()
    .min(20, 'Application note must be at least 20 characters')
    .max(2000, 'Application note must be at most 2000 characters'),
  referralCode: z.string()
    .min(3, 'Referral code must be at least 3 characters')
    .max(30, 'Referral code must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, and underscores allowed')
    .transform((val) => val.toUpperCase())
    .optional(),
  socialLinks: z.object({
    instagram: z.string().url('Invalid Instagram URL').optional(),
    youtube: z.string().url('Invalid YouTube URL').optional(),
    tiktok: z.string().url('Invalid TikTok URL').optional(),
    blog: z.string().url('Invalid blog URL').optional(),
  }).optional(),
  audienceSize: z.number().int().min(0, 'Audience size must be 0 or greater').optional(),
}).strict();

export type ApplyInfluencerInput = z.infer<typeof applyInfluencerSchema>;

// ─── Admin Approval / Rejection / Moderation ────────────────────────────────

export const approveInfluencerSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  commissionRateBps: z.number().int().min(2000, 'Minimum commission is 20%').max(3000, 'Maximum commission is 30%'),
  cookieDurationDays: z.number().int().min(30).max(90).default(60),
  commissionDurationMonths: z.number().int().min(6).max(24).default(12),
  adminNote: z.string().max(500, 'Admin note must be at most 500 characters').optional(),
}).strict();

export type ApproveInfluencerInput = z.infer<typeof approveInfluencerSchema>;

export const rejectInfluencerSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  rejectionReason: z.string().min(10, 'Rejection reason must be at least 10 characters').max(500, 'Rejection reason must be at most 500 characters'),
}).strict();

export type RejectInfluencerInput = z.infer<typeof rejectInfluencerSchema>;

export const suspendAffiliateSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason must be at most 500 characters'),
}).strict();

export type SuspendAffiliateInput = z.infer<typeof suspendAffiliateSchema>;

export const banAffiliateSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason must be at most 500 characters'),
}).strict();

export type BanAffiliateInput = z.infer<typeof banAffiliateSchema>;

export const unsuspendAffiliateSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
}).strict();

export type UnsuspendAffiliateInput = z.infer<typeof unsuspendAffiliateSchema>;

// ─── Commission Rate Update ──────────────────────────────────────────────────

export const updateCommissionRateSchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  commissionRateBps: z.number().int().min(100, 'Minimum rate is 1%').max(5000, 'Maximum rate is 50%'),
}).strict();

export type UpdateCommissionRateInput = z.infer<typeof updateCommissionRateSchema>;

// ─── G3.6 — Seller affiliate opt-in controls ────────────────────────────────

export const updateAffiliateOptInSchema = z.object({
  optIn: z.boolean(),
}).strict();

export type UpdateAffiliateOptInInput = z.infer<typeof updateAffiliateOptInSchema>;

export const updateAffiliateCommissionRateSchema = z.object({
  commissionBps: z.number().int().min(200, 'Minimum rate is 2%').max(1000, 'Maximum rate is 10%').nullable(),
  // null = use platform default; 200 = 2%, 1000 = 10%
}).strict();

export type UpdateAffiliateCommissionRateInput = z.infer<typeof updateAffiliateCommissionRateSchema>;
