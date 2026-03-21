import { describe, it, expect } from 'vitest';
import {
  getTaxCodeForCategory,
  TAX_CODE_MAP,
  DEFAULT_TAX_CODE,
} from '@/lib/tax/tax-codes';

/**
 * Tests for src/lib/tax/tax-codes.ts
 * Category-to-TaxJar tax code mapping used in sales tax calculation.
 */

describe('getTaxCodeForCategory', () => {
  it('returns clothing tax code for APPAREL_ACCESSORIES', () => {
    expect(getTaxCodeForCategory('APPAREL_ACCESSORIES')).toBe('20010');
  });

  it('returns clothing tax code for SHOES', () => {
    expect(getTaxCodeForCategory('SHOES')).toBe('20010');
  });

  it('returns electronics tax code for ELECTRONICS', () => {
    expect(getTaxCodeForCategory('ELECTRONICS')).toBe('PC030000');
  });

  it('returns books tax code for BOOKS', () => {
    expect(getTaxCodeForCategory('BOOKS')).toBe('81100');
  });

  it('returns collectibles tax code for COLLECTIBLES_LUXURY', () => {
    expect(getTaxCodeForCategory('COLLECTIBLES_LUXURY')).toBe('PG050101');
  });

  it('returns default tax code for unknown category', () => {
    expect(getTaxCodeForCategory('UNKNOWN_CATEGORY')).toBe(DEFAULT_TAX_CODE);
  });

  it('returns default tax code for null feeBucket', () => {
    expect(getTaxCodeForCategory(null)).toBe(DEFAULT_TAX_CODE);
  });

  it('returns default tax code for undefined feeBucket', () => {
    expect(getTaxCodeForCategory(undefined)).toBe(DEFAULT_TAX_CODE);
  });

  it('returns default tax code for empty string', () => {
    expect(getTaxCodeForCategory('')).toBe(DEFAULT_TAX_CODE);
  });

  it('DEFAULT_TAX_CODE is P0000000 (general tangible personal property)', () => {
    expect(DEFAULT_TAX_CODE).toBe('P0000000');
  });

  it('TAX_CODE_MAP exports all expected categories', () => {
    expect(TAX_CODE_MAP).toHaveProperty('APPAREL_ACCESSORIES');
    expect(TAX_CODE_MAP).toHaveProperty('ELECTRONICS');
    expect(TAX_CODE_MAP).toHaveProperty('BOOKS');
    expect(TAX_CODE_MAP).toHaveProperty('HOME_GENERAL');
  });
});
