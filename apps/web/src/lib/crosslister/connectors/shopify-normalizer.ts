/**
 * Shopify listing normalizer — maps Shopify Admin REST API product fields to
 * Twicely ExternalListing shape.
 * Source: H3.2 install prompt §2.3
 *
 * NOT a 'use server' file — plain TypeScript module.
 * Key rules:
 * - Price lives on variants[0].price as a decimal string ("29.99") — parse to integer cents.
 * - body_html contains raw HTML — strip tags for plain-text description.
 * - status is lowercase ("active"/"draft"/"archived") — map to uppercase ACTIVE/DRAFT/ENDED.
 * - tags is a single comma-separated string, NOT an array.
 * - Product IDs are numbers — convert to string for externalId.
 * - Weight varies by unit (lb/oz/kg/g) — normalize to grams.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { ShopifyProductParsed } from './shopify-schemas';

/** Normalized Shopify product data, ready for ExternalListing conversion */
export interface ShopifyNormalizedData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: Date | null;
  soldAt: null;
  category: string | null;
  shippingType: null;
  shippingPriceCents: null;
  weight: number | null;
  dimensions: null;
}

/**
 * Parse Shopify decimal price string to integer cents.
 * "29.99" -> 2999, "" -> 0, NaN -> 0
 */
export function parseShopifyPrice(priceStr: string): number {
  const parsed = parseFloat(priceStr);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map Shopify product status to Twicely status.
 * Shopify uses lowercase; Twicely uses uppercase.
 */
export function mapShopifyStatus(status: string): 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT' {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'draft':
      return 'DRAFT';
    case 'archived':
      return 'ENDED';
    default:
      return 'ENDED';
  }
}

/**
 * Strip HTML tags from a string to produce plain text.
 * Uses regex — no HTML parsing library per H3.2 constraints.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Convert Shopify variant weight to grams.
 * Supported units: lb, oz, kg, g (or null/undefined — treated as grams).
 * Returns null for null/undefined/zero weight.
 */
export function convertWeightToGrams(
  weight: number | null | undefined,
  unit: string | null | undefined,
): number | null {
  if (weight === null || weight === undefined || weight === 0) return null;
  switch (unit) {
    case 'lb':
      return Math.round(weight * 453.592);
    case 'oz':
      return Math.round(weight * 28.3495);
    case 'kg':
      return Math.round(weight * 1000);
    default:
      // 'g' or null/undefined — treat as grams
      return Math.round(weight);
  }
}

/**
 * Map Shopify product to normalized data shape.
 * shopDomain is optional — used to build the product URL.
 */
export function normalizeShopifyProduct(
  product: ShopifyProductParsed,
  shopDomain?: string,
): ShopifyNormalizedData {
  // Title: trim, max 255 chars
  const title = product.title.trim().slice(0, 255);

  // Description: strip HTML from body_html
  const description = stripHtml(product.body_html ?? '');

  // Price: first variant price. If no variants, 0.
  const firstVariant = product.variants[0];
  const priceCents = firstVariant ? parseShopifyPrice(firstVariant.price) : 0;

  // Currency: default USD (shop currency not on product object)
  const currencyCode = 'USD';

  // Quantity: sum of all variant inventory quantities. Minimum 1.
  const quantitySum = product.variants.reduce((sum, v) => sum + v.inventory_quantity, 0);
  const quantity = Math.max(1, quantitySum);

  // Brand: vendor field
  const brand = product.vendor.trim() || null;

  // Images: sort by position, mark first as primary
  const sortedImages = [...product.images].sort((a, b) => a.position - b.position);
  const images: ExternalImage[] = sortedImages.map((img, idx) => ({
    url: img.src,
    isPrimary: idx === 0,
    sortOrder: idx,
  }));

  // itemSpecifics: tags, productType, sku, barcode
  const itemSpecifics: Record<string, string> = {};
  if (product.tags) {
    itemSpecifics['tags'] = product.tags;
  }
  if (product.product_type.trim()) {
    itemSpecifics['productType'] = product.product_type.trim();
  }
  if (firstVariant?.sku) {
    itemSpecifics['sku'] = firstVariant.sku;
  }
  if (firstVariant?.barcode) {
    itemSpecifics['barcode'] = firstVariant.barcode;
  }

  // URL: built from shopDomain and handle
  const url =
    shopDomain && product.handle ? `https://${shopDomain}/products/${product.handle}` : '';

  // Status: map from Shopify lowercase to Twicely uppercase
  const status = mapShopifyStatus(product.status);

  // listedAt: parse created_at ISO string
  let listedAt: Date | null = null;
  if (product.created_at) {
    const parsed = new Date(product.created_at);
    if (!isNaN(parsed.getTime())) listedAt = parsed;
  }

  // Category: product_type
  const category = product.product_type.trim() || null;

  // Weight: first variant weight converted to grams
  const weight = firstVariant
    ? convertWeightToGrams(firstVariant.weight, firstVariant.weight_unit)
    : null;

  return {
    externalId: String(product.id),
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition: null,
    brand,
    images,
    itemSpecifics,
    url,
    status,
    listedAt,
    soldAt: null,
    category,
    shippingType: null,
    shippingPriceCents: null,
    weight,
    dimensions: null,
  };
}

/**
 * Convert ShopifyNormalizedData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: ShopifyNormalizedData): ExternalListing {
  return {
    externalId: normalized.externalId,
    title: normalized.title,
    description: normalized.description,
    priceCents: normalized.priceCents,
    currencyCode: normalized.currencyCode,
    quantity: normalized.quantity,
    condition: normalized.condition,
    category: normalized.category,
    brand: normalized.brand,
    images: normalized.images,
    itemSpecifics: normalized.itemSpecifics,
    shippingType: normalized.shippingType,
    shippingPriceCents: normalized.shippingPriceCents,
    weight: normalized.weight,
    dimensions: normalized.dimensions,
    url: normalized.url,
    status: normalized.status,
    listedAt: normalized.listedAt,
    soldAt: normalized.soldAt,
  };
}
