/**
 * Tests for affiliate-fraud.ts Zod validation schemas (G3.5)
 */
import { describe, it, expect } from 'vitest';
import { runFraudScanSchema } from '../affiliate-fraud';

describe('runFraudScanSchema', () => {
  it('accepts valid input with affiliateId', () => {
    const result = runFraudScanSchema.safeParse({ affiliateId: 'aff-test-001' });
    expect(result.success).toBe(true);
  });

  it('rejects missing affiliateId', () => {
    const result = runFraudScanSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects empty string affiliateId', () => {
    const result = runFraudScanSchema.safeParse({ affiliateId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = runFraudScanSchema.safeParse({
      affiliateId: 'aff-test-001',
      extraField: 'not-allowed',
    });
    expect(result.success).toBe(false);
  });

  it('rejects null affiliateId', () => {
    const result = runFraudScanSchema.safeParse({ affiliateId: null });
    expect(result.success).toBe(false);
  });

  it('accepts a non-cuid2 string as affiliateId (schema only validates min length)', () => {
    const result = runFraudScanSchema.safeParse({ affiliateId: 'any-valid-string' });
    expect(result.success).toBe(true);
  });
});
