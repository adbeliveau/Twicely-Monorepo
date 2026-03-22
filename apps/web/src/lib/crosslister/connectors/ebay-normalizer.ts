/**
 * eBay listing normalizer — maps eBay inventory item fields to Twicely ExternalListing shape.
 * Source: F1.2 install prompt §2.7
 *
 * NOT a 'use server' file — plain TypeScript module.
 */

import type { ExternalListing, ExternalImage } from '../types';
import type { EbayInventoryItem } from '@twicely/crosslister/connectors/ebay-types';

/**
 * Normalized data returned from the normalizer, ready for listing creation.
 * Extends ExternalListing with the eBay listing URL.
 */
export interface NormalizedListingData {
  externalId: string;
  title: string;
  description: string;
  priceCents: number;
  currencyCode: string;
  quantity: number;
  condition: string | null;
  brand: string | null;
  images: ExternalImage[];
  itemSpecifics: Record<string, string>;
  url: string;
  status: 'ACTIVE' | 'SOLD' | 'ENDED' | 'DRAFT';
  listedAt: null;
  soldAt: null;
  category: null;
  shippingType: null;
  shippingPriceCents: null;
  weight: null;
  dimensions: null;
}

/**
 * eBay condition → Twicely condition enum mapping.
 * Returns null for unknown conditions so seller can set manually.
 */
const CONDITION_MAP: Record<string, string | null> = {
  NEW: 'NEW_WITH_TAGS',
  NEW_OTHER: 'NEW_WITHOUT_TAGS',
  NEW_WITH_DEFECTS: 'NEW_WITH_DEFECTS',
  LIKE_NEW: 'LIKE_NEW',
  VERY_GOOD: 'VERY_GOOD',
  GOOD: 'GOOD',
  ACCEPTABLE: 'ACCEPTABLE',
};

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parse eBay decimal price string to integer cents.
 * e.g. "89.99" → 8999
 */
export function parseEbayPrice(value: string): number {
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/**
 * Map eBay inventory item to ExternalListing shape.
 * Used both by the connector fetchListings() and the import normalizer stage.
 */
export function normalizeEbayListing(raw: EbayInventoryItem): NormalizedListingData {
  const sku = raw.sku;
  const product = raw.product ?? {};

  // Title: trim, max 200 chars
  const rawTitle = (product.title ?? '').trim();
  const title = rawTitle.slice(0, 200);

  // Description: strip HTML, trim
  const rawDesc = (product.description ?? '').trim();
  const description = stripHtml(rawDesc);

  // Price from first offer
  const offer = raw.offers?.[0];
  const priceStr = offer?.pricingSummary?.price?.value ?? '0';
  const currencyCode = offer?.pricingSummary?.price?.currency ?? 'USD';
  const priceCents = parseEbayPrice(priceStr);

  // Quantity
  const quantity = raw.availability?.shipToLocationAvailability?.quantity ?? 1;

  // Condition
  const rawCondition = raw.condition ?? '';
  const condition = CONDITION_MAP[rawCondition] ?? null;

  // Aspects (item specifics)
  const aspects = product.aspects ?? {};
  const itemSpecifics: Record<string, string> = {};
  for (const [key, values] of Object.entries(aspects)) {
    if (Array.isArray(values) && values.length > 0) {
      itemSpecifics[key] = values[0] ?? '';
    }
  }
  // Store raw condition in itemSpecifics for seller reference
  if (rawCondition) {
    itemSpecifics['ebayCondition'] = rawCondition;
  }

  // Brand: extract from aspects first, then product.brand
  const brand = itemSpecifics['Brand'] ?? itemSpecifics['brand'] ?? product.brand ?? null;

  // Images
  const imageUrls = product.imageUrls ?? [];
  const images: ExternalImage[] = imageUrls.map((url, index) => ({
    url,
    isPrimary: index === 0,
    sortOrder: index,
  }));

  // External URL — requires listingId from offer
  const listingId = offer?.listingId;
  const url = listingId ? `https://www.ebay.com/itm/${listingId}` : `https://www.ebay.com`;

  return {
    externalId: sku,
    title,
    description,
    priceCents,
    currencyCode,
    quantity,
    condition,
    brand,
    images,
    itemSpecifics,
    url,
    status: 'ACTIVE',
    listedAt: null,
    soldAt: null,
    category: null,
    shippingType: null,
    shippingPriceCents: null,
    weight: null,
    dimensions: null,
  };
}

/**
 * Convert NormalizedListingData to ExternalListing shape for the connector pipeline.
 */
export function toExternalListing(normalized: NormalizedListingData): ExternalListing {
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
