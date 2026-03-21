/**
 * G1-B Seller Onboarding — Zod schema tests for businessInfoSchema and storeNameSchema.
 *
 * All schemas use .strict() — unknown keys always cause parse failure.
 * Source: src/lib/validations/seller-onboarding.ts
 */

import { describe, test, expect } from 'vitest';
import {
  businessInfoSchema,
  storeNameSchema,
  RESERVED_STORE_SLUGS,
} from '../seller-onboarding';

// ─── businessInfoSchema ───────────────────────────────────────────────────────

describe('businessInfoSchema', () => {
  const validInput = {
    businessName: 'Acme Resale LLC',
    businessType: 'LLC',
    ein: '12-3456789',
    address1: '123 Commerce Ave',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    country: 'US',
  };

  test('accepts fully valid input', () => {
    const result = businessInfoSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test('accepts input without optional fields (ein, phone, website)', () => {
    const { ein: _ein, ...minimal } = validInput;
    const result = businessInfoSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  test('accepts 9-digit zip with extension (12345-6789)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, zip: '12345-6789' });
    expect(result.success).toBe(true);
  });

  test('accepts valid URL for website', () => {
    const result = businessInfoSchema.safeParse({
      ...validInput,
      website: 'https://mystore.example.com',
    });
    expect(result.success).toBe(true);
  });

  test('rejects missing businessName', () => {
    const { businessName: _b, ...rest } = validInput;
    const result = businessInfoSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test('rejects businessName shorter than 2 chars', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, businessName: 'A' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid businessType', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, businessType: 'NONPROFIT' });
    expect(result.success).toBe(false);
  });

  test('rejects all four valid businessType values are accepted', () => {
    const types = ['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP'];
    for (const bt of types) {
      const result = businessInfoSchema.safeParse({ ...validInput, businessType: bt });
      expect(result.success).toBe(true);
    }
  });

  test('rejects EIN without hyphen (plain 9 digits)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, ein: '123456789' });
    expect(result.success).toBe(false);
  });

  test('rejects EIN with wrong hyphen position', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, ein: '1-23456789' });
    expect(result.success).toBe(false);
  });

  test('accepts empty string for ein (optional)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, ein: '' });
    expect(result.success).toBe(true);
  });

  test('rejects invalid zip (letters)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, zip: 'ABCDE' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid zip (4 digits)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, zip: '1234' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid state code', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, state: 'XX' });
    expect(result.success).toBe(false);
  });

  test('accepts DC as valid state code', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, state: 'DC' });
    expect(result.success).toBe(true);
  });

  test('accepts PR as valid state code (territory)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, state: 'PR' });
    expect(result.success).toBe(true);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, extraField: 'surprise' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid website URL', () => {
    const result = businessInfoSchema.safeParse({ ...validInput, website: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

// ─── storeNameSchema ──────────────────────────────────────────────────────────

describe('storeNameSchema', () => {
  const validInput = {
    storeName: 'My Vintage Shop',
    storeSlug: 'my-vintage-shop',
  };

  test('accepts valid storeName and storeSlug', () => {
    const result = storeNameSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test('accepts slug with numbers', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: 'shop2024' });
    expect(result.success).toBe(true);
  });

  test('rejects storeSlug with uppercase letters', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: 'MyStore' });
    expect(result.success).toBe(false);
  });

  test('rejects storeSlug with underscore', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: 'my_store' });
    expect(result.success).toBe(false);
  });

  test('rejects storeSlug with special characters', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: 'my-store!' });
    expect(result.success).toBe(false);
  });

  test('rejects storeSlug shorter than 2 chars', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: 'a' });
    expect(result.success).toBe(false);
  });

  test('rejects storeSlug longer than 30 chars', () => {
    const result = storeNameSchema.safeParse({
      ...validInput,
      storeSlug: 'a'.repeat(31),
    });
    expect(result.success).toBe(false);
  });

  test('rejects storeName shorter than 2 chars', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeName: 'A' });
    expect(result.success).toBe(false);
  });

  test('rejects unknown keys (strict mode)', () => {
    const result = storeNameSchema.safeParse({ ...validInput, extraField: 'oops' });
    expect(result.success).toBe(false);
  });

  test('rejects all RESERVED_STORE_SLUGS', () => {
    for (const reserved of RESERVED_STORE_SLUGS) {
      const result = storeNameSchema.safeParse({ storeName: 'Test Store', storeSlug: reserved });
      expect(result.success).toBe(false);
    }
  });

  test('accepts slug that starts with a number', () => {
    const result = storeNameSchema.safeParse({ ...validInput, storeSlug: '2ndhand-shop' });
    expect(result.success).toBe(true);
  });
});
