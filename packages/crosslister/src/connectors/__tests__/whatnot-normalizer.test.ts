import { describe, it, expect } from 'vitest';
import {
  normalizeWhatnotListing,
  toExternalListing,
  parseMoneyToCents,
} from '../whatnot-normalizer';
import type { WhatnotListing } from '../whatnot-types';

function buildWhatnotListing(overrides: Partial<WhatnotListing> = {}): WhatnotListing {
  return {
    id: 'listing-1',
    title: 'Vintage Sneakers',
    description: 'Great condition sneakers',
    price: { amount: '49.99', currencyCode: 'USD' },
    status: 'PUBLISHED',
    media: [
      { url: 'https://cdn.whatnot.com/image1.jpg', type: 'IMAGE' },
      { url: 'https://cdn.whatnot.com/image2.jpg', type: 'IMAGE' },
    ],
    product: null,
    createdAt: '2024-06-01T12:00:00Z',
    updatedAt: '2024-06-02T12:00:00Z',
    ...overrides,
  };
}

describe('normalizeWhatnotListing', () => {
  it('normalizes Whatnot listing to ExternalListing shape', () => {
    const raw = buildWhatnotListing();
    const normalized = normalizeWhatnotListing(raw);
    const external = toExternalListing(normalized);

    expect(external.externalId).toBe('listing-1');
    expect(external.title).toBe('Vintage Sneakers');
    expect(external.description).toBe('Great condition sneakers');
    expect(external.priceCents).toBe(4999);
    expect(external.currencyCode).toBe('USD');
    expect(external.quantity).toBe(1);
  });

  it('parses Money type to integer cents correctly — "12.99" USD => 1299', () => {
    expect(parseMoneyToCents('12.99')).toBe(1299);
    expect(parseMoneyToCents('100.00')).toBe(10000);
    expect(parseMoneyToCents('0.99')).toBe(99);
    expect(parseMoneyToCents('49.99')).toBe(4999);
  });

  it('maps PUBLISHED status to ACTIVE', () => {
    const raw = buildWhatnotListing({ status: 'PUBLISHED' });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.status).toBe('ACTIVE');
  });

  it('maps UNPUBLISHED status to ENDED', () => {
    const raw = buildWhatnotListing({ status: 'UNPUBLISHED' });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.status).toBe('ENDED');
  });

  it('maps SOLD status to SOLD', () => {
    const raw = buildWhatnotListing({ status: 'SOLD' });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.status).toBe('SOLD');
  });

  it('handles missing description', () => {
    const raw = buildWhatnotListing({ description: null });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.description).toBe('');
  });

  it('handles empty media array', () => {
    const raw = buildWhatnotListing({ media: [] });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.images).toHaveLength(0);
  });

  it('filters media to images only', () => {
    const raw = buildWhatnotListing({
      media: [
        { url: 'https://cdn.whatnot.com/image1.jpg', type: 'IMAGE' },
        { url: 'https://cdn.whatnot.com/video1.mp4', type: 'VIDEO' },
        { url: 'https://cdn.whatnot.com/image2.jpg', type: 'IMAGE' },
      ],
    });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.images).toHaveLength(2);
    expect(normalized.images[0]?.url).toBe('https://cdn.whatnot.com/image1.jpg');
    expect(normalized.images[1]?.url).toBe('https://cdn.whatnot.com/image2.jpg');
  });

  it('generates correct Whatnot listing URL', () => {
    const raw = buildWhatnotListing({ id: 'listing-abc123' });
    const normalized = normalizeWhatnotListing(raw);
    expect(normalized.url).toBe('https://www.whatnot.com/listings/listing-abc123');
  });

  it('handles missing product data', () => {
    const raw = buildWhatnotListing({ product: null });
    const normalized = normalizeWhatnotListing(raw);
    // Should normalize without error — product is optional
    expect(normalized.externalId).toBe(raw.id);
  });
});
