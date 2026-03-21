import { describe, it, expect } from 'vitest';
import {
  contentReportSchema,
  reviewContentReportSchema,
  issueEnforcementActionSchema,
  liftEnforcementActionSchema,
  updateSellerEnforcementSchema,
} from '../enforcement';

describe('contentReportSchema', () => {
  it('accepts valid input with all required fields', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'LISTING',
      targetId: 'clxabc123',
      reason: 'COUNTERFEIT',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with optional description', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'REVIEW',
      targetId: 'clxabc123',
      reason: 'MISLEADING',
      description: 'This item is not as described.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys (strict mode)', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'LISTING',
      targetId: 'clxabc123',
      reason: 'SPAM',
      extraField: 'hacker',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid targetType', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'PRODUCT',
      targetId: 'clxabc123',
      reason: 'SPAM',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid reason enum', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'USER',
      targetId: 'clxabc123',
      reason: 'HATE_SPEECH',
    });
    expect(result.success).toBe(false);
  });

  it('rejects description over 1000 chars', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'LISTING',
      targetId: 'clxabc123',
      reason: 'OTHER',
      description: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts description of exactly 1000 chars', () => {
    const result = contentReportSchema.safeParse({
      targetType: 'MESSAGE',
      targetId: 'clxabc123',
      reason: 'HARASSMENT',
      description: 'x'.repeat(1000),
    });
    expect(result.success).toBe(true);
  });
});

describe('reviewContentReportSchema', () => {
  it('accepts CONFIRMED status', () => {
    const result = reviewContentReportSchema.safeParse({
      reportId: 'clxabc123',
      status: 'CONFIRMED',
    });
    expect(result.success).toBe(true);
  });

  it('accepts DISMISSED status', () => {
    const result = reviewContentReportSchema.safeParse({
      reportId: 'clxabc123',
      status: 'DISMISSED',
    });
    expect(result.success).toBe(true);
  });

  it('rejects PENDING status (staff can only CONFIRM or DISMISS)', () => {
    const result = reviewContentReportSchema.safeParse({
      reportId: 'clxabc123',
      status: 'PENDING',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys', () => {
    const result = reviewContentReportSchema.safeParse({
      reportId: 'clxabc123',
      status: 'CONFIRMED',
      extra: 'field',
    });
    expect(result.success).toBe(false);
  });
});

describe('issueEnforcementActionSchema', () => {
  it('validates all required fields', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
      reason: 'Repeated policy violations',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing reason', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown trigger (SCORE_BASED not available to staff)', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'RESTRICTION',
      trigger: 'SCORE_BASED',
      reason: 'Low score',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional expiresAt ISO 8601 date', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'SUSPENSION',
      trigger: 'POLICY_VIOLATION',
      reason: 'Selling prohibited items',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const result = issueEnforcementActionSchema.safeParse({
      userId: 'clxusr123',
      actionType: 'WARNING',
      trigger: 'ADMIN_MANUAL',
      reason: 'Test',
      unknownKey: 'value',
    });
    expect(result.success).toBe(false);
  });
});

describe('liftEnforcementActionSchema', () => {
  it('accepts valid actionId and liftedReason', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
      liftedReason: 'Seller completed remediation steps',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing liftedReason', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown keys', () => {
    const result = liftEnforcementActionSchema.safeParse({
      actionId: 'clxact123',
      liftedReason: 'Fixed',
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSellerEnforcementSchema', () => {
  it('validates nullable enforcementLevel (clear enforcement)', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      enforcementLevel: null,
    });
    expect(result.success).toBe(true);
  });

  it('validates valid enforcementLevel', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      enforcementLevel: 'WARNING',
    });
    expect(result.success).toBe(true);
  });

  it('validates bandOverride with valid performanceBand', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      bandOverride: 'TOP_RATED',
      bandOverrideReason: 'Admin override for exceptional seller',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const result = updateSellerEnforcementSchema.safeParse({
      userId: 'clxusr123',
      enforcementLevel: 'WARNING',
      hackField: 'bad',
    });
    expect(result.success).toBe(false);
  });
});
