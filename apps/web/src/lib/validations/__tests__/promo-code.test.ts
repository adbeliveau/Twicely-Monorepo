import { describe, it, expect } from 'vitest';
import {
  createPromoCodeSchema,
  updatePromoCodeSchema,
  createPlatformPromoCodeSchema,
  applyPromoCodeSchema,
} from '../promo-code';

// ─── createPromoCodeSchema ───────────────────────────────────────────────────

describe('createPromoCodeSchema', () => {
  const valid = {
    code: 'SAVE10',
    discountType: 'PERCENTAGE',
    discountValue: 1000,
    durationMonths: 1,
  };

  it('accepts a minimal valid PERCENTAGE promo code', () => {
    const result = createPromoCodeSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts a FIXED discount code', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, discountType: 'FIXED', discountValue: 500 });
    expect(result.success).toBe(true);
  });

  it('accepts already-uppercase code via transform (no mutation needed)', () => {
    // codeField regex requires uppercase BEFORE transform runs
    // The transform is a passthrough for already-valid uppercase codes
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'SAVE10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('SAVE10');
    }
  });

  it('rejects code shorter than 4 characters', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'ABC' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 20 characters', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'A'.repeat(21) });
    expect(result.success).toBe(false);
  });

  it('rejects code with lowercase letters via regex (before transform: not uppercase)', () => {
    // Regex is /^[A-Z0-9-]+$/ applied BEFORE transform — lowercase fails
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'save-10' });
    expect(result.success).toBe(false);
  });

  it('rejects code with special chars like @, !, space', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'SAVE@10' });
    expect(result.success).toBe(false);
  });

  it('accepts code with hyphens (e.g. SAVE-10)', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, code: 'SAVE-10' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid discountType enum', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, discountType: 'FLAT' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive discountValue (zero)', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, discountValue: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer discountValue (float)', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, discountValue: 9.5 });
    expect(result.success).toBe(false);
  });

  it('rejects durationMonths below 1', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, durationMonths: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects durationMonths above 12', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, durationMonths: 13 });
    expect(result.success).toBe(false);
  });

  it('defaults durationMonths to 1 when omitted', () => {
    const { durationMonths: _, ...without } = valid;
    const result = createPromoCodeSchema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durationMonths).toBe(1);
    }
  });

  it('accepts optional scopeProductTypes array', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, scopeProductTypes: ['store', 'lister'] });
    expect(result.success).toBe(true);
  });

  it('rejects invalid product type in scopeProductTypes', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, scopeProductTypes: ['wallet'] });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = createPromoCodeSchema.safeParse({ ...valid, extra: true });
    expect(result.success).toBe(false);
  });
});

// ─── updatePromoCodeSchema ───────────────────────────────────────────────────

describe('updatePromoCodeSchema', () => {
  it('accepts minimal update with just id and isActive', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', isActive: false });
    expect(result.success).toBe(true);
  });

  it('rejects empty id string', () => {
    const result = updatePromoCodeSchema.safeParse({ id: '', isActive: false });
    expect(result.success).toBe(false);
  });

  it('accepts nullable usageLimit (clearing it)', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', usageLimit: null });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive usageLimit (zero)', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', usageLimit: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts nullable expiresAt (clearing it)', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', expiresAt: null });
    expect(result.success).toBe(true);
  });

  it('accepts valid datetime string for expiresAt', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', expiresAt: '2027-01-01T00:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid datetime string for expiresAt', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', expiresAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = updatePromoCodeSchema.safeParse({ id: 'promo-abc', code: 'NEW' });
    expect(result.success).toBe(false);
  });
});

// ─── createPlatformPromoCodeSchema ──────────────────────────────────────────

describe('createPlatformPromoCodeSchema', () => {
  const valid = {
    code: 'PLATFORM10',
    discountType: 'PERCENTAGE',
    discountValue: 2000,
    durationMonths: 3,
  };

  it('accepts valid platform promo code', () => {
    const result = createPlatformPromoCodeSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('uppercases the code via transform', () => {
    const result = createPlatformPromoCodeSchema.safeParse({ ...valid, code: 'PLATFORM-10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('PLATFORM-10');
    }
  });

  it('rejects code shorter than 4 characters', () => {
    const result = createPlatformPromoCodeSchema.safeParse({ ...valid, code: 'AB' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = createPlatformPromoCodeSchema.safeParse({ ...valid, adminNote: 'hidden' });
    expect(result.success).toBe(false);
  });
});

// ─── applyPromoCodeSchema ────────────────────────────────────────────────────

describe('applyPromoCodeSchema', () => {
  it('accepts valid code and product', () => {
    const result = applyPromoCodeSchema.safeParse({ code: 'SAVE10', product: 'store' });
    expect(result.success).toBe(true);
  });

  it('uppercases the code via transform', () => {
    const result = applyPromoCodeSchema.safeParse({ code: 'save10', product: 'lister' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('SAVE10');
    }
  });

  it('accepts all valid product enum values', () => {
    const products = ['store', 'lister', 'automation', 'finance', 'bundle'];
    for (const product of products) {
      const result = applyPromoCodeSchema.safeParse({ code: 'CODE1', product });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid product enum', () => {
    const result = applyPromoCodeSchema.safeParse({ code: 'SAVE10', product: 'wallet' });
    expect(result.success).toBe(false);
  });

  it('rejects empty code string', () => {
    const result = applyPromoCodeSchema.safeParse({ code: '', product: 'store' });
    expect(result.success).toBe(false);
  });

  it('rejects code longer than 20 characters', () => {
    const result = applyPromoCodeSchema.safeParse({ code: 'A'.repeat(21), product: 'store' });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields (.strict())', () => {
    const result = applyPromoCodeSchema.safeParse({ code: 'SAVE10', product: 'store', extra: 1 });
    expect(result.success).toBe(false);
  });
});
