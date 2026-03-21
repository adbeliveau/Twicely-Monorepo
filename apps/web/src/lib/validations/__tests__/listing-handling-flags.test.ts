import { describe, it, expect } from 'vitest';
import { listingFormSchema } from '../listing';

const baseData = {
  title: 'Test Item',
  description: 'A test item',
  category: null,
  condition: null,
  brand: '',
  tags: [],
  images: [],
  quantity: 1,
  priceCents: 1000,
  originalPriceCents: null,
  cogsCents: null,
  allowOffers: false,
  autoAcceptOfferCents: null,
  autoDeclineOfferCents: null,
  freeShipping: false,
  shippingCents: 0,
  weightOz: null,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  fulfillmentType: 'LOCAL_ONLY' as const,
  localPickupRadiusMiles: 25,
  videoUrl: null,
  videoThumbUrl: null,
  videoDurationSeconds: null,
};

describe('listingFormSchema — localHandlingFlags', () => {
  it('accepts empty localHandlingFlags: []', () => {
    const result = listingFormSchema.safeParse({ ...baseData, localHandlingFlags: [] });
    expect(result.success).toBe(true);
  });

  it('accepts valid flags: [\'NEEDS_VEHICLE\']', () => {
    const result = listingFormSchema.safeParse({ ...baseData, localHandlingFlags: ['NEEDS_VEHICLE'] });
    expect(result.success).toBe(true);
  });

  it('accepts all 4 flags simultaneously', () => {
    const result = listingFormSchema.safeParse({
      ...baseData,
      localHandlingFlags: ['NEEDS_VEHICLE', 'NEEDS_HELP', 'NEEDS_DISASSEMBLY', 'NEEDS_EQUIPMENT'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid flag: [\'INVALID_FLAG\']', () => {
    const result = listingFormSchema.safeParse({ ...baseData, localHandlingFlags: ['INVALID_FLAG'] });
    expect(result.success).toBe(false);
  });

  it('rejects non-string in array', () => {
    const result = listingFormSchema.safeParse({ ...baseData, localHandlingFlags: [42] });
    expect(result.success).toBe(false);
  });

  it('defaults localHandlingFlags to [] when not provided', () => {
    const result = listingFormSchema.safeParse(baseData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.localHandlingFlags).toEqual([]);
    }
  });
});
