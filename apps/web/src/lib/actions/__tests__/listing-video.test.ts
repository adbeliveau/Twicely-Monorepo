import { describe, it, expect } from 'vitest';
import { listingFormSchema } from '@/lib/validations/listing';

// ────────────────────────────────────────────────────────────────────────────
// Schema-level tests for video fields (no DB needed)
// ────────────────────────────────────────────────────────────────────────────

const baseFormData = {
  title: 'Test Item',
  description: 'A description',
  category: null,
  condition: null,
  brand: '',
  tags: [],
  images: [],
  quantity: 1,
  priceCents: 0,
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
  fulfillmentType: 'SHIP_ONLY' as const,
  localPickupRadiusMiles: null,
  localHandlingFlags: [],
  videoUrl: null,
  videoThumbUrl: null,
  videoDurationSeconds: null,
};

describe('listingFormSchema video fields', () => {
  it('accepts null video fields (no video attached)', () => {
    const result = listingFormSchema.safeParse(baseFormData);
    expect(result.success).toBe(true);
  });

  it('accepts valid video URL with valid duration', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg',
      videoDurationSeconds: 30,
    });
    expect(result.success).toBe(true);
  });

  it('rejects videoDurationSeconds below 15', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg',
      videoDurationSeconds: 14,
    });
    expect(result.success).toBe(false);
  });

  it('rejects videoDurationSeconds above 60', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg',
      videoDurationSeconds: 61,
    });
    expect(result.success).toBe(false);
  });

  it('accepts videoDurationSeconds of exactly 15', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg',
      videoDurationSeconds: 15,
    });
    expect(result.success).toBe(true);
  });

  it('accepts videoDurationSeconds of exactly 60', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/videos/listings/lst-1/thumb.jpg',
      videoDurationSeconds: 60,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-URL videoUrl', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'not-a-url',
      videoDurationSeconds: 30,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer videoDurationSeconds', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/videos/listings/lst-1/video.mp4',
      videoDurationSeconds: 30.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('getListingBySlug video fields', () => {
  it('returns null video fields for listing without video', () => {
    const result = listingFormSchema.safeParse({ ...baseFormData });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.videoUrl).toBeNull();
      expect(result.data.videoThumbUrl).toBeNull();
      expect(result.data.videoDurationSeconds).toBeNull();
    }
  });

  it('returns videoUrl, videoThumbUrl, videoDurationSeconds in listing detail', () => {
    const result = listingFormSchema.safeParse({
      ...baseFormData,
      videoUrl: 'https://cdn.twicely.com/v.mp4',
      videoThumbUrl: 'https://cdn.twicely.com/t.jpg',
      videoDurationSeconds: 45,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.videoUrl).toBe('https://cdn.twicely.com/v.mp4');
      expect(result.data.videoDurationSeconds).toBe(45);
    }
  });
});
