import { describe, it, expect } from 'vitest';
import {
  liftEnforcementActionSchema,
  updateSellerEnforcementSchema,
  issueEnforcementActionSchema,
  contentReportSchema,
} from '../enforcement';

// ─── Additional boundary + edge-case coverage for enforcement schemas ──────────

describe('liftEnforcementActionSchema — boundaries', () => {
  it('rejects liftedReason over 2000 chars', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
      liftedReason: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts liftedReason of exactly 2000 chars', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
      liftedReason: 'x'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty string liftedReason', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
      liftedReason: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSellerEnforcementSchema — boundaries', () => {
  it('rejects bandOverrideReason over 500 chars', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      bandOverrideReason: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts bandOverrideReason of exactly 500 chars', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      bandOverrideReason: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('accepts omitting enforcementLevel entirely (optional field)', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid performanceBand value in bandOverride', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      bandOverride: 'SUSPENDED',  // Not in enum (SUSPENDED lives on sellerProfile.status, not bandOverride)
    });
    expect(result.success).toBe(false);
  });

  it('rejects RESTRICTION as bandOverride (not a performanceBand)', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      bandOverride: 'RESTRICTION',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all four valid performanceBand values for bandOverride', () => {
    const bands = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'] as const;
    for (const band of bands) {
      const result = updateSellerEnforcementSchema.safeParse({
        userId: 'clxusr123',
        bandOverride: band,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all four valid enforcementLevel values', () => {
    const levels = ['COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION'] as const;
    for (const level of levels) {
      const result = updateSellerEnforcementSchema.safeParse({
        userId: 'clxusr123',
        enforcementLevel: level,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('issueEnforcementActionSchema — boundaries', () => {
  it('rejects reason over 2000 chars', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
      reason: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts reason of exactly 2000 chars', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
      reason: 'x'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects SCORE_BASED and SYSTEM_AUTO triggers (staff cannot use system triggers)', () => {
    for (const trigger of ['SCORE_BASED', 'SYSTEM_AUTO']) {
      const result = issueEnforcementActionSchema.safeParse({
        userId: 'clxusr123',
        actionType: 'WARNING',
        trigger,
        reason: 'Test',
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects invalid ISO 8601 date string for expiresAt', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'SUSPENSION',
      trigger: 'ADMIN_MANUAL',
      reason: 'Banned',
      expiresAt: '2026-13-45',  // Invalid month/day
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid enforcement action types', () => {
    const types = [
      'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
      'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
      'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN',
    ] as const;
    for (const actionType of types) {
      const result = issueEnforcementActionSchema.safeParse({
        userId: 'clxusr123',
        actionType,
        trigger: 'ADMIN_MANUAL',
        reason: 'Test reason',
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('contentReportSchema — all valid reasons', () => {
  it('accepts all valid content report reasons', () => {
    const reasons = [
      'COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY',
      'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE',
      'SHILL_REVIEWS', 'OTHER',
    ] as const;
    for (const reason of reasons) {
      const result = contentReportSchema.safeParse({
        targetType: 'LISTING',
        targetId: 'clxlst001',
        reason,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid target types', () => {
    const targets = ['LISTING', 'REVIEW', 'MESSAGE', 'USER'] as const;
    for (const targetType of targets) {
      const result = contentReportSchema.safeParse({
        targetType,
        targetId: 'clxtgt001',
        reason: 'SPAM',
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts description of exactly 1000 chars (boundary)', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'USER',
      targetId: 'clxusr001',
      reason: 'HARASSMENT',
      description: 'a'.repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing targetId', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'LISTING',
      reason: 'SPAM',
    });
    expect(result.success).toBe(false);
  });
});
