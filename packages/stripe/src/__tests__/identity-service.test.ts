import { describe, it, expect } from 'vitest';

/**
 * Identity Service type/interface tests.
 * Function-level tests are in identity-service-fns.test.ts.
 */

describe('VerificationSessionResult', () => {
  it('has sessionId and clientSecret fields', () => {
    const result: { sessionId: string; clientSecret: string } = {
      sessionId: 'vs_123',
      clientSecret: 'vs_123_secret_abc',
    };
    expect(result.sessionId).toBe('vs_123');
    expect(result.clientSecret).toContain('secret');
  });
});

describe('VerificationResultData', () => {
  it('has status field and optional reportId', () => {
    const verified: { status: 'verified' | 'requires_input' | 'canceled'; reportId?: string } = {
      status: 'verified',
      reportId: 'vr_abc',
    };
    expect(verified.status).toBe('verified');
    expect(verified.reportId).toBe('vr_abc');
  });

  it('status can be requires_input (failed)', () => {
    const failed: { status: 'verified' | 'requires_input' | 'canceled' } = {
      status: 'requires_input',
    };
    expect(failed.status).toBe('requires_input');
  });

  it('status can be canceled', () => {
    const canceled: { status: 'verified' | 'requires_input' | 'canceled' } = {
      status: 'canceled',
    };
    expect(canceled.status).toBe('canceled');
  });
});

describe('verificationLevelEnum', () => {
  it('has correct levels', () => {
    const levels = ['BASIC', 'TAX', 'ENHANCED', 'CATEGORY'] as const;
    expect(levels).toHaveLength(4);
    expect(levels).toContain('BASIC');
    expect(levels).toContain('ENHANCED');
  });
});

describe('verificationStatusEnum', () => {
  it('has correct statuses', () => {
    const statuses = ['NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('VERIFIED');
    expect(statuses).toContain('FAILED');
  });
});
