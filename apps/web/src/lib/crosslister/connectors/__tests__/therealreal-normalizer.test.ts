import { describe, it, expect } from 'vitest';
import { normalizeTrrListing, parseTrrPrice } from '../therealreal-normalizer';
import type { TrrConsignment } from '../therealreal-types';

function buildConsignment(overrides: Partial<TrrConsignment> = {}): TrrConsignment {
  return {
    id: 'trr-consignment-abc123',
    title: 'Louis Vuitton Speedy 30 Monogram',
    description: 'Classic LV Speedy 30 in excellent condition. Comes with dust bag.',
    price: '895.00',
    currency: 'USD',
    condition: 'Excellent',
    authentication_status: 'authenticated',
    status: 'listed',
    designer: { id: 50, name: 'Louis Vuitton', slug: 'louis-vuitton' },
    category: { id: 10, name: 'Handbags', path: 'women/handbags' },
    images: [
      { id: 'img-1', url: 'https://cdn.therealreal.com/img1.jpg', position: 1, is_primary: true },
      { id: 'img-2', url: 'https://cdn.therealreal.com/img2.jpg', position: 2, is_primary: false },
    ],
    created_at: '2024-02-10T08:00:00Z',
    size: 'OS',
    condition_notes: 'Minor scratches on hardware',
    ...overrides,
  };
}

describe('parseTrrPrice', () => {
  it('converts decimal string to integer cents', () => {
    expect(parseTrrPrice('895.00')).toBe(89500);
  });

  it('handles whole number', () => {
    expect(parseTrrPrice('450')).toBe(45000);
  });

  it('handles zero', () => {
    expect(parseTrrPrice('0')).toBe(0);
  });

  it('handles invalid string as 0', () => {
    expect(parseTrrPrice('abc')).toBe(0);
  });

  it('handles negative as 0', () => {
    expect(parseTrrPrice('-100.00')).toBe(0);
  });

  it('rounds standard amounts', () => {
    expect(parseTrrPrice('9.99')).toBe(999);
  });
});

describe('normalizeTrrListing', () => {
  it('maps externalId from id', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.externalId).toBe('trr-consignment-abc123');
  });

  it('trims and normalizes title', () => {
    const result = normalizeTrrListing(buildConsignment({ title: '  LV Bag  ' }));
    expect(result.title).toBe('LV Bag');
  });

  it('truncates title to 200 chars', () => {
    const result = normalizeTrrListing(buildConsignment({ title: 'Z'.repeat(250) }));
    expect(result.title.length).toBe(200);
  });

  it('parses price string to integer cents', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.priceCents).toBe(89500);
  });

  it('maps Excellent condition to LIKE_NEW', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Excellent' }));
    expect(result.condition).toBe('LIKE_NEW');
  });

  it('maps Very Good condition to VERY_GOOD', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Very Good' }));
    expect(result.condition).toBe('VERY_GOOD');
  });

  it('maps Good condition to GOOD', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Good' }));
    expect(result.condition).toBe('GOOD');
  });

  it('maps Fair condition to ACCEPTABLE', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Fair' }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('maps Poor condition to ACCEPTABLE', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Poor' }));
    expect(result.condition).toBe('ACCEPTABLE');
  });

  it('returns null for unknown condition', () => {
    const result = normalizeTrrListing(buildConsignment({ condition: 'Unknown Grade' }));
    expect(result.condition).toBeNull();
  });

  it('extracts brand from designer', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.brand).toBe('Louis Vuitton');
  });

  it('sets brand to null when no designer', () => {
    const result = normalizeTrrListing(buildConsignment({ designer: undefined }));
    expect(result.brand).toBeNull();
  });

  it('maps images with primary first', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.images).toHaveLength(2);
    expect(result.images[0]?.isPrimary).toBe(true);
    expect(result.images[0]?.url).toBe('https://cdn.therealreal.com/img1.jpg');
  });

  it('handles missing images gracefully', () => {
    const result = normalizeTrrListing(buildConsignment({ images: undefined }));
    expect(result.images).toHaveLength(0);
  });

  it('maps listed status to ACTIVE', () => {
    const result = normalizeTrrListing(buildConsignment({ status: 'listed' }));
    expect(result.status).toBe('ACTIVE');
  });

  it('maps sold status to SOLD', () => {
    const result = normalizeTrrListing(buildConsignment({ status: 'sold' }));
    expect(result.status).toBe('SOLD');
  });

  it('maps returned status to ENDED', () => {
    const result = normalizeTrrListing(buildConsignment({ status: 'returned' }));
    expect(result.status).toBe('ENDED');
  });

  it('maps expired status to ENDED', () => {
    const result = normalizeTrrListing(buildConsignment({ status: 'expired' }));
    expect(result.status).toBe('ENDED');
  });

  it('extracts category name', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.category).toBe('Handbags');
  });

  it('parses listedAt from created_at', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.listedAt).toBeInstanceOf(Date);
  });

  it('parses soldAt when present', () => {
    const result = normalizeTrrListing(buildConsignment({ sold_at: '2024-05-01T10:00:00Z', status: 'sold' }));
    expect(result.soldAt).toBeInstanceOf(Date);
  });

  it('stores TRR condition and auth status in itemSpecifics', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.itemSpecifics['trrCondition']).toBe('Excellent');
    expect(result.itemSpecifics['authenticationStatus']).toBe('authenticated');
  });

  it('builds URL from id', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.url).toBe('https://www.therealreal.com/products/trr-consignment-abc123');
  });

  it('quantity is always 1', () => {
    const result = normalizeTrrListing(buildConsignment());
    expect(result.quantity).toBe(1);
  });
});
