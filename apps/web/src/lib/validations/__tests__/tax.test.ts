import { describe, it, expect } from 'vitest';
import { taxInfoSchema, sanitizeTaxIdInput } from '@/lib/validations/tax';

/**
 * Tests for src/lib/validations/tax.ts
 * Covers: SSN/EIN/ITIN validation, US state/zip, strict mode, sanitization.
 */

const VALID_BASE = {
  legalName: 'Jane Doe',
  address1: '123 Main St',
  city: 'Boston',
  state: 'MA',
  zip: '02101',
};

describe('taxInfoSchema — SSN', () => {
  it('accepts valid 9-digit SSN', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789' });
    expect(result.success).toBe(true);
  });

  it('accepts SSN with dashes (stripped to 9 digits)', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'SSN', taxId: '123-45-6789' });
    expect(result.success).toBe(true);
  });

  it('rejects SSN shorter than 9 digits', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'SSN', taxId: '12345' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('9 digits');
  });

  it('rejects SSN longer than 9 digits', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'SSN', taxId: '1234567890' });
    expect(result.success).toBe(false);
  });

  it('rejects SSN with letters', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'SSN', taxId: 'abcdefghi' });
    expect(result.success).toBe(false);
  });
});

describe('taxInfoSchema — EIN', () => {
  it('accepts valid 9-digit EIN', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'EIN', taxId: '123456789' });
    expect(result.success).toBe(true);
  });

  it('accepts EIN with dash (XX-XXXXXXX format)', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'EIN', taxId: '12-3456789' });
    expect(result.success).toBe(true);
  });

  it('rejects EIN with only 8 digits', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'EIN', taxId: '12345678' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('9 digits');
  });
});

describe('taxInfoSchema — ITIN', () => {
  it('accepts valid ITIN starting with 9', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'ITIN', taxId: '912345678' });
    expect(result.success).toBe(true);
  });

  it('accepts ITIN with dashes (9XX-XX-XXXX)', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'ITIN', taxId: '912-34-5678' });
    expect(result.success).toBe(true);
  });

  it('rejects ITIN not starting with 9', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'ITIN', taxId: '123456789' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('start with 9');
  });

  it('rejects ITIN with only 8 digits starting with 9', () => {
    const result = taxInfoSchema.safeParse({ ...VALID_BASE, taxIdType: 'ITIN', taxId: '91234567' });
    expect(result.success).toBe(false);
  });
});

describe('taxInfoSchema — address fields', () => {
  it('rejects missing legalName', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789', legalName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid US state code', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789', state: 'XX',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('state');
  });

  it('accepts lowercase state code (case-insensitive)', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789', state: 'ma',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid ZIP code', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789', zip: '1234',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('ZIP');
  });

  it('accepts ZIP+4 format (XXXXX-XXXX)', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789', zip: '02101-1234',
    });
    expect(result.success).toBe(true);
  });

  it('allows optional businessName field', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'EIN', taxId: '123456789', businessName: 'Acme Corp',
    });
    expect(result.success).toBe(true);
  });
});

describe('taxInfoSchema — strict mode', () => {
  it('rejects extra/unknown fields (strict mode)', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789',
      extraField: 'hacked',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys');
  });

  it('rejects missing taxIdType', () => {
    const { taxIdType: _omit, ...rest } = { ...VALID_BASE, taxIdType: 'SSN', taxId: '123456789' };
    const result = taxInfoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid taxIdType enum value', () => {
    const result = taxInfoSchema.safeParse({
      ...VALID_BASE, taxIdType: 'TIN', taxId: '123456789',
    });
    expect(result.success).toBe(false);
  });
});

describe('sanitizeTaxIdInput', () => {
  it('strips dashes from SSN format', () => {
    expect(sanitizeTaxIdInput('123-45-6789')).toBe('123456789');
  });

  it('strips dashes from EIN format', () => {
    expect(sanitizeTaxIdInput('12-3456789')).toBe('123456789');
  });

  it('strips spaces', () => {
    expect(sanitizeTaxIdInput('123 45 6789')).toBe('123456789');
  });

  it('returns plain digits unchanged', () => {
    expect(sanitizeTaxIdInput('123456789')).toBe('123456789');
  });
});
