import { describe, it, expect } from 'vitest';
import { joinAffiliateSchema } from '../affiliate';

describe('joinAffiliateSchema', () => {
  it('accepts valid referral code', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'MY-CODE' });
    expect(result.success).toBe(true);
  });

  it('uppercases referral code', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'my-code' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referralCode).toBe('MY-CODE');
    }
  });

  it('rejects code shorter than 3 chars', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 30 chars', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'A'.repeat(31) });
    expect(result.success).toBe(false);
  });

  it('rejects code with special characters', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'MY@CODE' });
    expect(result.success).toBe(false);
  });

  it('accepts code with hyphens and underscores', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'my_code-123' });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (referralCode is optional)', () => {
    const result = joinAffiliateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.referralCode).toBeUndefined();
    }
  });

  it('rejects unknown fields (.strict())', () => {
    const result = joinAffiliateSchema.safeParse({ referralCode: 'CODE', extra: true });
    expect(result.success).toBe(false);
  });
});
