import { describe, it, expect } from 'vitest';
import {
  ShopifyShopSchema,
  ShopifyAccessTokenSchema,
  ShopifyProductSchema,
  ShopifyVariantSchema,
  ShopifyImageSchema,
} from '../shopify-schemas';

const validShop = {
  id: 12345,
  name: 'My Vintage Store',
  email: 'owner@example.com',
  domain: 'my-vintage-store.com',
  myshopify_domain: 'my-vintage-store.myshopify.com',
  currency: 'USD',
};

describe('ShopifyShopSchema', () => {
  it('accepts a valid shop object with required fields', () => {
    const result = ShopifyShopSchema.safeParse(validShop);
    expect(result.success).toBe(true);
  });

  it('accepts a valid shop object with all optional fields', () => {
    const result = ShopifyShopSchema.safeParse({
      ...validShop,
      money_format: '${{amount}}',
      primary_locale: 'en',
      country_code: 'US',
      plan_name: 'basic',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a shop object missing the required id field', () => {
    const { id: _id, ...withoutId } = validShop;
    const result = ShopifyShopSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('rejects a shop object missing the required name field', () => {
    const { name: _name, ...withoutName } = validShop;
    const result = ShopifyShopSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it('rejects a shop object missing the required myshopify_domain field', () => {
    const { myshopify_domain: _d, ...withoutDomain } = validShop;
    const result = ShopifyShopSchema.safeParse(withoutDomain);
    expect(result.success).toBe(false);
  });
});

describe('ShopifyAccessTokenSchema', () => {
  it('accepts a valid access token response', () => {
    const result = ShopifyAccessTokenSchema.safeParse({
      access_token: 'shpat_valid-token',
      scope: 'read_products,write_products',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a response missing access_token', () => {
    const result = ShopifyAccessTokenSchema.safeParse({
      scope: 'read_products',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a response missing scope', () => {
    const result = ShopifyAccessTokenSchema.safeParse({
      access_token: 'shpat_token',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a token response that also contains error fields (schema is not strict)', () => {
    // The implementation reads the error field separately before schema parse,
    // but if we reach safeParse, extra fields should not cause rejection.
    const result = ShopifyAccessTokenSchema.safeParse({
      access_token: 'shpat_token',
      scope: 'read_products',
      associated_user_scope: 'read_products',  // extra field from Shopify online tokens
    });
    expect(result.success).toBe(true);
  });

  it('rejects when access_token is a number instead of string', () => {
    const result = ShopifyAccessTokenSchema.safeParse({
      access_token: 12345,
      scope: 'read_products',
    });
    expect(result.success).toBe(false);
  });
});

describe('ShopifyShopSchema — type coercion rejection', () => {
  it('rejects when id is a string instead of number', () => {
    const result = ShopifyShopSchema.safeParse({
      id: 'not-a-number',
      name: 'Shop',
      email: 'a@b.com',
      domain: 'shop.com',
      myshopify_domain: 'shop.myshopify.com',
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when email field is missing', () => {
    const result = ShopifyShopSchema.safeParse({
      id: 1,
      name: 'Shop',
      domain: 'shop.com',
      myshopify_domain: 'shop.myshopify.com',
      currency: 'USD',
      // email deliberately omitted
    });
    expect(result.success).toBe(false);
  });

  it('rejects when domain field is missing', () => {
    const result = ShopifyShopSchema.safeParse({
      id: 1,
      name: 'Shop',
      email: 'a@b.com',
      myshopify_domain: 'shop.myshopify.com',
      currency: 'USD',
      // domain deliberately omitted
    });
    expect(result.success).toBe(false);
  });

  it('rejects when currency field is missing', () => {
    const result = ShopifyShopSchema.safeParse({
      id: 1,
      name: 'Shop',
      email: 'a@b.com',
      domain: 'shop.com',
      myshopify_domain: 'shop.myshopify.com',
      // currency deliberately omitted
    });
    expect(result.success).toBe(false);
  });
});

const validVariant = {
  id: 9876543210,
  product_id: 1234567890,
  title: 'Default Title',
  price: '29.99',
  sku: 'SKU-001',
  inventory_quantity: 3,
  weight: 1.5,
  weight_unit: 'lb',
  barcode: '012345678901',
};

const validImage = {
  id: 111222333,
  product_id: 1234567890,
  position: 1,
  src: 'https://cdn.shopify.com/s/files/levis-front.jpg',
  width: 1200,
  height: 1600,
  alt: 'Front view',
};

const validProduct = {
  id: 1234567890,
  title: "Vintage Levi's 501",
  body_html: '<p>Classic raw denim</p>',
  vendor: "Levi's",
  product_type: 'Jeans',
  status: 'active',
  tags: 'vintage, denim',
  handle: 'vintage-levis-501',
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-03-01T14:22:00Z',
  variants: [validVariant],
  images: [validImage],
};

describe('ShopifyProductSchema', () => {
  it('validates a complete Shopify product', () => {
    const result = ShopifyProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it('validates product with minimal required fields', () => {
    const result = ShopifyProductSchema.safeParse({
      id: 1,
      title: 'Test',
      body_html: null,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects product missing id', () => {
    const { id: _id, ...withoutId } = validProduct;
    const result = ShopifyProductSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('rejects product with invalid status value', () => {
    const result = ShopifyProductSchema.safeParse({ ...validProduct, status: 'ACTIVE' });
    expect(result.success).toBe(false);
  });

  it('accepts product with empty variants and images arrays', () => {
    const result = ShopifyProductSchema.safeParse({
      ...validProduct,
      variants: [],
      images: [],
    });
    expect(result.success).toBe(true);
  });

  it('defaults variants to empty array when omitted', () => {
    const { variants: _variants, ...withoutVariants } = validProduct;
    const result = ShopifyProductSchema.safeParse(withoutVariants);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variants).toEqual([]);
    }
  });

  it('defaults images to empty array when omitted', () => {
    const { images: _images, ...withoutImages } = validProduct;
    const result = ShopifyProductSchema.safeParse(withoutImages);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual([]);
    }
  });

  it('validates variant price as string', () => {
    const result = ShopifyProductSchema.safeParse({
      ...validProduct,
      variants: [{ ...validVariant, price: '99.99' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.variants[0]?.price).toBe('string');
    }
  });
});

describe('ShopifyVariantSchema', () => {
  it('validates a complete variant', () => {
    const result = ShopifyVariantSchema.safeParse(validVariant);
    expect(result.success).toBe(true);
  });

  it('accepts nullable sku, weight, barcode', () => {
    const result = ShopifyVariantSchema.safeParse({
      ...validVariant,
      sku: null,
      weight: null,
      weight_unit: null,
      barcode: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('ShopifyImageSchema', () => {
  it('validates a complete image', () => {
    const result = ShopifyImageSchema.safeParse(validImage);
    expect(result.success).toBe(true);
  });

  it('accepts nullable width, height, alt', () => {
    const result = ShopifyImageSchema.safeParse({
      ...validImage,
      width: null,
      height: null,
      alt: null,
    });
    expect(result.success).toBe(true);
  });
});
