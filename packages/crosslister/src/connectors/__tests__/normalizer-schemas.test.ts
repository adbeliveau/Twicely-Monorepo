import { describe, it, expect, vi } from 'vitest';
import { EbayInventoryItemSchema } from '../ebay-schemas';
import { PoshmarkListingSchema } from '../poshmark-schemas';
import { MercariItemSchema } from '../mercari-schemas';
import { EtsyListingSchema } from '../etsy-schemas';
import { FbCommerceListingSchema } from '../fb-marketplace-schemas';
import { GrailedListingSchema } from '../grailed-schemas';
import { TrrConsignmentSchema } from '../therealreal-schemas';
import { DepopProductSchema } from '../depop-schemas';

// Mock logger to prevent side effects in dispatch tests
vi.mock('@twicely/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('Normalizer Zod Schemas', () => {
  describe('EbayInventoryItemSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = EbayInventoryItemSchema.safeParse({
        sku: 'SKU-001',
        condition: 'LIKE_NEW',
        product: { title: 'Nike Shoes', imageUrls: ['https://img.com/1.jpg'] },
        offers: [{ pricingSummary: { price: { value: '89.99', currency: 'USD' } } }],
      });
      expect(result.success).toBe(true);
    });

    it('missing required sku fails', () => {
      const result = EbayInventoryItemSchema.safeParse({
        condition: 'NEW',
        product: { title: 'Item' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('PoshmarkListingSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = PoshmarkListingSchema.safeParse({
        id: 'pm-123',
        title: 'Vintage Dress',
        price_amount: { val: '45.00', currency_code: 'USD' },
        pictures: [{ url: 'https://img.com/1.jpg' }],
        status: 'available',
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = PoshmarkListingSchema.safeParse({
        title: 'No ID Listing',
        status: 'available',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('MercariItemSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = MercariItemSchema.safeParse({
        id: 'mc-456',
        name: 'Vintage Jacket',
        price: 5000,
        condition_id: 2,
        photos: [{ url: 'https://img.com/1.jpg' }],
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = MercariItemSchema.safeParse({
        name: 'No ID',
        price: 1000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EtsyListingSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = EtsyListingSchema.safeParse({
        listing_id: 12345,
        title: 'Handmade Ring',
        state: 'active',
        price: { amount: 2500, divisor: 100, currency_code: 'USD' },
        images: [{ url_fullxfull: 'https://img.com/1.jpg', rank: 1 }],
      });
      expect(result.success).toBe(true);
    });

    it('missing required listing_id fails', () => {
      const result = EtsyListingSchema.safeParse({
        title: 'No ID',
        state: 'active',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FbCommerceListingSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = FbCommerceListingSchema.safeParse({
        id: 'fb-789',
        name: 'Used Sofa',
        price: { amount: 15000, currency: 'USD' },
        condition: 'USED_GOOD',
        availability: 'in stock',
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = FbCommerceListingSchema.safeParse({
        name: 'No ID',
        price: { amount: 100, currency: 'USD' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('GrailedListingSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = GrailedListingSchema.safeParse({
        id: 99001,
        title: 'Rick Owens Jacket',
        price: '350.00',
        currency: 'USD',
        is_new: false,
        is_gently_used: true,
        is_used: false,
        is_very_worn: false,
        sold: false,
        deleted: false,
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = GrailedListingSchema.safeParse({
        title: 'No ID',
        price: '100.00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TrrConsignmentSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = TrrConsignmentSchema.safeParse({
        id: 'trr-001',
        title: 'Chanel Bag',
        price: '2500.00',
        condition: 'Excellent',
        authentication_status: 'authenticated',
        images: [{ url: 'https://img.com/1.jpg', position: 0, is_primary: true }],
        designer: { name: 'Chanel' },
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = TrrConsignmentSchema.safeParse({
        title: 'No ID',
        price: '500.00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DepopProductSchema', () => {
    it('valid input with all required fields passes', () => {
      const result = DepopProductSchema.safeParse({
        id: 'dep-001',
        slug: 'vintage-tee-123',
        price: { price_amount: '25.00', currency_name: 'USD' },
        pictures: [{ url: 'https://img.com/1.jpg' }],
        status: 'active',
      });
      expect(result.success).toBe(true);
    });

    it('missing required id fails', () => {
      const result = DepopProductSchema.safeParse({
        slug: 'no-id',
        price: { price_amount: '10.00', currency_name: 'USD' },
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('normalizeExternalListing integration', () => {
  it('returns null for invalid EBAY input (missing sku)', async () => {
    const { normalizeExternalListing } = await import(
      '@/lib/crosslister/services/normalizer-dispatch'
    );
    const result = normalizeExternalListing({ title: 'No SKU' }, 'EBAY');
    expect(result).toBeNull();
  });

  it('returns ExternalListing for valid EBAY input', async () => {
    const { normalizeExternalListing } = await import(
      '@/lib/crosslister/services/normalizer-dispatch'
    );
    const result = normalizeExternalListing({ sku: 'SKU-VALID' }, 'EBAY');
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe('SKU-VALID');
  });

  it('returns null for invalid THEREALREAL input (missing id)', async () => {
    const { normalizeExternalListing } = await import(
      '@/lib/crosslister/services/normalizer-dispatch'
    );
    const result = normalizeExternalListing(
      { title: 'No ID', price: '100.00' },
      'THEREALREAL',
    );
    expect(result).toBeNull();
  });

  it('returns null when raw is empty object for any channel', async () => {
    const { normalizeExternalListing } = await import(
      '@/lib/crosslister/services/normalizer-dispatch'
    );
    const result = normalizeExternalListing({}, 'POSHMARK');
    expect(result).toBeNull();
  });
});
