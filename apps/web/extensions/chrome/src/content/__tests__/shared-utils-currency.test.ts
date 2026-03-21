/**
 * Unit tests for parsePriceWithCurrency helper (H4.1)
 * Tests multi-currency price string parsing for Vestiaire Collective integration.
 */

import { describe, it, expect } from 'vitest';
import { parsePriceWithCurrency } from '../shared-utils';

describe('parsePriceWithCurrency', () => {
  it('parses USD dollar sign prefix', () => {
    const result = parsePriceWithCurrency('$25.00');
    expect(result).toEqual({ cents: 2500, currency: 'USD' });
  });

  it('parses EUR prefix with European decimal (space thousands)', () => {
    const result = parsePriceWithCurrency('EUR 150,00');
    expect(result).toEqual({ cents: 15000, currency: 'EUR' });
  });

  it('parses EUR suffix with European decimal', () => {
    const result = parsePriceWithCurrency('150,00 EUR');
    expect(result).toEqual({ cents: 15000, currency: 'EUR' });
  });

  it('parses GBP prefix with US decimal', () => {
    const result = parsePriceWithCurrency('GBP 99.99');
    expect(result).toEqual({ cents: 9999, currency: 'GBP' });
  });

  it('parses CHF prefix with US decimal', () => {
    const result = parsePriceWithCurrency('CHF 200.00');
    expect(result).toEqual({ cents: 20000, currency: 'CHF' });
  });

  it('parses EUR with space thousands separator', () => {
    const result = parsePriceWithCurrency('1 299,00 EUR');
    expect(result).toEqual({ cents: 129900, currency: 'EUR' });
  });

  it('parses USD with comma thousands separator', () => {
    const result = parsePriceWithCurrency('$1,299.00');
    expect(result).toEqual({ cents: 129900, currency: 'USD' });
  });

  it('parses EUR with period thousands separator (European format)', () => {
    const result = parsePriceWithCurrency('1.299,00 EUR');
    expect(result).toEqual({ cents: 129900, currency: 'EUR' });
  });

  it('returns null for empty string', () => {
    expect(parsePriceWithCurrency('')).toBeNull();
  });

  it('returns null for "Free"', () => {
    expect(parsePriceWithCurrency('Free')).toBeNull();
  });

  it('returns null for "Contact for price"', () => {
    expect(parsePriceWithCurrency('Contact for price')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parsePriceWithCurrency('abc')).toBeNull();
  });
});
