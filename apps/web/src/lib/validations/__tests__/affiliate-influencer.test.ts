import { describe, it, expect } from 'vitest';
import {
  applyInfluencerSchema,
  approveInfluencerSchema,
  rejectInfluencerSchema,
  suspendAffiliateSchema,
  unsuspendAffiliateSchema,
  banAffiliateSchema,
} from '../affiliate';

// ─── applyInfluencerSchema ────────────────────────────────────────────────────

describe('applyInfluencerSchema', () => {
  const validNote = 'I have 50,000 followers on Instagram and post resale content daily.';

  it('accepts minimum valid input with just applicationNote', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote });
    expect(result.success).toBe(true);
  });

  it('rejects applicationNote shorter than 20 characters', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: 'Too short.' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('20 characters');
    }
  });

  it('rejects applicationNote longer than 2000 characters', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: 'A'.repeat(2001) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('2000 characters');
    }
  });

  it('accepts applicationNote at exact minimum (20 chars)', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: 'A'.repeat(20) });
    expect(result.success).toBe(true);
  });

  it('accepts applicationNote at exact maximum (2000 chars)', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: 'A'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  it('uppercases optional referralCode via transform', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, referralCode: 'my-code' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referralCode).toBe('MY-CODE');
    }
  });

  it('rejects referralCode shorter than 3 characters', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, referralCode: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rejects referralCode longer than 30 characters', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, referralCode: 'A'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('rejects referralCode with special chars (only letters, numbers, hyphens, underscores)', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, referralCode: 'MY@CODE' });
    expect(result.success).toBe(false);
  });

  it('accepts valid socialLinks', () => {
    const result = applyInfluencerSchema.safeParse({
      applicationNote: validNote,
      socialLinks: { instagram: 'https://instagram.com/seller' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects socialLinks with invalid URL', () => {
    const result = applyInfluencerSchema.safeParse({
      applicationNote: validNote,
      socialLinks: { instagram: 'not-a-url' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid audienceSize of 0', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, audienceSize: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects negative audienceSize', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, audienceSize: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('0 or greater');
    }
  });

  it('rejects non-integer audienceSize', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, audienceSize: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (.strict())', () => {
    const result = applyInfluencerSchema.safeParse({ applicationNote: validNote, extra: 'bad' });
    expect(result.success).toBe(false);
  });
});

// ─── approveInfluencerSchema ──────────────────────────────────────────────────

describe('approveInfluencerSchema', () => {
  const validApprove = {
    affiliateId: 'aff-test-1',
    commissionRateBps: 2500,
    cookieDurationDays: 60,
    commissionDurationMonths: 12,
  };

  it('accepts valid approve input with defaults', () => {
    const result = approveInfluencerSchema.safeParse(validApprove);
    expect(result.success).toBe(true);
  });

  it('rejects commissionRateBps below 2000 (minimum 20%)', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, commissionRateBps: 1999 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Minimum commission is 20%');
    }
  });

  it('rejects commissionRateBps above 3000 (maximum 30%)', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, commissionRateBps: 3001 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Maximum commission is 30%');
    }
  });

  it('accepts commissionRateBps at boundary values 2000 and 3000', () => {
    expect(approveInfluencerSchema.safeParse({ ...validApprove, commissionRateBps: 2000 }).success).toBe(true);
    expect(approveInfluencerSchema.safeParse({ ...validApprove, commissionRateBps: 3000 }).success).toBe(true);
  });

  it('rejects cookieDurationDays below 30', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, cookieDurationDays: 29 });
    expect(result.success).toBe(false);
  });

  it('rejects cookieDurationDays above 90', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, cookieDurationDays: 91 });
    expect(result.success).toBe(false);
  });

  it('rejects commissionDurationMonths below 6', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, commissionDurationMonths: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects commissionDurationMonths above 24', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, commissionDurationMonths: 25 });
    expect(result.success).toBe(false);
  });

  it('rejects adminNote longer than 500 characters', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, adminNote: 'A'.repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('500 characters');
    }
  });

  it('rejects unknown fields (.strict())', () => {
    const result = approveInfluencerSchema.safeParse({ ...validApprove, extraField: true });
    expect(result.success).toBe(false);
  });
});

// ─── rejectInfluencerSchema ───────────────────────────────────────────────────

describe('rejectInfluencerSchema', () => {
  it('accepts valid rejection input', () => {
    const result = rejectInfluencerSchema.safeParse({
      affiliateId: 'aff-test-1',
      rejectionReason: 'Insufficient follower count for influencer tier.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects rejectionReason shorter than 10 characters', () => {
    const result = rejectInfluencerSchema.safeParse({ affiliateId: 'aff-1', rejectionReason: 'Too few' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('10 characters');
    }
  });

  it('rejects rejectionReason longer than 500 characters', () => {
    const result = rejectInfluencerSchema.safeParse({ affiliateId: 'aff-1', rejectionReason: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (.strict())', () => {
    const result = rejectInfluencerSchema.safeParse({ affiliateId: 'aff-1', rejectionReason: 'Valid reason here.', extra: true });
    expect(result.success).toBe(false);
  });
});

// ─── suspendAffiliateSchema ───────────────────────────────────────────────────

describe('suspendAffiliateSchema', () => {
  it('accepts valid suspend input', () => {
    const result = suspendAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Violation of affiliate terms.' });
    expect(result.success).toBe(true);
  });

  it('rejects reason shorter than 10 characters', () => {
    const result = suspendAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Short' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (.strict())', () => {
    const result = suspendAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Valid reason here.', extra: 1 });
    expect(result.success).toBe(false);
  });
});

// ─── unsuspendAffiliateSchema ─────────────────────────────────────────────────

describe('unsuspendAffiliateSchema', () => {
  it('accepts valid unsuspend input', () => {
    const result = unsuspendAffiliateSchema.safeParse({ affiliateId: 'aff-test-1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty affiliateId', () => {
    const result = unsuspendAffiliateSchema.safeParse({ affiliateId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (.strict())', () => {
    const result = unsuspendAffiliateSchema.safeParse({ affiliateId: 'aff-1', extra: true });
    expect(result.success).toBe(false);
  });
});

// ─── banAffiliateSchema ───────────────────────────────────────────────────────

describe('banAffiliateSchema', () => {
  it('accepts valid ban input', () => {
    const result = banAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Fraudulent activity detected.' });
    expect(result.success).toBe(true);
  });

  it('rejects reason shorter than 10 characters', () => {
    const result = banAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Fraud' });
    expect(result.success).toBe(false);
  });

  it('rejects reason longer than 500 characters', () => {
    const result = banAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (.strict())', () => {
    const result = banAffiliateSchema.safeParse({ affiliateId: 'aff-1', reason: 'Valid reason here.', extra: true });
    expect(result.success).toBe(false);
  });
});
