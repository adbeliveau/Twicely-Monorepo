import { describe, it, expect } from 'vitest';
import { toWhatnotInput, toWhatnotPartialInput } from '../whatnot-transform';
import type { TransformedListing } from '../../types';

function buildTransformedListing(overrides: Partial<TransformedListing> = {}): TransformedListing {
  return {
    title: 'Test Item',
    description: 'Test description',
    descriptionHtml: null,
    priceCents: 4999,
    quantity: 1,
    condition: 'GOOD',
    category: { externalCategoryId: 'cat-123', externalCategoryName: 'Clothing', path: ['Clothing'] },
    brand: null,
    images: [
      { url: 'https://cdn.twicely.co/img0.jpg', sortOrder: 0, isPrimary: true },
      { url: 'https://cdn.twicely.co/img1.jpg', sortOrder: 1, isPrimary: false },
    ],
    itemSpecifics: {},
    shipping: { type: 'FREE', flatRateCents: null, weightOz: null, dimensions: null, handlingTimeDays: 1 },
    ...overrides,
  };
}

describe('toWhatnotInput', () => {
  it('converts TransformedListing to WhatnotListingInput', () => {
    const result = toWhatnotInput(buildTransformedListing());
    expect(result.title).toBe('Test Item');
    expect(result.description).toBe('Test description');
    expect(result.price).toEqual({ amount: '49.99', currencyCode: 'USD' });
    expect(result.quantity).toBe(1);
  });

  it('converts priceCents to Money decimal string', () => {
    const result = toWhatnotInput(buildTransformedListing({ priceCents: 4999 }));
    expect(result.price.amount).toBe('49.99');
    expect(result.price.currencyCode).toBe('USD');
  });

  it('truncates title to 200 characters', () => {
    const longTitle = 'A'.repeat(300);
    const result = toWhatnotInput(buildTransformedListing({ title: longTitle }));
    expect(result.title).toHaveLength(200);
  });

  it('truncates description to 5000 characters', () => {
    const longDesc = 'B'.repeat(6000);
    const result = toWhatnotInput(buildTransformedListing({ description: longDesc }));
    expect(result.description).toHaveLength(5000);
  });

  it('limits images to 10', () => {
    const images = Array.from({ length: 15 }, (_, i) => ({
      url: `https://cdn.twicely.co/img${i}.jpg`,
      sortOrder: i,
      isPrimary: i === 0,
    }));
    const result = toWhatnotInput(buildTransformedListing({ images }));
    expect(result.media).toHaveLength(10);
  });

  it('sorts images by sortOrder', () => {
    const images = [
      { url: 'https://cdn.twicely.co/img2.jpg', sortOrder: 2, isPrimary: false },
      { url: 'https://cdn.twicely.co/img0.jpg', sortOrder: 0, isPrimary: true },
      { url: 'https://cdn.twicely.co/img1.jpg', sortOrder: 1, isPrimary: false },
    ];
    const result = toWhatnotInput(buildTransformedListing({ images }));
    expect(result.media?.[0]?.url).toBe('https://cdn.twicely.co/img0.jpg');
    expect(result.media?.[1]?.url).toBe('https://cdn.twicely.co/img1.jpg');
    expect(result.media?.[2]?.url).toBe('https://cdn.twicely.co/img2.jpg');
  });

  it('maps category.externalCategoryId to productTaxonomyNodeId', () => {
    const result = toWhatnotInput(
      buildTransformedListing({
        category: { externalCategoryId: 'tax-node-789', externalCategoryName: 'Shoes', path: [] },
      }),
    );
    expect(result.productTaxonomyNodeId).toBe('tax-node-789');
  });

  it('omits productTaxonomyNodeId when no category externalCategoryId', () => {
    const result = toWhatnotInput(
      buildTransformedListing({
        category: { externalCategoryId: '', externalCategoryName: '', path: [] },
      }),
    );
    expect(result.productTaxonomyNodeId).toBeUndefined();
  });

  it('omits condition when falsy', () => {
    const result = toWhatnotInput(buildTransformedListing({ condition: '' }));
    expect(result.condition).toBeUndefined();
  });
});

describe('toWhatnotPartialInput', () => {
  it('includes only present fields', () => {
    const result = toWhatnotPartialInput({ title: 'Updated Title' });
    expect(result.title).toBe('Updated Title');
    expect(result.price).toBeUndefined();
    expect(result.media).toBeUndefined();
    expect(result.quantity).toBeUndefined();
  });

  it('converts priceCents when present', () => {
    const result = toWhatnotPartialInput({ priceCents: 1999 });
    expect(result.price?.amount).toBe('19.99');
    expect(result.price?.currencyCode).toBe('USD');
  });

  it('omits price when priceCents not in changes', () => {
    const result = toWhatnotPartialInput({ title: 'Only title' });
    expect(result.price).toBeUndefined();
  });

  it('handles images change', () => {
    const result = toWhatnotPartialInput({
      images: [
        { url: 'https://cdn.twicely.co/new.jpg', sortOrder: 0, isPrimary: true },
      ],
    });
    expect(result.media).toHaveLength(1);
    expect(result.media?.[0]?.url).toBe('https://cdn.twicely.co/new.jpg');
  });

  it('handles empty changes object', () => {
    const result = toWhatnotPartialInput({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('truncates title to 200 characters when present in partial', () => {
    const result = toWhatnotPartialInput({ title: 'X'.repeat(300) });
    expect(result.title).toHaveLength(200);
  });

  it('truncates description to 5000 characters when present in partial', () => {
    const result = toWhatnotPartialInput({ description: 'Y'.repeat(6000) });
    expect(result.description).toHaveLength(5000);
  });

  it('maps category.externalCategoryId to productTaxonomyNodeId', () => {
    const result = toWhatnotPartialInput({
      category: { externalCategoryId: 'tax-789', externalCategoryName: 'Sneakers', path: ['Shoes'] },
    });
    expect(result.productTaxonomyNodeId).toBe('tax-789');
  });

  it('sets productTaxonomyNodeId to undefined when externalCategoryId is empty', () => {
    const result = toWhatnotPartialInput({
      category: { externalCategoryId: '', externalCategoryName: '', path: [] },
    });
    expect(result.productTaxonomyNodeId).toBeUndefined();
  });

  it('limits images to 10 and sorts by sortOrder in partial', () => {
    const images = Array.from({ length: 12 }, (_, i) => ({
      url: `https://cdn.twicely.co/img${i}.jpg`,
      sortOrder: 11 - i, // reverse order to test sort
      isPrimary: i === 11,
    }));
    const result = toWhatnotPartialInput({ images });
    expect(result.media).toHaveLength(10);
    // After sort by sortOrder (0..11), first item sortOrder=0 is img11 (url ends in img11.jpg)
    expect(result.media?.[0]?.url).toContain('img11.jpg');
  });

  it('includes quantity when present', () => {
    const result = toWhatnotPartialInput({ quantity: 5 });
    expect(result.quantity).toBe(5);
  });

  it('omits quantity when not in changes', () => {
    const result = toWhatnotPartialInput({ title: 'Only title' });
    expect(result.quantity).toBeUndefined();
  });
});
